const ERROR_TEXT_BY_CODE = {
  NOT_CONNECTED: '连接已断开，请重试',
  SEND_FAILED: '发送失败，请重试',
  TIMEOUT: '请求超时，请稍后再试',
  RATE_LIMITED: '发太快了，请稍后再试',
  FORBIDDEN: '没有权限执行这个操作',
  UNAUTHORIZED: '登录状态失效，请重新连接',
  STORAGE_FULL: '本地空间不足，请清理后重试',
  STORAGE_FAILED: '本地保存失败',
  MEDIA_TOO_LARGE: '离线文件太大，暂不支持',
  UNSUPPORTED_OFFLINE_MEDIA: '离线状态下暂不支持媒体重发',
  INVALID_MESSAGE: '消息格式不正确',
  UNKNOWN: '出了点问题，请稍后重试',
};

function normalizeError(input, source) {
  if (!input) {
    return { code: 'UNKNOWN', message: ERROR_TEXT_BY_CODE.UNKNOWN, source: source || 'socket' };
  }

  if (typeof input === 'object') {
    const rawMessage = input.message || input.errMsg || input.error || '';
    const normalized = classifyError(rawMessage, input.code, source || input.source);
    return normalized;
  }

  return classifyError(String(input), '', source);
}

function classifyError(rawMessage, rawCode, source) {
  const message = String(rawMessage || '').trim();
  const codeText = String(rawCode || '').trim().toUpperCase();
  const lower = message.toLowerCase();
  let code = codeText || 'UNKNOWN';

  if (code === 'UNKNOWN') {
    if (!message) {
      code = 'UNKNOWN';
    } else if (lower.includes('not connected') || lower.includes('socket is not connected') || lower.includes('socket connection failed') || lower.includes('closed')) {
      code = 'NOT_CONNECTED';
    } else if (lower.includes('timeout')) {
      code = 'TIMEOUT';
    } else if (lower.includes('rate') || lower.includes('too many') || lower.includes('429')) {
      code = 'RATE_LIMITED';
    } else if (lower.includes('forbidden') || lower.includes('permission denied')) {
      code = 'FORBIDDEN';
    } else if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('token')) {
      code = 'UNAUTHORIZED';
    } else if (lower.includes('storage') && lower.includes('limit')) {
      code = 'STORAGE_FULL';
    } else if (lower.includes('storage')) {
      code = 'STORAGE_FAILED';
    } else if (lower.includes('send')) {
      code = 'SEND_FAILED';
    }
  }

  return {
    code,
    message: ERROR_TEXT_BY_CODE[code] || ERROR_TEXT_BY_CODE.UNKNOWN,
    source: source || 'socket',
  };
}

function humanizeError(input, source) {
  return normalizeError(input, source).message;
}

module.exports = {
  ERROR_TEXT_BY_CODE,
  normalizeError,
  humanizeError,
};
