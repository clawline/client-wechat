const STORAGE_KEYS = {
  senderId: 'openclaw.generic.senderId',
  senderName: 'openclaw.generic.senderName',
  serverUrl: 'openclaw.generic.serverUrl',
  paired: 'openclaw.generic.paired',
};

const DEFAULT_WS_URL = '';
const MAX_RECONNECT_ATTEMPTS = 6;
const CLOSE_CODE_NORMAL = 1000;

function safeGetStorage(key) {
  try {
    return wx.getStorageSync(key);
  } catch (error) {
    return '';
  }
}

function safeSetStorage(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    return;
  }
}

function createStableId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getStoredConnectionSettings(defaults = {}) {
  const senderId = safeGetStorage(STORAGE_KEYS.senderId) || createStableId('wx-user');
  const senderName = safeGetStorage(STORAGE_KEYS.senderName) || defaults.displayName || 'OpenClaw User';
  const serverUrl = safeGetStorage(STORAGE_KEYS.serverUrl) || defaults.genericChannelUrl || DEFAULT_WS_URL;
  const isPaired = safeGetStorage(STORAGE_KEYS.paired) === 'true';

  safeSetStorage(STORAGE_KEYS.senderId, senderId);
  safeSetStorage(STORAGE_KEYS.senderName, senderName);

  return {
    senderId,
    senderName,
    serverUrl,
    isPaired,
  };
}

function saveConnectionSettings(params = {}) {
  const { displayName, serverUrl, isPaired } = params;

  if (displayName !== undefined) {
    safeSetStorage(STORAGE_KEYS.senderName, displayName);
  }

  if (serverUrl !== undefined) {
    safeSetStorage(STORAGE_KEYS.serverUrl, serverUrl);
  }

  if (typeof isPaired === 'boolean') {
    safeSetStorage(STORAGE_KEYS.paired, isPaired ? 'true' : 'false');
  }
}

function buildConversationId(chat) {
  if (!chat || !chat.id) {
    return 'openclaw-mini-default';
  }

  return `openclaw-mini-chat-${chat.id}`;
}

function buildSocketUrl(serverUrl, chatId, agentId, token) {
  const normalized = `${serverUrl || DEFAULT_WS_URL}`.replace(/[?&]+$/, '');
  const separator = normalized.includes('?') ? '&' : '?';
  let url = `${normalized}${separator}chatId=${encodeURIComponent(chatId)}`;
  if (agentId) url += `&agentId=${encodeURIComponent(agentId)}`;
  if (token) url += `&token=${encodeURIComponent(token)}`;
  return url;
}

function buildInboundMessage(params) {
  const { chatId, senderId, senderName, chatType = 'direct', content, parentId, agentId } = params;
  return {
    messageId: createStableId('msg'),
    chatId,
    chatType,
    senderId,
    senderName,
    messageType: 'text',
    content,
    timestamp: Date.now(),
    ...(agentId ? { agentId } : {}),
    ...(parentId ? { parentId } : {}),
  };
}

class GenericChannelClient {
  constructor(options) {
    this.serverUrl = options.serverUrl || DEFAULT_WS_URL;
    this.chatId = options.chatId;
    this.chatType = options.chatType || 'direct';
    this.senderId = options.senderId;
    this.senderName = options.senderName;
    this.agentId = options.agentId || '';
    this.authToken = options.token || '';
    this.onEvent = options.onEvent;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;
    this.socketTask = null;
    this.connectionToken = 0;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.manualClose = false;
    this.status = 'disconnected';
  }

  updateStatus(status, detail = '') {
    this.status = status;
    if (typeof this.onStatusChange === 'function') {
      this.onStatusChange({
        status,
        detail,
        reconnectAttempts: this.reconnectAttempts,
      });
    }
  }

  isOpen() {
    return this.status === 'connected' && !!this.socketTask;
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  connect(force = false) {
    if (force) {
      this.close(false);
    }

    if (this.socketTask) {
      return;
    }

    this.manualClose = false;
    const token = ++this.connectionToken;
    const nextStatus = this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
    this.updateStatus(nextStatus);

    const socketTask = wx.connectSocket({
      url: buildSocketUrl(this.serverUrl, this.chatId, this.agentId, this.authToken),
      timeout: 10000,
    });

    this.socketTask = socketTask;

    socketTask.onOpen(() => {
      if (this.connectionToken !== token || this.socketTask !== socketTask) return;
      this.reconnectAttempts = 0;
      this.updateStatus('connected');
    });

    socketTask.onMessage((response) => {
      if (this.connectionToken !== token || this.socketTask !== socketTask) return;

      try {
        const packet = JSON.parse(response.data);
        // Update chatId from server response (server may assign/override based on token)
        if (packet.type === 'connection.open' && packet.data && packet.data.chatId) {
          this.chatId = packet.data.chatId;
        }
        if (typeof this.onEvent === 'function') {
          this.onEvent(packet);
        }
      } catch (error) {
        if (typeof this.onError === 'function') {
          this.onError('Failed to parse server message.');
        }
      }
    });

    socketTask.onClose((response = {}) => {
      if (this.connectionToken !== token) return;
      this.socketTask = null;

      if (this.manualClose) {
        this.updateStatus('disconnected');
        return;
      }

      const shouldReconnect = this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS;
      if (!shouldReconnect) {
        this.updateStatus('disconnected', response.reason || 'Connection closed.');
        return;
      }

      this.reconnectAttempts += 1;
      const delay = Math.min(1000 * (2 ** (this.reconnectAttempts - 1)), 15000);
      this.updateStatus('reconnecting', `${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
      this.clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (!this.manualClose) {
          this.connect();
        }
      }, delay);
    });

    socketTask.onError((error = {}) => {
      if (this.connectionToken !== token || this.socketTask !== socketTask) return;
      if (typeof this.onError === 'function') {
        this.onError(error.errMsg || 'Socket connection failed.');
      }
    });
  }

  close(manual = true) {
    this.manualClose = manual;
    this.clearReconnectTimer();
    this.connectionToken += 1;

    const socketTask = this.socketTask;
    this.socketTask = null;

    if (socketTask) {
      try {
        socketTask.close({
          code: CLOSE_CODE_NORMAL,
          reason: manual ? 'Manual close' : 'Connection replaced',
        });
      } catch (error) {
        return;
      }
    }

    if (manual) {
      this.updateStatus('disconnected');
    }
  }

  reconnect() {
    this.reconnectAttempts = 0;
    this.close(false);
    this.connect();
  }

  sendText(content, parentId) {
    if (!this.isOpen()) {
      throw new Error('Socket is not connected.');
    }

    const payload = buildInboundMessage({
      chatId: this.chatId,
      senderId: this.senderId,
      senderName: this.senderName,
      chatType: this.chatType,
      content,
      parentId,
      agentId: this.agentId,
    });

    this.socketTask.send({
      data: JSON.stringify({
        type: 'message.receive',
        data: payload,
      }),
      fail: () => {
        if (typeof this.onError === 'function') {
          this.onError('Failed to send message.');
        }
      },
    });

    return payload;
  }

  sendRaw(packet) {
    if (!this.isOpen()) return;
    this.socketTask.send({
      data: JSON.stringify(packet),
      fail: () => {},
    });
  }

  requestAgentList() {
    this.sendRaw({
      type: 'agent.list.get',
      data: { requestId: createStableId('agent-list') },
    });
  }

  selectAgent(agentId) {
    this.agentId = agentId || '';
    this.sendRaw({
      type: 'agent.select',
      data: {
        requestId: createStableId('agent-select'),
        agentId: agentId || null,
      },
    });
  }

  addReaction(messageId, emoji) {
    this.sendRaw({
      type: 'reaction.add',
      data: {
        messageId,
        chatId: this.chatId,
        senderId: this.senderId,
        emoji,
        timestamp: Date.now(),
      },
    });
  }

  removeReaction(messageId, emoji) {
    this.sendRaw({
      type: 'reaction.remove',
      data: {
        messageId,
        chatId: this.chatId,
        senderId: this.senderId,
        emoji,
        timestamp: Date.now(),
      },
    });
  }

  sendTextWithParent(content, parentId) {
    if (!this.isOpen()) {
      throw new Error('Socket is not connected.');
    }

    var payload = buildInboundMessage({
      chatId: this.chatId,
      senderId: this.senderId,
      senderName: this.senderName,
      chatType: this.chatType,
      content: content,
      parentId: parentId,
      agentId: this.agentId,
    });

    this.socketTask.send({
      data: JSON.stringify({ type: 'message.receive', data: payload }),
      fail: function () {},
    });

    return payload;
  }

  sendMedia(opts) {
    if (!this.isOpen()) {
      throw new Error('Socket is not connected.');
    }

    var payload = {
      messageId: createStableId('msg'),
      chatId: this.chatId,
      chatType: this.chatType,
      senderId: this.senderId,
      senderName: this.senderName,
      messageType: opts.messageType || 'image',
      content: opts.content || '',
      mediaUrl: opts.mediaUrl,
      mimeType: opts.mimeType,
      timestamp: Date.now(),
    };
    if (this.agentId) payload.agentId = this.agentId;

    this.socketTask.send({
      data: JSON.stringify({ type: 'message.receive', data: payload }),
      fail: function () {},
    });

    return payload;
  }

  requestConversationList(agentId) {
    this.sendRaw({
      type: 'conversation.list.get',
      data: {
        requestId: createStableId('conv-list'),
        agentId: agentId || this.agentId || undefined,
      },
    });
  }

  requestHistory(chatId) {
    this.sendRaw({
      type: 'history.get',
      data: {
        requestId: createStableId('history'),
        chatId: chatId,
      },
    });
  }

  editMessage(messageId, newContent) {
    this.sendRaw({
      type: 'message.edit',
      data: {
        messageId: messageId,
        chatId: this.chatId,
        senderId: this.senderId,
        content: newContent,
        timestamp: Date.now(),
      },
    });
  }

  deleteMessage(messageId) {
    this.sendRaw({
      type: 'message.delete',
      data: {
        messageId: messageId,
        chatId: this.chatId,
        senderId: this.senderId,
        timestamp: Date.now(),
      },
    });
  }

  sendTyping(isTyping) {
    this.sendRaw({
      type: 'typing',
      data: {
        chatId: this.chatId,
        senderId: this.senderId,
        isTyping: !!isTyping,
        timestamp: Date.now(),
      },
    });
  }

  sendFile(opts) {
    if (!this.isOpen()) {
      throw new Error('Socket is not connected.');
    }

    var payload = {
      messageId: createStableId('msg'),
      chatId: this.chatId,
      chatType: this.chatType,
      senderId: this.senderId,
      senderName: this.senderName,
      messageType: 'file',
      content: opts.content || opts.fileName || 'File',
      mediaUrl: opts.mediaUrl,
      mimeType: opts.mimeType,
      timestamp: Date.now(),
    };
    if (this.agentId) payload.agentId = this.agentId;

    this.socketTask.send({
      data: JSON.stringify({ type: 'message.receive', data: payload }),
      fail: function () {},
    });

    return payload;
  }
}

function createGenericChannelClient(options) {
  return new GenericChannelClient(options);
}

/* ---- Multi-server connection storage ---- */

const CONNECTIONS_KEY = 'openclaw.connections';
const ACTIVE_CONN_KEY = 'openclaw.activeConnectionId';

function getServerConnections() {
  try {
    const raw = wx.getStorageSync(CONNECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveServerConnections(list) {
  try {
    wx.setStorageSync(CONNECTIONS_KEY, JSON.stringify(list));
  } catch (e) {}
}

function addServerConnection(name, serverUrl, displayName, token, chatId, senderId) {
  const list = getServerConnections();
  const conn = {
    id: createStableId('conn'),
    name,
    displayName,
    serverUrl: (serverUrl || '').replace(/\/+$/, ''),
    token: token || '',
    chatId: chatId || '',
    senderId: senderId || '',
  };
  list.push(conn);
  saveServerConnections(list);
  if (list.length === 1) setActiveConnectionId(conn.id);
  return conn;
}

function removeServerConnection(id) {
  const list = getServerConnections().filter(function (c) { return c.id !== id; });
  saveServerConnections(list);
  if (getActiveConnectionId() === id) {
    setActiveConnectionId(list.length > 0 ? list[0].id : '');
  }
}

function getActiveConnectionId() {
  try {
    return wx.getStorageSync(ACTIVE_CONN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function setActiveConnectionId(id) {
  try {
    wx.setStorageSync(ACTIVE_CONN_KEY, id || '');
  } catch (e) {}
}

function getActiveConnection() {
  const id = getActiveConnectionId();
  if (!id) return null;
  return getServerConnections().find(function (c) { return c.id === id; }) || null;
}

function getServerConnectionById(id) {
  return getServerConnections().find(function (c) { return c.id === id; }) || null;
}

function updateServerConnection(id, updates) {
  var list = getServerConnections();
  var idx = list.findIndex(function (c) { return c.id === id; });
  if (idx === -1) return;
  Object.keys(updates).forEach(function (k) { list[idx][k] = updates[k]; });
  saveServerConnections(list);
}

module.exports = {
  DEFAULT_WS_URL,
  buildConversationId,
  createGenericChannelClient,
  getStoredConnectionSettings,
  saveConnectionSettings,
  getServerConnections,
  addServerConnection,
  removeServerConnection,
  getActiveConnectionId,
  setActiveConnectionId,
  getActiveConnection,
  getServerConnectionById,
  updateServerConnection,
};
