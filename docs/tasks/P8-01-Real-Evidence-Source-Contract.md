# docs/tasks/P8-01-Real-Evidence-Source-Contract.md

## Purpose

P8-01 defines where real evidence is read from, how it is adapted, and which fields are valid for P8 real-evidence replay.

This task does not implement a state estimator. It freezes the source contract that P8-02 must use to build the first real evidence window from the local Postgres database.

## Gate

```text
P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
```

## Entry conditions

```text
previous_gate = P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING
previous_doc = docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md
previous_acceptance = scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs
previous_next_step = P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
```

## Source priority

```text
primary_source = raw_samples
secondary_source = existing_source_index_or_read_model_if_available
forbidden_source = demo_seed_or_synthetic_fixture_or_manual_placeholder_actuals_or_frontend_state
```

## Real evidence source kinds

```text
raw_samples
existing_source_index
read_model_projection
```

## Forbidden sources

```text
demo_seed
synthetic_fixture
manual_placeholder_actuals
frontend_state
```

## Adapter output fields

```text
project_id
sensor_id
sensor_group_id
metric_ref
metric_kind
ts_ms
observed_at
value
unit
source_ref
raw_sample_ref
```

## Adapter compatibility rules

```text
raw_samples_schema_may_have_sample_id_or_fact_id = true
adapter_must_not_change_db_schema = true
adapter_must_not_backfill_missing_columns = true
adapter_may_derive_project_id_from_sensor_groups = true
adapter_may_derive_sensor_group_id_from_sensor_group_members = true
adapter_may_derive_metric_kind_from_metric_ref = true
adapter_may_derive_observed_at_from_ts_ms = true
adapter_may_derive_unit_from_metric_kind = true
```

## Read-only query rules

```text
query_must_use_read_only_transaction = true
query_must_select_from_raw_samples_first = true
query_must_filter_project_id = P_DEFAULT
query_must_filter_sensor_group_id = G_CAF
query_must_filter_sensor_id = CAF009
query_must_filter_metric_kind = soil_moisture
query_must_filter_window_start_ts = true
query_must_filter_window_end_ts = true
query_must_order_by_ts_metric_ref_sample_ref = true
query_must_not_mutate_database = true
```

## Source traceability rules

```text
every_point_must_include_source_ref = true
every_point_must_include_raw_sample_ref = true
every_window_must_include_source_query_ref = true
every_window_must_include_evidence_refs = true
every_window_must_include_trace_refs = true
every_window_must_include_provenance_ref = true
```

## Synthetic and placeholder evidence rejection rules

```text
synthetic_payload_flag_must_not_be_true
placeholder_sample_payload_flag_must_not_be_true
interpolated_payload_flag_must_not_be_true
fixture_fallback_must_not_exist
```

## No schema or seed changes

```text
no_db_schema_change = true
no_seed_change = true
no_demo_seed_change = true
no_raw_sample_backfill = true
```

## Changed files allowed in P8-01

```text
docs/tasks/P8-01-Real-Evidence-Source-Contract.md
scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs
```

## Directories forbidden in P8-01

```text
apps/web/
apps/server/
apps/executor/
packages/
db/
migrations/
scripts/twin_kernel/
scripts/demo_seed/
scripts/runtime/
```

## Acceptance command

```powershell
node scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs
```

## Expected result

```text
ok = true
acceptance = P8_01_REAL_EVIDENCE_SOURCE_CONTRACT
p8_00_verified = true
real_evidence_source_kind_count = 3
required_field_count = 11
forbidden_source_count = 4
read_only_query_rule_count = 10
source_traceability_rule_count = 6
no_db_schema_change = true
no_seed_change = true
next_step = P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
```

## Next step

```text
P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0
```
