# GEOX FOUI-0 — Current-Main Frontend Reconciliation

Status: AUDIT / PRODUCT-SURFACE FREEZE CANDIDATE
Base protected main: d054b334b3e74f3356b5d02498da9ba845eccdfb
Working branch: work/foui-field-operations-reconciliation-v1

## 0. Purpose

FOUI-0 reconciles the current frontend repository with the accepted FOUI Wave-01 projection contracts before any new product implementation.

FOUI-0 is not Wave-02 construction, not high-fidelity redesign, not a broad React rewrite, and not an authority change.

Allowed scope:

~~~
apps/web/**
docs/frontend-productization/**
docs/product_projection/**
scripts/frontend_acceptance/**
frontend fixtures/tests where later explicitly needed
~~~

Forbidden in FOUI-0:

~~~
apps/server authority semantics
MCFT runtime / CAP-09
ADR construction
B-Line authority logic
database migrations
production runtime/workflows
Outcome authority construction
~~~

No FOUI-0 work may merge to protected main while the current MCFT Formal-v5 production-chain freeze remains in force.

## 1. Source-of-truth order used by this audit

Current code wins over historical frontend documents.

1. apps/web/src/app/App.tsx
2. apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
3. apps/web/src/app/routes/fieldsRoutes.tsx
4. apps/web/src/app/routes/customerOperationsRoutes.tsx
5. apps/web/src/layouts/OperatorLayout.tsx
6. apps/web/src/layouts/CustomerLayout.tsx
7. docs/frontend-productization/PFE-14-ROUTE-OWNERSHIP.json
8. docs/product_projection/GEOX-FOUI-PROJECTION-CONTRACT-WAVE-01-V1.md
9. apps/server/src/product_projection/contracts/product_projection_source_binding_registry_v1.ts

Historical H/PFE documents are evidence of prior intent and acceptance, but they do not override current route ownership.

## 2. Current route facts

### 2.1 Formal operator Field Runtime

Current canonical operator field runtime is:

~~~
/operator/fields/*
→ apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx
→ apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx
→ apps/web/src/api/mcftFieldTwinRuntime.ts
~~~

It is GET-only and six-key scoped.

Current canonical tabs include overview, state, forecast, scenario, action-lifecycle, residual, calibration, evidence-trace, health, evidence alias and audit alias.

This family is REUSE. It is not to be replaced by the older /operator/twin/fields/* family.

### 2.2 Old twin route family

The following remain reachable for compatibility but are not the current canonical field route owner:

~~~
/operator/twin/fields/:fieldId
/operator/twin/fields/:fieldId/forecast
/operator/twin/fields/:fieldId/scenarios
/operator/twin/fields/:fieldId/evidence
/operator/twin/fields/:fieldId/calibration
/operator/twin/fields/:fieldId/post-irrigation
/operator/twin/traces/:decisionCycleId
~~~

PFE-14 already classifies this family as legacy / URL-only compatibility.

FOUI-0 decision:

~~~
route ownership = LEGACY
product capability inside = mine for reusable presentation/view-model ideas only
revive as canonical route = FORBIDDEN
delete now = FORBIDDEN
~~~

### 2.3 Operator execution pages

The repository still contains absolute routes for:

~~~
/operator/workbench
/operator/approvals
/operator/dispatch
/operator/acceptance
/operator/evidence
/operator/devices-alerts
/operator/roi-ledger
/operator/field-memory
~~~

They are injected through the older renderOperatorRoutes() path and remain reachable.

However, the current formal OperatorLayout navigation exposes only Overview and Fields.

Therefore reachability does not equal current formal product-surface status.

### 2.4 Customer product surface

Current customer shell already owns formal read-only reporting routes:

~~~
/customer/dashboard
/customer/fields
/customer/fields/:fieldId
/customer/operations
/customer/operations/:operationId
/customer/reports
/customer/export
~~~

These are REUSE / targeted REFACTOR surfaces, not replacement targets.

### 2.5 Admin surface

Current Admin Console is an internal governance/readback surface. It remains separate from the Field Operations product workflow and must not be collapsed into FOUI operator pages.

## 3. Current page / capability classification

Classification vocabulary:

~~~
REUSE
REFACTOR
LEGACY
REMOVE-LATER
NEW-REQUIRED
HOLD
~~~

| Current route / capability | Current owner | FOUI-0 class | Decision |
|---|---|---:|---|
| /operator/fields/* | canonical Field Runtime route/page/client | REUSE | Keep canonical route ownership and exact MCFT scope semantics. |
| /operator/twin | OperatorTwinOverviewPage | REFACTOR | Useful runtime overview substrate, but engineering-console framing must not define future Home. |
| old /operator/twin/fields/* | legacy twin pages | LEGACY | URL-only compatibility. Do not re-promote. |
| /operator/workbench | OperatorWorkbenchPage | LEGACY / REFACTOR-CAPABILITY | Mine aggregation concepts; do not make this route the new Home. |
| /operator/approvals | OperatorApprovalsPage | REFACTOR-CAPABILITY | Approval UI capability is useful; future command remains B-Line owned and reauthorized. |
| /operator/dispatch | OperatorDispatchPage | REFACTOR-CAPABILITY | Execution visibility/action capability can feed Operations; route is not automatically formal FOUI. |
| /operator/acceptance | OperatorAcceptancePage | REFACTOR-CAPABILITY | Use execution-evidence acceptance semantics only; never promote to operation/outcome success. |
| /operator/evidence | OperatorEvidencePage | REFACTOR-CAPABILITY | Candidate substrate for Evidence surface after projection/runtime contract permits it. |
| /operator/devices-alerts | OperatorDevicesAlertsPage | REFACTOR / LATER | Split operational attention from device/admin concepts before product promotion. |
| /operator/roi-ledger | OperatorRoiLedgerPage | LEGACY / HOLD | Do not use as Outcome authority or primary FOUI chain. |
| /operator/field-memory | OperatorFieldMemoryPage | LEGACY / HOLD | Long-term learning substrate is not current Outcome authority. |
| Customer Portal routes | CustomerLayout + report pages | REUSE | Preserve customer-visible reporting and exports. |
| Admin routes | AdminLayout + admin pages | REUSE | Preserve governance/readback separation. |
| FOUI Home | none | NEW-REQUIRED | Requires AttentionQueueProjection runtime before implementation. |
| FOUI Operations | fragmented legacy pages | NEW-REQUIRED / REFACTOR | Compose governed action lifecycle; do not copy legacy route taxonomy. |
| FOUI Action Case | none as canonical product aggregate | NEW-REQUIRED | Must be projection-only; never persisted aggregate root. |
| FOUI Decisions | no formal ADR product surface | NEW-REQUIRED / PREVIEW | Requires ADR projection construction; no current-state substitution. |
| FOUI Evidence | fragmented | NEW-REQUIRED / REFACTOR | Must preserve execution-evidence boundary. |
| FOUI Outcomes | no authority-backed projection | HOLD | No OutcomeProjection runtime until separate authority contract. |

## 4. Existing product capability that should be reused

### 4.1 Field reality

McftCanonicalFieldRuntimeRoutePage already exposes exact MCFT runtime refs, content hashes, current state collections, forecast/scenario pointers, action lifecycle attachments, evidence trace, health and governance readback.

FOUI should progressively present these facts more product-appropriately; it must not replace the canonical source or recompute MCFT.

### 4.2 Approval

OperatorApprovalsPage and its view model already contain approval-request presentation and caller action gating.

Reusable: approval request presentation, permission/loading/error states, technical source references and explicit action gating.

Not reusable as product authority: route existence, button visibility or client-side writeReady.

All future Approve actions must still call the B-Line command boundary, which reauthenticates and reauthorizes.

### 4.3 Evidence chain

evidenceTwinAdapter.ts already recognizes a decomposed sequence containing recommendation, approval, operation plan, AO-ACT task, AsExecuted, evidence, acceptance and verification nodes.

This is useful product-composition substrate only. It is not permission to infer missing refs or invent exact cross-domain linkage.

### 4.4 Customer reports

Field and operation reports already contain customer-facing evidence and decision context. They are delivery/reporting surfaces, not the source of authority for FOUI projections.

## 5. Field Operations target information architecture

Target IA remains stable even when release surfaces are unavailable:

~~~
Home
Fields
Decisions
Operations
Evidence
Outcomes
Reports
Administration
~~~

Target IA is not a statement that every page is currently enabled.

| Target surface | Current release interpretation |
|---|---|
| Home | NEW-REQUIRED; blocked on AttentionQueueProjection runtime |
| Fields | progressively available from canonical MCFT Field Runtime |
| Decisions | PREVIEW target; blocked on ADR projection/runtime construction |
| Operations | productization candidate from B-Line substrate; projection runtime required |
| Evidence | productization candidate; preserve exact execution-evidence semantics |
| Outcomes | HOLD |
| Reports | reuse Customer Portal reporting surface |
| Administration | reuse Admin Console; not merged into operator workflow |

## 6. Canonical Field Operations workflow model

FOUI product composition uses:

~~~
Field State
→ Decision
→ Approval
→ Execution
→ Receipt
→ Evidence
→ Outcome
~~~

Permanent decompositions remain:

~~~
Decision != Approval
Approval != Execution Authorization
Task != Dispatch
Dispatch != Execution
Receipt != AsExecuted
AsExecuted != Evidence Artifact
Evidence Acceptance != Operation Success
Outcome Observation != Causal Effect
~~~

FOUI must show gaps explicitly rather than collapsing missing steps.

## 7. Construction boundary after FOUI-0

FOUI-0 itself does not authorize implementation.

A later CTO authorization may permit narrow construction of read-only product projection builders, read-only authority/basis readers, GET product projection routes, projection fixtures/tests and interaction-hint adapters.

Still not authorized by FOUI-0: high-fidelity redesign, broad React rewrite, backend authority changes, MCFT / ADR / B-Line recomputation, database writes, Outcome promotion or main merge during the current MCFT freeze.

## 8. FOUI-0 completion statement

FOUI-0 may claim only:

~~~
The current frontend has been reconciled against current-main route ownership and Wave-01 projection contracts. Existing customer/operator/admin capabilities are classified for reuse, refactor, legacy retention, later removal, new construction, or hold. Missing product data is registered as projection/API gaps rather than inferred by the UI.
~~~
