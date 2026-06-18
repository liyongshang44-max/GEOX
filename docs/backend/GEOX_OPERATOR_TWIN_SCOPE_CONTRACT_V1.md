# GEOX Operator Twin Scope Contract v1

## Purpose

Operator Twin APIs are read-only workbench APIs for the Operator Twin Workbench surface.

They must never become cross-tenant discovery APIs, customer report APIs, approval APIs, dispatch APIs, or AO-ACT task creation APIs.

## Routes

- `GET /api/v1/operator/twin`
- `GET /api/v1/operator/twin/fields/:field_id`

## Required scope

Every index-table read must be constrained by at least one of:

- `tenant_id`
- `project_id`
- `group_id`

If no tenant/project/group scope is available, the API must return an empty scoped result instead of scanning all rows.

Field workspace reads must also constrain by:

- `field_id`

## Scoped index tables

The following index tables are treated as scoped sources:

- `field_index_v1`
- `water_state_estimate_index_v1`
- `soil_moisture_sensing_window_index_v1`
- `weather_forecast_index_v1`
- `irrigation_scenario_set_index_v1`
- `decision_recommendation_index_v1`

If a table does not expose any of `tenant_id`, `project_id`, or `group_id`, it must not be read by the Operator Twin API.

## Recommendation evidence

`decision_recommendation_index_v1` may store action details directly or inside `suggested_action_json`.

Operator Twin must parse `suggested_action_json` for:

- `action_type`
- `amount_mm`

The recommendation candidate is still only a candidate. It must not become approval or execution.

## Scenario evidence

`irrigation_scenario_set_index_v1` is the only source for scenario comparison.

If no scenario row exists, the API must return:

- `scenario_comparison.status = "NOT_AVAILABLE"`
- `scenario_comparison.no_action_baseline_present = false`
- `scenario_comparison.options = []`
- `scenario_comparison.unavailable_reason = "IRRIGATION_SCENARIO_SET_MISSING"`

The API must not synthesize default options such as `no_action`, `10mm`, `20mm`, `22mm`, or `delay_3d` without scenario evidence.

## Read-only boundary

Operator Twin APIs must not contain:

- `app.post`
- `app.put`
- `app.patch`
- `app.delete`
- `INSERT INTO`
- `UPDATE`
- `DELETE FROM`
- AO-ACT task creation
- approval mutation
- dispatch mutation

## Product boundary

Operator Twin is for analysis and human confirmation.

Customer sees confirmed reports.
Operator does scenario and forecast workbench review.
Admin governs runtime, devices, queues, evidence, and acceptance.
