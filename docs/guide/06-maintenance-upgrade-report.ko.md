# 4주 유지보수 개선 완료 리포트 (초급자용)

이 문서는 "무엇이 왜 바뀌었는지"를 한 번에 이해하기 위한 요약입니다.
외부 API(`/api/finance/*`)의 의미/응답 형식은 유지했고, 내부 구조만 정리했습니다.

## 1) 한 줄 요약

- 이전: 큰 파일에 코드가 섞여 있어서 수정할 때 영향 범위를 예측하기 어려웠습니다.
- 현재: 프론트/백엔드/저장소/테스트 경계를 분리해서, 고칠 위치와 검증 방법이 명확해졌습니다.

## 2) 변경 전/후 구조

### 프론트엔드

- 이전: `public/index.html` 한 파일에 상태/렌더/API/이벤트가 집중
- 이후:
  - 마크업: `public/index.html`
  - 스타일: `public/assets/css/main.css`
  - 로직: `public/assets/js/state.js`, `format.js`, `api.js`, `render.js`, `modals.js`, `app.js`

### 백엔드 라우터

- 이전: `src/router.js`에 라우팅/검증/응답/정적서빙 로직이 집중
- 이후:
  - 어댑터(호환): `src/router.js`
  - 실제 라우터: `src/http/router.js`
  - 기능별 라우트: `src/http/routes/*.js`
  - 검증 모듈: `src/domain/validation/transaction.js`
  - 응답 헬퍼: `src/http/response.js`

### 저장소 조회

- 이전: 목록 조회 후 메모리에서 다시 필터/정렬/페이지 처리
- 이후:
  - SQLite: `src/repository/sqliteRepository.js`에서 SQL로 처리
  - JSON: `src/repository/jsonRepository.js`도 동일 시그니처 유지
  - 요약 API는 `paginate: false` 내부 옵션으로 범위 조회 누락 방지

## 3) System Visibility (시스템을 5개 블록으로 보기)

### Input

- 사용자 입력(거래/조회조건), 로컬 설정(토큰/기본값), 서버 설정(예산 정책)

### Core Loop

- UI 이벤트 → API 호출 → 라우터 검증 → 저장소 조회/집계 → JSON 응답 → 화면 재렌더

### Value Engine

- 월별 요약
- 실질 식비 계산
- 예산 대비 경고(`ok`, `warn`, `danger`)

### Feedback Loop

- 경고 문구, 월별 코멘트, 폼 상태 메시지
- CI의 벤치마크 코멘트 + `beginner summary`

### Scaling Lever

- 프론트 모듈 경계(`public/assets/js/*`)
- 라우트 경계(`src/http/routes/*`)
- 저장소 질의 경계(`listTransactions(query?)`)

## 4) 검증 결과

- 테스트: `npm test` 통과
- 정적 자산:
  - `/assets/js/app.js` 200
  - `/assets/../src/router.js` 차단(403/404)
- 인증 분기: 토큰 모드에서 쓰기 API 401/200 유지
- 조회 일관성: `sqlite`/`json` 결과 일치 테스트 추가
- XSS: escape 검증 유지
- 성능 스모크: 10k 데이터에서 p95 임계치 기준 통과

관련 테스트 파일:

- `tests/api/query-compat.test.js`
- `tests/api/static-assets.test.js`
- `tests/api/auth-and-validation.test.js`
- `tests/security/xss.test.js`
- `tests/api/benchmark-smoke.test.js`

## 5) 초급자 체크포인트

- "API 주소는 그대로인가?" → 네. `/api/finance/*`는 호환 유지입니다.
- "왜 파일을 나눴나?" → 버그가 나도 수정 위치를 빠르게 찾기 위해서입니다.
- "성능이 좋아졌나?" → 최소한 악화되지 않도록 CI에서 자동 감시합니다.
- "무엇이 가장 큰 변화인가?" → 구조 분해 + 테스트 안전망 확대입니다.

## 6) 다음 단계(5~8주 제안)

- TypeScript를 `src/domain`과 `public/assets/js/format.js`부터 점진 도입
- SQLite 검색 최적화(FTS/인덱스 재점검)
- UI e2e 자동화 추가(핵심 사용자 흐름 중심)
