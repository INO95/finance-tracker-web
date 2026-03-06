const {
  filterRowsByMonthScope,
  normalizeTransaction,
  computeUsageStats,
  validateMonthScope,
} = require('../../services/summaryService');
const {
  cleanText,
  validateTransactionInput,
  coercePositiveInt,
  parseJsonBody,
  sanitizeTransactionBody,
  sanitizeTransactionPatch,
} = require('../../domain/validation/transaction');

function routeParams(url) {
  return {
    month: url.searchParams.get('month') || '',
    fromMonth: url.searchParams.get('fromMonth') || '',
    toMonth: url.searchParams.get('toMonth') || '',
  };
}

function sortRowsInMemory(rows, sort) {
  rows.sort((a, b) => {
    const da = String(a.date || '');
    const dbDate = String(b.date || '');
    if (sort === 'date_asc') return da.localeCompare(dbDate);
    if (sort === 'expense_desc') return Number(b.expense || 0) - Number(a.expense || 0);
    if (sort === 'expense_asc') return Number(a.expense || 0) - Number(b.expense || 0);
    return dbDate.localeCompare(da);
  });
}

function applyInMemoryQuery(rows, query) {
  let out = filterRowsByMonthScope(rows, query);
  if (query.category) out = out.filter(row => String(row.category) === query.category);
  if (query.memo) {
    const lowerMemo = query.memo.toLowerCase();
    out = out.filter(row => String(row.memo || '').toLowerCase().includes(lowerMemo));
  }
  if (query.q) {
    const lowerQ = query.q.toLowerCase();
    out = out.filter(row =>
      [row.item, row.memo, row.paymentMethod, row.category]
        .map(v => String(v || '').toLowerCase())
        .some(v => v.includes(lowerQ)));
  }

  sortRowsInMemory(out, query.sort);

  const total = out.length;
  const start = (query.page - 1) * query.limit;
  const paged = out.slice(start, start + query.limit);
  return { total, rows: paged };
}

function toNormalizedRows(storageResult) {
  if (storageResult && Array.isArray(storageResult.rows)) {
    return storageResult.rows.map(normalizeTransaction);
  }
  if (Array.isArray(storageResult)) {
    return storageResult.map(normalizeTransaction);
  }
  return [];
}

function createTransactionsRoutes({
  storage,
  sendJson,
  sendMethodNotAllowed,
  requireApiAuth,
  sendValidationFailed,
}) {
  return async function handleTransactionsRoute(req, res, url) {
    const transactionPathMatch = url.pathname.match(/^\/api\/finance\/transactions\/([^/]+)$/);
    const transactionTagsPathMatch = url.pathname.match(/^\/api\/finance\/transactions\/([^/]+)\/tags$/);

    if (url.pathname === '/api/finance/transactions') {
      if (req.method === 'POST') {
        if (!requireApiAuth(req, res)) return true;

        try {
          const body = await parseJsonBody(req);
          const errors = validateTransactionInput(body, { partial: false });
          if (errors.length) {
            sendValidationFailed(res, errors);
            return true;
          }

          const tx = await storage.createTransaction(sanitizeTransactionBody(body));
          sendJson(res, 200, { ok: true, transaction: tx });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
        }

        return true;
      }

      if (req.method === 'GET') {
        const scope = routeParams(url);
        const errors = validateMonthScope(scope);
        if (errors.length) {
          sendValidationFailed(res, errors);
          return true;
        }

        const query = {
          ...scope,
          category: url.searchParams.get('category') || '',
          q: url.searchParams.get('q') || '',
          memo: url.searchParams.get('memo') || '',
          limit: coercePositiveInt(url.searchParams.get('limit') || 100, 100, { min: 1, max: 100 }),
          page: coercePositiveInt(url.searchParams.get('page') || 1, 1, { min: 1, max: 1000000 }),
          sort: String(url.searchParams.get('sort') || 'date_desc'),
        };

        const storageResult = await storage.listTransactions(query);

        if (storageResult && Array.isArray(storageResult.rows)) {
          const rows = toNormalizedRows(storageResult);
          sendJson(res, 200, {
            total: Number(storageResult.total || rows.length),
            page: query.page,
            limit: query.limit,
            rows,
          });
          return true;
        }

        const normalized = toNormalizedRows(storageResult);
        const output = applyInMemoryQuery(normalized, query);
        sendJson(res, 200, {
          total: output.total,
          page: query.page,
          limit: query.limit,
          rows: output.rows,
        });
        return true;
      }

      sendMethodNotAllowed(res, ['GET', 'POST']);
      return true;
    }

    if (transactionPathMatch) {
      if (req.method !== 'PATCH') {
        sendMethodNotAllowed(res, ['PATCH']);
        return true;
      }

      if (!requireApiAuth(req, res)) return true;
      const id = Number(transactionPathMatch[1]);
      if (!Number.isFinite(id)) {
        sendJson(res, 400, { ok: false, error: 'invalid id' });
        return true;
      }

      try {
        const body = await parseJsonBody(req);
        const errors = validateTransactionInput(body, { partial: true });
        if (errors.length) {
          sendValidationFailed(res, errors);
          return true;
        }

        const tx = await storage.updateTransaction(id, sanitizeTransactionPatch(body));
        if (!tx) {
          sendJson(res, 404, { ok: false, error: 'transaction not found' });
          return true;
        }

        sendJson(res, 200, { ok: true, transaction: tx });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }

      return true;
    }

    if (transactionTagsPathMatch) {
      if (req.method !== 'POST') {
        sendMethodNotAllowed(res, ['POST']);
        return true;
      }

      if (!requireApiAuth(req, res)) return true;
      const id = Number(transactionTagsPathMatch[1]);
      if (!Number.isFinite(id)) {
        sendJson(res, 400, { ok: false, error: 'invalid id' });
        return true;
      }

      try {
        const body = await parseJsonBody(req);
        if ((body.add && !Array.isArray(body.add)) || (body.remove && !Array.isArray(body.remove))) {
          sendValidationFailed(res, ['add/remove must be arrays']);
          return true;
        }

        const add = Array.isArray(body.add) ? body.add.map(v => cleanText(v, 40)).filter(Boolean) : [];
        const remove = Array.isArray(body.remove) ? body.remove.map(v => cleanText(v, 40)).filter(Boolean) : [];
        const tx = await storage.updateTransactionTags(id, { add, remove });
        if (!tx) {
          sendJson(res, 404, { ok: false, error: 'transaction not found' });
          return true;
        }

        sendJson(res, 200, { ok: true, tags: tx.tags, id });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }

      return true;
    }

    if (url.pathname === '/api/finance/usage') {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, ['GET']);
        return true;
      }

      if (typeof storage.getUsageStats === 'function') {
        sendJson(res, 200, await storage.getUsageStats());
        return true;
      }

      const listResult = await storage.listTransactions();
      const usage = computeUsageStats(toNormalizedRows(listResult));
      sendJson(res, 200, usage);
      return true;
    }

    return false;
  };
}

module.exports = {
  createTransactionsRoutes,
  routeParams,
  sortRowsInMemory,
  applyInMemoryQuery,
};
