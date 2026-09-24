# GEOX Product API Public Deployment V1

document_id: GEOX-PRODUCT-API-PUBLIC-DEPLOYMENT-V1  
status: IMPLEMENTED_CANDIDATE  
baseline_protected_main: 362bff47d73eb1997338f68332ea80f584632a63  
date: 2026-09-23  
scope: PUBLIC_READ_ONLY_PRODUCT_API_RUNTIME

## 0. Purpose

This artifact defines a dedicated public runtime for the canonical GEOX Product API.

It exists so external Product UI consumers such as ChatGPT Sites can read:

- GET /api/product/v1/overview
- GET /api/product/v1/fields
- GET /api/product/v1/fields/:fieldRef

without deploying the complete GEOX Server runtime and without exposing MCFT Evidence/Twin Runtime credentials.

## 1. Isolation boundary

The dedicated public runtime starts from:

`apps/server/src/product_api_public_server_v1.ts`

and composes only:

- Fastify;
- CORS;
- Product API authentication;
- the canonical `registerProductV1Routes`;
- a PostgreSQL read pool;
- `/health`;
- `/ready`.

It does not register the normal GEOX `createApp` surface.

Therefore the public Product API runtime does not intentionally expose:

- `/api/v1/customer/*`;
- `/api/v1/reports/*`;
- Admin APIs;
- Operator command surfaces;
- legacy compatibility routes;
- static application surfaces;
- MCFT scheduler entrypoints;
- MCFT Evidence Runtime;
- MCFT Twin Runtime;
- B-Line execution;
- MQTT;
- MinIO;
- database migrations.

## 2. Database credential boundary

The public runtime accepts only:

`GEOX_PRODUCT_DATABASE_URL`

It does not accept `DATABASE_URL` as an implicit fallback.

Known Runtime/writer identities are rejected, including:

- `geox_runtime_v1`;
- `geox_mcft_cap09_evidence_runtime_login_v1`;
- `geox_mcft_cap09_twin_runtime_login_v1`;
- corresponding MCFT writer roles;
- `postgres`;
- `neondb_owner`.

The URL must use PostgreSQL and TLS with `sslmode=require` or `verify-full`.

The intended production database is the already-bound Neon PostgreSQL project/database:

- Neon project: `delicate-glade-62464340`;
- branch: `br-cold-dust-a6j6aymz`;
- endpoint family: `ep-odd-poetry-a6peeo8g.us-west-2.aws.neon.tech`;
- database: `geox_mcft_cap09_production_runtime_v1`.

This document does not contain or mint a password.

Final deployment requires either:

1. a dedicated PostgreSQL read-only Product role; or
2. a Neon read-only compute endpoint whose credential cannot mutate the production branch.

Using an MCFT Evidence/Twin writer URL for Product API deployment is forbidden.

## 3. Query boundary

Top-level Product builder queries through the public pool are rejected unless they are read statements.

DDL/DML and command SQL are rejected in-process.

CAP-07 snapshot composition independently executes `REPEATABLE READ READ ONLY` transactions.

These application-layer controls are defense in depth only. They do not replace the required database-layer read-only credential/endpoint.

## 4. Product caller identity

The public runtime accepts only:

`GEOX_PRODUCT_API_TOKENS_JSON`

The token source must use `ao_act_tokens_v0` records and every active record must:

- have role `client`;
- have tenant/project/group scope;
- have non-empty `allowed_field_ids`;
- use a sufficiently long bearer secret;
- not be revoked.

After validation the public process mirrors this narrow source into the existing internal auth module in memory.

A generic GEOX service token source is not a deployment input for this runtime.

## 5. CORS

Browser origins are configured only through:

`GEOX_PRODUCT_ALLOWED_ORIGINS`

Wildcard origins are forbidden.

Configured browser origins must use HTTPS.

Sites should still call the Product API from its server-side data layer; the bearer token must not be sent to browser JavaScript.

## 6. Health and readiness

`GET /health`

proves only that the public Product API process is alive.

`GET /ready`

proves database connectivity and reports whether the session default is read-only.

Railway production health checking should target `/ready`.

A deployment must not be treated as production-ready if `/ready` returns 503.

## 7. Deployment image

Dedicated image definition:

`docker/product-api.Dockerfile`

Runtime command:

`node apps/server/dist/apps/server/src/product_api_public_server_v1.js`

The image builds the server package but starts only the Product API public entrypoint.

## 8. Required deployment variables

Required:

- `GEOX_PRODUCT_DATABASE_URL`;
- `GEOX_PRODUCT_API_TOKENS_JSON`;
- `GEOX_PRODUCT_ALLOWED_ORIGINS`.

Platform supplied / optional:

- `PORT`;
- `HOST=0.0.0.0`;
- `GEOX_PRODUCT_DB_POOL_MAX`;
- `GEOX_PRODUCT_DB_IDLE_TIMEOUT_MS`;
- `GEOX_PRODUCT_DB_CONNECT_TIMEOUT_MS`.

Not required and should not be injected merely for Product API:

- MQTT credentials;
- MinIO credentials;
- MCFT Evidence Runtime credential;
- MCFT Twin Runtime credential;
- executor token;
- Admin token;
- migration/admin database credential.

## 9. Railway deployment target

The intended initial public host is Railway as a separate service.

The service is not an MCFT production owner.

Its operational role is:

`PRODUCT_API_PUBLIC_READ_ONLY`

Railway deployment must use:

- GitHub repository `liyongshang44-max/GEOX`;
- protected `main`;
- Dockerfile `docker/product-api.Dockerfile`;
- health check `/ready`;
- continuous service;
- no database service created in Railway.

A Railway-generated HTTPS domain may be used first for qualification. A custom `api.geox.ink` domain can be attached later after qualification.

## 10. MCFT dependency boundary

This deployment does not modify:

- `apps/server/db/migrations/**`;
- MCFT Runtime code;
- MCFT scheduler;
- Evidence Runtime;
- Twin Runtime;
- production owner leases;
- Formal-v5 state;
- database schema;
- database grants in this PR.

The Product API reads the same PostgreSQL facts/projections but owns no MCFT write authority.

Provisioning a new database role or read-only compute endpoint is a separate operational action and must be treated as a database dependency change when adjudicating MCFT exact-current-main qualification.

## 11. Sites handoff

Sites remains configured with:

- `GEOX_PRODUCT_API_BASE_URL`;
- `GEOX_PRODUCT_API_BEARER_TOKEN`.

Once Railway `/ready` passes and the three Product routes pass authenticated smoke tests, those values may be set in Sites.

No Sites code change should be required beyond configuration if `ApiProductDataSource` is already implemented correctly.

## 12. Nonclaims

This artifact does not claim:

- a Product database credential has been provisioned;
- Railway deployment has succeeded;
- `api.geox.ink` DNS is configured;
- Sites is already showing real data;
- Product API production qualification is complete.


## 13. Production dependency reconciliation — 2026-09-23

The production operational database dependency has now been reconciled under explicit operator authorization.

Target:

- Neon project: `delicate-glade-62464340`;
- branch: `br-cold-dust-a6j6aymz`;
- database: `geox_mcft_cap09_production_runtime_v1`.

Verified operational change:

- `public.field_index_v1.project_id` exists;
- `public.field_index_v1.group_id` exists;
- `field_index_v1_product_scope_idx` exists over `tenant_id, project_id, group_id, field_id`;
- exactly one non-authoritative field identity row was materialized from the unique scope already present in production facts:
  - `tenant_mcft_external`;
  - `project_mcft_cap09`;
  - `group_public_research`;
  - `field_kbs_mcse_t4r1`.

The reconciliation did not invent customer display metadata. `field_name`, `name`, `area_ha`, and `updated_ts_ms` remain unavailable where the existing production sources do not establish them.

Post-change readback preserved the existing fact inventory at 224 rows. The production operational store still has:

- active Twin lineage count = 0;
- Twin state-history count = 0.

Therefore Product API Wave-02 may expose the real field identity while current field condition remains explicitly `UNAVAILABLE`. No Twin lineage, posterior state, freshness, risk, severity, recommendation, approval, or execution truth is inferred from Evidence facts.

This repository successor records the already-applied operational reconciliation. It does not replay the production database mutation and does not widen MCFT writer authority.

### 13.1 Product database principal state

A dedicated principal `geox_product_readonly_login_v1` has been structurally provisioned with:

- `LOGIN`;
- `NOINHERIT`;
- no superuser, create-database, create-role, replication, or bypass-row-level-security attributes;
- no role memberships;
- no `CREATE` on schema `public`;
- `SELECT` on `public.field_index_v1`, `public.twin_active_lineage_index_v1`, and `public.twin_state_history_projection_v1`;
- no write privilege on those Product dependencies.

The principal does not yet have a usable password credential through the available Neon provisioning path. It therefore must not be treated as a deployable `GEOX_PRODUCT_DATABASE_URL` yet.

Neon API-created login roles were rejected for this purpose because they acquire broad Neon administrative capabilities and `neon_superuser` membership that cannot be stripped by the production database owner.

### 13.2 Railway provisioning status

Railway provisioning has not started successfully.

The current Railway account rejected creation of the new isolated `GEOX Product API` project because the account trial has expired and a plan must be selected first.

No legacy Land-OS Railway project or service may be repurposed for this deployment.

After the Railway account is enabled and a usable dedicated PostgreSQL Product credential exists, the remaining deployment sequence is unchanged:

1. create the isolated `GEOX Product API` Railway project/service;
2. deploy protected `main` through `docker/product-api.Dockerfile`;
3. bind only the Product database URL, scoped Product client token source, and allowed origins;
4. require `/ready = 200`;
5. require authenticated smoke PASS for all three canonical Product routes;
6. generate the Railway HTTPS domain;
7. configure Sites with server-side `GEOX_PRODUCT_API_BASE_URL` and `GEOX_PRODUCT_API_BEARER_TOKEN`.
