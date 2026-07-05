<!-- docs/frontend-productization/F0-A-FRONTEND-BASELINE-REGISTERS.md -->
# F0-A Frontend Baseline Registers

## Phase

F0-A Frontend Baseline Registers is the register-only phase after H67 Frontend Release Readiness and before F1-A Locale Infrastructure Hardening.

F0-A records the frontend baseline created by H58-H67. It does not implement product pages, repair locale support, change route topology, or start runtime readiness.

## Purpose

F0-A establishes a reviewable baseline for four register families:

- Page Gap Register
- Locale Readiness Register
- Quality Baseline Register
- Runtime Transition Register

The purpose is to prevent frontend productization from drifting into implementation work before the known gaps and runtime transition boundaries are recorded.

## Start baseline

The start baseline is current `main` after H67 Frontend Release Readiness was merged.

The H67 baseline records three formal frontend surfaces:

- Operator Runtime Console
- Customer Portal
- Admin Console

The H67 baseline is frontend release readiness only. It is not live production runtime readiness.

GitHub-visible CI evidence is not re-stated by F0-A. F0-A requires this branch to run its own acceptance, typecheck, and build commands.

## Output registers

F0-A adds these register files:

- `docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md`
- `docs/frontend-productization/F0-A-LOCALE-READINESS-REGISTER.md`
- `docs/frontend-productization/F0-A-QUALITY-BASELINE-REGISTER.md`
- `docs/frontend-productization/F0-A-RUNTIME-TRANSITION-REGISTER.md`

F0-A also adds this executable static gate:

- `scripts/frontend_acceptance/ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1.cjs`

## Non-goals

F0-A is register-only.

F0-A does not modify runtime source.
F0-A does not resolve page gaps.
F0-A does not repair locale support.
F0-A does not claim live runtime readiness.
F0-A does not start runtime evidence streaming.
F0-A does not start online state estimation.
F0-A does not start forecast calibration.
F0-A does not connect live devices.
F0-A does not enable dispatch or AO-ACT.
F0-A does not compute ROI.
F0-A does not learn Field Memory.
F0-A does not change backend APIs, database schemas, contracts, fixtures, packages, or route topology.

## Acceptance

F0-A acceptance is static repository read-only. It does not start the app, does not call the backend, does not access the database, and does not write facts.

Required local commands:

```text
node scripts/frontend_acceptance/ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1.cjs
pnpm run typecheck:web
pnpm run build:web
git status --short
```

## Next phase

F0-A prepares F1, F2, F0-B, and R1-R5.

After F0-A:

- F1 repairs bilingual / locale surfaces.
- F2 hardens frontend quality baseline.
- F0-B freezes frontend productization.
- R1 starts runtime readiness.

The immediate next phase is F1-A Locale Infrastructure Hardening.

F0-A does not authorize F1-B, F2, or R1 directly.
