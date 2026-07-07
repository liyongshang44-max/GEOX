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
Final locally tested PR head: 912a74e661f9f951d0ed8cbab681ef5f09318a21
Validated CI source commit: 912a74e661f9f951d0ed8cbab681ef5f09318a21
Validated CI run: 4077
```

The runtime source commit is based directly on the merged PFA-0 baseline. The resulting `client.ts` blob is identical to the implementation that produced the reconciled PFA-0 full-capture evidence and the final synchronized-branch 180/180 rerun.

The final evidence-recording change updates this document only. It does not modify runtime source, routes, authentication, backend code, packages, workflows, or generated artifacts.

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

## 4. Full-capture runtime configuration

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

## 5. Final synchronized-branch browser-runtime evidence

The final full-mode rerun was executed from the exact remote PR head:

```text
HEAD: 912a74e661f9f951d0ed8cbab681ef5f09318a21
origin/pfa-1-runtime-api-base-fix: 912a74e661f9f951d0ed8cbab681ef5f09318a21
working tree before acceptance: clean
working tree after artifact cleanup: clean
```

The browser-runtime proof recorded:

```text
configured runtime API base: http://127.0.0.1:5183
browser auth/login: PASS for zh-CN and en-US
browser auth/login status: 200
browser auth/login originMatch: true
browser auth/login tokenMatch: true
browser auth/me: PASS for zh-CN and en-US
browser auth/me status: 200
browser auth/me originMatch: true
Authorization header: present
tenant_id: present
project_id: present
group_id: present
storage state: complete
authenticated route redirect: absent
session placeholder: absent
page body empty failure: absent
capture plan: 30 routes x 2 locales x 3 viewports
capture jobs: 180
screenshot result: 180/180 PASS
capture failures: 0
```

The `/login` screenshot jobs intentionally do not require an authenticated `/auth/me` request. All authenticated route jobs observed `auth/me` status `200`, matching origin, and an Authorization header.

## 6. Static, build, bundle, and freeze acceptance

Required commands:

```text
node scripts/frontend_acceptance/ACCEPTANCE_PFA_1_RUNTIME_API_BASE_CAPTURE.cjs
node scripts/frontend_acceptance/ACCEPTANCE_PFA_0_PAGE_QUALITY_AUDIT.cjs
pnpm run typecheck:web
pnpm run build:web
node scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
node scripts/frontend_acceptance/ACCEPTANCE_PFE_13_FRONTEND_PRODUCT_V1_FREEZE.cjs
```

Final acceptance status:

```text
PFA-1 dedicated static gate: PASS on exact PR head
PFA-1 allowed changed files: 3/3 expected files only
PFA-1 forbidden files unchanged: PASS
PFA-1 generated-artifact exclusion: PASS
PFA-1 API-base precedence contract: PASS
PFA-1 Authorization and tenant-context preservation: PASS
PFA-0 static acceptance: PASS on clean origin/main worktree
PFA-0 matrix records: 33
PFA-0 actual routes: 30
PFA-0 findings: 19 open, 2 resolved capture findings, 21 historical
web typecheck: PASS
web build: PASS
bundle budget: PASS
bundle-budget failures: 0
PFE-13 frontend product v1 freeze: PASS on clean origin/main worktree
PFE-13 route topology regression: absent
PFE-13 package regression: absent
PFE-13 backend regression: absent
PFE-13 CI workflow regression: absent
GitHub CI run 4077: PASS
standard CI runtime page audit: 19/19 PASS
final synchronized-branch full capture: 180/180 PASS
final git status after artifact cleanup: clean
```

The PFE-13 gate was executed only after `HEAD`, `origin/main`, and local `main` were aligned to the same PFA-0 merge commit:

```text
5b560c403fd150d6ccf5402776426b8e382a736f
```

This avoids treating already-merged PFA-0 files as new PFE-13 changes.

## 7. Artifact policy

The following runtime artifacts were generated for local verification and removed before final status verification:

```text
PNG screenshots
generated screenshot report
PFE-10 generated bundle report
apps/web/dist
browser storage state
session token or other credentials
```

No generated screenshot binary, generated report, browser storage state, or credential is committed.

## 8. Completion statement and nonclaims

```text
PFA-1 is complete. Vite-provided API-base configuration is effective in the
browser runtime, authenticated session restoration is verified, and the full
30-route x 2-locale x 3-viewport capture pipeline passes 180/180.
```

PFA-1 proves only that the PFA browser audit runtime uses the intended API origin and can complete authenticated capture for all 30 routes, 2 locales, and 3 viewports.

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
