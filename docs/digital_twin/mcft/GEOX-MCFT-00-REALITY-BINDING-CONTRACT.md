<!-- docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING-CONTRACT.md -->
# GEOX MCFT-00 Reality Binding Contract

## 0. Authority

```text
phase: MCFT-00
name: Reality Binding Contract
type: governed scope, configuration, and source-binding freeze
predecessor: DT-02 Runtime Architecture Freeze with DT02-AMENDMENT-01
successor: MCFT-01 Canonical Replay Dataset
baseline main commit: 7fd848ae00680480fc864990b9d03b37bc61fdff
predecessor PR: #2303
runtime mode: REPLAY
reality scope class: CONTROLLED_SYNTHETIC_REPLAY_PROXY
implementation capability: GOVERNANCE_ONLY
status: PENDING_ACCEPTANCE
```

MCFT-00 freezes which controlled Reality proxy the first Minimum Complete Field Twin will represent and which versioned sources, configurations, and Replay adapters may provide inputs. It does not ingest Evidence, compute State, run a tick, create Forecast or Scenario, write facts, create lineage, activate Runtime config, or switch any active/latest pointer.

Allowed completion claims:

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

Repository review found five task-line defects that are corrected here:

1. The predecessor is already complete. MCFT-00 begins from merge commit `7fd848ae00680480fc864990b9d03b37bc61fdff` and is `READY_FOR_IMPLEMENTATION`, not `DRAFT_BLOCKED_BY_DT02_AMENDMENT_01`. DT02-AMENDMENT-01 uses status `COMPLETE`.
2. `MODEL_CONFIGURATION_BINDING` does not use `origin_source_*` or Replay-ingress fields. It uses `configuration_source_*` because configuration is not Evidence.
3. The ambiguous `HUMAN_OR_EXTERNAL_PLAN` source kind is rejected. Approved Replay plans use the explicit `VERSIONED_EXTERNAL_PLAN_SNAPSHOT` source kind.
4. New provider, plan, ET0, and configuration identifiers do not prove authority by name. Their complete versioned, hashable definitions are embedded in the source/configuration matrices.
5. Existing C8 device identifiers remain `FIXTURE_ONLY`. They prove repository identity, not live connectivity, field installation, production binding, or dataset sufficiency.

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

Reality classification:

```text
field_truth_mode: CONTROLLED_REPLAY_FIELD_PROXY
geometry_truth_status: CONTROLLED_SYNTHETIC
source_truth_status: MIXED_FIXTURE_AND_GOVERNED_REPLAY
live_device_status: NOT_CLAIMED
real_field_pilot_status: NOT_CLAIMED
production_status: NOT_CLAIMED
```

`crop_code` and `season_id` are identity. Crop stage, dynamic root depth, canopy, stress, biomass, and phenology are not identity.

## 3. Candidate adjudication

C8 is selected only as an identity parent under strict isolation. The stable tenant/project/group/field/season/crop identifiers and candidate device identifiers are reusable. Legacy State, Forecast, Scenario, Recommendation, Approval, AO-ACT, ROI, Field Memory, geometry truth, execution closure, and model activation are excluded.

P50/CAF009 is `REFERENCE_ONLY` for explicit Replay clock, partitioning, no-future-leakage, and trace organization. Its Reality identity, State math, Forecast math, persistence, and model activation are not reused.

`field_demo_001` is rejected as the first MCFT scope because repository seed identity and polygon presence do not establish season, crop, root zone, source authority, ET0, irrigation execution, or configuration authority.

The detailed evidence matrix is in `GEOX-MCFT-00-CANDIDATE-ADJUDICATION.md`.

## 4. Governed zone and geometry

The dedicated fixture is:

```text
fixtures/mcft/reality_binding/MCFT_C8_GOVERNED_ZONE_V1.geojson
```

It is not the legacy field polygon and is not promoted from it.

```text
zone_id: zone_mcft_c8_water_001
geometry_type: Polygon
crs: EPSG:4326
geometry_truth_status: CONTROLLED_SYNTHETIC
geometry_source: MCFT_00_PINNED_FIXTURE
file_sha256: sha256:b0b9039b0a70361f0725e3f342ebd622d34ddb57e5809646a54bdbb420a47c1e
geometry_semantic_hash: sha256:df3da5368a539b61d257603b4e5758589cb1f4cbf2863d3f5e03640c3b0bb30d
derived_area_m2: 54370.977
area_algorithm: GEOX_LOCAL_EQUIRECTANGULAR_SHOELACE_AREA_V1
```

Spatial identity is `field_id + zone_id + geometry_semantic_hash`.

The only authoritative area is the derived area. The legacy `20000 m²` value is retained solely as `NON_AUTHORITATIVE_COMPARISON_ONLY`.

Any semantic geometry change requires a new binding version, new semantic hash, supersedes reference, and change reason. It may never be labeled surveyed, field-verified, real-verified, or production-authoritative.

## 5. Root-zone definition

```text
root_zone_definition_id: rz_c8_0_300mm_v1
top_depth_mm: 0
bottom_depth_mm: 300
total_depth_mm: 300
depth_reference: BELOW_GROUND_SURFACE
```

One governed layer covers 0–300 mm with weight 1.0.

The C8 sensor candidate is frozen as:

```text
origin_source_id: dev_soil_c8_001
nominal_depth_mm: 200
spatial_support: POINT
vertical_support: LOCAL_AROUND_200MM
root_zone_representativeness: PARTIAL
direct_state_equivalence: false
```

A 20 cm point observation is not a 0–300 mm zone State. Observation operator, weighting, bias, uncertainty, quality penalties, assimilation gain, and posterior update remain MCFT-07 responsibilities.

## 6. Binding taxonomy

Three binding types are frozen:

```text
REALITY_IDENTITY_BINDING
EVIDENCE_SOURCE_BINDING
MODEL_CONFIGURATION_BINDING
```

Evidence bindings separate:

```text
origin source
!=
Replay ingress adapter
```

Configuration bindings use:

```text
configuration_source_kind
configuration_source_id
configuration_version
configuration_definition
```

They do not pretend to be device observations and do not use Replay-ingress fields.

The matrices contain seven Evidence-source bindings and two configuration bindings, covering eight semantic domains and nine concrete bindings:

1. soil-moisture observation;
2. observed rainfall;
3. future-weather assumption;
4. historical ET0 estimate;
5. future ET0 assumption;
6. soil-hydraulic configuration;
7. crop-water-use configuration;
8. approved irrigation plan;
9. irrigation execution evidence.

Every binding freezes role, epistemic class, unit, conversion, spatial/vertical support, time, quality, availability, allowed uses, forbidden uses, limitations, source/configuration version, binding version, and determinism hash.

## 7. Epistemic and action-stage boundaries

```text
soil observation: OBSERVED
observed rainfall: OBSERVED
future weather: ASSUMED
historical ET0: ESTIMATED
future ET0: ASSUMED
soil configuration: CONFIGURED
crop-water configuration: CONFIGURED
approved irrigation plan: APPROVED
irrigation execution evidence: EXECUTED
```

Observed rainfall and future precipitation assumptions require separate bindings and separate Evidence records.

Approved is not dispatched and not executed. The approved-plan binding has `state_input_policy=NEVER`.

Execution evidence has `state_input_policy=CONDITIONAL`. Binding-level `eligible_for_state_input=true` is forbidden. A concrete later Action Feedback record must carry actual amount, unit, executed time, spatial coverage, source identity, source quality, limitations, and at least one trusted `receipt_ref` or `as_executed_ref`.

Execution and validation are orthogonal. `acceptance_ref` is optional. `task_ref` is required only for `origin_kind=AO_ACT`. Later validation appends a superseding record and never mutates earlier history.

## 8. Time and availability

```text
timezone: UTC
tick_interval: PT1H
tick_alignment: UTC_CLOCK_HOUR
logical_tick_time: INTERVAL_END
runtime_mode: REPLAY
```

Each time-series record distinguishes:

```text
observed_at
ingested_at
available_to_runtime_at
```

`MCFT_REPLAY_RELEASE_POLICY_V1` derives availability only from fixed dataset/provider fields. Current wall clock, script execution time, file mtime, and checkout path are forbidden.

No-future-leakage:

```text
observation time > tick logical time -> excluded
available_to_runtime_at > compute logical time -> excluded
future observation -> never consumed by an earlier tick
late Evidence -> classified separately from on-time Evidence
```

Hourly aggregation belongs to MCFT-01/MCFT-05 and is not implemented here.

## 9. Reality Binding artifact boundary

The artifact is:

```text
schema_version: geox_mcft_reality_binding_v1
artifact_type: mcft_reality_binding_contract_v1
artifact_class: GOVERNANCE_INPUT
canonical_runtime_object: false
canonical_persistence: false
lineage_member: false
runtime_transaction_family: NONE
write_target: NONE
```

It is not a fact, lineage member, Runtime config activation, checkpoint, or projection.

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

## 10. Determinism and versioning

Semantic identity includes schema, scope, Runtime mode, Reality classification, geometry semantic hash, crop identity, root-zone definition, source bindings, configuration bindings, time semantics, and Replay release policy.

Excluded fields include audit timestamps, fact/storage IDs, worker/process identity, wall clock, random UUID, absolute paths, checkout paths, and branch names.

```text
same semantic payload -> same binding_id and determinism_hash
same binding_id + different semantic payload -> IDEMPOTENCY_CONFLICT
```

Any semantic change requires a new binding version, supersedes reference, change reason, previous hash, and new hash. This governance version chain is not a Runtime lineage revision and may not execute E1/E2/E3 or switch active lineage.

## 11. Legacy contamination guard

Forbidden as initial MCFT Runtime truth:

```text
water_state_estimate_v1
irrigation_scenario_set_v1
C8 Recommendation / Approval / AO-ACT / ROI / Field Memory
P50 demo State / Forecast / model activation
P42/P43 controlled ledgers
```

Reusable only after the stated boundary review:

```text
stable scope identifiers
candidate device identifiers as FIXTURE_ONLY
append-only fact-store pattern
typed refs
explicit Replay clock
Evidence partition
no-future-leakage
stable hashing utilities
```

## 12. Deliverables and changed-file boundary

Allowed changes are limited to:

```text
docs/digital_twin/mcft/**
fixtures/mcft/reality_binding/**
scripts/governance_acceptance/ACCEPTANCE_MCFT_00_REALITY_BINDING_CONTRACT.cjs
docs/digital_twin/GEOX-DIGITAL-TWIN-CAPABILITY-MATRIX.json
```

No server, web, judge, migration, route, Runtime source, estimator, projection, seed application, package, lockfile, or workflow changes are permitted.

## 13. Completion

MCFT-00 closes only after the MCFT-00 Gate, all 63 negative fixtures, predecessor regressions, changed-file boundary, clean worktree, and final CI pass on final bytes.

The only successor is:

```text
MCFT-01 — Canonical Replay Dataset
```
