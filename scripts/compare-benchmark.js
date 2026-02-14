#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_REGRESSION_PCT = 25;
const DEFAULT_MAX_REGRESSION_ABS_MS = 5;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
    if (value !== 'true') i += 1;
    out[key] = value;
  }
  return out;
}

function toNumber(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function readJsonFile(filePath) {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

function computeRegression(baseMs, headMs) {
  const base = Number(baseMs);
  const head = Number(headMs);
  if (!Number.isFinite(base) || !Number.isFinite(head)) {
    return { regressionPct: null, deltaMs: null };
  }
  if (base <= 0) {
    return { regressionPct: 0, deltaMs: head - base };
  }
  return {
    regressionPct: ((head - base) / base) * 100,
    deltaMs: head - base,
  };
}

function buildSummaryMarkdown({
  head,
  base = null,
  regression = null,
  pass = true,
  maxRegressionPct,
  maxRegressionAbsMs,
}) {
  const lines = [
    '## Transactions Benchmark',
    '',
    `- endpoint: \`${head.endpoint}\``,
    `- rows: ${head.rows}, warmup: ${head.warmup}, measured: ${head.measured}, limit: ${head.limit}`,
    `- p95 threshold (absolute): ${head.thresholdP95Ms}ms`,
  ];

  if (base) {
    const regressionText = regression && regression.regressionPct != null
      ? `${regression.regressionPct.toFixed(2)}%`
      : 'n/a';
    const deltaText = regression && regression.deltaMs != null
      ? `${regression.deltaMs.toFixed(3)}ms`
      : 'n/a';
    lines.push(`- p95 regression gates: <= ${maxRegressionPct.toFixed(2)}% and <= ${maxRegressionAbsMs.toFixed(3)}ms`);
    lines.push(`- p95 change vs base: ${deltaText} (${regressionText})`);
    lines.push(`- regression result: ${pass ? 'PASS' : 'FAIL'}`);
  } else {
    lines.push('- regression result: skipped (no base benchmark)');
  }

  lines.push('');
  lines.push('| metric | head (ms) |');
  lines.push('|---|---:|');
  lines.push(`| avg | ${head.stats.avgMs.toFixed(3)} |`);
  lines.push(`| p50 | ${head.stats.p50Ms.toFixed(3)} |`);
  lines.push(`| p90 | ${head.stats.p90Ms.toFixed(3)} |`);
  lines.push(`| p95 | ${head.stats.p95Ms.toFixed(3)} |`);
  lines.push(`| p99 | ${head.stats.p99Ms.toFixed(3)} |`);

  if (base) {
    lines.push('');
    lines.push('| metric | base (ms) |');
    lines.push('|---|---:|');
    lines.push(`| avg | ${base.stats.avgMs.toFixed(3)} |`);
    lines.push(`| p50 | ${base.stats.p50Ms.toFixed(3)} |`);
    lines.push(`| p90 | ${base.stats.p90Ms.toFixed(3)} |`);
    lines.push(`| p95 | ${base.stats.p95Ms.toFixed(3)} |`);
    lines.push(`| p99 | ${base.stats.p99Ms.toFixed(3)} |`);
  }

  return `${lines.join('\n')}\n`;
}

function compareBenchmarks({
  headPath,
  basePath = '',
  maxRegressionPct = DEFAULT_MAX_REGRESSION_PCT,
  maxRegressionAbsMs = DEFAULT_MAX_REGRESSION_ABS_MS,
}) {
  if (!headPath) throw new Error('--head is required');

  const head = readJsonFile(headPath);
  const base = basePath && fs.existsSync(path.resolve(basePath))
    ? readJsonFile(basePath)
    : null;

  const result = {
    endpoint: head.endpoint,
    generatedAt: new Date().toISOString(),
    maxRegressionPct,
    maxRegressionAbsMs,
    head,
    base,
    regression: null,
    pass: true,
    reason: '',
  };

  if (base) {
    const regression = computeRegression(base.stats.p95Ms, head.stats.p95Ms);
    result.regression = regression;
    const pctExceeded = regression.regressionPct != null && regression.regressionPct > maxRegressionPct;
    const absExceeded = regression.deltaMs != null && regression.deltaMs > maxRegressionAbsMs;
    if (pctExceeded && absExceeded) {
      result.pass = false;
      result.reason = `p95 regression ${regression.regressionPct.toFixed(2)}% and ${regression.deltaMs.toFixed(3)}ms exceeds gates (${maxRegressionPct.toFixed(2)}%, ${maxRegressionAbsMs.toFixed(3)}ms)`;
    }
  } else {
    result.reason = 'base benchmark missing; regression check skipped';
  }

  return result;
}

function main() {
  const args = parseArgs(process.argv);
  const headPath = args.head ? String(args.head) : '';
  const basePath = args.base ? String(args.base) : '';
  const maxRegressionPct = toNumber(args['max-regression-pct'], DEFAULT_MAX_REGRESSION_PCT);
  const maxRegressionAbsMs = toNumber(args['max-regression-abs-ms'], DEFAULT_MAX_REGRESSION_ABS_MS);
  const outputJson = args['output-json'] ? String(args['output-json']) : '';
  const summaryPath = args['step-summary'] ? String(args['step-summary']) : '';

  const result = compareBenchmarks({ headPath, basePath, maxRegressionPct, maxRegressionAbsMs });

  console.log('--- Benchmark Regression Check ---');
  if (result.base) {
    const r = result.regression;
    console.log(`base p95=${result.base.stats.p95Ms.toFixed(3)}ms, head p95=${result.head.stats.p95Ms.toFixed(3)}ms, regression=${(r && r.regressionPct != null) ? r.regressionPct.toFixed(2) : 'n/a'}%`);
    console.log(`gates <= ${maxRegressionPct.toFixed(2)}% and <= ${maxRegressionAbsMs.toFixed(3)}ms : ${result.pass ? 'PASS' : 'FAIL'}`);
  } else {
    console.log('base benchmark missing; regression check skipped');
  }

  if (result.reason && result.reason !== 'base benchmark missing; regression check skipped') {
    console.log(result.reason);
  }

  if (outputJson) {
    const resolved = path.resolve(outputJson);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`Saved comparison JSON: ${resolved}`);
  }

  if (summaryPath) {
    const markdown = buildSummaryMarkdown({
      head: result.head,
      base: result.base,
      regression: result.regression,
      pass: result.pass,
      maxRegressionPct,
      maxRegressionAbsMs,
    });
    fs.appendFileSync(summaryPath, markdown, 'utf8');
    console.log(`Updated step summary: ${summaryPath}`);
  }

  if (!result.pass) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  compareBenchmarks,
  computeRegression,
  buildSummaryMarkdown,
};
