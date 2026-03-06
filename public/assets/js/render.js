(function initRender(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state;
  const store = App.store;
  const format = App.format;
  const tools = App.tools || {};

  function fillSelect(selectId, values, { includeAll = false, allLabel = '전체', formatter = null } = {}) {
    const el = global.document.getElementById(selectId);
    if (!el) return;
    const current = el.value;
    el.innerHTML = '';
    if (includeAll) {
      const all = global.document.createElement('option');
      all.value = '';
      all.textContent = allLabel;
      el.appendChild(all);
    }
    for (const value of values) {
      const opt = global.document.createElement('option');
      opt.value = value;
      opt.textContent = formatter ? formatter(value) : value;
      el.appendChild(opt);
    }
    if (current && [...el.options].some(opt => opt.value === current)) el.value = current;
  }

  function ensureDefaultSelection(selectId, fallback) {
    const el = global.document.getElementById(selectId);
    if (!el) return;
    if (!el.value && [...el.options].some(opt => opt.value === fallback)) el.value = fallback;
  }

  function renderTokenState() {
    const target = global.document.getElementById('tokenState');
    if (!target) return;
    const token = store.getApiToken();
    target.textContent = token
      ? `토큰 상태: 저장됨 (${token.slice(0, 6)}...)`
      : '토큰 상태: 미설정';
  }

  function applyBalanceHeaders() {
    const accounts = store.getBalanceAccounts();
    const dynamic = accounts.map(account => `<th>${format.escapeHtml(account.name)}</th>`).join('');
    const dynamicCols = accounts.map(() => '<col style="width:140px;">').join('');
    const theadHtml = `
      <tr>
        <th>No.</th>
        <th>날짜</th>
        <th>내용</th>
        <th>카테고리</th>
        <th>결제수단</th>
        <th>수입</th>
        <th>지출</th>
        ${dynamic}
        <th>메모</th>
        <th>작업</th>
      </tr>
    `;
    const table = global.document.querySelector('#txTable');
    if (!table) return;
    table.innerHTML = `
      <colgroup>
        <col style="width:64px;">
        <col style="width:140px;">
        <col style="width:260px;">
        <col style="width:140px;">
        <col style="width:180px;">
        <col style="width:130px;">
        <col style="width:130px;">
        ${dynamicCols}
        <col style="width:280px;">
        <col style="width:140px;">
      </colgroup>
      <thead>${theadHtml}</thead>
      <tbody></tbody>
    `;
  }

  function formatSignedMoney(value, currency) {
    const number = Number(value || 0);
    const prefix = number > 0 ? '+' : number < 0 ? '-' : '';
    return `${prefix}${format.money(number, currency)}`;
  }

  function mapBalanceValue(row, account) {
    if (!account || typeof tools.accountDeltaForRow !== 'function') return '-';
    const delta = tools.accountDeltaForRow(row, account);
    if (!Number.isFinite(delta)) return '-';
    return format.escapeHtml(formatSignedMoney(delta, account.currency || row.currency || 'JPY'));
  }

  function populateMonthOptions(monthly) {
    const current = format.getCurrentMonth();
    const fromData = (monthly || []).map(row => row.month).filter(Boolean);
    const months = [...new Set([current, ...fromData])].sort((a, b) => b.localeCompare(a));

    fillSelect('month', months, { includeAll: true, allLabel: '전체', formatter: format.formatKoreanMonth });
    fillSelect('fromMonth', months, { includeAll: true, allLabel: '시작월', formatter: format.formatKoreanMonth });
    fillSelect('toMonth', months, { includeAll: true, allLabel: '종료월', formatter: format.formatKoreanMonth });
  }

  function computeBudgetMonthCount(scope, scopedMonthly) {
    if (scope.scopeMode === 'single') return 1;
    if (scope.scopeMode === 'range') {
      if (scope.fromMonth && scope.toMonth) {
        const count = format.monthDiffInclusive(scope.fromMonth, scope.toMonth);
        if (count > 0) return count;
      }
      return Math.max(1, (scopedMonthly || []).length);
    }
    return Math.max(1, (scopedMonthly || []).length);
  }

  function aggregateAllMonths(monthly) {
    const acc = {
      month: '전체',
      income: 0,
      expense: 0,
      effectiveFood: { effective: 0, budget: state.foodBudgetYen, budgetDelta: 0, status: 'OK' },
    };

    for (const row of monthly || []) {
      acc.income += Number(row.income || 0);
      acc.expense += Number(row.expense || 0);
      acc.effectiveFood.effective += Number(row.effectiveFood?.effective || 0);
    }

    const monthCount = Math.max(1, (monthly || []).length);
    acc.effectiveFood.budget = state.foodBudgetYen * monthCount;
    acc.effectiveFood.budgetDelta = acc.effectiveFood.budget - acc.effectiveFood.effective;
    acc.effectiveFood.status = acc.effectiveFood.effective > acc.effectiveFood.budget ? 'OVER' : 'OK';
    return acc;
  }

  function renderKpi(target) {
    const general = global.document.getElementById('kpiGeneral');
    const foodEl = global.document.getElementById('kpiFood');
    if (!general || !foodEl) return;

    if (!target) {
      general.innerHTML = '<div class="kpi">데이터 없음</div>';
      foodEl.innerHTML = '';
      return;
    }

    const food = target.effectiveFood || {};
    general.innerHTML = [
      ['대상', target.month],
      ['적용월수', `${target.monthCount || 1}개월`],
      ['수입(JPY)', format.yen(target.income)],
      ['지출(JPY)', format.yen(target.expense)],
    ].map(([key, value]) => `
      <div class="kpi">
        <div class="label">${format.escapeHtml(key)}</div>
        <div class="value">${format.escapeHtml(value)}</div>
      </div>
    `).join('');

    foodEl.innerHTML = [
      ['실질 식비(JPY)', format.yen(food.effective)],
      ['식비 예산(JPY)', format.yen(food.budget)],
      ['예산 대비', `${format.yen(food.budgetDelta)} (${food.status || 'OK'})`],
    ].map(([key, value]) => `
      <div class="kpi">
        <div class="label">${format.escapeHtml(key)}</div>
        <div class="value">${format.escapeHtml(value)}</div>
      </div>
    `).join('');
  }

  function renderAlert(alert) {
    const el = global.document.getElementById('alertBox');
    if (!el) return;
    if (!alert) {
      el.className = 'muted';
      el.textContent = '알림 정보 없음';
      return;
    }

    const tone = alert.level === 'danger' ? 'warn' : (alert.level === 'warn' ? 'warn' : 'ok');
    el.className = `status-box ${tone}`;
    el.textContent = `[식비 알림] ${alert.message} (${alert.ratio}%)`;
  }

  function setTxFormStatus(message, tone = 'muted') {
    const el = global.document.getElementById('txFormStatus');
    if (!el) return;
    el.className = `status-line ${tone}`;
    el.textContent = message || '';
  }

  function buildMonthlyComment(row, prev) {
    const ef = row.effectiveFood || {};
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    const savingRate = income > 0 ? ((income - expense) / income) : 0;
    const expenseDelta = prev ? (expense - Number(prev.expense || 0)) : 0;

    if (ef.status === 'OVER') return '식비가 예산을 초과했습니다. 외식 횟수 제한과 장보기 고정일 운영이 필요합니다.';
    if (savingRate < 0.1 && income > 0) return '저축 여력이 낮습니다. 고정비(구독/통신/교통) 절감 우선순위를 점검하세요.';
    if (expenseDelta > 15000) return '전월 대비 지출 증가폭이 큽니다. 일회성 지출인지 반복 항목인지 분리 관리가 필요합니다.';
    if (Number(ef.effective || 0) > Number(ef.budget || 0) * 0.9) return '식비가 예산 상단에 근접했습니다. 단가 높은 항목을 다음 달부터 교체해보세요.';
    return '예산 범위 내 안정적 운영입니다.';
  }

  function renderMonthlyStats(rows) {
    const el = global.document.getElementById('monthlyStats');
    if (!el) return;
    if (!rows || rows.length === 0) {
      el.textContent = '월별 데이터 없음';
      return;
    }

    const monthCount = rows.length;
    const avgIncome = rows.reduce((sum, row) => sum + Number(row.income || 0), 0) / monthCount;
    const avgExpense = rows.reduce((sum, row) => sum + Number(row.expense || 0), 0) / monthCount;
    const overFood = rows.filter(row => String(row.effectiveFood?.status || '') === 'OVER').length;
    el.textContent = `평균 수입 ${format.yen(avgIncome)} · 평균 지출 ${format.yen(avgExpense)} · 식비 예산 초과 ${overFood}/${monthCount}개월`;
  }

  function renderMonthly(monthly, scope) {
    const tbody = global.document.querySelector('#monthlyTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let rows = Array.isArray(monthly) ? [...monthly] : [];
    if (scope.scopeMode === 'single' && scope.month) rows = rows.filter(row => row.month === scope.month);
    if (scope.scopeMode === 'range') {
      rows = rows.filter(row => {
        const monthNumber = format.monthToNumber(row.month);
        const from = format.monthToNumber(scope.fromMonth);
        const to = format.monthToNumber(scope.toMonth);
        if (monthNumber == null) return false;
        if (from != null && monthNumber < from) return false;
        if (to != null && monthNumber > to) return false;
        return true;
      });
    }

    const sortMode = global.document.getElementById('monthlySort')?.value || 'desc';
    rows.sort((a, b) => (sortMode === 'asc'
      ? String(a.month).localeCompare(String(b.month))
      : String(b.month).localeCompare(String(a.month))));

    renderMonthlyStats(rows);

    if (rows.length === 0) {
      const tr = global.document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="muted">선택한 월 데이터가 없습니다.</td>';
      tbody.appendChild(tr);
      return;
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const prev = rows[index + 1] || null;
      const statusClass = row.effectiveFood.status === 'OVER' ? 'warn' : 'ok';
      const comment = buildMonthlyComment(row, prev);
      const tr = global.document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${format.escapeHtml(format.formatKoreanMonth(row.month))}</td>
        <td>${format.escapeHtml(format.yen(row.income))}</td>
        <td>${format.escapeHtml(format.yen(row.expense))}</td>
        <td>${format.escapeHtml(format.yen(row.effectiveFood.effective))}</td>
        <td>${format.escapeHtml(format.yen(row.effectiveFood.budgetDelta))}</td>
        <td class="${statusClass}">${format.escapeHtml(row.effectiveFood.status)}</td>
        <td class="wrap">${format.escapeHtml(comment)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderPageLinks() {
    const maxPage = Math.max(1, Math.ceil(state.txTotal / state.txLimit));
    const start = Math.max(1, state.txPage - 2);
    const end = Math.min(maxPage, start + 4);
    const links = [];
    for (let page = start; page <= end; page += 1) {
      links.push(`<button class="ghost" data-page="${page}" ${page === state.txPage ? 'disabled' : ''}>${page}</button>`);
    }
    const linksEl = global.document.getElementById('pageLinks');
    const infoEl = global.document.getElementById('pageInfo');
    const prevBtn = global.document.getElementById('prevPageBtn');
    const nextBtn = global.document.getElementById('nextPageBtn');
    if (linksEl) linksEl.innerHTML = links.join('');
    if (infoEl) infoEl.textContent = `${state.txPage}/${maxPage} 페이지 · 총 ${state.txTotal}건`;
    if (prevBtn) prevBtn.disabled = state.txPage <= 1;
    if (nextBtn) nextBtn.disabled = state.txPage >= maxPage;
  }

  function renderTransactions(resp) {
    const rows = resp.rows || [];
    state.txRows = rows;
    state.txTotal = Number(resp.total || rows.length);
    applyBalanceHeaders();

    const accounts = store.getBalanceAccounts();
    const tbody = global.document.querySelector('#txTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (rows.length === 0) {
      const tr = global.document.createElement('tr');
      const colspan = 9 + accounts.length;
      tr.innerHTML = `<td colspan="${colspan}" class="muted">선택한 조건의 거래가 없습니다.</td>`;
      tbody.appendChild(tr);
      renderPageLinks();
      return;
    }

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const no = (state.txPage - 1) * state.txLimit + (index + 1);
      const itemText = String(row.item || '');
      const memoText = String(row.memo || '');
      const safeItemText = format.escapeHtml(itemText);
      const safeMemoText = format.escapeHtml(memoText);
      const safeCategory = format.escapeHtml(row.category || '');
      const safePaymentMethod = format.escapeHtml(row.paymentMethod || '');
      const safeDate = format.escapeHtml(format.formatKoreanDate(row.date || ''));
      const safeIncome = row.income ? format.escapeHtml(format.money(row.income, row.currency || 'JPY')) : '';
      const safeExpense = row.expense ? format.escapeHtml(format.money(row.expense, row.currency || 'JPY')) : '';
      const dynamic = accounts.map(account => {
        const rendered = mapBalanceValue(row, account);
        const tone = rendered.startsWith('+') ? 'ok' : (rendered.startsWith('-') ? 'warn' : 'muted');
        return `<td class="${tone}">${rendered}</td>`;
      }).join('');
      const itemClass = itemText.length > 36 ? 'wrap' : 'compact';
      const memoClass = memoText.length > 40 ? 'wrap' : 'compact';
      const tr = global.document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${no}</td>
        <td class="mono">${safeDate}</td>
        <td class="${itemClass}" title="${safeItemText}">${safeItemText}</td>
        <td>${safeCategory}</td>
        <td>${safePaymentMethod}</td>
        <td>${safeIncome}</td>
        <td>${safeExpense}</td>
        ${dynamic}
        <td class="${memoClass}" title="${safeMemoText}">${safeMemoText}</td>
        <td>
          <div class="table-actions">
            <button class="ghost mini" type="button" data-tx-edit="${row.id}">수정</button>
            <button class="ghost mini" type="button" data-tx-delete="${row.id}">삭제</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }

    renderPageLinks();
  }

  function renderUndoBanner() {
    const banner = global.document.getElementById('undoBar');
    const text = global.document.getElementById('undoText');
    if (!banner || !text) return;

    const tx = state.lastDeletedTransaction;
    if (!tx) {
      banner.classList.add('hidden');
      text.textContent = '';
      return;
    }

    banner.classList.remove('hidden');
    text.textContent = `${tx.item || tx.category || '거래'} 삭제됨`;
  }

  function renderTxFormMode() {
    const title = global.document.getElementById('txFormTitle');
    const badge = global.document.getElementById('txEditBadge');
    const submitBtn = global.document.getElementById('addTxBtn');
    const cancelBtn = global.document.getElementById('cancelEditBtn');
    const editing = Number.isFinite(Number(state.editingTransactionId));

    if (title) title.textContent = editing ? '거래 수정' : '거래 입력';
    if (submitBtn) submitBtn.textContent = editing ? '거래 수정 저장' : '거래 저장';
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !editing);
    if (badge) {
      badge.classList.toggle('hidden', !editing);
      badge.textContent = editing ? `편집 중 #${state.editingTransactionId}` : '';
    }
  }

  function renderRecurringTemplates(templates, currentMonth) {
    const dueEl = global.document.getElementById('templateDueList');
    const quickEl = global.document.getElementById('quickTemplateList');
    const hintEl = global.document.getElementById('templateSummaryHint');
    if (!dueEl || !quickEl || !hintEl || typeof tools.detectDueTemplates !== 'function') return;

    const normalized = (Array.isArray(templates) ? templates : [])
      .map(template => (typeof tools.normalizeTemplate === 'function' ? tools.normalizeTemplate(template) : template))
      .filter(template => Number(template.amount || 0) > 0);
    const due = tools.detectDueTemplates(normalized, currentMonth);
    const quick = [...normalized]
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .slice(0, 8);

    hintEl.textContent = `등록 ${normalized.length}개 · 이번 달 반영 필요 ${due.length}개`;

    dueEl.innerHTML = due.length > 0
      ? due.map(template => `
        <div class="template-card due">
          <div>
            <div class="card-title">${format.escapeHtml(template.name)}</div>
            <div class="card-meta">매월 ${template.billingDay}일 · ${format.escapeHtml(template.txType === 'income' ? '수입' : '지출')} · ${format.escapeHtml(format.money(template.amount, template.currency))}</div>
          </div>
          <div class="card-actions">
            <button class="ghost mini" type="button" data-template-fill="${template.id}">폼 채우기</button>
            <button class="mini" type="button" data-template-apply="${template.id}">이번 달 반영</button>
          </div>
        </div>
      `).join('')
      : '<div class="empty-card">이번 달 반영할 반복 거래가 없습니다.</div>';

    quickEl.innerHTML = quick.length > 0
      ? quick.map(template => `
        <div class="template-card">
          <div>
            <div class="card-title">${format.escapeHtml(template.name)}</div>
            <div class="card-meta">${format.escapeHtml(template.category)} · ${format.escapeHtml(template.paymentMethod)} · ${format.escapeHtml(format.money(template.amount, template.currency))}</div>
          </div>
          <div class="card-actions">
            <button class="ghost mini" type="button" data-template-fill="${template.id}">불러오기</button>
          </div>
        </div>
      `).join('')
      : '<div class="empty-card">저장된 템플릿이 없습니다.</div>';
  }

  function renderCategoryBudgets(monthlyRows, categoryBudgets) {
    const tbody = global.document.querySelector('#categoryBudgetTable tbody');
    const hint = global.document.getElementById('categoryBudgetHint');
    if (!tbody || !hint || typeof tools.computeCategoryBudgetRows !== 'function') return;

    const rows = tools.computeCategoryBudgetRows(monthlyRows, categoryBudgets || {});
    if (rows.length === 0) {
      hint.textContent = '카테고리 예산이 아직 없습니다. 자주 쓰는 지출 카테고리부터 등록하세요.';
      tbody.innerHTML = '<tr><td colspan="6" class="muted">등록된 카테고리 예산이 없습니다.</td></tr>';
      return;
    }

    const overCount = rows.filter(row => row.status === 'OVER').length;
    const warnCount = rows.filter(row => row.status === 'WARN').length;
    hint.textContent = `예산 등록 ${rows.length}개 · 초과 ${overCount}개 · 주의 ${warnCount}개`;
    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${format.escapeHtml(row.category)}</td>
        <td>${format.escapeHtml(format.yen(row.monthlyBudget))}</td>
        <td>${format.escapeHtml(format.yen(row.totalBudget))}</td>
        <td>${format.escapeHtml(format.yen(row.spent))}</td>
        <td class="${row.delta < 0 ? 'warn' : 'ok'}">${format.escapeHtml(format.yen(row.delta))}</td>
        <td class="${row.status === 'OVER' ? 'warn' : (row.status === 'WARN' ? 'warn' : 'ok')}">${format.escapeHtml(row.status)}</td>
      </tr>
    `).join('');
  }

  function renderBalanceHealth(accounts, snapshots, rows) {
    const tbody = global.document.querySelector('#balanceHealthTable tbody');
    const hint = global.document.getElementById('balanceHealthHint');
    if (!tbody || !hint || typeof tools.computeBalanceHealth !== 'function') return;

    const report = tools.computeBalanceHealth(accounts, snapshots, rows);
    if (report.length === 0) {
      hint.textContent = '잔고 계좌가 없습니다. 잔고 관리에서 계좌를 먼저 등록하세요.';
      tbody.innerHTML = '<tr><td colspan="7" class="muted">등록된 잔고 계좌가 없습니다.</td></tr>';
      return;
    }

    const checkCount = report.filter(row => row.status === 'CHECK').length;
    const missingCount = report.filter(row => row.status === 'BASELINE_MISSING' || row.status === 'ACTUAL_MISSING').length;
    hint.textContent = `대사 계좌 ${report.length}개 · 확인 필요 ${checkCount}개 · 입력 부족 ${missingCount}개`;
    tbody.innerHTML = report.map(row => {
      const tone = row.status === 'OK' ? 'ok' : 'warn';
      return `
        <tr>
          <td>${format.escapeHtml(row.accountName)}</td>
          <td>${format.escapeHtml(row.baselineDate ? format.formatKoreanDate(row.baselineDate) : '-')}</td>
          <td>${row.baselineBalance == null ? '-' : format.escapeHtml(format.money(row.baselineBalance, row.currency))}</td>
          <td>${row.expectedCurrentBalance == null ? '-' : format.escapeHtml(format.money(row.expectedCurrentBalance, row.currency))}</td>
          <td>${row.currentActualBalance == null ? '-' : format.escapeHtml(format.money(row.currentActualBalance, row.currency))}</td>
          <td class="${row.variance == null ? 'muted' : tone}">${row.variance == null ? '-' : format.escapeHtml(formatSignedMoney(row.variance, row.currency))}</td>
          <td class="${tone}">${format.escapeHtml(`${row.status} · ${row.matchedTransactions}건`)}</td>
        </tr>
      `;
    }).join('');
  }

  App.render = {
    fillSelect,
    ensureDefaultSelection,
    renderTokenState,
    applyBalanceHeaders,
    mapBalanceValue,
    populateMonthOptions,
    computeBudgetMonthCount,
    aggregateAllMonths,
    renderKpi,
    renderAlert,
    setTxFormStatus,
    buildMonthlyComment,
    renderMonthly,
    renderMonthlyStats,
    renderPageLinks,
    renderTransactions,
    renderUndoBanner,
    renderTxFormMode,
    renderRecurringTemplates,
    renderCategoryBudgets,
    renderBalanceHealth,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeBudgetMonthCount,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
