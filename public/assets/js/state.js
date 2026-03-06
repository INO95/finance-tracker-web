(function initState(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const TOKEN_STORAGE_KEY = 'financeApiToken';
  const CATEGORIES_KEY = 'financeCategories';
  const METHODS_KEY = 'financePaymentMethods';
  const DEFAULTS_KEY = 'financeFormDefaults';
  const BALANCE_ACCOUNTS_KEY = 'financeBalanceAccounts';
  const RECURRING_TEMPLATES_KEY = 'financeRecurringTemplates';
  const BALANCE_SNAPSHOTS_KEY = 'financeBalanceSnapshots';
  const API_BASE = './api/finance';

  const state = {
    txPage: 1,
    txTotal: 0,
    txLimit: 100,
    txSort: 'date_desc',
    txRows: [],
    scopeMode: 'all',
    foodBudgetYen: 60000,
    categoryBudgets: {},
    baseCategories: [],
    baseMethods: [],
    monthly: [],
    monthlyAll: [],
    latestMonth: null,
    usage: { categoryUsage: {}, paymentMethodUsage: {} },
    refreshRequestId: 0,
    editingTransactionId: null,
    lastDeletedTransaction: null,
    allScopedTransactions: [],
    importPreview: null,
  };

  function loadJson(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    global.localStorage.setItem(key, JSON.stringify(value));
  }

  function getApiToken() {
    return (global.localStorage.getItem(TOKEN_STORAGE_KEY) || '').trim();
  }

  function setApiToken(token) {
    global.localStorage.setItem(TOKEN_STORAGE_KEY, String(token || '').trim());
  }

  function defaultCategoryList() {
    return ['식비', '교통비', '월세', '통신비', '교육', '건강', '생활', '취미', '기타'];
  }

  function defaultMethodList() {
    return ['현금', '스미토모', '라쿠텐', '올리브 카드 (데빗)', '올리브 카드 (크레짓)', '아마존 카드'];
  }

  function defaultBalanceAccounts() {
    return [
      { id: 'acc_sumitomo', name: '스미토모 통장', currency: 'JPY', source: 'sumitomo' },
      { id: 'acc_rakuten', name: '라쿠텐 통장', currency: 'JPY', source: 'rakuten' },
      { id: 'acc_cash', name: '현금', currency: 'JPY', source: 'cash' },
    ];
  }

  function getBalanceAccounts() {
    const list = loadJson(BALANCE_ACCOUNTS_KEY, []);
    if (Array.isArray(list) && list.length > 0) return list;
    const defaults = defaultBalanceAccounts();
    saveJson(BALANCE_ACCOUNTS_KEY, defaults);
    return defaults;
  }

  function setBalanceAccounts(list) {
    saveJson(BALANCE_ACCOUNTS_KEY, Array.isArray(list) ? list : []);
  }

  function getBalanceSnapshots() {
    const snapshots = loadJson(BALANCE_SNAPSHOTS_KEY, {});
    return snapshots && typeof snapshots === 'object' && !Array.isArray(snapshots) ? snapshots : {};
  }

  function setBalanceSnapshots(value) {
    saveJson(BALANCE_SNAPSHOTS_KEY, value && typeof value === 'object' && !Array.isArray(value) ? value : {});
  }

  function getRecurringTemplates() {
    const list = loadJson(RECURRING_TEMPLATES_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function setRecurringTemplates(list) {
    saveJson(RECURRING_TEMPLATES_KEY, Array.isArray(list) ? list : []);
  }

  function getSelectValues(selectId) {
    const el = global.document.getElementById(selectId);
    return el
      ? [...el.options].map(opt => opt.value).filter(Boolean)
      : [];
  }

  function setIfExists(selectId, value) {
    const el = global.document.getElementById(selectId);
    if (!el) return false;
    if ([...el.options].some(opt => opt.value === value)) {
      el.value = value;
      return true;
    }
    return false;
  }

  App.state = state;
  App.constants = {
    TOKEN_STORAGE_KEY,
    CATEGORIES_KEY,
    METHODS_KEY,
    DEFAULTS_KEY,
    BALANCE_ACCOUNTS_KEY,
    RECURRING_TEMPLATES_KEY,
    BALANCE_SNAPSHOTS_KEY,
    API_BASE,
  };
  App.store = {
    loadJson,
    saveJson,
    getApiToken,
    setApiToken,
    defaultCategoryList,
    defaultMethodList,
    defaultBalanceAccounts,
    getBalanceAccounts,
    setBalanceAccounts,
    getBalanceSnapshots,
    setBalanceSnapshots,
    getRecurringTemplates,
    setRecurringTemplates,
    getSelectValues,
    setIfExists,
  };
})(typeof window !== 'undefined' ? window : globalThis);
