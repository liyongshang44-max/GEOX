<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATED-RECORD-SET-BUILDER.md -->
# MCFT-CAP-03 S3A — Assimilated A2 Record-Set Builder V1

## 1. Slice identity

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1

baseline_main_commit:
be5a0c00ae7d29d1bd2ccffe5a4235f20d23352a

branch:
mcft-cap-03-assimilated-a2-record-set-builder-v1

primary_owner:
MCFT-02

contributors:
MCFT-07
MCFT-08
```

The predecessor is S2 with merged-main Gate `107 PASS, 0 FAIL`.

## 2. Authorized result

S3A establishes a pure deterministic builder for the existing A2 eight-object aggregate:

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

The record-set discriminator is:

```text
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

The Evidence Window discriminator is:

```text
MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V1
```

The transaction and operation identities remain:

```text
transaction_family = A_STATE_TICK_COMMIT
operation_variant = A2_BLOCKED_FORECAST
```

S3A does not create a ninth object and does not modify the operation key.

## 3. Pure builder boundary

The builder accepts caller-supplied canonical inputs:

```text
PreparedNextTickInputV1
pinned assimilated Runtime Config
finalized AssimilatedContinuationEvidenceWindowV1
HourlyWaterBalanceResultV1 propagated prior
AssimilatedContinuationPosteriorV1
previous Forecast result hash
```

It deterministically publishes the eight candidate objects and the aggregate identity.

It performs no:

```text
database access
lease acquisition
fencing
CAS
canonical write
projection mutation
route
scheduler
wall-clock read
random generation
```

Therefore:

```text
NO_CAP_03_A2_TICK_COMMITTED
NO_PERSISTENCE_CHANGE
NO_DATABASE_ACCESS
NO_SINGLE_TICK_INTEGRATION
```

remain effective.

## 4. Evidence trace contract

The canonical Evidence Window separately publishes:

```text
dynamics_consumed_evidence_refs
assimilation_evaluated_evidence_refs
assimilation_applied_evidence_refs
context_only_evidence_refs
rejected_evidence_refs
consumed_evidence_refs
```

The compatibility union is fixed:

```text
consumed_evidence_refs
=
lexicographic unique union(
  dynamics_consumed_evidence_refs,
  assimilation_applied_evidence_refs
)
```

An observation with disposition `REJECTED_OUTLIER` may be evaluated but must not be applied or consumed.

## 5. Posterior State authority

`twin_state_estimate_v1` publishes the posterior as next-tick authority.

Its computation basis separately records:

```text
previous storage mean and variance
propagated prior storage mean and variance
propagated prior VWC mean and variance
posterior storage mean and variance
posterior VWC mean and variance
state correction in VWC
state correction in millimetres
DECIMAL_HALF_AWAY_FROM_ZERO_V1
```

The posterior values must equal the corresponding `twin_assimilation_update_v1` fields.

Mass-balance trace continues to explain only the Dynamics propagation. Assimilation correction is a separate trace.

## 6. Tick, Checkpoint, Health and Forecast

The Runtime Tick must carry:

```text
record_set_contract_id =
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

The first standard CAP-03 Checkpoint advances:

```text
previous sequence = 24
current sequence = 25
```

Forecast remains:

```text
status = BLOCKED
points = []
scenario_eligible = false
successful_forecast_ref = null
```

Health status is disposition-specific:

```text
APPLIED
→ CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST

REJECTED_OUTLIER
→ CONTINUATION_STATE_PROPAGATED_WITH_REJECTED_OUTLIER

NO_USABLE_OBSERVATION
→ CONTINUATION_STATE_PROPAGATED_WITHOUT_USABLE_OBSERVATION
```

## 7. Cross-reference validator

`validateAssimilatedContinuationCrossReferencesV1` first runs the S1 record-set contract validator and then proves:

```text
exact eight-member cardinality
member hash and aggregate hash integrity
same scope, lineage, revision and Runtime Config
Evidence classification consistency
selected/evaluated/applied/consumed observation consistency
transition → Evidence / assimilation / State references
assimilation → transition / State references
State → predecessor / transition / assimilation / Evidence references
posterior State values equal assimilation output
Forecast source equals the posterior State
Tick references all same-aggregate members
Checkpoint advances to the same posterior State
Health references the same Tick, Checkpoint, State and Forecast
Health status matches the assimilation disposition
crop-stage context equals aggregate identity
```

Any mismatch fails closed.

## 8. Historical dispatch

Versioned readback dispatch remains explicit:

```text
HOURLY_DYNAMICS_CONTINUATION
+ no CAP-03 discriminator
→ immutable CAP-02 validator

HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION
+ MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
→ CAP-03 full cross-reference validator
```

Unknown or mixed combinations fail with:

```text
UNKNOWN_RECORD_SET_CONTRACT
VALIDATOR_DISPATCH_MISMATCH
```

CAP-02 historical record sets are not rewritten or reinterpreted.

## 9. Preserved nonclaims

S3A does not establish:

```text
successful Forecast
72-hour Forecast
Scenario
Recommendation
Policy evaluation
Decision
AO-ACT
calibration candidate
shadow evaluation
model activation
active model parameter change
late-Evidence revision
continuous Runtime
live-field operation
MCFT-CAP-03 completion
Minimum Complete Field Twin completion
```

S3B remains blocked until S3A merges and its merged-main Gate passes.
