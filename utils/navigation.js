const SCREEN_ORDER = [
  'onboarding',
  'pairing',
  'chats',
  'chat_room',
  'dashboard',
  'profile',
  'search',
  'preferences',
];

const BOTTOM_NAV_SCREENS = ['chats', 'dashboard', 'search', 'profile'];

const NAV_ITEMS = [
  { id: 'chats', label: 'Chats', icon: 'message-circle' },
  { id: 'dashboard', label: 'Resources', icon: 'layout-dashboard' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

const BACK_TARGETS = {
  pairing: 'onboarding',
  chat_room: 'chats',
  preferences: 'profile',
};

function shouldShowBottomNav(screen) {
  return BOTTOM_NAV_SCREENS.includes(screen);
}

function getBackTarget(screen) {
  return BACK_TARGETS[screen] || 'chats';
}

function getTransitionDirection(from, to) {
  if (from === 'chat_room' && to === 'chats') return 'backward';
  if (from === 'preferences' && to === 'profile') return 'backward';
  if (from === 'profile' && to === 'preferences') return 'forward';
  if (from === 'chats' && to === 'chat_room') return 'forward';

  const fromIndex = SCREEN_ORDER.indexOf(from);
  const toIndex = SCREEN_ORDER.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    return 'forward';
  }

  return toIndex >= fromIndex ? 'forward' : 'backward';
}

function getNavItems(unreadCount = 0) {
  return NAV_ITEMS.map((item) => {
    if (item.id !== 'chats') return { ...item };
    return {
      ...item,
      unreadCount: unreadCount > 0 ? unreadCount : 0,
    };
  });
}

module.exports = {
  SCREEN_ORDER,
  BOTTOM_NAV_SCREENS,
  NAV_ITEMS,
  getNavItems,
  shouldShowBottomNav,
  getBackTarget,
  getTransitionDirection,
};
