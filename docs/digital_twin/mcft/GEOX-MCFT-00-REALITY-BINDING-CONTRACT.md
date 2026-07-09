<!-- docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING-CONTRACT.md -->
# GEOX MCFT-00 Reality Binding Contract

## 0. Phase identity

```text
phase: MCFT-00
name: Reality Binding Contract
type: governed scope, configuration, and source-binding freeze
baseline_main_commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
predecessor: DT-02 with DT02-AMENDMENT-01 COMPLETE
successor: MCFT-01 Canonical Replay Dataset
runtime_mode: REPLAY
implementation_capability: GOVERNANCE_ONLY
status: FROZEN
acceptance_status: PENDING
duplicate_implementation_pr: #2305 CLOSED_SUPERSEDED
```

MCFT-00 freezes the single Reality scope, governed geometry, root-zone definition, source authorities, configuration authorities, Replay ingress adapters, epistemic classification, lifecycle classification, deterministic availability semantics, and deterministic binding identity for the first Minimum Complete Field Twin.

MCFT-00 does not ingest Evidence, run ticks, calculate State, propagate a model, assimilate observations, produce Forecast or Scenario objects, create Action Feedback, write canonical facts, or switch active pointers.

## 1. Accepted task-line amendment

```text
amendment_id: MCFT00-AMENDMENT-01
amendment_status: ACCEPTED
amendment_scope: source-kind and epistemic/lifecycle vocabulary clarification only
```

The frozen semantic axes are:

```text
epistemic_class
  = OBSERVED | ESTIMATED | ASSUMED | ASSERTED | CONFIGURED

action_lifecycle_class
  = NOT_APPLICABLE | APPROVED_PLAN | EXECUTION_EVIDENCE
```

Therefore:

```text
Approved irrigation plan:
  epistemic_class: ASSERTED
  action_lifecycle_class: APPROVED_PLAN
  origin_source_kind: VERSIONED_PLAN_SNAPSHOT

Irrigation execution evidence:
  epistemic_class: OBSERVED
  action_lifecycle_class: EXECUTION_EVIDENCE
```

This amendment creates governance identities only. It does not claim a human decision service, dispatch service, execution service, live source, or production capability.

## 2. Frozen Reality scope

```text
tenant_id: tenantA
project_id: projectA
group_id: groupA
field_id: field_c8_demo
season_id: season_2026_c8_corn
zone_id: zone_mcft_c8_water_001
crop_code: corn
runtime_mode: REPLAY
runtime_time_domain: UTC_HOURLY
reality_scope_class: CONTROLLED_SYNTHETIC_REPLAY_PROXY
active_scope_count: 1
```

C8 is reused only as the identity parent. Legacy C8 State, Forecast, Scenario, Recommendation, Approval, AO-ACT, ROI, Field Memory, geometry, and execution closure are excluded from MCFT canonical truth. P50 / CAF009 remains `REFERENCE_ONLY`. `field_demo_001` remains rejected.

## 3. Reality classification

```text
field_truth_mode: CONTROLLED_REPLAY_FIELD_PROXY
geometry_truth_status: CONTROLLED_SYNTHETIC
source_truth_status: MIXED_FIXTURE_AND_GOVERNED_REPLAY
live_device_status: NOT_CLAIMED
real_field_pilot_status: NOT_CLAIMED
production_status: NOT_CLAIMED
```

Fixture device identities prove repository identity only. Governance-defined provider, ET0, plan, configuration, and adapter identities use:

```text
proof_scope: GOVERNANCE_IDENTITY_ONLY
```

## 4. Governed geometry

```text
zone_id: zone_mcft_c8_water_001
geometry_type: Polygon
crs: EPSG:4326
geometry_truth_status: CONTROLLED_SYNTHETIC
canonicalization_id: GEOX_MCFT_GEOJSON_CANONICALIZATION_V1
file_sha256: sha256:249fee97640a8291d18becb399b7ed7757de90222ad55ed1a203ebe277147ab4
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
derived_area_m2: 20488.479982
```

Canonical coordinates use exactly seven decimal degrees and decimal half-away-from-zero rounding. This rule is executable for positive and negative half ties. ECMAScript `Math.round` tie behavior is not the canonical rule.

Geometry validation requires Polygon type, non-empty rings, finite legal WGS84 coordinates, ring closure, at least three distinct vertices, non-zero area, deterministic orientation, deterministic start point, negative-zero normalization, and stable key ordering.

Any semantic geometry change requires a new binding version, semantic hash, supersedes reference, and change reason.

## 5. Root zone and sensor support

```text
root_zone_definition_id: rz_c8_0_300mm_v1
top_depth_mm: 0
bottom_depth_mm: 300
total_depth_mm: 300
```

Layers must have finite bounds, `top < bottom`, containment within the governed root zone, unique non-empty IDs, no gap, no overlap, and weights summing to 1.0.

The candidate sensor is frozen as:

```text
origin_source_id: dev_soil_c8_001
nominal_depth_mm: 200
spatial_support: POINT
vertical_support: LOCAL_AROUND_200MM
root_zone_representativeness: PARTIAL
direct_state_equivalence: false
```

A 200 mm point observation is not a 0–300 mm zone-average State.

## 6. Binding authority graph

MCFT-00 freezes three independent classes:

```text
REALITY_IDENTITY_BINDING
EVIDENCE_SOURCE_BINDING
MODEL_CONFIGURATION_BINDING
```

Every Evidence binding must resolve uniquely to one source definition, one Replay adapter definition, one source role, and one binding ID.

The binding must explicitly carry and match:

```text
origin_source_kind
origin_source_id
source_version
ingress_adapter_kind
ingress_adapter_id
ingress_adapter_version
evidence_record_type
availability_semantics.release_policy_id
```

These fields must equal the referenced source and adapter definitions. Missing, duplicate, unresolved, kind-mismatched, version-mismatched, output-type-mismatched, or release-policy-mismatched references are invalid.

Every model configuration binding must resolve uniquely to one configuration definition with matching kind and version.

## 7. Required semantic domains

Eight semantic domains and nine concrete bindings are frozen:

1. soil-moisture observation;
2. observed rainfall;
3. future-weather assumption;
4. historical ET0 estimate;
5. future ET0 assumption;
6. soil-hydraulic configuration;
7. crop-water-use configuration;
8. approved irrigation plan;
9. irrigation execution evidence.

The seven Evidence bindings use seven independently governed Replay adapter definitions.

## 8. Soil-hydraulic configuration

```text
root_zone_depth_mm: 300
wilting_point_fraction: 0.12
field_capacity_fraction: 0.30
saturation_fraction: 0.45
wilting_point_storage_mm: 36.0
field_capacity_storage_mm: 90.0
saturation_storage_mm: 135.0
drainage_coefficient_per_hour: 0.03
runoff_fraction: 0.05
```

Required invariants:

```text
0 <= wilting_point_fraction
wilting_point_fraction < field_capacity_fraction
field_capacity_fraction < saturation_fraction <= 1
storage_mm = fraction * root_zone_depth_mm
0 <= runoff_fraction <= 1
drainage_coefficient_per_hour >= 0
```

## 9. Crop root-depth policy

```text
effective_model_root_depth_policy:
MIN_CROP_ROOT_DEPTH_AND_GOVERNED_ROOT_ZONE_V1

effective_model_root_depth_mm
  = min(crop_root_depth_mm, governed_root_zone_bottom_mm)
```

For MID and LATE corn stages, biological root depth is 600 mm while effective Level-A model depth is 300 mm.

## 10. Replay time and availability

```text
timezone: UTC
tick_interval: PT1H
tick_alignment: UTC_CLOCK_HOUR
logical_tick_time: INTERVAL_END
```

Every Evidence role freezes its event or observation time, `ingested_at`, `available_to_runtime_at`, exact derivation inputs, and release policy ID.

Availability is computed with `MAX_VALID_INSTANT` over fixed role-specific source timestamps. The output field cannot appear among its own inputs. Wall clock, file mtime, script start time, and checkout path are forbidden inputs.

```text
FUTURE:
  observed_at > logical_tick_time

LATE:
  observed_at <= logical_tick_time
  and available_to_runtime_at > logical_tick_time

ON_TIME:
  observed_at <= logical_tick_time
  and available_to_runtime_at <= logical_tick_time
```

Only `ON_TIME` Evidence is eligible for the current tick.

## 11. Deterministic identity and idempotency

The Reality artifact, source matrix, and configuration matrix use:

```text
status: FROZEN
acceptance_status: PENDING | COMPLETE
```

`acceptance_status` is excluded from semantic hashes and binding identity.

The idempotency guard must independently compute:

```text
existing_semantic_hash = hash(existing.semantic_payload)
candidate_semantic_hash = hash(candidate.semantic_payload)
```

It must then verify each declared determinism hash and each derived binding ID. It may not trust caller-supplied hashes.

```text
declared hash != computed hash
  => SEMANTIC_HASH_MISMATCH

same ID + same computed semantic hash + valid derived ID
  => IDEMPOTENT_REPLAY

same ID + different computed semantic hash
  => IDEMPOTENCY_CONFLICT
```

The candidate identity after adapter-version binding is:

```text
binding_id: mcft_rb_bf1da664164a4fedda249bcb
determinism_hash: sha256:bf1da664164a4fedda249bcb0e330c1af2083173a52bd704f01eac3ad277ba4f
source_matrix_hash: sha256:c5187c23be0d058ffa23d464ae1139f924f5af064a270248746fbabde4c3e51b
configuration_matrix_hash: sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5
```

## 12. Canonical boundary

```text
artifact_class: GOVERNANCE_INPUT
canonical_runtime_object: false
canonical_persistence: false
lineage_member: false
runtime_transaction_family: NONE
```

Compile ownership remains MCFT-02. Persistence ownership remains MCFT-03.

MCFT-00 does not write facts, create `twin_runtime_config_v1`, create State, Forecast, Scenario, Checkpoint, or Action Feedback, create lineage identity, execute E1/E2/E3, or switch active pointers.

## 13. Action feedback eligibility

Approved, dispatched, executed, and validated are distinct states.

```text
approved plan state_input_policy: NEVER
execution Evidence state_input_policy: CONDITIONAL
```

A future Action Feedback record requires actual amount, unit, execution time, spatial coverage, source identity, source quality, limitations, and a receipt or as-executed reference. Acceptance is optional. AO-ACT origin requires a task reference. MCFT-15 owns the canonical object and persistence behavior.

## 14. Acceptance model

The Gate has two modes:

```text
PENDING_ACCEPTANCE
COMPLETE
```

The Gate validates:

- 57 evidence-bearing hard checks;
- exact reason code and exact validation stage for every negative fixture;
- 80 exact negative fixtures in the current candidate;
- stale or forged declared-hash rejection;
- positive and negative half-tie geometry rounding;
- adapter-version binding equality;
- `write_attempt_count = 0`;
- purity of both private helpers;
- deterministic idempotency behavior;
- authority-reference closure;
- structural geometry and root-zone validity;
- executable release and no-future rules;
- repository changed-file boundary;
- predecessor regressions.

Complete mode additionally requires a concrete validated head, zero-warning full Gate, clean working tree, final CI evidence, and no pending closure field.

## 15. Nonclaims

Completion does not claim a canonical Replay dataset, Evidence ingestion, hourly Runtime, State estimator, propagation, assimilation, posterior State, Forecast, Scenario, Decision, Action Feedback, Residual, Calibration, Checkpoint, restart recovery, late-Evidence Runtime revision, live device, real-field pilot, Minimum Complete Field Twin, or Production Field Twin.

The only permitted completed claim is:

```text
MCFT_00_REALITY_BINDING_FROZEN
GOVERNANCE_INPUT_ONLY
TARGET_RUNTIME_MODE_REPLAY
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_PERSISTENCE
NO_CANONICAL_REPLAY_DATASET
CONTROLLED_SYNTHETIC_REPLAY_SCOPE_ONLY
```
