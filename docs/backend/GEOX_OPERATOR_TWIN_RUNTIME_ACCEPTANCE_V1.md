# GEOX Operator Twin Runtime Acceptance v1

## Purpose

This acceptance verifies the Operator Twin read API through real HTTP requests.

It complements source-level governance acceptance. Source checks prevent obvious write-path regressions. Runtime checks verify that the API response contract is actually observable when the server is running.

## Script

`scripts/runtime_acceptance/ACCEPTANCE_OPERATOR_TWIN_READ_API_RUNTIME_V1.cjs`

## Environment

Defaults:

- `GEOX_BASE_URL=http://127.0.0.1:3000`
- `GEOX_TENANT_ID=T_ACCEPTANCE`
- `GEOX_PROJECT_ID=P_DEFAULT`
- `GEOX_GROUP_ID=G_CAF`
- `GEOX_FIELD_ID=field_c8_demo`

The script expects the GEOX server to already be running.

## Checked routes

- `GET /api/v1/operator/twin`
- `GET /api/v1/operator/twin?tenant_id=...&project_id=...&group_id=...`
- `GET /api/v1/operator/twin/fields/:field_id`
- `GET /api/v1/operator/twin/fields/:field_id?tenant_id=...&project_id=...&group_id=...`

## Required runtime behavior

When no tenant/project/group scope is provided:

- API must return `ok = true`
- `scope_policy.scope_applied = false`
- overview `fields = []`

When scope is provided:

- `scope_policy.scope_applied = true`
- `request_scope.tenantId` or `request_scope.tenant_id` must match the request
- write flags must remain false

When scenario evidence is unavailable:

- `scenario_comparison.status = "NOT_AVAILABLE"`
- `scenario_comparison.options = []`
- `scenario_comparison.no_action_baseline_present = false`
- `scenario_comparison.unavailable_reason = "IRRIGATION_SCENARIO_SET_MISSING"`

## Boundary

This acceptance must not create facts, recommendations, approvals, dispatches, AO-ACT tasks, receipts, or execution records.
