<!-- docs/digital_twin/GEOX-DT-00-MAINLINE-GOVERNANCE-RESET.md -->
# DT-00 Mainline Governance Reset

## 0. Position

```text
phase: DT-00
name: Mainline Governance Reset
type: governance-only closure
primary mainline: Minimum Complete Field Twin
ultimate goal: Complete Agricultural Digital Twin
result values: PASS | BLOCKED
```

DT-00 changes repository governance only. It does not implement or claim any new State, Forecast, Scenario, Calibration, Action, Execution, live-device, or production-runtime capability.

## 1. Baseline

```text
repository: liyongshang44-max/GEOX
baseline branch: main
baseline commit: 97f5f5c108fb14404f75512b4ab775bd3dcefdeb
baseline meaning: PFA-2 Locale Contract Completion merged
```

Starting PFA state:

```text
PFA-0 complete
PFA-1 complete
PFA-2 complete
PFA-3 through PFA-7 paused by DT-00
```

Starting PR state:

```text
PR #2298
head: pfa-3-responsive-shell-overflow-containment
base: main
starting state: open, draft, unmerged
DT-00 action: closed without merge on 2026-07-08
```

PR #2298 was not rebased, cherry-picked, or merged into this branch.

## 2. Scope

DT-00 resolves four governance defects:

1. PFA-3 was still represented by an open implementation PR after the mainline decision changed.
2. The repository lacked an authoritative complete-digital-twin handoff and master task line.
3. PFA documentation still globally blocked all Twin work through PFA-7.
4. PFA execution state and finding totals were stale after PFA-2 merged.

## 3. Changed files

```text
docs/handoff/GEOX-COMPLETE-AGRICULTURAL-DIGITAL-TWIN-HANDOFF.md
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md
docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json
docs/digital_twin/GEOX-DT-00-MAINLINE-GOVERNANCE-RESET.md
docs/frontend-acceptance/PFA-POST-FREEZE-TASK-LINE.md
docs/frontend-acceptance/PFA-0-ISSUE-REGISTER.md
scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs
```

No application, migration, package, fixture, workflow, or runtime source is modified.

## 4. PFA supersession rule

Current PFA phase state:

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

The remaining findings are:

```text
issue lifecycle: OPEN_RETAINED_PRODUCT_DEBT
default MCFT impact: NON_BLOCKING_UNLESS_TRIGGERED
open findings: 16
resolved by PFA-2: 3
resolved capture findings: 2
historical findings: 21
```

PFA severity remains a product-quality severity and is not automatically an MCFT runtime-blocking severity.

Promotion to `MCFT_BLOCKER` requires all of:

```text
concrete affected MCFT route or object
reproducible evidence
blocked acceptance requirement
named MCFT owner
explicit removal condition
```

A retained PFA finding becomes an MCFT blocker only when it:

1. prevents a required MCFT route from rendering or being operated;
2. causes incorrect Evidence, State, Forecast, Scenario, Decision, Action, or Execution semantics;
3. hides uncertainty, missing evidence, limitations, or safety boundaries;
4. prevents required runtime acceptance or trace inspection; or
5. introduces an authorization, write-boundary, approval, or execution-safety defect.

## 5. Capability matrix binding

`GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json` is a DT-00 governance classification, not the DT-01 code-level reuse verdict.

It must not classify:

```text
P50 as production runtime
P57 as live-device runtime
hourly state transition as established
observation assimilation as established
database checkpoint recovery as established
live production field twin as established
```

It may classify deterministic replay, pure root-zone builders, scenario comparison, governance objects, and Operator read surfaces as established with explicit limitations.

## 6. Acceptance

Run:

```text
node scripts/governance_acceptance/ACCEPTANCE_DT_00_MAINLINE_GOVERNANCE_RESET.cjs
git diff --name-only 97f5f5c108fb14404f75512b4ab775bd3dcefdeb...HEAD
git status --short
```

The DT-00 gate checks:

```text
required files exist
primary and ultimate goals are correct
next task is DT-01
PFA-0 through PFA-2 are complete
PFA-3 through PFA-7 are paused
PR #2298 is recorded as closed without merge
old global PFA blocker is superseded
16 retained findings remain open and are not downgraded
capability matrix parses and uses allowed statuses
established rows contain evidence references
missing rows do not contain a false runtime entry
P50/P57 and missing runtime capabilities are not inflated
semantic boundaries are present
changed-file scope contains governance-only files
```

DT-00 does not require web build, web typecheck, screenshot capture, database acceptance, or Twin runtime acceptance because it does not modify those surfaces.

## 7. Merge blockers

DT-00 is `BLOCKED` if any of the following is true:

```text
PR #2298 remains open or is merged
branch is based on the PFA-3 branch
handoff, master line, matrix, or record is missing
master line does not contain the eight reviewed corrections
PFA documents still globally block DT/MCFT
PFA-2 is still represented as not started
remaining findings are closed or downgraded without evidence
P50/P57 are represented as production/live runtime
hourly estimator or checkpoint recovery is represented as established
runtime source is changed
governance acceptance fails
standard CI fails
```

## 8. Nonclaims

DT-00 does not claim:

```text
continuous first-class State estimation
hourly State transition
observation assimilation
+1h through +72h production forecast
runtime scenario orchestration
continuous residual or calibration
real-device dispatch
field pilot readiness
production Field Twin
Minimum Complete Field Twin completion
```

## 9. Completion result

The repository-level completion result is set only after the branch acceptance and standard CI pass.

```text
result: PASS
PR #2298: CLOSED_WITHOUT_MERGE
primary mainline: MINIMUM_COMPLETE_FIELD_TWIN
ultimate goal: COMPLETE_AGRICULTURAL_DIGITAL_TWIN
next task: DT-01 Existing Capability Reconciliation
```

## 10. Completion statement

```text
DT-00 Mainline Governance Reset is complete.

GEOX has formally moved its primary implementation line from post-freeze
frontend remediation to the Minimum Complete Field Twin.

PFA-3 through PFA-7 are paused phases. The remaining 16 PFA findings are
retained product-quality debt and no longer globally block DT or MCFT.

The repository has an authoritative complete-digital-twin handoff, master
task line, capability matrix, and governance acceptance gate.

No new Twin runtime capability is claimed by DT-00.
```
