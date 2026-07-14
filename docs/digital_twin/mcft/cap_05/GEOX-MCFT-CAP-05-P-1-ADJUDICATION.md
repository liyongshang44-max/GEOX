<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-P-1-ADJUDICATION.md -->

# GEOX MCFT-CAP-05 P-1 — DT-02 Object / Transaction Adjudication

## 0. Adjudication identity

```text
capability_line_id:
MCFT-CAP-05

delivery_slice_id:
MCFT-CAP-05.P-1.DT02-OBJECT-TRANSACTION-ADJUDICATION-V1

slice_kind:
ARCHITECTURE_GOVERNANCE_ONLY

baseline_main_commit:
3eba797307388bd652dc5c65e91d634375e1b8c2

adjudication_result:
REUSE_WITHOUT_AMENDMENT

DT-02 architecture amendment required:
false

runtime_source_authorized:
false

migration_authorized:
false

canonical_write_authorized:
false

P0_authorized_before merge and merged-main Gate:
false
```

This adjudication is complete as a repository candidate. It becomes effective only after the P-1 PR merges and the merged-main P-1 Gate passes.

## 1. Authorities inspected

```text
docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json
docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json
docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md
docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json

docs/digital_twin/mcft/cap_03/**
docs/digital_twin/mcft/cap_04/**

apps/server/src/domain/soil_water/executed_irrigation_input_v1.ts
apps/server/src/domain/soil_water/root_zone_observation_operator_v1.ts
apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v1.ts
apps/server/src/domain/twin_runtime/assimilated_continuation_contracts_v2.ts
apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts
```

## 2. Repository facts

The inspected DT-02 object set freezes:

```text
twin_decision_record_v1
NON_LINEAGE_CONTEXT
G_HUMAN_DECISION_LINK_COMMIT
required refs: scenario_set_ref, selected_option_ref

twin_action_feedback_v1
NON_LINEAGE_CONTEXT
H_ACTION_FEEDBACK_COMMIT
execution_status / validation_status / eligible_for_state_input
trusted source: receipt_ref or as_executed_ref

twin_forecast_residual_v1
NON_LINEAGE_CONTEXT
C_FORECAST_RESIDUAL_COMMIT
required refs: forecast_run_ref, forecast_point_ref, observation_ref, runtime_config_ref
```

The inspected transaction matrix freezes exactly eight transaction families and already provides C, G and H atomic boundaries. No ninth transaction family is necessary.

CAP-02 already provides the deterministic `ExecutedIrrigationCandidateV1` and coverage-weighted irrigation aggregation. CAP-03 already provides the H=1 root-zone observation operator and current-tick Assimilation innovation. CAP-04 already provides 72-point Forecasts and the three fixed Scenario options.

## 3. Sixteen adjudications

### 3.1 Human Decision object

```text
result:
REUSE twin_decision_record_v1

transaction:
REUSE G_HUMAN_DECISION_LINK_COMMIT

amendment:
NOT REQUIRED
```

The existing object and G transaction express authenticated human Scenario-option linkage without inferring Approval, Plan or Task.

### 3.2 DEFER

```text
CAP-05 v1 disposition:
SELECT_SCENARIO_OPTION only

DEFER canonical Decision:
NOT ESTABLISHED
```

No Decision object is written when no human selection exists. First-class DEFER remains future architecture work and is not needed for CAP-05 v1.

### 3.3 Selected option reference

```text
policy:
GEOX_SCENARIO_OPTION_SEMANTIC_MEMBER_REF_V1

format:
<scenario_set_object_id>#/options/<option_id>

classification:
semantic member reference, not RFC 6901 JSON Pointer
```

Resolution reads the canonical Scenario Set, finds exactly one array member whose `option_id` matches, and recomputes its semantic hash.

### 3.4 Decision second write

```text
same decision cycle + same request key/hash:
existing idempotent success

same decision cycle + different semantic hash:
DECISION_CYCLE_CONFLICT

Decision supersession in CAP-05 v1:
not supported
```

No DT-02 amendment is needed because CAP-05 v1 freezes immutability rather than adding a new lifecycle.

### 3.5 Approval and Plan Evidence

```text
approval_assertion_evidence_v1:
Replay Evidence

approved_irrigation_plan_snapshot_v1:
Replay Evidence

new canonical Twin object:
none
```

The Plan Snapshot references the Approval Assertion ref/hash. This preserves approval authority separately from plan content without expanding DT-02.

### 3.6 Replay Evidence ingress

```text
authority:
existing append-only Replay Evidence ingress

required identity:
source namespace + source record identity + semantic hash

same identity / same hash:
idempotent success

same identity / different hash:
EVIDENCE_IDEMPOTENCY_CONFLICT
```

Projection rows cannot act as Evidence authority.

### 3.7 Execution Receipt normalization

```text
result:
REUSE twin_action_feedback_v1

transaction:
REUSE H_ACTION_FEEDBACK_COMMIT

amendment:
NOT REQUIRED
```

The existing object supports external replay origin, nullable task ref, trusted receipt/as-executed refs, execution/validation orthogonality and explicit state-input eligibility.

### 3.8 Status and quality mapping

```text
FULL -> EXECUTED
PARTIAL -> PARTIALLY_EXECUTED
UNKNOWN -> EXECUTION_UNCERTAIN
NONE -> NOT_EXECUTED

standard validation_status:
NOT_YET_VALIDATED

source quality:
PASS | LIMITED | FAIL
```

`NOT_YET_VALIDATED` may remain eligible when execution Evidence is trustworthy. `EXECUTION_UNCERTAIN`, `NOT_EXECUTED` and source-quality FAIL are ineligible.

### 3.9 Action Feedback adapter

```text
adapter:
ActionFeedbackToExecutedIrrigationCandidateAdapterV1

output:
existing ExecutedIrrigationCandidateV1
```

The adapter must map binding, exact scope, event identity, source record, execution time, availability time, amount, coverage, eligibility and quality. It does not apply coverage weighting. PASS/LIMITED map to USABLE; FAIL maps to UNUSABLE. A consumable PARTIALLY_EXECUTED source event maps to the existing candidate status EXECUTED while retaining source status in adapter trace.

### 3.10 Forecast Residual object

```text
result:
REUSE twin_forecast_residual_v1

transaction:
REUSE C_FORECAST_RESIDUAL_COMMIT

amendment:
NOT REQUIRED
```

The existing required refs and C transaction can carry a matched Forecast error plus projection and matching trace.

### 3.11 Forecast Residual versus Assimilation Innovation

```text
Forecast Residual:
actual observation - historical Forecast-point projection

Assimilation Innovation:
actual observation - current-tick propagated-prior prediction

identity claim:
forbidden by default
```

They share the selected observation but remain separate quantities. Numeric equality is allowed only through a non-canonical equivalence evaluation proving the same posterior, forcing, model/config, geometry, operator and rounding.

### 3.12 Outcome feedback trace

```text
artifact:
action_feedback_cycle_projection_v1

classification:
rebuildable non-canonical projection

new canonical Outcome Window:
not required
```

The projection links Decision, Approval Assertion, Plan Snapshot, Dispatch disposition, Action Feedback, receipt-consuming State, later observation, Forecast Residual, Assimilation and updated outputs.

### 3.13 Transaction families

```text
new CAP-05 canonical writes:
G, H, C

continued Runtime writes:
A, B, D

new transaction family:
none
```

No C/G/H atomic boundary change is required.

### 3.14 NON_LINEAGE_CONTEXT profile

```text
Decision logical_time:
source Scenario Set logical_time

Decision as_of:
decided_at

Action Feedback logical_time:
execution_end

Action Feedback as_of:
available_to_runtime_at

Forecast Residual logical_time:
Forecast point target_time

Forecast Residual as_of:
observation available_to_runtime_at
```

All three require context lineage/revision refs under the CAP-05 profile and do not require lineage_id/revision_id.

### 3.15 Forecast observation projection

```text
method:
FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1

predicted VWC:
storage_mean_mm / root_zone_depth_mm

Forecast VWC variance:
storage_variance_mm2 / root_zone_depth_mm^2

normalized residual variance:
Forecast VWC variance + observation variance
```

This aligns with the existing H=1 root-zone observation operator. It does not claim a 200 mm point Forecast profile.

### 3.16 Quantity and cutoff semantics

```text
actual_amount_mm:
average delivered depth over covered footprint

coverage:
covered target area / total target area

target-scope-equivalent irrigation:
actual_amount_mm * coverage

Evidence cutoff:
available_to_runtime_at <= target logical_time
and included in frozen Evidence Window
```

Coverage is applied exactly once by the existing irrigation aggregator. Evidence arriving after cutoff is not shifted to a later tick.

## 4. Final adjudication

```text
Decision object reuse:
PASS

Action Feedback object reuse:
PASS

Forecast Residual object reuse:
PASS

Approved Plan remains Evidence:
PASS

Outcome trace remains projection:
PASS

DEFER excluded from CAP-05 v1:
PASS

C/G/H reuse without boundary change:
PASS

new canonical object required:
false

new transaction family required:
false

DT-02 Architecture Amendment 03 required:
false

P-1 result:
REUSE_WITHOUT_AMENDMENT
```

## 5. Preserved boundaries

```text
NO_RUNTIME_SOURCE_CHANGE
NO_MIGRATION
NO_CANONICAL_FACT_WRITE
NO_ROUTE
NO_WEB
NO_AO_ACT_CHANGE
NO_CAP_04_SOURCE_CHANGE
NO_P0_ACTIVATION_BEFORE_P1_MERGED_MAIN_GATE
NO_CAP_06_AUTHORIZATION
```

## 6. Next step

After this P-1 candidate is merged and the merged-main P-1 Gate passes, the next permitted slice is:

```text
MCFT-CAP-05.P0.CAP-04-SETTLEMENT-AND-CAP-05-PROVISIONAL-SSOT-V1
```

P0 must reconcile all stale CAP-04 current lifecycle fields while preserving historical delivery evidence.
