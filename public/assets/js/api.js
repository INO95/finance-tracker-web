(function initApi(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state || {};
  const constants = App.constants || {};
  const store = App.store || {};

  function authHeaders(base = {}) {
    const headers = new Headers(base);
    const token = typeof store.getApiToken === 'function' ? store.getApiToken() : '';
    if (token) headers.set('x-api-token', token);
    return headers;
  }

  async function apiFetch(url, options = {}) {
    const merged = { ...options, headers: authHeaders(options.headers || {}) };
    const res = await fetch(url, merged);
    if (!res.ok) {
      if (res.status === 401) throw new Error('인증 실패(401): API 토큰을 다시 확인/입력해주세요.');
      let message = `HTTP ${res.status}`;
      try {
        const payload = await res.json();
        message = payload.error || payload.message || message;
      } catch {
        // ignore parse error
      }
      throw new Error(message);
    }
    return res;
  }

  function scopeToSearchParams(scope) {
    const params = new URLSearchParams();
    if (!scope || typeof scope !== 'object') return params;

    if (scope.scopeMode === 'single' && scope.month) params.set('month', scope.month);
    if (scope.scopeMode === 'range') {
      if (scope.fromMonth) params.set('fromMonth', scope.fromMonth);
      if (scope.toMonth) params.set('toMonth', scope.toMonth);
    }

    return params;
  }

  async function loadMeta() {
    let categories = typeof store.defaultCategoryList === 'function' ? store.defaultCategoryList() : [];
    let methods = typeof store.defaultMethodList === 'function' ? store.defaultMethodList() : [];

    try {
      const res = await apiFetch(`${constants.API_BASE}/meta`);
      const meta = await res.json();
      state.baseCategories = [...new Set(meta.categories || [])];
      state.baseMethods = [...new Set(meta.paymentMethods || [])];
      categories = [...new Set([...categories, ...state.baseCategories])];
      methods = [...new Set([...methods, ...state.baseMethods])];
      state.foodBudgetYen = Number(meta.foodBudgetYen || state.foodBudgetYen || 60000);
      state.categoryBudgets = meta.categoryBudgets && typeof meta.categoryBudgets === 'object'
        ? meta.categoryBudgets
        : (state.categoryBudgets || {});
    } catch {
      state.baseCategories = categories;
      state.baseMethods = methods;
    }

    categories = [...new Set([...categories, ...(store.loadJson ? store.loadJson(constants.CATEGORIES_KEY, []) : [])])];
    methods = [...new Set([...methods, ...(store.loadJson ? store.loadJson(constants.METHODS_KEY, []) : [])])];

    return {
      categories,
      methods,
      defaults: store.loadJson ? store.loadJson(constants.DEFAULTS_KEY, {}) : {},
      foodBudgetYen: state.foodBudgetYen,
      categoryBudgets: state.categoryBudgets || {},
      baseCategories: [...(state.baseCategories || [])],
      baseMethods: [...(state.baseMethods || [])],
    };
  }

  async function loadUsage() {
    try {
      const res = await apiFetch(`${constants.API_BASE}/usage`);
      state.usage = await res.json();
    } catch {
      state.usage = { categoryUsage: {}, paymentMethodUsage: {} };
    }
    return state.usage;
  }

  async function loadSettings() {
    try {
      const res = await apiFetch(`${constants.API_BASE}/settings`);
      const data = await res.json();
      state.foodBudgetYen = Number(data.foodBudgetYen || state.foodBudgetYen || 60000);
      state.categoryBudgets = data.categoryBudgets && typeof data.categoryBudgets === 'object'
        ? data.categoryBudgets
        : (state.categoryBudgets || {});
      return data;
    } catch {
      return {
        foodBudgetYen: state.foodBudgetYen,
        categoryBudgets: state.categoryBudgets || {},
      };
    }
  }

  async function loadSummary(scope, { preserveState = true } = {}) {
    const params = scopeToSearchParams(scope);
    const res = await apiFetch(`${constants.API_BASE}/summary?${params.toString()}`);
    const data = await res.json();
    if (preserveState) {
      state.monthly = data.monthly || [];
      state.latestMonth = data.latestMonth || null;
    }
    return data;
  }

  async function loadTransactions(scope, options = {}) {
    const paginate = options.paginate !== false;
    const params = new URLSearchParams({
      sort: String(options.sort || state.txSort || 'date_desc'),
    });

    if (paginate) {
      params.set('limit', String(options.limit || state.txLimit || 100));
      params.set('page', String(options.page || state.txPage || 1));
    } else {
      params.set('paginate', 'false');
      params.set('limit', String(options.limit || state.txLimit || 100));
      params.set('page', '1');
    }

    const scopeParams = scopeToSearchParams(scope);
    for (const [key, value] of scopeParams.entries()) params.set(key, value);
    if (scope && scope.category) params.set('category', scope.category);
    if (scope && scope.q) params.set('q', scope.q);
    if (scope && scope.memo) params.set('memo', scope.memo);

    const res = await apiFetch(`${constants.API_BASE}/transactions?${params.toString()}`);
    return res.json();
  }

  async function loadAlert(scope) {
    const params = scopeToSearchParams(scope);
    const res = await apiFetch(`${constants.API_BASE}/alerts/real-food?${params.toString()}`);
    return res.json();
  }

  async function saveSettings(payload) {
    const res = await apiFetch(`${constants.API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    state.foodBudgetYen = Number(data.foodBudgetYen || state.foodBudgetYen || 60000);
    state.categoryBudgets = data.categoryBudgets && typeof data.categoryBudgets === 'object'
      ? data.categoryBudgets
      : (state.categoryBudgets || {});
    return data;
  }

  async function saveFoodBudget(foodBudgetYen) {
    return saveSettings({ foodBudgetYen: Math.trunc(foodBudgetYen) });
  }

  async function createTransaction(payload) {
    const res = await apiFetch(`${constants.API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function updateTransaction(id, payload) {
    const res = await apiFetch(`${constants.API_BASE}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function deleteTransaction(id) {
    const res = await apiFetch(`${constants.API_BASE}/transactions/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  }

  async function restoreTransaction(payload) {
    const res = await apiFetch(`${constants.API_BASE}/transactions/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  App.api = {
    authHeaders,
    apiFetch,
    scopeToSearchParams,
    loadMeta,
    loadUsage,
    loadSettings,
    loadSummary,
    loadTransactions,
    loadAlert,
    saveSettings,
    saveFoodBudget,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      scopeToSearchParams,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
