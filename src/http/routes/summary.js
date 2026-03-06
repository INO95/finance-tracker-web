const {
  filterRowsByMonthScope,
  normalizeTransaction,
  computeEffectiveFood,
  countMonthsFromRange,
  computeMonthlySummary,
  validateMonthScope,
} = require('../../services/summaryService');

function routeParams(url) {
  return {
    month: url.searchParams.get('month') || '',
    fromMonth: url.searchParams.get('fromMonth') || '',
    toMonth: url.searchParams.get('toMonth') || '',
  };
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

async function loadScopedRows(storage, scope) {
  const listResult = await storage.listTransactions({
    ...scope,
    paginate: false,
  });
  const rows = toNormalizedRows(listResult);
  return filterRowsByMonthScope(rows, scope);
}

function createSummaryRoutes({
  storage,
  sendJson,
  sendMethodNotAllowed,
  sendValidationFailed,
  getFoodBudgetYen,
}) {
  return async function handleSummaryRoutes(req, res, url) {
    if (url.pathname === '/api/finance/summary') {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, ['GET']);
        return true;
      }

      const scope = routeParams(url);
      const errors = validateMonthScope(scope);
      if (errors.length) {
        sendValidationFailed(res, errors);
        return true;
      }

      const budgetYen = await getFoodBudgetYen();
      if (typeof storage.getMonthlySummary === 'function' && typeof storage.countTransactions === 'function') {
        const [rowCount, monthly] = await Promise.all([
          storage.countTransactions(scope),
          storage.getMonthlySummary(scope, budgetYen),
        ]);
        sendJson(res, 200, {
          rowCount,
          monthly,
          latestMonth: monthly.length ? monthly[monthly.length - 1] : null,
        });
        return true;
      }

      const scopedRows = await loadScopedRows(storage, scope);
      const monthly = computeMonthlySummary(scopedRows, budgetYen);

      sendJson(res, 200, {
        rowCount: scopedRows.length,
        monthly,
        latestMonth: monthly.length ? monthly[monthly.length - 1] : null,
      });
      return true;
    }

    if (url.pathname === '/api/finance/effective-food') {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, ['GET']);
        return true;
      }

      const scope = routeParams(url);
      const errors = validateMonthScope(scope);
      if (errors.length) {
        sendValidationFailed(res, errors);
        return true;
      }

      if (typeof storage.getEffectiveFoodStats === 'function') {
        const budgetYen = await getFoodBudgetYen();
        sendJson(res, 200, {
          month: scope.month || 'all',
          ...await storage.getEffectiveFoodStats(scope, budgetYen),
        });
        return true;
      }

      const targetRows = await loadScopedRows(storage, scope);
      const budgetYen = await getFoodBudgetYen();

      sendJson(res, 200, {
        month: scope.month || 'all',
        ...computeEffectiveFood(targetRows, budgetYen),
      });
      return true;
    }

    if (url.pathname === '/api/finance/alerts/real-food') {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, ['GET']);
        return true;
      }

      const scope = routeParams(url);
      const errors = validateMonthScope(scope);
      if (errors.length) {
        sendValidationFailed(res, errors);
        return true;
      }

      if (typeof storage.getEffectiveFoodStats === 'function' && typeof storage.getMonthCount === 'function') {
        const baseBudgetYen = await getFoodBudgetYen();
        const monthCount = await storage.getMonthCount(scope);
        const budgetYen = baseBudgetYen * monthCount;
        const food = await storage.getEffectiveFoodStats(scope, budgetYen);
        const ratio = food.budget > 0 ? Math.round((food.effective / food.budget) * 100) : 0;
        const level = food.effective > food.budget
          ? 'danger'
          : (food.effective > food.budget * 0.9 ? 'warn' : 'ok');
        const message = level === 'danger'
          ? '실질 식비가 월 예산을 초과했습니다.'
          : level === 'warn'
            ? '실질 식비가 예산의 90%를 넘었습니다.'
            : '실질 식비가 예산 범위입니다.';

        sendJson(res, 200, {
          month: scope.month || 'all',
          level,
          ratio,
          message,
          monthCount,
          baseBudgetYen,
          ...food,
        });
        return true;
      }

      const targetRows = await loadScopedRows(storage, scope);
      const baseBudgetYen = await getFoodBudgetYen();
      const monthCount = countMonthsFromRange(scope, targetRows);
      const budgetYen = baseBudgetYen * monthCount;
      const food = computeEffectiveFood(targetRows, budgetYen);
      const ratio = food.budget > 0 ? Math.round((food.effective / food.budget) * 100) : 0;
      const level = food.effective > food.budget
        ? 'danger'
        : (food.effective > food.budget * 0.9 ? 'warn' : 'ok');
      const message = level === 'danger'
        ? '실질 식비가 월 예산을 초과했습니다.'
        : level === 'warn'
          ? '실질 식비가 예산의 90%를 넘었습니다.'
          : '실질 식비가 예산 범위입니다.';

      sendJson(res, 200, {
        month: scope.month || 'all',
        level,
        ratio,
        message,
        monthCount,
        baseBudgetYen,
        ...food,
      });
      return true;
    }

    if (url.pathname === '/api/health' || url.pathname === '/health') {
      if (req.method !== 'GET') {
        sendMethodNotAllowed(res, ['GET']);
        return true;
      }

      sendJson(res, 200, { ok: true, timestamp: new Date().toISOString() });
      return true;
    }

    return false;
  };
}

module.exports = {
  createSummaryRoutes,
};
