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

F2 covers accessibility baseline, responsive viewport smoke, keyboard/focus gate, empty/loading/error state register, visual screenshot checklist, and performance budget.

## F2-A Accessibility baseline

See `docs/frontend-productization/F2-ACCESSIBILITY-BASELINE.md`.

The baseline verifies semantic headings, landmark regions, aria-label for shell nav and locale switch, keyboard reachable formal nav, visible focus state, button vs link semantics, no color-only status communication, basic contrast declaration, and form labels where applicable.

F2-A establishes a WCAG 2.2 AA direction baseline. It does not claim a full WCAG audit report.

## F2-B Responsive viewport smoke

See `docs/frontend-productization/F2-RESPONSIVE-VIEWPORT-SMOKE.md`.

The smoke baseline covers desktop 1440px, laptop 1280px, tablet 768px, and mobile narrow 390px. Formal shells must not show horizontal page break outside intended tables, hidden primary nav without alternative, overlapping cards, or unreadable table text without scroll container.

## F2-C Keyboard / focus gate

See `docs/frontend-productization/F2-KEYBOARD-FOCUS-GATE.md`.

The gate proves LocaleToggle keyboard accessible, formal nav keyboard accessible, topbar actions keyboard accessible, focus visible, and disabled nav items are not focus traps.

## F2-D Empty / loading / error states

See `docs/frontend-productization/F2-EMPTY-LOADING-ERROR-STATE-REGISTER.md`.

Formal surfaces must register empty state, loading state, error / unavailable state, replay-backed state, no-data state, and blocking / non-blocking classification.

## F2-E Visual screenshot checklist

See `docs/frontend-productization/F2-VISUAL-SMOKE-CHECKLIST.md`.

The checklist is manual and screenshot-oriented. It covers no mojibake, no internal phase labels, no formal nav pollution, language toggle visible, layout readable, and nonclaims visible where required.

F2 does not introduce automated visual regression tooling or a screenshot package dependency.

## F2-F Performance budget

See `docs/frontend-productization/F2-PERFORMANCE-BUDGET.md`.

The budget records build output size reviewed, largest bundle recorded, known heavy pages listed, no new package dependency, and no accidental full i18n library import.

F2 does not require immediate bundle splitting, but it must record budget and risk.

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

## Completion definition

Frontend has a documented accessibility baseline. Frontend has responsive smoke coverage. Frontend has keyboard/focus baseline. Frontend has empty/loading/error state register. Frontend has screenshot checklist. Frontend has performance budget. F2 acceptance passes. typecheck:web passes. build:web passes.

## Non-goals

F2 does not claim full WCAG legal certification. F2 does not introduce automated visual regression tooling. F2 does not certify all browser/device combinations. F2 does not make runtime live. F2 does not start field pilot. F2 does not enable dispatch, AO-ACT, ROI, or Field Memory.

## Next phase

F2 hands off to F0-B Frontend Productization Freeze Declaration only after F2 acceptance, typecheck:web, and build:web pass.
