<!-- docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md -->
# GEOX DT-02 to MCFT Implementation Map V2

## 0. Purpose

This is the compact current-frontier implementation map. Historical delivery
details remain in capability-specific records and the legacy implementation
map. This document does not rewrite historical capability evidence.

```text
map_version: V2.1
settlement_subject_main: 0012144aa3d69698b6bc94a113ff00c7652dd043
current_capability_line: MCFT-CAP-08
current_effective_slice: MCFT-CAP-08.S0
next_authorized_slice: MCFT-CAP-08.S1
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
| MCFT-CAP-08 | 24-Tick End-to-End Closure | IN_PROGRESS | S1 AUTHORIZED_NOT_STARTED |
| MCFT-CAP-09 | Shadow-Online Promotion | BLOCKED | independent successor authority required |
| MCFT-CAP-10 | Controlled-Action Feedback Closure | BLOCKED | requires CAP-09 completion |

## 2. Current authority references

```text
Stage 1A closure:
docs/digital_twin/mcft/GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json

CAP-08 taskbook:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md

CAP-08 resolved manifest:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESOLVED-MANIFEST-V1.json

CAP-08 conditional repository authority:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json

CAP-08 S1 successor seed:
docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json

Candidate Registry:
docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json
```

## 3. S0 external effectiveness

```text
candidate_head_sha: f5c04245ffd15301b6f188ff5ed05e87d725b9fc
candidate_tree_sha: 749e9aa1463a97a8fecd69b19525e450123be8be
merge_commit_sha: 0012144aa3d69698b6bc94a113ff00c7652dd043
merge_tree_sha: 749e9aa1463a97a8fecd69b19525e450123be8be
candidate_to_merge_tree_delta: 0
exact_sha_workflow_run: 29935730353
github_artifact_id: 8536034800
semantic_artifact_digest:
sha256:7b97d1414fe9de946fba606b6ae0a674a17cb9ffbbd1ca253acf7e309798ac0a
R2_readback_verified: true
locked_version_delete_denied: true
effective_status: IN_PROGRESS
effective_next_slice: S1
```

Repository status files intentionally remain conditional. The external
projection is the effective authorization; postmerge SSOT mutation is forbidden.

## 4. S1 implementation map

S1 must produce:

```text
Cap08TickPhasePlanV1
Cap08DueObligationSetV1
Cap08TickBarrierV1
stable resolve/E/H/A/B/G/C/barrier range engine
B00 bootstrap support
T00–T23 bounded base Replay range
24 State results using qualified predecessor providers
24 successful 72-point Forecasts using qualified predecessor providers
24 three-option Scenario Sets using qualified predecessor providers
phase_engine_contract_digest
phase_engine_source_digest
fresh-database SLICE_ACCEPTANCE_RUN
S2 false successor seed
S2 Registry candidate rule
```

S1 providers:

```text
E: base controlled Replay dataset adapter
H: empty
A: base State / Forecast Tick provider
B: base Scenario provider
G: empty
C: empty
```

S1 proves orchestration, bounded canonical A/B writes, handoff and cardinality.
It does not claim that S2's complete formal Forcing/Evidence/State/Forecast
provider qualification has already been established.

S1 nonclaims:

```text
FINAL_FORMAL_CLOSURE_NOT_EXECUTED
NO_FULL_S2_PROVIDER_QUALIFICATION
NO_REPLAY_DECISION_EPISODE
NO_ACTION_FEEDBACK
NO_LATE_APPEND_FORWARD_PERSISTENCE
NO_FORECAST_RESIDUAL
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_PRODUCTION_RUNTIME_SOURCE
NO_MCFT_CAP_09_AUTHORITY
```

## 5. Later Slice map

This order is aligned exactly with the current compact v0.3.8 taskbook:

```text
S2:
complete and qualify formal Forcing, Evidence, State and Forecast providers
against the frozen run contract and due-obligation map;
preserve the phase-engine contract digest

S3:
add G/H Decision and Action Feedback providers;
preserve the phase-engine contract digest

S4:
add Progress/Recovery and the late A append-forward update provider;
prove full posterior transport and preserve the phase-engine contract digest

S5:
add C Residual obligations and post-run D Calibration Candidate / Shadow;
prove zero Model Activation and preserve the phase-engine contract digest

S6:
execute two independent fresh PostgreSQL complete runs,
prove restart/failure/response-loss/concurrency,
read back through CAP-07 surfaces,
pass HA-01 through HA-24,
prove candidate-tree / merge-tree equivalence,
and publish immutable exact-SHA R2 closure
```

## 6. Owner work-package projection

Capability completion does not imply horizontal package completion.

```text
MCFT-00 through MCFT-18: PARTIALLY_ESTABLISHED

MCFT-16 closed-loop orchestration:
current implementation focus through CAP-08 S1–S6

MCFT-17 / MCFT-18:
read path established by CAP-07;
full formal-chain qualification remains CAP-08 S6 work
```
