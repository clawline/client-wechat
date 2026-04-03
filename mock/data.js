const CHAT_LIST = [];

const INITIAL_MESSAGES = [];

const SLASH_COMMANDS = [
  // --- Commands ---
  { id: 'help', icon: 'file-text', label: '/help', desc: 'Show help and command usage', section: 'COMMANDS' },
  { id: 'commands', icon: 'database', label: '/commands', desc: 'List available commands', section: 'COMMANDS' },
  { id: 'status', icon: 'activity', label: '/status', desc: 'Session and model status', section: 'COMMANDS' },
  { id: 'whoami', icon: 'user', label: '/whoami', desc: 'Show sender identity', section: 'COMMANDS' },
  { id: 'skill', icon: 'puzzle', label: '/skill', desc: 'Run a skill by name', section: 'COMMANDS' },
  { id: 'stop', icon: 'square', label: '/stop', desc: 'Stop the running task', section: 'COMMANDS' },
  // --- Session ---
  { id: 'new', icon: 'plus', label: '/new', desc: 'New session (optionally with model)', section: 'SESSION' },
  { id: 'reset', icon: 'rotate-ccw', label: '/reset', desc: 'Reset session context', section: 'SESSION' },
  { id: 'model', icon: 'cpu', label: '/model', desc: 'Inspect or switch model', section: 'SESSION' },
  { id: 'models', icon: 'cpu', label: '/models', desc: 'Browse providers and models', section: 'SESSION' },
  { id: 'compact', icon: 'layout-dashboard', label: '/compact', desc: 'Compact conversation context', section: 'SESSION' },
  { id: 'context', icon: 'file-text', label: '/context', desc: 'Show context breakdown', section: 'SESSION' },
  { id: 'export', icon: 'database', label: '/export', desc: 'Export session to HTML', section: 'SESSION' },
  // --- Directives ---
  { id: 'think', icon: 'code', label: '/think', desc: 'Set reasoning level (off–xhigh)', section: 'DIRECTIVES' },
  { id: 'verbose', icon: 'file-text', label: '/verbose', desc: 'Toggle debug/tool output', section: 'DIRECTIVES' },
  { id: 'reasoning', icon: 'message-square', label: '/reasoning', desc: 'Reasoning output (on/off/stream)', section: 'DIRECTIVES' },
  { id: 'elevated', icon: 'shield', label: '/elevated', desc: 'Elevated exec (on/off/ask/full)', section: 'DIRECTIVES' },
  { id: 'exec', icon: 'code', label: '/exec', desc: 'Configure exec host/security', section: 'DIRECTIVES' },
  { id: 'queue', icon: 'layout-dashboard', label: '/queue', desc: 'Queue mode and options', section: 'DIRECTIVES' },
  // --- Advanced ---
  { id: 'usage', icon: 'activity', label: '/usage', desc: 'Usage footer (off/tokens/full/cost)', section: 'ADVANCED' },
  { id: 'tts', icon: 'message-square', label: '/tts', desc: 'Text-to-speech toggle', section: 'ADVANCED' },
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
