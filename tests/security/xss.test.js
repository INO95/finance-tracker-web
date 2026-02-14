const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('frontend templates escape user-supplied transaction/category/method fields', async () => {
    const formatPath = path.join(__dirname, '../../public/assets/js/format.js');
    const renderPath = path.join(__dirname, '../../public/assets/js/render.js');
    const modalsPath = path.join(__dirname, '../../public/assets/js/modals.js');
    const formatSource = await fs.promises.readFile(formatPath, 'utf8');
    const renderSource = await fs.promises.readFile(renderPath, 'utf8');
    const modalsSource = await fs.promises.readFile(modalsPath, 'utf8');

    assert.match(formatSource, /function escapeHtml\(/);
    assert.match(renderSource, /const safeItemText = format\.escapeHtml\(itemText\);/);
    assert.match(renderSource, /const safeMemoText = format\.escapeHtml\(memoText\);/);
    assert.match(renderSource, /const safeCategory = format\.escapeHtml\(row\.category \|\| ''\);/);
    assert.match(renderSource, /const safePaymentMethod = format\.escapeHtml\(row\.paymentMethod \|\| ''\);/);
    assert.match(modalsSource, /format\.escapeHtml\(name\)/);

    assert.doesNotMatch(renderSource, /<td class="\$\{itemClass\}"[^\n]*>\$\{itemText\}<\/td>/);
    assert.doesNotMatch(renderSource, /<td class="\$\{memoClass\}"[^\n]*>\$\{memoText\}<\/td>/);
});
