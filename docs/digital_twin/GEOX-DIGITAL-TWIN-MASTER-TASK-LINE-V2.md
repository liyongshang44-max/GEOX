<!-- docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md -->
# GEOX Complete Agricultural Digital Twin Master Task Line V2

## 0. Authority

```text
repository: liyongshang44-max/GEOX
authority_version: V2.2
authority_status: CURRENT
frontier_reconciliation_base_main: 75fc9c509d455c12202ae6c5597f7185796ec3d6
primary_mainline: Minimum Complete Field Twin
ultimate_goal: Complete Agricultural Digital Twin
```

This is the current forward-looking Master authority. The historical
`GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md` remains immutable for legacy acceptance
and audit, but its former 30-day/720-tick, five-scenario and historical-revision
requirements no longer define Stage 1A successor closure.

Current authority chain:

```text
GEOX-MCFT-SSOT-CURRENT-V1.json
→ this Master V2
→ GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json
→ GEOX-MCFT-CAP-08-TASK.md v0.3.9 architecture
→ GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json
→ capability delivery status / Candidate Registry
→ exact merge-SHA immutable artifact
```

The taskbook remains the design authority. Its embedded repository-state
paragraphs are historical snapshots when they conflict with the dedicated
current-frontier projection.

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

### Stage 1C — Controlled-action feedback closure

Stage 1C requires a governed real sequence through human approval, execution
receipt and outcome evidence. Only Stage 1C permits:

```text
MINIMUM_COMPLETE_FIELD_TWIN_COMPLETE
```

## 2. Stage 1A semantic authority

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

Former requirements are reclassified and remain not established:

```text
720 continuous hourly ticks
→ LONG_HORIZON_REPLAY_STABILITY_QUALIFICATION

five irrigation scenarios
→ EXTENDED_IRRIGATION_SCENARIO_QUALIFICATION

historical late-evidence revision/reprocessing
→ HISTORICAL_REVISION_REPROCESSING_QUALIFICATION
```

Canonical objects remain append-only and immutable. For Stage 1A, late Evidence
may correct only the current State at first Runtime visibility; it must not
rewrite an old State, Forecast, Scenario or Checkpoint and does not create a new
historical revision.

## 3. Non-negotiable boundaries

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

## 4. Runtime family rule

Replay, Shadow-online, Controlled Field and Production runtimes must share:

```text
domain model
canonical object contracts
state-transition semantics
forecast and scenario engine
persistence semantics
trace and audit chain
```

They may vary only through governed clock, ingress, scheduler, execution,
availability and recovery adapters.

## 5. Current repository frontier

The current externally effective projection is:

```text
MCFT-CAP-01 through MCFT-CAP-06: COMPLETE
MCFT-CAP-07: COMPLETE

MCFT-CAP-08.S0: EFFECTIVE
MCFT-CAP-08.S1: S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE
MCFT-CAP-08.S2: S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE
MCFT-CAP-08.S3: S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE
MCFT-CAP-08.S4: S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE

S4 subject_sha: bda9d37519ca536d3d83d68cb3a2d4b395ff2ee9
S4 exact_sha_workflow_run: 30154846799
S4 artifact_id: 8618701918
S4 semantic_artifact_digest:
sha256:c3ba7d058898ed073dbc907a1a0d957903c312c955be45300cb6f62e49ea7338
S4 candidate_to_merge_tree_delta: 0
S4 immutable_readback_verified: true

current_effective_slice: MCFT-CAP-08.S4
next_authorized_slice: MCFT-CAP-08.S5
S5 status seed / Registry rule: PRESENT
S5 candidate implemented: false
S6 status seed / Registry rule: PRESENT
S6 implementation authorized: false

bounded_replay_runner_authorized: true
bounded_canonical_transaction_authorized: true
production_runtime_source_authorized: false
model_activation_authorized: false
MCFT-CAP-09: NOT AUTHORIZED
```

Repository candidate-state files are not rewritten after merge. External
slice effectiveness is projected only by exact merge-SHA immutable evidence.

## 6. MCFT-CAP-08 delivery order

This order is aligned with the current `GEOX-MCFT-CAP-08-TASK.md` v0.3.9:

```text
S1 Base Runtime + 24-Tick stable phase-engine skeleton
S2 Forcing / Evidence / State / Forecast provider completion
S3 Decision + Action Feedback
S4 Late Evidence append-forward correction
S5 Residual + Calibration + Shadow
S6 two-fresh-database final closure, recovery and CAP-07 readback
```

The stable Tick order is:

```text
resolve → E → H → A → B → G → C → barrier
```

Slice acceptance is not final closure evidence. Only S6 may execute the formal
two-run closure.

## 7. Current S5 boundary

S5 may implement only the frozen Residual / Calibration / Shadow provider set:

```text
24 Forecast Residual records
R-i = Forecast T(i-1) H=1 + FVO-i
ordered by forecast_target_time
R-01 committed at T16 but ordered first
16 Calibration cases
8 disjoint Holdout cases
one Calibration Candidate
one eight-case paired Shadow Evaluation
zero Model Activation
zero active Runtime Config switch
phase_engine_contract_digest unchanged
fresh disposable PostgreSQL Slice acceptance
```

Frozen calibration oracle:

```text
parameter: dynamics_parameters.drainage_coefficient_per_hour
base: 0.030000
expected candidate: 0.034000
grid points: 21
```

If the formal dataset no longer selects `0.034000`, implementation must stop for
Architecture Deviation Adjudication. Expected values must not be silently edited.

S5 may not implement or claim:

```text
final formal closure
fresh-process full recovery completion
extreme pointer rebuild
CAP-07 full-chain final readback
Model Activation
production Runtime source
public HTTP writer
background scheduler
live ingestion
MCFT-CAP-09 authority
```

The first legal next action is a formal S5 candidate constructed from exact
current `main`. The S5 PR must not modify its own Registry rule or create S6
authority; both successor governance prerequisites are already present on main.

## 8. Delivery discipline

```text
one active Slice
merge-before-next
exact candidate checks
protected merge
candidate tree = merge tree where required
external immutable evidence for effectiveness
no postmerge proof-carrier writeback
no CI source transport
no carrier PR for S5 source assembly
no slice evidence promoted into final closure evidence
```

Current navigation SSOT:

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json
```
