(function initFormat(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  function symbolOf(currency) {
    if (currency === 'JPY') return '¥';
    if (currency === 'KRW') return '₩';
    if (currency === 'USD') return '$';
    return currency;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value, currency = 'JPY') {
    return `${symbolOf(currency)}${Math.abs(Number(value || 0)).toLocaleString('en-US')}`;
  }

  function yen(v) {
    return `¥${Number(v || 0).toLocaleString('ja-JP')}`;
  }

  function formatKoreanMonth(ym) {
    const m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return ym || '';
    return `${Number(m[1])}년 ${Number(m[2])}월`;
  }

  function formatKoreanDate(ymd) {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return ymd || '';
    return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
  }

  function getTodayISODate() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getYesterdayISODate() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getCurrentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthToNumber(monthText) {
    const m = String(monthText || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 100 + Number(m[2]);
  }

  function monthDiffInclusive(fromMonth, toMonth) {
    const fm = String(fromMonth || '').match(/^(\d{4})-(\d{2})$/);
    const tm = String(toMonth || '').match(/^(\d{4})-(\d{2})$/);
    if (!fm || !tm) return 0;
    const diff = (Number(tm[1]) - Number(fm[1])) * 12 + (Number(tm[2]) - Number(fm[2]));
    return diff >= 0 ? diff + 1 : 0;
  }

  function formatWithCommas(raw) {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    return Number(digits).toLocaleString('en-US');
  }

  function parseAmountValue(raw) {
    const digits = String(raw || '').replace(/[^\d]/g, '');
    if (!digits) return NaN;
    return Number(digits);
  }

  const format = {
    symbolOf,
    escapeHtml,
    money,
    yen,
    formatKoreanMonth,
    formatKoreanDate,
    getTodayISODate,
    getYesterdayISODate,
    getCurrentMonth,
    monthToNumber,
    monthDiffInclusive,
    formatWithCommas,
    parseAmountValue,
  };

  App.format = format;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = format;
  }
})(typeof window !== 'undefined' ? window : globalThis);
