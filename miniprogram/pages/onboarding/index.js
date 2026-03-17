const { DEFAULT_PAGE_CHROME, getPageChromeData } = require('../../utils/layout');
const { navigateToScreen } = require('../../utils/routes');

const FEATURE_SLIDES = [
  {
    emoji: '💬',
    color: '#67B88B',
    title: 'Real-time Chat',
    desc: 'Chat with OpenClaw agents in real time via WebSocket. Get instant code reviews, explanations, and deployments.',
  },
  {
    emoji: '🖥️',
    color: '#5B8DEF',
    title: 'Multi-Server',
    desc: 'Connect to multiple OpenClaw workspaces simultaneously. Switch between projects without losing context.',
  },
  {
    emoji: '⚡',
    color: '#F59E0B',
    title: 'Slash Commands',
    desc: 'Use /help, /model, /think, /status and more to trigger specialized workflows at your fingertips.',
  },
  {
    emoji: '🔒',
    color: '#8B6DFF',
    title: 'Secure & Local',
    desc: 'All connection data stays on your device. No cloud accounts needed — pair directly to your own server.',
  },
];

Page({
  data: {
    ...DEFAULT_PAGE_CHROME,
    slides: FEATURE_SLIDES,
    activeSlide: 0,
  },

  onLoad() {
    this.setData(getPageChromeData());
    this._startAutoPlay();
  },

  onUnload() {
    this._stopAutoPlay();
  },

  _startAutoPlay() {
    this._stopAutoPlay();
    this._autoTimer = setInterval(() => {
      this.setData({
        activeSlide: (this.data.activeSlide + 1) % FEATURE_SLIDES.length,
      });
    }, 4000);
  },

  _stopAutoPlay() {
    if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
  },

  handleSwiperChange(e) {
    this._stopAutoPlay();
    this.setData({ activeSlide: e.detail.current });
    this._startAutoPlay();
  },

  handleDotTap(e) {
    this._stopAutoPlay();
    this.setData({ activeSlide: e.currentTarget.dataset.index });
    this._startAutoPlay();
  },

  handleStart() {
    navigateToScreen('pairing');
  },
});
