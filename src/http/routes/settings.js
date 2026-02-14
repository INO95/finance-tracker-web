const { parseJsonBody } = require('../../domain/validation/transaction');

function createSettingsRoutes({
  sendJson,
  sendMethodNotAllowed,
  requireApiAuth,
  loadConfigSafe,
  saveConfigSafe,
  getFoodBudgetYen,
}) {
  return async function handleSettingsRoutes(req, res, url) {
    if (url.pathname !== '/api/finance/settings') {
      return false;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, { foodBudgetYen: await getFoodBudgetYen() });
      return true;
    }

    if (req.method === 'POST') {
      if (!requireApiAuth(req, res)) return true;

      try {
        const body = await parseJsonBody(req);
        const nextBudget = Number(body.foodBudgetYen);
        if (!Number.isFinite(nextBudget) || nextBudget <= 0) {
          sendJson(res, 422, { ok: false, error: 'foodBudgetYen must be positive number' });
          return true;
        }

        const cfg = await loadConfigSafe();
        cfg.financePolicy = cfg.financePolicy || {};
        cfg.financePolicy.realFoodBudgetMonthlyYen = Math.trunc(nextBudget);
        await saveConfigSafe(cfg);

        sendJson(res, 200, { ok: true, foodBudgetYen: cfg.financePolicy.realFoodBudgetMonthlyYen });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }

      return true;
    }

    sendMethodNotAllowed(res, ['GET', 'POST']);
    return true;
  };
}

module.exports = {
  createSettingsRoutes,
};
