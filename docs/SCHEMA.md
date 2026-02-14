# Data Schema

## finance_db.json

Main data file stored in `data/finance_db.json`.
For first run, copy `data/example.json` to `data/finance_db.json`.

```json
{
  "config": {
    "schemaVersion": 2,
    "currency": "JPY",
    "owner": "",
    "last_updated": "2026-02-08"
  },
  "transactions": [],
  "liabilities": {
    "creditCards": {}
  },
  "categories": []
}
```

---

## Transaction Object

```json
{
  "id": 1738912345678,
  "date": "2026-02-08",
  "item": "점심 식사",
  "amount": -1200,
  "category": "식비",
  "paymentMethod": "현금",
  "memo": "라멘",
  "currency": "JPY",
  "tags": ["외식"],
  "created_at": "2026-02-08T12:30:00.000Z",
  "updated_at": "2026-02-08T12:35:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Timestamp-based unique ID |
| `date` | string | Transaction date (YYYY-MM-DD) |
| `item` | string | Description (max 120 chars) |
| `amount` | number | Negative = expense, positive = income |
| `category` | string | Category name |
| `paymentMethod` | string | Payment method name |
| `memo` | string | Optional note (max 200 chars) |
| `currency` | string | `JPY`, `KRW`, or `USD` |
| `tags` | array | Optional tags |
| `created_at` | string | ISO timestamp |
| `updated_at` | string | ISO timestamp (if updated) |

---

## config/default.json

Application configuration.

```json
{
  "categories": {
    "식비": { "icon": "🍽️" },
    "교통비": { "icon": "🚃" }
  },
  "paymentMethods": {
    "현금": { "type": "cash" },
    "스미토모": { "type": "bank" }
  },
  "financePolicy": {
    "realFoodBudgetMonthlyYen": 60000,
    "creditCards": ["올리브 카드 (크레짓)", "아마존 카드"]
  }
}
```

---

## Supported Currencies

| Code | Symbol | Name |
|------|--------|------|
| JPY | ¥ | Japanese Yen |
| KRW | ₩ | Korean Won |
| USD | $ | US Dollar |

---

## Food Budget Calculation

"Effective food cost" adjusts raw food expenses:

```
effective = 식비 + 식비(총무) - 식비정산환급
```

- `식비`: Direct food expenses
- `식비(총무)`: Group meal payments (you paid for others)
- `식비정산환급`: Reimbursements received

This gives a more accurate picture of actual personal food spending.

---

## SQLite Schema (`data/schema.sql`)

When `FINANCE_STORAGE_DRIVER=sqlite`, transactions are stored in `transactions` table.

Key points:
- Primary key: `id` (timestamp+sequence integer)
- Amount convention: negative = expense, positive = income
- Tag storage: `tags_json` (JSON string)
- Indexes: `date`, `category`, `payment_method`
