# GEOX Product Data Contract Succession V1

```text
document_id: GEOX-PRODUCT-DATA-CONTRACT-SUCCESSION-V1
status: READY_FOR_PROTECTED_MAIN_ADOPTION
baseline_main_sha: 6ff48eca10c1d25365c39f9d1e4dbb14d6c1ad91
date: 2026-09-22
scope: FRONTEND_PRODUCT_DATA_CONTRACT_GOVERNANCE
domain_authority: NONE
runtime_behavior_change: NONE
database_schema_change: NONE
production_database_mutation: NONE
```

## 0. Adjudication

This artifact closes the frontend/product-data succession question for new GEOX product construction.

The repository contains two distinct product-contract generations:

```text
HISTORICAL P1/P2 CUSTOMER PRODUCT CONTRACTS
/api/v1/customer/*
/api/v1/reports/*
/api/v1/fields/portfolio

and

FOUI PRODUCT PROJECTION
apps/server/src/product_projection/contracts/*
docs/product_projection/GEOX-FOUI-PROJECTION-CONTRACT-WAVE-01-V1.md
```

They are not equivalent.

The P1/P2 Customer APIs remain compatibility-era product interfaces for existing consumers. They are not the canonical contract for new GEOX product construction.

For every new Customer, Operator, Admin, Sites, React, or other product consumer created after adoption of this artifact:

```text
CANONICAL PRODUCT READ CONTRACT
= FOUI Product Projection

CANONICAL PRODUCT API NAMESPACE
= /api/product/v1/*

CANONICAL BUSINESS PERSISTENCE
= existing GEOX PostgreSQL architecture
```

No second GEOX business database is introduced by this decision.

## 1. Authority and data-path hierarchy

The permanent hierarchy is:

```text
DOMAIN AUTHORITY
MCFT / ADR / B-Line / Outcome
        |
        v
authority-owned facts / state / decisions / receipts
        |
        v
FOUI PRODUCT PROJECTION
non-authoritative composition/read model
        |
        v
PRODUCT UI
Customer / Operator / Admin / Sites / React
```

The direction is one-way for authority semantics:

```text
DOMAIN AUTHORITY > PRODUCT PROJECTION > PRODUCT UI
```

A lower layer may not manufacture, promote, or reinterpret authority owned by a higher layer.

## 2. Persistence decision

GEOX product construction continues to use the existing PostgreSQL architecture.

```text
PostgreSQL
= canonical GEOX business persistence direction

Sites D1 or equivalent host-local storage
!= MCFT authority store
!= ADR authority store
!= B-Line authority store
!= Outcome authority store
!= canonical GEOX product-projection store by default
```

A hosting platform may later use local storage for explicitly governed non-authoritative UI preferences, drafts, cache metadata, or temporary upload state. Such use requires its own scope and must not create a second source of product truth.

The current server database access remains the established `pg` / `DATABASE_URL` architecture. This governance artifact does not change credentials, roles, migrations, schemas, runtime owners, or production database state.

## 3. Canonical Product Projection boundary

FOUI Product Projection remains non-authoritative.

Every canonical projection must preserve the existing permanent ceiling:

```text
authority_ceiling
= NON_AUTHORITATIVE_PRODUCT_PROJECTION_ONLY

non_authoritative
= true
```

FOUI Product Projection:

```text
!= MCFT authority
!= ADR authority
!= B-Line authority
!= Outcome authority
!= command authorization
```

The existing Wave-01 contracts remain the starting machine contract:

- `ProductProjectionEnvelopeV1`
- `GovernedActionCaseProjectionV1`
- `CapabilityAvailabilityProjectionV1`
- `AttentionQueueProjectionV1`

Subsequent contract waves may add the customer/product read models required by the Canonical Frontend Blueprint, including field, operation, evidence, decision-time, and outcome projections. New contracts must extend the FOUI authority ceiling rather than revive P1/P2 Customer DTO semantics.

## 4. Canonical API namespace

All new product-projection read APIs use:

```text
/api/product/v1/*
```

Target product read surface:

```text
GET /api/product/v1/overview

GET /api/product/v1/fields
GET /api/product/v1/fields/:fieldRef

GET /api/product/v1/attention

GET /api/product/v1/operations
GET /api/product/v1/operations/:operationRef

GET /api/product/v1/action-cases/:caseRef

GET /api/product/v1/evidence/:subjectType/:subjectRef

GET /api/product/v1/decision-time/:decisionRef

GET /api/product/v1/capabilities
```

This list is a namespace and ownership settlement. A route does not become implemented or production-qualified merely because it is listed here.

FOUI projection APIs remain read-only:

```text
GET / HEAD
```

The following remain forbidden under the projection namespace:

```text
POST / PUT / PATCH / DELETE
```

Commands, if later exposed in the product, must go to the owning domain command boundary and must re-authenticate/re-authorize there.

## 5. Legacy API classification

### 5.1 P1/P2 Customer APIs

```text
/api/v1/customer/fields
= LEGACY_ACTIVE_READ

/api/v1/customer/operations
= LEGACY_ACTIVE_READ

/api/v1/customer/reports
= LEGACY_ACTIVE_READ
```

Policy:

```text
existing compatibility consumer
= allowed to remain during migration

new product consumer
= forbidden

new product semantics on legacy route
= forbidden
```

### 5.2 Confirmed twin summary

```text
/api/v1/customer/fields/:field_id/confirmed-twin-summary
= LEGACY_DO_NOT_ADOPT
```

Reason:

The historical implementation contains customer-facing fallback/default semantics when exact source values are absent. Those historical defaults must not be inherited by the new product contract.

New FOUI behavior is fail-closed:

```text
missing authority-backed value
-> null / UNAVAILABLE / explicit limitation

not
-> plausible business default
```

### 5.3 Field portfolio

```text
/api/v1/fields/portfolio
= PRE_FOUI_LEGACY_PROJECTION
```

The historical route includes product-owned risk filtering/sorting vocabulary. New FOUI product construction must not use this route as the source for canonical Customer Fields, Attention, or Field Workspace semantics.

### 5.4 Historical report APIs

```text
/api/v1/reports/customer-dashboard/aggregate
= LEGACY_FALLBACK

/api/v1/reports/field/:fieldId
= LEGACY_REPORT

/api/v1/reports/operation/:operationId
= LEGACY_REPORT
```

They may remain for existing UI compatibility and controlled migration. They are not the final Product Projection API.

## 6. No permanent legacy-wrapper architecture

A temporary migration adapter may translate a legacy response while a canonical projection builder is being completed.

It must not become the final architecture.

Forbidden final shape:

```text
/api/product/v1/fields
  -> /api/v1/customer/fields
  -> historical Customer DTO
```

Required final shape:

```text
authority-backed source readers
  -> Product Projection Builder
  -> validator
  -> /api/product/v1/*
```

The Product Projection Builder must use exact source bindings and the FOUI source-binding registry where applicable. It may not treat another presentation API as authority.

## 7. Product null / unknown semantics

New Product Projection contracts must preserve absence.

```text
no Condition
-> null / UNAVAILABLE

no Action Case
-> []

no Operation
-> []

no Outcome
-> []

no Attribution
-> NOT_ESTABLISHED

no Attention Item
-> []
```

None of these may be promoted by the UI to:

```text
healthy
safe
no action needed
no effect
successful
effective
physically verified
```

unless the corresponding source authority explicitly establishes that meaning.

## 8. Risk, severity, recommendation, and status discipline

The product layer must not invent:

- field risk score;
- severity;
- recommendation;
- approval;
- authorization;
- dispatch;
- execution truth;
- evidence acceptance;
- outcome;
- attribution.

A source-declared severity may be displayed only when bound to its exact source reference.

Attention triage may use the FOUI product vocabulary such as `triage_bucket`, `attention_reason_code`, `blocking_state`, `presentation_rank`, and `sort_reason_code`. Presentation ordering is not authority.

## 9. Current world, historical replay, and decision-time world

Permanent invariant:

```text
CURRENT_PROJECTION
!= HISTORICAL_REPLAY
!= DECISION_TIME_SNAPSHOT
```

The existing Wave-01 rule remains mandatory:

```text
current_state_substitution_forbidden = true
```

If decision-time basis cannot be reconstructed exactly, the Product Projection must report partial/unavailable history. Current MCFT state must not be substituted into the historical decision explanation.

## 10. New consumer policy

After adoption, every new product consumer must use the canonical Product Projection contract.

This includes:

- ChatGPT Sites product applications;
- new React Customer Portal work;
- new Operator product surfaces;
- new Admin product surfaces;
- future mobile or alternate-host clients.

New consumers must not bind directly to:

```text
/api/v1/customer/*
/api/v1/reports/*
/api/v1/fields/portfolio
```

except in an explicitly bounded migration adapter with a retirement condition.

The current Sites Customer Portal test therefore remains mock-only until the minimal canonical Product API required by that test is available. Its first real-data integration should start directly with `/api/product/v1/*`.

## 11. Legacy lifecycle

Legacy product interfaces move only through these states:

```text
LEGACY_ACTIVE_READ
  -> DEPRECATED
  -> EMERGENCY_COMPAT_ONLY
  -> REMOVED
```

A legacy surface may advance only when:

1. a canonical successor exists;
2. canonical consumers have migrated;
3. relevant contract/acceptance checks pass;
4. no canonical product consumer remains;
5. rollback evidence is documented.

No direct `ACTIVE -> REMOVED` transition is allowed.

`LEGACY_DO_NOT_ADOPT` and `PRE_FOUI_LEGACY_PROJECTION` are stronger construction prohibitions: they may remain reachable for historical consumers, but new product code must not create new dependencies on them.

## 12. Historical document disposition

The following documents remain repository provenance but are superseded for new product construction:

```text
docs/frontend/P2_CUSTOMER_API_CONTRACT.md
docs/frontend/CUSTOMER_DATA_SOURCE_MAP_V1.md
docs/frontend/FALLBACK_RETIREMENT_PLAN.md
docs/frontend/CUSTOMER_FRONTEND_GAP_BASELINE_V1.md
```

Their historical use of terms such as `OFFICIAL_CUSTOMER_API` remains valid within the P1/P2 generation only.

It does not mean those APIs are the canonical contract for post-FOUI product construction.

Do not delete the documents. Mark them as historical, retain them for migration provenance, and stop extending them with new product semantics.

## 13. Adoption implementation scope

The adoption PR for this governance artifact is deliberately non-behavioral.

Allowed:

- canonical blueprint amendment;
- succession policy document and machine manifest;
- lifecycle headers on historical frontend documents;
- source comments marking legacy routes/adapters;
- governance acceptance script/workflow.

Forbidden in the same adoption PR:

- MCFT runtime changes;
- ADR/B-Line runtime changes;
- production database mutation;
- schema migration;
- new Product API implementation;
- legacy route behavior changes;
- route deletion;
- existing consumer rewrites.

This keeps governance adoption independently reviewable and safe to merge after protected-main movement is permitted.

## 14. Next construction after adoption

The next narrow implementation unit is Product Projection construction, not another legacy Customer API extension.

First useful vertical slice:

```text
FieldSummaryProjectionV1
FieldWorkspaceProjectionV1

GET /api/product/v1/fields
GET /api/product/v1/fields/:fieldRef
```

Construction requirements:

- PostgreSQL remains the persistence layer;
- authority/basis source readers are read-only;
- projection builders are non-authoritative;
- exact source refs and limitations are retained;
- no schema mutation is required merely to expose the read projection;
- no product-owned risk/severity/recommendation inference;
- acceptance and negative tests precede Sites real-data binding.

Only after this canonical path exists should the Sites Customer Portal replace its synthetic mock adapter with the real Product API.

## 15. Adoption statement

After protected-main adoption, the allowed statement is:

```text
All new GEOX product frontend construction consumes FOUI Product Projection
through /api/product/v1/*.

The pre-FOUI /api/v1/customer/*, /api/v1/reports/*, and
/api/v1/fields/portfolio surfaces are compatibility-era contracts and
must not acquire new product consumers.
```

This artifact does not claim that the target Product API routes already exist, that broad FOUI construction is production-qualified, or that any domain authority has changed.
