<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-ASSIMILATION-CONTRACTS-CONFIG.md -->
# GEOX MCFT-CAP-03 S1 — Assimilation Contracts and Runtime Config

## 0. Identity

```text
delivery_slice_id:
MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1

baseline_main_commit:
6389d4e566a6eb64ce96209be0e70cd8703be574

branch:
mcft-cap-03-assimilation-contracts-config-v1

runtime_mode:
REPLAY

target_completion_level:
Level A
```

This slice establishes versioned contracts, immutable Runtime Config, aggregate identity and validator dispatch only. It executes no observation selector, assimilation mathematics or A2 tick.

## 1. Historical compatibility

The following MCFT-CAP-02 contracts remain immutable:

```text
ContinuationAggregateIdentityInputV1
ContinuationRecordSetV1
ContinuationEvidenceWindowV1
validateContinuationRecordSetV1
validateContinuationRuntimeConfigPayloadV1
```

CAP-02 dispatch authority remains:

```text
Runtime Config purpose:
HOURLY_DYNAMICS_CONTINUATION

record_set_contract_id:
absent

validator:
validateContinuationRecordSetV1
```

No CAP-02 source file is changed by this slice.

## 2. CAP-03 discriminator

```text
record_set_contract_id:
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

The discriminator exists in:

```text
AssimilatedContinuationRecordSetV1
AssimilatedContinuationAggregateIdentityInputV1
twin_runtime_tick_v1 payload
CAP-03 Runtime Config
```

It enters the aggregate determinism hash and does not enter the A2 operation key.

The A2 operation key remains:

```text
scope
lineage_id
revision_id
logical_time
operation_variant = A2_BLOCKED_FORECAST
```

## 3. Versioned dispatch

CAP-03 dispatch requires both:

```text
Runtime Config purpose =
HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION

record_set_contract_id =
MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1
```

Unknown, missing or inconsistent combinations fail closed as:

```text
UNKNOWN_RECORD_SET_CONTRACT
VALIDATOR_DISPATCH_MISMATCH
```

Dispatch does not infer the contract from payload shape, insertion order, branch, date or code version.

## 4. Update contract

Legal status/disposition combinations are exactly:

```text
APPLIED / ACCEPTED
APPLIED / DOWNWEIGHTED
NOT_APPLIED / REJECTED_OUTLIER
NOT_APPLIED / NO_USABLE_OBSERVATION
```

The contract independently expresses:

```text
candidate_assimilation_gain
applied_assimilation_gain
candidate_unclipped_posterior_mean
candidate_posterior_variance
published_posterior_mean
published_posterior_variance
```

It freezes:

```text
innovation == residual
residual_kind = STATE_OBSERVATION_INNOVATION
consumed_observation_refs == applied_observation_refs
model_parameter_change_applied = false
```

Candidate assessment vocabulary is versioned and includes deterministic selection, duplicate suppression, scope/time/binding/type/quantity/unit/physical/quality exclusions.

This slice validates the contract shape. Candidate ordering, semantic duplicate resolution, semantic content hash computation and numerical threshold execution remain S2 work.

## 5. Runtime Config

CAP-03 creates a new immutable `twin_runtime_config_v1` through the existing D transaction family.

```text
config_purpose:
HOURLY_DYNAMICS_WITH_OBSERVATION_ASSIMILATION

config_selection_mode:
EXPLICIT_REPLAY_PIN

parent authority:
predecessor latest posterior State.runtime_config_ref/hash
```

The config inherits without mutation:

```text
Reality Binding
source/configuration/geometry hashes
300 mm root-zone coordinate
hydraulic bounds
hourly Dynamics
runoff and drainage parameters
process uncertainty
executed-irrigation policy
rounding authority
BLOCKED Forecast policy
```

It removes:

```text
DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1
```

It adds:

```text
observation selector:
LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V1

binding:
soil_obs_c8_20cm_v1

quantity/unit:
VOLUMETRIC_WATER_CONTENT / fraction

operator:
POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1
H = 1
direct_state_equivalence = false

sensor stddev:
0.02

representativeness stddev:
0.06

quality weights:
PASS = 1.0
LIMITED = 0.5
FAIL = 0.0

method:
SCALAR_GAUSSIAN_ASSIMILATION_V1

outlier authority:
innovation² <= 16 × innovation variance

active model parameter change:
FORBIDDEN
```

There is no active-config pointer activation and no latest-inserted implicit selection.

## 6. Aggregate identity

CAP-03 aggregate identity includes:

```text
record_set_contract_id
Runtime Config ref/hash
Evidence Window semantic digest
previous posterior ref/hash
previous checkpoint ref/hash
previous Forecast-result ref/hash
Reality Binding ref/hash
observation policy version
assimilation method version
member determinism hashes
```

Therefore:

```text
same operation key + same aggregate hash
→ EXISTING_IDEMPOTENT_SUCCESS

same operation key + different aggregate hash
→ IDEMPOTENCY_CONFLICT
```

## 7. Persistence boundary

This slice reuses:

```text
D_MODEL_GOVERNANCE_STEP_COMMIT
RuntimeConfigRepositoryPortV1
canonical Runtime Config readback
canonical JSON payload comparison
```

This slice adds no migration and changes no A2 persistence path.

## 8. Allowed claims

Only after this slice is merged and its merged-main Gate passes:

```text
VERSIONED_ASSIMILATION_CONTRACT_ESTABLISHED
ASSIMILATED_CONTINUATION_RECORD_SET_IDENTITY_ESTABLISHED
ASSIMILATION_RUNTIME_CONFIG_ESTABLISHED
VERSIONED_CONTINUATION_VALIDATOR_DISPATCH_ESTABLISHED
ASSIMILATION_RUNTIME_CONFIG_D_TRANSACTION_ESTABLISHED
CAP_02_CONTINUATION_CONTRACT_COMPATIBILITY_PRESERVED
```

## 9. Preserved nonclaims

```text
NO_OBSERVATION_SELECTOR_IMPLEMENTED
NO_OBSERVATION_SEMANTIC_DUPLICATE_RESOLUTION_IMPLEMENTED
NO_OBSERVATION_SEMANTIC_CONTENT_HASH_IMPLEMENTED
NO_ASSIMILATION_MATH_IMPLEMENTED
NO_OBSERVATION_UPDATE_APPLIED
NO_OBSERVATION_INNOVATION_COMPUTED
NO_CAP_03_A2_TICK_COMMITTED
NO_FORECAST_RESIDUAL
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
