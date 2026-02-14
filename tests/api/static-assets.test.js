const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp } = require('../helpers/testApp');

test('GET /assets/js/app.js serves static asset', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const res = await ctx.request({ method: 'GET', pathname: '/assets/js/app.js' });
        assert.equal(res.status, 200);
        assert.match(String(res.headers['content-type'] || ''), /application\/javascript/);
        assert.match(res.raw, /function initApp/);
    } finally {
        await ctx.cleanup();
    }
});

test('path traversal under /assets is blocked', async () => {
    const ctx = await createTestApp({ storageDriver: 'sqlite' });
    try {
        const encodedTraversal = await ctx.request({ method: 'GET', pathname: '/assets/%2e%2e/src/router.js' });
        assert.ok(encodedTraversal.status === 403 || encodedTraversal.status === 404);

        const plainTraversal = await ctx.request({ method: 'GET', pathname: '/assets/../src/router.js' });
        assert.ok(plainTraversal.status === 403 || plainTraversal.status === 404);
    } finally {
        await ctx.cleanup();
    }
});
