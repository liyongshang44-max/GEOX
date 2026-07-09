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
acceptance_status: COMPLETE
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

The original task line used `APPROVED` and `EXECUTED` as epistemic classes and used `HUMAN_OR_EXTERNAL_PLAN` as a combined source kind. This amendment separates independent semantic axes.

The frozen rule is:

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

Irrigation execution evidence:
  epistemic_class: OBSERVED
  action_lifecycle_class: EXECUTION_EVIDENCE
```

The plan source is frozen as:

```text
origin_source_kind: VERSIONED_PLAN_SNAPSHOT
```

This does not claim that a human decision service, dispatch service, execution service, or production source exists. It only creates a versioned governance identity for MCFT-01 Replay records.

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
```

Exactly one active MCFT Reality scope is permitted.

C8 is selected only as the identity parent. Legacy C8 State, Forecast, Scenario, Recommendation, Approval, AO-ACT, ROI, Field Memory, geometry, and execution closure are excluded from MCFT canonical truth.

P50 / CAF009 remains `REFERENCE_ONLY`. `field_demo_001` remains rejected as the first MCFT scope.

## 3. Reality classification

```text
field_truth_mode: CONTROLLED_REPLAY_FIELD_PROXY
geometry_truth_status: CONTROLLED_SYNTHETIC
source_truth_status: MIXED_FIXTURE_AND_GOVERNED_REPLAY
live_device_status: NOT_CLAIMED
real_field_pilot_status: NOT_CLAIMED
production_status: NOT_CLAIMED
```

Device identities are repository fixture evidence only. Governance-defined provider, ET0, plan, configuration, and adapter identities have:

```text
proof_scope: GOVERNANCE_IDENTITY_ONLY
```

Their existence does not prove a Replay dataset, operational provider, live device, or production source.

## 4. Governed geometry

```text
zone_id: zone_mcft_c8_water_001
geometry_type: Polygon
crs: EPSG:4326
geometry_truth_status: CONTROLLED_SYNTHETIC
geometry_source: MCFT_00_PINNED_FIXTURE
canonicalization_id: GEOX_MCFT_GEOJSON_CANONICALIZATION_V1
file_sha256: sha256:249fee97640a8291d18becb399b7ed7757de90222ad55ed1a203ebe277147ab4
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
derived_area_m2: 20488.479982
```

Geometry validation requires:

- Polygon type;
- at least one non-empty ring;
- legal WGS84 coordinates;
- finite numbers;
- closed rings;
- at least three distinct vertices;
- non-zero ring area;
- deterministic orientation, start point, precision, negative-zero normalization, and key ordering.

The authoritative area is derived from the canonical semantic geometry. `legacy_declared_area_m2` is comparison-only.

Any semantic geometry change requires a new binding version, new semantic hash, supersedes reference, and change reason.

## 5. Root zone and sensor support

```text
root_zone_definition_id: rz_c8_0_300mm_v1
top_depth_mm: 0
bottom_depth_mm: 300
total_depth_mm: 300
```

The first version contains one governed layer covering 0–300 mm with weight 1.0.

Layer validation requires finite bounds, `top < bottom`, containment inside the governed root zone, unique non-empty layer IDs, no gap, no overlap, and weights summing to 1.0.

The candidate soil sensor is frozen as:

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

MCFT-00 freezes three independent object classes:

```text
REALITY_IDENTITY_BINDING
EVIDENCE_SOURCE_BINDING
MODEL_CONFIGURATION_BINDING
```

Every Evidence binding must resolve uniquely to:

```text
one source_definition
one ingress_adapter_definition
one source role
one binding ID
```

The source kind and version on the binding must equal the referenced source definition. The adapter kind, output record type, release policy, and version must equal the referenced adapter definition.

Every model configuration binding must resolve uniquely to one configuration source definition with matching kind and version.

Duplicate or unresolved source, adapter, configuration, role, or binding identities are invalid.

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

## 8. Soil-hydraulic configuration semantics

The governed root-zone depth is 300 mm.

The configuration freezes:

```text
wilting_point_fraction: 0.12
field_capacity_fraction: 0.30
saturation_fraction: 0.45
wilting_point_storage_mm: 36.0
field_capacity_storage_mm: 90.0
saturation_storage_mm: 135.0
drainage_coefficient_per_hour: 0.03
runoff_fraction: 0.05
```

Required invariants are:

```text
0 <= wilting_point_fraction
wilting_point_fraction < field_capacity_fraction
field_capacity_fraction < saturation_fraction <= 1

wilting_point_storage_mm
  = wilting_point_fraction * root_zone_depth_mm

field_capacity_storage_mm
  = field_capacity_fraction * root_zone_depth_mm

saturation_storage_mm
  = saturation_fraction * root_zone_depth_mm

0 <= runoff_fraction <= 1
drainage_coefficient_per_hour >= 0
```

`field_capacity_storage_mm` replaces the ambiguous `root_zone_storage_capacity_mm` name.

## 9. Crop root-depth policy

Crop biological root depth may exceed the Level-A governed model domain. The frozen policy is:

```text
effective_model_root_depth_policy:
MIN_CROP_ROOT_DEPTH_AND_GOVERNED_ROOT_ZONE_V1

effective_model_root_depth_mm
  = min(crop_root_depth_mm, governed_root_zone_bottom_mm)
```

For MID and LATE corn stages:

```text
crop_root_depth_mm: 600
effective_model_root_depth_mm: 300
```

MCFT-06 must not infer a different policy.

## 10. Replay time and availability

```text
timezone: UTC
tick_interval: PT1H
tick_alignment: UTC_CLOCK_HOUR
logical_tick_time: INTERVAL_END
```

Every Evidence role freezes:

- its event or observation time fields;
- `ingested_at`;
- `available_to_runtime_at`;
- the exact deterministic derivation inputs;
- the Replay release policy ID.

Availability is computed by `MAX_VALID_INSTANT` over the role-specific fixed source timestamps. The output field cannot appear among its own derivation inputs.

The following inputs are forbidden:

```text
current_wall_clock
file_mtime
script_start_time
temporary_checkout_path
```

No-future-leakage classification is calculated, not self-declared:

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

## 11. Deterministic identity and acceptance metadata

The Reality artifact, source matrix, and configuration matrix use:

```text
status: FROZEN
acceptance_status: PENDING | COMPLETE
```

`acceptance_status` is audit metadata. It is excluded from semantic hashes and binding identity.

Changing only acceptance state must not change:

```text
source matrix determinism hash
configuration matrix determinism hash
Reality determinism hash
Reality binding ID
```

Same ID plus same semantic hash is:

```text
IDEMPOTENT_REPLAY
```

Same ID plus different semantic hash is:

```text
IDEMPOTENCY_CONFLICT
```

The frozen identity is recorded in `GEOX-MCFT-00-REALITY-BINDING.json`.

## 12. Canonical boundary

The Reality Binding is:

```text
artifact_class: GOVERNANCE_INPUT
canonical_runtime_object: false
canonical_persistence: false
lineage_member: false
runtime_transaction_family: NONE
```

Compile ownership remains MCFT-02. Persistence ownership remains MCFT-03.

MCFT-00 does not:

- write facts;
- create `twin_runtime_config_v1`;
- create State, Forecast, Scenario, Checkpoint, or Action Feedback;
- create lineage or revision identity;
- execute E1, E2, or E3;
- switch active Runtime, lineage, State, Forecast, or configuration pointers.

## 13. Action feedback eligibility boundary

Approved, dispatched, executed, and validated are distinct states.

The approved plan binding has:

```text
state_input_policy: NEVER
```

The execution Evidence binding has:

```text
state_input_policy: CONDITIONAL
```

A future concrete Action Feedback record must contain actual amount, unit, execution time, spatial coverage, source identity, source quality, limitations, and a receipt or as-executed reference. Acceptance is optional. An AO-ACT origin requires a task reference.

MCFT-15 owns the canonical Action Feedback object and persistence behavior.

## 14. Acceptance model

The Gate has two valid closure modes:

```text
PENDING_ACCEPTANCE
COMPLETE
```

Pending mode requires pending evidence fields and the pending claim.

Complete mode requires concrete implementation head, zero-warning local Gate result, predecessor regressions, exact changed-file count, exact negative fixture count, clean working tree, generic CI evidence, and no pending closure field.

The Gate validates:

- 57 evidence-bearing hard checks;
- exact reason code and exact validation stage for every negative fixture;
- `write_attempt_count = 0`;
- validator purity;
- deterministic idempotency behavior;
- authority-reference closure;
- structural geometry and root-zone validity;
- executable release and no-future rules;
- repository changed-file boundary;
- predecessor regressions.

The original minimum was 61 negative fixtures. The exact fixture count may increase and must match the manifest.

## 15. Nonclaims

Completion does not claim:

```text
Canonical Replay Dataset complete
Evidence ingestion complete
hourly Runtime exists
State estimator exists
physical propagation exists
assimilation exists
posterior State exists
Forecast exists
Scenario exists
Decision exists
Action Feedback exists
Residual exists
Calibration exists
Checkpoint exists
restart recovery exists
late-Evidence Runtime revision exists
live device connected
real field pilot started
Minimum Complete Field Twin complete
Production Field Twin complete
```

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
