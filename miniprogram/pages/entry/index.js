const { getConnectionState } = require('../../utils/app-state');

Page({
  onLoad() {
    const connection = getConnectionState();
    const target = connection.isPaired && connection.serverUrl
      ? '/pages/agents/index'
      : '/pages/onboarding/index';

    wx.reLaunch({ url: target });
  },
});
