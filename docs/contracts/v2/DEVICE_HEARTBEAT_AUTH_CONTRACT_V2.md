# Device Heartbeat Auth Contract v2

Status: Transitional / Acceptance-Compatible

## Purpose

This contract defines the governance boundary for `POST /api/v1/devices/:device_id/heartbeat`.

The current route supports smoke, local acceptance, and CI runtime checks by allowing tenant/project/group scope to be derived from the request context and request body. That behavior is transitional. It is not the production device-auth security model.

This document is a governance contract only. It does not change route behavior, device credential behavior, runtime auth, or acceptance gates in this PR.

## Current allowed state

Current status: `Transitional / Acceptance-Compatible`.

Current repository behavior may allow heartbeat scope to be inferred from:

1. authenticated request context when present;
2. user/auth context when present;
3. request body fields such as `tenant_id`, `project_id`, and `group_id` as an acceptance-compatible fallback.

This is allowed only to keep local and CI acceptance flows operational while the device credential and registry model is completed.

The current heartbeat route may update `device_status_index_v1` fields such as:

- `project_id`;
- `group_id`;
- `last_heartbeat_ts_ms`;
- `last_seen_ts_ms`;
- `updated_ts_ms`;
- `status=ONLINE`.

Current maturity statement:

| route | status | fact_confidence | gate_maturity |
| --- | --- | --- | --- |
| `POST /api/v1/devices/:device_id/heartbeat` | Transitional / Acceptance-Compatible | confirmed_by_route_review | inventory_baseline |

This current state must not be interpreted as production security completeness.

## Production target state

The production target is device-authenticated heartbeat ingestion.

In production, device heartbeat scope must be derived from all of the following authoritative sources:

1. authenticated device credential;
2. registered device binding;
3. tenant/project/group/device registry;
4. credential revocation, expiry, and rotation state;
5. explicit binding between `device_id` and credential identity.

The request body may carry telemetry metadata, but it must not be the authority for tenant/project/group ownership in production.

The target production auth scope is:

```text
device.heartbeat.write
```

The target model is:

```text
device credential -> device registry binding -> scoped heartbeat projection
```

## Prohibited production behavior

Production heartbeat ingestion must not permanently rely on client-supplied scope fields.

Forbidden production outcomes:

- Production environment trusts request body `tenant_id`, `project_id`, or `group_id` as the authority for scope.
- A device can declare arbitrary tenant scope.
- Heartbeat creates or updates cross-tenant `device_status_index_v1` rows.
- Heartbeat bypasses registered device binding.
- Heartbeat accepts a revoked credential.
- Heartbeat accepts an expired credential.
- Heartbeat accepts an unknown device credential.
- Heartbeat updates a `device_id` that is not bound to the credential identity.

## Formal-chain boundary

Heartbeat is a device-status projection input.

It may update device status, freshness, and runtime readiness projection. It must not directly create:

- formal acceptance;
- customer report conclusion;
- ROI ledger value;
- Field Memory;
- formal agronomy diagnosis;
- formal operation success.

The route may influence fail-safe checks through device status freshness, but it must not bypass fail-safe policy or directly close formal chain gates.

## API inventory classification

Inventory target row:

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

## Future governance gate placeholder

Future gate name:

```text
scripts/governance_acceptance/ACCEPTANCE_DEVICE_HEARTBEAT_SCOPE_AUTH_V1.cjs
```

This PR does not implement the gate.

The future gate should cover at minimum:

1. A tenantA device credential cannot write tenantB device status.
2. A revoked device credential cannot heartbeat.
3. An unknown device credential cannot heartbeat.
4. A body `tenant_id` that conflicts with credential tenant is rejected.
5. Heartbeat can update only the `device_id` bound to the credential.
6. Heartbeat cannot create cross-tenant `device_status_index_v1` rows.
7. Heartbeat cannot bypass registered device binding.

## Non-goals for this PR

This PR does not:

- modify `apps/server/src/routes/device_heartbeat_v1.ts`;
- implement device credential auth;
- implement `device.heartbeat.write`;
- change smoke behavior;
- change P1 smoke preflight;
- affect PR #1842 behavior;
- change runtime acceptance behavior;
- claim production security completeness.

## Release interpretation

This contract is a transitional governance baseline.

```text
route exists ≠ production device-auth complete
acceptance compatibility ≠ production security model
inventory documented ≠ CI enforced
```
