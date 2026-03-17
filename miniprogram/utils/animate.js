const { ANIMATION } = require('../theme/tokens');

function getCardDelay(index) {
  return Math.min(index, 6) * ANIMATION.cardDelayStep;
}

function getScreenAnimationClass(direction) {
  return `screen-panel screen-panel--animate screen-panel--${direction}`;
}

module.exports = {
  SCREEN_ANIMATION_MS: ANIMATION.screenDuration,
  PANEL_ANIMATION_MS: ANIMATION.panelDuration,
  SCREEN_SHIFT: ANIMATION.screenShift,
  getCardDelay,
  getScreenAnimationClass,
};
