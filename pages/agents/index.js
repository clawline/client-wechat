const { getNavItems } = require('../../utils/navigation');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { getConnectionState, getTotalUnread } = require('../../utils/app-state');
const { navigateToScreen, redirectToScreen } = require('../../utils/routes');
const {
  createGenericChannelClient,
  getActiveConnection,
  getServerConnections,
  setActiveConnectionId,
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
    viewMode: 'grid',
  },

  onLoad() {
    this.setData({
      ...getPageChromeData(),
      navItems: getNavItems(getTotalUnread()),
    });
    this._lobbyClients = {};
    this._agentsByServer = {};
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
    if (!this._hasFetched) {
      this.connectAllServers();
      this._hasFetched = true;
    }
  },

  onHide() {
    this.teardownAllLobbies();
  },

  onUnload() {
    this.teardownAllLobbies();
  },

  connectAllServers() {
    this.teardownAllLobbies();
    const connections = getServerConnections();
    if (!connections.length) {
      this.setData({ loading: false, agents: [], displayedAgents: [], activeServerName: '' });
      return;
    }

    // Show all server names
    var serverNames = connections.map(function (c) { return c.name || c.displayName || '服务器'; });
    this.setData({
      activeServerName: serverNames.join(' · '),
      loading: true,
    });

    var self = this;
    var connState = getConnectionState();

    connections.forEach(function (conn) {
      self._agentsByServer[conn.id] = [];

      var client = createGenericChannelClient({
        serverUrl: conn.serverUrl,
        chatId: conn.chatId || ('openclaw-mini-lobby-' + conn.id),
        senderId: conn.senderId || connState.senderId,
        senderName: conn.displayName || connState.senderName,
        token: conn.token || '',
        onEvent: function (packet) { self.handleLobbyPacket(conn.id, conn.name || conn.displayName, packet); },
        onStatusChange: function (payload) {
          if (payload.status === 'connected' && self._lobbyClients[conn.id]) {
            self._lobbyClients[conn.id].requestAgentList();
          }
        },
        onError: function (msg) {
          console.error('[Agents] ' + conn.name + ' error:', msg);
        },
      });

      self._lobbyClients[conn.id] = client;
      client.connect(true);
    });

    // Fallback timeout
    this._agentTimeout = setTimeout(function () {
      if (self.data.agents.length === 0) {
        var fallback = [{ id: 'main', name: 'Main', isDefault: true, identityEmoji: '🤖' }];
        self.setData({ agents: fallback, displayedAgents: fallback, loading: false });
      }
    }, 5000);
  },

  handleLobbyPacket(connId, connName, packet) {
    if (packet.type === 'connection.open' && this._lobbyClients[connId]) {
      this._lobbyClients[connId].requestAgentList();
    }
    if (packet.type === 'agent.list' && packet.data && Array.isArray(packet.data.agents)) {
      if (this._agentTimeout) { clearTimeout(this._agentTimeout); this._agentTimeout = null; }

      // Tag each agent with its source server
      var tagged = packet.data.agents.map(function (a) {
        return Object.assign({}, a, { _connId: connId, _serverName: connName || '服务器' });
      });
      this._agentsByServer[connId] = tagged;

      // Merge all servers' agents
      this._rebuildAgentList();
    }
  },

  _rebuildAgentList() {
    var all = [];
    var self = this;
    var connections = getServerConnections();
    connections.forEach(function (conn) {
      var serverAgents = self._agentsByServer[conn.id] || [];
      all = all.concat(serverAgents);
    });

    this.setData({
      agents: all,
      displayedAgents: filterAgents(all, this.data.searchQuery),
      loading: false,
    });

    // Cache for ChatRoom
    try { wx.setStorageSync('openclaw.agentList', JSON.stringify(all)); } catch (e) {}
  },

  teardownAllLobbies() {
    if (this._agentTimeout) { clearTimeout(this._agentTimeout); this._agentTimeout = null; }
    var self = this;
    Object.keys(this._lobbyClients || {}).forEach(function (id) {
      if (self._lobbyClients[id]) {
        self._lobbyClients[id].close(true);
      }
    });
    this._lobbyClients = {};
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

  handleAgentTap(event) {
    const agentId = event.currentTarget.dataset.agentId;
    // Find which server this agent belongs to
    var agent = this.data.agents.find(function (a) { return a.id === agentId; });
    if (agent && agent._connId) {
      // Switch active connection to the agent's server
      setActiveConnectionId(agent._connId);
    }
    navigateToScreen('chat_room', { agentId });
  },

  handlePlusAction() {
    navigateToScreen('pairing');
  },

  handleToggleView() {
    this.setData({ viewMode: this.data.viewMode === 'grid' ? 'list' : 'grid' });
  },

  handleRefreshAgents() {
    this._hasFetched = false;
    this.connectAllServers();
  },
});
