const fs = require('fs');
const path = require('path');
const { createResponseHelpers } = require('./response');
const { createTransactionsRoutes } = require('./routes/transactions');
const { createSummaryRoutes } = require('./routes/summary');
const { createMetaRoutes } = require('./routes/meta');
const { createSettingsRoutes } = require('./routes/settings');
const { createStaticRoutes } = require('./routes/static');
const {
  toKoreanValidationMessage,
  validateTransactionInput,
} = require('../domain/validation/transaction');

const DEFAULT_BUDGET_YEN = 60000;

function createRouter({
  storage,
  configPath,
  staticDir,
  corsOrigin,
  requiredApiToken,
}) {
  const {
    CORS_HEADERS,
    sendJson,
    sendText,
    sendMethodNotAllowed,
  } = createResponseHelpers({ corsOrigin });

  async function loadConfigSafe() {
    try {
      return JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  async function saveConfigSafe(cfg) {
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(cfg, null, 4), 'utf8');
    await fs.promises.rename(tmpPath, configPath);
  }

  async function getFoodBudgetYen() {
    const cfg = await loadConfigSafe();
    const n = Number(cfg?.financePolicy?.realFoodBudgetMonthlyYen);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
    return DEFAULT_BUDGET_YEN;
  }

  function requireApiAuth(req, res) {
    const required = String(requiredApiToken || '').trim();
    if (!required) return true;

    const got = String(req.headers['x-api-token'] || '').trim();
    if (got === required) return true;

    sendJson(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }

  function sendValidationFailed(res, errors) {
    sendJson(res, 422, {
      ok: false,
      error: toKoreanValidationMessage(errors),
      details: errors,
      errorCode: 'validation_failed',
    });
  }

  const routeHandlers = [
    createTransactionsRoutes({
      storage,
      sendJson,
      sendMethodNotAllowed,
      requireApiAuth,
      sendValidationFailed,
    }),
    createMetaRoutes({
      sendJson,
      sendMethodNotAllowed,
      loadConfigSafe,
      getFoodBudgetYen,
    }),
    createSettingsRoutes({
      sendJson,
      sendMethodNotAllowed,
      requireApiAuth,
      loadConfigSafe,
      saveConfigSafe,
      getFoodBudgetYen,
    }),
    createSummaryRoutes({
      storage,
      sendJson,
      sendMethodNotAllowed,
      sendValidationFailed,
      getFoodBudgetYen,
    }),
    createStaticRoutes({
      staticDir,
      sendText,
      sendMethodNotAllowed,
    }),
  ];

  return async function route(req, res) {
    const host = req.headers.host || '127.0.0.1';
    const url = new URL(req.url, `http://${host}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    for (const handle of routeHandlers) {
      if (await handle(req, res, url)) return;
    }

    sendText(res, 404, 'Not found');
  };
}

module.exports = {
  createRouter,
  validateTransactionInput,
  toKoreanValidationMessage,
};
