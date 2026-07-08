<!-- docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md -->
# GEOX Complete Agricultural Digital Twin Master Task Line

## 0. Authority and current baseline

```text
repository: liyongshang44-max/GEOX
current main baseline for DT-01: bce918d1eea423397bdd329148b7a2e7eb181b6c
baseline meaning: DT-00 Mainline Governance Reset merged
primary mainline: Minimum Complete Field Twin
ultimate goal: Complete Agricultural Digital Twin
```

This file is the authoritative post-PFA implementation order.

Current phase state:

```text
DT-00: COMPLETE
DT-01: IMPLEMENTED_PENDING_DEDICATED_ACCEPTANCE
DT-02: NOT_STARTED
MCFT: NOT_STARTED
CAT: NOT_STARTED
```

DT-01 detail is authoritative in:

```text
docs/digital_twin/GEOX-DT-01-EXISTING-CAPABILITY-RECONCILIATION.md
docs/digital_twin/GEOX-DT-01-CAPABILITY-INVENTORY.json
docs/digital_twin/GEOX-DT-01-DT-02-INPUT-PACKET.md
```

## 1. Completion levels

### Minimum Complete Field Twin

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
+1h through +72h, exactly 72 forecast points
fixed irrigation scenarios
human decision
controlled action feedback
next-State update
forecast residual
governed calibration candidate
```

Only `MCFT-GATE-C` permits `Minimum Complete Field Twin complete`.

### Complete Agricultural Digital Twin v1

Adds multi-field/multi-zone, crop, nutrient, disease, remote sensing, multi-domain scenarios, recommendation/approval, AO-ACT integration, outcome/effect/ROI/Field Memory, and model governance.

### Production Agricultural Digital Twin

Adds real gateways/devices, persistent scheduling, high availability, restart/backfill, operational monitoring, and governed field-pilot evidence.

## 2. Runtime family rule

Replay, Shadow-online, Controlled Field, and Production share:

```text
domain model
canonical object contracts
state-transition semantics
forecast/scenario engine
persistence semantics
trace/audit chain
```

They may differ through:

```text
clock adapter
evidence ingress adapter
scheduler adapter
execution adapter
availability and operational controls
```

## 3. Semantic boundaries

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

## 4. Canonical history rule

```text
same idempotency key -> same payload
canonical history is immutable
latest indexes may point to a later revision
late evidence creates a new revision
```

Required late-evidence fields:

```text
revision_id
supersedes_ref
revision_reason
late_evidence_refs
original_tick_ref
```

## 5. Phase order

```text
DT-00 Mainline Governance Reset
DT-01 Existing Capability Reconciliation
DT-02 Runtime Architecture Freeze
MCFT-00 through MCFT-18
MCFT-GATE-A Replay-backed Closure
MCFT-GATE-B Shadow-online Closure
MCFT-GATE-C Controlled-action Feedback Closure
CAT-00 through CAT-11
Production hardening and field pilot
```

## DT-00 — Mainline Governance Reset

Status: `COMPLETE`.

DT-00 closed PFA-3 PR #2298 without merge, committed the complete-digital-twin handoff, superseded the global PFA block, retained 16 product-quality findings, and made MCFT the primary implementation line.

DT-00 claimed no runtime capability.

## DT-01 — Existing Capability Reconciliation

DT-01 inventories definitions, callers, runtime entries, inputs, clocks, persistence, read models, routes, write boundaries, verification, capability status, reuse decisions, limitations, and DT-02 implications.

Formal component decisions:

```text
REUSE_AS_IS
REUSE_WITH_ADAPTER
EXTRACT_ALGORITHM
REFERENCE_ONLY
REPLACE
DEPRECATE
```

Evidence levels:

```text
DEFINITION_ONLY
TEST_OR_ACCEPTANCE_ONLY
SCRIPT_RUNNER
DATABASE_READBACK
SERVER_ROUTE
SERVER_WRITE_PATH
SCHEDULED_RUNTIME
LIVE_INGRESS
UNKNOWN
```

DT-01 findings:

```text
facts/provenance/scope: established
root-zone builders: established with limitations
P31/P42/P43/P50/P57: controlled/replay/freeze, not continuous production runtime
Operator canonical route shell: reusable with adapters
AO-ACT/approval/receipt: real request-driven server paths, not yet MCFT-bound
ROI/Field Memory: real governed server/database capabilities, deferred to CAT
hourly tick/assimilation/posterior/checkpoint/recovery/revision/72h regeneration: MISSING
```

DT-01 does not implement adapters, extraction, replacement, deprecation, or missing runtime capability.

After DT-01 acceptance and merge, the next task is:

```text
DT-02 Runtime Architecture Freeze
```

## DT-02 — Runtime Architecture Freeze

Freeze:

```text
domain/
runtime/
persistence/
routes/
web/
adapters/
```

Decide:

```text
canonical record atomicity
state-transition granularity
canonical versus latest-index persistence
tick transaction
checkpoint/recovery ownership
late-evidence revisions
forecast run/point storage
scenario set/projection storage
model registry/activation consumption
API prefix and legacy compatibility
```

No final State object split or API prefix is frozen before DT-02.

## MCFT-00 — Reality Binding Contract

Bind exactly one tenant, project, group, field, season, governed zone, root-zone definition, geometry, soil layers, crop, sensors, weather, irrigation, and execution source.

## MCFT-01 — Canonical Replay Dataset

At least 30 days hourly data with observed/ingested timestamps, soil moisture, precipitation, ET0, crop stage/Kc, irrigation execution, sensor depth, quality, explicit missingness, and no future leakage.

## MCFT-02 — Canonical Runtime Object Contracts

Freeze tick, evidence window, state transition, posterior, assimilation update, forecast run/points, scenario set/projections, decision, action feedback, residual, calibration candidate, activation, checkpoint, health, revision, and trace contracts.

## MCFT-03 — Persistence Foundation

Implement immutable canonical history plus mutable latest/read indexes, idempotency, revision, and restart-safe persistence.

## MCFT-04 — Hourly Runtime Tick

Implement replay/manual/shadow clocks, tick claim, status, checkpoint, recovery, missed-tick backfill, and idempotent retry.

## MCFT-05 — Evidence Window

Collect previous posterior, observations, weather, forecast, execution, crop/soil context, coverage, freshness, gaps, late/out-of-order evidence, exclusions, and refs.

## MCFT-06 — Soil-Water Dynamics

```text
storage(t+1)
= storage(t)
+ effective rainfall
+ effective irrigation
- crop ET
- drainage
- runoff
```

Include bounds, capacity, layers, process uncertainty, parameter version, and mass-balance trace.

## MCFT-07 — Observation and Assimilation

Map sensor evidence by depth/layer/root-zone weights/bias/uncertainty/quality into:

```text
previous posterior
-> propagation
-> prior
-> residual
-> observation update
-> posterior
```

## MCFT-08 — First-class State Runtime

Persist continuous immutable posterior history, uncertainty, residual, evidence, previous/revision refs, model/config refs, deterministic rerun, restart continuity, and late-evidence revisions.

## MCFT-09 — 72-hour Forecast

Exactly 72 points from `+1h` through `+72h`; t0 remains the source posterior.

## MCFT-10 — Irrigation Scenarios

Gate A fixed options:

```text
NO_ACTION
IRRIGATE_NOW_10MM
IRRIGATE_NOW_20MM
IRRIGATE_NOW_30MM
DELAY_24H_20MM
```

`CUSTOM_OPERATOR_OPTION` is an enhancement, not Gate A.

## MCFT-11 — Forecast Residual

Match later evidence by target time and persist signed/absolute error, coverage, refs, unmatched reason, model/config, and revision.

## MCFT-12 — Calibration Candidate

Residual may create review/candidate/shadow records. It may not mutate or activate the active model automatically.

## MCFT-13 — Human Decision

Record human scenario selection, rationale, parameters, and refs. Decision is not approval or task.

## MCFT-14 — Action Lifecycle

Bind decision -> approved plan -> AO-ACT -> dispatch -> receipt -> as-executed -> acceptance without collapsing states.

## MCFT-15 — Action Feedback Assimilation

Only trustworthy executed evidence may enter the next State. Planned, approved, and dispatched values may not.

## MCFT-16 — Closed-loop Runtime Orchestrator

Operate the longitudinal tick/forecast/scenario/decision/action/feedback/next-State/residual chain. A one-shot script is insufficient.

## MCFT-17 — Runtime Read APIs

Freeze API naming only after DT-02 route inventory. Extend existing Operator families where safe; avoid parallel namespaces without justification.

## MCFT-18 — Operator Integration

Retain the canonical field route/tab shell and replace placeholders only after real runtime read models exist.

## MCFT-GATE-A — Replay-backed Closure

Requires 30-day hourly replay, continuous State, 72-point forecast, fixed scenarios, residual, determinism, restart, revision, and no future leakage.

## MCFT-GATE-B — Shadow-online Closure

Requires continuous online ticks, late/out-of-order handling, restart, degradation, readback, and no automatic action.

## MCFT-GATE-C — Controlled-action Feedback Closure

Requires scenario -> human decision -> approval -> AO-ACT -> dispatch -> receipt -> executed evidence -> next State -> residual.

Only Gate C permits the MCFT completion claim.

## CAT-00 through CAT-11

```text
CAT-00 Multi-field and Multi-zone Runtime
CAT-01 Skill Pack Architecture
CAT-02 Crop Phenology and Biomass Twin
CAT-03 Nitrogen and Nutrient Twin
CAT-04 Disease and Pest Risk Twin
CAT-05 Spatial and Remote-sensing Twin
CAT-06 Unified Agricultural State
CAT-07 Multi-domain Forecast and Scenario
CAT-08 Recommendation and Approval Bridge
CAT-09 AO-ACT and Device Runtime Integration
CAT-10 Outcome, Effect, ROI, and Field Memory
CAT-11 Learning and Model Governance
```

Crop, Soil, Weather, Device, Operation, State Estimator, Forecast, and Scenario capabilities are governed Skill Packs.

## Production hardening

Requires scheduling, locks, idempotency, checkpoint recovery, late-data reconciliation, backfill, health, metrics, logs, alerts, retention, security, tenant isolation, and staged field pilot:

```text
Replay -> Shadow -> Advisory -> Controlled Action -> Expanded Controlled Action
```

## Uniform delivery rules

Every implementation task must deliver applicable contract, domain, persistence, runtime, read model, positive/negative acceptance, determinism, idempotency, revision, nonclaim, evidence, and closure records.

Fixture-only, dry-run-only, documentation-only, hard-coded PASS, or acceptance-output-only work may not be described as runtime completion.

## Branch discipline

```text
one task / one branch / one PR
start from latest main
merge predecessor before successor
do not mix unrelated implementation layers
run applicable regression before merge
```
