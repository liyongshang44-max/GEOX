<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md -->
# GEOX DT-02 to MCFT Implementation Map V2

## 0. Purpose

This is the compact current-frontier implementation map. Historical delivery
details remain in capability-specific records and the legacy implementation
map. This document does not rewrite historical capability evidence.

```text
map_version: V2.2
frontier_reconciliation_base_main: 75fc9c509d455c12202ae6c5597f7185796ec3d6
current_capability_line: MCFT-CAP-08
current_effective_slice: MCFT-CAP-08.S4
next_authorized_slice: MCFT-CAP-08.S5
```

## 1. Capability frontier

| Capability | Name | Current status | Active / next boundary |
|---|---|---|---|
| MCFT-CAP-01 | First-Class Water State Estimate | COMPLETE | none |
| MCFT-CAP-02 | Hourly Dynamics and Persistence | COMPLETE | none |
| MCFT-CAP-03 | Observation Assimilation and State Innovation | COMPLETE | none |
| MCFT-CAP-04 | 72-Hour Forecast and Three Scenarios | COMPLETE | none |
| MCFT-CAP-05 | Human Decision and Execution-Receipt Feedback | COMPLETE | none |
| MCFT-CAP-06 | Calibration Candidate and Shadow Evaluation | COMPLETE | none |
| MCFT-CAP-07 | Minimal Field Twin Read Model and Timeline | COMPLETE | none |
| MCFT-CAP-08 | 24-Tick End-to-End Closure | IN_PROGRESS | S4 EFFECTIVE / S5 AUTHORIZED_NOT_IMPLEMENTED |
| MCFT-CAP-09 | Shadow-Online Promotion | BLOCKED | independent successor authority required |
| MCFT-CAP-10 | Controlled-Action Feedback Closure | BLOCKED | requires CAP-09 completion |

## 2. Current authority references

```text
Stage 1A closure:
docs/digital_twin/mcft/GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json

CAP-08 taskbook architecture (v0.3.9):
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md

CAP-08 current delivery frontier:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json

CAP-08 resolved manifest:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESOLVED-MANIFEST-V1.json

CAP-08 conditional repository authority:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json

CAP-08 S5 successor seed:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json

CAP-08 S6 final-closure seed:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json

Candidate Registry:
docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
```

The v0.3.9 taskbook remains current for architecture and Slice contracts. Its
embedded frontier statements are historical when contradicted by the dedicated
current frontier projection.

## 3. Effective Slice history

```text
S0 Authority Reconciliation:
status: EFFECTIVE
subject: 0012144aa3d69698b6bc94a113ff00c7652dd043
workflow: 29935730353
artifact: 8536034800
semantic digest:
sha256:7b97d1414fe9de946fba606b6ae0a674a17cb9ffbbd1ca253acf7e309798ac0a

S1 Base Runtime:
status: S1_BASE_RUNTIME_IMPLEMENTED_EFFECTIVE
subject: f39b7df37571156f23cfb9153bad024fdb723261
workflow: 29980589779
artifact: 8553043184
semantic digest:
sha256:7f8e6d61f038ddfd6a6b86430c230fc7e36509011d4131bae1670034ff2b74bc

S2 Forcing / Evidence / State / Forecast:
status: S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE
subject: 1f37d6247a5f2e90327720c9feed4faf729d1db3
workflow: 30034240206
artifact: 8574593152
semantic digest:
sha256:8bb99559bcdbda63de5ff196bb9d7040269d07acf7b80374341a620beae60da7

S3 Decision + Action Feedback:
status: S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE
subject: bcffb63003667ebc5f60ef4aa83c8243f99c5917
workflow: 30142920081
artifact: 8615076849
semantic digest:
sha256:bbfcd8553550dc5c33f36f6f2646a3fe56803318f8f9b9d8c15f03ec751af691

S4 Late Evidence append-forward:
status: S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE
subject: bda9d37519ca536d3d83d68cb3a2d4b395ff2ee9
candidate: a8c8abccbe2ab25dad5f0fa4a9653269f6c4acc4
candidate tree: 4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a
merge tree: 4c14fc80a291e6f4fd8cb61a13a8ba2926aa0e1a
tree delta: 0
workflow: 30154846799
artifact: 8618701918
semantic digest:
sha256:c3ba7d058898ed073dbc907a1a0d957903c312c955be45300cb6f62e49ea7338
R1 immutable readback: PASS
```

Repository status files intentionally retain their candidate-state records.
External effectiveness comes from exact-SHA immutable evidence; postmerge status
mutation is forbidden.

## 4. Current S5 implementation map

S5 must produce:

```text
C provider for R-01 through R-24
exact Forecast/FVO predecessor binding
ordered Residual set by forecast_target_time
16-case Calibration window
8-case disjoint Holdout window
one Calibration Candidate
one eight-case paired Shadow Evaluation
zero Model Activation
zero active Runtime Config switch
phase_engine_contract_digest unchanged
fresh-database SLICE_ACCEPTANCE_RUN
final_formal_run_id = null
slice_acceptance_only = true
```

Frozen oracle:

```text
parameter: dynamics_parameters.drainage_coefficient_per_hour
base: 0.030000
expected candidate: 0.034000
grid points: 21
```

S5 entry authority:

```text
S4 exact-SHA R1 effectiveness: PASS
S5 status seed on trusted main: PRESENT
S5 candidate Registry rule on trusted main: PRESENT
S5 implementation authorized: true
S5 candidate implemented: false
S5 effective: false
S6 status seed on trusted main: PRESENT
S6 candidate Registry rule on trusted main: PRESENT
S6 implementation authorized: false
```

S5 nonclaims:

```text
FINAL_FORMAL_CLOSURE_NOT_EXECUTED
NO_FULL_RECOVERY_CLOSURE
NO_EXTREME_POINTER_REBUILD
NO_CAP07_FINAL_READBACK_CLAIM
NO_MODEL_ACTIVATION
NO_ACTIVE_CONFIG_SWITCH
NO_PRODUCTION_RUNTIME_SOURCE
NO_PUBLIC_HTTP_WRITER
NO_BACKGROUND_SCHEDULER
NO_LIVE_INGESTION
NO_MCFT_CAP_09_AUTHORITY
```

## 5. S6 remaining map

S6 alone may:

```text
execute two independent fresh PostgreSQL complete runs
use one deterministic formal_run_id and distinct run_instance_id values
run B00 → T00-T23 → G00-G02 with all providers enabled from start
prove restart/failure/response-loss/concurrency
prove extreme pointer loss and deterministic rebuild
read back through all ten CAP-07 GET surfaces
prove Timeline/Trace/pagination and Operator zero-write behavior
pass HA-01 through HA-24
prove semantic, operational-invariant and closure digest equality
prove candidate-tree / merge-tree equivalence
publish immutable exact-SHA R2 closure evidence
```

S6 requires an exact-head `APPROVED` review from a verified human GitHub account
different from the candidate author. S6 does not create or authorize MCFT-CAP-09.

## 6. Owner work-package projection

Capability completion does not imply horizontal package completion.

```text
MCFT-00 through MCFT-18: PARTIALLY_ESTABLISHED

MCFT-16 closed-loop orchestration:
current implementation focus = CAP-08 S5 then S6

MCFT-17 / MCFT-18:
read path established by CAP-07;
full formal-chain qualification remains CAP-08 S6 work
```
