function createResponseHelpers({ corsOrigin }) {
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': corsOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Token',
  };

  function sendJson(res, status, payload, extraHeaders = {}) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS, ...extraHeaders });
    res.end(JSON.stringify(payload, null, 2));
  }

  function sendText(res, status, payload, extraHeaders = {}) {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
    res.end(payload);
  }

  function sendMethodNotAllowed(res, allowedMethods, { api = true } = {}) {
    const allow = [...allowedMethods].join(', ');
    if (api) {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed', allow: allowedMethods }, { Allow: allow });
    } else {
      sendText(res, 405, 'Method not allowed', { Allow: allow });
    }
  }

  return {
    CORS_HEADERS,
    sendJson,
    sendText,
    sendMethodNotAllowed,
  };
}

module.exports = {
  createResponseHelpers,
};
