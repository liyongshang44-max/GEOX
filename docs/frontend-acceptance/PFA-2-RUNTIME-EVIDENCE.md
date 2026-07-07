<!-- docs/frontend-acceptance/PFA-2-RUNTIME-EVIDENCE.md -->
# PFA-2 Runtime Evidence

## Final status

```text
phase: PFA-2 Locale Contract Completion
status: PASS
validated head: 88b793226a2dc84853d125f2a1f96c7c59282cd8
validation date: 2026-07-08
actual routes: 30
locales: 2
route renders: 60
viewport: 1440 x 1100
```

## Static acceptance

```text
ACCEPTANCE_PFA_2_LOCALE_CONTRACT.cjs exit: 0
Customer routes: 9
Operator routes: 13
Admin routes: 7
Login routes: 1
RuntimeTextGuard replacement count: 0
changed files within PFA-2 scope: PASS
forbidden files unchanged: PASS
third-party i18n dependency: none
```

## Runtime acceptance

```text
AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs exit: 0
ok: true
real browser login: PASS
route health: 60/60
html lang: 60/60
locale pairs: 30/30
locale pair differentiation: 30/30
role-boundary equivalence: 30/30
pathname equivalence: 30/30
required markers: PASS
forbidden markers: PASS
raw governed error-code exclusion: PASS
RuntimeTextGuard dependency: 0
```

## CI and hygiene

```text
CI workflow run: 4200
CI workflow run id: 28890813795
CI conclusion: success
local worktree after audit cleanup: clean
generated repository audit report: removed
```

## Closure statement

All 30 formal routes passed in `zh-CN` and `en-US`. This evidence supports closure of `PFA0-I18N-001`, `PFA0-CUS-001`, and `PFA0-ADM-002`.

Responsive behavior, export layout, information architecture, page density, Admin Device status-model work, and final frontend closure remain assigned to later phases.