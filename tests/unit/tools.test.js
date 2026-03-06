const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../../public/assets/js/tools.js');

test('detectDueTemplates returns monthly templates that are not yet applied this month', () => {
    const due = tools.detectDueTemplates([
        { id: 'a', name: '월세', amount: 60000, recurrence: 'monthly', billingDay: 5, lastAppliedMonth: '2026-02' },
        { id: 'b', name: '급여', amount: 300000, txType: 'income', recurrence: 'monthly', billingDay: 1, lastAppliedMonth: '2026-03' },
        { id: 'c', name: '교통', amount: 10000, recurrence: 'none' },
    ], '2026-03');

    assert.equal(due.length, 1);
    assert.equal(due[0].id, 'a');
    assert.equal(due[0].billingDay, 5);
});

test('mapCsvRowsToTransactions parses common headers and falls back to defaults', () => {
    const csv = [
        'date,item,expense,category',
        '2026-03-02,점심,1200,식비',
        '2026-03-03,버스,1500,교통비',
    ].join('\n');

    const preview = tools.mapCsvRowsToTransactions(csv, {
        paymentMethod: '현금',
        currency: 'JPY',
    });

    assert.equal(preview.errors.length, 0);
    assert.equal(preview.entries.length, 2);
    assert.deepEqual(preview.entries[0], {
        date: '2026-03-02',
        item: '점심',
        amount: -1200,
        category: '식비',
        paymentMethod: '현금',
        currency: 'JPY',
        memo: '',
    });
});

test('computeCategoryBudgetRows aggregates scoped monthly spending by category', () => {
    const rows = tools.computeCategoryBudgetRows([
        { month: '2026-01', byCategory: { 식비: 12000, 교통비: 5000 } },
        { month: '2026-02', byCategory: { 식비: 18000 } },
    ], { 식비: 15000, 교통비: 4000 });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].category, '식비');
    assert.equal(rows[0].totalBudget, 30000);
    assert.equal(rows[0].spent, 30000);
    assert.equal(rows[0].status, 'WARN');
    assert.equal(rows[1].status, 'OK');
});

test('computeBalanceHealth compares expected and actual balances per account', () => {
    const report = tools.computeBalanceHealth(
        [{ id: 'acc_sumitomo', name: '스미토모 통장', currency: 'JPY', source: 'sumitomo' }],
        {
            acc_sumitomo: {
                baselineDate: '2026-03-01',
                baselineBalance: 100000,
                currentActualBalance: 98700,
            },
        },
        [
            { date: '2026-03-02', paymentMethod: '스미토모', currency: 'JPY', income: 0, expense: 1200 },
            { date: '2026-03-03', paymentMethod: '스미토모', currency: 'JPY', income: 0, expense: 100 },
        ],
    );

    assert.equal(report.length, 1);
    assert.equal(report[0].expectedCurrentBalance, 98700);
    assert.equal(report[0].variance, 0);
    assert.equal(report[0].status, 'OK');
});
