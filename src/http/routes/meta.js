function createMetaRoutes({ sendJson, sendMethodNotAllowed, loadConfigSafe, getFoodBudgetYen }) {
  return async function handleMetaRoutes(req, res, url) {
    if (url.pathname !== '/api/finance/meta') {
      return false;
    }

    if (req.method !== 'GET') {
      sendMethodNotAllowed(res, ['GET']);
      return true;
    }

    const categories = new Set(['식비', '교통비', '월세', '통신비', '교육', '건강', '생활', '취미', '기타']);
    const paymentMethods = new Set(['현금', '스미토모', '라쿠텐', '올리브 카드 (데빗)', '올리브 카드 (크레짓)', '아마존 카드']);
    const cfg = await loadConfigSafe();
    for (const key of Object.keys(cfg.categories || {})) categories.add(String(key));
    for (const key of Object.keys(cfg.paymentMethods || {})) paymentMethods.add(String(key));

    sendJson(res, 200, {
      currencies: ['JPY', 'KRW', 'USD'],
      categories: [...categories],
      paymentMethods: [...paymentMethods],
      foodBudgetYen: await getFoodBudgetYen(),
      categoryBudgets: cfg?.financePolicy?.categoryBudgets || {},
    });
    return true;
  };
}

module.exports = {
  createMetaRoutes,
};
