<!-- docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md -->
# PFA-2 Runtime Evidence

## Current status

```text
phase: PFA-2 Locale Contract Completion
status: REVALIDATION REQUIRED
previous validated head: 88b793226a2dc84853d125f2a1f96c7c59282cd8
current matrix state: ready-for-runtime
actual routes: 30
locales: 2
expected route renders: 60
viewport: 1440 x 1100
```

The previous 60-render result proved the earlier audit rules. It does not close the strengthened PFA-2 contract because the audit now covers complete visible product text and requires mandatory role-boundary capabilities to be present in both locales.

## Revalidation scope

```text
Gateway Demo complete child-component localization
Admin static metric-value localization
complete visible-text runtime scan
forbidden-marker scan across governed visible text
mandatory Operator role-boundary presence
matrix lifecycle promotion from ready-for-runtime to runtime-pass
PFA-3 dashboard layout CSS removal
```

## Required final proof

```text
static acceptance exit: 0
runtime audit exit: 0
route health: 60/60
html lang: 60/60
locale pairs: 30/30
locale pair differentiation: 30/30
role-boundary equivalence and presence: 30/30
pathname equivalence: 30/30
RuntimeTextGuard dependency: 0
matrix records at runtime-pass: 30/30
CI: success
worktree after generated-report cleanup: clean
```

No final PFA-2 runtime claim is made until the strengthened audit passes on the synchronized implementation head.