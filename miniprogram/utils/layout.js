const DEFAULT_PAGE_CHROME = {
  statusBarHeight: 20,
  safeAreaTop: 20,
  safeAreaBottom: 0,
  inputSafeAreaBottom: 6,
  navBarPaddingTop: 28,
  navBarHeight: 72,
  navSideSlotWidth: 88,
  capsuleSafeInsetRight: 88,
  contentTopInset: 84,
  darkMode: false,
};

function isDarkMode() {
  try {
    return wx.getStorageSync('openclaw.darkMode') === '1';
  } catch (e) {
    return false;
  }
}

function getPageChromeData() {
  const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
  const screenWidth = systemInfo.screenWidth || 375;
  const statusBarHeight = systemInfo.statusBarHeight || 20;
  const safeAreaTop = systemInfo.safeArea ? systemInfo.safeArea.top || statusBarHeight : statusBarHeight;
  const safeAreaBottom = systemInfo.safeArea
    ? Math.max(systemInfo.screenHeight - systemInfo.safeArea.bottom, 0)
    : 0;
  const menuButtonRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  const menuGap = menuButtonRect ? Math.max(menuButtonRect.top - statusBarHeight, 6) : 8;
  const menuHeight = menuButtonRect ? menuButtonRect.height : 32;
  const navBarPaddingTop = statusBarHeight + menuGap;
  const navBarHeight = navBarPaddingTop + menuHeight + menuGap;
  const capsuleSafeInsetRight = menuButtonRect
    ? Math.max(screenWidth - menuButtonRect.left + 8, 88)
    : 88;
  const navSideSlotWidth = Math.max(capsuleSafeInsetRight, 72);
  const contentTopInset = Math.max(navBarHeight + 12, safeAreaTop + 48, 72);
  const inputSafeAreaBottom = Math.max(safeAreaBottom - 8, 6);

  return {
    ...DEFAULT_PAGE_CHROME,
    statusBarHeight,
    safeAreaTop,
    safeAreaBottom,
    inputSafeAreaBottom,
    navBarPaddingTop,
    navBarHeight,
    navSideSlotWidth,
    capsuleSafeInsetRight,
    contentTopInset,
    darkMode: isDarkMode(),
  };
}

module.exports = {
  DEFAULT_PAGE_CHROME,
  getPageChromeData,
  isDarkMode,
};
