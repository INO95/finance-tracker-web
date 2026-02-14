const test = require('node:test');
const assert = require('node:assert/strict');
const format = require('../../public/assets/js/format.js');

test('escapeHtml escapes critical characters', () => {
    const raw = `<img src=x onerror='alert(1)'>&\"`;
    const escaped = format.escapeHtml(raw);
    assert.equal(escaped, '&lt;img src=x onerror=&#39;alert(1)&#39;&gt;&amp;&quot;');
});

test('monthDiffInclusive calculates inclusive month ranges', () => {
    assert.equal(format.monthDiffInclusive('2026-01', '2026-01'), 1);
    assert.equal(format.monthDiffInclusive('2026-01', '2026-03'), 3);
    assert.equal(format.monthDiffInclusive('2026-03', '2026-01'), 0);
});

test('parseAmountValue parses numeric text and strips commas', () => {
    assert.equal(format.parseAmountValue('12,340'), 12340);
    assert.ok(Number.isNaN(format.parseAmountValue('abc')));
});
