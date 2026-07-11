<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-PERSISTENCE-RECOVERY.md -->
# GEOX MCFT-CAP-03 S3B — Assimilated A2 Persistence and Recovery V1

## 1. Delivery slice

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1

baseline_main_commit:
293fbeff04441f12aee13945c2db24b4b9bb23b5

branch:
mcft-cap-03-assimilated-a2-persistence-recovery-v1
```

S3B reuses the already-established `A_STATE_TICK_COMMIT` / `A2_RECORD_SET` PostgreSQL transaction family for the independent CAP-03 record-set contract:

```text
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

It does not create a new transaction family, a ninth canonical object, a revision lineage, or a successful Forecast.

## 2. Authorized scope

S3B is limited to:

```text
existing A2 transaction reuse
idempotency-before-lease
lease and fencing validation
State / checkpoint / Forecast-result CAS
atomic eight-fact commit
versioned canonical readback
five-projection rebuild
precommit fault injection
postcommit response-loss replay
projection divergence fail-closed
historical CAP-02 readback compatibility
zero-migration proof
```

S3B does not orchestrate a Runtime tick. Candidate construction remains the S3A pure builder authority. Single-tick orchestration belongs to S4.

## 3. Versioned persistence dispatch

The persistence layer must preserve two public contracts:

```text
ContinuationPersistencePortV1
→ historical MCFT-CAP-02 ContinuationRecordSetV1

AssimilatedContinuationPersistencePortV1
→ MCFT-CAP-03 AssimilatedContinuationRecordSetV1
```

Both ports reuse the same internal PostgreSQL A2 transaction implementation. Historical CAP-02 callers retain their existing method names and return types.

Canonical readback dispatch is determined from persisted identity basis plus the pinned Runtime Config:

```text
CAP-02 config purpose
+ no CAP-03 discriminator
→ validateContinuationRecordSetV1

CAP-03 config purpose
+ MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1 discriminator
→ validateAssimilatedContinuationCrossReferencesV1

unknown or mismatched discriminator
→ fail closed
```

No payload-shape guessing, insertion-order inference, latest-config selection, or implicit active-config pointer is permitted.

## 4. Existing A2 transaction reuse

The canonical transaction order remains:

```text
BEGIN

1. A2 idempotency lookup FOR UPDATE
2. existing same-key/same-hash canonical readback
3. lease owner / fencing / expiry verification
4. active lineage and predecessor authority verification
5. State / checkpoint / Forecast-result expected-current CAS verification
6. canonical continuation uniqueness verification
7. append eight canonical facts
8. derive and write five projections
9. append A2 idempotency guard
10. COMMIT
11. canonical record-set readback and hash verification
```

The first idempotency lookup occurs before lease validation. Therefore a retry after response loss may return:

```text
EXISTING_IDEMPOTENT_SUCCESS
```

even when the supplied lease token is now stale, provided the same key resolves to the same record-set ID and determinism hash.

A same key with a different hash must return:

```text
IDEMPOTENCY_CONFLICT
```

before lease validation.

## 5. Atomic canonical write

A CAP-03 A2 commit appends exactly eight canonical facts:

```text
twin_evidence_window_v1
twin_state_transition_v1
twin_assimilation_update_v1
twin_state_estimate_v1
twin_forecast_run_v1
twin_runtime_tick_v1
twin_runtime_checkpoint_v1
twin_runtime_health_v1
```

All eight facts, five projections, and the A2 idempotency guard are committed in one database transaction.

Any injected failure at any precommit stage must roll back:

```text
all eight facts
all five projection mutations
the A2 idempotency guard
```

## 6. Expected-current authority

The transaction must verify the persisted predecessor authority before writing:

```text
active_lineage_ref
lineage_id
revision_id
previous_state_ref
previous_checkpoint_ref
previous_forecast_result_ref
latest_successful_forecast_ref = null
```

It must also verify the candidate aggregate references the same predecessor hashes and pinned Runtime Config.

CAP-03 first-tick predecessor facts are historical CAP-02 canonical objects. The CAP-03 path therefore reads those predecessor objects as canonical immutable facts and verifies their object types, hashes, refs, lineage, revision, and expected-current projection pointers. Historical CAP-02 commit behavior remains unchanged.

## 7. Canonical uniqueness

The canonical uniqueness key remains:

```text
scope
+ lineage_id
+ revision_id
+ logical_time
+ operation_variant
```

The operation key does not include:

```text
Evidence digest
Runtime Config identity
record-set contract version
```

The aggregate determinism hash does include those authorities through the versioned aggregate identity input.

Loss of the A2 idempotency row or any projection must not allow a second terminal tick for the same canonical uniqueness key.

## 8. Canonical readback

Persisted `identity_basis` must contain enough information to reconstruct the complete record set:

```text
continuation_operation_key
continuation_operation_key_hash
aggregate_identity_input
record_set_contract_id for CAP-03
member_object_ids
member determinism hashes
```

CAP-03 readback must return the independent `AssimilatedContinuationRecordSetV1` including its top-level discriminator. CAP-02 rows written before S3B remain readable because the missing CAP-03 discriminator deterministically selects the historical V1 contract when paired with the CAP-02 Runtime Config purpose.

## 9. Five-projection rebuild

Canonical facts are authoritative. Rebuild derives exactly five continuation projections:

```text
state history
state latest
Forecast-result latest
checkpoint latest
Runtime health latest
```

Rebuild must not mutate:

```text
active lineage
successful Forecast latest
canonical facts
A2 idempotency identity
```

A projection row with the same canonical identity but a different determinism hash is divergence and must fail closed. Explicit deletion or repair of the divergent projection is required before rebuild can succeed.

## 10. Zero migration proof

S3B introduces no SQL migration.

The existing schema already provides:

```text
A2_RECORD_SET identity kind
JSONB identity_basis
JSONB member_object_ids
JSONB member_determinism_hashes
facts JSONB canonical storage
five continuation projection tables
lease/fencing table
```

The CAP-03 discriminator is stored inside existing JSONB identity basis. No table, column, constraint, index, trigger, or enum change is required.

## 11. Fault model

The isolated PostgreSQL acceptance must cover all precommit injection points:

```text
before_fact_1 through before_fact_8
before_state_history_projection
before_state_latest_projection
before_forecast_result_projection
before_checkpoint_projection
before_health_projection
before_idempotency_index
before_commit
```

It must additionally prove:

```text
stale fencing → zero write
foreign owner → zero write
expired lease → zero write
State CAS conflict → zero write
checkpoint CAS conflict → zero write
Forecast-result CAS conflict → zero write
same key / same hash → existing success before lease
same key / different hash → conflict before lease
postcommit response loss retry → no duplicate facts
projection loss → five-projection rebuild
projection divergence → fail closed
idempotency guard loss → canonical uniqueness conflict
historical CAP-02 readback → unchanged
```

## 12. Preserved boundaries

S3B preserves:

```text
NO_MAINLINE_CAP_03_A2_TICK_COMMITTED
NO_SINGLE_TICK_INTEGRATION
NO_RANGE_EXECUTION
NO_SUCCESSFUL_FORECAST
NO_72_HOUR_FORECAST
NO_SCENARIO
NO_RECOMMENDATION
NO_POLICY_EVALUATION
NO_DECISION
NO_AO_ACT
NO_CALIBRATION_CANDIDATE
NO_SHADOW_EVALUATION
NO_MODEL_ACTIVATION
NO_ACTIVE_MODEL_PARAMETER_CHANGE
NO_LATE_EVIDENCE_REVISION
NO_CONTINUOUS_RUNTIME
NO_LIVE_FIELD_CLAIM
NO_MCFT_CAP_03_COMPLETE_CLAIM
NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM
```

S4 and all later delivery slices remain blocked until S3B is merged and its merged-main Gate passes.
