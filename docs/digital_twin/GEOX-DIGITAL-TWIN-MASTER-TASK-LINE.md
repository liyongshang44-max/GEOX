<!-- docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md -->
# GEOX Complete Agricultural Digital Twin Master Task Line

## 0. Authority and baseline

```text
repository: liyongshang44-max/GEOX
baseline branch: main
baseline commit: 97f5f5c108fb14404f75512b4ab775bd3dcefdeb
baseline meaning: PFA-2 Locale Contract Completion merged
primary mainline: Minimum Complete Field Twin
ultimate goal: Complete Agricultural Digital Twin
```

This document is the authoritative post-PFA-2 implementation order. PFA remains a retained product-quality line, but PFA-3 through PFA-7 do not globally block DT or MCFT.

## 1. Completion levels

### Level A — Minimum Complete Field Twin

Level A is limited to:

```text
one tenant
one project
one group
one field
one season
one governed zone
one root-zone definition
soil-water as the primary physical state
hourly runtime tick
+1h through +72h, exactly 72 forecast points
fixed irrigation scenarios
human decision
controlled action feedback
state update, residual, and governed calibration candidate
```

Only `MCFT-GATE-C` permits the claim `Minimum Complete Field Twin complete`.

### Level B — Complete Agricultural Digital Twin v1

Level B adds multi-field and multi-zone operation, crop, nutrient, disease, remote sensing, governed recommendation and approval, AO-ACT integration, outcome evidence, effect attribution, ROI, Field Memory, and model governance.

### Level C — Production Agricultural Digital Twin

Level C adds real devices, production gateway, persistent scheduling, high availability, restart and backfill controls, controlled field pilot evidence, production safety, and operational support.

## 2. Runtime family rule

Replay, Shadow-online, Controlled Field, and Production runtimes must share:

```text
domain model
canonical object contracts
state-transition semantics
forecast and scenario engine
persistence semantics
trace and audit chain
```

They may use different:

```text
clock adapter
evidence ingress adapter
scheduler adapter
execution adapter
availability and operational controls
```

The project must not create four semantically independent demo systems.

## 3. Non-negotiable semantic boundaries

```text
Reality is not Evidence.
Evidence is not State.
Sensor Reading is not Root-zone State.
Forecast is not Scenario.
Scenario is not Recommendation.
Decision is not Approval.
Approval is not Dispatch.
Dispatch is not Execution.
Executed is not Validated.
Outcome Evidence is not Effect Attribution.
Assimilation is not Calibration.
Candidate is not Active Model.
Replay Twin is not Production Twin.
```

## 4. Canonical history and revision rule

Canonical runtime history is append-only.

```text
same idempotency key -> same payload
historical State, Forecast, Scenario, Residual, Decision, and Action records are immutable
latest/read indexes may move to a later revision
```

Late evidence must not mutate an old record. Reprocessing the same logical tick creates a new revision with:

```text
revision_id
supersedes_ref
revision_reason
late_evidence_refs
original_tick_ref
```

DT-02 must decide transaction and atomic record-set boundaries before final State object granularity is frozen. The logical concepts are:

```text
state transition
propagated prior
observation update
canonical posterior estimate
assimilation residual and uncertainty update
```

Candidate records may include:

```text
twin_state_transition_v1
  previous_posterior_ref
  propagated_prior
  observation_update
  posterior

twin_state_estimate_v1
  canonical posterior state

twin_assimilation_update_v1
  observation residual
  observation weight
  uncertainty update
```

The names and split are proposed, not frozen before DT-02.

## 5. Execution order

```text
DT-00 Mainline Governance Reset
DT-01 Existing Capability Reconciliation
DT-02 Runtime Architecture Freeze
MCFT-00 through MCFT-18
MCFT-GATE-A Replay-backed Closure
MCFT-GATE-B Shadow-online Closure
MCFT-GATE-C Controlled-action Feedback Closure
CAT-00 through CAT-11
Production hardening and governed field pilot
```

---

# DT phases

## DT-00 — Mainline Governance Reset

Purpose: close PFA-3 without merge, commit the handoff and this task line, establish the capability matrix, supersede the old global PFA block, retain the 16 unresolved PFA findings, and identify DT-01 as the next task.

DT-00 is governance-only and claims no new Twin runtime capability.

## DT-01 — Existing Capability Reconciliation

Perform code-level classification using:

```text
REUSE_AS_IS
REUSE_WITH_ADAPTER
EXTRACT_ALGORITHM
REFERENCE_ONLY
REPLACE
DEPRECATE
```

Minimum inventory:

```text
P31
P42
P43
P49
P50
P57
water_state_estimate_v1
root_zone_soil_water_state_v1
root_zone_soil_water_forecast_v1
root_zone_irrigation_scenario_set_v1
Operator Field Runtime
AO-ACT
Field Memory
```

A capability is not established merely because a document, fixture, dry-run, or acceptance script exists. DT-01 must identify the actual caller, persistence path, runtime entry, state continuation, and failure behavior.

## DT-02 — Runtime Architecture Freeze

Freeze these layers:

```text
domain/       pure deterministic calculations
runtime/      tick orchestration, recovery, late evidence, checkpoints
persistence/  append-only canonical records plus mutable read indexes
routes/       read APIs and separately governed human write entries
web/          read-only runtime presentation
adapters/     clock, ingress, scheduler, execution, availability controls
```

Hard rules:

```text
domain builders do not access databases
domain builders do not read wall clock
canonical objects are immutable
read indexes may upsert
runtime resumes from persisted checkpoint
late evidence creates a revision rather than rewriting history
route inventory is completed before a final API prefix is frozen
```

Any API family listed later in this document is proposed until DT-02 passes.

---

# Minimum Complete Field Twin

## MCFT-00 — Reality Binding Contract

Freeze exactly one tenant, project, group, field, season, governed zone, and root-zone definition. Bind field geometry, soil layers, crop identity, sensor depth and location, weather source, irrigation source, and execution source.

## MCFT-01 — Canonical Replay Dataset

Provide at least 30 days of hourly data with soil moisture, precipitation, ET0 or source weather sufficient to calculate ET0, crop coefficient or crop-stage mapping, irrigation execution evidence, sensor depth, quality, `observed_at`, `ingested_at`, and source references.

Missing, interpolated, and transformed values must remain distinguishable. Future observations may not enter an earlier tick.

## MCFT-02 — Canonical Runtime Object Contracts

Freeze scope, time, provenance, model/config references, deterministic hash, idempotency, revision, previous-chain references, limitations, and atomic record-set rules.

Required logical objects include runtime tick, evidence window, state transition, canonical posterior estimate, assimilation update, forecast run and points, scenario set and projections, decision, action feedback, forecast residual, calibration candidate, model activation, runtime checkpoint, and runtime health.

## MCFT-03 — Persistence Foundation

Create append-only canonical persistence and mutable latest/read indexes for ticks, states, forecasts, scenarios, decisions, feedback, residuals, calibration, checkpoints, and runtime health.

Historical records must never be updated. Duplicate logical work must be idempotent. Revisions must preserve superseded history.

## MCFT-04 — Hourly Runtime Tick

Implement explicit replay clock, manual tick, shadow-online tick, checkpoint, restart recovery, missed-tick backfill, and the states:

```text
SCHEDULED
RUNNING
COMPLETED
COMPLETED_WITH_LIMITATIONS
BLOCKED
FAILED
```

No new evidence, insufficient evidence, policy block, and execution failure must be distinguishable.

## MCFT-05 — Evidence Window Builder

For each tick collect previous posterior, soil observations, weather observations and forecast, irrigation execution, crop-stage context, and soil/root-zone configuration. Calculate coverage, freshness, maximum gap, late and out-of-order evidence, exclusions, and usable evidence references.

## MCFT-06 — Soil-Water Dynamics Model

Implement an explainable hourly root-zone water-balance model:

```text
storage(t+1)
= storage(t)
+ effective rainfall
+ effective irrigation
- crop ET
- drainage
- runoff
```

Support physical bounds, root-zone capacity, soil-layer weighting, process uncertainty, parameter version, and mass-balance trace.

## MCFT-07 — Observation Operator and Assimilation

Map sensor observations to root-zone state using depth, layer, root-zone weights, sensor bias, observation uncertainty, and quality penalties.

```text
posterior(t-1)
-> propagation
-> prior(t)
-> observation residual
-> assimilation
-> posterior(t)
```

An anomalous reading must not directly replace root-zone state. Uncertainty must increase when observations are absent or unusable.

## MCFT-08 — First-class State Runtime

Persist each tick's transition and canonical posterior with storage, available-water fraction, uncertainty, observation residual, evidence refs, previous-state ref, and model/config refs.

Hard acceptance includes 720 continuous hourly ticks, deterministic rerun, immutable history, restart continuity, and governed late-evidence revision.

## MCFT-09 — 72-hour Forecast Runtime

Generate exactly 72 hourly points, from `+1h` through `+72h`. The source posterior at `t0` is not a forecast point.

Each point records target time, predicted storage, predicted available-water fraction, uncertainty, precipitation, ET, assumed irrigation, and any physical bound applied.

## MCFT-10 — Irrigation Scenario Runtime

Gate A requires these fixed scenarios:

```text
NO_ACTION
IRRIGATE_NOW_10MM
IRRIGATE_NOW_20MM
IRRIGATE_NOW_30MM
DELAY_24H_20MM
```

`CUSTOM_OPERATOR_OPTION` is an enhancement and is not a Gate A requirement.

Scenario output includes trajectories, stress duration, minimum available-water fraction, drainage/overflow, total irrigation, failure conditions, and difference from baseline. Scenario does not create a recommendation, approval, or task.

## MCFT-11 — Forecast Residual Runtime

Match later observations to historical forecast points by target time and persist signed error, absolute error, coverage, evidence refs, unmatched reason, and model/config refs.

Residual is not effect attribution, operator success, or automatic proof of model failure.

## MCFT-12 — Calibration Candidate

Residuals may create a review record, parameter-delta candidate, or shadow-model candidate. They may not mutate or activate the current model automatically.

Activation requires candidate, shadow evaluation, governance approval, activation record, rollback information, and proof that a later forecast consumed the activated model.

## MCFT-13 — Human Decision Record

Record selected scenario, decision maker, decision time, rationale, parameters, evidence refs, forecast refs, and scenario refs. Decision is not approval or task creation.

## MCFT-14 — Action Lifecycle Binding

Bind:

```text
decision
approved plan
AO-ACT task
dispatch
receipt
as-executed
acceptance
```

Planned, approved, dispatched, executed, and accepted values must remain separate.

## MCFT-15 — Action Feedback Assimilation

Only trustworthy execution evidence may enter the next state. Persist executed amount, timing, spatial coverage, application efficiency, equipment evidence, and receipt refs.

Planned-only, approved-only, or dispatched-only irrigation must not be treated as executed input.

## MCFT-16 — Closed-loop Runtime Orchestrator

Operate the full longitudinal chain:

```text
tick N posterior
-> forecast
-> scenario
-> human decision
-> approved action
-> execution feedback
-> tick N+1 prior
-> observation assimilation
-> posterior
-> residual
```

A one-shot script is not sufficient.

## MCFT-17 — Runtime Read APIs

The API prefix is proposed until DT-02 route inventory freezes it. Required read capabilities are current field runtime, state history, forecasts, scenarios, residuals, action lifecycle, health, and complete trace.

No parallel Operator API namespace may be introduced without showing why existing route families cannot be extended safely.

## MCFT-18 — Operator Field Runtime Integration

Retain the existing read-only field runtime page family and its Overview, Evidence, State, Forecast, Scenario, Residual, Calibration, Health, and Audit surfaces. Replace demo/read-model placeholders only after real runtime read models exist.

The UI must show prior/posterior semantics, uncertainty, 72-hour trajectory, scenario differences, prediction-versus-observation residual, planned-versus-executed action, health, and the full trace chain.

---

# MCFT closure gates

## MCFT-GATE-A — Replay-backed Closure

Requires at least 30 days of hourly replay, continuous State progression, exactly 72 forecast points per run, fixed scenario branching, later-evidence residual, deterministic rerun, restart recovery, late-evidence revision, and no future leakage.

Allowed claim:

```text
Replay-backed Minimum Field Twin validated
```

## MCFT-GATE-B — Shadow-online Closure

Requires continuous online ticks, late and out-of-order handling, restart recovery, missing-data degradation, online State/Forecast readback, and no automatic real-world action.

Allowed claim:

```text
Shadow-online Minimum Field Twin validated
```

## MCFT-GATE-C — Controlled-action Feedback Closure

Requires at least one governed sequence from scenario to human decision, approval, AO-ACT, dispatch, receipt, as-executed evidence, next State, and residual.

Only this gate permits:

```text
Minimum Complete Field Twin complete
```

---

# Complete Agricultural Digital Twin expansion

## CAT-00 — Multi-field and Multi-zone Runtime

Add multiple fields and zones, independent state chains, shared weather, device bindings, concurrent ticks, and per-field/per-zone checkpoints.

## CAT-01 — Skill Pack Architecture

Treat Crop, Soil, Weather, Device, Operation, State Estimator, Forecast Model, and Scenario capabilities as governed Skill Packs with version, scope, input/output contracts, parameter schemas, compatibility, validation, and evidence refs.

## CAT-02 — Crop Phenology and Biomass Twin

Add growth stage, thermal time, canopy, root depth, biomass proxy, crop coefficient, and yield-formation stage.

## CAT-03 — Nitrogen and Nutrient Twin

Add soil nitrogen state, crop demand, fertilizer execution, leaching, uptake estimate, forecast, and governed fertilization scenarios.

## CAT-04 — Disease and Pest Risk Twin

Add host stage, weather suitability, infection windows, observation evidence, risk forecasts, and spray scenarios. Risk is a belief, not a disease fact.

## CAT-05 — Spatial and Remote-sensing Twin

Add geometry, management zones, satellite/drone evidence, vegetation/thermal indicators, and spatial uncertainty. Remote sensing remains Evidence and must not silently overwrite State.

## CAT-06 — Unified Agricultural State

Provide a container for soil-water, crop, nutrient, disease-risk, weather, operation, device, and economic context while preserving independent provenance and uncertainty per domain.

## CAT-07 — Multi-domain Forecast and Scenario Engine

Support irrigation, fertilization, spraying, planting, harvesting, and combined scenarios. Ranking requires an explicit policy and may not be inferred silently.

## CAT-08 — Recommendation and Approval Bridge

Implement Scenario -> Recommendation Candidate -> Human Review -> Approval Request -> Approved Plan. Scenario never directly creates AO-ACT.

## CAT-09 — AO-ACT and Device Runtime Integration

Add device capability readback, gateway status, compatibility, dispatch, receipt, execution telemetry, failure, cancellation, and rollback. Device Skill Packs define capabilities.

## CAT-10 — Outcome, Effect, ROI, and Field Memory

Keep Outcome Evidence, Effect Attribution, ROI, and Field Memory separate. Effect attribution requires baseline/counterfactual reasoning, weather, other operations, coverage, and time-window controls.

## CAT-11 — Learning and Model Governance

Add model and parameter registries, training snapshots, calibration candidates, shadow evaluation, canary activation, active model, rollback, and next-forecast consumption proof. No unreviewed Field Memory learning and no silent model activation.

---

# Production hardening and final freeze

Production readiness requires persistent scheduling, distributed locks, idempotent jobs, checkpoint recovery, late-data reconciliation, backfill, health, metrics, logs, alerts, retention, archive, security, and tenant isolation.

Field pilot progression is:

```text
Replay
-> Shadow
-> Advisory
-> Controlled Action
-> Expanded Controlled Action
```

The final complete-digital-twin claim requires proof of reality binding, traceable evidence, continuous state estimation, forecast consumption of active State, scenario branching, human decision, separate approval and execution, feedback-driven State update, residual, governed calibration and model activation, separated outcome/effect semantics, shared replay/live architecture, restart survival, missing-data behavior, and complete Operator trace inspection.

## Uniform task delivery requirements

Every implementation task must deliver as applicable:

```text
contract document
domain implementation
persistence/migration
runtime integration
read model
positive acceptance
negative fixtures
determinism proof
idempotency proof
revision proof
boundary/nonclaim proof
evidence packet
closure record
```

Fixture-only, dry-run-only, documentation-only, hard-coded PASS, or acceptance-output-only work must not be described as runtime completion.

## Branch and merge discipline

```text
one task, one branch, one PR
start from latest main
merge prerequisites before dependent implementation
keep early algorithm, persistence, runtime, and UI changes in separate reviewable tasks
run all applicable regression after each merge
```

## Immediate next task

```text
DT-01 Existing Capability Reconciliation
```
