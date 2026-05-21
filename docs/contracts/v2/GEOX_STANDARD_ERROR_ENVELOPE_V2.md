# GEOX Standard Error Envelope V2

Status: Proposed / Draft  
Contract family: Base Contract v2 / API Governance  
Owner: api-gateway  
Audience: backend, frontend, operator UI, customer report/export, release gate tooling  
gate_maturity: inventory_baseline  
contract_ref: docs/contracts/v2/API_GOVERNANCE_AND_OPENAPI_V2.md

## Purpose

GEOX Standard Error Envelope V2 defines the minimum error response shape expected from new or materially changed `/api/v1/*` official routes.

This document is a governance baseline. It does not claim that every existing endpoint is already migrated. It also does not claim RFC9457 compliance. RFC9457 alignment may be introduced later as a stricter API contract.

## Required envelope

New or materially changed official `/api/v1/*` routes should return errors in this shape:

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_SCOPE_DENIED",
    "message": "The token does not have the required scope.",
    "category": "AUTHORIZATION",
    "retryable": false,
    "target": {
      "type": "route",
      "id": "/api/v1/actions/task"
    },
    "details": {},
    "request_id": "req_...",
    "contract_ref": "docs/contracts/v2/GEOX_STANDARD_ERROR_ENVELOPE_V2.md"
  }
}
```

## Field contract

| Field | Required | Meaning |
| --- | --- | --- |
| `ok` | yes | Always `false` for error responses. |
| `error.code` | yes | Stable machine-readable error code. Must not be a raw exception message. |
| `error.message` | yes | Human-readable safe message. Must not leak stack traces, credentials, SQL, file paths, or raw object-store URLs. |
| `error.category` | yes | One of `AUTHENTICATION`, `AUTHORIZATION`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `STATE_PRECONDITION`, `EVIDENCE_INSUFFICIENT`, `RATE_LIMIT`, `INTERNAL`, `UPSTREAM`, `DISABLED`, `DEPRECATED`. |
| `error.retryable` | yes | Whether client retry may be useful without changing request state. |
| `error.target` | recommended | The route, resource, or domain object involved. |
| `error.details` | recommended | Sanitized structured details. No raw facts unless the route is internal/admin and explicitly documented. |
| `error.request_id` | recommended | Request correlation id when available. |
| `error.contract_ref` | yes for official `/api/v1/*` | Contract document governing the route or error class. |

## Accepted transitional shape

Existing routes may still return the older minimal shape during migration:

```json
{
  "ok": false,
  "error": "AUTH_SCOPE_DENIED"
}
```

This is accepted only when the API inventory marks the route with:

```text
error_model: LEGACY_COMPAT
```

or the route is system health / debug / legacy compatibility. New official routes should not use the transitional shape without an explicit `gate_maturity` reason.

## Standard categories

| Category | Typical codes |
| --- | --- |
| `AUTHENTICATION` | `AUTH_MISSING`, `AUTH_INVALID`, `AUTH_REVOKED` |
| `AUTHORIZATION` | `AUTH_SCOPE_DENIED`, `AUTH_ROLE_DENIED`, `AUTH_ROLE_SCOPE_DENIED` |
| `VALIDATION` | `INVALID_REQUEST`, `MISSING_FIELD`, `INVALID_FIELD`, `SCHEMA_VALIDATION_FAILED` |
| `NOT_FOUND` | `NOT_FOUND`, `TARGET_NOT_FOUND`, `FACT_NOT_FOUND` |
| `CONFLICT` | `DUPLICATE_RESOURCE`, `VERSION_CONFLICT`, `ALREADY_EXISTS` |
| `STATE_PRECONDITION` | `INVALID_STATE`, `ACTION_NOT_READY`, `FORMAL_ACCEPTANCE_REQUIRED` |
| `EVIDENCE_INSUFFICIENT` | `INSUFFICIENT_EVIDENCE`, `FORMAL_EVIDENCE_REQUIRED`, `SIMULATED_EVIDENCE_NOT_FORMAL` |
| `DISABLED` | `DEVTOOLS_DISABLED`, `FEATURE_DISABLED` |
| `DEPRECATED` | `DEPRECATED_PATH`, `LEGACY_ROUTE_DISABLED` |
| `INTERNAL` | `INTERNAL_ERROR`, `STATE_WRITE_FAILED`, `AUDIT_WRITE_FAILED` |

## Security requirements

Error responses must not include:

- tokens, credentials, secrets, or credential ids except already-public identifiers;
- stack traces;
- SQL text or database connection strings;
- local filesystem paths;
- MinIO/S3 internal paths;
- raw fact payloads in customer-facing APIs;
- raw debug JSON in customer-facing APIs.

## Inventory linkage

Every official `/api/v1/*` route inventory entry must declare:

```text
error_model: GEOX_STANDARD_ERROR_ENVELOPE_V2
contract_ref: docs/contracts/v2/GEOX_STANDARD_ERROR_ENVELOPE_V2.md or owning domain contract
gate_maturity: ci_enforced | release_gate_candidate | inventory_baseline
```

`LEGACY_COMPAT`, `FASTIFY_DEFAULT`, and `SYSTEM_HEALTH` are allowed only for compatibility, debug/internal, or health routes with explicit `boundary` and `gate_maturity` classification.

## Non-goals

This PR does not require all legacy errors to be rewritten at once. It establishes the baseline, the inventory fields, and the governance gate that prevents new official API surfaces from being undocumented.