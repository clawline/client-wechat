const STORAGE_PREFIX = 'openclaw.outbox.';
const MAX_OUTBOX_ITEMS = 50;
const MAX_MEDIA_SIZE = 1024 * 1024;

// In-memory cache to avoid repeated JSON.parse/stringify on each operation
// Uses plain object with LRU eviction to stay within memory limits
const _cache = {};
const _cacheOrder = [];
const MAX_CACHE_SIZE = 20;

function _evictCache() {
  while (_cacheOrder.length > MAX_CACHE_SIZE) {
    var oldest = _cacheOrder.shift();
    delete _cache[oldest];
  }
}

function getStorageKey(connectionId, chatId) {
  return STORAGE_PREFIX + String(connectionId || 'default') + '.' + String(chatId || 'default');
}

function _loadFromStorage(key) {
  if (_cache[key]) return _cache[key];
  try {
    const raw = wx.getStorageSync(key);
    const items = raw ? JSON.parse(raw) : [];
    _cache[key] = Array.isArray(items) ? items : [];
    _cacheOrder.push(key);
    _evictCache();
  } catch (error) {
    _cache[key] = [];
    _cacheOrder.push(key);
    _evictCache();
  }
  return _cache[key];
}

function _saveToStorage(key, items) {
  const nextItems = Array.isArray(items) ? items.slice(0, MAX_OUTBOX_ITEMS) : [];
  _cache[key] = nextItems;
  try {
    wx.setStorageSync(key, JSON.stringify(nextItems));
  } catch (e) {
    // Storage write failed — cache still valid for session
  }
}

function list(connectionId, chatId) {
  return _loadFromStorage(getStorageKey(connectionId, chatId)).slice();
}

function estimateSize(value) {
  if (!value) return 0;
  try {
    return JSON.stringify(value).length;
  } catch (error) {
    return String(value).length;
  }
}

function canFlush(connectionId, chatId) {
  return _loadFromStorage(getStorageKey(connectionId, chatId)).some(function (item) {
    return item && !item.inFlight;
  });
}

function enqueue(connectionId, chatId, item) {
  const key = getStorageKey(connectionId, chatId);
  const items = _loadFromStorage(key);
  if (items.length >= MAX_OUTBOX_ITEMS) {
    const error = new Error('Offline outbox is full');
    error.code = 'OUTBOX_FULL';
    throw error;
  }

  if (item && item.kind !== 'text') {
    const size = estimateSize(item.mediaUrl || item.content || '');
    if (size > MAX_MEDIA_SIZE) {
      const error = new Error('Offline media payload too large');
      error.code = 'MEDIA_TOO_LARGE';
      throw error;
    }
  }

  const nextItem = Object.assign({
    retryCount: 0,
    createdAt: Date.now(),
    inFlight: false,
  }, item);

  items.push(nextItem);
  _saveToStorage(key, items);
  return nextItem;
}

function markInFlight(connectionId, chatId, itemId, inFlight) {
  const key = getStorageKey(connectionId, chatId);
  const items = _loadFromStorage(key).map(function (item) {
    if (item.id !== itemId) return item;
    return Object.assign({}, item, { inFlight: !!inFlight });
  });
  _saveToStorage(key, items);
  return items.find(function (item) { return item.id === itemId; }) || null;
}

function clearInFlight(connectionId, chatId) {
  const key = getStorageKey(connectionId, chatId);
  const items = _loadFromStorage(key).map(function (item) {
    return Object.assign({}, item, { inFlight: false });
  });
  _saveToStorage(key, items);
  return items;
}

function remove(connectionId, chatId, itemId) {
  const key = getStorageKey(connectionId, chatId);
  const items = _loadFromStorage(key).filter(function (item) {
    return item.id !== itemId;
  });
  _saveToStorage(key, items);
  return items;
}

module.exports = {
  MAX_OUTBOX_ITEMS,
  MAX_MEDIA_SIZE,
  enqueue,
  list,
  canFlush,
  markInFlight,
  remove,
  clearInFlight,
};
