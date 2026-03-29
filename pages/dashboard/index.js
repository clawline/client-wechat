const { getNavItems } = require('../../utils/navigation');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { getConnectionState, getTotalUnread } = require('../../utils/app-state');
const { redirectToScreen } = require('../../utils/routes');
const { createGenericChannelClient, getActiveConnection } = require('../../utils/generic-channel');

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    navItems: getNavItems(0),
    currentScreen: 'dashboard',
    channelStatus: null,
    wsStatus: 'disconnected',
    activeServerName: '',
  },

  onLoad() {
    this.setData({
      ...getPageChromeData(),
      navItems: getNavItems(getTotalUnread()),
    });
    this.statusClient = null;
    this._refreshTimer = null;
  },

  onShow() {
    this.setData({ navItems: getNavItems(getTotalUnread()), darkMode: getPageChromeData().darkMode });
    this.connectAndFetchStatus();
  },

  onHide() {
    this.teardown();
  },

  onUnload() {
    this.teardown();
  },

  connectAndFetchStatus() {
    this.teardown();
    const activeConn = getActiveConnection();
    if (!activeConn) {
      this.setData({ channelStatus: null, activeServerName: '' });
      return;
    }

    const connection = getConnectionState();
    this.setData({ activeServerName: activeConn.name });

    this.statusClient = createGenericChannelClient({
      serverUrl: activeConn.serverUrl,
      chatId: 'openclaw-mini-dashboard-' + activeConn.id,
      senderId: connection.senderId,
      senderName: activeConn.displayName || connection.senderName,
      onEvent: (packet) => {
        if (packet.type === 'connection.open') {
          this.requestStatus();
        }
        if (packet.type === 'channel.status' && packet.data) {
          this.setData({ channelStatus: packet.data });
        }
      },
      onStatusChange: (payload) => {
        this.setData({ wsStatus: payload.status });
        if (payload.status === 'connected') {
          this.requestStatus();
        }
      },
      onError: () => {},
    });
    this.statusClient.connect(true);

    // Refresh every 10s
    this._refreshTimer = setInterval(() => {
      this.requestStatus();
    }, 10000);
  },

  requestStatus() {
    if (this.statusClient && this.statusClient.isOpen()) {
      this.statusClient.sendRaw({
        type: 'channel.status.get',
        data: { requestId: 'status-' + Date.now(), includeChats: false },
      });
    }
  },

  teardown() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this.statusClient) {
      this.statusClient.close(true);
      this.statusClient = null;
    }
  },

  handleNavigate(event) {
    const { screen } = event.detail;
    if (!screen || screen === this.data.currentScreen) return;
    redirectToScreen(screen);
  },
});
