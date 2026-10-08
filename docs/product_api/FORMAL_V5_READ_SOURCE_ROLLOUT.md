# Product API separate MCFT read store

Status: code qualified; Formal-v5 production rollout blocked by read-contract compatibility.

## Configuration

Keep `GEOX_PRODUCT_DATABASE_URL` pointing at the Product identity store. Set the optional server-only `GEOX_PRODUCT_MCFT_DATABASE_URL` to the approved SELECT-only MCFT read store connection. The URL must pass the same SSL and writer-role restrictions as the identity connection. Neither URL belongs in the Site frontend.

Field enumeration and identity remain in the identity store. Active-lineage scope lookup, exact state projection lookup and the canonical CAP-07 S4 reader all use the MCFT store. A configured MCFT store never falls back to identity-store lineage or state. Existing deployments with no MCFT URL retain their original connection routing.

Both pools participate in readiness and shutdown. For a separately configured MCFT store, `/ready` also checks the canonical reader's required relations and SELECT privileges, returning 503 / `MCFT_READ_STORE_NOT_READY` for incompatible schema or permissions. Connectivity does not establish an active lineage or a complete exact runtime graph.

## Live inspection on 2026-10-07

Read-only Neon queries on project `delicate-glade-62464340`, branch `br-cold-dust-a6j6aymz` established:

| Database | Active lineages | State history rows | field_index_v1 |
| --- | ---: | ---: | --- |
| geox_mcft_cap09_production_runtime_v1 | 0 | 0 | present |
| geox_mcft_cap09_s6_formal_t4r1_24h_v5 | 0 | 0 | absent |

Formal-v5 has exactly 29 public tables. The following relations required by the existing CAP-07 reader are absent:

- `twin_fact_visibility_epoch_v1`
- `twin_fact_visibility_index_v1`
- `twin_calibration_candidate_projection_v1`
- `twin_shadow_evaluation_projection_v1`

The first two are required at snapshot creation and canonical fact resolution. The latter two are read by the current-runtime optional-domain summaries. These are mandatory reader dependencies, even though those optional domains can contain zero rows.

The existing `geox_product_readonly_login_v1` and `geox_product_readonly_v1` roles have database CONNECT and public-schema USAGE, but neither has SELECT on Formal-v5 active lineage. Both roles have default transaction read-only enabled. No database ACL, schema, data, owner lease or runtime configuration was changed by this inspection.

A0's `commitBootstrapState(...)` creates real lineage, posterior state, checkpoint, forecast result and runtime health. It does not materialize CAP-07 visibility metadata or the absent optional-domain tables. Thus A0 is necessary for state availability, but is not sufficient for this reader to consume the frozen Formal-v5 schema.

## Release gates

1. Qualify a Formal-v5 read adapter against its governed 29-table contract, or establish an explicitly governed compatible read store. Do not silently add tables to Formal-v5 or invent canonical visibility metadata to bypass the existing reader.
2. Establish least-privilege Product SELECT access for that approved read surface. Do not reuse evidence/twin runtime login credentials or grant writer privileges.
3. Deploy the Product API change from an isolated qualified commit and bind the separate MCFT connection. Avoid changing protected main after arm: the post-arm continuity verifier permits only current-crop authority/registry advancement and checks zero runtime-code drift.
4. Verify `/ready`, the Site proxy and exact authorized field scope. The original identity-store connection stays in place.
5. Execute A0 only through its existing real-clock operator path with arm, schema/ACL, promotion and stage-continuity proofs. Before A0, zero lineage remains unavailable. After A0, verify the canonical exact graph and Product condition against the resulting source refs and hashes.

No A0 execution, Formal-v5 mutation, production deployment or main merge is performed by this change.

## Validation

`node --import tsx --test apps/server/src/product_api/product_api_public_runtime_v1.test.ts apps/server/src/product_projection/customer/customer_product_projection_builder_v1.test.ts`

19 tests passed, including split-store routing, no fallback, canonical S4 snapshot pool selection, dual-store readiness and incompatible read-schema rejection. Fixtures are synthetic and do not prove live A0 readability.

`node node_modules/typescript/bin/tsc --noEmit -p apps/server/tsconfig.json`

Server typecheck passed. `git diff --check` passed.
