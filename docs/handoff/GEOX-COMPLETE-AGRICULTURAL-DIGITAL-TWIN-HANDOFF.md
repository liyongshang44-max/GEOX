<!-- docs/handoff/GEOX-COMPLETE-AGRICULTURAL-DIGITAL-TWIN-HANDOFF.md -->
# GEOX Complete Agricultural Digital Twin Handoff

## 0. Purpose

This document transfers the GEOX implementation line from post-freeze frontend remediation to the Minimum Complete Field Twin (MCFT). It fixes the repository baseline, current capability boundary, runtime claim levels, reuse constraints, and the next execution order.

## 1. Repository baseline

```text
repository: liyongshang44-max/GEOX
baseline branch: main
baseline commit: 97f5f5c108fb14404f75512b4ab775bd3dcefdeb
baseline meaning: PFA-2 Locale Contract Completion merged
baseline date: 2026-07-08
```

PFA state after DT-00:

```text
PFA-0 complete
PFA-1 complete
PFA-2 complete
PFA-3 through PFA-7 paused
PR #2298 closed without merge
remaining findings: 16 OPEN_RETAINED_PRODUCT_DEBT
```

The PFA-3 branch is not part of `main` and must not be merged, rebased, or cherry-picked into DT-00.

## 2. Mainline decision

```text
Primary Mainline:
Minimum Complete Field Twin

Ultimate Goal:
Complete Agricultural Digital Twin

Immediate sequence:
DT-00 -> DT-01 -> DT-02 -> MCFT
```

PFA remains a retained product-quality line. A PFA issue blocks MCFT only after concrete evidence identifies the affected MCFT route or object, reproducible failure, blocked acceptance requirement, owner, and removal condition.

## 3. Current repository capability

Established foundations include:

```text
append-only facts and governed evidence references
scope, provenance, traceability, determinism, idempotency, and replay patterns
State / Forecast / Scenario / Residual / Calibration governance vocabulary
Recommendation / Approval / AO-ACT / Dispatch / Execution separation
Customer / Operator / Admin role boundaries
read-only Operator Field Runtime surfaces
deterministic root-zone state, forecast, and irrigation scenario builders
replay-backed vertical demo chains
```

The current repository is best described as:

```text
GOVERNED_DETERMINISTIC_REPLAY_TWIN_FOUNDATION
```

It is not a continuously operating Field Twin.

## 4. Current limitations

The following are not established:

```text
continuous first-class hourly field State progression
production observation-assimilation loop
immutable canonical posterior history across restart
persistent database checkpoint and missed-tick recovery
posterior-driven +1h through +72h forecast runtime
continuous action-feedback-to-next-State loop
continuous residual-driven calibration governance
live-device production Field Twin
```

Evidence must never be relabelled as State. A latest sensor value is not a root-zone posterior estimate.

## 5. Existing runtime claims

### P50

P50 is a deterministic historical replay demo with explicit clock, evidence partitioning, no-future-leakage checks, deterministic identifiers, residual/calibration demonstration, and controlled acceptance-output persistence.

P50 is not:

```text
a background loop
a production state estimator
a production forecast API
a live-device runtime
a field pilot
a production persistence system
a complete Runtime v1 freeze
```

### P57

P57 is a replay-backed audit/freeze with explicit limitations. It is not a live-device runtime, production gateway, persistent scheduler, or controlled field feedback loop.

Therefore:

```text
P50 is a deterministic replay demo.
P57 is a replay-backed freeze.
Neither is a live production Field Twin.
```

## 6. Complete Agricultural Digital Twin definition

A complete agricultural digital twin is a persistent computational proxy for a governed real field. It must operate the following loop:

```text
Reality
-> Evidence
-> State / Belief
-> Dynamics / Model
-> Forecast
-> Scenario
-> Policy / Human Decision
-> Approval / Action
-> Outcome Evidence
-> Residual / Assimilation / Calibration
-> Updated State / Belief
```

The ten capability domains are:

```text
Reality
Evidence
State / Belief
Dynamics / Model
Forecast
Scenario
Policy / Decision
Action
Outcome Evidence
Residual / Assimilation / Calibration
```

Updated State re-enters the State domain; it is not a separate eleventh domain.

## 7. Semantic boundaries

```text
Reality != Evidence
Evidence != State
Sensor Reading != Root-zone State
Forecast != Scenario
Scenario != Recommendation
Decision != Approval
Approval != Dispatch
Dispatch != Execution
Executed != Validated
Outcome Evidence != Effect Attribution
Assimilation != Calibration
Candidate != Active Model
Replay Twin != Production Twin
```

## 8. Runtime claim levels

```text
Level A: Replay-backed Minimum Field Twin validated
Level B: Shadow-online Minimum Field Twin validated
Level C: Minimum Complete Field Twin complete
Level D: Complete Agricultural Digital Twin v1 complete
Level E: Production Agricultural Digital Twin v1 ready
```

Only controlled-action feedback closure permits the MCFT completion claim.

## 9. Minimum Complete Field Twin objective

Level A scope is fixed to:

```text
one tenant
one project
one group
one field
one season
one governed zone
one root-zone definition
soil-water primary State
hourly tick
+1h through +72h forecast, exactly 72 points
fixed irrigation scenarios
human decision
controlled execution feedback
next-State update
forecast residual
governed calibration candidate
```

Multi-zone and multi-field operation belongs to CAT-00.

## 10. Runtime family architecture

Replay, Shadow-online, Controlled Field, and Production share:

```text
domain model
canonical object contracts
state-transition semantics
forecast/scenario engine
persistence semantics
trace/audit chain
```

They may use different clock, evidence ingress, scheduler, execution, availability, and operational-control adapters.

## 11. Reuse boundaries

Direct or adapted reuse candidates:

```text
append-only facts and evidence refs
scope/auth/audit/idempotency patterns
P50 explicit clock and no-future-leakage structure
root_zone_soil_water_state_builder_v1
root_zone_soil_water_forecast_builder_v1
root_zone_irrigation_scenario_builder_v1
Operator Field Runtime route and tab structure
AO-ACT approval/task/receipt boundaries
```

Reference-only or replace candidates:

```text
P31 controlled state test runtime
P42 controlled active forecast runner
P43 controlled residual ledger
P49 evidence matrix
P50 demo state/forecast/calibration math and acceptance-output persistence
water_state_estimate_v1 latest-sensor-as-root-zone semantics
current constant-risk forecast timeline
```

DT-01 must verify callers, persistence paths, runtime entries, and failure behavior before assigning final reuse classifications.

## 12. Canonical history and late evidence

Historical canonical objects are immutable. The same idempotency key must always represent the same payload.

Late evidence reprocessing creates a new revision with:

```text
revision_id
supersedes_ref
revision_reason
late_evidence_refs
original_tick_ref
```

Latest indexes may point to a new revision; old State, Forecast, Scenario, Residual, Decision, and Action records remain unchanged.

## 13. Forecast precision

A 72-hour forecast contains exactly:

```text
+1h through +72h = 72 forecast points
```

The source posterior at `t0` is not a forecast point.

## 14. API and object-contract freeze boundary

The final State record granularity and API prefix are not frozen by DT-00. DT-02 must first decide atomic record-set behavior, transaction boundaries, route inventory, and compatibility with current Operator routes.

## 15. PFA paused status

The 16 unresolved PFA findings remain open with original severity and remediation ownership. Their default MCFT impact is `NON_BLOCKING_UNLESS_TRIGGERED`. DT-00 does not repair, close, or downgrade them.

## 16. Handoff instructions

The implementation owner must:

1. complete DT-01 code-level capability reconciliation;
2. freeze runtime architecture in DT-02;
3. build MCFT vertically rather than completing all States before all Forecasts;
4. prove replay, shadow-online, and controlled-action feedback in order;
5. preserve immutable history, revision semantics, uncertainty, and nonclaims;
6. prevent demo/fixture/acceptance evidence from being promoted into production claims.

Authoritative task line:

```text
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md
```

Capability matrix:

```text
docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json
```

## 17. DT-00 nonclaim

```text
No new Twin runtime capability is claimed by DT-00.
```
