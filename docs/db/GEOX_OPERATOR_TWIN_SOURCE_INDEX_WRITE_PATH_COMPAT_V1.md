# docs/db/GEOX_OPERATOR_TWIN_SOURCE_INDEX_WRITE_PATH_COMPAT_V1.md
# GEOX Operator Twin Source Index Write-Path Compatibility v1

## Purpose

This contract prevents Operator Twin source-index migrations from breaking existing write paths on a fresh database.

The migration file is not merely a read-model convenience. In CI and in new deployments, migrations run before runtime requests, seed scripts, or C8 formal-chain preflight. Therefore, any table created by the Operator Twin source-index migration becomes the actual table shape used by existing application writers.

## Scope

This gate applies to source-index tables that are both:

1. Read by Operator Twin.
2. Written or upserted by existing application/runtime/preflight code.

Current covered tables:

- field_index_v1
- soil_moisture_sensing_window_index_v1

## field_index_v1 compatibility

Existing field routes write to field_index_v1 and use:

- tenant_id
- field_id
- name
- area_ha
- status
- created_ts_ms
- updated_ts_ms

Existing conflict target:

- ON CONFLICT (tenant_id, field_id)

Therefore, field_index_v1 must preserve:

- PRIMARY KEY (tenant_id, field_id)
- name
- area_ha
- status
- created_ts_ms
- updated_ts_ms

Operator Twin scope columns may be added, but they must not break legacy field writes. Therefore:

- project_id must be NOT NULL with a default
- group_id must be NOT NULL with a default
- scoped uniqueness must be represented separately from the legacy write key

Required scoped uniqueness:

- UNIQUE (tenant_id, project_id, group_id, field_id)

## soil_moisture_sensing_window_index_v1 compatibility

Existing C8/formal-chain preflight and sensing-window helpers use runtime column names:

- window_id
- window_start
- window_end
- expected_interval_ms
- expected_points
- actual_points
- min_total_samples_required
- min_samples_per_required_metric
- coverage_ratio
- min_coverage_ratio
- max_gap_ms
- max_allowed_gap_ms
- gap_count
- quality_status
- source_fact_id
- source_fact_ids_json
- source_observation_ids_json

Existing conflict target:

- ON CONFLICT (tenant_id, window_id)

Therefore, soil_moisture_sensing_window_index_v1 must preserve:

- PRIMARY KEY (tenant_id, window_id)
- UNIQUE (tenant_id, project_id, group_id, field_id, window_id)

Forbidden drift names inside this table block:

- sensing_window_id
- window_start_at
- window_end_at

## Non-goals

This contract does not introduce recommendations, approvals, dispatch, AO-ACT tasks, receipts, execution records, or customer reports.
