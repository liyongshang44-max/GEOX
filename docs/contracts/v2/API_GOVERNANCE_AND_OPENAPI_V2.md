# API Governance and OpenAPI Contract v2

Status: Proposed / Draft

## Purpose

This contract defines the governance baseline for GEOX external API surfaces, route inventory, OpenAPI, auth/scope metadata, and error envelope migration.

It is a target contract. It does not claim that all current routes already satisfy the contract.

## Canonical API rule

The default external API surface is:

```text
/api/v1/*
```

Legacy, compat, debug, and internal routes may exist only when explicitly classified. They must not become new product dependencies.

## Required route inventory fields

Every new or materially changed route must be representable in an inventory row with:

| field | required | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| route_path | yes | confirmed when route exists | script_exists |
| method | yes | confirmed when route exists | script_exists |
| owner | yes | partially_confirmed until owner review | script_exists |
| audience | yes | partially_confirmed until API review | script_exists |
| boundary | yes | partially_confirmed until API review | script_exists |
| auth_scope | yes | proposed until enforced | script_exists |
| request_schema | yes for writes | proposed until OpenAPI and runtime validator align | script_exists |
| response_schema | yes | proposed until OpenAPI and implementation align | script_exists |
| error_model | yes | proposed until unified envelope is adopted | script_exists |
| contract_reference | yes | proposed until linked from inventory | script_exists |

## Sales-critical API hard gate

For Controlled Pilot sales readiness, the following official API surfaces are sales-critical and must not remain WARN-only:

```text
/customer/*
/reports/*
/actions/*
/sense/*
/acceptance/*
/evidence-export/*
/inspection/*
/device-status/*
/fail-safe/*
/manual-takeover/*
```

The current implementation may expose device status as `GET /api/v1/devices/{device_id}/status`; that route is governed by the same device-status rule.

Each sales-critical route group must have:

```text
OpenAPI path
request schema for write routes
response schema
auth/scope metadata
error model
contract_ref
owner
audience
```

Sales-critical route groups may use `release_gate_candidate` while runtime and schema parity are still being finalized, but they must not be downgraded to `inventory_baseline`, `legacy_exempt`, `debug_exempt`, or temporary WARN-only status. Missing OpenAPI path/method coverage for these groups is a release-gate failure.

Runtime requirement: sales-critical overlay paths/schemas must be merged into `/api/v1/openapi.json` output, not only checked by static selfcheck scripts.

## OpenAPI baseline

OpenAPI must become a real contract, not decorative documentation. For PR-0 this is a proposed target only.

Required future properties:

1. Each official route has an operationId.
2. Write routes declare request schema.
3. Customer-facing routes declare response schema with customer-safe redaction.
4. Known error responses are documented.
5. Security scheme and scopes are mapped.
6. Route inventory and OpenAPI drift are checked by gates.

## Error envelope migration

Current repository behavior may still use feature-specific envelopes such as:

```json
{ "ok": false, "error": "ERROR_CODE", "message": "..." }
```

Base Contract v2 does not claim that RFC 9457 or a unified GEOX error envelope has already been implemented.

Migration target:

```text
GEOX Standard Error Envelope v2, or RFC 9457-compatible problem details, must be evaluated and adopted incrementally.
```

## Gate maturity statement

Any statement about API governance must use `gate_maturity`.

```text
release gate exists ≠ CI enforced ≠ business correctness proven
```

| gate | current PR-0 maturity | fact_confidence |
| --- | --- | --- |
| route dependency guard | script_exists | partially_confirmed |
| route inventory enforcement | script_exists | partially_confirmed |
| OpenAPI conformance | script_exists | partially_confirmed |
| unified error envelope | proposed | proposed |
| business correctness proven | not claimed | proposed |

## Non-goals

This document does not change API behavior, route behavior, auth behavior, runtime schemas, or OpenAPI output. It establishes the governance baseline only.
