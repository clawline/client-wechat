const MESSAGE_TEMPLATE_IDS = [];

function notifyForegroundMessage(title) {
  // Check if in-app notifications are enabled
  try {
    if (wx.getStorageSync('openclaw.inAppNotif') === '0') return;
  } catch (e) {}

  if (typeof wx.showToast === 'function') {
    wx.showToast({
      title: title || '收到新消息',
      icon: 'none',
      duration: 1800,
    });
  }

  if (typeof wx.vibrateShort === 'function') {
    try {
      wx.vibrateShort({ type: 'light' });
    } catch (error) {
      return;
    }
  }
}

function requestMessageSubscription() {
  if (!MESSAGE_TEMPLATE_IDS.length) {
    wx.showToast({
      title: '订阅消息模板 ID 尚未配置。',
      icon: 'none',
    });
    return;
  }

  wx.requestSubscribeMessage({
    tmplIds: MESSAGE_TEMPLATE_IDS,
    success() {
      wx.showToast({
        title: '消息提醒已开启',
        icon: 'none',
      });
    },
    fail() {
      wx.showToast({
        title: '未完成订阅授权。',
        icon: 'none',
      });
    },
  });
}

module.exports = {
  MESSAGE_TEMPLATE_IDS,
  notifyForegroundMessage,
  requestMessageSubscription,
};
