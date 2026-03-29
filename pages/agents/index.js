const { getNavItems } = require('../../utils/navigation');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { getConnectionState, getTotalUnread } = require('../../utils/app-state');
const { navigateToScreen, redirectToScreen } = require('../../utils/routes');
const {
  createGenericChannelClient,
  getActiveConnection,
} = require('../../utils/generic-channel');

function filterAgents(agents, searchQuery) {
  const normalized = (searchQuery || '').trim().toLowerCase();
  if (!normalized) return agents;
  return agents.filter(function (a) {
    return a.name.toLowerCase().includes(normalized) || a.id.toLowerCase().includes(normalized);
  });
}

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    navItems: getNavItems(0),
    currentScreen: 'chats',
    searchQuery: '',
    agents: [],
    displayedAgents: [],
    activeServerName: '',
    wsStatus: 'disconnected',
    loading: true,
  },

  onLoad() {
    this.setData({
      ...getPageChromeData(),
      navItems: getNavItems(getTotalUnread()),
    });
    this.lobbyClient = null;
    this._hasFetched = false;

    // Load cached agents immediately
    try {
      var cached = wx.getStorageSync('openclaw.agentList');
      if (cached) {
        var agents = JSON.parse(cached);
        this.setData({ agents, displayedAgents: filterAgents(agents, ''), loading: false });
      }
    } catch (e) {}
  },

  onShow() {
    this.setData({ navItems: getNavItems(getTotalUnread()), darkMode: getPageChromeData().darkMode });
    // Only fetch from server on first show or manual refresh
    if (!this._hasFetched) {
      this.connectAndFetchAgents();
      this._hasFetched = true;
    }
  },

  onHide() {
    this.teardownLobby();
  },

  onUnload() {
    this.teardownLobby();
  },

  connectAndFetchAgents() {
    this.teardownLobby();
    const activeConn = getActiveConnection();
    if (!activeConn) {
      this.setData({ loading: false, agents: [], displayedAgents: [], activeServerName: '' });
      return;
    }

    const connection = getConnectionState();
    this.setData({ activeServerName: activeConn.name, loading: true });

    this.lobbyClient = createGenericChannelClient({
      serverUrl: activeConn.serverUrl,
      chatId: activeConn.chatId || ('openclaw-mini-lobby-' + activeConn.id),
      senderId: activeConn.senderId || connection.senderId,
      senderName: activeConn.displayName || connection.senderName,
      token: activeConn.token || '',
      onEvent: (packet) => this.handleLobbyPacket(packet),
      onStatusChange: (payload) => {
        this.setData({ wsStatus: payload.status });
        if (payload.status === 'connected' && this.lobbyClient) {
          this.lobbyClient.requestAgentList();
        }
      },
      onError: () => {},
    });
    this.lobbyClient.connect(true);

    // Fallback timeout
    this._agentTimeout = setTimeout(() => {
      if (this.data.agents.length === 0) {
        const fallback = [{ id: 'main', name: 'Main', isDefault: true, identityEmoji: '🤖' }];
        this.setData({ agents: fallback, displayedAgents: fallback, loading: false });
      }
    }, 5000);
  },

  handleLobbyPacket(packet) {
    if (packet.type === 'connection.open' && this.lobbyClient) {
      this.lobbyClient.requestAgentList();
    }
    if (packet.type === 'agent.list' && packet.data && Array.isArray(packet.data.agents)) {
      if (this._agentTimeout) { clearTimeout(this._agentTimeout); this._agentTimeout = null; }
      const agents = packet.data.agents;
      this.setData({
        agents,
        displayedAgents: filterAgents(agents, this.data.searchQuery),
        loading: false,
      });
      // Cache for ChatRoom to read
      try { wx.setStorageSync('openclaw.agentList', JSON.stringify(agents)); } catch (e) {}
    }
  },

  teardownLobby() {
    if (this._agentTimeout) { clearTimeout(this._agentTimeout); this._agentTimeout = null; }
    if (this.lobbyClient) {
      this.lobbyClient.close(true);
      this.lobbyClient = null;
    }
  },

  handleNavigate(event) {
    const { screen } = event.detail;
    if (!screen || screen === this.data.currentScreen) return;
    redirectToScreen(screen);
  },

  handleSearchInput(event) {
    const searchQuery = event.detail.value || '';
    this.setData({
      searchQuery,
      displayedAgents: filterAgents(this.data.agents, searchQuery),
    });
  },

  handleOpenChat(event) {
    const { chatId } = event.detail;
    navigateToScreen('chat_room', { agentId: chatId });
  },

  handleAgentTap(event) {
    const agentId = event.currentTarget.dataset.agentId;
    navigateToScreen('chat_room', { agentId });
  },

  handlePlusAction() {
    navigateToScreen('pairing');
  },

  handleRefreshAgents() {
    this._hasFetched = false;
    this.connectAndFetchAgents();
  },
});
