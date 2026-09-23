# GEOX Product API — Production Dependency Reconciliation V1

status: IMPLEMENTED_CANDIDATE  
date: 2026-09-23  
baseline_protected_main: 993758a3630ce27092f7176725a43cc3cb95f422  
target_database: geox_mcft_cap09_production_runtime_v1

## Purpose

The canonical Product API Wave-02 builder reads customer field identity from
`public.field_index_v1` using the exact tuple:

`tenant_id + project_id + group_id + field_id`.

The production operational database already contained exact source facts for
`tenant_mcft_external / project_mcft_cap09 / group_public_research / field_kbs_mcse_t4r1`,
but its long-lived `field_index_v1` schema predated the project/group compatibility
columns and contained no customer field identity row.

This reconciliation closes only that production dependency gap.

## Boundaries

Allowed:

- add `field_index_v1.project_id`;
- add `field_index_v1.group_id`;
- add a Product lookup index;
- materialize a non-authoritative field identity row only when existing production
  facts establish exactly one project/group tuple for a tenant/field pair.

Forbidden:

- invent field display metadata;
- create or infer an MCFT active lineage;
- create or infer an MCFT posterior state;
- copy an old Formal V4 Twin root into production;
- treat Evidence facts as Product-owned authority;
- alter MCFT Evidence/Twin writer ownership or scheduler semantics.

## Current production observation

At reconciliation time the operational database contained 224 facts and exactly
one distinct customer scope for the target field. The Product identity materialization
therefore has one unambiguous source tuple.

The operational database still has no active Twin lineage and no state-history rows.
The Product API must surface that condition as unavailable rather than fabricate
current field condition state.

## Files

- `apps/server/db/migrations/2026_09_23_product_api_field_scope_compat_v1.sql`
- `scripts/runtime_acceptance/RUN_PRODUCT_API_PRODUCTION_FIELD_SCOPE_RECONCILIATION_V1.cjs`

The runtime reconciliation runner is operator-armed and hard-binds the production
database identity. It fails closed on ambiguous field scope.
