# PR Body (Checklist): 4-Week Maintainability Upgrade

## Summary
- [x] Goal: improve maintainability without breaking public API behavior
- [x] Scope: frontend modularization, router boundary split, repository query scalability step-1, test/CI expansion
- [x] Compatibility: `/api/finance/*` response schema and semantics unchanged

## Changes by Week

### Week 1
- [x] Split frontend responsibilities from `public/index.html` into:
  - [x] `public/assets/css/main.css`
  - [x] `public/assets/js/state.js`
  - [x] `public/assets/js/format.js`
  - [x] `public/assets/js/api.js`
  - [x] `public/assets/js/render.js`
  - [x] `public/assets/js/modals.js`
  - [x] `public/assets/js/app.js`
- [x] Add secure static route for `/assets/*`
- [x] Block path traversal (`..`, absolute path, root escape)
- [x] Explicit MIME mapping for `.js/.css/.html/.json/.png/.svg`

### Week 2
- [x] Expand test safety net
  - [x] unit: format/scope/static-mime
  - [x] api: meta-usage/auth-validation/static-assets/query-compat
  - [x] security: XSS regression

### Week 3
- [x] Decompose router boundaries
  - [x] `src/http/router.js`
  - [x] `src/http/routes/{transactions,summary,meta,settings,static}.js`
  - [x] `src/http/response.js`
  - [x] `src/domain/validation/transaction.js`
- [x] Keep compatibility adapter in `src/router.js`

### Week 4
- [x] Extend repository query interface: `listTransactions(query?)`
- [x] SQLite: SQL-based filtering/sorting/pagination + total
- [x] JSON repository: same signature
- [x] Summary routes use internal `paginate:false` path for large-scope completeness
- [x] Benchmark/CI automation with head/base compare and dual gate

## Verification
- [x] `npm test` passed (28/28)
- [x] `npm run ci:local` passed
- [x] static asset serve + traversal block verified
- [x] auth branches (401/200) verified
- [x] sqlite/json query parity verified
- [x] benchmark smoke (10k rows) passed p95 threshold gate

## Risk and Mitigation
- [x] Risk: hidden regression during structural decomposition
- [x] Mitigation: contract tests + security tests + API validation tests + benchmark checks

## Beginner Summary
코드는 더 잘게 나눠서 고치기 쉬워졌고, 테스트가 많이 늘어서 실수로 다른 기능을 망가뜨릴 가능성이 크게 줄었습니다. API는 그대로라서 기존 사용 방식은 유지됩니다.
