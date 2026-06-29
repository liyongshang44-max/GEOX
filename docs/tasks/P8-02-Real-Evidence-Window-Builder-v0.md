# docs/tasks/P8-02-Real-Evidence-Window-Builder-v0.md

## Purpose

P8-02 implements the first P8 runtime that reads real evidence from the local Postgres database and emits a deterministic read-only `real_evidence_window_v0` object.

This is the first material break from P7 fixture-only runtime. P8-02 must not read P7 fixture JSON as evidence and must not use a fallback sample pack.

## Gate

```text
P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
```

## Entry conditions

```text
previous_gate = P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
previous_doc = docs/tasks/P8-01-Real-Evidence-Source-Contract.md
previous_acceptance = scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs
previous_next_step = P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
```

## Runtime files created in P8-02

```text
scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
docs/tasks/P8-02-Real-Evidence-Window-Builder-v0.md
```

## Default replay scope

```text
project_id = P_DEFAULT
sensor_group_id = G_CAF
sensor_id = CAF009
metric_kind = soil_moisture
window_start_ts = 2009-06-09T00:00:00.000Z
window_end_ts = 2009-06-09T04:00:00.000Z
expected_interval_ms = 3600000
```

## Runtime command

```powershell
node scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
```

## Runtime environment

```text
DATABASE_URL = postgres://postgres:postgres@127.0.0.1:5432/geox
P8_PROJECT_ID = P_DEFAULT
P8_SENSOR_GROUP_ID = G_CAF
P8_SENSOR_ID = CAF009
P8_METRIC_KIND = soil_moisture
P8_WINDOW_START_TS = 2009-06-09T00:00:00.000Z
P8_WINDOW_END_TS = 2009-06-09T04:00:00.000Z
P8_EXPECTED_INTERVAL_MS = 3600000
```

## Output object kind

```text
real_evidence_window_v0
```

## Required output fields

```text
real_evidence_window_id
output_kind
project_id
subject_ref
sensor_ref
sensor_group_ref
metric_kind
window_start_ts
window_end_ts
sample_count
metric_count
metric_refs
coverage_summary
evidence_points
evidence_refs
source_query_ref
trace_refs
provenance_ref
read_only
determinism_hash
```

## Source query requirements

```text
source_table = raw_samples
source_group_table = sensor_groups
source_membership_table = sensor_group_members
query_filters_project_id = true
query_filters_sensor_group_id = true
query_filters_sensor_id = true
query_filters_metric_kind = true
query_filters_window_start_ts = true
query_filters_window_end_ts = true
query_orders_by_ts_metric_sample_ref = true
query_uses_read_only_transaction = true
```

## Runtime strict prohibitions

```text
no_fixture_fallback
no_demo_seed_read
no_synthetic_fallback
no_database_mutation
no_schema_change
no_seed_change
no_fact_write
no_field_memory_write
no_model_write
no_execution_object
no_frontend_change
no_server_route
```

## Determinism requirements

```text
same_query_same_output = true
stable_sort_by_ts_metric_ref_raw_sample_ref = true
stable_json_hash = true
source_query_ref_excludes_database_secret = true
determinism_hash_is_sha256 = true
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
```

## Expected result

```text
ok = true
acceptance = P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
p8_01_verified = true
db_connected = true
raw_samples_target_window_verified = true
real_evidence_window_verified = true
sample_count_positive = true
metric_count_at_least_one = true
evidence_refs_non_empty = true
source_query_ref_present = true
determinism_stable = true
read_only = true
changed_file_count = 3
next_step = P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
```

## Next step

```text
P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT
```
