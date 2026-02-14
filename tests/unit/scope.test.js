const test = require('node:test');
const assert = require('node:assert/strict');
require('../../public/assets/js/format.js');
const { scopeToSearchParams } = require('../../public/assets/js/api.js');
const { computeBudgetMonthCount } = require('../../public/assets/js/render.js');

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
