const PAGE_PATHS = {
  onboarding: '/pages/onboarding/index',
  pairing: '/pages/pairing/index',
  chats: '/pages/agents/index',
  chat_room: '/pages/chat-room/index',
  dashboard: '/pages/dashboard/index',
  search: '/pages/search/index',
  profile: '/pages/profile/index',
  preferences: '/pages/preferences/index',
};

const ROOT_SCREENS = ['chats', 'dashboard', 'search', 'profile'];

function buildTargetUrl(screen, params = {}) {
  const url = PAGE_PATHS[screen];
  if (!url) return '';

  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return query ? `${url}?${query}` : url;
}

function navigateToScreen(screen, params = {}) {
  const target = buildTargetUrl(screen, params);
  if (!target) return;

  if (ROOT_SCREENS.includes(screen)) {
    wx.reLaunch({ url: target });
    return;
  }

  wx.navigateTo({ url: target });
}

function redirectToScreen(screen, params = {}) {
  const target = buildTargetUrl(screen, params);
  if (!target) return;

  if (ROOT_SCREENS.includes(screen)) {
    wx.reLaunch({ url: target });
    return;
  }

  wx.redirectTo({
    url: target,
  });
}

module.exports = {
  PAGE_PATHS,
  ROOT_SCREENS,
  buildTargetUrl,
  navigateToScreen,
  redirectToScreen,
};
