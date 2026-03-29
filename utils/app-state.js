const {
  CHAT_LIST,
  DASHBOARD_DATA,
  QUICK_FILTERS,
  RECENT_SEARCHES,
  PROFILE_GROUPS,
  PREFERENCE_DEFAULTS,
} = require('../mock/data');
const {
  buildConversationId,
  getStoredConnectionSettings,
  saveConnectionSettings,
} = require('./generic-channel');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatPreviewTime(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function toAgentPreview(text) {
  return `${text || ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function ensureRuntime() {
  const app = getApp();

  if (!app.globalData.runtime) {
    const connection = getStoredConnectionSettings(clone(PREFERENCE_DEFAULTS));
    app.globalData.runtime = {
      agents: connection.isPaired ? clone(CHAT_LIST) : [],
      messageStore: {},
      profileGroups: clone(PROFILE_GROUPS),
      connection,
      preferenceForm: {
        ...clone(PREFERENCE_DEFAULTS),
        displayName: connection.senderName,
        genericChannelUrl: connection.serverUrl,
      },
    };
  }

  return app.globalData.runtime;
}

function syncRuntimeFromStorage() {
  const runtime = ensureRuntime();
  const connection = getStoredConnectionSettings(clone(PREFERENCE_DEFAULTS));

  runtime.connection = connection;
  runtime.preferenceForm = {
    ...runtime.preferenceForm,
    displayName: connection.senderName,
    genericChannelUrl: connection.serverUrl,
  };

  if (connection.isPaired && runtime.agents.length === 0) {
    runtime.agents = clone(CHAT_LIST);
  }

  if (!connection.isPaired) {
    runtime.agents = [];
  }

  return runtime;
}

function getConnectionState() {
  const runtime = syncRuntimeFromStorage();
  return {
    senderId: runtime.connection.senderId,
    senderName: runtime.connection.senderName,
    serverUrl: runtime.connection.serverUrl,
    isPaired: runtime.connection.isPaired,
  };
}

function saveConnectionState(params = {}) {
  const runtime = ensureRuntime();
  saveConnectionSettings(params);
  syncRuntimeFromStorage();

  runtime.preferenceForm = {
    ...runtime.preferenceForm,
    ...(params.displayName !== undefined ? { displayName: params.displayName } : {}),
    ...(params.serverUrl !== undefined ? { genericChannelUrl: params.serverUrl } : {}),
  };
}

function getAgents() {
  return clone(syncRuntimeFromStorage().agents);
}

function hydrateAgents() {
  const runtime = syncRuntimeFromStorage();
  if (runtime.connection.isPaired && runtime.agents.length === 0) {
    runtime.agents = clone(CHAT_LIST);
  }
  return clone(runtime.agents);
}

function getAgentById(agentId) {
  const agents = hydrateAgents();
  return agents.find((item) => item.id === agentId) || agents[0] || null;
}

function updateAgentPreview(agentId, text, timestamp = Date.now()) {
  const runtime = ensureRuntime();
  runtime.agents = runtime.agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      message: toAgentPreview(text) || agent.message,
      time: formatPreviewTime(timestamp),
      unread: 0,
    };
  });
}

function setAgentUnread(agentId, unread) {
  const runtime = ensureRuntime();
  runtime.agents = runtime.agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      unread: Math.max(Number(unread) || 0, 0),
    };
  });
}

function incrementAgentUnread(agentId, count = 1) {
  const runtime = ensureRuntime();
  runtime.agents = runtime.agents.map((agent) => {
    if (agent.id !== agentId) return agent;
    return {
      ...agent,
      unread: Math.max((agent.unread || 0) + count, 0),
    };
  });
}

function clearAgentUnread(agentId) {
  setAgentUnread(agentId, 0);
}

function getTotalUnread() {
  return hydrateAgents().reduce((sum, agent) => sum + (agent.unread || 0), 0);
}

function getPreferenceForm() {
  return clone(syncRuntimeFromStorage().preferenceForm);
}

function updatePreferenceForm(patch = {}) {
  const runtime = ensureRuntime();
  runtime.preferenceForm = {
    ...runtime.preferenceForm,
    ...patch,
  };
}

function getProfileGroups() {
  var groups = clone(ensureRuntime().profileGroups);
  // Sync toggle states from storage
  try {
    var darkMode = wx.getStorageSync('openclaw.darkMode') === '1';
    var pushNotif = wx.getStorageSync('openclaw.pushNotif') !== '0';
    var inAppNotif = wx.getStorageSync('openclaw.inAppNotif') !== '0';
    groups = groups.map(function (group) {
      return group.map(function (item) {
        if (item.key === 'darkMode') return Object.assign({}, item, { active: darkMode });
        if (item.key === 'pushNotifications') return Object.assign({}, item, { active: pushNotif });
        if (item.key === 'inAppNotifications') return Object.assign({}, item, { active: inAppNotif });
        return item;
      });
    });
  } catch (e) {}
  return groups;
}

function toggleProfileGroupSetting(key) {
  const runtime = ensureRuntime();
  runtime.profileGroups = runtime.profileGroups.map((group) => {
    return group.map((item) => {
      if (item.key !== key) return item;
      return {
        ...item,
        active: !item.active,
      };
    });
  });
}

function getDashboardData() {
  return clone(DASHBOARD_DATA);
}

function getRecentSearches() {
  return clone(RECENT_SEARCHES);
}

function getQuickFilters() {
  return clone(QUICK_FILTERS);
}

function getConversationIdByAgentId(agentId) {
  const agent = getAgentById(agentId);
  return buildConversationId(agent);
}

function getMessages(conversationId) {
  const runtime = ensureRuntime();
  return clone(runtime.messageStore[conversationId] || []);
}

function setMessages(conversationId, messages) {
  const runtime = ensureRuntime();
  runtime.messageStore[conversationId] = clone(messages);
}

function appendMessage(conversationId, message) {
  const current = getMessages(conversationId).filter((item) => item.id !== message.id);
  const next = [...current, message];
  setMessages(conversationId, next);
  return next;
}

module.exports = {
  clone,
  getAgents,
  hydrateAgents,
  getAgentById,
  getConnectionState,
  getConversationIdByAgentId,
  getDashboardData,
  getPreferenceForm,
  getProfileGroups,
  getQuickFilters,
  getRecentSearches,
  getMessages,
  getTotalUnread,
  saveConnectionState,
  setMessages,
  appendMessage,
  clearAgentUnread,
  incrementAgentUnread,
  toggleProfileGroupSetting,
  updateAgentPreview,
  updatePreferenceForm,
};
