<!-- docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-A0-RUNTIME-INTEGRATION.md -->
# MCFT-CAP-01 S4 A0 Runtime Integration

```text
delivery_slice_id: MCFT-CAP-01.MCFT-04-05-08-09.A0-RUNTIME-INTEGRATION-V1
historical_merge_commit: 4a0fd03beb05298028101a4999c67a5e053dadb8
remediation_implementation_candidate_head: 193f9785e42eb146e300e2a64abeed455f10e54e
current_status: COMPLETE
remediation_slice_id: MCFT-CAP-01.CLOSURE-REMEDIATION-V1
effectiveness_condition: PR_2316_MERGED_AND_VERIFIED_ON_MAIN
```

## Runtime result

```text
logical_time: 2026-06-01T01:00:00.000Z
window: (2026-06-01T00:00:00.000Z, 2026-06-01T01:00:00.000Z]
runtime_mode: REPLAY
selected soil observation: mcft_src_0f8bae003933b54d7d1141e0
canonical VWC fraction: 0.184000
posterior_mean: 0.192595
posterior_variance: 0.002678
posterior_stddev: 0.051746
next_tick_logical_time: 2026-06-01T02:00:00.000Z
```

The Runtime atomically commits exactly nine canonical members and six rebuildable projections. Forecast remains `BLOCKED`, has zero points and is not Scenario-eligible.

## Persisted next-tick handoff

The checkpoint pointer remains established, and remediation additionally establishes persisted handoff reconstruction.

```text
active_lineage_ref
  = twin_runtime_lineage_v1.object_id

lineage_id
  = semantic lineage identity
```

`PostgresNextTickRepositoryV1` resolves the active lineage canonical object in a `REPEATABLE READ READ ONLY` transaction, then reads latest checkpoint, previous posterior State, Runtime Config and Reality Binding snapshot. `PrepareNextTickInputServiceV1` validates the lineage/revision/config/binding chain and returns the next-tick DTO.

## Evidence semantics

```text
selector order:
observed_at descending
ingested_at descending
source_record_id ascending

soil:
CONSUMED_BY_BOOTSTRAP_ESTIMATOR

rainfall and historical ET0:
CONTEXT_ONLY_NOT_CONSUMED_BY_BOOTSTRAP_ESTIMATOR
```

Same origin and observation time with different canonical payload fails with `CONFLICTING_DUPLICATE_OBSERVATION` before Runtime Config, A0 facts, lease, idempotency guard or projection writes.

## Graph validity

The A0 validator checks all Lineage/Evidence/Transition/Assimilation/State/Forecast/Tick/Checkpoint/Health cross-references independently of member and aggregate hashes. Fourteen rehashed corruptions are rejected.

## Manual entry

```text
apps/server/scripts/mcft/MCFT_1_FIRST_CLASS_WATER_STATE_RUNNER.ts
```

Observed execution:

```text
first: INSERTED
second: EXISTING_IDEMPOTENT_SUCCESS
a0_record_set_id: a0rs_b24d89a612198b8f234aab45
```

## Acceptance

```text
S4 static: 21 PASS, 0 FAIL
S4 PostgreSQL: 12 PASS, 0 FAIL
Remediation static: 18 PASS, 0 FAIL
Remediation PostgreSQL: 7 PASS, 0 FAIL
CI #4491: SUCCESS
```

## Claims

```text
A0_RUNTIME_EXECUTION_ESTABLISHED
BOOTSTRAP_STATE_COMMITTED
ACTIVE_INITIAL_LINEAGE_ESTABLISHED
INITIAL_CHECKPOINT_ESTABLISHED
BLOCKED_FORECAST_RESULT_ESTABLISHED
NEXT_TICK_CHECKPOINT_POINTER_ESTABLISHED
PERSISTED_NEXT_TICK_HANDOFF_ESTABLISHED
CONFLICTING_DUPLICATE_OBSERVATION_REJECTION_ESTABLISHED
EVIDENCE_MODEL_CONSUMPTION_TRACE_ESTABLISHED
OPERATOR_INVOKABLE_MANUAL_RUNTIME_ENTRY_ESTABLISHED
```

## Preserved nonclaims

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
```
