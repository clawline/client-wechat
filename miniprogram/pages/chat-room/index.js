const { SLASH_COMMANDS, EMOJI_LIST } = require('../../mock/data');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const {
  appendMessage,
  clearAgentUnread,
  clone,
  getConnectionState,
  getMessages,
  getPreferenceForm,
  incrementAgentUnread,
  setMessages,
  updateAgentPreview,
} = require('../../utils/app-state');
const { createGenericChannelClient, getActiveConnection } = require('../../utils/clawline');
const { notifyForegroundMessage } = require('../../utils/notifications');
const { redirectToScreen } = require('../../utils/routes');

const DEFAULT_THINKING_TEXT = 'OpenClaw is thinking...';

function detectMessageActions(text) {
  if (!text) return null;
  var lower = text.toLowerCase();

  // Detect /models provider list
  var providerPattern = /^\s*([\w][\w-]*)\s+\((\d+)\)\s*$/gm;
  var providers = [];
  var pm;
  while ((pm = providerPattern.exec(text)) !== null) {
    providers.push({ label: pm[1], command: '/models ' + pm[1], badge: pm[2] });
  }
  if (providers.length >= 2) {
    return { title: 'Providers', options: providers };
  }

  // Detect model switch list
  if (lower.includes('model') && (lower.includes('available') || lower.includes('current') || lower.includes('active') || lower.includes('switch'))) {
    var modelPattern = /`([^`]+\/[^`]+)`/g;
    var models = [];
    var mm;
    while ((mm = modelPattern.exec(text)) !== null) {
      var v = mm[1].trim();
      if (v.includes('/') && !v.startsWith('http') && v.length > 3) {
        models.push({ label: v.split('/').pop() || v, command: '/model ' + v, badge: '' });
      }
    }
    if (models.length >= 1) {
      return { title: 'Switch Model', options: models.slice(0, 20) };
    }
  }

  // Detect think levels
  if ((lower.includes('think') || lower.includes('reasoning')) && (lower.includes('level') || lower.includes('budget') || lower.includes('low') || lower.includes('high'))) {
    return {
      title: 'Reasoning Level',
      options: [
        { label: 'Off', command: '/think off', badge: '' },
        { label: 'Low', command: '/think low', badge: '' },
        { label: 'Medium', command: '/think medium', badge: '' },
        { label: 'High', command: '/think high', badge: '' },
      ],
    };
  }

  // Detect command list
  if ((lower.includes('/help') || lower.includes('/commands')) && lower.includes('/model') && lower.includes('/status')) {
    return {
      title: 'Quick Actions',
      options: [
        { label: 'Status', command: '/status', badge: '' },
        { label: 'Models', command: '/models', badge: '' },
        { label: 'New Session', command: '/new', badge: '' },
        { label: 'Reset', command: '/reset', badge: '' },
      ],
    };
  }

  return null;
}

function filterSlashCommands(inputValue, catalog) {
  if (!inputValue.startsWith('/')) return [];
  const query = inputValue.slice(1).trim().toLowerCase();
  if (!query) return clone(catalog);
  return catalog.filter((item) => {
    return item.label.toLowerCase().includes(`/${query}`)
      || item.desc.toLowerCase().includes(query);
  });
}

function formatMessageText(contentType, content) {
  if (contentType === 'image') return content ? `[Image] ${content}` : '[Image]';
  if (contentType === 'voice') return content ? `[Voice] ${content}` : '[Voice]';
  if (contentType === 'audio') return content ? `[Audio] ${content}` : '[Audio]';
  return content || '';
}

function normalizeHistoryMessage(entry) {
  return {
    id: entry.messageId,
    sender: entry.direction === 'sent' ? 'user' : 'ai',
    text: formatMessageText(entry.contentType, entry.content),
    reactions: [],
    contentType: entry.contentType || 'text',
    mediaUrl: entry.mediaUrl || '',
    mimeType: entry.mimeType || '',
    timestamp: entry.timestamp || Date.now(),
  };
}

function normalizeOutboundMessage(entry) {
  return {
    id: entry.messageId,
    sender: 'ai',
    text: formatMessageText(entry.contentType, entry.content),
    reactions: [],
    contentType: entry.contentType || 'text',
    mediaUrl: entry.mediaUrl || '',
    mimeType: entry.mimeType || '',
    timestamp: entry.timestamp || Date.now(),
  };
}

function normalizeInboundMessage(entry) {
  return {
    id: entry.messageId,
    sender: 'user',
    text: entry.content || '',
    reactions: [],
    contentType: entry.messageType || 'text',
    timestamp: entry.timestamp || Date.now(),
  };
}

function getConnectionMeta(status, detail) {
  switch (status) {
    case 'connected':
      return {
        text: 'Connected',
        tone: 'connected',
        detail: detail || 'Generic Channel online',
      };
    case 'connecting':
      return {
        text: 'Connecting',
        tone: 'connecting',
        detail: detail || 'Connecting to Generic Channel',
      };
    case 'reconnecting':
      return {
        text: 'Reconnecting',
        tone: 'reconnecting',
        detail: detail || 'Trying to reconnect',
      };
    default:
      return {
        text: 'Offline',
        tone: 'disconnected',
        detail: detail || 'Generic Channel offline',
      };
  }
}

const QUICK_COMMANDS = [
  { label: '/status', emoji: '📊' },
  { label: '/models', emoji: '🤖' },
  { label: '/help', emoji: '❓' },
  { label: '/new', emoji: '✨' },
  { label: '/reset', emoji: '🔄' },
];

function formatTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function formatDate(ts) {
  var d = new Date(ts);
  var now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  var y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function isDifferentDay(ts1, ts2) {
  if (!ts1 || !ts2) return true;
  return new Date(ts1).toDateString() !== new Date(ts2).toDateString();
}

function addDateSeparators(messages) {
  var result = [];
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var prev = i > 0 ? messages[i - 1] : null;
    if (isDifferentDay(prev ? prev.timestamp : null, msg.timestamp) && msg.timestamp) {
      result.push({ id: 'sep-' + msg.id, type: 'date-separator', text: formatDate(msg.timestamp) });
    }
    result.push(Object.assign({}, msg, { formattedTime: formatTime(msg.timestamp) }));
  }
  return result;
}

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    activeChatId: '',
    activeChat: {},
    activeConversationId: '',
    messages: [],
    displayMessages: [],
    inputValue: '',
    showSlashMenu: false,
    showEmojiPicker: false,
    showThinkingIndicator: false,
    thinkingText: DEFAULT_THINKING_TEXT,
    reactingToMsgId: '',
    activeBubbleId: '',
    chatScrollAnchor: '',
    replyingTo: null,
    peerTyping: false,
    editingMsg: null,
    slashCommandCatalog: clone(SLASH_COMMANDS),
    slashCommands: clone(SLASH_COMMANDS),
    emojiList: clone(EMOJI_LIST),
    quickCommands: QUICK_COMMANDS,
    agentEmoji: '🤖',
    agentName: '',
    isRecording: false,
    genericSenderId: '',
    genericConnectionStatus: 'disconnected',
    genericConnectionStatusText: 'Offline',
    genericConnectionTone: 'disconnected',
    genericConnectionDetail: 'Generic Channel offline',
  },

  onLoad(options) {
    const agentId = options.agentId || 'main';
    const activeConn = getActiveConnection();

    if (!activeConn) {
      wx.showToast({ title: 'No server connected.', icon: 'none' });
      redirectToScreen('chats');
      return;
    }

    const conversationId = activeConn.chatId || `openclaw-mini-agent-${agentId}-${activeConn.id}`;
    const connection = getConnectionState();

    // Load agent info from cache
    var agentEmoji = '🤖';
    var agentName = agentId;
    try {
      var cached = wx.getStorageSync('openclaw.agentList');
      if (cached) {
        var agents = JSON.parse(cached);
        var info = agents.find(function (a) { return a.id === agentId; });
        if (info) {
          agentEmoji = info.identityEmoji || '🤖';
          agentName = info.name || agentId;
        }
      }
    } catch (e) {}

    this.genericClient = null;
    this.pageVisible = true;
    this.activeConn = activeConn;

    // Load persisted messages first, then fall back to app-state
    var persistedMsgs = this._loadPersistedMessages();
    var initialMsgs = persistedMsgs.length > 0 ? persistedMsgs : getMessages(conversationId);

    this.setData({
      ...getPageChromeData(),
      activeChatId: agentId,
      activeChat: { id: agentId, name: agentName, isGroup: false },
      activeConversationId: conversationId,
      messages: initialMsgs,
      displayMessages: addDateSeparators(initialMsgs),
      genericSenderId: connection.senderId,
      agentEmoji,
      agentName,
    }, () => {
      this.scrollChatToBottom();
    });

    clearAgentUnread(agentId);
    this.connectAgentChannel(true);
  },

  onShow() {
    this.pageVisible = true;
    if (this.data.activeChatId) {
      clearAgentUnread(this.data.activeChatId);
    }
  },

  onHide() {
    this.pageVisible = false;
  },

  onUnload() {
    this.pageVisible = false;
    this.teardownGenericChannel(true);
  },

  applyConnectionStatus(payload = {}) {
    const meta = getConnectionMeta(payload.status, payload.detail);
    this.setData({
      genericConnectionStatus: payload.status || 'disconnected',
      genericConnectionStatusText: meta.text,
      genericConnectionTone: meta.tone,
      genericConnectionDetail: meta.detail,
    });
  },

  showThinkingIndicator(text) {
    this.setData({
      showThinkingIndicator: true,
      thinkingText: text || DEFAULT_THINKING_TEXT,
    }, () => {
      this.scrollChatToBottom();
    });
  },

  hideThinkingIndicator() {
    if (!this.data.showThinkingIndicator) return;
    this.setData({
      showThinkingIndicator: false,
      thinkingText: DEFAULT_THINKING_TEXT,
    });
  },

  syncMessages(messages) {
    setMessages(this.data.activeConversationId, messages);
    this.setData({ messages, displayMessages: addDateSeparators(messages) }, () => {
      this.scrollChatToBottom();
    });
    // Persist to storage
    this._persistMessages(messages);
  },

  appendLocalMessage(message) {
    const messages = appendMessage(this.data.activeConversationId, message);
    this.setData({ messages, displayMessages: addDateSeparators(messages) }, () => {
      this.scrollChatToBottom();
    });
    this._persistMessages(messages);
    return messages;
  },

  _persistMessages(messages) {
    try {
      var key = 'openclaw.msgs.' + this.data.activeChatId + '.' + (this.activeConn ? this.activeConn.id : '');
      wx.setStorageSync(key, JSON.stringify(messages.slice(-200)));
    } catch (e) {}
  },

  _loadPersistedMessages() {
    try {
      var key = 'openclaw.msgs.' + this.data.activeChatId + '.' + (this.activeConn ? this.activeConn.id : '');
      var raw = wx.getStorageSync(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  handleSocketPacket(packet = {}) {
    switch (packet.type) {
      case 'connection.open':
        this.applyConnectionStatus({
          status: 'connected',
          detail: getPreferenceForm().genericChannelUrl,
        });
        break;
      case 'history.sync': {
        const historyMessages = Array.isArray(packet.data && packet.data.messages)
          ? packet.data.messages.map(normalizeHistoryMessage)
          : [];
        this.hideThinkingIndicator();
        this.syncMessages(historyMessages);
        if (historyMessages.length) {
          const last = historyMessages[historyMessages.length - 1];
          updateAgentPreview(this.data.activeChatId, last.text, last.timestamp);
        }
        break;
      }
      case 'message.send': {
        const nextMessage = normalizeOutboundMessage(packet.data || {});
        nextMessage.actions = detectMessageActions(nextMessage.text);
        this.hideThinkingIndicator();
        this.appendLocalMessage(nextMessage);
        updateAgentPreview(this.data.activeChatId, nextMessage.text, nextMessage.timestamp);
        if (this.pageVisible) {
          notifyForegroundMessage(`${this.data.activeChat.name || 'OpenClaw'} 有新消息`);
        } else {
          incrementAgentUnread(this.data.activeChatId, 1);
        }
        break;
      }
      case 'thinking.start':
        this.showThinkingIndicator((packet.data && packet.data.content) || DEFAULT_THINKING_TEXT);
        break;
      case 'thinking.update':
        this.showThinkingIndicator((packet.data && packet.data.content) || DEFAULT_THINKING_TEXT);
        break;
      case 'thinking.end':
        this.hideThinkingIndicator();
        break;
      case 'reaction.add':
      case 'reaction.remove': {
        const rid = packet.data && packet.data.messageId;
        const remoji = packet.data && packet.data.emoji;
        if (rid && remoji) {
          const msgs = this.data.messages.map(function (m) {
            if (m.id !== rid) return m;
            var reactions = Array.isArray(m.reactions) ? m.reactions.slice() : [];
            if (packet.type === 'reaction.add') {
              if (!reactions.includes(remoji)) reactions.push(remoji);
            } else {
              reactions = reactions.filter(function (r) { return r !== remoji; });
            }
            return Object.assign({}, m, { reactions: reactions });
          });
          this.syncMessages(msgs);
        }
        break;
      }
      case 'typing': {
        var td = packet.data || {};
        if (td.senderId !== this.data.genericSenderId) {
          this.setData({ peerTyping: !!td.isTyping });
          if (td.isTyping) {
            if (this._typingTimeout) clearTimeout(this._typingTimeout);
            this._typingTimeout = setTimeout(() => {
              this.setData({ peerTyping: false });
            }, 5000);
          }
        }
        break;
      }
      case 'message.edit': {
        var ed = packet.data || {};
        if (ed.messageId && ed.content) {
          var editedMsgs = this.data.messages.map(function (m) {
            return m.id === ed.messageId ? Object.assign({}, m, { text: ed.content }) : m;
          });
          this.syncMessages(editedMsgs);
        }
        break;
      }
      case 'message.delete': {
        var dd = packet.data || {};
        if (dd.messageId) {
          var filteredMsgs = this.data.messages.filter(function (m) {
            return m.id !== dd.messageId;
          });
          this.syncMessages(filteredMsgs);
        }
        break;
      }
      default:
        break;
    }
  },

  handleSocketStatus(payload = {}) {
    this.applyConnectionStatus(payload);
  },

  handleSocketError(message) {
    this.applyConnectionStatus({
      status: this.data.genericConnectionStatus === 'connected' ? 'connected' : 'disconnected',
      detail: message || 'Socket connection failed.',
    });
  },

  connectAgentChannel(force = false) {
    const connection = getConnectionState();
    const activeConn = this.activeConn || getActiveConnection();

    if (!activeConn || !activeConn.serverUrl) {
      wx.showToast({ title: 'Please configure a server first.', icon: 'none' });
      redirectToScreen('profile');
      return;
    }

    if (this.genericClient && !force) return;
    if (this.genericClient) {
      this.genericClient.close(false);
      this.genericClient = null;
    }

    this.genericClient = createGenericChannelClient({
      serverUrl: activeConn.serverUrl,
      chatId: activeConn.chatId || this.data.activeConversationId,
      chatType: 'direct',
      senderId: activeConn.senderId || connection.senderId,
      senderName: activeConn.displayName || connection.senderName,
      agentId: this.data.activeChatId,
      token: activeConn.token || '',
      onEvent: (packet) => this.handleSocketPacket(packet),
      onStatusChange: (payload) => this.handleSocketStatus(payload),
      onError: (message) => this.handleSocketError(message),
    });

    this.genericClient.connect(force);
  },

  teardownGenericChannel(manual = true) {
    if (this.genericClient) {
      this.genericClient.close(manual);
      this.genericClient = null;
    }

    this.hideThinkingIndicator();
    this.applyConnectionStatus({ status: 'disconnected' });
  },

  handleBack() {
    this.teardownGenericChannel(true);
    wx.navigateBack({
      delta: 1,
      fail() {
        redirectToScreen('chats');
      },
    });
  },

  handleReconnectChat() {
    wx.showToast({ title: 'Reconnecting to Generic Channel...', icon: 'none' });
    this.connectAgentChannel(true);
  },

  handleMessageInput(event) {
    const inputValue = event.detail.value || '';
    const shouldOpenSlash = inputValue.startsWith('/');
    const nextSlashCommands = shouldOpenSlash
      ? filterSlashCommands(inputValue, this.data.slashCommandCatalog)
      : clone(this.data.slashCommandCatalog);
    this.setData({
      inputValue,
      showSlashMenu: shouldOpenSlash,
      slashCommands: nextSlashCommands,
      showEmojiPicker: shouldOpenSlash ? false : this.data.showEmojiPicker,
      reactingToMsgId: shouldOpenSlash ? '' : this.data.reactingToMsgId,
    });

    // Send typing indicator (debounced)
    if (inputValue.trim() && this.genericClient && this.genericClient.isOpen()) {
      try { this.genericClient.sendTyping(true); } catch (e) {}
      if (this._typingSendTimeout) clearTimeout(this._typingSendTimeout);
      this._typingSendTimeout = setTimeout(() => {
        try { if (this.genericClient) this.genericClient.sendTyping(false); } catch (e) {}
      }, 3000);
    }
  },

  submitTextMessage(value) {
    const text = `${value || ''}`.trim();
    if (!text) return;

    if (!this.genericClient || !this.genericClient.isOpen()) {
      wx.showToast({ title: 'Generic Channel is not connected.', icon: 'none' });
      this.connectAgentChannel(true);
      return false;
    }

    const replyTo = this.data.replyingTo;
    let payload;
    try {
      if (replyTo && replyTo.id) {
        payload = this.genericClient.sendTextWithParent(text, replyTo.id);
      } else {
        payload = this.genericClient.sendText(text);
      }
    } catch (error) {
      wx.showToast({ title: 'Generic Channel is not connected.', icon: 'none' });
      this.connectAgentChannel(true);
      return false;
    }

    const nextMessage = normalizeInboundMessage(payload);
    if (replyTo) nextMessage.replyTo = replyTo.id;
    nextMessage.timestamp = Date.now();

    this.setData({
      inputValue: '',
      showSlashMenu: false,
      showEmojiPicker: false,
      slashCommands: clone(this.data.slashCommandCatalog),
      reactingToMsgId: '',
      activeBubbleId: '',
      replyingTo: null,
    });

    this.hideThinkingIndicator();
    this.appendLocalMessage(nextMessage);
    updateAgentPreview(this.data.activeChatId, nextMessage.text, nextMessage.timestamp);
    return true;
  },

  handleSendMessage() {
    // If editing, save the edit instead
    if (this.data.editingMsg) {
      var editText = (this.data.inputValue || '').trim();
      if (!editText) return;
      try {
        if (this.genericClient && this.genericClient.isOpen()) {
          this.genericClient.editMessage(this.data.editingMsg.id, editText);
        }
      } catch (e) {}
      var editedMsgs = this.data.messages.map((m) =>
        m.id === this.data.editingMsg.id ? Object.assign({}, m, { text: editText }) : m
      );
      this.syncMessages(editedMsgs);
      this.setData({ editingMsg: null, inputValue: '' });
      return;
    }
    this.submitTextMessage(this.data.inputValue);
  },

  handleChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0];
        const fs = wx.getFileSystemManager();
        try {
          const base64 = fs.readFileSync(file.tempFilePath, 'base64');
          const mimeType = file.fileType === 'image' ? 'image/jpeg' : 'image/png';
          const dataUrl = 'data:' + mimeType + ';base64,' + base64;

          if (!this.genericClient || !this.genericClient.isOpen()) {
            wx.showToast({ title: 'Not connected', icon: 'none' });
            return;
          }

          const payload = this.genericClient.sendMedia({
            messageType: 'image',
            content: '',
            mediaUrl: dataUrl,
            mimeType: mimeType,
          });

          const msg = {
            id: payload.messageId,
            sender: 'user',
            text: '[Image]',
            mediaType: 'image',
            timestamp: Date.now(),
          };
          this.appendLocalMessage(msg);
        } catch (e) {
          wx.showToast({ title: 'Failed to read image', icon: 'none' });
        }
      },
    });
  },

  handleVoiceRecord() {
    if (this._isRecording) {
      this._recorderManager.stop();
      return;
    }

    if (!this._recorderManager) {
      this._recorderManager = wx.getRecorderManager();
      this._recorderManager.onStop((res) => {
        this._isRecording = false;
        this.setData({ isRecording: false });
        const fs = wx.getFileSystemManager();
        try {
          const base64 = fs.readFileSync(res.tempFilePath, 'base64');
          const dataUrl = 'data:audio/aac;base64,' + base64;

          if (!this.genericClient || !this.genericClient.isOpen()) {
            wx.showToast({ title: 'Not connected', icon: 'none' });
            return;
          }

          const payload = this.genericClient.sendMedia({
            messageType: 'voice',
            content: '',
            mediaUrl: dataUrl,
            mimeType: 'audio/aac',
          });

          const msg = {
            id: payload.messageId,
            sender: 'user',
            text: '[Voice]',
            mediaType: 'voice',
            timestamp: Date.now(),
          };
          this.appendLocalMessage(msg);
        } catch (e) {
          wx.showToast({ title: 'Failed to read audio', icon: 'none' });
        }
      });
      this._recorderManager.onError(() => {
        this._isRecording = false;
        this.setData({ isRecording: false });
        wx.showToast({ title: 'Recording failed', icon: 'none' });
      });
    }

    this._isRecording = true;
    this.setData({ isRecording: true });
    this._recorderManager.start({ format: 'aac', duration: 60000 });
  },

  handleToggleEmojiPicker() {
    const nextVisible = !(this.data.showEmojiPicker && !this.data.reactingToMsgId);
    this.setData({
      showEmojiPicker: nextVisible,
      showSlashMenu: false,
      reactingToMsgId: '',
      activeBubbleId: '',
    });
  },

  handleClosePanels() {
    this.setData({
      showSlashMenu: false,
      showEmojiPicker: false,
      slashCommands: clone(this.data.slashCommandCatalog),
      reactingToMsgId: '',
      activeBubbleId: '',
    });
  },

  handleSelectCommand(event) {
    const { label } = event.currentTarget.dataset;
    const needsArgs = ['/new', '/think', '/model', '/models'];
    if (needsArgs.includes(label)) {
      this.setData({
        inputValue: `${label} `,
        showSlashMenu: false,
        slashCommands: clone(this.data.slashCommandCatalog),
      });
      return;
    }
    // Send standalone commands directly
    this.setData({
      showSlashMenu: false,
      slashCommands: clone(this.data.slashCommandCatalog),
    });
    this.submitTextMessage(label);
  },

  handleBubbleSelect(event) {
    const { messageId } = event.detail;
    this.setData({
      activeBubbleId: this.data.activeBubbleId === messageId ? '' : messageId,
    });
  },

  handleOpenReactionPicker(event) {
    const { messageId } = event.detail;
    this.setData({
      showEmojiPicker: true,
      showSlashMenu: false,
      reactingToMsgId: messageId,
      activeBubbleId: messageId,
    });
  },

  handleEmojiSelect(event) {
    const { emoji } = event.detail;

    if (this.data.reactingToMsgId) {
      const msg = this.data.messages.find((m) => m.id === this.data.reactingToMsgId);
      const hasReaction = msg && Array.isArray(msg.reactions) && msg.reactions.includes(emoji);

      // Optimistic local update
      const messages = this.data.messages.map((message) => {
        if (message.id !== this.data.reactingToMsgId) return message;
        const reactions = Array.isArray(message.reactions) ? [...message.reactions] : [];
        return {
          ...message,
          reactions: hasReaction ? reactions.filter((item) => item !== emoji) : [...reactions, emoji],
        };
      });

      this.syncMessages(messages);

      // Send to server
      try {
        if (this.genericClient && this.genericClient.isOpen()) {
          if (hasReaction) {
            this.genericClient.removeReaction(this.data.reactingToMsgId, emoji);
          } else {
            this.genericClient.addReaction(this.data.reactingToMsgId, emoji);
          }
        }
      } catch (e) {}

      this.setData({
        showEmojiPicker: false,
        reactingToMsgId: '',
        activeBubbleId: '',
      });
      return;
    }

    const nextInputValue = `${this.data.inputValue || ''}${emoji}`;
    const shouldQuickSend = !(this.data.inputValue || '').trim();

    this.setData({
      inputValue: nextInputValue,
      showEmojiPicker: false,
    }, () => {
      if (shouldQuickSend) {
        this.submitTextMessage(nextInputValue);
      }
    });
  },

  handleQuickCommand(event) {
    const cmd = event.currentTarget.dataset.command;
    if (cmd) this.submitTextMessage(cmd);
  },

  handleStartReply(event) {
    const msgId = event.currentTarget.dataset.msgId || (event.detail && event.detail.messageId);
    const msg = this.data.messages.find((m) => m.id === msgId);
    if (msg) {
      this.setData({ replyingTo: msg, activeBubbleId: '' });
    }
  },

  handleCancelReply() {
    this.setData({ replyingTo: null });
  },

  scrollChatToBottom() {
    this.setData({ chatScrollAnchor: '' });
    wx.nextTick(() => {
      this.setData({ chatScrollAnchor: 'message-end' });
    });
  },

  handleActionTap(event) {
    const { command } = event.currentTarget.dataset;
    if (command) {
      this.submitTextMessage(command);
    }
  },

  handleEditMessage(event) {
    const msgId = event.currentTarget.dataset.msgId || (event.detail && event.detail.messageId);
    const msg = this.data.messages.find(function (m) { return m.id === msgId; });
    if (msg) {
      this.setData({
        editingMsg: msg,
        inputValue: msg.text,
      });
    }
  },

  handleCancelEdit() {
    this.setData({
      editingMsg: null,
      inputValue: '',
    });
  },

  handleDeleteMessage(event) {
    const msgId = event.currentTarget.dataset.msgId || (event.detail && event.detail.messageId);
    if (!msgId) return;
    wx.showModal({
      title: 'Delete Message',
      content: 'Are you sure you want to delete this message?',
      success: (res) => {
        if (res.confirm) {
          try {
            if (this.genericClient && this.genericClient.isOpen()) {
              this.genericClient.deleteMessage(msgId);
            }
          } catch (e) {}
          var filteredMsgs = this.data.messages.filter(function (m) { return m.id !== msgId; });
          this.syncMessages(filteredMsgs);
        }
      },
    });
  },
});
