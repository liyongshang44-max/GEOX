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

---

# Historical phase definitions retained by DT-00

The definitions below preserve the PFA-0 through PFA-7 product-quality work. They are paused planning records, not the current implementation sequence.

## PFA-0 — Evidence Reconciliation

Goal:

```text
Reconcile the frozen route inventory, review matrix, issue register,
and complete 180-screenshot evidence without changing page runtime source.
```

Historical required outcomes:

```text
30 actual routes
zh-CN and en-US
1440, 1366, and 390
180 authenticated screenshot records
runtime capture separated from page-quality result
all findings assigned to a remediation phase
no page runtime-source changes
```

Completion state: `COMPLETE`.

## PFA-1 — Runtime API-Base and Capture Enablement

Goal:

```text
Make the Vite-provided API base effective so browser authentication,
auth/me, and full screenshot capture use the intended runtime origin.
```

Historical acceptance:

```text
web typecheck PASS
web build PASS
browser login PASS
browser auth/me PASS
30 routes x 2 locales x 3 viewports = 180
180/180 capture PASS
```

Completion state: `COMPLETE`.

## PFA-2 — Locale Contract Completion

Owned historical findings:

```text
PFA0-I18N-001
PFA0-CUS-001
PFA0-ADM-002
```

Goal:

```text
Make zh-CN and en-US complete, intentional, role-safe,
and mutually consistent product outputs.
```

Historical acceptance included route-level locale differentiation, no unintended major foreign-language residue, localized login/export/shared states, and preserved role/safety semantics.

Completion state: `COMPLETE`; three findings are recorded as resolved by PFA-2.

## PFA-3 — Responsive Shell and Overflow Containment

Owned retained findings:

```text
PFA0-RWD-001
PFA0-NAV-001
PFA0-OPR-002
PFA0-OPR-005
```

Goal:

```text
Eliminate unintended document-level horizontal overflow,
contain wide data inside semantic containers,
and provide a usable compact mobile navigation pattern.
```

Historical hard rule for non-export pages:

```text
document.documentElement.scrollWidth <= window.innerWidth + 1
```

The original implementation PR #2298 was closed without merge under DT-00. Applicable work may return only through a new task with concrete MCFT-blocking evidence.

Current state: `PAUSED`.

## PFA-4 — Export and Print Surface Strategy

Owned retained finding:

```text
PFA0-EXP-001
```

Goal:

```text
Define an explicit desktop, mobile, and print contract for Customer exports.
```

The historical phase required a governed choice between a genuinely responsive report and an explicitly desktop/print-oriented report with safe narrow-width behavior. Export content must remain traceable and must not invent operational semantics.

Current state: `PAUSED`.

## PFA-5 — Information Architecture, Density, and Admin Device Status Readback

Owned retained findings:

```text
PFA0-CUS-003
PFA0-CUS-005
PFA0-CUS-006
PFA0-OPR-001
PFA0-OPR-003
PFA0-ADM-003
PFA0-DEN-001
```

Goal:

```text
Improve hierarchy and density on core Customer and Operator pages,
and establish a safe read-only Admin Device asset/status contract.
```

Admin Device historical contract:

```text
device identity
asset record
field binding
connectivity readback
telemetry recency
known / unknown / unavailable / stale / degraded
declared capability
source evidence
```

Safety rules remain: no fabricated connectivity, no live-monitoring claim, no control/restart/gateway actions, and no AO-ACT dispatch affordance.

Current state: `PAUSED`.

## PFA-6 — Table, Label, and Demo-Data Polish

Owned retained findings:

```text
PFA0-CUS-002
PFA0-CUS-004
PFA0-OPR-004
PFA0-ADM-001
```

Goal:

```text
Close remaining presentation defects after localization,
responsive containment, export behavior, information architecture,
and device-status semantics are stable.
```

Historical scope included meaningful labels, long-ID presentation, badge wrapping, table header/value wrapping, Operator width use, and trace/evidence reference presentation. Missing data may not be hidden behind invented labels.

Current state: `PAUSED`.

## PFA-7 — Full Recapture and Closure Gate

Goal:

```text
Repeat the complete route review after remediation and decide whether
Formal Product Frontend v1 can exit PFA remediation.
```

Historical evidence model:

```text
30 routes
2 locales
3 viewports
180 authenticated screenshots
route health and role-boundary assertions
locale consistency
overflow containment
mobile navigation
table readability
density handling
export/print contract
Admin Device status-readback contract
demo readiness
```

Current DT-00 ruling for a future PFA-7 FAIL is:

```text
PFA remediation remains open.
DT / MCFT is blocked only for an individually promoted MCFT_BLOCKER
that meets the DT-00 evidence and ownership criteria.
```

Current state: `PAUSED`.

## 6. Branch and restart rule

If PFA resumes, each phase must use a new branch from the then-current `main`. The closed PFA-3 branch must not be merged or rebased into the DT/MCFT line. Historical work may be selectively reimplemented only after a new task identifies its current route, acceptance, and semantic owner.

## 7. Current authoritative next step

```text
DT-01 Existing Capability Reconciliation
```
