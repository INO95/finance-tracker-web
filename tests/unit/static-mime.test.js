const test = require('node:test');
const assert = require('node:assert/strict');
const { contentTypeFor, sanitizeAssetPath } = require('../../src/http/routes/static');

test('contentTypeFor maps known asset extensions', () => {
    assert.equal(contentTypeFor('/tmp/app.js'), 'application/javascript; charset=utf-8');
    assert.equal(contentTypeFor('/tmp/main.css'), 'text/css; charset=utf-8');
    assert.equal(contentTypeFor('/tmp/index.html'), 'text/html; charset=utf-8');
    assert.equal(contentTypeFor('/tmp/data.json'), 'application/json; charset=utf-8');
    assert.equal(contentTypeFor('/tmp/icon.png'), 'image/png');
    assert.equal(contentTypeFor('/tmp/logo.svg'), 'image/svg+xml');
});

test('sanitizeAssetPath rejects traversal and non-assets paths', () => {
    assert.equal(sanitizeAssetPath('/assets/js/app.js'), 'assets/js/app.js');
    assert.equal(sanitizeAssetPath('/assets/%2e%2e/src/router.js'), null);
    assert.equal(sanitizeAssetPath('/assets/../../secret.txt'), null);
    assert.equal(sanitizeAssetPath('/not-assets/app.js'), null);
});
