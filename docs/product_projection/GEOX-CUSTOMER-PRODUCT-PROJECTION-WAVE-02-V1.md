# GEOX Customer Product Projection — Wave 02 V1

```text
document_id: GEOX-CUSTOMER-PRODUCT-PROJECTION-WAVE-02-V1
status: IMPLEMENTATION_CANDIDATE
baseline_main_sha: cb60164646de3d90f6ec8bcd8f74bba5cc673652
scope: FIRST_REAL_CUSTOMER_PRODUCT_API_SLICE
authority: NONE
database_schema_change: NONE
production_database_mutation: NONE
```

## 0. Purpose

This wave implements the first real-data Customer Product Projection successor authorized by
`GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1`.

It is deliberately narrow:

```text
CustomerOverviewProjectionV1
FieldSummaryProjectionV1
FieldWorkspaceProjectionV1

GET /api/product/v1/overview
GET /api/product/v1/fields
GET /api/product/v1/fields/:fieldRef
```

The interfaces read the existing GEOX PostgreSQL database and consume canonical MCFT Runtime state
where an exact field-level scope can be proven.

They do not use the historical Customer presentation APIs as an intermediate layer.

## 1. Physical data path

```text
existing PostgreSQL
  |
  +-- public.field_index_v1
  +-- public.field_season_index_v1
  +-- public.twin_active_lineage_index_v1
  +-- public.facts
  |
  +-- canonical PostgresMcftFieldTwinReadApiV1
          |
          v
Customer Product Projection Builder
          |
          v
/api/product/v1/*
```

No D1 database, new PostgreSQL table, migration, role, ACL, bootstrap mutation, or projection writer is
introduced by this wave.

## 2. Authentication and scope

The first slice is a Customer contract.

The route accepts only an authenticated `client` principal.

Scope is derived server-side from:

```text
tenant_id
project_id
group_id
allowed_field_ids
```

in the authenticated principal.

Query parameters may not provide or broaden tenant/project/group/field scope.

A detail request for a field outside `allowed_field_ids` is returned as `NOT_FOUND`.

This wave does not generalize Customer Product contracts to Operator/Admin callers.

## 3. Field identity

Field identity is read from `public.field_index_v1` and is explicitly non-authority basis metadata.

A unique `ACTIVE` row from `public.field_season_index_v1` may enrich display crop/season metadata.

A unique ACTIVE season is an explicit non-authority scope-selection basis. It may narrow historical
MCFT Runtime scope rows to that season, but it does not alter or mint MCFT authority and it never
resolves multiple zones by itself.

If season metadata is missing or ambiguous, the builder may use MCFT only when exactly one Runtime
scope remains across the field; reporting is then LIMITED. If the ACTIVE season and Runtime scopes
disagree, Product reporting fails closed rather than repairing the mismatch by inference.

## 4. Current Field Condition

A Field-level current condition is exposed only when:

1. the authenticated field maps to exactly one row in `public.twin_active_lineage_index_v1` for the
   authenticated tenant/project/group;
2. `PostgresMcftFieldTwinReadApiV1.readRuntime` returns `COMPLETE_EXACT_GRAPH`;
3. the Runtime `posterior_state` has exact object ref/hash/source fact ref;
4. the referenced canonical fact exists exactly once;
5. canonical object type/ref/hash/six-key scope match the Runtime reference.

If any condition fails:

```text
current_condition
= null

reporting_state
= LIMITED or UNAVAILABLE

limitation reason
= explicit
```

No current state is synthesized.

The non-authoritative season index may constrain scope selection only when its ACTIVE season is unique.
The selected Field condition remains the exact MCFT posterior state and retains its exact source ref/hash.

## 5. Customer-visible state payload

The first current-condition payload exposes only exact source-derived values:

```text
root_zone_storage_mm_mean
root_zone_vwc_fraction_mean
available_water_fraction
depletion_from_field_capacity_mm
confidence_status
```

It does not translate those numbers into:

```text
high risk
low risk
severe
healthy
recommendation
action required
safe
successful
```

`summary` is intentionally null until a governed customer-safe condition summarization contract exists.

## 6. Deliberately unavailable domains

Wave 02 V1 does not pretend that all Customer product objects already exist.

These remain explicit `UNAVAILABLE` / `LIMITED` collections:

- Attention;
- recent operations;
- Action Cases;
- recent changes;
- detailed Field Condition Evidence;
- Execution Evidence;
- Outcome;
- Attribution;
- full history;
- geometry;
- reports;
- capability productization.

An empty collection from an unavailable domain must not be interpreted as:

```text
no risk
no action needed
no operation
no outcome
healthy
safe
```

## 7. Overview

`CustomerOverviewProjectionV1` composes only governed child Field projections.

Its reporting counts are deterministic counts of the returned Field projections.

Attention, operations, and reports remain explicit unavailable collections in this first slice.

The Overview does not calculate a risk leaderboard, severity score, or customer priority.

## 8. Product API response envelope

All three routes return:

```text
ok
request_id
generated_at
schema_version = geox.product-api.v1
derivation_version = geox.customer-product-projection.derivation.v1
data
```

Failures return a customer-safe code/message/retryable envelope.

Raw database errors are not returned to the client.

Responses use `Cache-Control: no-store` in this first current-state slice.

## 9. Source binding

The Product Projection source-binding registry adds only these roles:

```text
FIELD_IDENTITY_BASIS
FIELD_SEASON_BASIS
FIELD_CURRENT_STATE
```

Bindings:

```text
public.field_index_v1
-> non-authority identity basis

public.field_season_index_v1
-> non-authority season/display basis

MCFT Runtime posterior_state
-> MCFT authority ref
```

The Product Projection remains:

```text
authority_ceiling
= NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY

non_authoritative
= true
```

## 10. MCFT-sensitive-path disposition

This wave intentionally does not modify:

```text
apps/server/db/migrations/**
apps/server/src/external_evidence/**
apps/server/src/persistence/external_evidence/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
package.json
pnpm-lock.yaml
database/platform bootstrap
database roles / ACL
MCFT workflows
```

The only shared server registration change is mounting a new read-only Product module.

The dedicated CI gate compares the PR against its base and fails if the implementation escapes the
approved Product Projection scope.

## 11. Sites handoff boundary

After this implementation is merged, Sites may replace:

```text
MockProductDataSource
```

with:

```text
ApiProductDataSource
```

for exactly these routes:

```text
GET /api/product/v1/overview
GET /api/product/v1/fields
GET /api/product/v1/fields/:fieldRef
```

Sites must not add fallback calls to historical Customer/report/portfolio APIs.

The Site server-side session or scoped read-only Customer principal is a deployment concern and is not
embedded into browser source.
