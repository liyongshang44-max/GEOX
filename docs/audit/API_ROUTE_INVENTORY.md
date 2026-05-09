# API Route Inventory

Status: P2-H2 API audit baseline  
Scope: backend API routes that can affect customer pages, operator workbench, legacy compatibility, admin/debug/internal surfaces, and release audit  
Primary registration sources: `apps/server/src/app.ts`, `apps/server/src/modules/domain/registerDomainModules.ts`, `apps/server/src/routes/registerCoreV1Routes.ts`, `apps/server/src/modules/operator/registerOperatorModule.ts`, `apps/server/src/routes/registerLegacyRoutes.ts`, `apps/server/src/modules/admin/registerAdminModule.ts`

## Purpose

This inventory prevents API, adapter, fallback, document, and route drift after P2.

Every API route family listed below must have:

- category
- owner
- source module / route file
- frontend consumer
- release status
- deletion / consolidation rule

Any PR that adds, removes, redirects, or changes a route used by `/customer/*`, `/operator/*`, `/admin/*`, or `/legacy/*` must update this file in the same PR.

## API governance rules

1. Customer official APIs are the only preferred data sources for customer-visible pages and exports.
2. Customer fallback APIs may remain temporarily for compatibility, but must not become a second source of truth for customer pages.
3. Operator read-only APIs may aggregate backend state, but must not invent action readiness locally.
4. Operator write APIs must return the standard Operator action response shape and must write audit evidence for handled attempts.
5. Legacy APIs are compatibility layers only. New frontend work must not depend on them.
6. Admin/debug/internal APIs are not customer-facing and must not leak secrets, local file paths, stack traces, internal object-store paths, or debug JSON into customer responses.
7. Any customer export route must use the same data source as the corresponding customer page.

---

## Category 1: Customer official API

These are the preferred APIs for customer-visible pages and customer exports.

| API route | Method | Owner | Source module / file | Frontend consumer | Release status | Delete / consolidate rule |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/v1/customer/reports` | GET | Customer Product | `routes/customer_v1.ts` via Reporting module | Customer report list / customer landing capability list | Official | Do not delete. |
| `/api/v1/customer/fields` | GET | Customer Product | `routes/customer_v1.ts` via Reporting module | `/customer/fields` | Official | Do not delete. |
| `/api/v1/customer/fields/:fieldId/geometry` | GET | Customer Product | `routes/customer_v1.ts` via Reporting module | Customer field map / field geometry view | Official | Do not delete while field map exists. |
| `/api/v1/customer/operations` | GET | Customer Product | `routes/customer_v1.ts` via Reporting module | `/customer/operations` | Official | Do not delete. |
| `/api/v1/reports/field/:field_id` | GET | Customer Product / Reporting | `routes/reports_v1.ts` via Reporting module | `/customer/fields/:fieldId` and field export | Official | Do not delete. Must remain same-source with export. |
| `/api/v1/reports/operation/:operation_id` | GET | Customer Product / Reporting | `routes/reports_v1.ts` via Reporting module | `/customer/operations/:operationId` and operation export | Official | Do not delete. Must remain same-source with export. |

### Customer official API rules

- Customer official API responses must be customer-safe.
- They must not expose raw fact payloads, local file paths, MinIO/S3 internal paths, credentials, tokens, stack traces, or unfiltered debug JSON.
- Customer pages must not combine official customer APIs with fallback APIs unless the page VM explicitly labels the fallback path.

---

## Category 2: Customer fallback API

These APIs may still be used by older adapters or limited fallback VMs. They must not become the primary customer source of truth unless explicitly promoted by a later governance task.

| API route | Method | Owner | Source module / file | Frontend consumer | Release status | Delete / consolidate rule |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/v1/reports/customer-dashboard/aggregate` | GET | Reporting / Customer Product | `routes/reports_dashboard_v1.ts` | Customer dashboard fallback / aggregate VM paths | Fallback / transitional | Candidate for consolidation into official customer dashboard API. |
| `/api/v1/reports/customer-dashboard/field-portfolio-summary` | GET | Reporting / Customer Product | `routes/reports_dashboard_v1.ts` | Field portfolio / dashboard summary fallback | Fallback / transitional | Candidate for consolidation. |
| `/api/v1/dashboard` and dashboard summary variants | GET | Reporting / Dashboard | `routes/dashboard_v1.ts` if present in current build | Older dashboard adapters | Fallback / transitional | Must not be used by new customer pages without audit. |

### Customer fallback API rules

- New `/customer/*` work should prefer `/api/v1/customer/*` or `/api/v1/reports/*` official APIs.
- If a fallback API is used, the frontend VM must preserve fallback labeling and avoid presenting fallback data as stronger than it is.
- Fallback APIs must not be deleted until all frontend adapters, exports, smoke tests, and documentation references are updated.

---

## Category 3: Operator read-only API

These APIs power the operator workbench and read-only operational surfaces. They may aggregate projections, tables, or facts, but they must not mutate backend state.

| API route | Method | Owner | Source module / file | Frontend consumer | Release status | Delete / consolidate rule |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/v1/operator/workbench` | GET | Operator Workbench | `routes/v1/operator.ts` | `/operator/workbench` | Official operator read facade | Do not delete. |
| `/api/v1/operator/approvals` | GET | Operator Workbench / Approval | `routes/v1/operator_approval_read.ts` | `/operator/approvals` | Official operator read facade | Do not delete while approval actions exist. |
| `/api/v1/operator/dispatch/worklist` | GET | Operator Workbench / Dispatch | `routes/v1/operator_dispatch_actions.ts` | `/operator/dispatch` | Official operator read facade | Do not delete while dispatch/retry actions exist. |
| `/api/v1/operator/acceptance/worklist` | GET | Operator Workbench / Acceptance | `routes/v1/operator_acceptance_actions.ts` | `/operator/acceptance` | Official operator read facade | Do not delete while acceptance actions exist. |
| `/api/v1/operator/evidence` | GET | Operator Workbench / Evidence | `routes/v1/operator.ts` | `/operator/evidence` | Official operator read facade | Do not delete. |
| `/api/v1/operator/devices-alerts` | GET | Operator Workbench / Device + Alert Ops | `routes/v1/operator.ts` | `/operator/devices-alerts` | Official operator read facade | Do not delete. |
| `/api/v1/operator/roi-ledger` | GET | Operator Workbench / ROI | `routes/v1/operator.ts` | `/operator/roi-ledger` | Official operator read facade | Do not delete. |
| `/api/v1/operator/field-memory` | GET | Operator Workbench / Field Memory | `routes/v1/operator.ts` | `/operator/field-memory` | Official operator read facade | Do not delete. |
| `/api/v1/actions/index` | GET | Execution / AO-ACT | `routes/v1/ao_act.ts` or AO-ACT core registration | Operator fallback only | Fallback for operator dispatch | Candidate after operator worklist is fully adopted. |

### Operator read-only API rules

- Read-only operator APIs may expose operational status and permission reasons, but they must not create frontend-only action states.
- If an operator page falls back to a non-operator API, the frontend must label the fallback state and disable write buttons.
- Operator read APIs must sanitize internal paths and secret-like fields.

---

## Category 4: Operator write API

These APIs are write-action endpoints introduced or formalized in P2-C. They must use backend state, backend permission checks, standard errors, and audit facts.

| API route | Method | Owner | Source module / file | Frontend consumer | Release status | Delete / consolidate rule |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/v1/operator/approvals/:approvalRequestId/approve` | POST | Operator Workbench / Approval | `routes/v1/operator_approval_actions.ts` | `/operator/approvals` | Official operator write API | Do not delete. Must remain facade over approval chain. |
| `/api/v1/operator/approvals/:approvalRequestId/reject` | POST | Operator Workbench / Approval | `routes/v1/operator_approval_actions.ts` | `/operator/approvals` | Official operator write API | Do not delete until main approval reject route exists and facade is migrated. |
| `/api/v1/operator/approvals/:approvalRequestId/return` | POST | Operator Workbench / Approval | `routes/v1/operator_approval_actions.ts` | `/operator/approvals` | Official operator write API | Do not delete until main approval return route exists and facade is migrated. |
| `/api/v1/operator/acceptance/:operationId/evaluate` | POST | Operator Workbench / Acceptance | `routes/v1/operator_acceptance_actions.ts` | `/operator/acceptance` | Official operator write API | Do not delete. Must resolve through backend operation_state / acceptance. |
| `/api/v1/operator/acceptance/:operationId/request-review` | POST | Operator Workbench / Acceptance | `routes/v1/operator_acceptance_actions.ts` | `/operator/acceptance` | Official operator write API | Do not delete. Must keep review queue semantics backend-owned. |
| `/api/v1/operator/dispatch/:taskId/dispatch` | POST | Operator Workbench / Dispatch | `routes/v1/operator_dispatch_actions.ts` | `/operator/dispatch` | Official operator write API | Do not delete. Must act only on AO-ACT task. |
| `/api/v1/operator/dispatch/:taskId/retry` | POST | Operator Workbench / Dispatch | `routes/v1/operator_dispatch_actions.ts` | `/operator/dispatch` | Official operator write API | Do not delete. Must keep retry state precondition backend-owned. |

### Operator write API rules

All operator write APIs must return the standard Operator action response shape:

```json
{
  "ok": true,
  "action_id": "...",
  "audit_id": "...",
  "action_type": "...",
  "target_type": "...",
  "target_id": "...",
  "status_before": null,
  "status_after": null,
  "permission": {
    "allowed": true,
    "role": "operator",
    "reason": null
  },
  "message": "...",
  "updated_at": "..."
}
```

Accepted error codes:

- `AUTH_MISSING`
- `FORBIDDEN`
- `ACTION_NOT_READY`
- `INVALID_STATE`
- `SELF_APPROVAL_BLOCKED`
- `TARGET_NOT_FOUND`
- `EVIDENCE_INSUFFICIENT`
- `AUDIT_WRITE_FAILED`
- `STATE_WRITE_FAILED`

Write APIs must not let the frontend directly write `final_status`, `acceptance.status`, dispatch state, or approval state without backend validation and audit.

---

## Category 5: Legacy API

Legacy APIs are compatibility surfaces registered through `registerLegacyRoutes`. New frontend code must not depend on these endpoints.

| API route family | Method | Owner | Source module / file | Frontend consumer | Release status | Delete / consolidate rule |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/control/*` | Mixed | Compatibility / AO-ACT legacy | `routes/legacy/ao_act.ts` and related legacy modules | Legacy scripts / old clients | Legacy compatibility | Candidate after all scripts use `/api/v1/actions/*`. |
| `/api/control/approvals*` or old approval compatibility routes | Mixed | Compatibility / Approval legacy | `routes/legacy/approvals.ts` | Legacy approval pages / scripts | Legacy compatibility | Candidate after `/operator/approvals` is sole UI path. |
| `/api/devices/*` old device compatibility routes | Mixed | Compatibility / Device legacy | `routes/legacy/devices.ts` | Old device onboarding scripts | Legacy compatibility | Candidate after all device scripts use `/api/v1/devices/*`. |
| `/api/sense/*` or older sense compatibility routes | Mixed | Compatibility / Sense legacy | `routes/legacy/sense.ts` | Old sensing scripts | Legacy compatibility | Candidate after all sensing scripts use `/api/v1/sense/*`. |
| Legacy monitoring / media support APIs | Mixed | Compatibility / Legacy monitoring | `modules/legacy/registerLegacyMonitoringModule.ts` | Internal support / old dashboards | Legacy compatibility | Candidate after support tooling is moved. |

### Legacy API rules

- Legacy APIs must not be referenced by new customer or operator frontend code.
- Legacy APIs should carry compatibility/deprecation semantics where supported.
- Removing a legacy API requires checking scripts, docs, smoke tests, OpenAPI, and frontend adapters.

---

## Category 6: Admin / debug / internal API

These APIs are internal operational or administrative surfaces. They are not customer-facing.

| API route family | Method | Owner | Source module / file | Frontend consumer | Release status | Delete / consolidate rule |
| --- | --- | --- | --- | --- | --- | --- |
| `/health` | GET | Runtime / Admin | `modules/admin/registerAdminModule.ts` | Health checks | Internal health | Do not delete. |
| `/api/health` | GET | Runtime / Admin | `modules/admin/registerAdminModule.ts` | Compatibility health checks | Internal health | Do not delete while acceptance scripts use it. |
| `/api/admin/healthz` | GET | Admin / Runtime Governance | `modules/admin/registerAdminModule.ts` | Admin health page / deployment checks | Internal admin | Do not delete. |
| `/api/admin/import*` | Mixed | Admin Import | `modules/admin/registerAdminImportModule.ts` | Admin import page | Internal admin | Needs review before deletion. |
| `/api/admin/groups*` | Mixed | Admin Groups | `modules/admin/registerAdminGroupsModule.ts` | Admin/group support tooling | Internal admin | Needs review before deletion. |
| `/api/v1/security-audit*` | Mixed | Security / Admin | `routes/security_audit_v1.ts` | Admin/security audit tooling | Internal admin | Do not expose to customer pages. |
| `/api/v1/fail-safe*` | Mixed | Safety / Admin | `routes/fail_safe_v1.ts` | Admin/safety tooling | Internal admin | Do not expose to customer pages. |
| `/api/v1/openapi.json` and OpenAPI variants | GET | API Governance | OpenAPI module / `routes/openapi_v1.ts` | Contract tooling | Internal/contract | Do not delete. |
| Devtools APIs | Mixed | Engineering Support | Devtools module | `/legacy/dev` or engineering support | Debug/internal | Candidate after support tooling is consolidated. |
| Judge config / run / record APIs | Mixed | Judge / Engineering Support | Judge module and legacy judge routes | Legacy judge pages | Debug/internal | Candidate unless formalized as operator/agronomy diagnostic API. |
| Simulation config APIs | Mixed | Engineering Support | `routes/sim_config.ts` | Legacy simulation page | Debug/internal | Candidate. |
| Static media / acceptance artifact routes | GET | Runtime / Evidence | Static module | Report/evidence display | Internal support, customer-safe only through sanitized references | Must not expose local file paths or secret storage URLs. |

### Admin / debug / internal API rules

- These APIs must not be called directly by customer-facing VMs unless explicitly customer-sanitized.
- Debug endpoints must not leak stack traces, environment variables, tokens, secrets, or raw credential payloads.
- Health endpoints may return missing schema information, but should not expose credentials or connection strings.

---

## Core v1 domain API registration map

The domain module registers the following route groups. This section maps ownership, not every individual endpoint.

| Route group | Owner | Registration source | Status | Notes |
| --- | --- | --- | --- | --- |
| `/api/v1/actions/*` | AO-ACT / Execution | `routes/registerCoreV1Routes.ts` -> `routes/v1/ao_act.ts` | Official internal domain API | Operator dispatch facade must use AO-ACT task semantics, not UI state. |
| `/api/v1/approvals/*` | Approval | `routes/registerCoreV1Routes.ts` -> `routes/v1/approvals.ts` | Official internal domain API | Operator approval approve is a controlled facade over this chain where available. |
| `/api/v1/devices/*` | Device Ops | `routes/registerCoreV1Routes.ts` -> `routes/v1/devices.ts` plus device module routes | Official internal/domain API | Customer pages must consume sanitized summaries only. |
| `/api/v1/sense/*` | Sensing | `routes/registerCoreV1Routes.ts` -> `routes/v1/sense.ts` plus sensing module routes | Official internal/domain API | Raw sensing ingestion is not a customer UI source. |
| `/api/v1/fields/*` | Field Ops | Field module / `routes/fields_v1.ts` | Official internal/domain API | Customer field pages should use customer/report APIs, not raw admin field APIs. |
| `/api/v1/alerts/*` | Alert Ops | Alert routes / execution module | Official internal/domain API | Customer pages should only receive customer-safe risk summaries. |
| `/api/v1/acceptance/*` | Acceptance | Acceptance module | Official internal/domain API | Operator acceptance facade must keep status backend-owned. |
| `/api/v1/evidence*` | Evidence | Evidence module / evidence export modules | Official internal/domain API | Must sanitize storage and path fields before customer use. |
| `/api/v1/agronomy*` | Agronomy | Agronomy module | Official internal/domain API | Not customer-facing unless mediated by customer/report view models. |
| `/api/v1/prescriptions*` | Prescription | Prescription module | Official internal/domain API | Not customer-facing as raw prescription payload. |
| `/api/v1/roi*` | ROI Ledger | ROI module | Official internal/domain API | Customer value summary must be sanitized and report-owned. |
| `/api/v1/field-memory*` | Field Memory | Field memory module | Official internal/domain API | Customer memory presentation must be report-owned and summarized. |

---

## Release audit findings

1. Customer official APIs now have a clear boundary: `/api/v1/customer/*` plus `/api/v1/reports/field/*` and `/api/v1/reports/operation/*`.
2. `/api/v1/reports/customer-dashboard/aggregate` remains a fallback/transitional customer API. It should not become a second source of truth for pages and exports.
3. Operator APIs are now split into read-only worklist/facade routes and write-action routes.
4. Operator write APIs must keep the C0 action contract: `action_id`, `audit_id`, permission object, standard error codes, and backend-owned status transitions.
5. Legacy APIs remain registered through compatibility modules. New frontend code must not call them.
6. Admin/debug/internal APIs remain necessary for deployment and support, but must stay out of customer-facing adapters.

## Update requirement

Any PR that adds, removes, or changes these API categories must update this file before merge:

- customer official API
- customer fallback API
- operator read-only API
- operator write API
- legacy API
- admin/debug/internal API

If an API is promoted from fallback to official, the PR must also update the corresponding frontend adapter and release audit notes.
