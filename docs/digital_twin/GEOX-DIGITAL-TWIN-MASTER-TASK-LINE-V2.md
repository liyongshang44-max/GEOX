<!-- docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md -->
# GEOX Complete Agricultural Digital Twin Master Task Line V2

## 0. Authority

```text
repository: liyongshang44-max/GEOX
authority_version: V2
authority_status: CURRENT
settlement_subject_main: 0012144aa3d69698b6bc94a113ff00c7652dd043
primary_mainline: Minimum Complete Field Twin
ultimate_goal: Complete Agricultural Digital Twin
```

This file is the current forward-looking Master authority. The historical
`GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md` remains immutable for legacy acceptance
and historical audit, but its former 30-day/720-tick, five-scenario and
historical-revision requirements no longer define Stage 1A successor closure.

Current authority chain:

```text
GEOX-MCFT-SSOT-CURRENT-V1.json
→ this Master V2
→ GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json
→ GEOX-MCFT-CAP-08-TASK.md
→ capability Current Authority / delivery status
→ exact merge-SHA immutable artifact
```

## 1. Completion levels

### Stage 1A — Replay-backed closure

Stage 1A establishes one governed Replay Field Twin chain:

```text
one tenant / project / group / field / season / zone
one formal lineage and frozen revision
B00 bootstrap root
T00–T23: exactly 24 successful hourly ticks
24 successful 72-point forecasts
24 three-option scenario sets
one replayed human decision / execution / outcome episode
24 forecast verification observations
24 forecast residuals
16 calibration cases
8 holdout cases
one calibration candidate
one shadow evaluation
zero model activation
restart and deterministic recovery
append-forward late-evidence correction
complete read model / Timeline / Trace / Operator readback
```

Allowed claim:

```text
STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE
```

Stage 1A does not establish Minimum Complete Field Twin completion.

### Stage 1B — Shadow-online closure

Stage 1B requires continuous online evidence ingress and scheduled execution of
the same canonical Runtime semantics, without affecting real-world action.

Allowed claim:

```text
SHADOW_ONLINE_CLOSURE_COMPLETE
```

### Stage 1C — Controlled-action feedback closure

Stage 1C requires a governed real sequence through human approval, execution
receipt and outcome evidence.

Only Stage 1C permits:

```text
MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE
```

## 2. Stage 1A semantic authority

The authoritative Replay closure contract is:

```text
successful_tick_count: 24
forecast_horizon_points_per_tick: 72
scenario_options:
  - NO_ACTION
  - IRRIGATE_NOW_15MM
  - IRRIGATE_NOW_25MM
late_evidence_policy:
  APPEND_FORWARD_CURRENT_STATE_CORRECTION_NO_HISTORICAL_REWRITE
final_formal_run_owner:
  MCFT-CAP-08.S6_ONLY
```

The following former requirements are reclassified and remain not established:

```text
720 continuous hourly ticks
→ LONG_HORIZON_REPLAY_STABILITY_QUALIFICATION

five irrigation scenarios
→ EXTENDED_IRRIGATION_SCENARIO_QUALIFICATION

historical late-evidence revision/reprocessing
→ HISTORICAL_REVISION_REPROCESSING_QUALIFICATION
```

## 3. Canonical history and late evidence

Canonical objects remain append-only and immutable.

For Stage 1A:

```text
late observation event at τ
first Runtime visibility at t
τ < t

historical State / Forecast / Scenario / Checkpoint rewrite:
forbidden

new historical revision:
not created

current State correction:
append-forward at t
```

This policy does not prohibit a future separately authorized historical
reprocessing capability. It only prevents that capability from being silently
claimed by MCFT-CAP-08.

## 4. Non-negotiable boundaries

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

## 5. Runtime family rule

Replay, Shadow-online, Controlled Field and Production runtimes must share:

```text
domain model
canonical object contracts
state-transition semantics
forecast and scenario engine
persistence semantics
trace and audit chain
```

They may vary only through governed adapters and operational controls:

```text
clock
evidence ingress
scheduler
execution
availability / recovery
```

## 6. Current repository frontier

At settlement subject `0012144aa3d69698b6bc94a113ff00c7652dd043`:

```text
MCFT-CAP-01 through MCFT-CAP-06:
COMPLETE

MCFT-CAP-07:
COMPLETE
closure_subject_sha: 81579b7f67a3dcd3cf557abbf29c9462d8b7736b
exact_sha_workflow_run: 29836198341
artifact_id: 8497395139

MCFT-CAP-08.S0:
EXTERNALLY_EFFECTIVE
merge_subject_sha: 0012144aa3d69698b6bc94a113ff00c7652dd043
exact_sha_workflow_run: 29935730353
artifact_id: 8536034800
semantic_artifact_digest:
sha256:7b97d1414fe9de946fba606b6ae0a674a17cb9ffbbd1ca253acf7e309798ac0a

effective_next_slice:
MCFT-CAP-08.S1

bounded_replay_runner_authorized:
true

bounded_canonical_transaction_authorized:
true

production_runtime_source_authorized:
false

MCFT-CAP-09:
NOT AUTHORIZED
```

## 7. MCFT-CAP-08 delivery order

```text
S1 Base Runtime and stable phase engine
S2 Replay Decision / Execution / Outcome
S3 Recovery and late evidence
S4 Residual / Calibration / Shadow
S5 Read Model and Operator integration
S6 two-fresh-database final closure
```

The stable Tick order is:

```text
resolve → E → H → A → B → G → C → barrier
```

Slice acceptance is not final closure evidence. Only S6 may execute the formal
two-run closure.

## 8. Current S1 boundary

S1 may implement:

```text
B00 bootstrap root
T00–T23 base range
State / Forecast / Scenario persistence
stable phase engine
empty G / H / C providers
fresh disposable PostgreSQL slice acceptance
S2 successor seed and Registry rule
```

S1 may not implement or claim:

```text
production Runtime source
public HTTP writer
background scheduler
live ingestion
Decision / Action Feedback episode
persisted late correction
Residual / Calibration / Shadow
Model Activation
final formal closure
MCFT-CAP-09 authority
```

## 9. Delivery discipline

```text
one active Slice
merge-before-next
exact candidate checks
protected merge
candidate tree = merge tree where required
external immutable evidence for effectiveness
no postmerge proof-carrier writeback
no CI source transport
no slice evidence promoted into final closure evidence
```

The current implementation map and capability matrix are:

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json
```
