# F2 Frontend Quality Hardening

## Phase

F2 Frontend Quality Hardening / F2 前端质量硬化.

## Purpose

F2 turns the frontend baseline from release-ready and bilingual-ready into quality-gated. It establishes a static, repeatable frontend quality gate across formal product surfaces.

F2 does not create product capability. F2 does not add routes. F2 does not change runtime semantics. F2 does not claim live production readiness. F2 hardens frontend quality only.

## Preconditions

F0-A baseline registers are complete. F1-A locale infrastructure is complete. F1-B shell bilingual integration is complete. F1-C Operator formal surfaces are bilingualized. F1-D Customer/Admin formal surfaces are bilingualized.

F2 does not repair locale gaps, product semantics, backend read models, DB migrations, contracts, or fixtures.

## Allowed files

Allowed files are limited to F2 documentation, F2 static acceptance, formal shell/layout quality helpers, formal Customer/Admin/Operator surfaces, formal CSS, and label/copy registries when required for accessibility labels or state copy.

This first F2 PR intentionally keeps runtime source diff at zero and adds only F2 documentation plus the static acceptance gate.

## Forbidden files

Forbidden files include `apps/web/src/app/App.tsx`, `apps/web/src/app/routes/*`, `apps/server/*`, `migrations/*`, `packages/contracts/*`, `fixtures/*`, `.github/*`, `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.

F2 must not add backend APIs, routes, packages, migrations, contracts, fixtures, execution capability, dispatch capability, AO-ACT capability, ROI computation, or Field Memory learning.

## Quality dimensions

F2 covers accessibility baseline, keyboard/focus gate, responsive viewport smoke, empty/loading/error state behavior, visual smoke checklist, and performance budget.

## F2-A Accessibility baseline

See `docs/frontend-productization/F2-ACCESSIBILITY-BASELINE.md`.

The baseline verifies semantic shell structure, navigation labels, LocaleToggle accessibility, landmark presence, heading intent, button/link semantics, non-color-only status expectations, and contrast-risk declaration.

## F2-B Keyboard / focus gate

The baseline requires keyboard-reachable formal navigation, LocaleToggle buttons, formal report links, export links, field/operation card links, and disabled placeholders with explicit disabled semantics.

The project must retain visible focus behavior. Static acceptance checks for `:focus-visible` and blocks global `outline: none` / `outline: 0` patterns that lack replacement focus indicators.

## F2-C Responsive viewport smoke

See `docs/frontend-productization/F2-RESPONSIVE-VIEWPORT-SMOKE.md`.

The smoke baseline covers 1440px, 1280px, 768px, and 390px viewport classes. It requires wrapping behavior, long identifier handling, readable boundary/nonclaim copy, and LocaleToggle topbar fit.

## F2-D Empty / loading / error states

See `docs/frontend-productization/F2-EMPTY-LOADING-ERROR-STATE-REGISTER.md`.

Formal surfaces must register loading, empty, error, unavailable, not authorized, not configured, and read-only boundary handling where applicable. State copy must not invent data, expose stack traces, or claim production outage without evidence.

## F2-E Visual smoke checklist

See `docs/frontend-productization/F2-VISUAL-SMOKE-CHECKLIST.md`.

The checklist is manual and screenshot-oriented. F2 does not introduce automated visual regression tooling or a screenshot package dependency.

## F2-F Performance budget

See `docs/frontend-productization/F2-PERFORMANCE-BUDGET.md`.

The budget is qualitative for this stage: build:web must pass, no new dependency is allowed, route lazy-loading must be preserved, and copy registries / LocaleToggle must not import API clients.

## F2-G Quality gate consolidation

The consolidated gate is `scripts/frontend_acceptance/ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1.cjs`.

It is static repo read-only. It does not start the app, call backend APIs, call DB, write facts, mutate source data, or require Docker.

## Acceptance

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_F2_FRONTEND_QUALITY_HARDENING_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

## Non-goals

F2 does not claim full WCAG legal certification. F2 does not introduce automated visual regression tooling. F2 does not certify all browser/device combinations. F2 does not make runtime live. F2 does not start field pilot. F2 does not enable dispatch, AO-ACT, ROI, or Field Memory.

## Next phase

F2 hands off to F0-B Frontend Productization Freeze Declaration only after F2 acceptance, typecheck:web, and build:web pass.
