#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

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

function close(db) {
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

function sanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags
        .map(tag => String(tag == null ? '' : tag).trim().slice(0, 40))
        .filter(Boolean);
}

function toInteger(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.trunc(n);
}

async function main() {
    const args = parseArgs(process.argv);
    const repoRoot = path.join(__dirname, '..');

    const jsonPath = path.resolve(args.json || path.join(repoRoot, 'data/finance_db.json'));
    const sqlitePath = path.resolve(args.sqlite || process.env.FINANCE_SQLITE_PATH || path.join(repoRoot, 'data/finance_db.sqlite'));
    const schemaPath = path.resolve(args.schema || path.join(repoRoot, 'data/schema.sql'));

    if (!fs.existsSync(schemaPath)) {
        throw new Error(`schema.sql not found: ${schemaPath}`);
    }

    if (!fs.existsSync(jsonPath)) {
        console.log(`JSON source not found, nothing to migrate: ${jsonPath}`);
        return;
    }

    const rawJson = await fs.promises.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(rawJson);
    const txs = Array.isArray(parsed.transactions) ? parsed.transactions : [];

    await fs.promises.mkdir(path.dirname(sqlitePath), { recursive: true });
    const schemaSql = await fs.promises.readFile(schemaPath, 'utf8');

    const db = await openDb(sqlitePath);

    try {
        await exec(db, 'PRAGMA journal_mode=WAL;');
        await exec(db, 'PRAGMA synchronous=NORMAL;');
        await exec(db, schemaSql);

        await run(db, 'BEGIN IMMEDIATE');

        let inserted = 0;
        for (let i = 0; i < txs.length; i += 1) {
            const tx = txs[i] || {};
            const id = toInteger(tx.id, Date.now() * 1000 + i);
            const date = String(tx.date || '').slice(0, 10);
            const item = String(tx.item || '').trim().slice(0, 120);
            const amount = toInteger(tx.amount, 0);
            const category = String(tx.category || '기타').trim().slice(0, 80);
            const paymentMethod = String(tx.paymentMethod || '현금').trim().slice(0, 80);
            const memo = String(tx.memo || '').trim().slice(0, 200);
            const currency = String(tx.currency || 'JPY').trim().slice(0, 8).toUpperCase();
            const tagsJson = JSON.stringify(sanitizeTags(tx.tags));
            const createdAt = tx.created_at ? String(tx.created_at) : new Date().toISOString();
            const updatedAt = tx.updated_at ? String(tx.updated_at) : null;

            const result = await run(
                db,
                `INSERT OR IGNORE INTO transactions
                (id, date, item, amount, category, payment_method, memo, currency, tags_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, date, item, amount, category, paymentMethod, memo, currency, tagsJson, createdAt, updatedAt],
            );
            inserted += Number(result.changes || 0);
        }

        await run(db, 'COMMIT');
        console.log(`Migration complete: source=${txs.length}, inserted=${inserted}, sqlite=${sqlitePath}`);
    } catch (error) {
        try {
            await run(db, 'ROLLBACK');
        } catch {
            // ignore rollback failures
        }
        throw error;
    } finally {
        await close(db);
    }
}

main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
});
