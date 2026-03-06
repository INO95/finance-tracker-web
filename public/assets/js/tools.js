(function initTools(global) {
  const App = global.FinanceApp = global.FinanceApp || {};

  function clampDayOfMonth(value) {
    const day = Number(value);
    if (!Number.isFinite(day)) return 1;
    return Math.min(28, Math.max(1, Math.trunc(day)));
  }

  function toIsoDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const direct = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (direct) {
      const year = Number(direct[1]);
      const month = Number(direct[2]);
      const day = Number(direct[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) return '';
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const us = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (us) {
      const month = Number(us[1]);
      const day = Number(us[2]);
      const year = Number(us[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) return '';
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return '';
  }

  function normalizeTemplate(input = {}) {
    const amount = Math.abs(Number(input.amount || 0));
    const recurrence = String(input.recurrence || 'none') === 'monthly' ? 'monthly' : 'none';
    const txType = String(input.txType || 'expense') === 'income' ? 'income' : 'expense';
    const category = String(input.category || '기타').trim() || '기타';
    const paymentMethod = String(input.paymentMethod || '현금').trim() || '현금';
    const currency = String(input.currency || 'JPY').trim().toUpperCase() || 'JPY';
    const item = String(input.item || category).trim() || category;

    return {
      id: String(input.id || `tpl_${Date.now()}`),
      name: String(input.name || item).trim() || item,
      item,
      category,
      paymentMethod,
      currency,
      memo: String(input.memo || '').trim(),
      amount: Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : 0,
      txType,
      recurrence,
      billingDay: clampDayOfMonth(input.billingDay || 1),
      lastAppliedMonth: String(input.lastAppliedMonth || '').trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  function detectDueTemplates(templates, currentMonth) {
    return (Array.isArray(templates) ? templates : [])
      .map(normalizeTemplate)
      .filter(template => template.recurrence === 'monthly' && template.amount > 0)
      .filter(template => !template.lastAppliedMonth || template.lastAppliedMonth < currentMonth)
      .sort((a, b) => a.billingDay - b.billingDay || a.name.localeCompare(b.name));
  }

  function buildTransactionFromTemplate(template, baseDate = new Date()) {
    const normalized = normalizeTemplate(template);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + 1;
    const day = normalized.recurrence === 'monthly'
      ? clampDayOfMonth(normalized.billingDay)
      : baseDate.getDate();
    const amount = normalized.txType === 'income' ? normalized.amount : -normalized.amount;

    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      item: normalized.item,
      amount,
      category: normalized.category,
      paymentMethod: normalized.paymentMethod,
      currency: normalized.currency,
      memo: normalized.memo,
    };
  }

  function markTemplateApplied(templates, templateId, currentMonth) {
    return (Array.isArray(templates) ? templates : []).map(template => {
      if (String(template.id) !== String(templateId)) return template;
      return {
        ...template,
        lastAppliedMonth: currentMonth,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function detectDelimiter(text) {
    const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
    const counts = [
      { delimiter: ',', count: (firstLine.match(/,/g) || []).length },
      { delimiter: ';', count: (firstLine.match(/;/g) || []).length },
      { delimiter: '\t', count: (firstLine.match(/\t/g) || []).length },
    ];
    counts.sort((a, b) => b.count - a.count);
    return counts[0].count > 0 ? counts[0].delimiter : ',';
  }

  function parseCsvRow(line, delimiter) {
    const out = [];
    let current = '';
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          current += ch;
        }
        continue;
      }

      if (ch === '"') {
        quoted = true;
        continue;
      }

      if (ch === delimiter) {
        out.push(current);
        current = '';
        continue;
      }

      current += ch;
    }

    out.push(current);
    return out;
  }

  function parseCsvText(text, delimiter = detectDelimiter(text)) {
    const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').filter(line => line.trim() !== '');
    return lines.map(line => parseCsvRow(line, delimiter));
  }

  function normalizeHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function parseCsvAmount(raw) {
    const text = String(raw == null ? '' : raw).trim();
    if (!text) return NaN;
    const negative = text.startsWith('-') || (text.startsWith('(') && text.endsWith(')'));
    const digits = text.replace(/[^\d.]/g, '');
    if (!digits) return NaN;
    const amount = Number(digits);
    if (!Number.isFinite(amount) || amount <= 0) return NaN;
    return negative ? -Math.trunc(amount) : Math.trunc(amount);
  }

  function headerIndex(headers, aliases) {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function mapCsvRowsToTransactions(text, defaults = {}) {
    const rows = parseCsvText(text);
    if (rows.length === 0) return { entries: [], errors: ['CSV 내용이 비어 있습니다.'], headers: [] };

    const headers = rows[0].map(normalizeHeader);
    const idxDate = headerIndex(headers, ['date', '날짜', 'transactiondate', 'posteddate']);
    const idxItem = headerIndex(headers, ['item', '내용', 'description', 'merchant', 'title']);
    const idxAmount = headerIndex(headers, ['amount', '금액', 'value']);
    const idxIncome = headerIndex(headers, ['income', '수입']);
    const idxExpense = headerIndex(headers, ['expense', '지출', 'withdrawal']);
    const idxCategory = headerIndex(headers, ['category', '카테고리']);
    const idxMethod = headerIndex(headers, ['paymentmethod', '결제수단', 'method', 'account']);
    const idxCurrency = headerIndex(headers, ['currency', '통화']);
    const idxMemo = headerIndex(headers, ['memo', '메모', 'note', 'notes']);

    const entries = [];
    const errors = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const date = idxDate >= 0 ? toIsoDate(row[idxDate]) : '';
      let amount = idxAmount >= 0 ? parseCsvAmount(row[idxAmount]) : NaN;
      if (!Number.isFinite(amount)) {
        const income = idxIncome >= 0 ? parseCsvAmount(row[idxIncome]) : NaN;
        const expense = idxExpense >= 0 ? parseCsvAmount(row[idxExpense]) : NaN;
        if (Number.isFinite(income) && income > 0) amount = Math.abs(income);
        else if (Number.isFinite(expense) && expense !== 0) amount = -Math.abs(expense);
      }

      if (!date) {
        errors.push(`${rowIndex + 1}행: 날짜를 해석할 수 없습니다.`);
        continue;
      }
      if (!Number.isFinite(amount) || amount === 0) {
        errors.push(`${rowIndex + 1}행: 금액을 해석할 수 없습니다.`);
        continue;
      }

      const category = String(idxCategory >= 0 ? row[idxCategory] : defaults.category || '기타').trim() || '기타';
      const paymentMethod = String(idxMethod >= 0 ? row[idxMethod] : defaults.paymentMethod || '현금').trim() || '현금';
      const currency = String(idxCurrency >= 0 ? row[idxCurrency] : defaults.currency || 'JPY').trim().toUpperCase() || 'JPY';
      const item = String(idxItem >= 0 ? row[idxItem] : '').trim() || category;
      const memo = String(idxMemo >= 0 ? row[idxMemo] : defaults.memo || '').trim();

      entries.push({
        date,
        item,
        amount,
        category,
        paymentMethod,
        currency,
        memo,
      });
    }

    return { entries, errors, headers };
  }

  function computeCategoryBudgetRows(monthlyRows, categoryBudgets) {
    const monthly = Array.isArray(monthlyRows) ? monthlyRows : [];
    const budgets = categoryBudgets && typeof categoryBudgets === 'object' ? categoryBudgets : {};
    const monthCount = Math.max(1, monthly.length);
    const spentByCategory = {};

    for (const month of monthly) {
      const byCategory = month && typeof month.byCategory === 'object' ? month.byCategory : {};
      for (const [category, amount] of Object.entries(byCategory)) {
        spentByCategory[category] = Number(spentByCategory[category] || 0) + Number(amount || 0);
      }
    }

    return Object.entries(budgets)
      .map(([category, budget]) => {
        const monthlyBudget = Math.max(0, Math.trunc(Number(budget || 0)));
        const totalBudget = monthlyBudget * monthCount;
        const spent = Number(spentByCategory[category] || 0);
        const delta = totalBudget - spent;
        return {
          category,
          monthlyBudget,
          totalBudget,
          spent,
          delta,
          monthCount,
          status: spent > totalBudget ? 'OVER' : (spent > totalBudget * 0.9 ? 'WARN' : 'OK'),
        };
      })
      .sort((a, b) => {
        const rank = { OVER: 0, WARN: 1, OK: 2 };
        return (rank[a.status] - rank[b.status]) || (b.spent - a.spent) || a.category.localeCompare(b.category);
      });
  }

  function methodMatchesSource(paymentMethod, source) {
    const method = String(paymentMethod || '').trim();
    if (!method || !source || source === 'none') return false;
    if (source === 'sumitomo') return /스미토모/i.test(method);
    if (source === 'rakuten') return /라쿠텐/i.test(method);
    if (source === 'cash') return /현금/i.test(method);
    return method.toLowerCase() === String(source).toLowerCase();
  }

  function accountDeltaForRow(row, account) {
    if (!row || !account) return null;
    if (String(row.currency || '') !== String(account.currency || '')) return null;
    if (!methodMatchesSource(row.paymentMethod, account.source)) return null;
    return Number(row.income || 0) - Number(row.expense || 0);
  }

  function computeBalanceHealth(accounts, snapshots, rows) {
    const list = Array.isArray(accounts) ? accounts : [];
    const txRows = Array.isArray(rows) ? rows : [];
    const snapshotMap = snapshots && typeof snapshots === 'object' ? snapshots : {};

    return list.map(account => {
      const snapshot = snapshotMap[account.id] || {};
      const baselineBalance = Number(snapshot.baselineBalance);
      const currentActualBalance = Number(snapshot.currentActualBalance);
      const baselineDate = toIsoDate(snapshot.baselineDate);
      let netChange = 0;
      let matchedTransactions = 0;

      for (const row of txRows) {
        if (baselineDate && String(row.date || '') <= baselineDate) continue;
        const delta = accountDeltaForRow(row, account);
        if (!Number.isFinite(delta)) continue;
        netChange += delta;
        matchedTransactions += 1;
      }

      const hasBaseline = Number.isFinite(baselineBalance);
      const expectedCurrentBalance = hasBaseline ? baselineBalance + netChange : null;
      const hasActual = Number.isFinite(currentActualBalance);
      const variance = hasBaseline && hasActual ? currentActualBalance - expectedCurrentBalance : null;

      return {
        accountId: account.id,
        accountName: account.name,
        currency: account.currency,
        baselineDate,
        baselineBalance: hasBaseline ? baselineBalance : null,
        currentActualBalance: hasActual ? currentActualBalance : null,
        expectedCurrentBalance,
        netChange,
        matchedTransactions,
        variance,
        status: !hasBaseline ? 'BASELINE_MISSING' : (!hasActual ? 'ACTUAL_MISSING' : (Math.abs(variance) > 0 ? 'CHECK' : 'OK')),
      };
    });
  }

  App.tools = {
    normalizeTemplate,
    detectDueTemplates,
    buildTransactionFromTemplate,
    markTemplateApplied,
    detectDelimiter,
    parseCsvText,
    mapCsvRowsToTransactions,
    computeCategoryBudgetRows,
    methodMatchesSource,
    accountDeltaForRow,
    computeBalanceHealth,
    toIsoDate,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = App.tools;
  }
})(typeof window !== 'undefined' ? window : globalThis);
