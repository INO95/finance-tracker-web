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
      const cfg = await loadConfigSafe();
      sendJson(res, 200, {
        foodBudgetYen: await getFoodBudgetYen(),
        categoryBudgets: cfg?.financePolicy?.categoryBudgets || {},
      });
      return true;
    }

    if (req.method === 'POST') {
      if (!requireApiAuth(req, res)) return true;

      try {
        const body = await parseJsonBody(req);
        const hasFoodBudget = Object.prototype.hasOwnProperty.call(body, 'foodBudgetYen');
        const hasCategoryBudgets = Object.prototype.hasOwnProperty.call(body, 'categoryBudgets');
        if (!hasFoodBudget && !hasCategoryBudgets) {
          sendJson(res, 422, { ok: false, error: 'no settings payload provided' });
          return true;
        }

        const cfg = await loadConfigSafe();
        cfg.financePolicy = cfg.financePolicy || {};

        if (hasFoodBudget) {
          const nextBudget = Number(body.foodBudgetYen);
          if (!Number.isFinite(nextBudget) || nextBudget <= 0) {
            sendJson(res, 422, { ok: false, error: 'foodBudgetYen must be positive number' });
            return true;
          }
          cfg.financePolicy.realFoodBudgetMonthlyYen = Math.trunc(nextBudget);
        }

        if (hasCategoryBudgets) {
          if (!body.categoryBudgets || typeof body.categoryBudgets !== 'object' || Array.isArray(body.categoryBudgets)) {
            sendJson(res, 422, { ok: false, error: 'categoryBudgets must be object' });
            return true;
          }

          const nextCategoryBudgets = {};
          for (const [category, rawValue] of Object.entries(body.categoryBudgets)) {
            const key = String(category || '').trim().slice(0, 80);
            const amount = Number(rawValue);
            if (!key) continue;
            if (!Number.isFinite(amount) || amount < 0) {
              sendJson(res, 422, { ok: false, error: `category budget must be non-negative number: ${key}` });
              return true;
            }
            if (amount === 0) continue;
            nextCategoryBudgets[key] = Math.trunc(amount);
          }
          cfg.financePolicy.categoryBudgets = nextCategoryBudgets;
        }
        await saveConfigSafe(cfg);

        sendJson(res, 200, {
          ok: true,
          foodBudgetYen: cfg.financePolicy.realFoodBudgetMonthlyYen,
          categoryBudgets: cfg.financePolicy.categoryBudgets || {},
        });
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
