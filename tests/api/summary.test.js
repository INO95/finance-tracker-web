const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { createTestApp } = require('../helpers/testApp');
const runExecFile = promisify(execFile);

test('fromMonth > toMonth returns 422 validation_failed', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const res = await ctx.request({
            method: 'GET',
            pathname: '/api/finance/summary?fromMonth=2026-03&toMonth=2026-01',
        });

        assert.equal(res.status, 422);
        assert.equal(res.json.ok, false);
        assert.equal(res.json.errorCode, 'validation_failed');
        assert.ok(Array.isArray(res.json.details));
        assert.ok(res.json.details.includes('fromMonth cannot be greater than toMonth'));
    } finally {
        await ctx.cleanup();
    }
});

test('summary/alerts/settings/health smoke flow', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const createRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-10',
                item: '월급',
                amount: 300000,
                category: '급여',
                paymentMethod: '스미토모',
                currency: 'JPY',
                memo: '',
            },
        });
        assert.equal(createRes.status, 200);

        const expenseRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/transactions',
            body: {
                date: '2026-02-11',
                item: '점심',
                amount: -1200,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
            },
        });
        assert.equal(expenseRes.status, 200);

        const summaryRes = await ctx.request({ method: 'GET', pathname: '/api/finance/summary?month=2026-02' });
        assert.equal(summaryRes.status, 200);
        assert.equal(summaryRes.json.rowCount, 2);
        assert.equal(summaryRes.json.latestMonth.month, '2026-02');

        const alertRes = await ctx.request({ method: 'GET', pathname: '/api/finance/alerts/real-food?month=2026-02' });
        assert.equal(alertRes.status, 200);
        assert.equal(alertRes.json.level, 'ok');

        const updateSettingsRes = await ctx.request({
            method: 'POST',
            pathname: '/api/finance/settings',
            body: {
                foodBudgetYen: 70000,
                categoryBudgets: { 식비: 20000, 교통비: 10000 },
            },
        });
        assert.equal(updateSettingsRes.status, 200);
        assert.equal(updateSettingsRes.json.ok, true);
        assert.equal(updateSettingsRes.json.categoryBudgets['식비'], 20000);

        const settingsRes = await ctx.request({ method: 'GET', pathname: '/api/finance/settings' });
        assert.equal(settingsRes.status, 200);
        assert.equal(settingsRes.json.foodBudgetYen, 70000);
        assert.equal(settingsRes.json.categoryBudgets['교통비'], 10000);

        const healthRes = await ctx.request({ method: 'GET', pathname: '/api/health' });
        assert.equal(healthRes.status, 200);
        assert.equal(healthRes.json.ok, true);
    } finally {
        await ctx.cleanup();
    }
});

test('summary scope is not truncated by default transaction pagination limit', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        for (let i = 0; i < 150; i += 1) {
            const day = String((i % 28) + 1).padStart(2, '0');
            await ctx.app.storage.createTransaction({
                date: `2026-03-${day}`,
                item: `식비-${i + 1}`,
                amount: -100,
                category: '식비',
                paymentMethod: '현금',
                currency: 'JPY',
                memo: '',
                tags: [],
            });
        }

        const summaryRes = await ctx.request({ method: 'GET', pathname: '/api/finance/summary?month=2026-03' });
        assert.equal(summaryRes.status, 200);
        assert.equal(summaryRes.json.rowCount, 150);
        assert.equal(Array.isArray(summaryRes.json.monthly), true);
        assert.equal(summaryRes.json.monthly.length, 1);
        assert.equal(summaryRes.json.latestMonth.month, '2026-03');
        assert.equal(summaryRes.json.latestMonth.expense, 15000);

        const alertRes = await ctx.request({ method: 'GET', pathname: '/api/finance/alerts/real-food?month=2026-03' });
        assert.equal(alertRes.status, 200);
        assert.equal(alertRes.json.monthCount, 1);
    } finally {
        await ctx.cleanup();
    }
});

test('JSON -> SQLite migration keeps monthly summary values', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'finance-migration-test-'));
    const jsonPath = path.join(tempRoot, 'finance_db.json');
    const sqlitePath = path.join(tempRoot, 'finance_db.sqlite');
    const schemaPath = path.join(__dirname, '../../data/schema.sql');

    const sourceDb = {
        config: { schemaVersion: 2, currency: 'JPY', owner: '', last_updated: null },
        transactions: [
            {
                id: 1760000001001,
                date: '2026-02-01',
                item: '월급',
                amount: 300000,
                category: '급여',
                paymentMethod: '스미토모',
                memo: '',
                currency: 'JPY',
                tags: [],
                created_at: '2026-02-01T00:00:00.000Z',
            },
            {
                id: 1760000001002,
                date: '2026-02-02',
                item: '점심',
                amount: -5000,
                category: '식비',
                paymentMethod: '현금',
                memo: '',
                currency: 'JPY',
                tags: ['외식'],
                created_at: '2026-02-02T00:00:00.000Z',
            },
        ],
        liabilities: { creditCards: {} },
        categories: [],
    };

    await fs.promises.writeFile(jsonPath, JSON.stringify(sourceDb, null, 2), 'utf8');
    await runExecFile(process.execPath, [
        path.join(__dirname, '../../scripts/migrate-json-to-sqlite.js'),
        '--json', jsonPath,
        '--sqlite', sqlitePath,
        '--schema', schemaPath,
    ]);

    const ctx = await createTestApp({ storageDriver: 'sqlite', seedSqlitePath: sqlitePath });
    try {
        const summaryRes = await ctx.request({ method: 'GET', pathname: '/api/finance/summary?month=2026-02' });
        assert.equal(summaryRes.status, 200);
        assert.equal(summaryRes.json.rowCount, 2);
        assert.equal(summaryRes.json.latestMonth.income, 300000);
        assert.equal(summaryRes.json.latestMonth.expense, 5000);
    } finally {
        await ctx.cleanup();
        await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }
});
