const fs = require('fs');
const path = require('path');

function defaultFinanceDb() {
    return {
        config: { schemaVersion: 2, currency: 'JPY', owner: '', last_updated: null },
        transactions: [],
        liabilities: { creditCards: {} },
        categories: [],
    };
}

function createTimestampSequenceIdGenerator() {
    let lastTimestamp = 0;
    let sequence = 0;

    return function nextId() {
        const now = Date.now();
        const base = Math.max(now, lastTimestamp);
        if (base === lastTimestamp) {
            sequence += 1;
            if (sequence >= 1000) {
                lastTimestamp += 1;
                sequence = 0;
            }
        } else {
            lastTimestamp = base;
            sequence = 0;
        }

        return lastTimestamp * 1000 + sequence;
    };
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

function monthToNumber(monthText) {
    const m = String(monthText || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 100 + Number(m[2]);
}

function applyListQuery(transactions, query) {
    const safeQuery = {
        month: String(query.month || ''),
        fromMonth: String(query.fromMonth || ''),
        toMonth: String(query.toMonth || ''),
        category: String(query.category || ''),
        memo: String(query.memo || ''),
        q: String(query.q || ''),
        sort: String(query.sort || 'date_desc'),
        paginate: normalizePaginateFlag(query.paginate, true),
        page: normalizeQueryNumber(query.page, 1, { min: 1, max: 1000000 }),
        limit: normalizeQueryNumber(query.limit, 100, { min: 1, max: 100 }),
    };

    let out = [...transactions];

    if (safeQuery.month) {
        out = out.filter(tx => String(tx.date || '').slice(0, 7) === safeQuery.month);
    } else {
        const fromN = monthToNumber(safeQuery.fromMonth);
        const toN = monthToNumber(safeQuery.toMonth);
        if (fromN != null || toN != null) {
            out = out.filter(tx => {
                const n = monthToNumber(String(tx.date || '').slice(0, 7));
                if (n == null) return false;
                if (fromN != null && n < fromN) return false;
                if (toN != null && n > toN) return false;
                return true;
            });
        }
    }

    if (safeQuery.category) out = out.filter(tx => String(tx.category || '') === safeQuery.category);
    if (safeQuery.memo) {
        const memoKeyword = safeQuery.memo.toLowerCase();
        out = out.filter(tx => String(tx.memo || '').toLowerCase().includes(memoKeyword));
    }
    if (safeQuery.q) {
        const keyword = safeQuery.q.toLowerCase();
        out = out.filter(tx =>
            [tx.item, tx.memo, tx.paymentMethod, tx.category]
                .map(v => String(v || '').toLowerCase())
                .some(v => v.includes(keyword)),
        );
    }

    out.sort((a, b) => {
        const da = String(a.date || '');
        const db = String(b.date || '');
        const expenseA = Number(a.amount || 0) < 0 ? Math.abs(Number(a.amount || 0)) : 0;
        const expenseB = Number(b.amount || 0) < 0 ? Math.abs(Number(b.amount || 0)) : 0;
        if (safeQuery.sort === 'date_asc') return da.localeCompare(db);
        if (safeQuery.sort === 'expense_desc') return expenseB - expenseA;
        if (safeQuery.sort === 'expense_asc') return expenseA - expenseB;
        return db.localeCompare(da);
    });

    const total = out.length;
    const rows = safeQuery.paginate
        ? out.slice((safeQuery.page - 1) * safeQuery.limit, (safeQuery.page - 1) * safeQuery.limit + safeQuery.limit)
        : out;
    return { total, rows };
}

class JsonRepository {
    constructor({ financeDbPath, dataDir }) {
        this.financeDbPath = financeDbPath;
        this.dataDir = dataDir || path.dirname(financeDbPath);
        this.writeQueue = Promise.resolve();
        this.nextId = createTimestampSequenceIdGenerator();
    }

    async listTransactions(query = null) {
        const db = await this.readFinanceDb();
        const txs = Array.isArray(db.transactions) ? db.transactions : [];
        if (!hasQueryFilter(query)) return txs;
        return applyListQuery(txs, query || {});
    }

    async createTransaction(input) {
        return this.enqueueMutation(async db => {
            const tx = {
                id: this.nextId(),
                date: input.date,
                item: input.item,
                amount: input.amount,
                category: input.category,
                paymentMethod: input.paymentMethod,
                memo: input.memo,
                currency: input.currency,
                tags: Array.isArray(input.tags) ? input.tags : [],
                created_at: new Date().toISOString(),
            };

            db.transactions.push(tx);
            db.config = db.config || {};
            db.config.last_updated = tx.date;
            return tx;
        });
    }

    async updateTransaction(id, patch) {
        return this.enqueueMutation(async db => {
            const idx = db.transactions.findIndex(t => Number(t.id) === Number(id));
            if (idx < 0) return null;

            const prev = db.transactions[idx];
            const next = {
                ...prev,
                ...patch,
                updated_at: new Date().toISOString(),
            };
            db.transactions[idx] = next;
            return next;
        });
    }

    async updateTransactionTags(id, { add = [], remove = [] } = {}) {
        return this.enqueueMutation(async db => {
            const idx = db.transactions.findIndex(t => Number(t.id) === Number(id));
            if (idx < 0) return null;

            const before = Array.isArray(db.transactions[idx].tags) ? db.transactions[idx].tags : [];
            const set = new Set(before);
            for (const tag of add) if (tag) set.add(tag);
            for (const tag of remove) if (tag) set.delete(tag);

            db.transactions[idx].tags = [...set];
            db.transactions[idx].updated_at = new Date().toISOString();
            return db.transactions[idx];
        });
    }

    async close() {
        return;
    }

    enqueueMutation(mutator) {
        const operation = this.writeQueue.then(async () => {
            const db = await this.readFinanceDb();
            db.transactions = Array.isArray(db.transactions) ? db.transactions : [];
            const result = await mutator(db);
            await this.writeFinanceDb(db);
            return result;
        });

        this.writeQueue = operation.then(() => undefined, () => undefined);
        return operation;
    }

    async readFinanceDb() {
        try {
            const raw = await fs.promises.readFile(this.financeDbPath, 'utf8');
            const parsed = JSON.parse(raw);
            parsed.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
            return parsed;
        } catch (error) {
            if (error && error.code === 'ENOENT') return defaultFinanceDb();
            try {
                return defaultFinanceDb();
            } catch {
                return defaultFinanceDb();
            }
        }
    }

    async writeFinanceDb(db) {
        await fs.promises.mkdir(this.dataDir, { recursive: true });

        const tmpPath = `${this.financeDbPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const payload = JSON.stringify(db, null, 2);
        await fs.promises.writeFile(tmpPath, payload, 'utf8');
        try {
            await fs.promises.rename(tmpPath, this.financeDbPath);
        } catch (error) {
            try {
                await fs.promises.unlink(tmpPath);
            } catch {
                // ignore cleanup failures
            }
            throw error;
        }
    }
}

module.exports = {
    JsonRepository,
    createTimestampSequenceIdGenerator,
};
