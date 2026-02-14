CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    item TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT 'JPY',
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);
