<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S2-CONTRACTS-PROJECTION-CONFIG.md -->
# GEOX MCFT-CAP-05 S2 Contracts, Projection Math and Runtime Config

```text
delivery_slice_id: MCFT-CAP-05.MCFT-02-06-11-13-15.CONTRACTS-PROJECTION-MATH-CONFIG-V1
status: IMPLEMENTATION_CANDIDATE
baseline_main_commit: 552d19505f0cd93584c899665b7d7b339f67e9fe
S1_merged_main_gate: 29306783482 SUCCESS
pure_validation_workflow: 29307407557 SUCCESS
```

## Frozen DT-02 reuse

```text
twin_decision_record_v1 -> G_HUMAN_DECISION_LINK_COMMIT
twin_action_feedback_v1 -> H_ACTION_FEEDBACK_COMMIT
twin_forecast_residual_v1 -> C_FORECAST_RESIDUAL_COMMIT
new canonical object type: none
new transaction family: none
```

All three objects use the frozen DT-02 `NON_LINEAGE_CONTEXT` envelope. `context_lineage_ref` and `context_revision_ref` are trace context only; no lineage ownership is claimed.

## Human Decision

```text
contract_id: MCFT_CAP_05_HUMAN_DECISION_V1
selected_option_reference_policy: GEOX_SCENARIO_OPTION_MEMBER_REF_BY_OPTION_ID_V1
second_write_policy: IMMUTABLE_CONFLICT_V1
logical_time: Scenario Set logical_time
as_of: decided_at
```

The selected option is resolved by exact `option_id` from the Scenario Set options array. It is a GEOX semantic member reference, not an RFC 6901 JSON Pointer. Identical replay returns existing semantics; a second different decision for the same Scenario Set conflicts.

## Action Feedback

```text
contract_id: MCFT_CAP_05_ACTION_FEEDBACK_V1
eligibility_policy: EXECUTED_OR_PARTIAL_VALIDATED_USABLE_EXACT_SCOPE_V1
quality_mapping: PASS/LIMITED -> USABLE; FAIL -> UNUSABLE
logical_time: execution_end
as_of: available_to_runtime_at
adapter: ACTION_FEEDBACK_TO_EXECUTED_IRRIGATION_CANDIDATE_V1
single_event_guard: EXACTLY_ONE_ELIGIBLE_EXECUTION_EVENT_PER_TICK_V1
```

The adapter supplies the existing `ExecutedIrrigationCandidateV1` fields: binding, origin source, exact scope, event ID, source record ID, execution/ingestion times, actual amount, coverage, eligibility, source quality and normalized execution status. `PARTIALLY_EXECUTED` may normalize to candidate `EXECUTED` only after eligibility validation, while the source status remains in the adapter trace.

## Forecast projection and residual

```text
projection_method: FORECAST_STORAGE_TO_ROOT_ZONE_MEAN_VWC_H1_V1
variance_method: STORAGE_VARIANCE_DIVIDED_BY_ROOT_ZONE_DEPTH_SQUARED_V1
residual_formula: actual_observation - projected_forecast
normalized_residual: residual / sqrt(predicted_variance + observation_variance + representativeness_variance)
observation_operator_h: 1.000000
direct_state_equivalence: false
```

The Forecast produces root-zone storage, not a 200 mm point prediction. Root-zone storage is projected to root-zone mean VWC. The existing 200 mm observation is used through H=1 with explicit representativeness variance. `Forecast Residual` remains distinct from `Assimilation Innovation`; the Residual may reference an Assimilation Update but owns no gain, posterior mean or State authority.

## Runtime Config chain

```text
config_purpose: HUMAN_DECISION_EXECUTION_FEEDBACK_RUNTIME_V1
chain_length: 8
first logical time: 2026-06-04T02:00:00.000Z
parent authority: exact predecessor State-bound CAP-04 Runtime Config ref/hash
selection_mode: PERSISTED_PREDECESSOR_CHAIN_ONLY_V1
```

Inherited CAP-04 water-model, Forecast and Scenario authority is validated under the CAP-04 contract before CAP-05 policies are added. No active-config pointer substitutes for the persisted predecessor chain.

## Feedback-cycle projection

The rebuildable projection contains explicit phases:

```text
Decision
Approval Assertion
Approved Plan
Dispatch disposition
Execution
Outcome Observation
Forecast Residual
Assimilation
Updated State
```

Dispatch disposition is one of `NOT_OBSERVED`, `NOT_APPLICABLE`, or `EXTERNALLY_RECORDED`. The projection is not canonical truth and makes no causal-effect or action-effectiveness claim.

## S2 nonclaims

```text
NO_PERSISTENCE
NO_MIGRATION
NO_CANONICAL_APPEND
NO_DECISION_FACT_WRITTEN
NO_ACTION_FEEDBACK_FACT_WRITTEN
NO_FORECAST_RESIDUAL_FACT_WRITTEN
NO_STATE_OR_CHECKPOINT_WRITE
NO_ROUTE
NO_WEB
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_AO_ACT_CHANGE
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_CAP_06_AUTHORIZATION
```
