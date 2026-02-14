# Finance Tracker Web

> Personal expense tracking web application with multi-currency support (JPY/KRW/USD)

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Overview

A lightweight, self-hosted personal finance tracker designed for:
- Daily income/expense recording
- Monthly food budget tracking with "effective food cost" analysis
- Multi-currency support (JPY, KRW, USD)
- Customizable categories and payment methods

**Tech Stack:** Pure Node.js (no external dependencies), vanilla HTML/CSS/JS

## Features

- **Transaction CRUD** — Add, edit, and search transactions via API
- **Budget Alerts** — Track food expenses with reimbursement adjustments
- **Monthly Summary** — Visual breakdown by category
- **Multi-Currency** — JPY (¥), KRW (₩), USD ($)
- **Customization** — Add custom categories and payment methods
- **Responsive UI** — Mobile-friendly dashboard
- **Token Auth** — Optional API authentication

## Quick Start

### Prerequisites
- Node.js 18+

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/finance-tracker-web.git
cd finance-tracker-web
cp .env.example .env
cp data/example.json data/finance_db.json
npm run migrate:sqlite
```

### Run

```bash
npm start
# or
node src/server.js
```

Open http://localhost:4380 in your browser.

### Connectivity Check

```bash
curl http://127.0.0.1:4380/api/health
```

### Test

```bash
npm test
```

Coverage includes:
- API auth/validation regression checks
- `sqlite` vs `json` query compatibility checks (`month/fromMonth/toMonth`, `sort`, `page`, `limit`)
- Static asset security checks (`/assets/*` traversal block + MIME mapping)

### Docker

```bash
docker build -t finance-tracker-web .
docker run -p 4380:4380 -v $(pwd)/data:/app/data finance-tracker-web
```

Or with docker compose:

```bash
docker compose up -d
curl http://127.0.0.1:4380/api/health
docker compose down
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FINANCE_WEB_PORT` | `4380` | Server port |
| `FINANCE_WEB_HOST` | `127.0.0.1` | Bind address |
| `FINANCE_WEB_API_TOKEN` | (empty) | API token for write operations |
| `FINANCE_CORS_ORIGIN` | `*` | CORS allowed origin |
| `FINANCE_STORAGE_DRIVER` | `sqlite` | Storage backend (`sqlite` or `json`) |
| `FINANCE_SQLITE_PATH` | `./data/finance_db.sqlite` | SQLite file path |

### Config File

Edit `config/default.json` to customize categories and payment methods.

### JSON -> SQLite Migration

```bash
npm run migrate:sqlite
```

### Transactions Benchmark (10k smoke)

```bash
npm run bench:transactions
```

Optional tuning:

```bash
node scripts/benchmark-transactions.js --rows 10000 --warmup 20 --measured 120 --limit 100 --p95-threshold-ms 150
```

Save benchmark result JSON:

```bash
node scripts/benchmark-transactions.js --output-json .artifacts/benchmark-transactions.json
```

Run local CI-equivalent checks:

```bash
npm run ci:local
```

Compare head vs base benchmark JSON:

```bash
npm run bench:compare -- --head .artifacts/benchmark-head.json --base .artifacts/benchmark-base.json --max-regression-pct 25
```

### How To Read The Benchmark Result (Beginner)

- `p95(head)`: current branch response speed (95th percentile).
- `p95(base)`: base branch response speed used as comparison.
- `delta`: `head - base`; positive means slower, negative means faster.
- `gates`: PR fails only when both gates are exceeded.
  - percentage gate (`max-regression-pct`)
  - absolute gate in milliseconds (`max-regression-abs-ms`)
- `trend vs previous comment`: change from the previous CI run on the same PR.
  - `IMPROVED`: clearly faster
  - `STABLE`: change is within a small noise band
  - `REGRESSED`: clearly slower
- `beginner summary`: one-line interpretation (`improved`, `stable`, `warning`)

## API Reference

See [docs/API.md](docs/API.md) for full documentation.

## Guides

- Korean guide hub: [docs/guide/README.ko.md](docs/guide/README.ko.md)
- Maintainability upgrade report (KO): [docs/guide/06-maintenance-upgrade-report.ko.md](docs/guide/06-maintenance-upgrade-report.ko.md)
- Maintainability upgrade report (EN): [docs/guide/06-maintenance-upgrade-report.md](docs/guide/06-maintenance-upgrade-report.md)

### Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/finance/transactions` | List transactions |
| POST | `/api/finance/transactions` | Create transaction |
| PATCH | `/api/finance/transactions/:id` | Update transaction |
| GET | `/api/finance/summary` | Monthly summary |
| GET | `/api/finance/meta` | Categories & methods |
| GET | `/api/health` | Health check |

## Screenshots

*Coming soon*

## License

MIT
