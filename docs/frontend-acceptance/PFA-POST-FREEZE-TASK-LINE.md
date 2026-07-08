<!-- docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md -->
# PFA Post-Freeze Remediation Roadmap

## 0. Current DT-00 status ruling

```text
Current status:
PFA-0 complete
PFA-1 complete
PFA-2 complete
PFA-3 through PFA-7 paused

PFA-3 PR:
#2298 closed without merge

Superseding mainline:
DT / Minimum Complete Field Twin

PFA role:
retained product-quality line
```

The current implementation sequence is:

```text
DT-00 -> DT-01 -> DT-02 -> MCFT
```

PFA-3 through PFA-7 do not globally block DT or MCFT.

A retained PFA finding becomes an `MCFT_BLOCKER` only when concrete evidence proves that it:

1. prevents a required MCFT route from rendering or being operated;
2. causes incorrect Evidence, State, Forecast, Scenario, Decision, Action, or Execution semantics;
3. hides uncertainty, missing evidence, limitations, or safety boundaries;
4. prevents required runtime acceptance or trace inspection; or
5. introduces an authorization, write-boundary, approval, or execution-safety defect.

Promotion requires a concrete affected MCFT route or object, reproducible evidence, a blocked acceptance requirement, a named MCFT owner, and a removal condition.

The former policy that treated PFA-7 as a global prerequisite for any Twin Runtime work is historical policy, superseded by DT-00, and is not the current blocking policy.

## 1. Purpose

PFA means Product Frontend Acceptance. PFE-13 froze the engineering baseline of Formal Product Frontend v1. PFA is the post-freeze product-page quality line for readability, localization, responsive behavior, visual coherence, demonstration quality, and product handoff.

PFA completion still does not mean:

```text
live runtime is production-ready
digital twin runtime is complete
field pilot can start
production gateway is online
AO-ACT dispatch is enabled
real devices are under production control
```

## 2. Governing sources

```text
docs/frontend-productization/PFE-13-FREEZE-MANIFEST.json
docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json
docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json
docs/frontend-acceptance/PFA-0-ROUTE-REVIEW-MATRIX.json
docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md
docs/frontend-acceptance/PFA-0-REVIEW-RUBRIC.md
docs/frontend-acceptance/PFA-5-ADMIN-DEVICES-READBACK.md
```

The PFE-13 inventory remains the route source of truth. Any route addition, removal, or topology change requires a separately governed phase.

## 3. Evidence and finding baseline

```text
30 actual routes
2 locales: zh-CN and en-US
3 viewports: 1440, 1366, and 390
180 authenticated screenshots
runtime capture result: 180/180 PASS
page-quality result: FAIL with retained P1/P2/P1-contract findings
```

Mandatory distinction:

```text
runtime capture PASS != page-quality PASS
```

Current authoritative finding totals:

```text
open findings: 16
resolved PFA-2 findings: 3
resolved capture findings: 2
historical findings: 21
```

The earlier `19 open findings` figure is retained only as the historical pre-PFA-2 baseline. It is not the current finding count.

## 4. Current phase state

```text
PFA-0: COMPLETE
PFA-1: COMPLETE
PFA-2: COMPLETE
PFA-3: PAUSED; PR #2298 CLOSED_WITHOUT_MERGE
PFA-4: PAUSED
PFA-5: PAUSED
PFA-6: PAUSED
PFA-7: PAUSED
```

PFA-3 through PFA-7 are paused phases. The unresolved findings are `OPEN_RETAINED_PRODUCT_DEBT`, with default MCFT impact `NON_BLOCKING_UNLESS_TRIGGERED`.

## 5. Global invariants

```text
Customer remains report-oriented and cannot dispatch, approve, or write facts.
Operator remains read-only and replay/review-oriented unless a separately governed route says otherwise.
Admin remains governance/readback-oriented and not a production control console.
No page may claim live device connectivity without real evidence.
No page may claim production gateway online.
No page may claim field pilot started.
No page may claim AO-ACT dispatch enabled.
No page may fabricate source status, health, telemetry, or capability.
```

Default PFA forbidden changes remain:

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

A future MCFT task may repair a retained PFA issue only when the task explicitly binds the issue to a required MCFT route, object, acceptance, authorization, or safety boundary.

## 6. Completed historical phases

```text
PFA-0 Evidence Reconciliation: COMPLETE
PFA-1 Runtime API-Base and Capture Enablement: COMPLETE
PFA-2 Locale Contract Completion: COMPLETE
```

PFA-0 and PFA-1 historical implementation details remain available in their phase documents and Git history. PFA-2 closure evidence remains in `PFA-2-RUNTIME-EVIDENCE.md`, `PFA-2-ISSUE-CLOSURE.md`, and `PFA-2-ROUTE-LOCALE-MATRIX.json`.

---

# Historical baseline definitions — PFA-3 through PFA-7

Everything from this heading through `Historical baseline end` is retained verbatim in substance from the pre-DT-00 roadmap for future product-quality resumption. Any statement in this historical section that globally blocks Twin Runtime, calls PFA-2 not started, or identifies PFA-3 as the next active phase is superseded by the DT-00 current ruling above and the authoritative closure below.

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

# Historical baseline end

---

# DT-00 Current authoritative closure

The historical baseline above is retained for future product-quality resumption but is not current execution policy.

```text
PFA-0: COMPLETE
PFA-1: COMPLETE
PFA-2: COMPLETE
PFA-3: PAUSED; PR #2298 CLOSED_WITHOUT_MERGE
PFA-4: PAUSED
PFA-5: PAUSED
PFA-6: PAUSED
PFA-7: PAUSED
```

Current blocking policy:

```text
PFA-3 through PFA-7 do not globally block DT or MCFT.
PFA remediation remains open for the 16 retained findings.
An individual finding blocks MCFT only after evidence-based promotion to MCFT_BLOCKER.
```

Current authoritative next step:

```text
DT-01 Existing Capability Reconciliation
```
