(function initApp(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state;
  const constants = App.constants;
  const store = App.store;
  const format = App.format;
  const api = App.api;
  const render = App.render;
  const modals = App.modals;

  function syncScopeUi() {
    const mode = global.document.getElementById('scopeMode').value;
    global.document.getElementById('month').disabled = mode !== 'single';
    global.document.getElementById('fromMonth').disabled = mode !== 'range';
    global.document.getElementById('toMonth').disabled = mode !== 'range';
  }

  function ensureScopeSelection() {
    const mode = global.document.getElementById('scopeMode').value;
    const current = format.getCurrentMonth();
    const months = store.getSelectValues('month').sort((a, b) => b.localeCompare(a));

    if (mode === 'single') {
      const monthEl = global.document.getElementById('month');
      if (!monthEl.value) {
        if (!store.setIfExists('month', current) && months.length > 0) {
          monthEl.value = months[0];
        }
      }
      return;
    }

    if (mode === 'range') {
      const fromEl = global.document.getElementById('fromMonth');
      const toEl = global.document.getElementById('toMonth');
      if (!toEl.value) {
        if (!store.setIfExists('toMonth', current) && months.length > 0) {
          toEl.value = months[0];
        }
      }
      if (!fromEl.value) {
        const to = toEl.value;
        if (to) {
          const asc = [...months].sort((a, b) => a.localeCompare(b));
          const upto = asc.filter(m => m <= to);
          fromEl.value = upto.slice(-3)[0] || to;
        } else if (months.length > 0) {
          fromEl.value = months[months.length - 1];
        }
      }
    }
  }

  function getScope() {
    return {
      scopeMode: global.document.getElementById('scopeMode').value,
      month: global.document.getElementById('month').value.trim(),
      fromMonth: global.document.getElementById('fromMonth').value.trim(),
      toMonth: global.document.getElementById('toMonth').value.trim(),
      category: global.document.getElementById('categoryFilter').value.trim(),
    };
  }

  function updateSummaryRangeLabel(scope) {
    const rangeLabelEl = global.document.getElementById('summaryRangeLabel');
    if (scope.scopeMode === 'single' && scope.month) {
      rangeLabelEl.textContent = `요약 범위: ${format.formatKoreanMonth(scope.month)}`;
      return;
    }
    if (scope.scopeMode === 'range' && (scope.fromMonth || scope.toMonth)) {
      const left = scope.fromMonth ? format.formatKoreanMonth(scope.fromMonth) : '처음';
      const right = scope.toMonth ? format.formatKoreanMonth(scope.toMonth) : '현재';
      rangeLabelEl.textContent = `요약 범위: ${left} ~ ${right}`;
      return;
    }
    rangeLabelEl.textContent = '요약 범위: 전체';
  }

  async function loadMetaIntoUi() {
    const meta = await api.loadMeta();

    render.fillSelect('categoryFilter', meta.categories, { includeAll: true, allLabel: '전체' });
    render.fillSelect('newCategory', meta.categories);
    render.fillSelect('newMethod', meta.methods);

    const defaults = meta.defaults || {};
    if (defaults.category && meta.categories.includes(defaults.category)) global.document.getElementById('newCategory').value = defaults.category;
    if (defaults.paymentMethod && meta.methods.includes(defaults.paymentMethod)) global.document.getElementById('newMethod').value = defaults.paymentMethod;
    if (defaults.currency) global.document.getElementById('currency').value = defaults.currency;
    if (defaults.txType) global.document.getElementById('txType').value = defaults.txType;

    render.ensureDefaultSelection('newCategory', '식비');
    render.ensureDefaultSelection('newMethod', '현금');

    global.document.getElementById('foodBudgetInput').value = Number(state.foodBudgetYen).toLocaleString('en-US');
  }

  function initDefaults() {
    global.document.getElementById('newDate').value = format.getTodayISODate();

    const defaults = store.loadJson(constants.DEFAULTS_KEY, {});
    if (defaults.currency) global.document.getElementById('currency').value = defaults.currency;
    if (defaults.txType) global.document.getElementById('txType').value = defaults.txType;
    if (defaults.category) global.document.getElementById('newCategory').value = defaults.category;
    if (defaults.paymentMethod) global.document.getElementById('newMethod').value = defaults.paymentMethod;

    global.document.getElementById('txSort').value = state.txSort;
    global.document.getElementById('txLimit').value = String(state.txLimit);
    global.document.getElementById('scopeMode').value = 'single';

    const currentMonth = format.getCurrentMonth();
    if (!store.setIfExists('month', currentMonth)) {
      global.document.getElementById('month').value = currentMonth;
    }

    syncScopeUi();
    render.applyBalanceHeaders();
  }

  async function refresh() {
    const requestId = ++state.refreshRequestId;

    await api.loadUsage();
    const scope = getScope();
    const summary = await api.loadSummary(scope);

    render.populateMonthOptions(summary.monthly || []);
    ensureScopeSelection();

    const settledScope = getScope();
    const [tx, alert] = await Promise.all([
      api.loadTransactions(settledScope),
      api.loadAlert(settledScope),
    ]);

    // Ignore stale responses from earlier refresh requests.
    if (requestId !== state.refreshRequestId) return;

    const months = summary.monthly || [];
    let target = null;

    if (settledScope.scopeMode === 'single' && settledScope.month) {
      target = months.find(m => m.month === settledScope.month) || summary.latestMonth;
    } else if (settledScope.scopeMode === 'range') {
      const inRange = months.filter(m => {
        const n = format.monthToNumber(m.month);
        const f = format.monthToNumber(settledScope.fromMonth);
        const t = format.monthToNumber(settledScope.toMonth);
        if (n == null) return false;
        if (f != null && n < f) return false;
        if (t != null && n > t) return false;
        return true;
      });
      target = render.aggregateAllMonths(inRange);
    } else {
      target = render.aggregateAllMonths(months);
    }

    updateSummaryRangeLabel(settledScope);

    const monthCountForBudget = render.computeBudgetMonthCount(settledScope, months);
    if (target && target.effectiveFood) {
      target.monthCount = monthCountForBudget;
      target.effectiveFood.budget = state.foodBudgetYen * monthCountForBudget;
      target.effectiveFood.budgetDelta = target.effectiveFood.budget - Number(target.effectiveFood.effective || 0);
      target.effectiveFood.status = Number(target.effectiveFood.effective || 0) > Number(target.effectiveFood.budget || 0) ? 'OVER' : 'OK';
    }

    global.document.getElementById('budgetScopeInfo').textContent =
      `월 예산 ${format.yen(state.foodBudgetYen)} × 적용 ${monthCountForBudget}개월 = 총 예산 ${format.yen((state.foodBudgetYen || 0) * monthCountForBudget)}`;

    render.renderKpi(target);
    render.renderAlert(alert);
    render.renderMonthly(summary.monthly || [], settledScope);
    render.renderTransactions(tx);
  }

  async function saveFoodBudget() {
    const raw = format.parseAmountValue(global.document.getElementById('foodBudgetInput').value);
    if (!Number.isFinite(raw) || raw <= 0) throw new Error('식비 예산은 1 이상의 숫자로 입력해주세요.');
    await api.saveFoodBudget(raw);
    await refresh();
  }

  async function addTransaction() {
    const amountRaw = format.parseAmountValue(global.document.getElementById('newAmount').value.trim());
    const txType = global.document.getElementById('txType').value;
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) throw new Error('금액은 1 이상의 숫자로 입력해주세요.');

    const amount = txType === 'income' ? Math.trunc(amountRaw) : -Math.trunc(amountRaw);
    const category = global.document.getElementById('newCategory').value.trim();
    const method = global.document.getElementById('newMethod').value.trim();
    if (!category) throw new Error('카테고리를 선택해주세요.');
    if (!method) throw new Error('결제수단을 선택해주세요.');

    const payload = {
      date: global.document.getElementById('newDate').value.trim(),
      item: global.document.getElementById('newItem').value.trim() || category,
      amount,
      category,
      currency: global.document.getElementById('currency').value,
      paymentMethod: method,
      memo: global.document.getElementById('newMemo').value.trim(),
    };

    await api.createTransaction(payload);

    global.document.getElementById('newItem').value = '';
    global.document.getElementById('newAmount').value = '';
    global.document.getElementById('newMemo').value = '';
    render.setTxFormStatus('거래가 저장되었습니다.', 'ok');
    state.txPage = 1;
    await refresh();
  }

  function saveDefaults() {
    const payload = {
      category: global.document.getElementById('newCategory').value,
      paymentMethod: global.document.getElementById('newMethod').value,
      currency: global.document.getElementById('currency').value,
      txType: global.document.getElementById('txType').value,
    };
    store.saveJson(constants.DEFAULTS_KEY, payload);
    global.alert('기본값 저장 완료');
  }

  function applyScopePresetAll() {
    global.document.getElementById('scopeMode').value = 'all';
    global.document.getElementById('month').value = '';
    global.document.getElementById('fromMonth').value = '';
    global.document.getElementById('toMonth').value = '';
    syncScopeUi();
    state.txPage = 1;
    refresh().catch(e => global.alert(e.message));
  }

  function applyScopePresetThisMonth() {
    const month = format.getCurrentMonth();
    const months = store.getSelectValues('month').sort((a, b) => b.localeCompare(a));
    global.document.getElementById('scopeMode').value = 'single';
    if (!store.setIfExists('month', month) && months.length > 0) {
      store.setIfExists('month', months[0]);
    }
    syncScopeUi();
    state.txPage = 1;
    refresh().catch(e => global.alert(e.message));
  }

  function applyScopePresetRecent3Months() {
    const months = store.getSelectValues('month').sort((a, b) => b.localeCompare(a));
    if (months.length === 0) {
      applyScopePresetAll();
      return;
    }
    const latest = months[0];
    const pick = months.slice(0, 3).sort((a, b) => a.localeCompare(b));
    const from = pick[0];

    global.document.getElementById('scopeMode').value = 'range';
    store.setIfExists('fromMonth', from);
    store.setIfExists('toMonth', latest);
    syncScopeUi();
    state.txPage = 1;
    refresh().catch(e => global.alert(e.message));
  }

  function bindEvents() {
    function loadMetaThenRefresh() {
      return loadMetaIntoUi().then(refresh);
    }

    global.document.getElementById('run').addEventListener('click', () => {
      state.txPage = 1;
      refresh().catch(e => global.alert(e.message));
    });

    global.document.getElementById('presetAllBtn').addEventListener('click', applyScopePresetAll);
    global.document.getElementById('presetThisMonthBtn').addEventListener('click', applyScopePresetThisMonth);
    global.document.getElementById('presetRecent3Btn').addEventListener('click', applyScopePresetRecent3Months);

    global.document.getElementById('scopeMode').addEventListener('change', () => {
      syncScopeUi();
    });

    global.document.getElementById('saveTokenBtn').addEventListener('click', () => {
      const token = global.document.getElementById('apiToken').value.trim();
      store.setApiToken(token);
      render.renderTokenState();
      global.alert(token ? '토큰 저장 완료' : '토큰이 비워졌습니다');
    });

    global.document.getElementById('saveBudgetBtn').addEventListener('click', () => {
      saveFoodBudget().catch(e => global.alert(e.message));
    });

    global.document.getElementById('manageCategoryBtn').addEventListener('click', () => {
      modals.renderCategoryModal({ loadMetaIntoUi, refresh });
    });

    global.document.getElementById('manageMethodBtn').addEventListener('click', () => {
      modals.renderMethodModal({ loadMetaIntoUi, refresh });
    });

    global.document.getElementById('manageBalancesBtn').addEventListener('click', () => {
      modals.renderBalanceModal();
    });

    global.document.getElementById('saveDefaultsBtn').addEventListener('click', saveDefaults);

    global.document.getElementById('addTxBtn').addEventListener('click', () => {
      addTransaction().catch(e => {
        render.setTxFormStatus(e.message, 'warn');
      });
    });

    global.document.getElementById('monthlySort').addEventListener('change', () => {
      render.renderMonthly(state.monthly || [], getScope());
    });

    global.document.getElementById('newMemo').addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        addTransaction().catch(err => render.setTxFormStatus(err.message, 'warn'));
      }
    });

    global.document.getElementById('newAmount').addEventListener('input', e => {
      const atEnd = e.target.selectionStart === e.target.value.length;
      e.target.value = format.formatWithCommas(e.target.value);
      if (atEnd) {
        const len = e.target.value.length;
        e.target.setSelectionRange(len, len);
      }
    });

    global.document.getElementById('foodBudgetInput').addEventListener('input', e => {
      const atEnd = e.target.selectionStart === e.target.value.length;
      e.target.value = format.formatWithCommas(e.target.value);
      if (atEnd) {
        const len = e.target.value.length;
        e.target.setSelectionRange(len, len);
      }
    });

    global.document.getElementById('txSort').addEventListener('change', e => {
      state.txSort = e.target.value;
      state.txPage = 1;
      refresh().catch(err => global.alert(err.message));
    });

    global.document.getElementById('txLimit').addEventListener('change', e => {
      state.txLimit = Number(e.target.value || 100);
      state.txPage = 1;
      refresh().catch(err => global.alert(err.message));
    });

    global.document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (state.txPage <= 1) return;
      state.txPage -= 1;
      refresh().catch(e => global.alert(e.message));
    });

    global.document.getElementById('nextPageBtn').addEventListener('click', () => {
      const maxPage = Math.max(1, Math.ceil(state.txTotal / state.txLimit));
      if (state.txPage >= maxPage) return;
      state.txPage += 1;
      refresh().catch(e => global.alert(e.message));
    });

    global.document.getElementById('pageLinks').addEventListener('click', e => {
      const target = e.target.getAttribute('data-page');
      if (!target) return;
      state.txPage = Number(target);
      refresh().catch(err => global.alert(err.message));
    });

    global.document.getElementById('modalCloseBtn').addEventListener('click', () => {
      modals.closeModal();
      loadMetaThenRefresh().catch(e => global.alert(e.message));
    });

    global.document.getElementById('modalBackdrop').addEventListener('click', e => {
      if (e.target.id !== 'modalBackdrop') return;
      modals.closeModal();
      loadMetaThenRefresh().catch(err => global.alert(err.message));
    });
  }

  function bootstrap() {
    global.document.getElementById('apiToken').value = store.getApiToken();
    render.renderTokenState();

    Promise.all([loadMetaIntoUi(), api.loadSettings()])
      .then(() => {
        global.document.getElementById('foodBudgetInput').value = Number(state.foodBudgetYen).toLocaleString('en-US');
        initDefaults();
        syncScopeUi();
        return refresh();
      })
      .catch(e => {
        // eslint-disable-next-line no-console
        console.error(e);
        global.alert(e.message);
      });
  }

  bindEvents();
  bootstrap();
})(typeof window !== 'undefined' ? window : globalThis);
