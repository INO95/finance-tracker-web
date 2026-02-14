# Finance Tracker Web

> 개인 자산관리 웹앱 — JPY/KRW/USD 다중 통화 지원

## 개요

일일 입출금 기록과 월별 식비 예산 추적을 위한 경량 셀프호스팅 앱.

**기술 스택:** 순수 Node.js (외부 의존성 없음), 바닐라 HTML/CSS/JS

## 주요 기능

- **거래 CRUD** — API를 통한 거래 추가/수정/검색
- **식비 예산 알림** — 실질 식비 분석 (정산환급 반영)
- **월별 요약** — 카테고리별 지출 분석
- **다중 통화** — JPY (¥), KRW (₩), USD ($)
- **커스터마이징** — 카테고리/결제수단 추가
- **반응형 UI** — 모바일 지원

## 빠른 시작

```bash
git clone https://github.com/YOUR_USERNAME/finance-tracker-web.git
cd finance-tracker-web
cp .env.example .env
cp data/example.json data/finance_db.json
npm run migrate:sqlite
npm start
```

http://localhost:4380 에서 접속

```bash
curl http://127.0.0.1:4380/api/health
```

## 테스트

```bash
npm test
```

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
