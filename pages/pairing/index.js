const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { getConnectionState, getPreferenceForm, saveConnectionState, updatePreferenceForm } = require('../../utils/app-state');
const { navigateToScreen } = require('../../utils/routes');
const { addServerConnection, setActiveConnectionId } = require('../../utils/generic-channel');

/**
 * Parse a connection URL:
 * - ws://host:18080/ws?chatId=xxx&token=xxx&senderId=xxx
 * - wss://host/ws?chatId=xxx&token=xxx
 * - openclaw://connect?serverUrl=ws://...&token=xxx&chatId=xxx
 */
function parseConnectionUrl(raw) {
  var trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // Handle openclaw:// custom scheme
  if (trimmed.indexOf('openclaw://') === 0) {
    try {
      var fakeUrl = trimmed.replace('openclaw://', 'https://');
      return parseQueryParams(fakeUrl, '');
    } catch (e) { return null; }
  }

  // Handle ws:// or wss:// URL with query params
  if (/^wss?:\/\//.test(trimmed)) {
    try {
      var base = trimmed.split('?')[0];
      var httpUrl = trimmed.replace(/^ws/, 'http');
      return parseQueryParams(httpUrl, base);
    } catch (e) { return null; }
  }

  return null;
}

function parseQueryParams(urlStr, serverUrlOverride) {
  // Simple query param parser for miniprogram (no URL API)
  var qIdx = urlStr.indexOf('?');
  if (qIdx === -1) return { serverUrl: serverUrlOverride || '' };
  var qs = urlStr.slice(qIdx + 1);
  var params = {};
  qs.split('&').forEach(function (pair) {
    var kv = pair.split('=');
    if (kv.length === 2) {
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
    }
  });
  return {
    serverUrl: serverUrlOverride || params.serverUrl || '',
    token: params.token || '',
    chatId: params.chatId || '',
    senderId: params.senderId || '',
    displayName: params.name || '',
  };
}

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    preferenceForm: getPreferenceForm(),
    genericSenderId: '',
    activeTab: 'url',
    urlInput: '',
    urlError: '',
  },

  onLoad() {
    const connection = getConnectionState();
    this.setData({
      ...getPageChromeData(),
      preferenceForm: getPreferenceForm(),
      genericSenderId: connection.senderId,
    });
  },

  handleBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        navigateToScreen('profile');
      },
    });
  },

  handleTabChange(event) {
    var tab = event.currentTarget.dataset.tab;
    this.setData({ activeTab: tab, urlError: '' });
  },

  handleUrlInput(event) {
    this.setData({ urlInput: event.detail.value || '', urlError: '' });
  },

  handleUrlLogin() {
    var parsed = parseConnectionUrl(this.data.urlInput);
    if (!parsed || !parsed.serverUrl) {
      this.setData({ urlError: 'Invalid URL. Use ws:// or openclaw:// format.' });
      return;
    }
    var hostname = '';
    try {
      var match = parsed.serverUrl.match(/\/\/([^/:]+)/);
      hostname = match ? match[1] : 'Server';
    } catch (e) { hostname = 'Server'; }
    var connName = parsed.displayName || hostname;

    saveConnectionState({
      displayName: connName,
      serverUrl: parsed.serverUrl,
      isPaired: true,
    });

    var conn = addServerConnection(connName, parsed.serverUrl, connName, parsed.token, parsed.chatId, parsed.senderId);
    setActiveConnectionId(conn.id);

    wx.showToast({ title: 'Server connected!', icon: 'none' });
    navigateToScreen('chats');
  },

  handlePasteUrl() {
    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ urlInput: res.data, urlError: '' });
        }
      },
    });
  },

  handleScanQR() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        var value = res.result || '';
        var parsed = parseConnectionUrl(value);
        if (parsed && parsed.serverUrl) {
          var hostname = '';
          try {
            var match = parsed.serverUrl.match(/\/\/([^/:]+)/);
            hostname = match ? match[1] : 'Server';
          } catch (e) { hostname = 'Server'; }
          var connName = parsed.displayName || hostname;

          saveConnectionState({
            displayName: connName,
            serverUrl: parsed.serverUrl,
            isPaired: true,
          });

          var conn = addServerConnection(connName, parsed.serverUrl, connName, parsed.token, parsed.chatId, parsed.senderId);
          setActiveConnectionId(conn.id);

          wx.showToast({ title: 'Server connected!', icon: 'none' });
          navigateToScreen('chats');
        } else {
          // Put scanned text into URL input for manual review
          this.setData({
            activeTab: 'url',
            urlInput: value,
            urlError: 'QR code scanned — please verify and connect.',
          });
        }
      },
      fail: () => {
        wx.showToast({ title: 'Scan cancelled', icon: 'none' });
      },
    });
  },

  handleInput(event) {
    const { field } = event.currentTarget.dataset;
    const value = event.detail.value || '';
    const nextForm = {
      ...this.data.preferenceForm,
      [field]: value,
    };
    updatePreferenceForm(nextForm);
    this.setData({
      preferenceForm: nextForm,
    });
  },

  handlePairConnection() {
    const displayName = (this.data.preferenceForm.displayName || '').trim();
    const serverUrl = (this.data.preferenceForm.genericChannelUrl || '').trim();
    const token = (this.data.preferenceForm.token || '').trim();
    const chatId = (this.data.preferenceForm.chatId || '').trim();
    const senderId = (this.data.preferenceForm.senderId || '').trim();

    if (!displayName) {
      wx.showToast({ title: 'Display name is required.', icon: 'none' });
      return;
    }

    if (!serverUrl) {
      wx.showToast({ title: 'WebSocket URL is required.', icon: 'none' });
      return;
    }

    saveConnectionState({
      displayName,
      serverUrl,
      isPaired: true,
    });

    const conn = addServerConnection(displayName, serverUrl, displayName, token, chatId, senderId);
    setActiveConnectionId(conn.id);

    updatePreferenceForm({
      ...this.data.preferenceForm,
      displayName,
      genericChannelUrl: serverUrl,
    });

    wx.showToast({ title: 'Server connected!', icon: 'none' });
    navigateToScreen('chats');
  },
});
