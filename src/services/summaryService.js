const SUPPORTED_CURRENCIES = new Set(['JPY', 'KRW', 'USD']);

function monthOf(dateText) {
    return String(dateText || '').slice(0, 7);
}

function monthToNumber(monthText) {
    const m = String(monthText || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return Number(m[1]) * 100 + month;
}

function inMonthRange(monthText, fromMonth, toMonth) {
    const n = monthToNumber(monthText);
    if (n == null) return false;
    const fromN = monthToNumber(fromMonth);
    const toN = monthToNumber(toMonth);
    if (fromN != null && n < fromN) return false;
    if (toN != null && n > toN) return false;
    return true;
}

function filterRowsByMonthScope(rows, { month = '', fromMonth = '', toMonth = '' } = {}) {
    if (month) return rows.filter(row => monthOf(row.date) === month);
    if (fromMonth || toMonth) return rows.filter(row => inMonthRange(monthOf(row.date), fromMonth, toMonth));
    return rows;
}

function normalizeTransaction(tx) {
    const amount = Number(tx.amount || 0);
    const currency = SUPPORTED_CURRENCIES.has(String(tx.currency || 'JPY')) ? String(tx.currency || 'JPY') : 'JPY';
    return {
        id: tx.id || null,
        date: tx.date || '',
        item: tx.item || '',
        income: amount > 0 ? amount : 0,
        expense: amount < 0 ? Math.abs(amount) : 0,
        paymentMethod: tx.paymentMethod || '',
        category: tx.category || '기타',
        memo: tx.memo || '',
        currency,
        tags: Array.isArray(tx.tags) ? tx.tags : [],
        source: 'db',
    };
}

function computeEffectiveFood(rows, budgetYen) {
    let food = 0;
    let groupPay = 0;
    let reimburse = 0;
    for (const row of rows) {
        if (String(row.currency || 'JPY') !== 'JPY') continue;
        const c = String(row.category || '');
        const out = Number(row.expense || 0);
        const input = Number(row.income || 0);
        if (/^식비$/.test(c)) food += out;
        else if (/식비\(총무\)|총무/.test(c)) groupPay += out;
        else if (/식비받은거|현금받음\(식비\)|식비정산환급/.test(c)) reimburse += input > 0 ? input : out;
    }
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

function monthParts(monthText) {
    const normalized = monthToNumber(monthText);
    if (normalized == null) return null;
    return {
        year: Math.trunc(normalized / 100),
        month: normalized % 100,
    };
}

function countMonthsFromRange({ month = '', fromMonth = '', toMonth = '' } = {}, rows = []) {
    if (month) return 1;
    const from = monthParts(fromMonth);
    const to = monthParts(toMonth);
    if (from && to) {
        return Math.max(1, (to.year - from.year) * 12 + (to.month - from.month) + 1);
    }
    const uniqueMonths = new Set(rows.map(r => monthOf(r.date)).filter(Boolean));
    return Math.max(1, uniqueMonths.size);
}

function computeMonthlySummary(rows, budgetYen) {
    const monthly = new Map();
    for (const row of rows) {
        if (String(row.currency || 'JPY') !== 'JPY') continue;
        const m = monthOf(row.date);
        if (!m) continue;
        if (!monthly.has(m)) {
            monthly.set(m, {
                month: m,
                income: 0,
                expense: 0,
                byCategory: {},
                foodRows: [],
            });
        }
        const bucket = monthly.get(m);
        bucket.income += Number(row.income || 0);
        bucket.expense += Number(row.expense || 0);
        const category = String(row.category || '기타');
        bucket.byCategory[category] = (bucket.byCategory[category] || 0) + Number(row.expense || 0);
        bucket.foodRows.push(row);
    }

    const out = [];
    for (const bucket of monthly.values()) {
        out.push({
            month: bucket.month,
            income: bucket.income,
            expense: bucket.expense,
            byCategory: bucket.byCategory,
            effectiveFood: computeEffectiveFood(bucket.foodRows, budgetYen),
        });
    }

    return out.sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

function computeUsageStats(rows) {
    const categoryUsage = {};
    const paymentMethodUsage = {};
    for (const row of rows) {
        const category = String(row.category || '').trim();
        const method = String(row.paymentMethod || '').trim();
        if (category) categoryUsage[category] = (categoryUsage[category] || 0) + 1;
        if (method) paymentMethodUsage[method] = (paymentMethodUsage[method] || 0) + 1;
    }
    return { categoryUsage, paymentMethodUsage };
}

function validateMonthScope({ month = '', fromMonth = '', toMonth = '' } = {}) {
    const errors = [];
    const hasValidMonthFormat = value => /^\d{4}-\d{2}$/.test(String(value || ''));

    if (month && (!hasValidMonthFormat(month) || monthToNumber(month) == null)) errors.push('month must be YYYY-MM');
    if (fromMonth && (!hasValidMonthFormat(fromMonth) || monthToNumber(fromMonth) == null)) errors.push('fromMonth must be YYYY-MM');
    if (toMonth && (!hasValidMonthFormat(toMonth) || monthToNumber(toMonth) == null)) errors.push('toMonth must be YYYY-MM');

    const fromN = monthToNumber(fromMonth);
    const toN = monthToNumber(toMonth);
    if (fromN != null && toN != null && fromN > toN) {
        errors.push('fromMonth cannot be greater than toMonth');
    }

    return errors;
}

module.exports = {
    SUPPORTED_CURRENCIES,
    monthOf,
    monthToNumber,
    filterRowsByMonthScope,
    normalizeTransaction,
    computeEffectiveFood,
    countMonthsFromRange,
    computeMonthlySummary,
    computeUsageStats,
    validateMonthScope,
};
