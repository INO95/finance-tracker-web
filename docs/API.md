# API Reference

Base URL: `http://localhost:4380/api/finance`

## Authentication

For write operations (`POST`, `PATCH`, `DELETE`), include `X-Api-Token` header if `FINANCE_WEB_API_TOKEN` is configured.

```
X-Api-Token: your-token-here
```

---

## Endpoints

### GET /transactions

List transactions with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `month` | string | Filter by month (YYYY-MM) |
| `fromMonth` | string | Range start (YYYY-MM) |
| `toMonth` | string | Range end (YYYY-MM) |
| `category` | string | Filter by category |
| `q` | string | Search in item, memo, paymentMethod, category |
| `memo` | string | Filter by memo content |
| `paginate` | boolean-ish | Set `false` to return all matching rows without slicing |
| `limit` | number | Results per page (1-100, default: 100) |
| `page` | number | Page number (default: 1) |
| `sort` | string | `date_desc`, `date_asc`, `expense_desc`, `expense_asc` |

> Validation: when both `fromMonth` and `toMonth` are provided, `fromMonth` must be less than or equal to `toMonth`.

**Response:**

```json
{
  "total": 150,
  "page": 1,
  "limit": 100,
  "rows": [
    {
      "id": 1738912345678,
      "date": "2026-02-08",
      "item": "편의점",
      "income": 0,
      "expense": 500,
      "category": "식비",
      "paymentMethod": "현금",
      "memo": "",
      "currency": "JPY",
      "tags": [],
      "source": "db"
    }
  ]
}
```

---

### POST /transactions

Create a new transaction.

**Request Body:**

```json
{
  "date": "2026-02-08",
  "item": "점심",
  "amount": -1200,
  "category": "식비",
  "paymentMethod": "현금",
  "memo": "라멘",
  "currency": "JPY",
  "tags": ["외식"]
}
```

> **Note:** Negative amount = expense, positive = income
> **Note:** `paymentMethod` accepts non-empty text (including user-defined methods from UI local settings).

**Response:**

```json
{
  "ok": true,
  "transaction": { ... }
}
```

---

### PATCH /transactions/:id

Update an existing transaction. Send only fields to update.

**Request Body:**

```json
{
  "memo": "updated memo",
  "category": "외식"
}
```

---

### DELETE /transactions/:id

Delete a transaction and return the deleted row payload so the UI can offer undo/restore.

**Response:**

```json
{
  "ok": true,
  "transaction": {
    "id": 1738912345678,
    "date": "2026-02-08",
    "item": "점심",
    "amount": -1200,
    "category": "식비",
    "paymentMethod": "현금",
    "memo": "라멘",
    "currency": "JPY",
    "tags": [],
    "created_at": "2026-02-08T01:00:00.000Z",
    "updated_at": null
  }
}
```

---

### POST /transactions/restore

Restore a previously deleted transaction. The request body should be the deleted row payload returned by `DELETE /transactions/:id`.

**Request Body:**

```json
{
  "id": 1738912345678,
  "date": "2026-02-08",
  "item": "점심",
  "amount": -1200,
  "category": "식비",
  "paymentMethod": "현금",
  "memo": "라멘",
  "currency": "JPY",
  "tags": [],
  "created_at": "2026-02-08T01:00:00.000Z",
  "updated_at": null
}
```

---

### POST /transactions/:id/tags

Add or remove tags.

```json
{
  "add": ["회식", "정산"],
  "remove": ["개인"]
}
```

---

### GET /summary

Monthly summary with effective food calculation.

**Query Parameters:** `month`, `fromMonth`, `toMonth`

**Response:**

```json
{
  "rowCount": 45,
  "monthly": [
    {
      "month": "2026-02",
      "income": 300000,
      "expense": 125000,
      "byCategory": { "식비": 45000, "교통비": 12000 },
      "effectiveFood": {
        "food": 35000,
        "groupPay": 15000,
        "reimburse": 5000,
        "effective": 45000,
        "budget": 60000,
        "budgetDelta": 15000,
        "status": "OK"
      }
    }
  ],
  "latestMonth": { ... }
}
```

---

### GET /effective-food

Calculate effective food cost (adjusting for group payments and reimbursements).

---

### GET /alerts/real-food

Food budget alert with status level.

**Response:**

```json
{
  "month": "2026-02",
  "level": "ok",
  "ratio": 75,
  "message": "실질 식비가 예산 범위입니다.",
  "effective": 45000,
  "budget": 60000
}
```

---

### GET /meta

Available categories and payment methods.

**Response fields:**
- `currencies`
- `categories`
- `paymentMethods`
- `foodBudgetYen`
- `categoryBudgets`

---

### GET /settings

Current persisted budget settings.

```json
{
  "foodBudgetYen": 70000,
  "categoryBudgets": {
    "식비": 20000,
    "교통비": 10000
  }
}
```

### POST /settings

Update budget settings. Partial payloads are allowed.

```json
{
  "foodBudgetYen": 70000,
  "categoryBudgets": {
    "식비": 20000,
    "교통비": 10000
  }
}
```

Notes:
- `foodBudgetYen` must be a positive number.
- `categoryBudgets` must be an object of non-negative numbers.
- A category budget set to `0` is removed from the persisted config.

---

## Browser-Local Features

The following UI features do not have dedicated server endpoints because they are intentionally stored in browser `localStorage`:
- recurring transaction templates
- balance reconciliation snapshots
- local form defaults and custom UI-only lists

---

### GET /usage

Category and payment method usage statistics.

---

### GET /health

Health check endpoint.

```json
{
  "ok": true,
  "timestamp": "2026-02-08T08:30:00.000Z"
}
```

---

## Error Responses

```json
{
  "ok": false,
  "error": "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)",
  "details": ["date must be YYYY-MM-DD"],
  "errorCode": "validation_failed"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad request / parse error |
| 401 | Unauthorized (invalid token) |
| 404 | Not found |
| 405 | Method not allowed |
| 422 | Validation error |
