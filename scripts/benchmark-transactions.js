#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const sqlite3 = require('sqlite3');
const { createApp } = require('../src/app');

const DEFAULT_ROWS = 10000;
const DEFAULT_WARMUP = 20;
const DEFAULT_MEASURED = 120;
const DEFAULT_LIMIT = 100;
const DEFAULT_P95_THRESHOLD_MS = 150;

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

function toInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.trunc(n);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function openDb(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function closeDb(db) {
  return new Promise((resolve, reject) => {
    db.close(err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function isoDateFor(offset) {
  const base = new Date('2025-01-01T00:00:00.000Z');
  base.setUTCDate(base.getUTCDate() + (offset % 365));
  return base.toISOString().slice(0, 10);
}

function nowIsoWithOffset(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

async function seedSqlite({ sqlitePath, schemaPath, rows }) {
  await fs.promises.mkdir(path.dirname(sqlitePath), { recursive: true });
  const schemaSql = await fs.promises.readFile(schemaPath, 'utf8');
  const db = await openDb(sqlitePath);

  const categories = ['식비', '교통비', '월세', '통신비', '생활', '기타'];
  const methods = ['현금', '스미토모', '라쿠텐', '올리브 카드 (데빗)'];
  const currencies = ['JPY', 'JPY', 'JPY', 'KRW', 'USD'];

  try {
    await exec(db, 'PRAGMA journal_mode=WAL;');
    await exec(db, 'PRAGMA synchronous=NORMAL;');
    await exec(db, schemaSql);
    await run(db, 'BEGIN IMMEDIATE');

    const baseId = Date.now() * 1000;
    for (let i = 0; i < rows; i += 1) {
      const id = baseId + i;
      const date = isoDateFor(i);
      const item = `bench-item-${i + 1}`;
      const isIncome = i % 11 === 0;
      const amount = isIncome ? (200000 + (i % 20000)) : -(100 + (i % 50000));
      const category = categories[i % categories.length];
      const paymentMethod = methods[i % methods.length];
      const memo = i % 5 === 0 ? 'benchmark-seeded' : '';
      const currency = currencies[i % currencies.length];
      const tags = i % 7 === 0 ? ['bench'] : [];
      const createdAt = nowIsoWithOffset(i);

      await run(
        db,
        `INSERT OR REPLACE INTO transactions
          (id, date, item, amount, category, payment_method, memo, currency, tags_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [id, date, item, amount, category, paymentMethod, memo, currency, JSON.stringify(tags), createdAt],
      );
    }

    await run(db, 'COMMIT');
  } catch (error) {
    try {
      await run(db, 'ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    await closeDb(db);
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const weight = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * weight;
}

function summaryStats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    count: samples.length,
    minMs: sorted[0] || 0,
    maxMs: sorted[sorted.length - 1] || 0,
    avgMs: samples.length ? sum / samples.length : 0,
    p50Ms: percentile(sorted, 50),
    p90Ms: percentile(sorted, 90),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
}

function requestTransactions({ port, pathWithQuery }) {
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'GET',
        path: pathWithQuery,
      },
      res => {
        let body = '';
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          const ended = process.hrtime.bigint();
          const durationMs = Number(ended - started) / 1_000_000;
          resolve({ status: res.statusCode, durationMs, body });
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

async function runBenchmark({ rows, warmup, measured, limit, p95ThresholdMs, outputJsonPath = '' }) {
  const repoRoot = path.join(__dirname, '..');
  const schemaPath = path.join(repoRoot, 'data/schema.sql');
  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'finance-bench-'));
  const dataDir = path.join(tempRoot, 'data');
  const configDir = path.join(tempRoot, 'config');
  const sqlitePath = path.join(dataDir, 'finance_db.sqlite');

  await fs.promises.mkdir(dataDir, { recursive: true });
  await fs.promises.mkdir(configDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(configDir, 'default.json'),
    JSON.stringify({
      categories: { 식비: { icon: '🍽️' } },
      paymentMethods: { 현금: { type: 'cash' } },
      financePolicy: { realFoodBudgetMonthlyYen: 60000, creditCards: [] },
    }, null, 2),
    'utf8',
  );
  let app = null;

  try {
    await seedSqlite({ sqlitePath, schemaPath, rows });
    app = createApp({
      port: 0,
      host: '127.0.0.1',
      dataDir,
      configDir,
      staticDir: path.join(repoRoot, 'public'),
      storageDriver: 'sqlite',
      schemaPath,
      apiToken: '',
      corsOrigin: '*',
    });
    await app.start();
    const address = app.server.address();
    const port = address && typeof address === 'object' ? address.port : 0;

    if (!port) throw new Error('Failed to resolve benchmark server port');

    console.log(`Benchmark server started on 127.0.0.1:${port}`);
    console.log(`Seeded rows: ${rows}, warmup: ${warmup}, measured: ${measured}, limit: ${limit}`);

    for (let i = 0; i < warmup; i += 1) {
      const page = (i % Math.max(1, Math.floor(rows / limit))) + 1;
      const res = await requestTransactions({
        port,
        pathWithQuery: `/api/finance/transactions?limit=${limit}&page=${page}&sort=date_desc`,
      });
      if (res.status !== 200) throw new Error(`Warmup request failed with status=${res.status}`);
    }

    const samples = [];
    const maxPage = Math.max(1, Math.ceil(rows / limit));
    for (let i = 0; i < measured; i += 1) {
      const page = (i % maxPage) + 1;
      const res = await requestTransactions({
        port,
        pathWithQuery: `/api/finance/transactions?limit=${limit}&page=${page}&sort=date_desc`,
      });
      if (res.status !== 200) throw new Error(`Measured request failed with status=${res.status}`);
      samples.push(res.durationMs);
    }

    const stats = summaryStats(samples);
    const pass = stats.p95Ms <= p95ThresholdMs;

    console.log('--- Benchmark Result ---');
    console.log(`avg=${stats.avgMs.toFixed(2)}ms p50=${stats.p50Ms.toFixed(2)}ms p90=${stats.p90Ms.toFixed(2)}ms p95=${stats.p95Ms.toFixed(2)}ms p99=${stats.p99Ms.toFixed(2)}ms`);
    console.log(`threshold(p95)<=${p95ThresholdMs}ms : ${pass ? 'PASS' : 'FAIL'}`);
    const result = {
      endpoint: '/api/finance/transactions',
      rows,
      warmup,
      measured,
      limit,
      thresholdP95Ms: p95ThresholdMs,
      pass,
      generatedAt: new Date().toISOString(),
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      stats,
    };

    console.log(JSON.stringify(result, null, 2));

    if (outputJsonPath) {
      const resolved = path.resolve(outputJsonPath);
      await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
      await fs.promises.writeFile(resolved, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
      console.log(`Saved benchmark JSON: ${resolved}`);
    }

    if (!pass) process.exitCode = 1;
  } finally {
    if (app) await app.close().catch(() => undefined);
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const rows = toInt(args.rows, DEFAULT_ROWS, { min: 100, max: 2_000_000 });
  const warmup = toInt(args.warmup, DEFAULT_WARMUP, { min: 0, max: 10000 });
  const measured = toInt(args.measured, DEFAULT_MEASURED, { min: 1, max: 100000 });
  const limit = toInt(args.limit, DEFAULT_LIMIT, { min: 1, max: 500 });
  const p95ThresholdMs = toInt(args['p95-threshold-ms'], DEFAULT_P95_THRESHOLD_MS, { min: 1, max: 60000 });
  const outputJsonPath = args['output-json'] ? String(args['output-json']) : '';

  await runBenchmark({ rows, warmup, measured, limit, p95ThresholdMs, outputJsonPath });
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
