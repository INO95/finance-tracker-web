# Finance Tracker Web

> 개인 자산관리 웹앱 — JPY/KRW/USD 다중 통화 지원

## 개요

일일 입출금 기록과 월별 식비 예산 추적을 위한 경량 셀프호스팅 앱.

**기술 스택:** 최소 의존성 Node.js 백엔드 + 바닐라 HTML/CSS/JS 프런트엔드, 저장소는 `better-sqlite3` 기반 SQLite

## 주요 기능

- **거래 CRUD** — 거래 추가/수정/삭제/복구/검색
- **반복 거래 템플릿** — 월세, 급여, 구독처럼 반복 항목을 저장하고 한 번에 반영
- **CSV 가져오기** — 은행/카드 CSV를 미리보기 후 일괄 등록
- **식비 예산 알림** — 실질 식비 분석 (정산환급 반영)
- **카테고리 예산** — 카테고리별 월 예산과 초과 상태 확인
- **잔액 대사** — 계좌 기준 잔액과 실제 잔액 차이 확인
- **월별 요약** — 카테고리별 지출 분석
- **다중 통화** — JPY (¥), KRW (₩), USD ($)
- **커스터마이징** — 카테고리/결제수단 추가
- **반응형 UI** — 모바일 지원

## 권장 사용 흐름

1. 메인 입력 폼에서 거래를 기록하거나 퀵 템플릿으로 폼을 채웁니다.
2. "반복 거래 / 퀵 템플릿" 패널에서 이번 달 반영이 필요한 항목을 처리합니다.
3. 거래내역 표에서 수정/삭제를 수행하고, 실수로 삭제했다면 undo 바로 복구합니다.
4. 수기 입력이 부담되면 CSV를 미리보기 후 일괄 가져옵니다.
5. 카테고리 예산, 식비 알림, 잔액 대사 표를 함께 보고 월말 점검을 합니다.

## 브라우저 로컬 저장 항목

아래 데이터는 서버가 아니라 브라우저 `localStorage`에 저장됩니다.
- 반복 거래 템플릿
- 잔액 대사용 스냅샷(기준일/기준 잔액/실제 잔액)
- 입력 기본값, 사용자 추가 카테고리/결제수단, 저장한 API 토큰

반면 거래 데이터, 요약 결과, 예산 설정 값은 서버 저장소에 유지됩니다.

## 빠른 시작

```bash
git clone https://github.com/YOUR_USERNAME/finance-tracker-web.git
cd finance-tracker-web
npm ci
cp .env.example .env
cp data/example.json data/finance_db.json
npm run migrate:sqlite
npm start
```

http://localhost:4380 에서 접속

```bash
curl http://127.0.0.1:4380/api/health
```

브라우저에서는 아래 항목이 보이면 이번 기능셋이 정상 반영된 상태입니다.
- 반복 거래 / 퀵 템플릿 패널
- 카테고리 예산 표
- 잔액 대사 표
- 거래내역의 수정/삭제 버튼과 undo 바

## 테스트

```bash
npm test
```

로컬에서 `better-sqlite3` 모듈이 없다고 나오면 먼저 `npm ci`를 실행하면 됩니다.

포함된 핵심 검증:
- API 인증/검증 회귀 테스트
- `sqlite`/`json` 조회 결과 일치 테스트 (`month/fromMonth/toMonth`, `sort`, `page`, `limit`)
- 정적 자산 보안 테스트 (`/assets/*` 경로탈출 차단 + MIME 매핑)

## Docker

```bash
docker compose up -d
curl http://127.0.0.1:4380/api/health
docker compose down
```

이미지 빌드 시 프로덕션 의존성과 네이티브 `better-sqlite3` 모듈까지 함께 설치됩니다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `FINANCE_WEB_PORT` | `4380` | 서버 포트 |
| `FINANCE_WEB_HOST` | `127.0.0.1` | 바인드 주소 |
| `FINANCE_WEB_API_TOKEN` | (비어있음) | 쓰기 작업용 API 토큰 |
| `FINANCE_STORAGE_DRIVER` | `sqlite` | 저장소 드라이버 (`sqlite` 또는 `json`) |
| `FINANCE_SQLITE_PATH` | `./data/finance_db.sqlite` | SQLite 파일 경로 |

## API 문서

[docs/API.md](docs/API.md) 참조

### 빠른 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|------|------|------|
| GET | `/api/finance/transactions` | 거래 목록 조회 |
| POST | `/api/finance/transactions` | 거래 생성 |
| PATCH | `/api/finance/transactions/:id` | 거래 수정 |
| DELETE | `/api/finance/transactions/:id` | 거래 삭제 |
| POST | `/api/finance/transactions/restore` | 삭제 거래 복구 |
| GET | `/api/finance/settings` | 식비/카테고리 예산 조회 |
| POST | `/api/finance/settings` | 식비/카테고리 예산 저장 |
| GET | `/api/finance/summary` | 월별 요약 |
| GET | `/api/health` | 헬스체크 |

## 입문 가이드

초급자용 아키텍처/동작 원리/설계 의도 튜토리얼:

- [docs/guide/README.ko.md](docs/guide/README.ko.md)

## JSON -> SQLite 마이그레이션

```bash
npm run migrate:sqlite
```

## 거래 조회 벤치마크 (10k 스모크)

```bash
npm run bench:transactions
```

옵션 조정 예시:

```bash
node scripts/benchmark-transactions.js --rows 10000 --warmup 20 --measured 120 --limit 100 --p95-threshold-ms 150
```

벤치마크 결과 JSON 저장:

```bash
node scripts/benchmark-transactions.js --output-json .artifacts/benchmark-transactions.json
```

로컬에서 CI와 동일한 검증 실행:

```bash
npm run ci:local
```

head/base 벤치 JSON 비교:

```bash
npm run bench:compare -- --head .artifacts/benchmark-head.json --base .artifacts/benchmark-base.json --max-regression-pct 25
```

## 벤치 결과 읽는 법 (초급자용)

- `p95(head)`: 현재 브랜치 응답 속도(95퍼센타일)
- `p95(base)`: 비교 기준(base 브랜치) 응답 속도
- `delta`: `head - base` 값
  - 양수면 느려짐, 음수면 빨라짐
- `gates`: 두 조건을 모두 넘을 때만 PR 실패
  - 비율 게이트 (`max-regression-pct`)
  - 절대 시간(ms) 게이트 (`max-regression-abs-ms`)
- `trend vs previous comment`: 같은 PR의 이전 CI 실행 대비 변화
  - `IMPROVED`: 의미 있게 빨라짐
  - `STABLE`: 작은 노이즈 범위(거의 동일)
  - `REGRESSED`: 의미 있게 느려짐
- `beginner summary`: 위 숫자를 한 줄로 풀어쓴 결론
  - 예: `개선`, `안정`, `주의`

## 라이선스

MIT
