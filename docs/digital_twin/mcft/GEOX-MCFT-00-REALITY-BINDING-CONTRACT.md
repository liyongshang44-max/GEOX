<!-- docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING-CONTRACT.md -->
# GEOX MCFT-00 Reality Binding Contract

## 0. Authority

```text
phase: MCFT-00
name: Reality Binding Contract
type: governed scope, configuration, and source-binding freeze
predecessor: DT-02 Runtime Architecture Freeze with DT02-AMENDMENT-01
successor: MCFT-01 Canonical Replay Dataset
baseline_main_commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
target_completion_level: Level A — Minimum Complete Field Twin
target_runtime_mode: REPLAY
implementation_capability: GOVERNANCE_ONLY
status: FROZEN_PENDING_ACCEPTANCE
```

MCFT-00 creates no canonical Runtime fact, State, Forecast, Scenario, Checkpoint, lineage, revision, projection, route, migration, scheduler, or database write.

Allowed completion claim:

```text
MCFT_00_REALITY_BINDING_FROZEN
GOVERNANCE_INPUT_ONLY
TARGET_RUNTIME_MODE_REPLAY
NO_RUNTIME_IMPLEMENTATION
NO_CANONICAL_PERSISTENCE
NO_CANONICAL_REPLAY_DATASET
CONTROLLED_SYNTHETIC_REPLAY_SCOPE_ONLY
```

## 1. Task-line corrections applied

Repository review found five internal task-line defects and corrected them before implementation:

1. The predecessor is already complete. MCFT-00 starts from merge commit `7fd848ae00680480fc864990b9d03b37bc61fdff`; `DRAFT_BLOCKED_BY_DT02_AMENDMENT_01` and amendment status `ACCEPTED` are stale. The authoritative amendment status is `COMPLETE`.
2. `MODEL_CONFIGURATION_BINDING` must not carry `origin_source_*` or Replay adapter fields. It uses `configuration_source_kind`, `configuration_source_id`, and `configuration_version`.
3. `HUMAN_OR_EXTERNAL_PLAN` is an ambiguous union source kind. The approved-plan Replay source is frozen as `VERSIONED_PLAN_SNAPSHOT`.
4. Action lifecycle terms are not epistemic classes. Approved plan and execution evidence use `action_lifecycle_class` separately from `epistemic_class`.
5. A newly named Replay provider or configuration source cannot prove its own authority. Each governed MCFT source/config identity is therefore defined by a versioned, hashed matrix entry with provenance, limitations, successor ownership, and an explicit statement that no Replay time-series dataset exists yet.
6. The acceptance entrypoint remains one exact Gate, but deterministic geometry/hash and semantic-package validation are factored into two private helpers under `scripts/governance_acceptance/mcft00/**`. This avoids a monolithic 40 kB Gate while preserving one invocation surface and a precise successor allowlist.

These corrections do not change DT-02. They make MCFT-00 comply with DT-02 separation of Reality, Evidence, configuration, execution, and validation.

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

Classification:

```text
field_truth_mode: CONTROLLED_REPLAY_FIELD_PROXY
geometry_truth_status: CONTROLLED_SYNTHETIC
source_truth_status: MIXED_FIXTURE_AND_GOVERNED_REPLAY
live_device_status: NOT_CLAIMED
real_field_pilot_status: NOT_CLAIMED
production_status: NOT_CLAIMED
```

Crop stage, dynamic root depth, canopy, stress, biomass, and phenology are not identity.

## 3. Candidate adjudication

The selected identity parent is C8 under strict isolation. Only tenant/project/group/field/season/crop and candidate device identities are reused. Legacy State, Forecast, Scenario, Recommendation, Approval, AO-ACT, ROI, Field Memory, geometry, area, and execution closure are excluded.

The evidence decision register is:

```text
docs/digital_twin/mcft/GEOX-MCFT-00-CANDIDATE-ADJUDICATION.md
```

P50/CAF009 is `REFERENCE_ONLY`; `field_demo_001` is `REJECTED`; C8 device identities are `FIXTURE_ONLY`, not online or production evidence.

## 4. Geometry authority

The only MCFT-00 geometry authority is:

```text
fixtures/mcft/reality_binding/MCFT_C8_GOVERNED_ZONE_V1.geojson
```

Frozen values:

```text
canonicalization_id: GEOX_MCFT_GEOJSON_CANONICALIZATION_V1
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
file_sha256: sha256:249fee97640a8291d18becb399b7ed7757de90222ad55ed1a203ebe277147ab4
derived_area_m2: 20488.479982
area_algorithm: GEOX_WGS84_AUTHALIC_SPHERE_POLYGON_AREA_V1
legacy_declared_area_m2: 20000
legacy_area_status: NON_AUTHORITATIVE_COMPARISON_ONLY
```

The geometry is controlled synthetic. It is not surveyed, field-verified, real-verified, or production-authoritative. Any semantic change requires a new binding version and supersedes reference.

## 5. Root-zone definition

```text
root_zone_definition_id: rz_c8_0_300mm_v1
top_depth_mm: 0
bottom_depth_mm: 300
total_depth_mm: 300
depth_reference: BELOW_GROUND_SURFACE

layer:
  layer_id: rz_layer_0_300mm
  top_depth_mm: 0
  bottom_depth_mm: 300
  weight: 1.0
```

Sensor support:

```text
origin_source_id: dev_soil_c8_001
nominal_depth_mm: 200
spatial_support: POINT
vertical_support: LOCAL_AROUND_200MM
root_zone_representativeness: PARTIAL
direct_state_equivalence: false
```

A point observation at 200 mm is not a 0–300 mm zone State.

## 6. Binding classes

### 6.1 Reality identity binding

Defines scope, crop identity, governed zone, geometry authority, and root-zone authority.

### 6.2 Evidence source binding

Requires distinct origin and Replay ingress identities:

```text
origin_source_kind
origin_source_id
ingress_adapter_kind: REPLAY_ADAPTER
ingress_adapter_id
```

### 6.3 Model configuration binding

Uses only:

```text
configuration_source_kind
configuration_source_id
configuration_version
```

It must not masquerade as an Evidence source and must not contain Replay adapter fields.

The source matrix contains seven Evidence bindings; the configuration matrix contains two configuration bindings, for nine concrete bindings across eight required semantic domains.

## 7. Epistemic and lifecycle separation

Allowed Evidence epistemic classes in this contract:

```text
OBSERVED
ASSUMED
ESTIMATED
ASSERTED
```

Configuration uses:

```text
CONFIGURED
```

Action lifecycle meaning is separate:

```text
APPROVED_PLAN
EXECUTION_EVIDENCE
```

Approved is not Dispatched. Approved is not Executed. Executed is not Validated.

## 8. Time and Replay release

```text
timezone: UTC
tick_interval: PT1H
tick_alignment: UTC_CLOCK_HOUR
logical_tick_time: INTERVAL_END
```

Each time-series Evidence record must distinguish:

```text
observed_at
ingested_at
available_to_runtime_at
```

Availability is fixed in the dataset or derived by `mcft_replay_release_policy_v1`. Wall clock, file mtime, process start time, and temporary path are forbidden inputs.

No-future-leakage:

- Evidence observed after logical tick time is excluded.
- Evidence unavailable at compute logical time is excluded.
- Future Observation is excluded from earlier ticks.
- Late Evidence is classified separately and is not on-time Evidence.

Aggregation belongs to MCFT-01/MCFT-05.

## 9. Action Feedback eligibility boundary

MCFT-00 binds execution-source authority but does not create `twin_action_feedback_v1`.

Future records must separate:

```text
execution_status
validation_status
eligible_for_state_input
```

`acceptance_ref` is optional. `receipt_ref` or `as_executed_ref` is required. `task_ref` is required only for `origin_kind=AO_ACT`.

Eligibility requires actual amount, unit, executed time, spatial coverage, source identity, source quality, and limitations. A binding never sets all concrete records eligible automatically.

## 10. Governance artifact and compile target

Artifact:

```text
artifact_type: mcft_reality_binding_contract_v1
artifact_class: GOVERNANCE_INPUT
canonical_runtime_object: false
canonical_persistence: false
lineage_member: false
runtime_transaction_family: NONE
binding_id: mcft_rb_83d0e3cf728d257277225fee
determinism_hash: sha256:83d0e3cf728d257277225fee220dfec1029abb52e3a18b40f3801cd1bba187bf
```

Compile target:

```text
owner_phase: MCFT-02
object_type: twin_runtime_config_v1
record_class: CANONICAL_MODEL_GOVERNANCE_HISTORY
lineage_member: false
envelope_profile: NON_LINEAGE_CONTEXT
```

Persistence target:

```text
owner_phase: MCFT-03
transaction_family: D_MODEL_GOVERNANCE_STEP_COMMIT
canonical_store: Postgres facts append-only store
```

MCFT-00 performs neither compile nor persistence.

## 11. Versioning

The semantic hash includes schema, scope, runtime mode, reality classification, geometry semantic hash, crop identity, root-zone definition, source/config binding semantic payloads, time domain, Replay release policy, limitations, and nonclaims.

It excludes `created_at`, `persisted_at`, `fact_id`, worker/process identifiers, wall clock, random UUID, absolute path, checkout path, and branch name.

A semantic change requires:

```text
binding_version + 1
supersedes_binding_ref
change_reason
previous_determinism_hash
new_determinism_hash
```

Reality Binding versioning is not Runtime lineage revision and cannot execute E1/E2/E3 or switch active pointers.

## 12. Legacy contamination guard

Forbidden as canonical MCFT inputs:

```text
water_state_estimate_v1
irrigation_scenario_set_v1
C8 recommendation/approval/AO-ACT/ROI/Field Memory
P50 replay_demo_state_estimate_v1
P50 replay_demo_forecast_run_v1
P50 demo model activation
P42/P43 controlled ledgers
```

Reusable only as patterns or identity evidence:

```text
scope identifiers
candidate device identifiers after adjudication
append-only fact-store pattern
typed evidence references
explicit replay clock
evidence partition
no-future-leakage
stable hashing after semantic review
```

## 13. Deliverables and boundary

MCFT-00 changes only:

```text
docs/digital_twin/mcft/**
fixtures/mcft/reality_binding/**
scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs
scripts/governance_acceptance/mcft00/**
docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json
precise predecessor successor-compatibility allowlists
```

No server, web, judge, executor, migration, route, runtime source, estimator, projection, seed application script, package, lockfile, or workflow is changed.

## 14. Successor

After final Gate, clean worktree, and CI:

```text
MCFT-01 — Canonical Replay Dataset
```

MCFT-01 must use this binding ID/hash and may not reselect scope, geometry, root zone, source semantics, configuration authority, or Runtime mode without a new Reality Binding version.
