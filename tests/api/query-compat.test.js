const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('../helpers/testApp');

const SEED_TRANSACTIONS = [
    { date: '2026-01-05', item: '월급', amount: 400000, category: '급여', paymentMethod: '스미토모', memo: '정기 급여', currency: 'JPY' },
    { date: '2026-01-09', item: '마트 장보기', amount: -4200, category: '식비', paymentMethod: '현금', memo: '현금 결제', currency: 'JPY' },
    { date: '2026-01-20', item: '교통비', amount: -1800, category: '교통', paymentMethod: '현금', memo: '지하철 충전', currency: 'JPY' },
    { date: '2026-02-01', item: '점심', amount: -950, category: '식비', paymentMethod: '현금', memo: '회사 근처 식당', currency: 'JPY' },
    { date: '2026-02-04', item: '간식', amount: -550, category: '식비', paymentMethod: '현금', memo: '마트 할인', currency: 'JPY' },
    { date: '2026-02-15', item: '도서 구입', amount: -2200, category: '기타', paymentMethod: '스미토모', memo: '업무 참고서', currency: 'JPY' },
    { date: '2026-03-03', item: '외식', amount: -3600, category: '식비', paymentMethod: '현금', memo: '주말 외식', currency: 'JPY' },
    { date: '2026-03-18', item: '부수입', amount: 80000, category: '부수입', paymentMethod: '스미토모', memo: '프리랜서 정산', currency: 'JPY' },
];

const QUERY_CASES = [
    { month: '2026-02', page: '1', limit: '3', sort: 'date_desc' },
    { month: '2026-02', fromMonth: '2026-01', toMonth: '2026-03', page: '1', limit: '10', sort: 'date_asc' },
    { fromMonth: '2026-01', toMonth: '2026-03', category: '식비', page: '1', limit: '2', sort: 'expense_desc' },
    { fromMonth: '2026-01', toMonth: '2026-03', category: '식비', page: '2', limit: '2', sort: 'expense_desc' },
    { q: '마트', page: '1', limit: '10', sort: 'date_desc' },
    { memo: '현금', page: '1', limit: '10', sort: 'expense_asc' },
];

function normalizeRow(row) {
    return {
        date: String(row.date || ''),
        item: String(row.item || ''),
        amount: Number(row.amount || 0),
        category: String(row.category || ''),
        paymentMethod: String(row.paymentMethod || ''),
        memo: String(row.memo || ''),
        currency: String(row.currency || ''),
        tags: Array.isArray(row.tags) ? [...row.tags] : [],
    };
}

function normalizeListResponse(res) {
    return {
        status: res.status,
        total: Number(res.json.total || 0),
        page: Number(res.json.page || 0),
        limit: Number(res.json.limit || 0),
        rows: Array.isArray(res.json.rows) ? res.json.rows.map(normalizeRow) : [],
    };
}

async function seedTransactions(ctx) {
    for (const tx of SEED_TRANSACTIONS) {
        await ctx.app.storage.createTransaction({ ...tx, tags: [] });
    }
}

function buildTransactionsPath(queryParams) {
    const search = new URLSearchParams(queryParams).toString();
    return `/api/finance/transactions?${search}`;
}

test('transaction query combinations stay consistent between sqlite and json repository', async () => {
    const sqliteCtx = await createTestApp({ storageDriver: 'sqlite' });
    const jsonCtx = await createTestApp({ storageDriver: 'json' });

    try {
        await Promise.all([seedTransactions(sqliteCtx), seedTransactions(jsonCtx)]);

        for (const queryParams of QUERY_CASES) {
            const pathname = buildTransactionsPath(queryParams);
            const [sqliteRes, jsonRes] = await Promise.all([
                sqliteCtx.request({ method: 'GET', pathname }),
                jsonCtx.request({ method: 'GET', pathname }),
            ]);

            assert.equal(sqliteRes.status, 200, `sqlite request failed: ${pathname}`);
            assert.equal(jsonRes.status, 200, `json request failed: ${pathname}`);
            assert.deepEqual(normalizeListResponse(sqliteRes), normalizeListResponse(jsonRes), pathname);
        }
    } finally {
        await Promise.all([sqliteCtx.cleanup(), jsonCtx.cleanup()]);
    }
});
