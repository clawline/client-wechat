const { SLASH_COMMANDS, EMOJI_LIST } = require('../../mock/data');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const {
  clearAgentUnread,
  clone,
  getConnectionState,
  getMessages,
  incrementAgentUnread,
  setMessages,
  updateAgentPreview,
} = require('../../utils/app-state');
const { createGenericChannelClient, getActiveConnection } = require('../../utils/generic-channel');
const wsPool = require('../../utils/ws-pool');
const { notifyForegroundMessage } = require('../../utils/notifications');
const { redirectToScreen } = require('../../utils/routes');
const { mergeMessagesById } = require('../../utils/message-merge');
const outbox = require('../../utils/outbox');
const { humanizeError } = require('../../utils/errors');

const DEFAULT_THINKING_TEXT = '思考中';
const THINKING_LABELS = [
  { max: 4000, text: '思考中' },
  { max: 8000, text: '分析中' },
  { max: 15000, text: '整理中' },
  { max: Infinity, text: '仍在处理…' },
];

function detectMessageActions(text) {
  if (!text) return null;
  var lower = text.toLowerCase();
  if ((lower.includes('/help') || lower.includes('/commands')) && lower.includes('/model') && lower.includes('/status')) {
    return {
      title: '快捷操作',
      options: [
        { label: '状态', command: '/status', badge: '' },
        { label: '模型', command: '/models', badge: '' },
        { label: '新对话', command: '/new', badge: '' },
        { label: '重置', command: '/reset', badge: '' },
      ],
    };
  }
  return null;
}

function filterSlashCommands(inputValue, catalog) {
  if (!inputValue.startsWith('/')) return [];
  const query = inputValue.slice(1).trim().toLowerCase();
  if (!query) return clone(catalog);
  return catalog.filter(function (item) {
    return item.label.toLowerCase().includes('/' + query) || item.desc.toLowerCase().includes(query);
  });
}

function formatMessageText(contentType, content) {
  if (contentType === 'image') return content ? '[Image] ' + content : '[Image]';
  if (contentType === 'voice') return content ? '[Voice] ' + content : '[Voice]';
  if (contentType === 'audio') return content ? '[Audio] ' + content : '[Audio]';
  if (contentType === 'file') return content ? '[File] ' + content : '[File]';
  return content || '';
}

function normalizeHistoryMessage(entry) {
  return {
    id: entry.messageId,
    sender: entry.direction === 'sent' ? 'user' : 'ai',
    text: formatMessageText(entry.contentType, entry.content),
    reactions: [],
    contentType: entry.contentType || 'text',
    mediaType: entry.contentType || 'text',
    mediaUrl: entry.mediaUrl || '',
    mimeType: entry.mimeType || '',
    timestamp: entry.timestamp || Date.now(),
    replyTo: entry.parentId || '',
    quotedText: entry.quotedText || '',
    replyPreview: '',
    showReply: true,
    deliveryStatus: entry.direction === 'sent' ? 'sent' : '',
  };
}

function normalizeOutboundMessage(entry) {
  return {
    id: entry.messageId,
    sender: 'ai',
    text: formatMessageText(entry.contentType, entry.content),
    reactions: [],
    contentType: entry.contentType || 'text',
    mediaType: entry.contentType || 'text',
    mediaUrl: entry.mediaUrl || '',
    mimeType: entry.mimeType || '',
    timestamp: entry.timestamp || Date.now(),
    replyTo: entry.parentId || '',
    quotedText: entry.quotedText || '',
    replyPreview: '',
    showReply: true,
    actions: detectMessageActions(formatMessageText(entry.contentType, entry.content)),
  };
}

function normalizeInboundMessage(entry) {
  return {
    id: entry.messageId,
    sender: 'user',
    text: entry.content || '',
    reactions: [],
    contentType: entry.messageType || 'text',
    mediaType: entry.messageType || 'text',
    timestamp: entry.timestamp || Date.now(),
    replyTo: entry.parentId || '',
    replyPreview: '',
    showReply: true,
    deliveryStatus: 'sent',
  };
}

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
  return d.getMonth() + 1 + '/' + d.getDate();
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
    // Group consecutive messages from same sender within 3 minutes
    var grouped = false;
    if (prev && prev.sender === msg.sender && msg.timestamp && prev.timestamp) {
      grouped = (msg.timestamp - prev.timestamp) < 180000;
    }
    result.push(Object.assign({}, msg, { formattedTime: formatTime(msg.timestamp), grouped: grouped }));
  }
  return result;
}

function getThinkingText(startAt, overrideText) {
  if (overrideText) return overrideText;
  var elapsed = Date.now() - (startAt || Date.now());
  for (var i = 0; i < THINKING_LABELS.length; i++) {
    if (elapsed < THINKING_LABELS[i].max) return THINKING_LABELS[i].text;
  }
  return DEFAULT_THINKING_TEXT;
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
    showAttachMenu: false,
    showThinkingIndicator: false,
    thinkingText: DEFAULT_THINKING_TEXT,
    thinkingStartAt: 0,
    reactingToMsgId: '',
    activeBubbleId: '',
    chatScrollAnchor: '',
    replyingTo: null,
    peerTyping: false,
    editingMsg: null,
    slashCommandCatalog: clone(SLASH_COMMANDS),
    slashCommands: clone(SLASH_COMMANDS),
    emojiList: clone(EMOJI_LIST),
    agentEmoji: '🤖',
    agentName: '',
    isRecording: false,
    genericSenderId: '',
    genericConnectionStatus: 'disconnected',
    genericConnectionStatusText: '离线',
    genericConnectionDetail: '离线',
    showDisconnectBanner: false,
    disconnectBannerTone: 'offline',
    disconnectBannerText: '',
    showSuggestionBar: false,
    suggestionItems: [],
    showFollowUpPill: false,
    aiSuggestions: [],
    aiSuggestionsLoading: false,
    errorToast: null,
  },

  onLoad(options) {
    const agentId = options.agentId || 'main';
    const activeConn = getActiveConnection();
    if (!activeConn) {
      wx.showToast({ title: '未连接服务器，请在设置中配置', icon: 'none', duration: 3000 });
      redirectToScreen('chats');
      return;
    }

    this.activeConn = activeConn;
    this.pageVisible = true;
    // Use server-assigned chatId from connection (set during connection.open)
    // Don't fabricate a client-side conversationId
    const conversationId = activeConn.chatId || '';
    const connection = getConnectionState();
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

    var persistedMsgs = this._loadPersistedMessages(agentId);
    var initialMsgs = persistedMsgs.length ? persistedMsgs : getMessages(conversationId);
    initialMsgs = mergeMessagesById([], initialMsgs);

    this.setData({
      ...getPageChromeData(),
      activeChatId: agentId,
      activeChat: { id: agentId, name: agentName, isGroup: false },
      activeConversationId: conversationId,
      messages: initialMsgs,
      displayMessages: addDateSeparators(initialMsgs),
      genericSenderId: connection.senderId,
      agentEmoji: agentEmoji,
      agentName: agentName,
    }, () => {
      this.refreshSuggestionBar();
      this.scrollChatToBottom();
    });

    clearAgentUnread(agentId);
    this._loadSkillsIntoCatalog();
    this.connectAgentChannel(true);
    this.startSuggestionTimer();
  },

  onShow() {
    this.pageVisible = true;
    if (this.data.activeChatId) clearAgentUnread(this.data.activeChatId);
    this.startSuggestionTimer();
    if (this.data.showThinkingIndicator) this.startThinkingTimer();
  },

  onHide() {
    this.pageVisible = false;
    this.clearSuggestionTimer();
    this.clearThinkingTimer();
    if (this._typingTimeout) clearTimeout(this._typingTimeout);
    if (this._isRecording && this._recorderManager) {
      this._recorderManager.stop();
      this._isRecording = false;
      this.setData({ isRecording: false });
    }
  },

  onUnload() {
    this.pageVisible = false;
    this.clearSuggestionTimer();
    this.clearThinkingTimer();
    if (this._typingTimeout) clearTimeout(this._typingTimeout);
    if (this._errorToastTimer) clearTimeout(this._errorToastTimer);
    if (this._isRecording && this._recorderManager) {
      this._recorderManager.stop();
      this._isRecording = false;
      this.setData({ isRecording: false });
    }
    this.teardownGenericChannel(true);
  },

  startSuggestionTimer() {
    this.clearSuggestionTimer();
    this._suggestionTimer = setInterval(() => this.refreshSuggestionBar(), 15000);
    this.refreshSuggestionBar();
  },

  clearSuggestionTimer() {
    if (this._suggestionTimer) {
      clearInterval(this._suggestionTimer);
      this._suggestionTimer = null;
    }
  },

  startThinkingTimer() {
    this.clearThinkingTimer();
    if (!this.pageVisible) return;
    this._thinkingTimer = setInterval(() => {
      if (!this.data.showThinkingIndicator) {
        this.clearThinkingTimer();
        return;
      }
      this.setData({ thinkingText: getThinkingText(this.data.thinkingStartAt) });
    }, 1000);
  },

  clearThinkingTimer() {
    if (this._thinkingTimer) {
      clearInterval(this._thinkingTimer);
      this._thinkingTimer = null;
    }
  },

  showError(message) {
    var info = humanizeError(message);
    var title = '错误';
    var body = String(message || '出错了');
    if (typeof info === 'string') {
      body = info;
    } else if (info && info.title) {
      title = info.title;
      body = info.body || body;
    }
    this.setData({
      errorToast: { title: title, body: body },
    });
    if (this._errorToastTimer) clearTimeout(this._errorToastTimer);
    this._errorToastTimer = setTimeout(() => this.setData({ errorToast: null }), 3000);
  },

  applyConnectionStatus(payload) {
    var status = (payload && payload.status) || 'disconnected';
    var detail = (payload && payload.detail) || '';
    var banner = { showDisconnectBanner: false, disconnectBannerTone: 'offline', disconnectBannerText: '' };
    var text = '离线';
    if (status === 'connected') text = '已连接';
    if (status === 'connecting') text = '连接中';
    if (status === 'reconnecting') {
      text = '重连中';
      banner = { showDisconnectBanner: true, disconnectBannerTone: 'reconnecting', disconnectBannerText: '重连中…' };
    }
    if (status === 'disconnected') {
      banner = { showDisconnectBanner: true, disconnectBannerTone: 'offline', disconnectBannerText: '连接已断开，点击重连' };
    }
    this.setData({
      genericConnectionStatus: status,
      genericConnectionStatusText: text,
      genericConnectionDetail: detail || text,
      showDisconnectBanner: banner.showDisconnectBanner,
      disconnectBannerTone: banner.disconnectBannerTone,
      disconnectBannerText: banner.disconnectBannerText,
    });
    if (status === 'connected') this.flushOutbox();
    this.refreshSuggestionBar();
  },

  refreshSuggestionBar() {
    var last = this.data.messages.length ? this.data.messages[this.data.messages.length - 1] : null;
    var showFollowUpPill = false;
    var items = [];
    if (last && last.sender === 'ai') {
      items = [];
    } else {
      items = ['/status', '/models', '/help'];
      if (last && last.sender === 'user' && !this.data.showThinkingIndicator && (Date.now() - (last.timestamp || 0)) > 120000) {
        showFollowUpPill = true;
      }
    }
    this.setData({
      showSuggestionBar: !this.data.showSlashMenu && !this.data.showEmojiPicker,
      suggestionItems: items,
      showFollowUpPill: showFollowUpPill,
    });
  },

  fetchAiSuggestions() {
    if (this.data.aiSuggestionsLoading) return;
    if (!this.genericClient || !this.genericClient.isOpen()) return;
    var msgs = this.data.messages
      .filter(function (m) { return m.text && m.text.length > 0; })
      .slice(-6)
      .map(function (m) {
        return { role: m.sender === 'user' ? 'user' : 'assistant', text: m.text };
      });
    if (!msgs.length) return;
    this.setData({ aiSuggestionsLoading: true });
    var self = this;
    this.genericClient.requestSuggestions(msgs, function (suggestions) {
      self.setData({
        aiSuggestions: suggestions || [],
        aiSuggestionsLoading: false,
      });
    });
  },

  handleSuggestionTap(event) {
    var value = event.currentTarget.dataset.value;
    if (!value) return;
    this.setData({ inputValue: value });
  },

  handleFetchSuggestions() {
    this.fetchAiSuggestions();
  },

  showThinkingIndicator(text) {
    var startAt = this.data.showThinkingIndicator ? this.data.thinkingStartAt : Date.now();
    this.setData({
      showThinkingIndicator: true,
      thinkingStartAt: startAt,
      thinkingText: getThinkingText(startAt, text),
    }, () => this.scrollChatToBottom());
    this.startThinkingTimer();
    this.refreshSuggestionBar();
  },

  hideThinkingIndicator() {
    this.clearThinkingTimer();
    this.setData({ showThinkingIndicator: false, thinkingStartAt: 0, thinkingText: DEFAULT_THINKING_TEXT });
    this.refreshSuggestionBar();
  },

  syncMessages(messages) {
    var merged = mergeMessagesById([], messages || []);
    // Cap in-memory messages at 300 to prevent setData performance degradation
    if (merged.length > 300) {
      merged = merged.slice(merged.length - 300);
    }
    // Persist to agentId-scoped storage (not fabricated conversationId)
    var persistKey = this.data.activeChatId;

    // Compute suggestion bar state inline to merge into single setData
    var last = merged.length ? merged[merged.length - 1] : null;
    var showFollowUpPill = false;
    var items = [];
    if (last && last.sender === 'ai') {
      items = [];
    } else {
      items = ['/status', '/models', '/help'];
      if (last && last.sender === 'user' && !this.data.showThinkingIndicator && (Date.now() - (last.timestamp || 0)) > 120000) {
        showFollowUpPill = true;
      }
    }

    // Clear AI suggestions when message count changes (new messages arrived)
    var prevLen = this.data.messages.length;
    var clearAi = merged.length !== prevLen;

    this.setData(Object.assign({
      messages: merged,
      displayMessages: addDateSeparators(merged),
      showSuggestionBar: !this.data.showSlashMenu && !this.data.showEmojiPicker,
      suggestionItems: items,
      showFollowUpPill: showFollowUpPill,
    }, clearAi ? { aiSuggestions: [], aiSuggestionsLoading: false } : {}),
    () => this.scrollChatToBottom());
    this._persistMessages(merged);
  },

  upsertMessage(message) {
    this.syncMessages(mergeMessagesById(this.data.messages, [message]));
  },

  _persistMessages(messages) {
    try {
      var key = 'openclaw.msgs.' + this.data.activeChatId + '.' + (this.activeConn ? this.activeConn.id : '');
      wx.setStorageSync(key, JSON.stringify((messages || []).slice(-200)));
    } catch (e) {}
  },

  _loadPersistedMessages(agentId) {
    try {
      var key = 'openclaw.msgs.' + agentId + '.' + (this.activeConn ? this.activeConn.id : '');
      var raw = wx.getStorageSync(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Load skills from agent list cache and merge into slash command catalog.
   * Skills come from the agent.list response (agent.skills array).
   */
  _loadSkillsIntoCatalog() {
    try {
      var raw = wx.getStorageSync('openclaw.agentList');
      if (!raw) return;
      var agents = JSON.parse(raw);
      if (!Array.isArray(agents)) return;
      // Find current agent's skills
      var currentAgent = agents.find((a) => a.id === this.data.activeChatId);
      var skills = (currentAgent && Array.isArray(currentAgent.skills)) ? currentAgent.skills : [];
      // Also check configuredSkills
      var configuredSkills = (currentAgent && Array.isArray(currentAgent.configuredSkills)) ? currentAgent.configuredSkills : [];
      var allSkills = configuredSkills.length ? configuredSkills : skills;
      if (!allSkills.length) return;
      var catalog = clone(this.data.slashCommandCatalog);
      var existingIds = {};
      catalog.forEach(function (c) { existingIds[c.id] = true; });
      var added = 0;
      allSkills.forEach(function (skillName) {
        if (!skillName) return;
        var id = 'skill-' + skillName;
        if (existingIds[id]) return;
        existingIds[id] = true;
        catalog.push({
          id: id,
          icon: 'zap',
          label: '/skill:' + skillName,
          desc: skillName,
        });
        added++;
      });
      if (added > 0) {
        this.setData({ slashCommandCatalog: catalog, slashCommands: catalog });
      }
    } catch (e) {
      // Skills loading is optional — fail silently
    }
  },

  enqueueOfflineText(text, replyTo) {
    var item = {
      id: 'local-' + Date.now(),
      connectionId: this.activeConn.id,
      chatId: this.activeConn.chatId || this.data.activeConversationId,
      agentId: this.data.activeChatId,
      kind: 'text',
      content: text,
      parentId: replyTo && replyTo.id ? replyTo.id : '',
      quotedText: replyTo && replyTo.text ? replyTo.text : '',
      createdAt: Date.now(),
      retryCount: 0,
    };
    try {
      outbox.enqueue(item.connectionId, item.chatId, item);
    } catch (e) {
      this.showError(e);
      return false;
    }
    this.upsertMessage({
      id: item.id,
      sender: 'user',
      text: text,
      contentType: 'text',
      mediaType: 'text',
      timestamp: item.createdAt,
      replyTo: item.parentId || '',
      showReply: true,
      deliveryStatus: 'pending',
      reactions: [],
    });
    return true;
  },

  flushOutbox() {
    if (!this.genericClient || !this.genericClient.isOpen()) return;
    var connectionId = this.activeConn.id;
    var chatId = this.activeConn.chatId || this.data.activeConversationId;
    var items = outbox.list(connectionId, chatId);
    if (!items.length) return;
    var maxFlush = Math.min(items.length, 10);
    var flushed = 0;

    var self = this;
    function flushNext() {
      if (flushed >= maxFlush) return;
      if (!self.genericClient || !self.genericClient.isOpen()) return;
      var remaining = outbox.list(connectionId, chatId);
      if (!remaining.length) return;
      var item = remaining[0];
      if (!outbox.canFlush(connectionId, chatId)) return;
      outbox.markInFlight(connectionId, chatId, item.id, true);
      try {
        var payload = item.parentId
          ? self.genericClient.sendTextWithParent(item.content, item.parentId, item.quotedText || '')
          : self.genericClient.sendText(item.content);
        outbox.remove(connectionId, chatId, item.id);
        self.syncMessages(self.data.messages.map(function (msg) {
          if (msg.id === item.id) {
            return Object.assign({}, msg, {
              id: payload.messageId || msg.id,
              timestamp: payload.timestamp || msg.timestamp,
              deliveryStatus: 'sent',
            });
          }
          return msg;
        }));
        flushed++;
        flushNext();
      } catch (e) {
        outbox.clearInFlight(connectionId, chatId);
      }
    }

    flushNext();
  },

  handleSocketPacket(packet) {
    if (!packet || !packet.type) return;
    var data = packet.data || {};
    switch (packet.type) {
      case 'connection.open':
        this._streamingAgentId = null;
        this.syncMessages(this.data.messages.filter(function (m) { return !m.isStreaming; }));
        this.applyConnectionStatus({ status: 'connected', detail: '已连接' });
        // Update chatId from server response (authoritative)
        if (data.chatId) {
          this.setData({ activeConversationId: data.chatId });
        }
        // Request agent selection → triggers agent.selected → then request history
        if (this.genericClient && this.data.activeChatId) {
          this.genericClient.selectAgent(this.data.activeChatId);
        }
        break;
      case 'agent.selected': {
        // Agent confirmed, now request chat history with the server chatId + agentId
        var effectiveChatId = this.data.activeConversationId || (data.chatId || '');
        if (this.genericClient && effectiveChatId) {
          this.genericClient.requestHistory(effectiveChatId, this.data.activeChatId);
        }
        break;
      }
      case 'history.sync': {
        // Agent isolation: only accept history for current agent
        var historyAgentId = data.agentId;
        if (historyAgentId && this.data.activeChatId && historyAgentId !== this.data.activeChatId) {
          break;
        }
        var historyMessages = Array.isArray(data.messages)
          ? data.messages.map(normalizeHistoryMessage)
          : [];
        this.hideThinkingIndicator();
        this.syncMessages(mergeMessagesById(this.data.messages, historyMessages));
        break;
      }
      case 'text.delta': {
        var deltaText = data.text;
        var isDone = data.done;
        var deltaAgentId = data.agentId || this.data.activeChatId;
        if (isDone) {
          if (!this._streamingAgentId || this._streamingAgentId === deltaAgentId) {
            this._streamingAgentId = null;
            this.syncMessages(this.data.messages.filter(function (m) { return !m.isStreaming; }));
          }
        } else if (typeof deltaText === 'string') {
          // Agent isolation: ignore deltas from other agents
          if (this._streamingAgentId && this._streamingAgentId !== deltaAgentId) break;
          if (!this._streamingAgentId) this._streamingAgentId = deltaAgentId;

          this.hideThinkingIndicator();
          var msgs = this.data.messages;
          var streamIdx = -1;
          for (var si = 0; si < msgs.length; si++) {
            if (msgs[si].isStreaming) { streamIdx = si; break; }
          }
          if (streamIdx >= 0) {
            var updated = msgs.slice();
            updated[streamIdx] = Object.assign({}, updated[streamIdx], { text: deltaText });
            this.syncMessages(updated);
          } else {
            this.upsertMessage({
              id: 'streaming-' + Date.now(),
              sender: 'ai',
              text: deltaText,
              isStreaming: true,
              timestamp: data.timestamp || Date.now(),
              reactions: [],
            });
          }
        }
        break;
      }
      case 'stream.resume': {
        var resumeText = data.text;
        var isComplete = data.isComplete;
        var resumeAgentId = data.agentId;
        // Agent isolation
        if (resumeAgentId && resumeAgentId !== this.data.activeChatId) break;
        this._streamingAgentId = null;
        if (isComplete) {
          this.syncMessages(this.data.messages.filter(function (m) { return !m.isStreaming; }));
        } else if (typeof resumeText === 'string') {
          this.showThinkingIndicator('恢复回复中…');
          var self = this;
          setTimeout(function () { self.hideThinkingIndicator(); }, 800);
          this._streamingAgentId = resumeAgentId || this.data.activeChatId;
          this.syncMessages(
            this.data.messages.filter(function (m) { return !m.isStreaming; }).concat([{
              id: 'streaming-' + Date.now(),
              sender: 'ai',
              text: resumeText,
              isStreaming: true,
              timestamp: data.startTime || Date.now(),
              reactions: [],
            }])
          );
        }
        break;
      }
      case 'message.send': {
        // Agent isolation: ignore messages from other agents
        var msgAgentId = data.agentId;
        if (msgAgentId && this.data.activeChatId && msgAgentId !== this.data.activeChatId) {
          break;
        }
        var nextMessage = normalizeOutboundMessage(data);
        this.hideThinkingIndicator();
        this.upsertMessage(nextMessage);
        updateAgentPreview(this.data.activeChatId, nextMessage.text, nextMessage.timestamp);
        if (this.pageVisible) notifyForegroundMessage((this.data.activeChat.name || 'OpenClaw') + ' 有新消息');
        else incrementAgentUnread(this.data.activeChatId, 1);
        break;
      }
      case 'thinking.start': {
        // Agent isolation: only accept thinking for current agent
        var thinkStartAgentId = data.agentId;
        if (!thinkStartAgentId || !this.data.activeChatId || thinkStartAgentId === this.data.activeChatId) {
          this.showThinkingIndicator(data.content);
        }
        break;
      }
      case 'thinking.update': {
        var thinkUpdateAgentId = data.agentId;
        if (!thinkUpdateAgentId || !this.data.activeChatId || thinkUpdateAgentId === this.data.activeChatId) {
          this.showThinkingIndicator(data.content);
        }
        break;
      }
      case 'thinking.end': {
        var thinkEndAgentId = data.agentId;
        if (!thinkEndAgentId || !this.data.activeChatId || thinkEndAgentId === this.data.activeChatId) {
          this.hideThinkingIndicator();
        }
        break;
      }
      // Delivery status updates — handler ready, waiting for server to emit these events
      case 'status.delivered':
      case 'status.read': {
        var statusMsgId = data.messageId;
        var newStatus = packet.type === 'status.read' ? 'read' : 'delivered';
        if (statusMsgId) {
          this.syncMessages(this.data.messages.map(function (m) {
            if (m.id !== statusMsgId) return m;
            return Object.assign({}, m, { deliveryStatus: newStatus });
          }));
        }
        break;
      }
      case 'reaction.add':
      case 'reaction.remove': {
        var rid = data.messageId;
        var emoji = data.emoji;
        if (rid && emoji) {
          this.syncMessages(this.data.messages.map(function (m) {
            if (m.id !== rid) return m;
            var reactions = Array.isArray(m.reactions) ? m.reactions.slice() : [];
            if (packet.type === 'reaction.add') {
              if (reactions.indexOf(emoji) === -1) reactions.push(emoji);
            } else {
              reactions = reactions.filter(function (r) { return r !== emoji; });
            }
            return Object.assign({}, m, { reactions: reactions });
          }));
        }
        break;
      }
      case 'typing': {
        if (data.senderId !== this.data.genericSenderId) {
          this.setData({ peerTyping: !!data.isTyping });
          if (data.isTyping) {
            if (this._typingTimeout) clearTimeout(this._typingTimeout);
            this._typingTimeout = setTimeout(() => this.setData({ peerTyping: false }), 5000);
          }
        }
        break;
      }
      case 'message.edit': {
        if (data.messageId && data.content) {
          this.syncMessages(this.data.messages.map(function (m) {
            return m.id === data.messageId ? Object.assign({}, m, { text: data.content }) : m;
          }));
        }
        break;
      }
      case 'message.delete': {
        if (data.messageId) this.syncMessages(this.data.messages.filter(function (m) { return m.id !== data.messageId; }));
        break;
      }
      default:
        break;
    }
  },

  handleSocketStatus(payload) {
    this.applyConnectionStatus(payload || {});
  },

  handleSocketError(message) {
    this.showError(message || '连接失败');
  },

  connectAgentChannel(force) {
    const connection = getConnectionState();
    const activeConn = this.activeConn || getActiveConnection();
    if (!activeConn || !activeConn.serverUrl) {
      wx.showToast({ title: '请先配置服务器', icon: 'none' });
      redirectToScreen('profile');
      return;
    }

    var poolKey = 'chat-' + (activeConn.id || '') + '-' + this.data.activeChatId;
    this._poolKey = poolKey;

    var callbacks = {
      onEvent: (packet) => this.handleSocketPacket(packet),
      onStatusChange: (payload) => this.handleSocketStatus(payload),
      onError: (message) => this.handleSocketError(message),
    };

    var self = this;
    var result = wsPool.acquire(poolKey, function () {
      return createGenericChannelClient({
        serverUrl: activeConn.serverUrl,
        chatId: activeConn.chatId || self.data.activeConversationId,
        chatType: 'direct',
        senderId: activeConn.senderId || connection.senderId,
        senderName: activeConn.displayName || connection.senderName,
        agentId: self.data.activeChatId,
        token: activeConn.token || '',
        connectionId: activeConn.id || '',
        onEvent: callbacks.onEvent,
        onStatusChange: callbacks.onStatusChange,
        onError: callbacks.onError,
      });
    });

    this.genericClient = result.client;

    if (result.reused) {
      // Rebind callbacks to current page instance
      wsPool.rebind(poolKey, callbacks);
      // Sync current status
      this.applyConnectionStatus({ status: this.genericClient.status, detail: '' });
      // If already connected, re-request history
      if (this.genericClient.isOpen() && this.data.activeChatId) {
        this.genericClient.selectAgent(this.data.activeChatId);
      }
    } else {
      this.genericClient.connect(force);
    }
  },

  teardownGenericChannel(manual) {
    if (this._poolKey) {
      if (manual) {
        // Explicit teardown (e.g. navigating back) — release with grace period
        wsPool.release(this._poolKey, 15000);
      }
      // Don't null genericClient here — pool may still be alive
    }
    this.genericClient = null;
    this.hideThinkingIndicator();
    this.applyConnectionStatus({ status: 'disconnected' });
  },

  handleBack() {
    this.teardownGenericChannel(true);
    wx.navigateBack({ delta: 1, fail() { redirectToScreen('chats'); } });
  },

  handleReconnectChat() {
    // Force reconnect — destroy pool entry and create fresh
    if (this._poolKey) wsPool.destroy(this._poolKey);
    this.connectAgentChannel(true);
  },

  handleMessageInput(event) {
    const inputValue = event.detail.value || '';
    const shouldOpenSlash = inputValue.startsWith('/');
    this.setData({
      inputValue: inputValue,
      showSlashMenu: shouldOpenSlash,
      slashCommands: shouldOpenSlash ? filterSlashCommands(inputValue, this.data.slashCommandCatalog) : clone(this.data.slashCommandCatalog),
      showEmojiPicker: shouldOpenSlash ? false : this.data.showEmojiPicker,
      reactingToMsgId: shouldOpenSlash ? '' : this.data.reactingToMsgId,
    });
    this.refreshSuggestionBar();
  },

  submitTextMessage(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    const replyTo = this.data.replyingTo;

    if (!this.genericClient || !this.genericClient.isOpen()) {
      var ok = this.enqueueOfflineText(text, replyTo);
      if (ok) {
        this.setData({ inputValue: '', replyingTo: null, showSlashMenu: false, showEmojiPicker: false });
        this.showError('未连接');
      }
      return ok;
    }

    var localId = 'local-' + Date.now();
    this.upsertMessage({
      id: localId,
      sender: 'user',
      text: text,
      contentType: 'text',
      mediaType: 'text',
      timestamp: Date.now(),
      replyTo: replyTo && replyTo.id ? replyTo.id : '',
      quotedText: replyTo && replyTo.text ? replyTo.text : '',
      replyPreview: '',
      showReply: true,
      reactions: [],
      deliveryStatus: 'pending',
    });

    let payload;
    try {
      payload = replyTo && replyTo.id
        ? this.genericClient.sendTextWithParent(text, replyTo.id, replyTo.text)
        : this.genericClient.sendText(text);
    } catch (e) {
      // Send failed — mark message as failed (keep visible) and enqueue for retry
      this.syncMessages(this.data.messages.map(function (msg) {
        if (msg.id !== localId) return msg;
        return Object.assign({}, msg, { deliveryStatus: 'failed' });
      }));
      this.enqueueOfflineText(text, replyTo);
      return false;
    }

    const nextMessage = normalizeInboundMessage(payload);
    if (replyTo) nextMessage.replyTo = replyTo.id;
    this.syncMessages(this.data.messages.filter(function (msg) { return msg.id !== localId; }));
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
    this.upsertMessage(nextMessage);
    updateAgentPreview(this.data.activeChatId, nextMessage.text, nextMessage.timestamp);
    return true;
  },

  handleSendMessage() {
    // Debounce: prevent rapid double-tap
    if (this._sendLock) return;
    this._sendLock = true;
    var self = this;
    setTimeout(function () { self._sendLock = false; }, 300);

    if (this.data.editingMsg) {
      var editText = String(this.data.inputValue || '').trim();
      if (!editText) return;
      try {
        if (this.genericClient && this.genericClient.isOpen()) this.genericClient.editMessage(this.data.editingMsg.id, editText);
      } catch (e) {}
      this.syncMessages(this.data.messages.map((m) => m.id === this.data.editingMsg.id ? Object.assign({}, m, { text: editText }) : m));
      this.setData({ editingMsg: null, inputValue: '' });
      return;
    }
    this.submitTextMessage(this.data.inputValue);
  },

  /**
   * Retry a failed message. Tap the red ✕ to re-send.
   */
  handleRetryMessage(event) {
    var msgId = event.detail && event.detail.messageId;
    if (!msgId) return;
    var msg = null;
    for (var i = 0; i < this.data.messages.length; i++) {
      if (this.data.messages[i].id === msgId) { msg = this.data.messages[i]; break; }
    }
    if (!msg || msg.deliveryStatus !== 'failed') return;
    if (!msg.text) return;

    // Remove the failed message, re-submit
    this.syncMessages(this.data.messages.filter(function (m) { return m.id !== msgId; }));
    this.submitTextMessage(msg.text);
  },

  handleChooseImage() {
    if (!this.genericClient || !this.genericClient.isOpen()) {
      wx.showToast({ title: '离线状态下暂不支持发送图片', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        if (!res.tempFiles || !res.tempFiles.length) return;
        var file = res.tempFiles[0];
        if (!file.tempFilePath) return;
        try {
          var fs = wx.getFileSystemManager();
          var base64 = fs.readFileSync(file.tempFilePath, 'base64');
          var mimeType = file.fileType === 'video' ? 'video/mp4' : 'image/jpeg';
          var dataUrl = 'data:' + mimeType + ';base64,' + base64;
          var payload = this.genericClient.sendMedia({
            mediaUrl: dataUrl,
            messageType: 'image',
            content: '[Image]',
            mimeType: mimeType,
          });
          this.upsertMessage({
            id: payload.messageId,
            sender: 'user',
            text: '[Image]',
            contentType: 'image',
            mediaType: 'image',
            mediaUrl: file.tempFilePath,
            mimeType: mimeType,
            timestamp: payload.timestamp || Date.now(),
            reactions: [],
            deliveryStatus: 'sent',
          });
        } catch (e) {
          this.showError(e);
        }
      },
    });
  },

  handleVoiceRecord() {
    if (!this.genericClient || !this.genericClient.isOpen()) {
      wx.showToast({ title: '离线状态下暂不支持发送语音', icon: 'none' });
      return;
    }

    if (this._isRecording) {
      this._recorderManager.stop();
      return;
    }

    if (!this._recorderManager) {
      this._recorderManager = wx.getRecorderManager();
      this._recorderManager.onStop((res) => {
        this._isRecording = false;
        this.setData({ isRecording: false });
        var fs = wx.getFileSystemManager();
        try {
          var base64 = fs.readFileSync(res.tempFilePath, 'base64');
          var dataUrl = 'data:audio/aac;base64,' + base64;

          if (!this.genericClient || !this.genericClient.isOpen()) {
            wx.showToast({ title: '连接已断开', icon: 'none' });
            return;
          }

          var payload = this.genericClient.sendMedia({
            messageType: 'voice',
            content: '[Voice]',
            mediaUrl: dataUrl,
            mimeType: 'audio/aac',
          });

          this.upsertMessage({
            id: payload.messageId,
            sender: 'user',
            text: '[Voice]',
            contentType: 'voice',
            mediaType: 'voice',
            mediaUrl: dataUrl,
            mimeType: 'audio/aac',
            timestamp: payload.timestamp || Date.now(),
            reactions: [],
            deliveryStatus: 'sent',
          });
        } catch (e) {
          this.showError('录音失败');
        }
      });
      this._recorderManager.onError(() => {
        this._isRecording = false;
        this.setData({ isRecording: false });
        this.showError('录音失败');
      });
    }

    this._isRecording = true;
    this.setData({ isRecording: true });
    this._recorderManager.start({ format: 'aac', duration: 60000 });
  },

  handleToggleAttachMenu() {
    this.setData({ showAttachMenu: !this.data.showAttachMenu, showEmojiPicker: false, showSlashMenu: false });
  },

  handleToggleEmojiPicker() {
    const nextVisible = !(this.data.showEmojiPicker && !this.data.reactingToMsgId);
    this.setData({ showEmojiPicker: nextVisible, showSlashMenu: false, showAttachMenu: false, reactingToMsgId: '', activeBubbleId: '' });
    this.refreshSuggestionBar();
  },

  handleClosePanels() {
    this.setData({ showSlashMenu: false, showEmojiPicker: false, showAttachMenu: false, slashCommands: clone(this.data.slashCommandCatalog), reactingToMsgId: '', activeBubbleId: '', errorToast: null });
    this.refreshSuggestionBar();
  },

  handleSelectCommand(event) {
    const label = event.currentTarget.dataset.label;
    this.setData({ showSlashMenu: false, slashCommands: clone(this.data.slashCommandCatalog) });
    this.submitTextMessage(label);
  },

  handleBubbleSelect(event) {
    const messageId = event.detail.messageId;
    this.setData({ activeBubbleId: this.data.activeBubbleId === messageId ? '' : messageId });
  },

  handleOpenReactionPicker(event) {
    const messageId = event.detail.messageId;
    this.setData({ showEmojiPicker: true, showSlashMenu: false, reactingToMsgId: messageId, activeBubbleId: messageId });
    this.refreshSuggestionBar();
  },

  handleEmojiSelect(event) {
    const emoji = event.detail.emoji;
    if (this.data.reactingToMsgId) {
      const msg = this.data.messages.find((m) => m.id === this.data.reactingToMsgId);
      const hasReaction = msg && Array.isArray(msg.reactions) && msg.reactions.indexOf(emoji) !== -1;
      this.syncMessages(this.data.messages.map(function (message) {
        if (message.id !== this.data.reactingToMsgId) return message;
        var reactions = Array.isArray(message.reactions) ? message.reactions.slice() : [];
        if (hasReaction) reactions = reactions.filter(function (item) { return item !== emoji; });
        else reactions.push(emoji);
        return Object.assign({}, message, { reactions: reactions });
      }, this));
      try {
        if (this.genericClient && this.genericClient.isOpen()) {
          if (hasReaction) this.genericClient.removeReaction(this.data.reactingToMsgId, emoji);
          else this.genericClient.addReaction(this.data.reactingToMsgId, emoji);
        }
      } catch (e) {}
      this.setData({ showEmojiPicker: false, reactingToMsgId: '', activeBubbleId: '' });
      this.refreshSuggestionBar();
      return;
    }
    this.setData({ inputValue: String(this.data.inputValue || '') + emoji, showEmojiPicker: false });
    this.refreshSuggestionBar();
  },

  handleQuickCommand(event) {
    var value = event.currentTarget.dataset.value || event.currentTarget.dataset.command;
    if (!value) return;
    if (value === '催一下') {
      this.submitTextMessage('进度怎么样了？');
      return;
    }
    if (value.charAt(0) === '/') this.submitTextMessage(value);
    else this.setData({ inputValue: value });
  },

  handleActionTap(event) {
    const command = event.currentTarget.dataset.command;
    if (command) this.submitTextMessage(command);
  },

  handleStartReply(event) {
    const msgId = event.detail && event.detail.messageId;
    const msg = this.data.messages.find((m) => m.id === msgId);
    if (msg) this.setData({ replyingTo: msg, activeBubbleId: '' });
  },

  handleCancelReply() {
    this.setData({ replyingTo: null });
  },

  handleEditMessage(event) {
    const msgId = event.detail && event.detail.messageId;
    const msg = this.data.messages.find(function (m) { return m.id === msgId; });
    if (msg) this.setData({ editingMsg: msg, inputValue: msg.text });
  },

  handleCancelEdit() {
    this.setData({ editingMsg: null, inputValue: '' });
  },

  handleDeleteMessage(event) {
    const msgId = event.detail && event.detail.messageId;
    if (!msgId) return;
    try {
      if (this.genericClient && this.genericClient.isOpen()) this.genericClient.deleteMessage(msgId);
    } catch (e) {}
    this.syncMessages(this.data.messages.filter((m) => m.id !== msgId));
    this.setData({ activeBubbleId: '' });
  },

  scrollChatToBottom() {
    this.setData({ chatScrollAnchor: '' });
    wx.nextTick(() => this.setData({ chatScrollAnchor: 'message-end' }));
  },
});
