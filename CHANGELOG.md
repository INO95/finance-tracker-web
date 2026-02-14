# Changelog

All notable changes to this project are documented in this file.

## [2026-02-14] - 4-Week Maintainability Upgrade (Non-Breaking)

Beginner summary:
- The app behavior/API stayed the same, but internal code was split and tested more to make future edits safer.

### Added
- Frontend module split under `public/assets/js/*` and `public/assets/css/main.css`.
- Secure static assets route for `/assets/*` with path traversal blocking and explicit MIME mapping.
- Expanded test suite (now 28 passing tests), including:
  - API auth/validation/meta/usage/static assets checks
  - SQLite vs JSON query compatibility contract tests
  - Static MIME/path sanitization unit tests
  - Benchmark smoke and compare unit tests
- CI benchmark compare flow with PR-friendly summary (`beginner summary`, trend labels).
- Beginner-focused maintenance report docs:
  - `docs/guide/06-maintenance-upgrade-report.ko.md`
  - `docs/guide/06-maintenance-upgrade-report.md`

### Changed
- Backend router decomposed into `src/http/router.js`, `src/http/routes/*.js`, `src/http/response.js`, and `src/domain/validation/transaction.js`.
- `src/router.js` kept as compatibility adapter (re-export) to avoid breaking existing imports.
- Repository query path upgraded:
  - `listTransactions(query?)` supports richer query handling
  - SQLite handles filter/sort/pagination/total in SQL
  - JSON repository aligns to the same signature
- Summary routes use internal `paginate: false` path to avoid truncation on large-scope queries.
- Modal update flow stabilized to `loadMeta -> refresh` order to reduce UI state race/mismatch.

### Security
- Static path traversal hardening for `/assets/*`.
- XSS escape behavior preserved and regression-tested.

### Verification
- `npm test`: pass (28/28)
- `npm run ci:local`: pass
- 10k benchmark smoke: p95 threshold gate pass

