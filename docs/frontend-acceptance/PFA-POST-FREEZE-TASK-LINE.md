<!-- docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md -->
# PFA Post-Freeze Task Line

## 1. Governing rule

This task line is derived from the completed PFA-0 full screenshot review. It replaces the earlier assumption that all page-quality findings should be handled inside one undifferentiated PFA-1 phase.

The frozen order is:

```text
PFA-0 Evidence Reconciliation
PFA-1 Runtime API-Base and Capture Enablement
PFA-2 Locale Contract Completion
PFA-3 Responsive Shell and Overflow Containment
PFA-4 Export and Print Surface Strategy
PFA-5 Information Architecture and Density Remediation
PFA-6 Table, Label, and Demo-Data Polish
PFA-7 Full Recapture and Closure Gate
```

No phase may silently absorb unrelated work from a later phase.

## 2. PFA-0 — Evidence Reconciliation

Goal:

```text
Reconcile the route matrix and issue register with the actual 180-screenshot review.
```

Required outcomes:

```text
CAP-001 and CAP-002 recorded as resolved capture findings
all 30 actual routes marked as reviewed at desktop/laptop/mobile
runtime capture PASS separated from page-quality FAIL
all observed P1/P2 findings assigned to a remediation phase
no page source changes
```

Boundary:

```text
Audit docs, matrix, issue register, capture framework, and static gate only.
```

## 3. PFA-1 — Runtime API-Base and Capture Enablement

Goal:

```text
Make Vite-provided API base configuration effective so browser auth and full capture use the intended runtime origin.
```

Current implementation:

```text
PR #2295
branch: pfa-1-runtime-api-base-fix
commit: 24c6f9a8803c9738ce0311c35deda5ddfc056dae
```

Acceptance:

```text
web typecheck PASS
web build PASS
runtime API base equals audit Vite origin
browser login 200
browser auth/me 200 with Authorization
180/180 screenshots generated
```

PFA-1 does not claim page-quality completion.

## 4. PFA-2 — Locale Contract Completion

Goal:

```text
Make zh-CN and en-US complete, intentional, and mutually consistent outputs.
```

Scope:

```text
Customer shell and reports
Operator pages
Admin pages
Login
Export/print labels
shared status and governance vocabulary
```

Acceptance:

```text
no unintended English residue in zh-CN
no unintended Chinese residue in en-US
locale pairs are not identical where visible copy should differ
all route-level visible strings resolve through the approved locale boundary
```

Primary issues:

```text
PFA0-I18N-001
PFA0-CUS-001
PFA0-ADM-002
```

## 5. PFA-3 — Responsive Shell and Overflow Containment

Goal:

```text
Eliminate unintended document-level horizontal overflow and replace the desktop-first mobile shell.
```

Scope:

```text
Operator Health/Evidence/Residual/Forecast/Gateway routes
Customer Dashboard overflow
mobile navigation drawer or collapsible shell
laptop-width table/detail containment
```

Acceptance:

```text
document.scrollWidth <= viewport width for routes that are not explicitly scroll-container surfaces
wide tables scroll inside their own semantic container
mobile content begins with page context rather than the full desktop navigation tree
390px, 1366px, and 1440px checks pass
```

Primary issues:

```text
PFA0-RWD-001
PFA0-NAV-001
PFA0-OPR-002
PFA0-OPR-005
```

## 6. PFA-4 — Export and Print Surface Strategy

Goal:

```text
Define and implement a deliberate mobile/desktop/print contract for customer exports.
```

Required decision:

```text
Either provide a readable mobile report layout,
or explicitly classify export surfaces as desktop/print-only and present a usable mobile handoff.
```

Acceptance:

```text
no character-level heading fragmentation
no unreadable compressed tables
print output remains stable
mobile behavior is explicit rather than accidental
```

Primary issue:

```text
PFA0-EXP-001
```

## 7. PFA-5 — Information Architecture and Density Remediation

Goal:

```text
Reduce excessive scroll depth and separate summary, navigation, and detail.
```

Scope:

```text
Customer Dashboard duplicate report entries and column imbalance
Customer Reports Center
Operator Gateway Demo
Operator Audit
Operator Calibration
Operator Pilot readiness
source inventory readability
```

Acceptance:

```text
no duplicate primary content blocks
long pages have sectional navigation or progressive disclosure
summary and detail are separated
large tables use pagination, virtualization, or explicit drill-down where appropriate
formal demo paths are scannable without traversing 10–17 viewport heights
```

Primary issues:

```text
PFA0-CUS-003
PFA0-CUS-005
PFA0-CUS-006
PFA0-OPR-001
PFA0-OPR-003
PFA0-DEN-001
```

## 8. PFA-6 — Table, Label, and Demo-Data Polish

Goal:

```text
Close remaining P2 presentation defects after the P1 structure is stable.
```

Scope:

```text
unnamed field/operation labels
long ID presentation
badge wrapping
admin table wrapping
operator unused-width balance
```

Primary issues:

```text
PFA0-CUS-002
PFA0-CUS-004
PFA0-OPR-004
PFA0-ADM-001
```

## 9. PFA-7 — Full Recapture and Closure Gate

Goal:

```text
Repeat the complete review and determine whether the frontend can exit PFA remediation.
```

Required evidence:

```text
30 actual routes
2 locales
3 viewports
180 authenticated screenshots
route-level quality assertions
no open P1
P2 findings closed or explicitly accepted
```

Final distinction:

```text
runtime capture PASS is necessary
page-quality acceptance PASS is separate and mandatory
```

## 10. Blocking rule

PFA-2, PFA-3, PFA-4, and PFA-5 contain P1 work. Subsequent Twin Runtime or production-readiness work remains blocked until those P1 findings are closed or explicitly reclassified with evidence.