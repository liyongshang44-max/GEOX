# API Route Inventory

Status: P0-A API governance baseline / Base Contract v2  
Scope: backend API routes that can affect customer pages, operator workbench, official `/api/v1/*` contracts, legacy compatibility, admin/debug/internal surfaces, and release audit  
Primary code inventory: `apps/server/src/routes/api_route_inventory_v1.ts`  
Primary contract reference: `docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md`  
Error envelope reference: `docs/contracts/v2/GEOX_STANDARD_ERROR_ENVELOPE_V2.md`

## Purpose

This inventory prevents API, adapter, fallback, document, and route drift.

Every new or materially changed official `/api/v1/*` route must have an inventory entry in `apps/server/src/routes/api_route_inventory_v1.ts` with the following fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `owner` | yes | Owning service/module accountable for the API. |
| `audience` | yes | `customer`, `operator`, `admin`, `internal`, `legacy`, or `system`. |
| `boundary` | yes | `official`, `compat`, `debug`, or `internal`. |
| `source_model` | yes | Primary backend model/projection/fact source. |
| `auth_scope` | yes | Required role/scope/auth contract. Use `public_contract_read` or `system_health` only when intentional. |
| `error_model` | yes | `GEOX_STANDARD_ERROR_ENVELOPE_V2`, `LEGACY_COMPAT`, `FASTIFY_DEFAULT`, or `SYSTEM_HEALTH`. |
| `contract_ref` | yes | Governance/domain contract document. |
| `gate_maturity` | yes | `ci_enforced`, `release_gate_candidate`, `inventory_baseline`, `legacy_exempt`, or `debug_exempt`. |

The inventory is an engineering governance baseline. It does not claim every listed route has complete business correctness, CI enforcement, or commercial readiness. `gate_maturity` is the required field that distinguishes inventory coverage from runtime enforcement.

## API governance rules

1. Customer official APIs are the only preferred data sources for customer-visible pages and exports.
2. Customer fallback APIs may remain temporarily for compatibility, but must not become a second source of truth for customer pages.
3. Operator read-only APIs may aggregate backend state, but must not invent action readiness locally.
4. Operator write APIs must return a documented action/error shape and must write audit evidence for handled attempts.
5. Legacy APIs are compatibility layers only. New frontend work must not depend on them.
6. Admin/debug/internal APIs are not customer-facing and must not leak secrets, local file paths, stack traces, internal object-store paths, or debug JSON into customer responses.
7. Any customer export route must use the same data source as the corresponding customer page.
8. New or materially changed official `/api/v1/*` routes must update both `api_route_inventory_v1.ts` and OpenAPI, or be classified as `inventory_baseline` with an explicit gate warning.

---

## Base Contract v2 required inventory fields

The source of truth for route inventory fields is code, not this markdown table:

```text
apps/server/src/routes/api_route_inventory_v1.ts
```

A compliant official route entry must include:

```ts
{
  owner: "reporting-service",
  audience: "customer",
  boundary: "official",
  source_model: "operation_report_v1",
  auth_scope: "summary",
  error_model: "GEOX_STANDARD_ERROR_ENVELOPE_V2",
  contract_ref: "docs/contracts/v2/REPORTING_AND_CUSTOMER_API_CONTRACT_V2.md",
  gate_maturity: "release_gate_candidate"
}
```

Allowed `gate_maturity` values:

| Value | Meaning |
| --- | --- |
| `ci_enforced` | Covered by strict OpenAPI/self-check or a dedicated CI gate. |
| `release_gate_candidate` | Required for release gate, but may still be under transition. |
| `inventory_baseline` | Inventory exists; gaps must be surfaced as warnings or future tasks. |
| `legacy_exempt` | Legacy compatibility surface. Must not be a new frontend dependency. |
| `debug_exempt` | Debug/devtools/internal route. Must be feature/admin-gated and non-customer. |

---

## Customer official API

Preferred APIs for customer-visible pages and exports:

- `/api/v1/customer/reports`
- `/api/v1/customer/fields`
- `/api/v1/customer/fields/:fieldId/geometry`
- `/api/v1/customer/operations`
- `/api/v1/reports/field/:field_id`
- `/api/v1/reports/operation/:operation_id`

Rules:

- Must use customer-safe data and guarded projections.
- Must not expose raw fact payloads, local file paths, MinIO/S3 internal paths, credentials, tokens, stack traces, or unfiltered debug JSON.
- Must declare `contract_ref` to the reporting/customer contract.
- Must declare `error_model` and `gate_maturity`.

## Customer fallback API

Fallback/transitional APIs include customer dashboard aggregate/portfolio summaries. These may remain only when explicitly marked as fallback or transitional in inventory and frontend VM logic.

Rules:

- New `/customer/*` work should prefer `/api/v1/customer/*` or `/api/v1/reports/*` official APIs.
- If a fallback API is used, the frontend VM must preserve fallback labeling and avoid presenting fallback data as stronger than it is.
- Fallback APIs must not be deleted until all frontend adapters, exports, smoke tests, and documentation references are updated.

## Operator API

Operator APIs include workbench read facades and write-action endpoints.

Rules:

- Read-only operator APIs may expose operational status and permission reasons, but must not create frontend-only action states.
- Operator write APIs must keep backend-owned status transitions, permission checks, and audit facts.
- Operator write APIs must not let frontend directly write `final_status`, `acceptance.status`, dispatch state, or approval state without backend validation and audit.

## Device runtime transitional API

`POST /api/v1/devices/:device_id/heartbeat` is currently an acceptance-compatible device-status projection route.

Inventory row:

| field | value |
| --- | --- |
| route | `POST /api/v1/devices/:device_id/heartbeat` |
| owner | `device-runtime` |
| audience | `device/executor/internal` |
| boundary | `device-status-projection` |
| source_model | `device credential + device registry target; body scope transitional` |
| auth_scope | `device credential / future device.heartbeat.write` |
| current_maturity | `transitional` |
| contract_ref | `docs/contracts/v2/DEVICE_HEARTBEAT_AUTH_CONTRACT_V2.md` |
| customer_visible | `false` |
| formal_chain_effect | `updates device_status_index only; does not directly create acceptance/report/ROI/memory` |
| gate_maturity | `inventory_baseline` |

Rules:

- Current body-scope fallback is transitional and exists for local/CI smoke compatibility.
- Production heartbeat scope must be derived from authenticated device credential and registered device binding.
- The route must not directly create acceptance, customer report conclusions, ROI, or Field Memory.
- Future enforcement belongs to `scripts/governance_acceptance/ACCEPTANCE_DEVICE_HEARTBEAT_SCOPE_AUTH_V1.cjs`.

## Legacy API

Legacy APIs are compatibility surfaces registered through legacy modules. New frontend code must not depend on these endpoints.

Examples:

- `/api/control/*`
- old approval compatibility routes
- old device compatibility routes
- old sense compatibility routes

Rules:

- Legacy routes must not be referenced by new customer or operator frontend code.
- Legacy routes should carry compatibility/deprecation semantics where supported.
- Removing a legacy API requires checking scripts, docs, smoke tests, OpenAPI, and frontend adapters.

## Admin / debug / internal API

Admin/debug/internal APIs are not customer-facing.

Rules:

- Must not be called directly by customer-facing VMs unless explicitly customer-sanitized.
- Debug endpoints must not leak stack traces, environment variables, tokens, secrets, or raw credential payloads.
- Devtools/simulator/Flight Table routes must stay feature/admin gated and must not produce formal customer projection evidence.

## Update requirement

Any PR that adds, removes, or changes these API categories must update this file and `apps/server/src/routes/api_route_inventory_v1.ts` before merge:

- customer official API
- customer fallback API
- operator read-only API
- operator write API
- official domain `/api/v1/*` API
- legacy API
- admin/debug/internal API

If an API is promoted from fallback to official, the PR must also update the corresponding frontend adapter, OpenAPI, and release audit notes.
