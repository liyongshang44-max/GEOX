<!-- docs/frontend-acceptance/PFA-2-ISSUE-CLOSURE.md -->
# PFA-2 Issue Closure Register

## Pending strengthened revalidation

| issue | severity | owner | state | remaining proof |
|---|---|---|---|---|
| PFA0-I18N-001 | P1 | PFA-2 | pending revalidation | Complete governed visible-text scan, 60/60 route health, 30/30 differentiated locale pairs, mandatory role-boundary presence |
| PFA0-CUS-001 | P1 | PFA-2 | pending revalidation | Customer 9 routes must pass the strengthened runtime scan |
| PFA0-ADM-002 | P2 | PFA-2 | pending revalidation | Admin 7 routes, including localized metric values, must pass the strengthened runtime scan |

## Current engineering state

```text
matrix records: 30
matrix status: ready-for-runtime
Gateway Demo child components: localized at source
Admin Devices Readback / Defined values: localized at source
complete visible-text runtime audit: implemented
mandatory role-boundary presence check: implemented
PFA-3 dashboard layout CSS: removed from PFA-2
```

## Closure condition

The three issues above return to `closed` only after:

```text
static acceptance exit: 0
strengthened runtime audit exit: 0
route health: 60/60
html lang: 60/60
locale pairs: 30/30
locale pair differentiation: 30/30
role-boundary equivalence and presence: 30/30
pathname equivalence: 30/30
RuntimeTextGuard dependency: 0
matrix records promoted to runtime-pass: 30/30
synchronized-head CI: success
```

## Deferred issues

```text
PFA0-RWD-001 → PFA-3
PFA0-NAV-001 → PFA-3
PFA0-EXP-001 → PFA-4
PFA0-DEN-001 → PFA-5
PFA0-ADM-003 → PFA-5
PFA0-CUS-002 → PFA-6
PFA0-CUS-004 → PFA-6
PFA0-ADM-001 → PFA-6
```

No later-phase issue is closed by PFA-2.