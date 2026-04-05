function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function chooseValue(currentValue, incomingValue) {
  if (incomingValue === undefined || incomingValue === null || incomingValue === '') {
    return currentValue;
  }
  return incomingValue;
}

function mergeReactions(currentReactions, incomingReactions) {
  const merged = [];
  const source = []
    .concat(Array.isArray(currentReactions) ? currentReactions : [])
    .concat(Array.isArray(incomingReactions) ? incomingReactions : []);

  source.forEach((item) => {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  });

  return merged;
}

function scoreMessage(message) {
  if (!isObject(message)) return 0;
  let score = 0;
  Object.keys(message).forEach((key) => {
    const value = message[key];
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    score += 1;
  });
  return score;
}

function mergeMessage(currentMessage, incomingMessage) {
  if (!isObject(currentMessage)) return Object.assign({}, incomingMessage);
  if (!isObject(incomingMessage)) return Object.assign({}, currentMessage);

  const currentScore = scoreMessage(currentMessage);
  const incomingScore = scoreMessage(incomingMessage);
  const preferIncoming = incomingScore >= currentScore || ((incomingMessage.timestamp || 0) >= (currentMessage.timestamp || 0));
  const base = Object.assign({}, preferIncoming ? currentMessage : incomingMessage);
  const overlay = preferIncoming ? incomingMessage : currentMessage;

  const merged = Object.assign({}, base, overlay);
  merged.text = chooseValue(base.text, overlay.text);
  merged.contentType = chooseValue(base.contentType, overlay.contentType);
  merged.mediaUrl = chooseValue(base.mediaUrl, overlay.mediaUrl);
  merged.mimeType = chooseValue(base.mimeType, overlay.mimeType);
  merged.replyTo = chooseValue(base.replyTo, overlay.replyTo);
  merged.replyPreview = chooseValue(base.replyPreview, overlay.replyPreview);
  merged.deliveryStatus = chooseValue(base.deliveryStatus, overlay.deliveryStatus);
  merged.showReply = overlay.showReply !== undefined ? overlay.showReply : base.showReply;
  merged.reactions = mergeReactions(base.reactions, overlay.reactions);
  merged.actions = overlay.actions || base.actions || null;
  merged.timestamp = Math.max(base.timestamp || 0, overlay.timestamp || 0) || Date.now();

  return merged;
}

function mergeMessagesById(oldList, incomingList) {
  const order = [];
  const byId = {};

  function pushMessage(message) {
    if (!isObject(message)) return;
    const id = message.id;
    if (!id) return;
    if (!byId[id]) {
      order.push(id);
      byId[id] = Object.assign({}, message);
      return;
    }
    byId[id] = mergeMessage(byId[id], message);
  }

  (Array.isArray(oldList) ? oldList : []).forEach(pushMessage);
  (Array.isArray(incomingList) ? incomingList : []).forEach(pushMessage);

  return order
    .map((id) => byId[id])
    .sort((a, b) => {
      const ta = a.timestamp || 0;
      const tb = b.timestamp || 0;
      if (ta !== tb) return ta - tb;
      return String(a.id).localeCompare(String(b.id));
    });
}

module.exports = {
  mergeMessage,
  mergeMessagesById,
};
