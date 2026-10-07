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
- two PostgreSQL read pools: an identity pool and a Formal-v5 MCFT read pool;
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

The public runtime accepts exactly two Product-specific database bindings:

- `GEOX_PRODUCT_DATABASE_URL` for field identity / Product scope data;
- `GEOX_PRODUCT_FORMAL_V5_DATABASE_URL` for MCFT Formal-v5 lineage, state, and exact-reference reads.

The two bindings must resolve to distinct PostgreSQL databases. The runtime does not accept `DATABASE_URL` as an implicit fallback.

Known Runtime/writer identities are rejected, including:

- `geox_runtime_v1`;
- `geox_mcft_cap09_evidence_runtime_login_v1`;
- `geox_mcft_cap09_twin_runtime_login_v1`;
- corresponding MCFT writer roles;
- `postgres`;
- `neondb_owner`.

The URL must use PostgreSQL and TLS with `sslmode=require` or `verify-full`.

The intended identity database is the already-bound Neon PostgreSQL project/database:

- Neon project: `delicate-glade-62464340`;
- branch: `br-cold-dust-a6j6aymz`;
- database: `geox_mcft_cap09_production_runtime_v1`.

The intended MCFT authority-read database is:

- database: `geox_mcft_cap09_s6_formal_t4r1_24h_v5`.

The identity database remains the source of `public.field_index_v1`. The Formal-v5 database is never a replacement for the identity database.

This document does not contain or mint a password.

Final deployment requires either:

1. a dedicated PostgreSQL read-only Product role; or
2. a Neon read-only compute endpoint whose credential cannot mutate the production branch.

Using an MCFT Evidence/Twin writer URL for Product API deployment is forbidden.

## 3. Query boundary

Top-level Product builder queries through both public pools are rejected unless they are read statements.

DDL/DML and command SQL are rejected in-process.

The builder performs no SQL-level cross-database join. It reads field identity from the identity pool and reads MCFT lineage/state through the Formal-v5 pool, then composes only by the already-governed tenant/project/group/field/season/zone keys and exact MCFT refs.

CAP-07 snapshot composition independently executes `REPEATABLE READ READ ONLY` transactions against the MCFT read pool.

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

proves connectivity to both the identity database and the Formal-v5 database and requires both sessions to report the default transaction mode as read-only.

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
- `GEOX_PRODUCT_FORMAL_V5_DATABASE_URL`;
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

The Product API preserves two source planes: `field_index_v1` remains on the production identity database, while MCFT lineage/state/exact-reference reads are taken from the Formal-v5 database. The Product API owns no MCFT write authority and does not move or copy authority-bearing records between the databases.

Provisioning or extending the Product read-only principal on Formal-v5 is a separate operational action. It is not performed by this code PR and must be separately authorized and adjudicated as a database ACL dependency change. Evidence/Twin Runtime credentials remain forbidden for Product API deployment.

## 11. Sites handoff

Sites remains configured with:

- `GEOX_PRODUCT_API_BASE_URL`;
- `GEOX_PRODUCT_API_BEARER_TOKEN`.

Once Railway `/ready` passes and the three Product routes pass authenticated smoke tests, those values may be set in Sites.

No Sites code change should be required beyond configuration if `ApiProductDataSource` is already implemented correctly.

## 12. Nonclaims

This artifact does not claim:

- the Formal-v5 Product read-only SELECT grants have been provisioned;
- a Product database credential has been provisioned;
- Railway deployment has succeeded;
- `api.geox.ink` DNS is configured;
- Sites is already showing real data;
- Product API production qualification is complete.
