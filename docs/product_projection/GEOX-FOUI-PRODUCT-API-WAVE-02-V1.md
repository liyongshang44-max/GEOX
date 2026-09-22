# GEOX FOUI Product API — Wave-02 V1

document_id: GEOX-FOUI-PRODUCT-API-WAVE-02-V1  
status: IMPLEMENTED_CANDIDATE  
baseline_protected_main: cb60164646de3d90f6ec8bcd8f74bba5cc673652  
scope: CUSTOMER_OVERVIEW_FIELD_SUMMARY_FIELD_WORKSPACE_READ_ONLY  
date: 2026-09-23

## 0. Purpose

Wave-02 is the first real post-P1/P2 Product Projection vertical slice.

It implements CustomerOverviewProjectionV1, FieldSummaryProjectionV1, and FieldWorkspaceProjectionV1.

Canonical routes:

- GET /api/product/v1/overview
- GET /api/product/v1/fields
- GET /api/product/v1/fields/:fieldRef

The routes are read-only and non-authoritative.

## 1. Data path

PostgreSQL -> public.field_index_v1 -> public.twin_active_lineage_index_v1 -> canonical MCFT CAP-07 S4 read model -> exact current posterior state -> public.twin_state_history_projection_v1 -> PostgresCustomerProductProjectionBuilderV1 -> /api/product/v1/* -> Sites / Product UI.

No legacy Customer presentation API is used as a source.

Forbidden source dependencies:

- /api/v1/customer/*
- /api/v1/reports/*
- /api/v1/fields/portfolio

## 2. Authority boundary

Permanent:

authority_ceiling = NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY

projection_semantics = CURRENT_PROJECTION

Wave-02 does not calculate or mint MCFT state, risk, severity, recommendation, approval, execution authorization, dispatch, execution truth, evidence acceptance, Outcome, or Attribution.

The Product Projection reads an already-canonical MCFT posterior state and exposes only source-backed state values.

## 3. Field identity source

Customer-safe field identity uses the bounded subset of public.field_index_v1.

Current Wave-02 fields are field identifier, display name when present, area in hectares when present, and source update timestamp for non-authority row versioning.

The Field Index reference is explicitly a non-authority Product Projection source.

Missing display metadata remains null/unavailable. The API does not expose a raw identifier as a fabricated customer display name.

Farm, crop, crop stage, season display metadata and geometry are not projected in this wave. Their absence is explicit in limitation reason codes.

## 4. Current field condition source

Wave-02 resolves current MCFT state only when one exact field-level Runtime scope exists for the caller's exact tenant, project, group, and field.

If exactly one active season_id + zone_id Runtime scope exists, the builder calls the canonical MCFT CAP-07 S4 Runtime read model and requires root_graph_status = COMPLETE_EXACT_GRAPH plus exact posterior_state and active_lineage canonical refs/hashes/facts.

The state payload is then read from public.twin_state_history_projection_v1 by the exact validated state ref and must match both determinism_hash and source_fact_id.

No latest-row heuristic is used after the canonical Runtime has selected the current state.

## 5. No unauthorized field aggregation

If a field has more than one active Runtime scope across seasons/zones, Wave-02 does not select one by timestamp and does not average or aggregate them.

It returns reporting_state = LIMITED and current_condition = LIMITED with reason FIELD_LEVEL_RUNTIME_SCOPE_AMBIGUOUS_NO_AGGREGATION_AUTHORITY.

A later field-level aggregation contract must be separately governed.

## 6. Exposed condition values

Wave-02 exposes only canonical state payload values that are already established:

- available_water_fraction
- depletion_from_field_capacity_mm
- root_zone_water_storage_mm.mean
- root_zone_water_storage_mm.stddev
- root_zone_water_storage_mm.interval_low
- root_zone_water_storage_mm.interval_high

The canonical source currently explicitly states water_stress_state = NOT_ESTABLISHED and confidence = NOT_ESTABLISHED. Wave-02 preserves those states.

It does not convert numerical water-state values into a new product-owned healthy, dry, high risk, irrigate, or similar judgment.

## 7. Reporting semantics

CURRENT in Wave-02 means the current canonical MCFT Runtime pointer resolved to one exact validated state.

It is not a wall-clock freshness claim.

Temporal freshness remains freshness.status = UNKNOWN, freshness.basis = UNESTABLISHED, reason = PRODUCT_TEMPORAL_FRESHNESS_POLICY_NOT_ESTABLISHED.

No browser or server wall-clock threshold is used to fabricate freshness.

## 8. Unimplemented domains remain unavailable

Attention Queue, recent Operations, Action Cases, execution evidence summary, Outcomes, Capability Availability binding, customer business History, and Reports are not silently approximated in Wave-02.

They return explicit UNAVAILABLE collection/state markers and limitation reason codes.

Attention unavailable does not mean no attention needed. Action cases unavailable does not mean no action needed. Outcomes unavailable does not mean no effect.

## 9. Authentication and scope

The Product API reuses server-side GEOX authentication and field-scope enforcement.

The caller scope is derived from the authenticated principal: tenant_id, project_id, group_id, allowed_field_ids, and role.

URL identifiers never grant access.

For a Customer/client principal, allowed_field_ids is required, an out-of-scope field returns 404, and write methods are not registered.

Browser database credentials and service-wide browser API tokens remain forbidden.

## 10. HTTP behavior

All three routes are GET-only.

Responses include schema_version = geox.product-api.response.v1, request_id, generated_at, derivation_version, ETag, X-GEOX-Product-Contract, and X-GEOX-Product-Authority-Ceiling.

ETag validation supports 304 without changing projection semantics.

Product read failures return a customer-safe error code and do not expose PostgreSQL diagnostics.

## 11. Database boundary

database migration = NONE

database DDL = NONE

database DML = NONE

new database = NONE

It uses SELECT/read-only dependencies only.

A dedicated production Product read principal/connection may be provisioned later if deployment topology requires separation from the existing server pool. That operational credential decision does not change this Product Projection contract and must not grant write authority.

## 12. Shared server dependency touch

The only shared startup registration change is apps/server/src/modules/domain/registerDomainModules.ts, which adds registerProductModule(app, pool).

No MCFT Runtime implementation file is modified.

Wave-02 does not modify apps/server/db/migrations/**, database/platform bootstrap, shared DB ACL, package.json, pnpm-lock.yaml, MCFT Runtime process, MCFT scheduler, or MCFT evidence acquisition.

## 13. Sites handoff condition

After protected-main adoption and deployment qualification, Sites may replace MockProductDataSource with ApiProductDataSource for exactly the three canonical GET routes.

Sites must not add legacy API fallback.

## 14. Nonclaims

Wave-02 does not claim complete GEOX Customer Portal functionality, full Attention/Operation/Action Case/Outcome productization, production identity-provider completion, Product API public deployment, Product database role provisioning, current temporal freshness policy, or field-level multi-zone state aggregation.
