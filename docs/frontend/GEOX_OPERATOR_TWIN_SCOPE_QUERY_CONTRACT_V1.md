# GEOX Operator Twin Scope Query Contract v1

## Purpose

Operator Twin frontend pages must pass tenant/project/group scope into the read-only Operator Twin APIs when the scope is available from URL query parameters.

This complements backend scope enforcement. Backend must not scan all tenants. Frontend must make scope visibility explicit.

## Supported query keys

- `tenant_id`
- `project_id`
- `group_id`

## Supported pages

- `/operator/twin?tenant_id=...&project_id=...&group_id=...`
- `/operator/twin/fields/:fieldId?tenant_id=...&project_id=...&group_id=...`

## Required behavior

The frontend API client must append supported scope keys to:

- `GET /api/v1/operator/twin`
- `GET /api/v1/operator/twin/fields/:field_id`

The overview page must preserve the active query scope when linking into a field workspace.

Both overview and workspace pages must render the backend `scope_policy`, including:

- `scope_applied`
- `missing_reason`
- `accepted_scope_keys`

## Boundary

Frontend scope query support must not create any write path.

It must not submit recommendations, approve, dispatch, or create AO-ACT tasks.
