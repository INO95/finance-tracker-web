# 4-Week Maintainability Upgrade Report (Beginner-Friendly)

This document explains what changed and why in one place.
External APIs (`/api/finance/*`) keep the same meaning and response shape; only internal structure was improved.

## 1) One-Line Summary

- Before: Large files mixed many responsibilities, so it was hard to predict impact when editing.
- After: Frontend/backend/repository/test boundaries are clearer, so change location and verification path are obvious.

## 2) Before vs After Structure

### Frontend

- Before: `public/index.html` contained mixed state/render/API/event logic.
- After:
  - Markup: `public/index.html`
  - Style: `public/assets/css/main.css`
  - Logic: `public/assets/js/state.js`, `format.js`, `api.js`, `render.js`, `modals.js`, `app.js`

### Backend Router

- Before: `src/router.js` contained routing/validation/response/static serving in one file.
- After:
  - Compatibility adapter: `src/router.js`
  - Actual HTTP router: `src/http/router.js`
  - Feature routes: `src/http/routes/*.js`
  - Validation module: `src/domain/validation/transaction.js`
  - Response helpers: `src/http/response.js`

### Repository Query

- Before: list first, then memory-side filtering/sorting/pagination.
- After:
  - SQLite: SQL filtering/sorting/pagination in `src/repository/sqliteRepository.js`
  - JSON: same signature in `src/repository/jsonRepository.js`
  - Summary APIs use internal `paginate: false` to avoid truncation on large datasets.

## 3) System Visibility (5 Blocks)

### Input

- User input (transaction/scope), local settings (token/defaults), server policy config.

### Core Loop

- UI event -> API call -> router validation -> repository query/aggregation -> JSON response -> re-render.

### Value Engine

- Monthly summary
- Effective food-cost calculation
- Budget alert levels (`ok`, `warn`, `danger`)

### Feedback Loop

- Alert text, monthly comments, form status messages
- CI benchmark comment + `beginner summary`

### Scaling Lever

- Frontend module boundaries (`public/assets/js/*`)
- Route boundaries (`src/http/routes/*`)
- Repository query boundary (`listTransactions(query?)`)

## 4) Verification Results

- Tests: `npm test` passed
- Static assets:
  - `/assets/js/app.js` returns 200
  - `/assets/../src/router.js` blocked (403/404)
- Auth branch: write APIs keep 401/200 behavior in token mode
- Query consistency: sqlite/json parity test added
- XSS: escape behavior preserved
- Performance smoke: 10k rows benchmark passes p95 threshold

Related test files:

- `tests/api/query-compat.test.js`
- `tests/api/static-assets.test.js`
- `tests/api/auth-and-validation.test.js`
- `tests/security/xss.test.js`
- `tests/api/benchmark-smoke.test.js`

## 5) Beginner Checkpoints

- "Did API endpoints change?" -> No. `/api/finance/*` compatibility is preserved.
- "Why split files?" -> To reduce edit risk and make failure points easier to find.
- "Did performance improve?" -> At minimum, no regression is allowed by CI gates.
- "What is the biggest change?" -> Structural decomposition + expanded test safety net.

## 6) Next Step (Weeks 5-8 Proposal)

- Gradual TypeScript introduction starting from `src/domain` and `public/assets/js/format.js`
- SQLite search optimization (FTS/index review)
- UI e2e automation for core user flows
