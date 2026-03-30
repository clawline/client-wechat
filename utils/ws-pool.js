// Global WebSocket connection pool.
//
// Keeps WS connections alive across page transitions. When a page hides/
// unloads it calls release(key) which starts a grace timer (default 15s).
// If the same page (or another page) calls acquire(key) before the timer
// fires, the existing connection is reused — no reconnect.

const _pool = {};

/**
 * Acquire a connection from the pool.
 *
 * If an existing open connection exists for `key`, it is returned.
 * Otherwise `factoryFn()` is called to create a new GenericChannelClient
 * (it should NOT call `.connect()` — the caller decides when to connect).
 *
 * @param {string} key   Pool key (typically chatId or a composite key).
 * @param {Function} factoryFn  () => GenericChannelClient (not yet connected).
 * @returns {{ client: GenericChannelClient, reused: boolean }}
 */
function acquire(key, factoryFn) {
  var entry = _pool[key];

  if (entry) {
    // Cancel pending idle close
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }

    if (entry.client && (entry.client.isOpen() || entry.client.status === 'connecting' || entry.client.status === 'reconnecting')) {
      return { client: entry.client, reused: true };
    }

    // Stale entry — close and remove
    try { entry.client.close(true); } catch (e) {}
    delete _pool[key];
  }

  // Create new
  var client = factoryFn();
  _pool[key] = { client: client, idleTimer: null };
  return { client: client, reused: false };
}

/**
 * Rebind event callbacks on a pooled client.
 *
 * Call this after `acquire` to point event handlers at the current page
 * instance (important when reusing a connection across page lifecycles).
 *
 * @param {string} key
 * @param {{ onEvent?: Function, onStatusChange?: Function, onError?: Function }} callbacks
 */
function rebind(key, callbacks) {
  var entry = _pool[key];
  if (!entry || !entry.client) return;
  if (callbacks.onEvent !== undefined) entry.client.onEvent = callbacks.onEvent;
  if (callbacks.onStatusChange !== undefined) entry.client.onStatusChange = callbacks.onStatusChange;
  if (callbacks.onError !== undefined) entry.client.onError = callbacks.onError;
}

/**
 * Release a connection back to the pool with an idle grace period.
 *
 * If no one re-acquires the connection within `delayMs`, it is closed and
 * removed from the pool.
 *
 * @param {string} key
 * @param {number} [delayMs=15000]
 */
function release(key, delayMs) {
  var entry = _pool[key];
  if (!entry) return;

  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
  }

  var delay = typeof delayMs === 'number' ? delayMs : 15000;
  entry.idleTimer = setTimeout(function () {
    var e = _pool[key];
    if (e) {
      try { e.client.close(true); } catch (err) {}
      delete _pool[key];
    }
  }, delay);
}

/**
 * Immediately close and remove a connection from the pool.
 *
 * @param {string} key
 */
function destroy(key) {
  var entry = _pool[key];
  if (!entry) return;
  if (entry.idleTimer) clearTimeout(entry.idleTimer);
  try { entry.client.close(true); } catch (e) {}
  delete _pool[key];
}

/**
 * Close all pooled connections.
 */
function closeAll() {
  Object.keys(_pool).forEach(function (key) {
    destroy(key);
  });
}

/**
 * Get a snapshot of current pool state (for debugging).
 */
function status() {
  var result = {};
  Object.keys(_pool).forEach(function (key) {
    var e = _pool[key];
    result[key] = {
      status: e.client ? e.client.status : 'none',
      idle: !!e.idleTimer,
    };
  });
  return result;
}

module.exports = {
  acquire: acquire,
  rebind: rebind,
  release: release,
  destroy: destroy,
  closeAll: closeAll,
  status: status,
};
