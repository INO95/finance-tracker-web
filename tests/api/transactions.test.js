const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('../helpers/testApp');

test('DELETE /api/finance/transactions returns 405', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const res = await ctx.request({ method: 'DELETE', pathname: '/api/finance/transactions' });
        assert.equal(res.status, 405);
        assert.equal(res.json.error, 'method_not_allowed');
        assert.match(String(res.headers.allow || ''), /GET/);
        assert.match(String(res.headers.allow || ''), /POST/);
    } finally {
        await ctx.cleanup();
    }
});

test('transaction delete, restore, and paginate=false flow works', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const createRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-13',
                item: '복구테스트',
                amount: -1200,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: 'undo',
            },
        });

        const created = createRes.json.transaction;
        const deleteRes = await ctx.request({
            method: 'DELETE',
            pathname: `/api/finance/transactions/${created.id}`,
        });
        assert.equal(deleteRes.status, 200);
        assert.equal(deleteRes.json.transaction.id, created.id);

        const emptyListRes = await ctx.request({
            method: 'GET',
            pathname: '/api/finance/transactions?paginate=false&month=2026-02',
        });
        assert.equal(emptyListRes.status, 200);
        assert.equal(emptyListRes.json.total, 0);
        assert.equal(emptyListRes.json.rows.length, 0);

        const restoreRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions/restore',
            body: deleteRes.json.transaction,
        });
        assert.equal(restoreRes.status, 200);
        assert.equal(restoreRes.json.transaction.id, created.id);

        const restoredListRes = await ctx.request({
            method: 'GET',
            pathname: '/api/finance/transactions?paginate=false&month=2026-02',
        });
        assert.equal(restoredListRes.status, 200);
        assert.equal(restoredListRes.json.total, 1);
        assert.equal(restoredListRes.json.rows[0].item, '복구테스트');
    } finally {
        await ctx.cleanup();
    }
});

test('custom paymentMethod is accepted on POST /transactions', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const createRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-13',
                item: '커스텀 결제수단 테스트',
                amount: -1200,
                category: '식비',
                paymentMethod: '내가추가한카드',
                currency: 'JPY',
                memo: '',
            },
        });

        assert.equal(createRes.status, 200);
        assert.equal(createRes.json.ok, true);
        assert.equal(createRes.json.transaction.paymentMethod, '내가추가한카드');

        const listRes = await ctx.request({ method: 'GET', pathname: '/api/finance/transactions?limit=10&page=1' });
        assert.equal(listRes.status, 200);
        assert.equal(listRes.json.total, 1);
        assert.equal(listRes.json.rows[0].paymentMethod, '내가추가한카드');
    } finally {
        await ctx.cleanup();
    }
});

test('parallel POST 100 transactions keeps all writes and unique IDs', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const requests = Array.from({ length: 100 }, (_, idx) =>
            ctx.request({
                method: 'POST',
                pathname: '/api/finance/transactions',
                body: {
                    date: '2026-02-13',
                    item: `병렬입력-${idx + 1}`,
                    amount: -(idx + 1),
                    category: '식비',
                    paymentMethod: '현금',
                    currency: 'JPY',
                    memo: '',
                },
            }),
        );

        const responses = await Promise.all(requests);
        for (const response of responses) {
            assert.equal(response.status, 200);
            assert.equal(response.json.ok, true);
            assert.ok(Number.isFinite(Number(response.json.transaction.id)));
        }

        const ids = responses.map(response => Number(response.json.transaction.id));
        assert.equal(new Set(ids).size, 100);

        const listRes = await ctx.request({ method: 'GET', pathname: '/api/finance/transactions?limit=100&page=1' });
        assert.equal(listRes.status, 200);
        assert.equal(listRes.json.total, 100);
    } finally {
        await ctx.cleanup();
    }
});
