# PR Description: 4-Week Maintainability Upgrade (Non-Breaking)

## 초급자 버전

### 왜 이 PR을 올리나요?
코드가 한 파일에 몰려 있어서 수정할 때 실수하기 쉬웠고, 테스트가 적어서 "고쳤는데 다른 데가 깨지는" 위험이 있었습니다.
이 PR은 **기능은 그대로 유지**하면서 내부 구조를 정리해 유지보수를 쉽게 만드는 것이 목적입니다.

### 뭐가 좋아졌나요?
- 프론트 코드를 역할별 파일로 분리해서 수정 위치가 명확해졌습니다.
- 서버 라우터를 기능별로 나눠서 읽기 쉬워졌습니다.
- 조회 성능 구조를 개선해 데이터가 많아져도 버티기 쉬워졌습니다.
- 테스트를 크게 늘려 회귀 위험을 줄였습니다.
- CI에서 성능 비교와 초급자용 한 줄 해석(`beginner summary`)을 자동으로 보여줍니다.

### 사용자 입장에서 바뀌는 점은?
- API 주소/응답 형식은 그대로입니다.
- 기존 사용 방식은 바뀌지 않습니다.

---

## 기술 버전

### Scope
- 목표: maintainability 강화
- 원칙: API compatibility 유지 (`/api/finance/*` non-breaking)
- 범위: frontend modularization, router decomposition, repository query scalability step-1, test/CI expansion

### Week 1
- `public/index.html`에서 CSS/JS 분리
- 신규 모듈:
  - `public/assets/css/main.css`
  - `public/assets/js/{state,format,api,render,modals,app}.js`
- `/assets/*` 정적 자산 서빙 및 경로 보안 적용

### Week 2
- 테스트 안전망 확장:
  - `tests/unit/{format,scope,static-mime}.test.js`
  - `tests/api/{meta-usage,auth-and-validation,static-assets,query-compat}.test.js`
  - `tests/security/xss.test.js` 유지/보강

### Week 3
- 라우터 경계 분리:
  - `src/http/router.js`
  - `src/http/routes/{transactions,summary,meta,settings,static}.js`
  - `src/http/response.js`
  - `src/domain/validation/transaction.js`
- `src/router.js`는 createRouter re-export adapter로 유지

### Week 4
- 저장소 조회 확장:
  - `listTransactions(query?)` 확장
  - SQLite: SQL 기반 필터/정렬/페이지/total
  - JSON: 동일 시그니처로 동작
- summary 계열에서 내부 `paginate:false` 경로 사용해 대량 범위 조회 누락 방지
- CI/benchmark:
  - 10k benchmark smoke
  - head/base compare + dual gate(percent + absolute ms)
  - PR comment trend + beginner summary

### Verification
- `npm test`: pass (28/28)
- `npm run ci:local`: pass
- benchmark smoke: p95 threshold pass (500ms gate)

### Risk & Mitigation
- Risk: 내부 구조 변경으로 인한 숨은 회귀
- Mitigation:
  - 계약 테스트(query compatibility)
  - 정적 자산 보안 테스트(path traversal)
  - auth/validation/XSS 회귀 테스트

### Rollback
- 기능 플래그 없이 파일 구조 변경 중심이므로, 문제 발생 시 해당 commit 단위 롤백 가능
