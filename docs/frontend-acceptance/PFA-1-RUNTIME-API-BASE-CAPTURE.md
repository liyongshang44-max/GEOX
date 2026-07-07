<!-- docs/frontend-acceptance/PFA-1-RUNTIME-API-BASE-CAPTURE.md -->
# PFA-1 Runtime API-Base and Capture Enablement

## 1. Phase

```text
PFA-1 Runtime API-Base and Capture Enablement
PFA-1 运行时 API Base 与全量截图链路启用
```

PFA-1 closes the browser-runtime API-origin prerequisite. It does not repair or accept page quality.

## 2. Source references

```text
PFA-0 baseline commit: 5b560c403fd150d6ccf5402776426b8e382a736f
PFA-0 pull request: #2294
Runtime source commit: f7e280e9db4f35406d120be2a8a3aa707d7f39aa
Runtime source file: apps/web/src/api/client.ts
Runtime source blob: 6f51571ecffa5c44d8d70a478a102b58364be768
Initial proven implementation commit: 24c6f9a8803c9738ce0311c35deda5ddfc056dae
```

The runtime source commit is based directly on the merged PFA-0 baseline. The resulting `client.ts` blob is identical to the implementation that produced the reconciled PFA-0 full-capture evidence.

## 3. API-base contract

```text
priority 1: VITE_API_BASE_URL
priority 2: VITE_API_BASE
fallback: http://127.0.0.1:3001
normalization: remove trailing slash characters
```

The implementation uses direct `import.meta.env` property access so Vite can statically resolve the configured values.

The change does not alter:

```text
Authorization injection
x-tenant-id injection
x-project-id injection
x-group-id injection
x-api-contract-version
login endpoint
session storage contract
route guards
backend authentication
```

## 4. Audit runtime configuration

```text
Expected API origin: http://127.0.0.1:5183
Web port: 5183
Capture mode: full
Routes: 30 routes
Locales: 2 locales — zh-CN and en-US
Viewports: 3 viewports — desktopReview, laptopReview, mobileSpotCheck
Expected screenshot jobs: 180 screenshots
```

The audit Vite runtime receives both `VITE_API_BASE_URL` and `VITE_API_BASE` as the audit web origin, while `GEOX_WEB_PROXY_TARGET` points to the backend runtime.

## 5. Reconciled browser-runtime evidence

The reconciled evidence produced with the identical runtime-source blob records:

```text
configured runtime API base: http://127.0.0.1:5183
browser auth/login: PASS for zh-CN and en-US
browser auth/login originMatch: true
browser auth/me: PASS for zh-CN and en-US
Authorization header: present
tenant_id: present
project_id: present
group_id: present
storage state: complete
authenticated route redirect: absent
session placeholder: absent
capture plan: 30 routes x 2 locales x 3 viewports
screenshot result: 180/180 PASS
```

This evidence was generated at the initial proven implementation commit and reconciled into the merged PFA-0 baseline. A final full-mode rerun from the synchronized PFA-1 branch remains a mandatory merge condition and must not be replaced by static inspection alone.

## 6. Static and build acceptance

Required commands:

```text
node scripts/frontend_acceptance/ACCEPTANCE_PFA_1_RUNTIME_API_BASE_CAPTURE.cjs
node scripts/frontend_acceptance/ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT.cjs
pnpm run typecheck:web
pnpm run build:web
node scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
node scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs
```

Current evidence status at this documentation commit:

```text
PFA-1 dedicated static gate: implemented; final execution required
PFA-0 static acceptance: required
web typecheck: required
web build: required
bundle budget: required
PFE-13 freeze regression: required
final synchronized-branch 180 capture: required
```

## 7. Artifact policy

The following runtime artifacts are not committed:

```text
PNG screenshots
generated screenshot report
apps/web/dist
browser storage state
session token or other credentials
```

Only the result summary, immutable commit references, and non-secret acceptance facts belong in this document.

## 8. Completion and nonclaims

PFA-1 may be declared complete only after the synchronized branch passes its dedicated static gate, build checks, browser authentication proof, and final 180/180 full capture.

When complete, PFA-1 proves only that the PFA browser audit runtime uses the intended API origin and can complete authenticated capture for all 30 routes, 2 locales, and 3 viewports.

PFA-1 does not claim:

```text
page quality has passed
i18n has been repaired
responsive behavior has been repaired
Customer or Operator pages are product-grade
Admin Devices status readback has been implemented
Twin Runtime may begin
```

```text
Page-quality acceptance remains FAIL and is owned by PFA-2 through PFA-7.
```
