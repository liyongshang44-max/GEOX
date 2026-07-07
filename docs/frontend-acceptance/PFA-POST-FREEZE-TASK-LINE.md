<!-- docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md -->
# PFA Post-Freeze Remediation Roadmap

## 0. Purpose

PFA means Product Frontend Acceptance.

PFE-13 froze the engineering baseline of Formal Product Frontend v1. PFA is the post-freeze product-page acceptance line that determines whether the frozen frontend is actually readable, localized, responsive, visually coherent, demonstrable, and suitable for product handoff.

PFA does not reopen the PFE line. It consumes the PFE-13 frozen inventory as its source of truth and creates explicit post-freeze remediation phases.

The final PFA objective is:

```text
A role-separated, bilingual, accessible, responsive, visually coherent,
regression-tested, demo-ready enterprise product frontend whose route-level
page quality has been verified against the complete frozen inventory.
```

Chinese completion objective:

```text
一个角色分离、支持中英文、可访问、响应式、视觉一致、可回归测试、
可演示，并且已经完成全量页面质量复验的企业级产品前端。
```

PFA completion still does not mean:

```text
live runtime is production-ready
digital twin runtime is complete
field pilot can start
production gateway is online
AO-ACT dispatch is enabled
real devices are under production control
```

## 1. Governing sources

The PFA line is governed by:

```text
docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json
docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json
docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json
docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json
docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md
docs/frontend-acceptance/PFA-0-REVIEW-RUBRIC.md
docs/frontend-acceptance/PFA-5-ADMIN-DEVICES-READBACK.md
```

The PFE-13 route inventory remains the route source of truth. PFA may improve page behavior and presentation, but route additions, removals, or topology changes require a separately governed phase.

## 2. Evidence baseline

The reconciled PFA-0 evidence baseline is:

```text
30 actual routes
2 locales: zh-CN and en-US
3 viewports: 1440, 1366, and 390
180 authenticated screenshots
runtime capture result: 180/180 PASS
page-quality result: FAIL with P1/P2/P1-contract findings
```

The evidence distinction is mandatory:

```text
runtime capture PASS != page-quality PASS
```

A route may authenticate, render non-placeholder content, and produce a screenshot while still failing localization, responsive containment, readability, information architecture, or demonstration quality.

## 3. Finding ledger

The reconciled finding totals are:

```text
open findings: 19
resolved capture findings: 2
historical findings: 21
```

Open severity distribution:

```text
P1: 12
P1-contract: 1
P2: 6
P0: 0
```

Resolved capture findings:

```text
PFA0-CAP-001
PFA0-CAP-002
```

Open findings and ownership:

| issue | severity | owner phase | summary |
|---|---|---|---|
| PFA0-I18N-001 | P1 | PFA-2 | zh-CN and en-US outputs are not complete and mutually consistent. |
| PFA0-CUS-001 | P1 | PFA-2 | Customer shell and reports contain mixed-language product copy. |
| PFA0-CUS-002 | P2 | PFA-6 | Demo fields and operations have unnamed or weak labels. |
| PFA0-CUS-003 | P1 | PFA-5 | Customer Reports Center is too dense for formal demonstration. |
| PFA0-CUS-004 | P2 | PFA-6 | Long IDs and wrapped badges reduce Customer table readability. |
| PFA0-CUS-005 | P1 | PFA-5 | Customer Reports Center is viewport-sensitive. |
| PFA0-CUS-006 | P1 | PFA-5 | Customer Dashboard duplicates report-entry content and has weak column balance. |
| PFA0-OPR-001 | P1 | PFA-5 | Operator source inventory and gateway tables have weak readability and reference overflow. |
| PFA0-OPR-002 | P1 | PFA-3 | Operator field runtime detail is compressed and overuses horizontal overflow. |
| PFA0-OPR-003 | P1 | PFA-5 | Operator pilot readiness is difficult to scan and demonstrate. |
| PFA0-OPR-004 | P2 | PFA-6 | Operator field runtime list underuses available width. |
| PFA0-OPR-005 | P1 | PFA-3 | Operator table/detail/pilot routes remain laptop/mobile sensitive. |
| PFA0-ADM-001 | P2 | PFA-6 | Admin field names and values wrap awkwardly. |
| PFA0-ADM-002 | P2 | PFA-2 | Admin localized pages retain mixed governance terminology. |
| PFA0-ADM-003 | P1-contract | PFA-5 | Admin Devices is inventory-only and requires device asset plus status readback governance. |
| PFA0-RWD-001 | P1 | PFA-3 | Document-level horizontal overflow exists on selected Customer and Operator routes. |
| PFA0-NAV-001 | P2 | PFA-3 | Mobile pages render the full desktop navigation before page content. |
| PFA0-EXP-001 | P1 | PFA-4 | Customer export and print surfaces are unreadable at mobile width. |
| PFA0-DEN-001 | P1 | PFA-5 | Several Customer and Operator pages span roughly 10–17 viewport heights without adequate hierarchy. |

No phase may silently absorb an issue owned by another phase.

## 4. Frozen execution order

The frozen order is:

```text
PFA-0 Evidence Reconciliation
PFA-1 Runtime API-Base and Capture Enablement
PFA-2 Locale Contract Completion
PFA-3 Responsive Shell and Overflow Containment
PFA-4 Export and Print Surface Strategy
PFA-5 Information Architecture, Density, and Admin Device Status Readback
PFA-6 Table, Label, and Demo-Data Polish
PFA-7 Full Recapture and Closure Gate
```

The phases are sequential. PFA-6 must not begin before PFA-2 through PFA-5 have stabilized the structural work it depends on. PFA-7 must not begin until every earlier phase has merged and its acceptance evidence is available on `main`.

## 5. Global invariants

Every PFA phase must preserve these invariants unless a separate approved task explicitly changes them:

```text
Customer remains report-oriented and cannot dispatch, approve, or write facts.
Operator remains read-only and replay/review-oriented.
Admin remains governance/readback-oriented and not a production control console.
No page may claim live device connectivity without real evidence.
No page may claim production gateway online.
No page may claim field pilot started.
No page may claim AO-ACT dispatch enabled.
No page may fabricate source status, health, telemetry, or capability.
```

Default forbidden changes:

```text
route topology changes
backend behavior changes
migration changes
contract changes
production fixture changes
new runtime dependencies
CI workflow changes
committed dist output
committed generated screenshot binaries
```

A phase may explicitly permit narrowly scoped frontend runtime-source changes or demo-only seed changes, but the PR must state that permission and prove the corresponding regression evidence.

## 6. Branch and PR discipline

Recommended branch names:

```text
pfa-0-frontend-review
pfa-1-runtime-api-base-fix
pfa-2-locale-contract-completion
pfa-3-responsive-shell-overflow-containment
pfa-4-export-print-surface-strategy
pfa-5-information-architecture-device-status
pfa-6-table-label-demo-data-polish
pfa-7-full-recapture-closure-gate
```

Recommended PR titles:

```text
PFA-0 Evidence Reconciliation
PFA-1 Runtime API-Base and Capture Enablement
PFA-2 Locale Contract Completion
PFA-3 Responsive Shell and Overflow Containment
PFA-4 Export and Print Surface Strategy
PFA-5 Information Architecture, Density, and Admin Device Status Readback
PFA-6 Table, Label, and Demo-Data Polish
PFA-7 Full Recapture and Closure Gate
```

Each phase branch must start from the latest merged predecessor. A branch that was created early must merge or rebase the latest predecessor before final acceptance. Force rewriting is not required unless conflict resolution or repository policy makes it necessary.

---

# PFA-0 — Evidence Reconciliation

## 7. Goal

Reconcile the PFE-13 frozen inventory, route matrix, issue register, and actual 180-screenshot review without changing page runtime source.

## 8. Required outcomes

```text
30 actual routes represented
zh-CN and en-US represented
1440, 1366, and 390 represented
180 authenticated screenshot records represented
CAP-001 and CAP-002 recorded as resolved capture findings
runtime capture PASS separated from page-quality FAIL
19 open findings assigned to PFA-2 through PFA-6
no page runtime-source changes
```

## 9. Allowed scope

```text
PFA audit documentation
PFA review manifest
route review matrix
issue register
capture framework
static acceptance gate
post-freeze task line
PFA-5 Admin Devices contract binding document
```

## 10. Forbidden scope

```text
page fixes
route changes
backend changes
package changes
production data changes
runtime capability changes
```

## 11. Acceptance

```text
PFA-0 static acceptance PASS
matrix v3 PASS
30 actual route records PASS
all three viewport records PASS
locale split PASS
180 screenshot evidence reconciliation PASS
open findings = 19
resolved capture findings = 2
historical findings = 21
PFA0-ADM-003 registered as P1-contract owned by PFA-5
no runtime source changes
CI green
```

## 12. Exit meaning

PFA-0 exit means the evidence and task ownership are correct. It does not mean page quality is fixed.

---

# PFA-1 — Runtime API-Base and Capture Enablement

## 13. Goal

Make Vite-provided API-base configuration effective so browser authentication, `auth/me`, and full screenshot capture use the intended runtime origin.

## 14. Current implementation reference

```text
PR #2295
branch: pfa-1-runtime-api-base-fix
initial implementation commit: 24c6f9a8803c9738ce0311c35deda5ddfc056dae
```

PFA-1 must incorporate the latest merged PFA-0 before final acceptance.

## 15. Owned findings

```text
PFA0-CAP-001 — resolved by full capture
PFA0-CAP-002 — resolved by authenticated full capture
```

## 16. Required behavior

```text
Vite runtime receives the intended API base.
Browser login reaches the intended authentication origin.
Browser auth/me sends Authorization and tenant/project/group context.
The capture framework can create authenticated storage states for both locales.
Full capture runs all 30 routes across both locales and all three viewports.
```

## 17. Acceptance

```text
web typecheck PASS
web build PASS
runtime API base equals audit Vite origin
browser login returns 200
browser auth/me returns 200 with Authorization
30 routes x 2 locales x 3 viewports = 180 screenshots
180/180 capture PASS
PFE-10 bundle budget PASS
PFA-0 evidence references remain valid
```

## 18. Non-goals

```text
no page-quality repair
no i18n repair
no responsive repair
no information-architecture repair
no device-status product contract implementation
```

## 19. Exit meaning

PFA-1 exit proves that the evidence pipeline is reliable. It does not prove that the pages shown by that pipeline are product-grade.

---

# PFA-2 — Locale Contract Completion

## 20. Goal

Make `zh-CN` and `en-US` complete, intentional, role-safe, and mutually consistent product outputs.

## 21. Owned findings

```text
PFA0-I18N-001
PFA0-CUS-001
PFA0-ADM-002
```

## 22. Scope

```text
Customer shell, reports, states, tables, and export labels
Operator shell, runtime review pages, state vocabulary, and governance terms
Admin shell, governance labels, and state vocabulary
Login page
LocaleToggle
shared Product state primitives
shared status labels
boundary and nonclaim copy
```

## 23. Implementation policy

```text
Visible product copy must resolve through the approved locale boundary.
Hardcoded visible copy may remain only when documented as locale-neutral data.
RuntimeTextGuard remains fallback-only and must not become the main i18n mechanism.
Customer internal terminology must remain hidden.
Operator and Admin technical vocabulary may remain only when role-appropriate.
```

No new i18n dependency is required by default. Existing locale primitives and typed copy catalogs should be extended before introducing another framework.

## 24. Acceptance

```text
No unintended English residue in zh-CN.
No unintended Chinese residue in en-US.
Locale pairs are not identical where visible copy should differ.
Login is localized.
Export and print labels are localized.
Shared state and governance vocabulary is localized.
Customer, Operator, and Admin nonclaims retain their exact safety meaning in both locales.
30 route-level locale checks pass.
PFE-11 copy/i18n gate remains green.
```

## 25. Blockers

```text
Any Customer internal-code leakage
Any locale mode with major foreign-language residue
Any English/Chinese copy pair that changes role or execution meaning
Any fallback that exposes raw backend error or enum text
```

## 26. Exit meaning

Both locales are valid product outputs, not one primary language plus scattered translations.

---

# PFA-3 — Responsive Shell and Overflow Containment

## 27. Goal

Eliminate unintended document-level horizontal overflow, contain wide data inside semantic containers, and replace the desktop-first mobile shell with a usable compact navigation pattern.

## 28. Owned findings

```text
PFA0-RWD-001
PFA0-NAV-001
PFA0-OPR-002
PFA0-OPR-005
```

## 29. Priority routes

```text
/operator/fields/:fieldId/health
/operator/fields/:fieldId/evidence
/operator/fields/:fieldId/residual
/operator/fields/:fieldId/forecast
/operator/twin/gateway-demo
/operator/pilot
/customer/dashboard
```

All formal routes remain subject to regression checks even if they are not priority repair routes.

## 30. Responsive rules

```text
The document viewport must not scroll horizontally on normal product pages.
Wide semantic tables may scroll inside their own labelled table container.
Long tokens must wrap, truncate, or use trace-link presentation intentionally.
Primary content must use available desktop width without becoming unreadably wide.
Mobile pages must not render the complete desktop navigation tree before page content.
Focus order and keyboard access must remain valid after navigation changes.
```

## 31. Hard acceptance

For non-export product surfaces:

```text
document.documentElement.scrollWidth <= window.innerWidth + 1
```

Additional requirements:

```text
390px PASS
1366px PASS
1440px PASS
wide-table overflow contained inside ProductDataTable or equivalent semantic wrapper
mobile page context visible before secondary navigation
no clipped headings, boundaries, or primary actions
PFE-6 keyboard baseline remains green
PFE-7 responsive baseline remains green
```

## 32. Non-goals

```text
no export/print strategy work owned by PFA-4
no density redesign owned by PFA-5
no demo-data relabelling owned by PFA-6
```

## 33. Exit meaning

All normal product pages are viewport-contained, and mobile navigation is intentionally usable rather than a compressed desktop shell.

---

# PFA-4 — Export and Print Surface Strategy

## 34. Goal

Define and implement an explicit mobile, desktop, and print contract for Customer export surfaces.

## 35. Owned finding

```text
PFA0-EXP-001
```

## 36. Required product decision

PFA-4 must choose and document one of these strategies:

### Strategy A — Responsive report

```text
Provide a genuinely readable mobile report layout.
Reflow report sections rather than compressing desktop tables.
Preserve print output separately.
```

### Strategy B — Desktop/print-only report with mobile handoff

```text
Explicitly classify the detailed export as desktop/print-only.
On mobile, provide a readable summary and a usable handoff path.
The handoff may include print guidance, download, share, or open-on-desktop instructions.
Do not render an unreadable compressed desktop table.
```

The choice must be recorded in a PFA-4 contract document before implementation is accepted.

## 37. Acceptance

```text
No character-level heading fragmentation.
No vertical one-character table cells.
No unreadable compressed report tables.
Mobile behavior is deliberate and documented.
Desktop export remains readable.
Print output remains stable.
Export locale output passes PFA-2.
Customer reporting-only boundary remains intact.
```

## 38. Blockers

```text
A mobile screenshot that is technically rendered but functionally unreadable
A print regression
A mobile path with no usable handoff
An export surface that implies execution, approval, or control
```

## 39. Exit meaning

Customer export behavior is a product decision rather than accidental responsive compression.

---

# PFA-5 — Information Architecture, Density, and Admin Device Status Readback

## 40. Goal

PFA-5 has two parallel work domains:

```text
A. Information architecture and density remediation
B. Admin Device asset and status readback contract
```

Both domains contain P1 work. Neither may be deferred to PFA-6.

## 41. Domain A — Information architecture and density

### Owned findings

```text
PFA0-CUS-003
PFA0-CUS-005
PFA0-CUS-006
PFA0-OPR-001
PFA0-OPR-003
PFA0-DEN-001
```

### Scope

```text
Customer Dashboard duplicate report entries and column imbalance
Customer Reports Center
Operator Gateway Demo
Operator Audit
Operator Calibration
Operator Pilot readiness
source inventory readability
long pages and excessive scroll depth
```

### Required design outcomes

```text
Summary, navigation, and detail are separated.
Duplicate primary content blocks are removed.
Long pages use section navigation, tabs, accordion, progressive disclosure, or drill-down.
Large lists use pagination, virtualization, bounded sections, or explicit detail routes where appropriate.
Core demo paths are scannable without traversing 10–17 viewport heights.
Tables are not used as the default container for every type of information.
```

### Acceptance

```text
No duplicate Customer Dashboard report-entry block.
Customer Reports Center has a clear summary and bounded detail strategy.
Operator Pilot readiness can be scanned without nested-table overload.
Source inventory references remain traceable but readable.
Gateway, Audit, and Calibration pages expose section-level navigation or progressive disclosure.
No P1 density finding remains open.
```

## 42. Domain B — Admin Device asset and status readback

### Owned finding

```text
PFA0-ADM-003
severity: P1-contract
owner: PFA-5
PFA-6 does not own this issue
```

### Current gap

`/admin/devices` is currently limited to inventory-field documentation. Product acceptance requires an Admin Device Governance Readback surface that combines device asset identity with evidence-backed status readback.

### Required readback domains

```text
device identity
device asset record
field binding
connectivity readback
telemetry recency
health state
degraded and unavailable state
declared capability
source evidence
explicit source-missing state
```

### Required status vocabulary

```text
known
unknown
unavailable
stale
degraded
```

These values are readback semantics. They must not be presented as live control or real-time operational guarantees.

### Evidence rules

```text
Every known status must identify its source evidence or source timestamp.
Unknown means the device is known but the requested status is not established.
Unavailable means the source or required value cannot currently be read.
Stale requires a documented freshness rule and the last available timestamp.
Degraded requires explicit source evidence or a documented read-model rule.
Source absence must render unavailable or source missing.
Declared capability means metadata or readback only; it does not mean currently executable.
```

### Safety boundaries

```text
Do not fabricate live connectivity.
Do not claim live monitoring.
Do not expose device control.
Do not expose restart actions.
Do not expose production gateway actions.
Do not expose AO-ACT dispatch.
Do not infer device health without a documented source or rule.
```

### Backend dependency rule

PFA-5 must first use existing readback sources. If required source data does not exist, the frontend must show `unavailable` or `source missing` and register a separate backend dependency. PFA-5 must not invent fixture-backed production status or silently broaden backend contracts.

### Acceptance

```text
/admin/devices is no longer only a static inventory-field explanation.
The page presents asset identity and status readback as separate but related concepts.
known, unknown, unavailable, stale, and degraded are represented intentionally.
Every state has evidence, a timestamp, a documented rule, or an explicit missing-source state.
Declared capability is labelled as declaration/readback, not execution readiness.
No control, restart, gateway action, or AO-ACT dispatch affordance exists.
The page explicitly states not live monitoring.
PFA0-ADM-003 is closed with route-level evidence.
```

## 43. PFA-5 non-goals

```text
no real-time telemetry system
no production device control
no gateway command surface
no device restart implementation
no autonomous health inference
no field pilot enablement
```

## 44. Exit meaning

Core Customer and Operator pages have deliberate information architecture, and Admin Devices has a safe, evidence-backed asset plus status readback contract.

---

# PFA-6 — Table, Label, and Demo-Data Polish

## 45. Goal

Close remaining P2 presentation defects after PFA-2 through PFA-5 have stabilized localization, responsive layout, export behavior, information architecture, and device status semantics.

## 46. Owned findings

```text
PFA0-CUS-002
PFA0-CUS-004
PFA0-OPR-004
PFA0-ADM-001
```

PFA0-ADM-003 is not owned by PFA-6.

## 47. Scope

```text
unnamed field and operation labels
long ID presentation
badge wrapping
Admin table header and value wrapping
Operator unused-width balance
compact trace and evidence references
```

## 48. Implementation policy

```text
Prefer meaningful source names over cosmetic fallback names.
Use display labels while preserving full IDs for traceability.
Long IDs may be truncated visually only when full access remains available.
Badges must not break into character-level or awkward multi-line fragments.
Admin technical field names should use product-facing display labels.
Do not hide missing data behind invented labels.
```

Demo-only seed metadata may be improved only when the PR explicitly declares demo-seed scope and proves that production contracts and runtime behavior are unchanged.

## 49. Acceptance

```text
No dominant unnamed-field or unnamed-operation output on demo-critical routes.
Long IDs no longer dominate primary table columns.
Full IDs remain copyable or traceable.
Badges remain readable at 390, 1366, and 1440.
Admin table labels do not fragment at character level.
Operator list layouts use available width intentionally.
No P2 issue remains unowned.
```

## 50. Exit meaning

The remaining product-polish defects are closed without changing the role or execution semantics established by earlier phases.

---

# PFA-7 — Full Recapture and Closure Gate

## 51. Goal

Repeat the complete route review after all remediation phases and determine whether Formal Product Frontend v1 can exit PFA remediation.

## 52. Required runtime evidence

```text
30 actual routes
2 locales
3 viewports
180 authenticated screenshots
browser login PASS
browser auth/me PASS
no placeholder-only captures
no unexpected login redirects
```

## 53. Required quality assertions

PFA-7 must execute route-level checks, not only screenshot generation.

Required assertion classes:

```text
route health
boundary safety
role separation
locale consistency
document overflow containment
mobile navigation usability
visual hierarchy
table readability
dense-content handling
demo-data quality
export/print contract
Admin Device status-readback contract
demo readiness
```

Minimum hard checks:

```text
No open P0.
No open P1.
No open P1-contract.
P2 findings are closed or explicitly accepted with evidence.
No unintended document-level horizontal overflow on normal product pages.
No major unintended language residue.
No unreadable export surface.
No core demo route with uncontrolled 10–17 viewport-height density.
/admin/devices satisfies the PFA-5 readback contract.
```

## 54. Required artifacts

```text
PFA-7 closure manifest
PFA-7 route-level result matrix
PFA-7 issue closure register
PFA-7 generated screenshot report
PFA-7 static acceptance gate
PFE-10 bundle-budget result
PFE-11/PFA-2 locale result
PFE-13 freeze regression result
```

Generated screenshot binaries remain audit artifacts and are not committed by default.

## 55. Closure decision

PFA-7 may produce only one of these outcomes:

### PASS

```text
Runtime capture PASS
Page-quality acceptance PASS
No open P1 or P1-contract
P2 closed or explicitly accepted
PFA remediation may close
```

### FAIL

```text
Runtime capture may still PASS
One or more page-quality blockers remain
PFA remediation remains open
Twin Runtime or production-readiness work remains blocked
```

## 56. Completion claim

After PFA-7 PASS, the repository may claim:

```text
The PFE-13 frozen frontend inventory has passed full route-level product-page acceptance across Customer, Operator, Admin, and supporting surfaces in zh-CN and en-US at desktop, laptop, and mobile review widths.
```

Chinese completion claim:

```text
PFE-13 冻结的前端页面清单已经完成全量 route-level 产品页面验收，
覆盖 Customer、Operator、Admin 和 supporting 页面，覆盖 zh-CN、en-US，
并覆盖桌面、笔记本和移动审查宽度。
```

This claim still does not mean live runtime, production gateway, field pilot, or AO-ACT dispatch readiness.

---

# 57. Blocking policy

The blocking policy is final:

```text
PFA-0 reconciles evidence.
PFA-1 enables reliable runtime capture.
PFA-2, PFA-3, PFA-4, and PFA-5 contain open P1 or P1-contract work.
PFA-6 closes P2 polish after structural work is stable.
PFA-7 is the only closure gate.
```

Subsequent Twin Runtime or production-readiness work remains blocked until:

```text
PFA-2 PASS
PFA-3 PASS
PFA-4 PASS
PFA-5 PASS
PFA-6 PASS or explicitly accepted P2 register
PFA-7 PASS
```

No `180/180 PASS` runtime-capture result may be used as a substitute for PFA-7 page-quality acceptance.

## 58. Current execution state

```text
PFA-0: PR #2294, evidence reconciliation in progress
PFA-1: PR #2295, runtime API-base and capture prerequisite implemented
PFA-2: not started
PFA-3: not started
PFA-4: not started
PFA-5: contract ownership established; implementation not started
PFA-6: not started
PFA-7: not started
```

Immediate sequence:

```text
1. Merge PFA-0 after CI and evidence review.
2. Bring latest main/PFA-0 into PFA-1.
3. Re-run PFA-1 build, typecheck, auth, and 180-capture evidence.
4. Merge PFA-1.
5. Start PFA-2 from latest main.
6. Continue strictly through PFA-7.
```
