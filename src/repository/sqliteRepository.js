const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
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

function parseMonthText(monthText) {
    const m = String(monthText || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return {
        year: Number(m[1]),
        month,
    };
}

function monthStartDate(monthText) {
    const parts = parseMonthText(monthText);
    if (!parts) return null;
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-01`;
}

function nextMonthStartDate(monthText) {
    const parts = parseMonthText(monthText);
    if (!parts) return null;
    const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
}

function buildScopeDateWhereClause(query = {}, column = 'date') {
    const where = [];
    const params = [];

    if (query.month) {
        const start = monthStartDate(query.month);
        const end = nextMonthStartDate(query.month);
        if (start && end) {
            where.push(`${column} >= ?`);
            params.push(start);
            where.push(`${column} < ?`);
            params.push(end);
        }
        return { where, params };
    }

    const fromStart = monthStartDate(query.fromMonth);
    if (fromStart) {
        where.push(`${column} >= ?`);
        params.push(fromStart);
    }

    const toEnd = nextMonthStartDate(query.toMonth);
    if (toEnd) {
        where.push(`${column} < ?`);
        params.push(toEnd);
    }

    return { where, params };
}

function buildWhereSql(where) {
    if (!Array.isArray(where) || where.length === 0) return '';
    return `WHERE ${where.join(' AND ')}`;
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
    const scope = buildScopeDateWhereClause(query);
    const where = [...scope.where];
    const params = [...scope.params];

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
        this.db = new Database(this.sqlitePath);

        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('busy_timeout = 5000');

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
            id: Number.isFinite(Number(input.id)) ? Math.trunc(Number(input.id)) : this.nextId(),
            date: input.date,
            item: input.item,
            amount: Number(input.amount),
            category: input.category,
            paymentMethod: input.paymentMethod,
            memo: input.memo,
            currency: input.currency,
            tags: Array.isArray(input.tags) ? input.tags : [],
            created_at: input.created_at ? String(input.created_at) : new Date().toISOString(),
            updated_at: Object.prototype.hasOwnProperty.call(input, 'updated_at') ? input.updated_at : null,
        };

        await this.run(
            `INSERT INTO transactions (id, date, item, amount, category, payment_method, memo, currency, tags_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                tx.updated_at,
            ],
        );

        return tx;
    }

    async countTransactions(query = {}) {
        await this.ready;
        const scope = buildScopeDateWhereClause(query);
        const row = await this.get(
            `SELECT COUNT(1) AS total FROM transactions ${buildWhereSql(scope.where)}`,
            scope.params,
        );
        return Number(row && row.total ? row.total : 0);
    }

    async getUsageStats() {
        await this.ready;

        const [categoryRows, paymentMethodRows] = await Promise.all([
            this.all(
                `SELECT category, COUNT(1) AS total
                 FROM transactions
                 GROUP BY category`,
            ),
            this.all(
                `SELECT payment_method, COUNT(1) AS total
                 FROM transactions
                 GROUP BY payment_method`,
            ),
        ]);

        const categoryUsage = {};
        const paymentMethodUsage = {};

        for (const row of categoryRows) {
            const key = String(row.category || '').trim();
            if (!key) continue;
            categoryUsage[key] = Number(row.total || 0);
        }

        for (const row of paymentMethodRows) {
            const key = String(row.payment_method || '').trim();
            if (!key) continue;
            paymentMethodUsage[key] = Number(row.total || 0);
        }

        return { categoryUsage, paymentMethodUsage };
    }

    async getMonthlySummary(query = {}, budgetYen = 0) {
        await this.ready;

        const scope = buildScopeDateWhereClause(query);
        const where = ['currency = ?'];
        const params = ['JPY'];
        where.push(...scope.where);
        params.push(...scope.params);
        const reimburseCondition = [
            "category LIKE '%식비받은거%'",
            "category LIKE '%현금받음(식비)%'",
            "category LIKE '%식비정산환급%'",
        ].join(' OR ');

        const [monthlyRows, categoryRows] = await Promise.all([
            this.all(
                `
                SELECT
                    substr(date, 1, 7) AS month,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS expense,
                    COALESCE(SUM(CASE WHEN category = '식비' AND amount < 0 THEN -amount ELSE 0 END), 0) AS food,
                    COALESCE(SUM(CASE WHEN category LIKE '%총무%' AND amount < 0 THEN -amount ELSE 0 END), 0) AS groupPay,
                    COALESCE(SUM(
                        CASE
                            WHEN ${reimburseCondition}
                                THEN CASE
                                    WHEN amount > 0 THEN amount
                                    WHEN amount < 0 THEN -amount
                                    ELSE 0
                                END
                            ELSE 0
                        END
                    ), 0) AS reimburse
                FROM transactions
                ${buildWhereSql(where)}
                GROUP BY substr(date, 1, 7)
                ORDER BY month ASC
                `,
                params,
            ),
            this.all(
                `
                SELECT
                    substr(date, 1, 7) AS month,
                    category,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS expense
                FROM transactions
                ${buildWhereSql(where)}
                GROUP BY substr(date, 1, 7), category
                ORDER BY month ASC, category ASC
                `,
                params,
            ),
        ]);

        const byMonth = new Map();
        for (const row of categoryRows) {
            const month = String(row.month || '');
            if (!month) continue;
            if (!byMonth.has(month)) byMonth.set(month, {});
            byMonth.get(month)[String(row.category || '기타')] = Number(row.expense || 0);
        }

        return monthlyRows.map(row => {
            const food = Number(row.food || 0);
            const groupPay = Number(row.groupPay || 0);
            const reimburse = Number(row.reimburse || 0);
            const effective = food + groupPay - reimburse;
            return {
                month: String(row.month || ''),
                income: Number(row.income || 0),
                expense: Number(row.expense || 0),
                byCategory: byMonth.get(String(row.month || '')) || {},
                effectiveFood: {
                    food,
                    groupPay,
                    reimburse,
                    effective,
                    budget: budgetYen,
                    budgetDelta: budgetYen - effective,
                    status: effective > budgetYen ? 'OVER' : 'OK',
                },
            };
        });
    }

    async getEffectiveFoodStats(query = {}, budgetYen = 0) {
        await this.ready;

        const scope = buildScopeDateWhereClause(query);
        const reimburseCondition = [
            "category LIKE '%식비받은거%'",
            "category LIKE '%현금받음(식비)%'",
            "category LIKE '%식비정산환급%'",
        ].join(' OR ');

        const row = await this.get(
            `
            SELECT
                COALESCE(SUM(CASE WHEN currency = 'JPY' AND category = '식비' AND amount < 0 THEN -amount ELSE 0 END), 0) AS food,
                COALESCE(SUM(CASE WHEN currency = 'JPY' AND category LIKE '%총무%' AND amount < 0 THEN -amount ELSE 0 END), 0) AS groupPay,
                COALESCE(SUM(
                    CASE
                        WHEN currency = 'JPY' AND (${reimburseCondition})
                            THEN CASE
                                WHEN amount > 0 THEN amount
                                WHEN amount < 0 THEN -amount
                                ELSE 0
                            END
                        ELSE 0
                    END
                ), 0) AS reimburse
            FROM transactions
            ${buildWhereSql(scope.where)}
            `,
            scope.params,
        );

        const food = Number(row && row.food ? row.food : 0);
        const groupPay = Number(row && row.groupPay ? row.groupPay : 0);
        const reimburse = Number(row && row.reimburse ? row.reimburse : 0);
        const effective = food + groupPay - reimburse;

        return {
            food,
            groupPay,
            reimburse,
            effective,
            budget: budgetYen,
            budgetDelta: budgetYen - effective,
            status: effective > budgetYen ? 'OVER' : 'OK',
        };
    }

    async getMonthCount(query = {}) {
        await this.ready;

        if (query.month) return 1;

        const from = parseMonthText(query.fromMonth);
        const to = parseMonthText(query.toMonth);
        if (from && to) {
            return Math.max(1, (to.year - from.year) * 12 + (to.month - from.month) + 1);
        }

        const scope = buildScopeDateWhereClause(query);
        const row = await this.get(
            `SELECT COUNT(DISTINCT substr(date, 1, 7)) AS monthCount FROM transactions ${buildWhereSql(scope.where)}`,
            scope.params,
        );
        return Math.max(1, Number(row && row.monthCount ? row.monthCount : 0));
    }

    async deleteTransaction(id) {
        await this.ready;

        return this.withTransaction(async () => {
            const current = await this.getTransactionById(id);
            if (!current) return null;
            await this.run('DELETE FROM transactions WHERE id = ?', [Number(id)]);
            return current;
        });
    }

    async restoreTransaction(input) {
        await this.ready;
        const tx = {
            id: Number.isFinite(Number(input.id)) ? Math.trunc(Number(input.id)) : this.nextId(),
            date: input.date,
            item: input.item,
            amount: Number(input.amount),
            category: input.category,
            paymentMethod: input.paymentMethod,
            memo: input.memo,
            currency: input.currency,
            tags: Array.isArray(input.tags) ? input.tags : [],
            created_at: input.created_at ? String(input.created_at) : new Date().toISOString(),
            updated_at: Object.prototype.hasOwnProperty.call(input, 'updated_at') ? input.updated_at : null,
        };

        await this.run(
            `INSERT OR REPLACE INTO transactions (id, date, item, amount, category, payment_method, memo, currency, tags_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                tx.updated_at,
            ],
        );

        return this.getTransactionById(tx.id);
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
        db.close();
    }

    run(sql, params = []) {
        const result = this.db.prepare(sql).run(...params);
        return Promise.resolve({
            lastID: Number(result.lastInsertRowid || 0),
            changes: Number(result.changes || 0),
        });
    }

    get(sql, params = []) {
        const row = this.db.prepare(sql).get(...params);
        return Promise.resolve(row || null);
    }

    all(sql, params = []) {
        const rows = this.db.prepare(sql).all(...params);
        return Promise.resolve(Array.isArray(rows) ? rows : []);
    }

    exec(sql) {
        this.db.exec(sql);
        return Promise.resolve();
    }
}

module.exports = {
    SqliteRepository,
};
