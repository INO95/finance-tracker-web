const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('../helpers/testApp');

test('GET /api/finance/meta returns categories, methods, currencies, and budget', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const res = await ctx.request({ method: 'GET', pathname: '/api/finance/meta' });
        assert.equal(res.status, 200);
        assert.ok(Array.isArray(res.json.currencies));
        assert.ok(Array.isArray(res.json.categories));
        assert.ok(Array.isArray(res.json.paymentMethods));
        assert.equal(typeof res.json.foodBudgetYen, 'number');
        assert.ok(res.json.currencies.includes('JPY'));
    } finally {
        await ctx.cleanup();
    }
});

test('GET /api/finance/usage returns category and method usage counts', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-10',
                item: '점심',
                amount: -1000,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
            },
        });

        await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-11',
                item: '지하철',
                amount: -500,
                category: '교통비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
            },
        });

        const usageRes = await ctx.request({ method: 'GET', pathname: '/api/finance/usage' });
        assert.equal(usageRes.status, 200);
        assert.equal(usageRes.json.categoryUsage['식비'], 1);
        assert.equal(usageRes.json.categoryUsage['교통비'], 1);
        assert.equal(usageRes.json.paymentMethodUsage['현금'], 2);
    } finally {
        await ctx.cleanup();
    }
});
