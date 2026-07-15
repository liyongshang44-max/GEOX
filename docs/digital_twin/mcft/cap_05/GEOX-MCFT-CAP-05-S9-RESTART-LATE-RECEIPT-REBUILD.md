<!-- docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-RESTART-LATE-RECEIPT-REBUILD.md -->
# GEOX MCFT-CAP-05 S9 — Restart, Response-loss, Late Receipt and Projection Rebuild V1

## Delivery slice

```text
delivery_slice_id:
MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1

baseline_main_commit:
786e95db9b06bbe16daa456575d23d24bd194360

branch:
agent/mcft-cap-05-s9-restart-late-receipt-rebuild-v1
```

S9 is an internal controlled-Replay recovery slice. It does not create a new canonical object, transaction family, migration, route, scheduler, revision Runtime, calibration path or successor authority.

## Established recovery model

Canonical authority remains:

```text
public.facts
```

Support state remains rebuildable:

```text
twin_object_idempotency_index_v1
twin_decision_record_projection_v1
twin_action_feedback_projection_v1
twin_action_feedback_evidence_index_v1
twin_forecast_residual_projection_v1
twin_approved_plan_binding_projection_v1
twin_action_feedback_cycle_projection_v1
```

The service introduced by S9 is:

```text
Cap05RestartLateReceiptRebuildServiceV1
```

It provides three bounded operations:

```text
1. recoverUnknownCanonicalCommitOutcome
2. rebuildSupportStateFailClosed
3. late/same-hour receipt policy evaluation
```

## G/H/C unknown-outcome retry

A caller may lose the response after a G, H or C transaction has committed. Restart behavior is:

```text
lookup idempotency key
→ canonical readback
→ exact object_id/type/hash match
→ EXISTING_IDEMPOTENT_SUCCESS
```

If no prior commit is found, the existing canonical repository performs the normal append.

A same idempotency key with different object identity or determinism hash fails closed:

```text
CAP05_S9_UNKNOWN_OUTCOME_IDEMPOTENCY_CONFLICT
```

No duplicate canonical fact is permitted.

## Projection rebuild

Before rebuilding support state, S9 checks every persisted G/H/C fact against any surviving support row.

Existing support rows must match:

```text
canonical object ID
canonical determinism hash
canonical source fact ID
idempotency identity kind
idempotency record-set ID
action-feedback Evidence index members
```

Missing support rows are recoverable. Divergent rows are not overwritten.

Examples:

```text
CAP05_S9_DECISION_PROJECTION_DIVERGENCE
CAP05_S9_ACTION_FEEDBACK_PROJECTION_DIVERGENCE
CAP05_S9_FORECAST_RESIDUAL_PROJECTION_DIVERGENCE
CAP05_S9_IDEMPOTENCY_GUARD_DIVERGENCE
CAP05_S9_ACTION_FEEDBACK_EVIDENCE_INDEX_DIVERGENCE
```

A divergent row must be explicitly deleted or repaired before canonical rebuild can run.

Rebuild guarantees:

```text
canonical_fact_delta = 0
second_canonical_store = false
automatic_history_rewrite = false
```

## Same-hour and multi-event policy

For target tick `T`, an execution candidate must remain inside the exact interval `(T-1h, T]` and execution start/end must belong to the same UTC hour.

```text
identical event + identical semantic receipt
→ deterministic duplicate collapse

same event + different semantic receipt
→ CAP05_S9_CONFLICTING_DUPLICATE_EXECUTION_EVENT

multiple distinct events in one exact scope/hour
→ CAP05_S9_MULTIPLE_DISTINCT_EXECUTION_EVENTS

cross-hour execution
→ CAP05_S9_CROSS_HOUR_EXECUTION_REQUIRES_INTERVAL_SPLIT
```

S9 does not perform interval splitting.

## Late receipt policy

For target tick `T`:

```text
available_to_runtime_at > T
→ REVISION_REQUIRED_LATE_AFTER_CUTOFF

frozen Evidence Window excludes feedback
→ REVISION_REQUIRED_LATE_AFTER_CUTOFF

terminal tick T already committed
→ REVISION_REQUIRED_LATE_AFTER_COMMIT
```

All late outcomes freeze:

```text
eligible_for_state_input = false
logical_time_shifted = false
shifted_to_logical_time = null
automatic_history_rewrite = false
```

The receipt remains canonical context. S9 does not implement the separate late-Evidence revision Runtime.

## Inherited continuation safety

S9 does not rewrite the existing A transaction family. It reuses the already-established continuation safety contract:

```text
idempotency-before-lease
STALE_FENCING_TOKEN fail closed
STATE_LATEST_CAS_CONFLICT fail closed
CHECKPOINT_CAS_CONFLICT fail closed
FORECAST_RESULT_CAS_CONFLICT fail closed
projection divergence fail closed
postcommit response-loss replay
```

The S9 acceptance chain reruns the established CAP-03 PostgreSQL persistence/recovery suite to prove these invariants remain effective.

## Exact implementation boundary

```text
apps/server/src/runtime/twin_runtime/restart_late_receipt_rebuild_service_v1.ts
docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-RESTART-LATE-RECEIPT-REBUILD.md
docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json
scripts/dev/assert_local_pnpm_runtime.cjs
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts
```

## Preserved nonclaims

```text
NO_NEW_CANONICAL_OBJECT
NO_NEW_TRANSACTION_FAMILY
NO_MIGRATION
NO_PUBLIC_ROUTE
NO_WEB
NO_SCHEDULER
NO_INTERVAL_SPLIT_RUNTIME
NO_LATE_EVIDENCE_REVISION_RUNTIME
NO_AUTOMATIC_HISTORY_REWRITE
NO_RECOMMENDATION
NO_AO_ACT_CHANGE
NO_CAUSAL_EFFECT_ATTRIBUTION
NO_CALIBRATION_CANDIDATE
NO_MODEL_ACTIVATION
NO_S10_AUTHORIZATION
NO_CAP_06_AUTHORIZATION
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```
