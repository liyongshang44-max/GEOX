# F0-B Frontend Productization Freeze Declaration

## Phase

F0-B Frontend Productization Freeze Declaration / F0-B 前端产品化冻结声明.

## Purpose

F0-B declares the frontend productization freeze.

F0-B freezes frontend productization scope, prevents future PRs from adding product surfaces under the old H-line without a new product contract, and declares the Frontend Runtime Console v1 baseline.

F0-B does not repair pages, add translations, perform accessibility repair, perform responsive repair, add routes, change runtime source, change backend code, change packages, or add product capability.

## Preconditions

F0-B is executed only after these stages are complete:

- F0-A Frontend Baseline Registers
- F1-A Locale Infrastructure Hardening
- F1-B Shell / Navigation Bilingual Integration
- F1-C Operator Formal Surface Bilingualization
- F1-D Customer / Admin Formal Surface Bilingualization
- F2 Frontend Quality Hardening

## Frozen baseline

GEOX Frontend Runtime Console v1 is frozen as a role-separated, bilingual, replay-backed, quality-gated enterprise frontend baseline.

Meaning:

- role-separated: Operator Runtime Console, Customer Portal, and Admin Console are separated.
- bilingual: formal shell and formal surface product-copy baseline is bilingual.
- replay-backed: the current frontend baseline remains replay-backed, read-only, and nonclaim-bound.
- quality-gated: accessibility, responsive, keyboard/focus, state, visual smoke, and performance budget gates are documented.
- enterprise frontend baseline: the frontend can be treated as the enterprise-console baseline for this phase, but not as live runtime readiness.

Frontend Runtime Console v1 is replay-backed and read-only for this phase.

## Role-separated surfaces

Operator Runtime Console frontend shell is frozen for this phase.
Customer Portal frontend shell is frozen for this phase.
Admin Console frontend shell is frozen for this phase.

The frozen formal surfaces are:

- Operator Runtime Console
- Customer Portal
- Admin Console

Each surface has a distinct formal shell. Each surface has its own formal navigation boundary. Legacy/debug/internal routes remain URL-only unless separately productized.

## Known page gaps

Known page gaps are registered.

F0-B references `docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md` as the page gap source of truth.

F0-B does not resolve page gaps. F0-B freezes the fact that page gaps are known, classified, and not hidden.

Page gap classifications remain:

- release surfaces present
- route exists but product page incomplete
- future product-contract pages
- do-not-build pages

## Bilingual baseline

Locale baseline is implemented.

The frozen bilingual baseline means:

- Locale infrastructure exists.
- Language toggle is integrated into formal shells.
- Operator formal surfaces are bilingual at product-copy level.
- Customer and Admin formal surfaces are bilingual at product-copy level.
- Raw/source identifiers remain untranslated.
- Backend-returned values remain untranslated.

Bilingual baseline does not mean raw evidence translation. Bilingual baseline does not alter route paths, identifiers, hashes, or contract values.

## Quality-gated baseline

Quality baseline is documented.

F2 covers:

- accessibility baseline
- keyboard / focus baseline
- responsive viewport smoke
- empty / loading / error state register
- visual smoke checklist
- performance budget

Quality-gated does not mean legal WCAG certification. Quality-gated does not mean automated visual regression coverage for every browser/device combination.

## Freeze policy

No more H-line frontend expansion without a new product contract.

H58-H67 are closed as frontend productization history. F0-A/F1/F2/F0-B close the frontend baseline. Future frontend product surfaces require a new product contract, new route ownership statement, and new acceptance gate.

## No-more-H-line policy

No more H-line frontend expansion without a new product contract.

Old H-line and F-line frontend productization work is closed by F0-B. Future frontend product surfaces cannot continue under H58-H67, F0-A, F1, F2, or F0-B without a new product contract.

## Route / nav policy

After F0-B, new product surface work must include:

- product contract
- route ownership statement
- surface owner
- formal nav decision
- nonclaim / boundary copy
- bilingual copy requirement
- accessibility / responsive / keyboard / state baseline
- acceptance gate

Without these, future PRs must not add a formal nav item, formal route family, customer-facing page, operator-facing runtime page, or admin-facing governance page.

After F0-B, route policy forbids:

- new product routes
- new broad wildcard route
- new /app/* expansion
- hidden debug route promotion
- legacy route promotion into formal nav
- route topology changes without new contract

After F0-B, route policy allows URL-only legacy compatibility to remain. Registered future product-contract pages remain future. Do-not-build pages remain forbidden.

After F0-B, formal nav policy forbids new formal nav items unless a new product contract exists.

Formal nav must not include debug, acceptance, fixture, Dev Tools, Dispatch, AO-ACT, ROI Ledger, Field Memory, Judge Config, Sim Config, import raw debug surface, or legacy dev tools unless a later product contract explicitly allows and gates that surface.

## Runtime readiness handoff

Runtime readiness moves to R-series.

The runtime readiness sequence begins with:

- R1 Runtime Evidence Stream Readiness
- R2 Online State Estimation Loop
- R3 Forecast Calibration & Residual Loop
- R4 Runtime Health Service Gate
- R5 Field Pilot Runtime Readiness

Frontend Productization is not Runtime Readiness. Runtime readiness begins at R1.

Frontend productization is closed for this phase. Runtime readiness begins at R1. No more H-line frontend expansion without a new product contract.

## Nonclaims

F0-B does not claim live production runtime.
F0-B does not claim real device deployment.
F0-B does not claim production gateway online.
F0-B does not claim continuous runtime monitoring active.
F0-B does not claim field pilot execution started.
F0-B does not claim AO-ACT dispatch enabled.
F0-B does not claim ROI computed.
F0-B does not claim Field Memory learned.
F0-B does not claim online state estimation loop active.
F0-B does not claim forecast calibration loop active.
F0-B does not claim autonomous field operations.

F0-B does not claim GEOX live runtime is production-ready.
F0-B does not claim GEOX digital twin runtime is complete.
F0-B does not claim GEOX can run autonomous field operations.
F0-B does not claim GEOX has real devices deployed.
F0-B does not claim GEOX production gateway is online.
F0-B does not claim GEOX field pilot has started.
F0-B does not claim GEOX AO-ACT dispatch is enabled.
F0-B does not claim GEOX ROI is computed.
F0-B does not claim GEOX Field Memory is learning.

## Acceptance

```powershell
node scripts/frontend_acceptance/ACCEPTANCE_F0_B_FRONTEND_PRODUCTIZATION_FREEZE_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

F0-B acceptance is static repo read-only. It does not start the app, call backend APIs, call DB, write facts, mutate source data, require Docker, require server startup, or require web startup.

## Completion definition

F0-B freeze doc exists. F0-B acceptance exists. F0-A register docs exist. H67 release readiness docs exist. F1 acceptance artifacts exist. F2 quality docs exist. No runtime source changed. No route topology changed. No backend changed. No package changed. Freeze declaration includes role-separated baseline. Freeze declaration includes bilingual baseline. Freeze declaration includes quality-gated baseline. Freeze declaration includes replay-backed boundary. Freeze declaration includes R-series handoff. F0-B acceptance passes. typecheck:web passes. build:web passes.

## Next phase

R1 Runtime Evidence Stream Readiness.

R1 is runtime readiness, not frontend continuation. R1 starts from evidence source identity, timestamp semantics, freshness, replay equivalence, missing / delayed behavior, and runtime evidence acceptance.

R1 does not create a new frontend shell, new product page, recommendation, dispatch, AO-ACT, ROI, Field Memory, model update, or autonomous operation.
