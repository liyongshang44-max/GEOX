<!-- docs/frontend-acceptance/PFA-2-ISSUE-CLOSURE.md -->
# PFA-2 Issue Closure Register

## Current state

| issue | severity | owner | current state | closure evidence required |
|---|---|---|---|---|
| PFA0-I18N-001 | P1 | PFA-2 | open | 30 routes, 2 locales, 60/60 runtime renders, pair differentiation, html lang, no RuntimeTextGuard dependency |
| PFA0-CUS-001 | P1 | PFA-2 | open | Customer 9 routes produce complete and mutually exclusive zh-CN / en-US governed copy |
| PFA0-ADM-002 | P2 | PFA-2 | open | Admin 7 routes produce consistent bilingual governance/readback terminology |

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

This register must not mark an issue closed until static acceptance, runtime locale audit, typecheck, build, bundle, frozen regression gates, and synchronized-head CI all pass.
