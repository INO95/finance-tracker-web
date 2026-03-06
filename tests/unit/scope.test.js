const test = require('node:test');
const assert = require('node:assert/strict');
require('../../public/assets/js/format.js');
const { scopeToSearchParams } = require('../../public/assets/js/api.js');
const { computeBudgetMonthCount } = require('../../public/assets/js/render.js');
const { monthToNumber, validateMonthScope } = require('../../src/services/summaryService');

test('scopeToSearchParams builds params for single scope', () => {
    const params = scopeToSearchParams({ scopeMode: 'single', month: '2026-02' });
    assert.equal(params.get('month'), '2026-02');
    assert.equal(params.get('fromMonth'), null);
    assert.equal(params.get('toMonth'), null);
});

test('scopeToSearchParams builds params for range scope', () => {
    const params = scopeToSearchParams({ scopeMode: 'range', fromMonth: '2026-01', toMonth: '2026-03' });
    assert.equal(params.get('month'), null);
    assert.equal(params.get('fromMonth'), '2026-01');
    assert.equal(params.get('toMonth'), '2026-03');
});

test('computeBudgetMonthCount returns month count by scope type', () => {
    const monthly = [{ month: '2026-01' }, { month: '2026-02' }, { month: '2026-03' }];
    assert.equal(computeBudgetMonthCount({ scopeMode: 'single', month: '2026-02' }, monthly), 1);
    assert.equal(computeBudgetMonthCount({ scopeMode: 'range', fromMonth: '2026-01', toMonth: '2026-03' }, monthly), 3);
    assert.equal(computeBudgetMonthCount({ scopeMode: 'all' }, monthly), 3);
});

test('monthToNumber rejects out-of-range months', () => {
    assert.equal(monthToNumber('2026-00'), null);
    assert.equal(monthToNumber('2026-13'), null);
    assert.equal(monthToNumber('2026-12'), 202612);
});

test('validateMonthScope rejects semantically invalid month values', () => {
    assert.deepEqual(validateMonthScope({ month: '2026-99' }), ['month must be YYYY-MM']);
    assert.deepEqual(validateMonthScope({ fromMonth: '2026-00' }), ['fromMonth must be YYYY-MM']);
    assert.deepEqual(validateMonthScope({ toMonth: '2026-13' }), ['toMonth must be YYYY-MM']);
});
