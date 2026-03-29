const { getNavItems } = require('../../utils/navigation');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const {
  getPreferenceForm,
  getProfileGroups,
  getTotalUnread,
  toggleProfileGroupSetting,
} = require('../../utils/app-state');
const { requestMessageSubscription } = require('../../utils/notifications');
const { navigateToScreen, redirectToScreen } = require('../../utils/routes');
const {
  getServerConnections,
  removeServerConnection,
  getActiveConnectionId,
  setActiveConnectionId,
  updateServerConnection,
} = require('../../utils/generic-channel');

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    navItems: getNavItems(0),
    currentScreen: 'profile',
    preferenceForm: getPreferenceForm(),
    profileGroups: getProfileGroups(),
    servers: [],
    activeServerId: '',
    editingServer: null,
    editForm: { name: '', displayName: '', serverUrl: '', token: '', chatId: '', senderId: '' },
  },

  onLoad() {
    this.setData({
      ...getPageChromeData(),
      navItems: getNavItems(getTotalUnread()),
    });
  },

  onShow() {
    const preferenceForm = getPreferenceForm();
    this.setData({
      preferenceForm,
      profileGroups: getProfileGroups(),
      servers: getServerConnections(),
      activeServerId: getActiveConnectionId(),
      navItems: getNavItems(getTotalUnread()),
    });
  },

  handleNavigate(event) {
    const { screen } = event.detail;
    if (!screen || screen === this.data.currentScreen) return;
    redirectToScreen(screen);
  },

  handleToggleSetting(event) {
    const { key } = event.detail;

    // Dark mode toggle — persist and update page
    if (key === 'darkMode') {
      var nextDark = !isDarkMode();
      try { wx.setStorageSync('openclaw.darkMode', nextDark ? '1' : '0'); } catch (e) {}
      toggleProfileGroupSetting(key);
      this.setData({
        profileGroups: getProfileGroups(),
        darkMode: nextDark,
      });
      return;
    }

    // Push notifications toggle
    if (key === 'pushNotifications') {
      var current = wx.getStorageSync('openclaw.pushNotif');
      var nextPush = current === '0' ? '1' : '0';
      try { wx.setStorageSync('openclaw.pushNotif', nextPush); } catch (e) {}
      toggleProfileGroupSetting(key);
      this.setData({ profileGroups: getProfileGroups() });
      return;
    }

    // In-app notifications toggle
    if (key === 'inAppNotifications') {
      var currentInApp = wx.getStorageSync('openclaw.inAppNotif');
      var nextInApp = currentInApp === '0' ? '1' : '0';
      try { wx.setStorageSync('openclaw.inAppNotif', nextInApp); } catch (e) {}
      toggleProfileGroupSetting(key);
      this.setData({ profileGroups: getProfileGroups() });
      return;
    }

    toggleProfileGroupSetting(key);
    this.setData({ profileGroups: getProfileGroups() });
  },

  handleSettingTap(event) {
    const { navigateTo } = event.detail;
    if (navigateTo) {
      navigateToScreen(navigateTo);
      return;
    }
    wx.showToast({ title: 'This setting is a static demo item.', icon: 'none' });
  },

  handleAddServer() {
    navigateToScreen('pairing');
  },

  handleActivateServer(event) {
    const id = event.currentTarget.dataset.id;
    setActiveConnectionId(id);
    this.setData({ activeServerId: id });
    wx.showToast({ title: 'Server activated', icon: 'none' });
  },

  handleRemoveServer(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: 'Remove Server',
      content: 'Remove this server connection?',
      success: (res) => {
        if (res.confirm) {
          removeServerConnection(id);
          this.setData({
            servers: getServerConnections(),
            activeServerId: getActiveConnectionId(),
          });
        }
      },
    });
  },

  handleEditServer(event) {
    const id = event.currentTarget.dataset.id;
    const server = getServerConnections().find(function (c) { return c.id === id; });
    if (!server) return;
    this.setData({
      editingServer: server,
      editForm: {
        name: server.name || '',
        displayName: server.displayName || '',
        serverUrl: server.serverUrl || '',
        token: server.token || '',
        chatId: server.chatId || '',
        senderId: server.senderId || '',
      },
    });
  },

  handleEditInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value || '';
    this.setData({ ['editForm.' + field]: value });
  },

  handleSaveEdit() {
    const server = this.data.editingServer;
    if (!server) return;
    updateServerConnection(server.id, {
      name: this.data.editForm.name.trim() || server.name,
      displayName: this.data.editForm.displayName.trim() || server.displayName,
      serverUrl: this.data.editForm.serverUrl.trim() || server.serverUrl,
      token: this.data.editForm.token.trim() || '',
      chatId: this.data.editForm.chatId.trim() || '',
      senderId: this.data.editForm.senderId.trim() || '',
    });
    this.setData({
      editingServer: null,
      servers: getServerConnections(),
    });
    wx.showToast({ title: 'Server updated', icon: 'none' });
  },

  handleCancelEdit() {
    this.setData({ editingServer: null });
  },

  handleLogout() {
    wx.showToast({ title: 'Log out is mocked in this build.', icon: 'none' });
  },

  handleEnableNotifications() {
    requestMessageSubscription();
  },
});
