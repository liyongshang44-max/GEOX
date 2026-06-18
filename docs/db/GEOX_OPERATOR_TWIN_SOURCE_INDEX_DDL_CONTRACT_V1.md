# GEOX Operator Twin Source Index DDL Contract v1

## Purpose

Operator Twin read APIs depend on scoped source index tables.

This document freezes the minimum DDL contract required by:

- GET /api/v1/operator/twin
- GET /api/v1/operator/twin/fields/:field_id

This is not a migration. It is a schema contract for future migrations, seeds, projections, and acceptance fixtures.

## Scope invariant

Every Operator Twin source index table must include at least:

- tenant_id
- project_id
- group_id
- field_id

The API must never scan these index tables without tenant/project/group scope.

The field workspace must additionally constrain reads by field_id.

## Required source indexes

### field_index_v1

Minimum columns:

- tenant_id
- field_id
- project_id
- group_id
- name
- field_name
- crop
- area_ha
- status
- created_ts_ms
- updated_ts_ms
- updated_at

Keys:

- PRIMARY KEY (tenant_id, field_id)
- UNIQUE (tenant_id, project_id, group_id, field_id)

Purpose: canonical field projection used by existing field write/read routes and Operator Twin scoped reads.

Compatibility note: field_index_v1 is an existing write-path projection. The field routes upsert on ON CONFLICT (tenant_id, field_id) and write name, area_ha, status, created_ts_ms, and updated_ts_ms. Operator Twin adds project_id and group_id as scope columns with default values for legacy/mainline field writes.

### water_state_estimate_index_v1

Minimum columns:

- tenant_id
- project_id
- group_id
- field_id
- water_state
- confidence_level
- confidence_score
- evidence_refs_json
- computed_at

Purpose: current water-state estimate projection.

### soil_moisture_sensing_window_index_v1

Minimum columns:

- tenant_id
- project_id
- group_id
- field_id
- window_id
- device_id
- metric
- window_start
- window_end
- expected_interval_ms
- expected_points
- actual_points
- coverage_ratio
- max_gap_ms
- quality_status
- confidence_json
- summary_json
- config_snapshot_json
- evidence_refs_json
- source_fact_ids_json
- source_observation_ids_json
- source_fact_id
- created_at
- updated_at

Purpose: scoped sensing-window evidence for water-state estimation.

Important: this table follows the existing H12 sensing-window projection helper. Downstream preflight and runtime readers use window_id, quality_status, and source_fact_id.
### weather_forecast_index_v1

Minimum columns:

- tenant_id
- project_id
- group_id
- field_id
- forecast_id
- forecast_horizon
- provider
- evidence_refs_json
- generated_at

Purpose: scoped weather forecast version reference.

### irrigation_scenario_set_index_v1

Minimum columns:

- tenant_id
- project_id
- group_id
- field_id
- scenario_set_id
- options_json
- evidence_refs_json
- generated_at

Purpose: irrigation scenario comparison evidence.

Important: no scenario row means no synthetic no_action baseline and no default irrigation options.

### decision_recommendation_index_v1

Minimum columns:

- tenant_id
- project_id
- group_id
- field_id
- recommendation_id
- suggested_action_json
- action_type
- amount_mm
- evidence_refs_json
- generated_at

Purpose: recommendation candidate evidence.

Important: suggested_action_json may be the source of action_type and amount_mm.

## Contract boundary

These source indexes are read projections.

They must not be used as:

- approval records
- AO-ACT tasks
- dispatch instructions
- execution receipts
- effectiveness claims
- customer-facing reports

Operator Twin can display evidence and candidate actions. It cannot execute them.
