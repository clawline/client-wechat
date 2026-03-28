const STORAGE_PREFIX = 'openclaw.outbox.';
const MAX_OUTBOX_ITEMS = 50;
const MAX_MEDIA_SIZE = 1024 * 1024;

function getStorageKey(connectionId, chatId) {
  return STORAGE_PREFIX + String(connectionId || 'default') + '.' + String(chatId || 'default');
}

function list(connectionId, chatId) {
  try {
    const raw = wx.getStorageSync(getStorageKey(connectionId, chatId));
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    return [];
  }
}

function save(connectionId, chatId, items) {
  const nextItems = Array.isArray(items) ? items.slice(0, MAX_OUTBOX_ITEMS) : [];
  wx.setStorageSync(getStorageKey(connectionId, chatId), JSON.stringify(nextItems));
  return nextItems;
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
  return list(connectionId, chatId).some((item) => item && !item.inFlight);
}

function enqueue(connectionId, chatId, item) {
  const items = list(connectionId, chatId);
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
  save(connectionId, chatId, items);
  return nextItem;
}

function markInFlight(connectionId, chatId, itemId, inFlight) {
  const items = list(connectionId, chatId).map((item) => {
    if (item.id !== itemId) return item;
    return Object.assign({}, item, { inFlight: !!inFlight });
  });
  save(connectionId, chatId, items);
  return items.find((item) => item.id === itemId) || null;
}

function clearInFlight(connectionId, chatId) {
  const items = list(connectionId, chatId).map((item) => Object.assign({}, item, { inFlight: false }));
  save(connectionId, chatId, items);
  return items;
}

function remove(connectionId, chatId, itemId) {
  const items = list(connectionId, chatId).filter((item) => item.id !== itemId);
  save(connectionId, chatId, items);
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
