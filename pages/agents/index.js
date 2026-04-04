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
const wsPool = require('../../utils/ws-pool');

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
    serverGroups: [],       // [{ serverId, serverName, agents: [] }]
    activeServerName: '',
    wsStatus: 'disconnected',
    loading: true,
    viewMode: 'grid',
    multiServer: false,     // true when >1 server connected
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
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    this.releaseAllLobbies();
  },

  onUnload() {
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    this.releaseAllLobbies();
  },

  connectAllServers() {
    this.releaseAllLobbies();
    const connections = getServerConnections();
    if (!connections.length) {
      this.setData({ loading: false, agents: [], displayedAgents: [], activeServerName: '' });
      return;
    }

    // Show server names (not URLs)
    var serverNames = connections.map(function (c) { return c.name || c.displayName || '服务器'; });
    this.setData({
      activeServerName: serverNames.join(' · '),
      multiServer: connections.length > 1,
      loading: true,
    });

    var self = this;
    var connState = getConnectionState();
    this._poolKeys = [];

    connections.forEach(function (conn) {
      self._agentsByServer[conn.id] = [];

      var poolKey = 'lobby-' + conn.id;
      self._poolKeys.push(poolKey);

      var callbacks = {
        onEvent: function (packet) { self.handleLobbyPacket(conn.id, conn.name || conn.displayName, packet); },
        onStatusChange: function (payload) {
          if (payload.status === 'connected' && self._lobbyClients[conn.id]) {
            self._lobbyClients[conn.id].requestAgentList();
          }
        },
        onError: function (msg) {
          console.error('[Agents] ' + conn.name + ' error:', msg);
        },
      };

      var result = wsPool.acquire(poolKey, function () {
        return createGenericChannelClient({
          serverUrl: conn.serverUrl,
          chatId: conn.chatId || ('openclaw-mini-lobby-' + conn.id),
          senderId: conn.senderId || connState.senderId,
          senderName: conn.displayName || connState.senderName,
          token: conn.token || '',
          onEvent: callbacks.onEvent,
          onStatusChange: callbacks.onStatusChange,
          onError: callbacks.onError,
        });
      });

      self._lobbyClients[conn.id] = result.client;

      if (result.reused) {
        wsPool.rebind(poolKey, callbacks);
        if (result.client.isOpen()) {
          result.client.requestAgentList();
        }
      } else {
        result.client.connect(true);
      }
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
    var groups = [];
    var self = this;
    var connections = getServerConnections();
    connections.forEach(function (conn) {
      var serverAgents = self._agentsByServer[conn.id] || [];
      all = all.concat(serverAgents);
      if (serverAgents.length > 0) {
        groups.push({
          serverId: conn.id,
          serverName: conn.name || conn.displayName || '服务器',
          agents: filterAgents(serverAgents, self.data.searchQuery),
        });
      }
    });

    this.setData({
      agents: all,
      displayedAgents: filterAgents(all, this.data.searchQuery),
      serverGroups: groups,
      loading: false,
    });

    // Cache for ChatRoom
    try { wx.setStorageSync('openclaw.agentList', JSON.stringify(all)); } catch (e) {}
  },

  releaseAllLobbies() {
    if (this._agentTimeout) { clearTimeout(this._agentTimeout); this._agentTimeout = null; }
    var self = this;
    (this._poolKeys || []).forEach(function (key) {
      wsPool.release(key, 15000);
    });
    this._lobbyClients = {};
    this._poolKeys = [];
  },

  handleNavigate(event) {
    const { screen } = event.detail;
    if (!screen || screen === this.data.currentScreen) return;
    redirectToScreen(screen);
  },

  handleSearchInput(event) {
    const searchQuery = event.detail.value || '';
    this.setData({ searchQuery });

    // Debounce the expensive filter operation to avoid per-keystroke rebuilds
    if (this._searchDebounce) clearTimeout(this._searchDebounce);
    this._searchDebounce = setTimeout(() => {
      this._applySearchFilter(searchQuery);
    }, 200);
  },

  _applySearchFilter(searchQuery) {
    var filtered = filterAgents(this.data.agents, searchQuery);

    // Rebuild server groups with filter
    var self = this;
    var connections = getServerConnections();
    var groups = [];
    connections.forEach(function (conn) {
      var serverAgents = filterAgents(self._agentsByServer[conn.id] || [], searchQuery);
      if (serverAgents.length > 0) {
        groups.push({
          serverId: conn.id,
          serverName: conn.name || conn.displayName || '服务器',
          agents: serverAgents,
        });
      }
    });

    this.setData({
      displayedAgents: filtered,
      serverGroups: groups,
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
    // Force refresh — destroy all pool entries
    (this._poolKeys || []).forEach(function (key) {
      wsPool.destroy(key);
    });
    this._poolKeys = [];
    this._lobbyClients = {};
    this._hasFetched = false;
    this.connectAllServers();
  },
});
