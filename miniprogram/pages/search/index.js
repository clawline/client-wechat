const { getNavItems } = require('../../utils/navigation');
const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { getQuickFilters, getRecentSearches, getTotalUnread } = require('../../utils/app-state');
const { redirectToScreen } = require('../../utils/routes');

function searchLocalMessages(query) {
  if (!query || !query.trim()) return [];
  var lower = query.toLowerCase();
  var results = [];
  try {
    var res = wx.getStorageInfoSync();
    var keys = res.keys || [];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.indexOf('openclaw.msgs.') !== 0) continue;
      var raw = wx.getStorageSync(key);
      if (!raw) continue;
      var msgs = JSON.parse(raw);
      if (!Array.isArray(msgs)) continue;
      for (var j = 0; j < msgs.length; j++) {
        var m = msgs[j];
        if (m.text && m.text.toLowerCase().indexOf(lower) !== -1) {
          results.push(m);
        }
      }
    }
  } catch (e) {}
  return results.slice(-50);
}

function formatSearchTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
    d.getHours().toString().padStart(2, '0') + ':' +
    d.getMinutes().toString().padStart(2, '0');
}

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    navItems: getNavItems(0),
    currentScreen: 'search',
    searchScreenQuery: '',
    recentSearches: getRecentSearches(),
    quickFilters: getQuickFilters(),
    searchResults: [],
    searchResultCount: 0,
    hasSearched: false,
  },

  onLoad() {
    this.setData({
      ...getPageChromeData(),
      navItems: getNavItems(getTotalUnread()),
      recentSearches: getRecentSearches(),
      quickFilters: getQuickFilters(),
    });
  },

  onShow() {
    this.setData({
      navItems: getNavItems(getTotalUnread()),
      darkMode: getPageChromeData().darkMode,
    });
  },

  handleNavigate(event) {
    const { screen } = event.detail;
    if (!screen || screen === this.data.currentScreen) return;
    redirectToScreen(screen);
  },

  handleSearchInput(event) {
    var query = event.detail.value || '';
    this.setData({ searchScreenQuery: query });
    this._doSearch(query);
  },

  _doSearch(query) {
    if (!query.trim()) {
      this.setData({ searchResults: [], searchResultCount: 0, hasSearched: false });
      return;
    }
    var results = searchLocalMessages(query);
    var displayResults = results.map(function (m) {
      return {
        id: m.id || '',
        sender: m.sender === 'user' ? 'You' : 'AI',
        text: (m.text || '').slice(0, 200),
        formattedTime: formatSearchTime(m.timestamp),
      };
    });
    this.setData({
      searchResults: displayResults,
      searchResultCount: displayResults.length,
      hasSearched: true,
    });
  },

  handleSearchShortcut(event) {
    const { label } = event.currentTarget.dataset;
    this.setData({ searchScreenQuery: label });
    this._doSearch(label);
  },
});
