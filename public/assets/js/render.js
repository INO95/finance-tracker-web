(function initRender(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  const state = App.state;
  const store = App.store;
  const format = App.format;

  function fillSelect(selectId, values, { includeAll = false, allLabel = '전체', formatter = null } = {}) {
    const el = global.document.getElementById(selectId);
    const current = el.value;
    el.innerHTML = '';
    if (includeAll) {
      const all = global.document.createElement('option');
      all.value = '';
      all.textContent = allLabel;
      el.appendChild(all);
    }
    for (const v of values) {
      const opt = global.document.createElement('option');
      opt.value = v;
      opt.textContent = formatter ? formatter(v) : v;
      el.appendChild(opt);
    }
    if (current && [...el.options].some(o => o.value === current)) el.value = current;
  }

  function ensureDefaultSelection(selectId, fallback) {
    const el = global.document.getElementById(selectId);
    if (!el.value && [...el.options].some(o => o.value === fallback)) el.value = fallback;
  }

  function renderTokenState() {
    const token = store.getApiToken();
    global.document.getElementById('tokenState').textContent = token
      ? `토큰 상태: 저장됨 (${token.slice(0, 6)}...)`
      : '토큰 상태: 미설정';
  }

  function applyBalanceHeaders() {
    const accounts = store.getBalanceAccounts();
    const dynamic = accounts.map(a => `<th>${format.escapeHtml(a.name)}</th>`).join('');
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
      </tr>
    `;
    global.document.querySelector('#txTable').innerHTML = `
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
      </colgroup>
      <thead>${theadHtml}</thead>
      <tbody></tbody>
    `;
  }

  function mapBalanceValue(row, account) {
    if (!account) return '-';

    const pick = key => {
      const value = row ? row[key] : undefined;
      if (value == null || value === '') return '-';
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '-';
      return format.escapeHtml(format.money(numeric, account.currency || 'JPY'));
    };

    if (account.source === 'sumitomo') return pick('sumitomo');
    if (account.source === 'rakuten') return pick('rakuten');
    if (account.source === 'cash') return pick('cash');

    return '-';
  }

  function populateMonthOptions(monthly) {
    const current = format.getCurrentMonth();
    const fromData = (monthly || []).map(m => m.month).filter(Boolean);
    const months = [...new Set([current, ...fromData])].sort((a, b) => b.localeCompare(a));

    fillSelect('month', months, { includeAll: true, allLabel: '전체', formatter: format.formatKoreanMonth });
    fillSelect('fromMonth', months, { includeAll: true, allLabel: '시작월', formatter: format.formatKoreanMonth });
    fillSelect('toMonth', months, { includeAll: true, allLabel: '종료월', formatter: format.formatKoreanMonth });

    const selected = global.document.getElementById('month').value;
    if (selected === '' || months.includes(selected)) return;
    global.document.getElementById('month').value = '';
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

    for (const m of monthly || []) {
      acc.income += Number(m.income || 0);
      acc.expense += Number(m.expense || 0);
      acc.effectiveFood.effective += Number(m.effectiveFood?.effective || 0);
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
    ]
      .map(([k, v]) => `<div class="kpi"><div class="label">${format.escapeHtml(k)}</div><div class="value">${format.escapeHtml(v)}</div></div>`)
      .join('');

    foodEl.innerHTML = [
      ['실질 식비(JPY)', format.yen(food.effective)],
      ['식비 예산(JPY)', format.yen(food.budget)],
      ['예산 대비', `${format.yen(food.budgetDelta)} (${food.status || 'OK'})`],
    ]
      .map(([k, v]) => `<div class="kpi"><div class="label">${format.escapeHtml(k)}</div><div class="value">${format.escapeHtml(v)}</div></div>`)
      .join('');
  }

  function renderAlert(alert) {
    const el = global.document.getElementById('alertBox');
    if (!alert) {
      el.textContent = '알림 정보 없음';
      return;
    }

    const level = alert.level === 'danger' ? 'warn' : (alert.level === 'warn' ? 'warn' : 'ok');
    el.className = level;
    el.textContent = `[식비 알림] ${alert.message} (${alert.ratio}%)`;
  }

  function setTxFormStatus(message, tone = 'muted') {
    const el = global.document.getElementById('txFormStatus');
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
    if (!rows || rows.length === 0) {
      el.textContent = '월별 데이터 없음';
      return;
    }

    const monthCount = rows.length;
    const avgIncome = rows.reduce((a, r) => a + Number(r.income || 0), 0) / monthCount;
    const avgExpense = rows.reduce((a, r) => a + Number(r.expense || 0), 0) / monthCount;
    const overFood = rows.filter(r => String(r.effectiveFood?.status || '') === 'OVER').length;
    el.textContent = `평균 수입 ${format.yen(avgIncome)} · 평균 지출 ${format.yen(avgExpense)} · 식비 예산 초과 ${overFood}/${monthCount}개월`;
  }

  function renderMonthly(monthly, scope) {
    const tbody = global.document.querySelector('#monthlyTable tbody');
    tbody.innerHTML = '';

    let rows = [...monthly];
    if (scope.scopeMode === 'single' && scope.month) rows = rows.filter(r => r.month === scope.month);
    if (scope.scopeMode === 'range') {
      rows = rows.filter(r => {
        const n = format.monthToNumber(r.month);
        const f = format.monthToNumber(scope.fromMonth);
        const t = format.monthToNumber(scope.toMonth);
        if (n == null) return false;
        if (f != null && n < f) return false;
        if (t != null && n > t) return false;
        return true;
      });
    }

    const sortMode = global.document.getElementById('monthlySort').value;
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

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const prev = rows[i + 1] || null;
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
    const links = [];
    const start = Math.max(1, state.txPage - 2);
    const end = Math.min(maxPage, start + 4);
    for (let p = start; p <= end; p += 1) {
      links.push(`<button class="ghost" data-page="${p}" ${p === state.txPage ? 'disabled' : ''}>${p}</button>`);
    }
    global.document.getElementById('pageLinks').innerHTML = links.join('');
    global.document.getElementById('pageInfo').textContent = `${state.txPage}/${maxPage} 페이지 · 총 ${state.txTotal}건`;
    global.document.getElementById('prevPageBtn').disabled = state.txPage <= 1;
    global.document.getElementById('nextPageBtn').disabled = state.txPage >= maxPage;
  }

  function renderTransactions(resp) {
    const rows = resp.rows || [];
    state.txTotal = Number(resp.total || rows.length);

    const accounts = store.getBalanceAccounts();
    applyBalanceHeaders();

    const tbody = global.document.querySelector('#txTable tbody');
    tbody.innerHTML = '';

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const no = (state.txPage - 1) * state.txLimit + (i + 1);
      const dynamic = accounts.map(acc => `<td>${mapBalanceValue(row, acc)}</td>`).join('');
      const itemText = String(row.item || '');
      const memoText = String(row.memo || '');
      const safeItemText = format.escapeHtml(itemText);
      const safeMemoText = format.escapeHtml(memoText);
      const safeCategory = format.escapeHtml(row.category || '');
      const safePaymentMethod = format.escapeHtml(row.paymentMethod || '');
      const safeDate = format.escapeHtml(format.formatKoreanDate(row.date || ''));
      const safeIncome = row.income ? format.escapeHtml(format.money(row.income, row.currency || 'JPY')) : '';
      const safeExpense = row.expense ? format.escapeHtml(format.money(row.expense, row.currency || 'JPY')) : '';
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
      `;
      tbody.appendChild(tr);
    }

    renderPageLinks();
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
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeBudgetMonthCount,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
