# Finance Tracker Web 튜토리얼 팩

이 문서는 비전공자와 초급 개발자가 이 저장소를 **구조적으로** 이해하도록 돕는 입문 허브입니다.

## 시작하기

- 권장 순서대로 읽으면 "화면에서 버튼을 누를 때 내부에서 무슨 일이 일어나는지"까지 연결해서 이해할 수 있습니다.
- 모든 설명은 실제 코드 경로를 근거로 작성했습니다.
- 런타임 동작 변경 없이 문서만 추가한 학습 자료입니다.

## 문서 맵

| 순서 | 문서 | 읽는 시간 | 목적 |
|---|---|---:|---|
| 0 | `docs/guide/README.ko.md` | 5분 | 전체 학습 경로 파악 |
| 1 | `docs/guide/01-system-overview.ko.md` | 12분 | 시스템 5블록 아키텍처 이해 |
| 2 | `docs/guide/02-request-lifecycle.ko.md` | 15분 | 요청 생명주기(저장/조회/실패) 이해 |
| 3 | `docs/guide/03-data-and-storage.ko.md` | 14분 | 데이터 모델과 저장 전략 이해 |
| 4 | `docs/guide/04-design-intent-and-tradeoffs.ko.md` | 12분 | 설계 의도와 트레이드오프 이해 |
| 5 | `docs/guide/05-beginner-walkthrough.ko.md` | 20분 | 로컬 실행 + API 실습 + 코드 읽기 |
| 6 | `docs/guide/06-maintenance-upgrade-report.ko.md` | 10분 | 4주 유지보수 개선 결과 한눈에 보기 |

참고: 영문 요약본은 `docs/guide/06-maintenance-upgrade-report.md`를 확인하세요.

## 학습 경로

### 비전공자 추천 경로

1. `01-system-overview.ko.md`
2. `02-request-lifecycle.ko.md`
3. `04-design-intent-and-tradeoffs.ko.md`
4. 필요 시 `05-beginner-walkthrough.ko.md`의 실행 파트만 따라하기

### 초급 개발자 추천 경로

1. `01-system-overview.ko.md`
2. `03-data-and-storage.ko.md`
3. `02-request-lifecycle.ko.md`
4. `05-beginner-walkthrough.ko.md`
5. `04-design-intent-and-tradeoffs.ko.md`

## 코드 근거 매트릭스 (요약)

| 설명 주제 | 근거 파일 |
|---|---|
| 서버 시작 흐름 | `src/server.js`, `src/app.js` |
| 라우팅/유효성 검사/응답 | `src/router.js`, `src/http/router.js`, `src/http/routes/*.js`, `src/domain/validation/transaction.js` |
| 월별 요약/실질 식비 계산 | `src/services/summaryService.js` |
| 저장소 드라이버 선택 | `src/repository/storage.js` |
| SQLite 저장 구현 | `src/repository/sqliteRepository.js` |
| JSON 저장 구현 | `src/repository/jsonRepository.js` |
| 프론트 이벤트/API 호출 | `public/index.html`, `public/assets/js/*.js` |
| 스키마/마이그레이션 | `data/schema.sql`, `scripts/migrate-json-to-sqlite.js` |
| 동작 검증 케이스 | `tests/api/*.test.js`, `tests/security/xss.test.js` |

## 빠른 점검 체크리스트

- [ ] `npm test`가 통과하는지 확인
- [ ] `GET /api/health` 응답이 `ok: true`인지 확인
- [ ] `GET /api/finance/summary?month=2026-02`의 응답 구조를 문서와 비교
- [ ] `GET /api/finance/transactions?limit=10&page=1`의 페이지네이션 구조 확인
- [ ] `fromMonth > toMonth`일 때 `422 validation_failed`가 나오는지 확인
- [ ] 토큰 설정 전/후 쓰기 요청(`POST/PATCH`) 동작 차이를 이해했는지 확인

## 다음 읽기

- 아키텍처를 먼저 잡고 싶다면: `docs/guide/01-system-overview.ko.md`
- 바로 흐름을 따라가고 싶다면: `docs/guide/02-request-lifecycle.ko.md`
