<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-CLOSURE.md -->
# MCFT-CAP-01 Remediated Closure

```text
capability_line_id: MCFT-CAP-01
display_alias: MCFT-1
name: First-Class Water State Estimate
runtime_mode: REPLAY
target_completion_level: Level A
historical_closure_main_commit: 250053aba801075c17098f8d505d527eb54390e9
historical_closure_status: SUPERSEDED_BY_REMEDIATION
remediation_implementation_candidate_head: 193f9785e42eb146e300e2a64abeed455f10e54e
remediation_pr: 2316
current_capability_status: COMPLETE
active_delivery_slice_id: null
successor: NOT_YET_AUTHORIZED
effectiveness_condition: PR_2316_MERGED_AND_VERIFIED_ON_MAIN
```

## 1. Closure result

The historical closure established one deterministic A0 bootstrap posterior but overstated the persisted handoff boundary. The remediation closes the identified gaps without adding propagation, successful Forecast, Scenario, Recommendation, Decision or AO-ACT.

The bounded capability now establishes:

```text
MCFT_CAP_01_COMPLETE
FIRST_CLASS_WATER_STATE_ESTIMATE_LEVEL_A_ESTABLISHED
CONTROLLED_REPLAY_BOOTSTRAP_CLOSURE_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
A0_CROSS_REFERENCE_GRAPH_VALIDATION_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
CROP_STAGE_CONFIGURATION_CONTEXT_ESTABLISHED
GOVERNANCE_STATUS_ALIGNMENT_ESTABLISHED
```

## 2. Persisted handoff proof

`PrepareNextTickInputServiceV1` reconstructs the next tick from a PostgreSQL `REPEATABLE READ READ ONLY` snapshot containing:

```text
active lineage object ref
active lineage semantic id
latest checkpoint
previous posterior State
Runtime Config
Reality Binding Runtime snapshot
```

It returns:

```text
previous_posterior_ref
previous_checkpoint_ref
lineage_id
prior_mean
prior_variance
next_logical_tick_time
runtime_config_ref/hash
reality_binding_ref/hash
```

The identity distinction is explicit:

```text
active_lineage_ref = twin_runtime_lineage_v1.object_id
lineage_id = semantic lineage identity
```

## 3. Evidence integrity proof

The soil selector uses:

```text
observed_at descending
ingested_at descending
source_record_id ascending
```

Same origin source and observation time with different canonical payload fails with `CONFLICTING_DUPLICATE_OBSERVATION` before Runtime Config, A0 facts, lease, idempotency guard or projection writes.

Evidence Window entries preserve ingestion, freshness, quality, units, conversion, limitations, disposition and model-consumption semantics. Soil is consumed by the bootstrap estimator; rainfall and historical ET0 are context-only.

## 4. Object graph proof

The A0 validator checks Lineage, Evidence Window, Transition, Assimilation, State, Forecast, Tick, Checkpoint, Health, Runtime Config refs/hashes and next-tick time independently of the aggregate hash. Fourteen rehashed cross-reference corruptions were rejected.

## 5. Manual runner proof

```text
apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts
```

Observed results:

```text
first execution: INSERTED
second execution: EXISTING_IDEMPOTENT_SUCCESS
a0_record_set_id: a0rs_b24d89a612198b8f234aab45
posterior_mean: 0.192595
posterior_variance: 0.002678
next_logical_tick_time: 2026-06-01T02:00:00.000Z
```

The runner is one-shot and operator-invokable. It is not a scheduler and does not establish continuous Runtime.

## 6. Dataset context proof

`configuration_context.json` and `manifest_v2.json` add a deterministic, time-resolved crop-stage schedule as `CONFIGURATION_DERIVED_CONTEXT`, not Evidence. The frozen MCFT-00 authority and original 3604 Evidence records remain byte-unchanged.

## 7. Acceptance evidence

```text
S1 Replay Dataset: 12 PASS, 0 FAIL
S4 A0 Runtime static: 21 PASS, 0 FAIL
S4 A0 Runtime PostgreSQL: 12 PASS, 0 FAIL
Remediation static: 18 PASS, 0 FAIL
Remediation PostgreSQL: 7 PASS, 0 FAIL
Governance readiness: 106 PASS, 0 FAIL
Server Typecheck: PASS
Server Build: PASS
git diff --check: PASS
working tree: CLEAN
CI #4491 / run 29038423099: SUCCESS
```

## 8. Preserved nonclaims

```text
NO_PROPAGATION
NO_SUCCESSFUL_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_DECISION
NO_AO_ACT
NO_CONTINUOUS_RUNTIME
NO_CONTINUOUS_SCHEDULER
NO_RESTART_BACKFILL_PROOF
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_GATE_A_CLOSURE
NO_MCFT_GATE_B_CLOSURE
NO_MCFT_GATE_C_CLOSURE
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

MCFT-CAP-01 completion does not authorize MCFT-2. MCFT-2 requires a separate post-merge task authorization.
