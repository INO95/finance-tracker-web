(function initApp(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state;
  const constants = App.constants;
  const store = App.store;
  const format = App.format;
  const tools = App.tools;
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
        if (!store.setIfExists('month', current) && months.length > 0) monthEl.value = months[0];
      }
      return;
    }

    if (mode === 'range') {
      const fromEl = global.document.getElementById('fromMonth');
      const toEl = global.document.getElementById('toMonth');
      if (!toEl.value) {
        if (!store.setIfExists('toMonth', current) && months.length > 0) toEl.value = months[0];
      }
      if (!fromEl.value) {
        const to = toEl.value;
        if (to) {
          const asc = [...months].sort((a, b) => a.localeCompare(b));
          const upto = asc.filter(month => month <= to);
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
    global.document.getElementById('foodBudgetInput').value = Number(state.foodBudgetYen || 0).toLocaleString('en-US');
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

    syncScopeUi();
    render.applyBalanceHeaders();
    render.renderTxFormMode();
    render.renderUndoBanner();
  }

  function getCurrentMonthForTemplates() {
    return format.getCurrentMonth();
  }

  function getTemplates() {
    return store.getRecurringTemplates().map(template => tools.normalizeTemplate(template));
  }

  function findTemplateById(id) {
    return getTemplates().find(template => String(template.id) === String(id)) || null;
  }

  function clearEditingMode({ clearStatus = false } = {}) {
    state.editingTransactionId = null;
    render.renderTxFormMode();
    if (clearStatus) render.setTxFormStatus('', 'muted');
  }

  function resetTransactionForm({ keepDate = true } = {}) {
    global.document.getElementById('newItem').value = '';
    global.document.getElementById('newAmount').value = '';
    global.document.getElementById('newMemo').value = '';
    if (!keepDate) global.document.getElementById('newDate').value = format.getTodayISODate();
    clearEditingMode();
  }

  function fillTransactionForm(row) {
    if (!row) return;
    const amount = Number(row.income || 0) > 0 ? Number(row.income || 0) : Number(row.expense || 0);
    global.document.getElementById('newDate').value = String(row.date || '').slice(0, 10);
    global.document.getElementById('newItem').value = row.item || '';
    store.setIfExists('newCategory', row.category || '');
    store.setIfExists('newMethod', row.paymentMethod || '');
    global.document.getElementById('currency').value = row.currency || 'JPY';
    global.document.getElementById('newMemo').value = row.memo || '';
    global.document.getElementById('txType').value = Number(row.income || 0) > 0 ? 'income' : 'expense';
    global.document.getElementById('newAmount').value = amount > 0 ? Number(amount).toLocaleString('en-US') : '';
    state.editingTransactionId = Number(row.id);
    render.renderTxFormMode();
    render.setTxFormStatus(`거래 #${row.id} 수정 모드`, 'muted');
  }

  function buildTransactionPayloadFromForm() {
    const amountRaw = format.parseAmountValue(global.document.getElementById('newAmount').value.trim());
    const txType = global.document.getElementById('txType').value;
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) throw new Error('금액은 1 이상의 숫자로 입력해주세요.');

    const category = global.document.getElementById('newCategory').value.trim();
    const method = global.document.getElementById('newMethod').value.trim();
    if (!category) throw new Error('카테고리를 선택해주세요.');
    if (!method) throw new Error('결제수단을 선택해주세요.');

    const amount = txType === 'income' ? Math.trunc(amountRaw) : -Math.trunc(amountRaw);
    return {
      date: global.document.getElementById('newDate').value.trim(),
      item: global.document.getElementById('newItem').value.trim() || category,
      amount,
      category,
      currency: global.document.getElementById('currency').value,
      paymentMethod: method,
      memo: global.document.getElementById('newMemo').value.trim(),
    };
  }

  function getImportDefaults() {
    return {
      category: global.document.getElementById('newCategory').value || '기타',
      paymentMethod: global.document.getElementById('newMethod').value || '현금',
      currency: global.document.getElementById('currency').value || 'JPY',
      memo: global.document.getElementById('newMemo').value.trim(),
    };
  }

  async function refresh() {
    const requestId = ++state.refreshRequestId;
    await Promise.all([api.loadUsage(), api.loadSettings()]);
    const allSummary = await api.loadSummary({ scopeMode: 'all' }, { preserveState: false });
    if (requestId !== state.refreshRequestId) return;

    state.monthlyAll = allSummary.monthly || [];
    render.populateMonthOptions(state.monthlyAll);
    ensureScopeSelection();
    syncScopeUi();

    const settledScope = getScope();
    const [scopedSummary, pagedTx, allTx, alert] = await Promise.all([
      api.loadSummary(settledScope),
      api.loadTransactions(settledScope),
      api.loadTransactions(settledScope, { paginate: false }),
      api.loadAlert(settledScope),
    ]);

    if (requestId !== state.refreshRequestId) return;

    state.monthly = scopedSummary.monthly || [];
    state.latestMonth = scopedSummary.latestMonth || null;
    state.allScopedTransactions = allTx.rows || [];

    if (state.editingTransactionId && !state.allScopedTransactions.some(row => Number(row.id) === Number(state.editingTransactionId))) {
      clearEditingMode();
    }

    let target = null;
    if (settledScope.scopeMode === 'single' && settledScope.month) {
      target = state.monthly.find(month => month.month === settledScope.month) || state.latestMonth || null;
    } else {
      target = state.monthly.length ? render.aggregateAllMonths(state.monthly) : null;
    }

    updateSummaryRangeLabel(settledScope);
    const monthCountForBudget = render.computeBudgetMonthCount(settledScope, state.monthly);
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
    render.renderMonthly(state.monthly, settledScope);
    render.renderTransactions(pagedTx);
    render.renderRecurringTemplates(getTemplates(), getCurrentMonthForTemplates());
    render.renderUndoBanner();
    render.renderCategoryBudgets(state.monthly, state.categoryBudgets || {});
    render.renderBalanceHealth(store.getBalanceAccounts(), store.getBalanceSnapshots(), state.allScopedTransactions);
  }

  async function saveFoodBudget() {
    const raw = format.parseAmountValue(global.document.getElementById('foodBudgetInput').value);
    if (!Number.isFinite(raw) || raw <= 0) throw new Error('식비 예산은 1 이상의 숫자로 입력해주세요.');
    await api.saveFoodBudget(raw);
    await refresh();
  }

  async function saveCategoryBudgets(nextBudgets) {
    await api.saveSettings({ categoryBudgets: nextBudgets });
    await refresh();
  }

  async function submitTransaction() {
    const payload = buildTransactionPayloadFromForm();
    if (Number.isFinite(Number(state.editingTransactionId))) {
      await api.updateTransaction(state.editingTransactionId, payload);
      render.setTxFormStatus('거래가 수정되었습니다.', 'ok');
    } else {
      await api.createTransaction(payload);
      render.setTxFormStatus('거래가 저장되었습니다.', 'ok');
      state.txPage = 1;
    }
    resetTransactionForm({ keepDate: false });
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
    refresh().catch(error => global.alert(error.message));
  }

  function applyScopePresetThisMonth() {
    const month = format.getCurrentMonth();
    const months = store.getSelectValues('month').sort((a, b) => b.localeCompare(a));
    global.document.getElementById('scopeMode').value = 'single';
    if (!store.setIfExists('month', month) && months.length > 0) store.setIfExists('month', months[0]);
    syncScopeUi();
    state.txPage = 1;
    refresh().catch(error => global.alert(error.message));
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
    refresh().catch(error => global.alert(error.message));
  }

  async function deleteTransactionById(id) {
    const row = state.allScopedTransactions.find(item => Number(item.id) === Number(id))
      || state.txRows.find(item => Number(item.id) === Number(id));
    if (!row) return;
    if (!global.confirm(`"${row.item || row.category}" 거래를 삭제할까요?`)) return;
    const result = await api.deleteTransaction(id);
    state.lastDeletedTransaction = result.transaction;
    if (Number(state.editingTransactionId) === Number(id)) {
      resetTransactionForm({ keepDate: false });
    }
    render.renderUndoBanner();
    render.setTxFormStatus('거래가 삭제되었습니다. 실행 취소할 수 있습니다.', 'warn');
    await refresh();
  }

  async function undoDelete() {
    if (!state.lastDeletedTransaction) return;
    await api.restoreTransaction(state.lastDeletedTransaction);
    state.lastDeletedTransaction = null;
    render.renderUndoBanner();
    render.setTxFormStatus('삭제한 거래를 복원했습니다.', 'ok');
    state.txPage = 1;
    await refresh();
  }

  function loadTemplateIntoForm(templateId) {
    const template = findTemplateById(templateId);
    if (!template) return;
    const tx = tools.buildTransactionFromTemplate(template, new Date());
    global.document.getElementById('newDate').value = tx.date;
    global.document.getElementById('newItem').value = tx.item;
    store.setIfExists('newCategory', tx.category);
    store.setIfExists('newMethod', tx.paymentMethod);
    global.document.getElementById('currency').value = tx.currency;
    global.document.getElementById('txType').value = template.txType;
    global.document.getElementById('newAmount').value = Number(Math.abs(tx.amount)).toLocaleString('en-US');
    global.document.getElementById('newMemo').value = tx.memo || '';
    clearEditingMode();
    render.setTxFormStatus(`템플릿 "${template.name}" 불러옴`, 'ok');
  }

  async function applyTemplateNow(templateId) {
    const template = findTemplateById(templateId);
    if (!template) return;
    const currentMonth = getCurrentMonthForTemplates();
    const payload = tools.buildTransactionFromTemplate(template, new Date());
    await api.createTransaction(payload);
    if (template.recurrence === 'monthly') {
      const nextTemplates = tools.markTemplateApplied(store.getRecurringTemplates(), templateId, currentMonth);
      store.setRecurringTemplates(nextTemplates);
    }
    state.txPage = 1;
    render.setTxFormStatus(`템플릿 "${template.name}" 거래를 반영했습니다.`, 'ok');
    await refresh();
  }

  function saveCurrentAsTemplate() {
    const payload = buildTransactionPayloadFromForm();
    const txType = payload.amount > 0 ? 'income' : 'expense';
    const template = tools.normalizeTemplate({
      name: payload.item,
      item: payload.item,
      category: payload.category,
      paymentMethod: payload.paymentMethod,
      currency: payload.currency,
      amount: Math.abs(payload.amount),
      txType,
      memo: payload.memo,
      recurrence: 'none',
      billingDay: 1,
    });
    const nextTemplates = store.getRecurringTemplates().concat(template);
    store.setRecurringTemplates(nextTemplates);
    render.renderRecurringTemplates(getTemplates(), getCurrentMonthForTemplates());
    render.setTxFormStatus(`템플릿 "${template.name}" 저장 완료`, 'ok');
  }

  async function importCsvEntries(entries) {
    let success = 0;
    const failures = [];
    for (const entry of entries) {
      try {
        await api.createTransaction(entry);
        success += 1;
      } catch (error) {
        failures.push(`${entry.date} ${entry.item}: ${error.message}`);
      }
    }

    state.txPage = 1;
    await refresh();
    if (failures.length > 0) {
      render.setTxFormStatus(`CSV ${success}건 가져오기, ${failures.length}건 실패`, 'warn');
      global.alert(failures.slice(0, 5).join('\n'));
      return;
    }
    render.setTxFormStatus(`CSV ${success}건 가져오기 완료`, 'ok');
  }

  function bindEvents() {
    function loadMetaThenRefresh() {
      return loadMetaIntoUi().then(refresh);
    }

    global.document.getElementById('run').addEventListener('click', () => {
      state.txPage = 1;
      refresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('presetAllBtn').addEventListener('click', applyScopePresetAll);
    global.document.getElementById('presetThisMonthBtn').addEventListener('click', applyScopePresetThisMonth);
    global.document.getElementById('presetRecent3Btn').addEventListener('click', applyScopePresetRecent3Months);

    global.document.getElementById('scopeMode').addEventListener('change', () => {
      syncScopeUi();
      ensureScopeSelection();
    });

    global.document.getElementById('saveTokenBtn').addEventListener('click', () => {
      const token = global.document.getElementById('apiToken').value.trim();
      store.setApiToken(token);
      render.renderTokenState();
      global.alert(token ? '토큰 저장 완료' : '토큰이 비워졌습니다');
    });

    global.document.getElementById('saveBudgetBtn').addEventListener('click', () => {
      saveFoodBudget().catch(error => global.alert(error.message));
    });

    global.document.getElementById('manageCategoryBtn').addEventListener('click', () => {
      modals.renderCategoryModal({ loadMetaIntoUi, refresh });
    });

    global.document.getElementById('manageMethodBtn').addEventListener('click', () => {
      modals.renderMethodModal({ loadMetaIntoUi, refresh });
    });

    global.document.getElementById('manageBalancesBtn').addEventListener('click', () => {
      modals.renderBalanceModal({ onSaved: refresh });
    });

    global.document.getElementById('manageTemplatesBtn').addEventListener('click', () => {
      modals.renderTemplateModal({
        categories: store.getSelectValues('newCategory'),
        methods: store.getSelectValues('newMethod'),
        onSaved: refresh,
      });
    });

    global.document.getElementById('saveTemplateBtn').addEventListener('click', () => {
      try {
        saveCurrentAsTemplate();
      } catch (error) {
        render.setTxFormStatus(error.message, 'warn');
      }
    });

    global.document.getElementById('csvImportBtn').addEventListener('click', () => {
      modals.renderCsvImportModal({
        defaults: getImportDefaults(),
        onImport: importCsvEntries,
      });
    });

    global.document.getElementById('manageCategoryBudgetBtn').addEventListener('click', () => {
      modals.renderCategoryBudgetModal({
        categories: store.getSelectValues('newCategory'),
        onSave: saveCategoryBudgets,
      });
    });

    global.document.getElementById('saveDefaultsBtn').addEventListener('click', saveDefaults);

    global.document.getElementById('addTxBtn').addEventListener('click', () => {
      submitTransaction().catch(error => render.setTxFormStatus(error.message, 'warn'));
    });

    global.document.getElementById('cancelEditBtn').addEventListener('click', () => {
      resetTransactionForm({ keepDate: false });
      render.setTxFormStatus('수정 모드를 종료했습니다.', 'muted');
    });

    global.document.getElementById('monthlySort').addEventListener('change', () => {
      render.renderMonthly(state.monthly || [], getScope());
    });

    global.document.getElementById('newMemo').addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        submitTransaction().catch(error => render.setTxFormStatus(error.message, 'warn'));
      }
    });

    global.document.getElementById('newAmount').addEventListener('input', event => {
      const atEnd = event.target.selectionStart === event.target.value.length;
      event.target.value = format.formatWithCommas(event.target.value);
      if (atEnd) {
        const len = event.target.value.length;
        event.target.setSelectionRange(len, len);
      }
    });

    global.document.getElementById('foodBudgetInput').addEventListener('input', event => {
      const atEnd = event.target.selectionStart === event.target.value.length;
      event.target.value = format.formatWithCommas(event.target.value);
      if (atEnd) {
        const len = event.target.value.length;
        event.target.setSelectionRange(len, len);
      }
    });

    global.document.getElementById('txSort').addEventListener('change', event => {
      state.txSort = event.target.value;
      state.txPage = 1;
      refresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('txLimit').addEventListener('change', event => {
      state.txLimit = Number(event.target.value || 100);
      state.txPage = 1;
      refresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('prevPageBtn').addEventListener('click', () => {
      if (state.txPage <= 1) return;
      state.txPage -= 1;
      refresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('nextPageBtn').addEventListener('click', () => {
      const maxPage = Math.max(1, Math.ceil(state.txTotal / state.txLimit));
      if (state.txPage >= maxPage) return;
      state.txPage += 1;
      refresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('pageLinks').addEventListener('click', event => {
      const page = event.target.getAttribute('data-page');
      if (!page) return;
      state.txPage = Number(page);
      refresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('undoDeleteBtn').addEventListener('click', () => {
      undoDelete().catch(error => global.alert(error.message));
    });

    global.document.getElementById('txTable').addEventListener('click', event => {
      const editId = event.target.getAttribute('data-tx-edit');
      const deleteId = event.target.getAttribute('data-tx-delete');
      if (editId) {
        const row = state.allScopedTransactions.find(item => Number(item.id) === Number(editId))
          || state.txRows.find(item => Number(item.id) === Number(editId));
        fillTransactionForm(row);
        return;
      }
      if (deleteId) deleteTransactionById(Number(deleteId)).catch(error => global.alert(error.message));
    });

    function handleTemplateClick(event) {
      const fillId = event.target.getAttribute('data-template-fill');
      const applyId = event.target.getAttribute('data-template-apply');
      if (fillId) {
        loadTemplateIntoForm(fillId);
        return;
      }
      if (applyId) applyTemplateNow(applyId).catch(error => global.alert(error.message));
    }

    global.document.getElementById('templateDueList').addEventListener('click', handleTemplateClick);
    global.document.getElementById('quickTemplateList').addEventListener('click', handleTemplateClick);

    global.document.getElementById('modalCloseBtn').addEventListener('click', () => {
      state.importPreview = null;
      modals.closeModal();
      loadMetaThenRefresh().catch(error => global.alert(error.message));
    });

    global.document.getElementById('modalBackdrop').addEventListener('click', event => {
      if (event.target.id !== 'modalBackdrop') return;
      state.importPreview = null;
      modals.closeModal();
      loadMetaThenRefresh().catch(error => global.alert(error.message));
    });
  }

  function bootstrap() {
    global.document.getElementById('apiToken').value = store.getApiToken();
    render.renderTokenState();

    Promise.all([loadMetaIntoUi(), api.loadSettings()])
      .then(() => {
        global.document.getElementById('foodBudgetInput').value = Number(state.foodBudgetYen).toLocaleString('en-US');
        initDefaults();
        return refresh();
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error(error);
        global.alert(error.message);
      });
  }

  bindEvents();
  bootstrap();
})(typeof window !== 'undefined' ? window : globalThis);
