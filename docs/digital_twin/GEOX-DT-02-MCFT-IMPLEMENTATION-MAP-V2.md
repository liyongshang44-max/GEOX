# GEOX DT-02 Minimum Complete Field Twin Implementation Map V2.3

Status: current SSOT implementation map after MCFT-CAP-08 S5 Architecture Deviation adjudication  
Authority: Master V2.1 + Stage-1 Closure Authority V2 + current MCFT taskbooks + current exact-SHA effectiveness projection + CAP-08 S5 adjudication  
Current effective frontier: `MCFT-CAP-08.S4`  
Blocked slice: `MCFT-CAP-08.S5`  
First legal next action: `MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION`

This map converts the DT-02 architecture into an executable capability sequence. It does not replace the Master V2.1 architecture. It records which capability lines are effective, which successor action is authorized, and which claims remain prohibited.

## 1. Current settlement snapshot

```text
current_effective_capability_line_id = MCFT-CAP-08
current_effective_slice_id           = MCFT-CAP-08.S4
current_effective_status             = S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE
blocked_slice_id                     = MCFT-CAP-08.S5
architecture_deviation_adjudicated   = true
next_authorized_slice_id             = null
first_legal_next_action              = MCFT_CAP_08_S5_REPLAY_DATASET_V2_PREQUALIFICATION
s5_formal_candidate_authorized       = false
s6_implementation_authorized         = false
MCFT-CAP-08 complete                 = false
MCFT-CAP-09 authorized               = false
```

The CAP-08 S1 through S4 v1 exact-SHA artifacts remain valid historical effectiveness evidence. They do not establish the replay-dataset v2 predecessor required for a future S5 Candidate.

## 2. Capability-line map

| Capability line | Purpose | Current status | Current authority / next action |
|---|---|---|---|
| `MCFT-CAP-00` | Architecture freeze, reality/source/config/evidence authority | Effective predecessor | Retained; no reopening authorized |
| `MCFT-CAP-01` | Evidence-backed `StateEstimate`, confidence and use eligibility | Effective predecessor | Retained; no reopening authorized |
| `MCFT-CAP-02` | Deterministic `StateTransition` and replayable Dynamics | Effective predecessor | Retained; no reopening authorized |
| `MCFT-CAP-03` | Observation-aware assimilation | Effective predecessor | Retained; no reopening authorized |
| `MCFT-CAP-04` | Forecast and three-scenario comparison | Effective predecessor | Retained; no reopening authorized |
| `MCFT-CAP-05` | Human Decision, execution receipt and Action Feedback | Effective predecessor | Retained; no reopening authorized |
| `MCFT-CAP-06` | Calibration Candidate and Shadow Evaluation | Effective predecessor | Existing engines may be reused only through explicit CAP-08 adapters |
| `MCFT-CAP-07` | Read-only Runtime exposure and Operator workbench | Effective predecessor | Ten GET surfaces remain required in CAP-08 final closure |
| `MCFT-CAP-08.S1` | Base Runtime plus deterministic 24-Tick skeleton | Effective | Exact-SHA artifact retained |
| `MCFT-CAP-08.S2` | Forcing, Evidence, State and Forecast providers | Effective v1 historical predecessor | Must be requalified on replay-dataset v2 before S5 Candidate authority |
| `MCFT-CAP-08.S3` | Decision plus Action Feedback episode | Effective v1 historical predecessor | FVO-10 business-outcome identity must remain exact in v2 |
| `MCFT-CAP-08.S4` | Late Evidence append-forward | Current effective frontier | v1 effectiveness retained; v2 exact predecessor not yet established |
| `MCFT-CAP-08.S5` | 24 Residual, 16/8 Calibration/Holdout, Candidate and Shadow | Blocked by adjudicated Architecture Deviation | Direct implementation and Candidate authority suspended |
| `MCFT-CAP-08.S5-PQ` | Replay-dataset v2 predecessor prequalification | Authorized governance action, not a capability slice | Implement acceptance-only v2 dataset/provider, rerun S1–S4 and prove oracle without Candidate/Shadow writes |
| `MCFT-CAP-08.S6` | Two-run final closure, recovery and read-model proof | Seeded, not authorized | Requires effective S5 exact-SHA predecessor and exact-head independent approval |
| `MCFT-CAP-09` | Later controlled online/shadow expansion | Not authorized | Remains outside current frontier |

## 3. CAP-08 S5 Architecture Deviation

The original v1 replay dataset did not reproduce the frozen `0.034000` Candidate oracle:

```text
v1 selected parameter        = 0.040000
v1 disposition               = SEARCH_BOUNDARY_HIT_INCONCLUSIVE
v1 Candidate append allowed  = false
```

The confirmed root cause is:

```text
CAP-06 oracle source     = observations generated from hidden 0.034000 replay
CAP-08 v1 FVO source     = independent static linear sequence
FVO-10 semantic role     = frozen S3 business outcome
FVO-10 calibration role  = invalid as drainage-parameter objective evidence
```

The adjudicated v2 design preserves all 24 Residuals and the 16/8 membership while applying:

```text
multi-regime rainfall profile
Forecast-derived hidden-0.034 FVO values
FVO-10 value retained at 0.304500
FVO-10 retained as Residual/window member
FVO-10 objective_eligible = false
objective case count = 15
```

The exact development diagnostic produced:

```text
selected parameter           = 0.034000
status                       = BOUNDED_PARAMETER_DELTA_CANDIDATE
canonical append allowed     = true
sensitive case count         = 7
sensitive wetness regimes    = HIGH_EXCESS, MID_EXCESS
```

This result authorizes prequalification only. It does not establish an S5 Candidate or any effectiveness claim.

## 4. Authorized prequalification boundary

The next repository action may change only acceptance-dataset/provider, prequalification acceptance, immutable evidence workflow and required governance files.

Required proof:

```text
fresh database
24-Tick S1/S2 replay on dataset v2
S3 Decision/Action Feedback with exact FVO-10 outcome identity
S4 late append-forward
24 exact Residual roots
16 Calibration / 8 Holdout membership unchanged
15 objective-eligible Calibration cases
FVO-10 diagnostic-only objective role
21-point grid selects 0.034000
Candidate append count = 0
Shadow append count = 0
Model Activation count = 0
active Runtime Config switch count = 0
exact merge-SHA R1 artifact and readback
```

Forbidden during prequalification:

```text
Candidate Declaration
S5 Candidate or Shadow canonical writes
production Runtime source
route, web or scheduler changes
Model Activation
S6 authority
MCFT-CAP-09 authority
```

## 5. Completion semantics

`MCFT-CAP-08` is not complete. Completion still requires:

```text
v2 predecessor prequalification effective
S5 formal Candidate implemented and exact-SHA effective
S6 two independent fresh-database formal runs
24 hard-acceptance items
10 CAP-07 GET surfaces
semantic / operational / closure digest equality
candidate-to-merge tree equality
exact-head independent human approval
R2 retention artifact
```

Only after S6 exact-SHA effectiveness may the repository claim:

```text
MCFT_CAP_08_COMPLETE
```

## 6. Current authority chain

```text
GEOX-MCFT-SSOT-CURRENT-V1.json
  -> GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
  -> GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json
  -> GEOX-MCFT-CAP-08-TASK.md (v0.3.9 architecture)
  -> GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json
  -> GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-ADJUDICATION-V1.json
  -> GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-PREQUALIFICATION-CONTRACT-V1.json
  -> GEOX-MCFT-CAP-08-S5-ARCHITECTURE-DEVIATION-STATUS-V1.json
```
