const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('../helpers/testApp');

test('write APIs require token when configured', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite', apiToken: 'secret-token' });
    try {
        const unauthorized = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-13',
                item: '무단요청',
                amount: -1000,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
            },
        });
        assert.equal(unauthorized.status, 401);

        const authorized = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            headers: { 'X-Api-Token': 'secret-token' },
            body: {
                date: '2026-02-13',
                item: '인증요청',
                amount: -1200,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
            },
        });
        assert.equal(authorized.status, 200);
        assert.equal(authorized.json.ok, true);
    } finally {
        await ctx.cleanup();
    }
});

test('month format validation and tag payload validation return 422', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const invalidMonthRes = await ctx.request({ method: 'GET', pathname: '/api/finance/summary?month=2026-2' });
        assert.equal(invalidMonthRes.status, 422);
        assert.equal(invalidMonthRes.json.errorCode, 'validation_failed');

        const createRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-13',
                item: '태그검증',
                amount: -100,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
            },
        });

        const id = createRes.json.transaction.id;
        const invalidTagsRes = await ctx.request({
            method: 'POST',
            pathname: `/api/finance/transactions/${id}/tags`,
            body: { add: 'not-array' },
        });
        assert.equal(invalidTagsRes.status, 422);
        assert.equal(invalidTagsRes.json.errorCode, 'validation_failed');
    } finally {
        await ctx.cleanup();
    }
});
