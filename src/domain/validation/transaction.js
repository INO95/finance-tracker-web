const { SUPPORTED_CURRENCIES } = require('../../services/summaryService');

function cleanText(value, max = 200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function isValidDateText(value) {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === s;
}

function isValidAmount(value) {
  if (!Number.isFinite(value)) return false;
  if (!Number.isInteger(value)) return false;
  if (value === 0) return false;
  return Math.abs(value) <= 1000000000;
}

function toKoreanValidationMessage(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return '입력값을 확인해주세요.';
  if (errors.includes('amount must be non-zero integer')) return '금액을 찾을 수 없습니다.';
  if (errors.includes('date must be YYYY-MM-DD')) return '날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)';
  if (errors.includes('item is required')) return '항목을 입력해주세요.';
  if (errors.includes('paymentMethod cannot be empty')) return '결제수단을 입력해주세요.';
  if (errors.includes('category cannot be empty')) return '카테고리를 입력해주세요.';
  if (errors.includes('unsupported currency')) return '통화는 JPY/KRW/USD만 가능합니다.';
  if (errors.includes('tags must be array')) return '태그 형식이 올바르지 않습니다.';
  if (errors.includes('add/remove must be arrays')) return '태그 추가/삭제 형식이 올바르지 않습니다.';
  if (errors.includes('month must be YYYY-MM')) return 'month 형식이 올바르지 않습니다. (YYYY-MM)';
  if (errors.includes('fromMonth must be YYYY-MM')) return 'fromMonth 형식이 올바르지 않습니다. (YYYY-MM)';
  if (errors.includes('toMonth must be YYYY-MM')) return 'toMonth 형식이 올바르지 않습니다. (YYYY-MM)';
  if (errors.includes('fromMonth cannot be greater than toMonth')) return '기간 범위가 올바르지 않습니다. fromMonth는 toMonth보다 클 수 없습니다.';
  return `입력값 오류: ${errors[0]}`;
}

function validateTransactionInput(body, { partial = false } = {}) {
  const errors = [];
  const has = key => Object.prototype.hasOwnProperty.call(body, key);

  if (!partial || has('date')) {
    if (!isValidDateText(body.date)) errors.push('date must be YYYY-MM-DD');
  }
  if (!partial || has('item')) {
    const item = cleanText(body.item, 120);
    if (!item) errors.push('item is required');
  }
  if (!partial || has('amount')) {
    const amount = Number(body.amount);
    if (!isValidAmount(amount)) errors.push('amount must be non-zero integer');
  }
  if (has('paymentMethod')) {
    const method = cleanText(body.paymentMethod, 80);
    if (!method) errors.push('paymentMethod cannot be empty');
  }
  if (has('category')) {
    const category = cleanText(body.category, 80);
    if (!category) errors.push('category cannot be empty');
  }
  if (!partial || has('currency')) {
    const currency = cleanText(body.currency || 'JPY', 8).toUpperCase();
    if (!SUPPORTED_CURRENCIES.has(currency)) errors.push('unsupported currency');
  }
  if (has('tags') && !Array.isArray(body.tags)) errors.push('tags must be array');

  return errors;
}

function coercePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const normalized = Math.trunc(n);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeTransactionBody(body) {
  return {
    date: cleanText(body.date, 10),
    item: cleanText(body.item, 120),
    amount: Number(body.amount),
    category: cleanText(body.category || '기타', 80),
    paymentMethod: cleanText(body.paymentMethod || '현금', 80),
    memo: cleanText(body.memo || '', 200),
    currency: cleanText(body.currency || 'JPY', 8).toUpperCase(),
    tags: Array.isArray(body.tags) ? body.tags.map(x => cleanText(x, 40)).filter(Boolean) : [],
  };
}

function sanitizeTransactionPatch(body) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'date')) patch.date = cleanText(body.date, 10);
  if (Object.prototype.hasOwnProperty.call(body, 'item')) patch.item = cleanText(body.item, 120);
  if (Object.prototype.hasOwnProperty.call(body, 'amount')) patch.amount = Number(body.amount);
  if (Object.prototype.hasOwnProperty.call(body, 'category')) patch.category = cleanText(body.category, 80);
  if (Object.prototype.hasOwnProperty.call(body, 'paymentMethod')) patch.paymentMethod = cleanText(body.paymentMethod, 80);
  if (Object.prototype.hasOwnProperty.call(body, 'memo')) patch.memo = cleanText(body.memo, 200);
  if (Object.prototype.hasOwnProperty.call(body, 'currency')) patch.currency = cleanText(body.currency, 8).toUpperCase();
  if (Array.isArray(body.tags)) patch.tags = body.tags.map(x => cleanText(x, 40)).filter(Boolean);
  return patch;
}

module.exports = {
  cleanText,
  validateTransactionInput,
  toKoreanValidationMessage,
  coercePositiveInt,
  parseJsonBody,
  sanitizeTransactionBody,
  sanitizeTransactionPatch,
};
