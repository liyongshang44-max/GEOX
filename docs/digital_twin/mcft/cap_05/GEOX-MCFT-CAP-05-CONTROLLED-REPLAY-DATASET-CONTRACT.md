<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CONTROLLED-REPLAY-DATASET-CONTRACT.md -->
# GEOX MCFT-CAP-05 S1 Controlled Feedback Replay Dataset Contract

```text
delivery_slice_id: MCFT-CAP-05.MCFT-01-13-15.CONTROLLED-FEEDBACK-REPLAY-DATASET-V1
primary_owner_work_package_id: MCFT-01
contributing_owner_work_package_ids: MCFT-13, MCFT-15
status: IMPLEMENTATION_CANDIDATE
baseline_main_commit: 55b61b36a7d408ab68c2786499e14bab886d01e2
S0_merged_main_gate: 29306075015 SUCCESS
```

## Dataset authority

```text
dataset_id: mcft_cap05_feedback_replay_v1
dataset_truth_class: CONTROLLED_REPLAY_EVIDENCE
positive evidence records: 8
negative fixtures: 12
target receipt-consuming State tick: 2026-06-04T02:00:00.000Z
target outcome observation time: 2026-06-04T03:00:00.000Z
whole dataset semantic hash: sha256:5b99190321dab905c0a82c5e05381d51d1dd9058ba382a2757095df9f2396394
```

The dataset contains one controlled Human Decision request, one Approval Assertion Evidence record, one Approved Irrigation Plan Snapshot, one optional External Dispatch Evidence record, one irrigation Execution Receipt Evidence record, one exact 03:00 soil observation, one rainfall-context record and one historical-ET0 context record.

## Evidence identity and availability

Every record carries:

```text
dataset_id
source_record_id
source_record_hash
evidence_identity_key
idempotency_key
record_type
binding_id
origin_source_kind / origin_source_id
ingress_adapter_id / ingress_adapter_version
scope
role_time
available_to_runtime_at
quality
limitations
source_payload
canonical_payload
```

`source_record_hash` is calculated over canonical semantic content excluding only the hash itself and materialized file location. `available_to_runtime_at` is explicit Replay logical-time authority. S1 does not use wall clock, file mtime, process identity, network, branch name or database-generated identity.

## Standard cycle

```text
Scenario amount: 15.000000 mm
Approved amount: 14.000000 mm
Actual covered-footprint amount: 13.600000 mm
Spatial coverage fraction: 0.910000
Target-scope-equivalent irrigation: 12.376000 mm
Receipt available: 2026-06-04T01:55:00.000Z
Target State tick: 2026-06-04T02:00:00.000Z
Post-execution soil observation: 2026-06-04T03:00:00.000Z
```

The Approved Plan Snapshot references the Approval Assertion Evidence by exact source-record ref/hash. The receipt references the Approved Plan and optional External Dispatch Evidence. Amounts remain distinct and coverage is represented explicitly.

## Existing facts ingress proof

`ACCEPTANCE_MCFT_CAP_05_REPLAY_EVIDENCE_INGRESS_DB.ts` uses the existing append-only `facts` schema. It proves:

```text
first ingress: 8 INSERTED
same identity and same semantic hash: 8 EXISTING
same identity and different semantic hash: conflict and atomic no-append
exact identity/hash/availability readback: PASS
```

This acceptance helper adds no production ingress service or migration.

## Negative inventory

```text
late after logical-time cutoff
late after Evidence Window freeze
cross-hour execution
multiple event
conflicting duplicate
wrong scope
wrong binding
wrong unit
wrong status
missing approval assertion
plan/assertion mismatch
Evidence identity conflict
```

## Nonclaims

```text
NO_CANONICAL_DECISION_OBJECT
NO_CANONICAL_ACTION_FEEDBACK_OBJECT
NO_CANONICAL_FORECAST_RESIDUAL_OBJECT
NO_STATE_OR_CHECKPOINT_WRITE
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_GEOX_APPROVAL_AUTHORITY
NO_GEOX_DISPATCH
NO_AO_ACT_CHANGE
NO_RUNTIME_SOURCE_CHANGE_IN_S1
NO_MIGRATION
NO_ROUTE
NO_WEB
NO_CAP_06_AUTHORIZATION
```
