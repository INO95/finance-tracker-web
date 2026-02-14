const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  compareBenchmarks,
  computeRegression,
  buildSummaryMarkdown,
} = require('../../scripts/compare-benchmark');

test('computeRegression returns expected percentage and delta', () => {
  const out = computeRegression(100, 125);
  assert.equal(out.deltaMs, 25);
  assert.equal(Number(out.regressionPct.toFixed(2)), 25.00);
});

test('compareBenchmarks fails when p95 regression exceeds max', async () => {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bench-compare-test-'));
  const basePath = path.join(tempRoot, 'base.json');
  const headPath = path.join(tempRoot, 'head.json');

  const base = {
    endpoint: '/api/finance/transactions',
    rows: 10000,
    warmup: 12,
    measured: 60,
    limit: 100,
    thresholdP95Ms: 500,
    pass: true,
    stats: { avgMs: 1, p50Ms: 1, p90Ms: 1, p95Ms: 10, p99Ms: 1, minMs: 1, maxMs: 1, count: 60 },
  };
  const head = {
    ...base,
    stats: { ...base.stats, p95Ms: 14 },
  };

  await fs.promises.writeFile(basePath, JSON.stringify(base), 'utf8');
  await fs.promises.writeFile(headPath, JSON.stringify(head), 'utf8');

  const result = compareBenchmarks({
    headPath,
    basePath,
    maxRegressionPct: 25,
    maxRegressionAbsMs: 3,
  });

  assert.equal(result.pass, false);
  assert.match(String(result.reason), /exceeds gates/);

  await fs.promises.rm(tempRoot, { recursive: true, force: true });
});

test('compareBenchmarks passes when percentage regresses but absolute delta is below gate', async () => {
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bench-compare-test-'));
  const basePath = path.join(tempRoot, 'base.json');
  const headPath = path.join(tempRoot, 'head.json');

  const base = {
    endpoint: '/api/finance/transactions',
    rows: 10000,
    warmup: 12,
    measured: 60,
    limit: 100,
    thresholdP95Ms: 500,
    pass: true,
    stats: { avgMs: 1, p50Ms: 1, p90Ms: 1, p95Ms: 1, p99Ms: 1, minMs: 1, maxMs: 1, count: 60 },
  };
  const head = {
    ...base,
    stats: { ...base.stats, p95Ms: 1.4 },
  };

  await fs.promises.writeFile(basePath, JSON.stringify(base), 'utf8');
  await fs.promises.writeFile(headPath, JSON.stringify(head), 'utf8');

  const result = compareBenchmarks({
    headPath,
    basePath,
    maxRegressionPct: 25,
    maxRegressionAbsMs: 5,
  });

  assert.equal(result.pass, true);
  await fs.promises.rm(tempRoot, { recursive: true, force: true });
});

test('buildSummaryMarkdown renders with and without base benchmark', () => {
  const head = {
    endpoint: '/api/finance/transactions',
    rows: 10000,
    warmup: 12,
    measured: 60,
    limit: 100,
    thresholdP95Ms: 500,
    stats: { avgMs: 1, p50Ms: 1, p90Ms: 1, p95Ms: 1, p99Ms: 1 },
  };

  const onlyHead = buildSummaryMarkdown({ head, pass: true, maxRegressionPct: 25, maxRegressionAbsMs: 5 });
  assert.match(onlyHead, /skipped \(no base benchmark\)/);

  const withBase = buildSummaryMarkdown({
    head,
    base: { ...head },
    regression: { regressionPct: 10, deltaMs: 0.2 },
    pass: true,
    maxRegressionPct: 25,
    maxRegressionAbsMs: 5,
  });
  assert.match(withBase, /p95 change vs base/);
  assert.match(withBase, /10\.00%/);
  assert.match(withBase, /<= 5\.000ms/);
});
