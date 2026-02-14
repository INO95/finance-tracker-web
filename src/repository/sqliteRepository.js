const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { createTimestampSequenceIdGenerator } = require('./jsonRepository');

function parseTags(raw) {
    try {
        const value = JSON.parse(String(raw || '[]'));
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function mapRowToTransaction(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        date: row.date || '',
        item: row.item || '',
        amount: Number(row.amount || 0),
        category: row.category || '기타',
        paymentMethod: row.payment_method || '',
        memo: row.memo || '',
        currency: row.currency || 'JPY',
        tags: parseTags(row.tags_json),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
    };
}

function toListOrderBy(sort) {
    if (sort === 'date_asc') return 'date ASC, id ASC';
    if (sort === 'expense_desc') return 'CASE WHEN amount < 0 THEN -amount ELSE 0 END DESC, date DESC, id DESC';
    if (sort === 'expense_asc') return 'CASE WHEN amount < 0 THEN -amount ELSE 0 END ASC, date DESC, id DESC';
    return 'date DESC, id DESC';
}

function hasQueryFilter(query) {
    if (!query || typeof query !== 'object') return false;
    return Boolean(
        query.month
        || query.fromMonth
        || query.toMonth
        || query.category
        || query.memo
        || query.q
        || query.sort
        || query.page
        || query.limit,
    );
}

function normalizeQueryNumber(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const int = Math.trunc(n);
    if (int < min) return min;
    if (int > max) return max;
    return int;
}

function normalizePaginateFlag(value, fallback = true) {
    if (value == null) return fallback;
    if (typeof value === 'boolean') return value;
    const text = String(value).trim().toLowerCase();
    if (text === 'false' || text === '0') return false;
    if (text === 'true' || text === '1') return true;
    return fallback;
}

function buildListWhereClause(query) {
    const where = [];
    const params = [];

    if (query.month) {
        where.push('substr(date, 1, 7) = ?');
        params.push(query.month);
    } else {
        if (query.fromMonth) {
            where.push('substr(date, 1, 7) >= ?');
            params.push(query.fromMonth);
        }
        if (query.toMonth) {
            where.push('substr(date, 1, 7) <= ?');
            params.push(query.toMonth);
        }
    }

    if (query.category) {
        where.push('category = ?');
        params.push(query.category);
    }
    if (query.memo) {
        where.push('LOWER(memo) LIKE ?');
        params.push(`%${String(query.memo).toLowerCase()}%`);
    }
    if (query.q) {
        where.push('(LOWER(item) LIKE ? OR LOWER(memo) LIKE ? OR LOWER(payment_method) LIKE ? OR LOWER(category) LIKE ?)');
        const keyword = `%${String(query.q).toLowerCase()}%`;
        params.push(keyword, keyword, keyword, keyword);
    }

    if (!where.length) return { sql: '', params };
    return { sql: `WHERE ${where.join(' AND ')}`, params };
}

class SqliteRepository {
    constructor({ sqlitePath, schemaPath }) {
        this.sqlitePath = sqlitePath;
        this.schemaPath = schemaPath;
        this.db = null;
        this.nextId = createTimestampSequenceIdGenerator();
        this.ready = this.initialize();
    }

    async initialize() {
        await fs.promises.mkdir(path.dirname(this.sqlitePath), { recursive: true });
        this.db = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqlitePath, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(db);
            });
        });

        await this.exec('PRAGMA journal_mode=WAL;');
        await this.exec('PRAGMA synchronous=NORMAL;');
        await this.exec('PRAGMA foreign_keys=ON;');
        await this.exec('PRAGMA busy_timeout=5000;');

        const schemaSql = await fs.promises.readFile(this.schemaPath, 'utf8');
        await this.exec(schemaSql);
    }

    async listTransactions(query = null) {
        await this.ready;

        if (!hasQueryFilter(query)) {
            const rows = await this.all(`
                SELECT
                    id,
                    date,
                    item,
                    amount,
                    category,
                    payment_method,
                    memo,
                    currency,
                    tags_json,
                    created_at,
                    updated_at
                FROM transactions
            `);
            return rows.map(mapRowToTransaction);
        }

        const safeQuery = {
            month: String(query.month || ''),
            fromMonth: String(query.fromMonth || ''),
            toMonth: String(query.toMonth || ''),
            category: String(query.category || ''),
            memo: String(query.memo || ''),
            q: String(query.q || ''),
            sort: String(query.sort || 'date_desc'),
            paginate: normalizePaginateFlag(query.paginate, true),
            limit: normalizeQueryNumber(query.limit, 100, { min: 1, max: 100 }),
            page: normalizeQueryNumber(query.page, 1, { min: 1, max: 1000000 }),
        };

        const where = buildListWhereClause(safeQuery);
        const totalRow = await this.get(
            `SELECT COUNT(1) AS total FROM transactions ${where.sql}`,
            where.params,
        );
        const total = Number(totalRow && totalRow.total ? totalRow.total : 0);
        let rows;
        if (safeQuery.paginate) {
            const offset = (safeQuery.page - 1) * safeQuery.limit;
            rows = await this.all(
                `
                SELECT
                    id,
                    date,
                    item,
                    amount,
                    category,
                    payment_method,
                    memo,
                    currency,
                    tags_json,
                    created_at,
                    updated_at
                FROM transactions
                ${where.sql}
                ORDER BY ${toListOrderBy(safeQuery.sort)}
                LIMIT ? OFFSET ?
                `,
                [...where.params, safeQuery.limit, offset],
            );
        } else {
            rows = await this.all(
                `
                SELECT
                    id,
                    date,
                    item,
                    amount,
                    category,
                    payment_method,
                    memo,
                    currency,
                    tags_json,
                    created_at,
                    updated_at
                FROM transactions
                ${where.sql}
                ORDER BY ${toListOrderBy(safeQuery.sort)}
                `,
                where.params,
            );
        }

        return {
            total,
            rows: rows.map(mapRowToTransaction),
        };
    }

    async createTransaction(input) {
        await this.ready;
        const tx = {
            id: this.nextId(),
            date: input.date,
            item: input.item,
            amount: Number(input.amount),
            category: input.category,
            paymentMethod: input.paymentMethod,
            memo: input.memo,
            currency: input.currency,
            tags: Array.isArray(input.tags) ? input.tags : [],
            created_at: new Date().toISOString(),
            updated_at: null,
        };

        await this.run(
            `INSERT INTO transactions (id, date, item, amount, category, payment_method, memo, currency, tags_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            [
                tx.id,
                tx.date,
                tx.item,
                tx.amount,
                tx.category,
                tx.paymentMethod,
                tx.memo,
                tx.currency,
                JSON.stringify(tx.tags),
                tx.created_at,
            ],
        );

        return tx;
    }

    async updateTransaction(id, patch) {
        await this.ready;

        const fieldMap = {
            date: 'date',
            item: 'item',
            amount: 'amount',
            category: 'category',
            paymentMethod: 'payment_method',
            memo: 'memo',
            currency: 'currency',
            tags: 'tags_json',
        };

        const sets = [];
        const values = [];
        for (const [key, column] of Object.entries(fieldMap)) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            sets.push(`${column} = ?`);
            if (key === 'tags') values.push(JSON.stringify(Array.isArray(patch.tags) ? patch.tags : []));
            else values.push(patch[key]);
        }

        if (sets.length === 0) {
            return this.getTransactionById(id);
        }

        const updatedAt = new Date().toISOString();
        sets.push('updated_at = ?');
        values.push(updatedAt);
        values.push(Number(id));

        const result = await this.run(
            `UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`,
            values,
        );

        if (!result || result.changes === 0) return null;
        return this.getTransactionById(id);
    }

    async updateTransactionTags(id, { add = [], remove = [] } = {}) {
        await this.ready;

        return this.withTransaction(async () => {
            const current = await this.getTransactionById(id);
            if (!current) return null;

            const set = new Set(Array.isArray(current.tags) ? current.tags : []);
            for (const tag of add) if (tag) set.add(tag);
            for (const tag of remove) if (tag) set.delete(tag);

            const updatedAt = new Date().toISOString();
            await this.run(
                'UPDATE transactions SET tags_json = ?, updated_at = ? WHERE id = ?',
                [JSON.stringify([...set]), updatedAt, Number(id)],
            );
            return this.getTransactionById(id);
        });
    }

    async getTransactionById(id) {
        await this.ready;
        const row = await this.get(
            `SELECT id, date, item, amount, category, payment_method, memo, currency, tags_json, created_at, updated_at
             FROM transactions WHERE id = ?`,
            [Number(id)],
        );
        return mapRowToTransaction(row);
    }

    async withTransaction(fn) {
        await this.run('BEGIN IMMEDIATE');
        try {
            const result = await fn();
            await this.run('COMMIT');
            return result;
        } catch (error) {
            try {
                await this.run('ROLLBACK');
            } catch {
                // ignore rollback errors
            }
            throw error;
        }
    }

    async close() {
        if (!this.db) return;
        const db = this.db;
        this.db = null;
        await new Promise((resolve, reject) => {
            db.close(err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function onRun(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row || null);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(Array.isArray(rows) ? rows : []);
            });
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

module.exports = {
    SqliteRepository,
};
