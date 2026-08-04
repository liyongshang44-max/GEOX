<!-- docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md -->
# GEOX Complete Agricultural Digital Twin Master Task Line V2

## 0. Authority

```text
repository: liyongshang44-max/GEOX
authority_version: V2.3
authority_status: CURRENT
frontier_reconciliation_subject_main: 67bd71560268046a7fa9a9433ee074ad3999cb71
primary_mainline: Minimum Complete Field Twin
ultimate_goal: Complete Agricultural Digital Twin
```

This is the current forward-looking Master authority. The historical
`GEOX-DIGITAL-TWIN-MASTER-TASK-LINE.md` remains immutable for legacy acceptance
and audit, but its former 30-day/720-tick, five-scenario and historical-revision
requirements do not define Stage 1A closure.

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

The Taskbook remains the design authority. Its embedded repository-state
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

Allowed claim after the S6 exact-SHA/R2 authority is:

```text
STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE
MCFT_CAP_08_COMPLETE
```

Stage 1A does not establish Minimum Complete Field Twin completion.

### Stage 1B — Shadow-online closure

Stage 1B requires continuous online evidence ingress and scheduled execution of
the same canonical Runtime semantics, without affecting real-world action.
MCFT-CAP-09 is the intended successor line, but it remains separately governed
and is not authorized by CAP-08 completion alone.

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

Former requirements remain separate qualifications and are not established:

```text
720 continuous hourly ticks
→ LONG_HORIZON_REPLAY_STABILITY_QUALIFICATION

five irrigation scenarios
→ EXTENDED_IRRIGATION_SCENARIO_QUALIFICATION

historical late-evidence revision/reprocessing
→ HISTORICAL_REVISION_REPROCESSING_QUALIFICATION
```

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
MCFT-CAP-01 through MCFT-CAP-07: COMPLETE
MCFT-CAP-08.S0 through S5: EFFECTIVE PREDECESSORS
MCFT-CAP-08.S6: MCFT_CAP_08_COMPLETE
completion level: STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE

S6 subject SHA: 67bd71560268046a7fa9a9433ee074ad3999cb71
Candidate head: 759093c2eca243121a129d76cdbae817e3e5df9c
Candidate / merge tree: 1fe10ff2351f0f96fc4164e268e02df23c591c69
Candidate-to-merge tree delta: 0
Exact-SHA workflow run: 30908130962
Exact-SHA artifact: 8891897316
Semantic artifact digest: sha256:7e9d713631443641f17c06f71c494319c5f442424ba9ec9f426731940d2700f9
Hard Acceptance: 24 / 24 effective
R2 retention: 730 days
Retain until: 2028-08-03T12:13:37.980Z
R2 readback: PASS
Locked-version delete denial: PASS

current_effective_slice: MCFT-CAP-08.S6
next_authorized_slice: NONE
blocked_successor: MCFT-CAP-09
first_legal_next_action: MCFT_CAP_09_SUCCESSOR_DESIGN_AND_PRE_CANDIDATE_GOVERNANCE_REVIEW

production_runtime_source_authorized: false
live_ingestion_authorized: false
background_scheduler_authorized: false
model_activation_authorized: false
MCFT-CAP-09: NOT AUTHORIZED
```

Repository candidate-state files are not rewritten after merge. External
slice and capability effectiveness are projected only by exact merge-SHA
immutable evidence.

## 6. MCFT-CAP-08 closure result

```text
Formal RUN_A: terminal success / settled
Formal RUN_B: terminal success / settled
independent fresh PostgreSQL instances: 2
cross-run comparator: PASS
semantic difference count: 0
per-run real witness producers: 22 / 22
Hard Acceptance effective resolution: 24 / 24
product observation write delta: 0
canonical fact write delta: 0
projection write delta: 0
```

The stable Tick order remains:

```text
resolve → E → H → A → B → G → C → barrier
```

## 7. Post-CAP-08 successor boundary

CAP-08 completion authorizes the completion claim only. It does not create the
CAP-09 taskbook, status seed, Registry rule, Candidate Declaration or Runtime
authority.

The next legal work is:

```text
review and freeze MCFT-CAP-09 Stage 1B scope
author a separate CAP-09 Taskbook / machine contract
create non-candidate successor authority and status seed
register the future candidate transition on trusted main
prove predecessor consumption of CAP-08 exact-SHA/R2 authority
keep Runtime source delta = 0 until that governance foundation is effective
```

Forbidden before separate CAP-09 authority:

```text
shadow-online runtime source
live sensor ingestion
background scheduler
production write authority
automatic recommendation / approval / dispatch
Model Activation
CAP-09 Candidate Declaration
```

## 8. Delivery discipline

```text
one active capability line
merge-before-next
exact candidate checks
protected merge
candidate tree = merge tree where required
external immutable evidence for effectiveness
no postmerge proof-carrier writeback
no CI source transport
no authority inference across capability lines
```

Current navigation SSOT:

```text
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json
docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json
docs/handoff/GEOX-MCFT-CAP-08-S6-HANDOFF.md
```
