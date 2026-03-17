const CHAT_LIST = [];

const INITIAL_MESSAGES = [];

const SLASH_COMMANDS = [
  { id: 'help', icon: 'file-text', label: '/help', desc: 'Show built-in help and command usage' },
  { id: 'commands', icon: 'database', label: '/commands', desc: 'List available slash commands' },
  { id: 'status', icon: 'activity', label: '/status', desc: 'Show current session and model status' },
  { id: 'whoami', icon: 'user', label: '/whoami', desc: 'Show the current sender identity' },
  { id: 'new', icon: 'plus', label: '/new', desc: 'Start a fresh session, optionally with a model' },
  { id: 'reset', icon: 'zap', label: '/reset', desc: 'Reset the current session context' },
  { id: 'model', icon: 'cpu', label: '/model', desc: 'Inspect or switch the active model' },
  { id: 'think', icon: 'code', label: '/think', desc: 'Adjust reasoning level for the session' },
  { id: 'fast', icon: 'server', label: '/fast', desc: 'Toggle fast-mode for the session' },
  { id: 'verbose', icon: 'file-text', label: '/verbose', desc: 'Control extra debug and tool output' },
  { id: 'reasoning', icon: 'message-square', label: '/reasoning', desc: 'Control reasoning message output' },
  { id: 'compact', icon: 'layout-dashboard', label: '/compact', desc: 'Compact the current conversation context' },
  { id: 'stop', icon: 'activity', label: '/stop', desc: 'Stop the running task in this session' },
];

const EMOJI_LIST = ['👍', '❤️', '😂', '🔥', '✨', '👀', '💯', '🚀'];

const DASHBOARD_DATA = {
  usageCards: [],
  tasks: [],
  checkpoints: [],
  apiStatus: [],
};

const RECENT_SEARCHES = [];

const QUICK_FILTERS = [
  { id: 'commands', label: '/', icon: 'command', tone: 'purple' },
  { id: 'images', label: '[Image]', icon: 'file-text', tone: 'blue' },
  { id: 'voice', label: '[Voice]', icon: 'message-square', tone: 'green' },
];

const PROFILE_GROUPS = [
  [
    { key: 'darkMode', icon: 'moon', label: 'Dark Mode', hasToggle: true, active: false },
    { key: 'pushNotifications', icon: 'bell', label: 'Push Notifications', hasToggle: true, active: true },
    { key: 'inAppNotifications', icon: 'smartphone', label: 'In-App Notifications', hasToggle: true, active: true },
    { key: 'storage', icon: 'hard-drive', label: 'Storage Management', value: '2.4 GB' },
  ],
  [
    { key: 'preferences', icon: 'settings', label: 'Preferences', navigateTo: 'preferences' },
  ],
];

const PREFERENCE_DEFAULTS = {
  displayName: '',
  email: '',
  genericChannelUrl: '',
  modelOptions: ['Claude 3.5 Sonnet', 'GPT-4o', 'Gemini 1.5 Pro'],
  selectedModelIndex: 0,
  temperature: 70,
  systemPrompt: '',
};

module.exports = {
  CHAT_LIST,
  INITIAL_MESSAGES,
  SLASH_COMMANDS,
  EMOJI_LIST,
  DASHBOARD_DATA,
  RECENT_SEARCHES,
  QUICK_FILTERS,
  PROFILE_GROUPS,
  PREFERENCE_DEFAULTS,
};
