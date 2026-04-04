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
    var eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      var key = decodeURIComponent(pair.slice(0, eqIdx).replace(/\+/g, ' '));
      var val = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' '));
      params[key] = val;
    }
  });
  return {
    serverUrl: serverUrlOverride || params.serverUrl || '',
    token: params.token || '',
    chatId: params.chatId || params.channelId || '',
    senderId: params.senderId || '',
    // channelName = server name (e.g. "🪴 Ottor")
    // displayName = user display name (e.g. "🪴 Ottor/tiger")
    channelName: params.channelName || '',
    displayName: params.displayName || params.name || '',
  };
}

// Extract a friendly name from hostname:
//   relay.restry.cn → Relay
//   gw.dev.dora.restry.cn → Gw Dev Dora
//   192.168.1.1 → 192.168.1.1
function friendlyName(hostname) {
  if (!hostname) return 'Server';
  // If it's an IP address, return as-is
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return hostname;
  // Take the subdomain part(s) before the registrable domain
  var parts = hostname.split('.');
  // For "relay.restry.cn" → take "relay"; for "gw.dev.dora.restry.cn" → take "gw.dev.dora"
  // Simple heuristic: drop last 2 parts (TLD + domain), capitalize the rest
  if (parts.length <= 2) return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  var meaningful = parts.slice(0, -2);
  return meaningful.map(function (p) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' ');
}

/**
 * Resolve a friendly name from a parsed connection URL.
 * Priority: channelName > displayName > hostname-based friendly name.
 */
function resolveConnectionName(parsed) {
  if (parsed.channelName || parsed.displayName) {
    return parsed.channelName || parsed.displayName;
  }
  var hostname = '';
  try {
    var match = parsed.serverUrl.match(/\/\/([^/:]+)/);
    hostname = match ? match[1] : 'Server';
  } catch (e) { hostname = 'Server'; }
  return friendlyName(hostname);
}

/**
 * Save a parsed connection and navigate to chats.
 * Shared by URL login, QR scan, and manual pairing flows.
 */
function activateParsedConnection(parsed) {
  var connName = resolveConnectionName(parsed);
  saveConnectionState({
    displayName: connName,
    serverUrl: parsed.serverUrl,
    isPaired: true,
  });
  var conn = addServerConnection(connName, parsed.serverUrl, connName, parsed.token, parsed.chatId, parsed.senderId);
  setActiveConnectionId(conn.id);
  wx.showToast({ title: 'Server connected!', icon: 'none' });
  navigateToScreen('chats');
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
    activateParsedConnection(parsed);
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
          activateParsedConnection(parsed);
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

    activateParsedConnection({
      serverUrl,
      token,
      chatId,
      senderId,
      channelName: displayName,
      displayName: displayName,
    });

    updatePreferenceForm({
      ...this.data.preferenceForm,
      displayName,
      genericChannelUrl: serverUrl,
    });
  },
});
