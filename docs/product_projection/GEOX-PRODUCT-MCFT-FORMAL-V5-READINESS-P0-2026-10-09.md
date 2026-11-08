# GEOX Product ↔ MCFT CAP-09 Formal-v5 read-only integration P0

**Status:** DRAFT / candidate for qualified successor. **No Site availability, production adoption, credential change, schema mutation or Formal A0 authorization is claimed.**

**Source base:** protected main `e9198c90bcb61fc7fd4a6131348233bc1a365388` (Oct 8, 2026). MCFT AM22 V2 adopted **inactive engineering** runtime ports only. The separate data capability inventory is Draft PR #3671 (`GEOX-MCFT-DATA-CAPABILITY-TO-PRODUCT-SITE-MAPPING-V1-2026-10-08.md`).

## 1. Physical evidence (direct Neon / Railway read-only audit, Oct 8 16:53–16:55 UTC)

Actual same project/branch:
- Neon project `delicate-glade-62464340`, primary branch `br-cold-dust-a6j6aymz`.
- Operational/identity DB `geox_mcft_cap09_production_runtime_v1`: 41 public base tables; `field_index_v1` = **1** KBS field identity `tenant_mcft_external/project_mcft_cap09/group_public_research/field_kbs_mcse_t4r1`; `twin_active_lineage_index_v1` = **0**, `twin_state_history_projection_v1` = **0**, latest-state = **0**.
- Formal-v5 canonical DB `geox_mcft_cap09_s6_formal_t4r1_24h_v5`: 29 public base tables; `facts` = **0**, active lineage = **0**, posterior history = **0**, latest-state = **0**; **no `field_index_v1` table**.
- Both physical DBs are missing `public.twin_fact_visibility_index_v1` and `public.twin_fact_visibility_epoch_v1`, which the CAP-07 `PostgresFieldTwinS4ReadApiV1` canonical-visibility resolver requires for exact graph readback. No implicit fallback to `xmin` is authorized.
- Existing login `geox_product_readonly_login_v1` has CONNECT, schema usage and SELECT on `twin_active_lineage_index_v1` and `twin_state_history_projection_v1` in both DBs. In Formal, it also has SELECT on `facts` and `twin_state_latest_index_v1`; it **does not have SELECT** on `twin_object_idempotency_index_v1`, `twin_runtime_checkpoint_latest_index_v1`, `twin_runtime_health_latest_index_v1`. No tested INSERT permission on queried canonical tables.
- Railway GEOX Product API environment `production`: `geox-product-api` points to GEOX main, uses `/ready`, deployment `5ee021c8-9212-4ccc-a9bf-96d9eb9d207b` `SLEEPING` at audit. `sleepApplication=true`. This does not establish external `/ready` or Site auth smoke.
- Product API external URL as deployed: `https://geox-product-api-production.up.railway.app` (not evidence of endpoint success). Railway variable **names** exist for Product URL/token/origin. Secret values were not accessed or copied.

**Verdict:** `P0_REAL_STATE_SITE_AVAILABILITY = BLOCKED`. Raw Formal DB/O00 does not automatically satisfy CAP-07 or customer projection; Product and Formal are separate Postgres databases, not automatically joined.

## 2. Non-effectful P0 engineering delivered in this draft

1. `customer_formal_v5_readiness_v1.ts` freezes the **single publicly authorized KBS research scope** and required source DB/role/host/Neon identity. It disallows tenant/field remapping and writer URL fallback.
2. `customer_product_projection_builder_v1.ts` gains **explicit optional canonicalPool**: field identity still comes exclusively from the Product/operational database; active lineage + state projection + CAP-07 read model use only the canonical pool. The ordinary single-DB behavior remains unchanged. Non-KBS scope returns `UNAVAILABLE` and does not query Formal. The 6-key season/zone remains resolved from exactly one active lineage, not a fabricated client mapping.
3. `product_api_public_runtime_v1.ts` gains opt-in `GEOX_PRODUCT_FORMAL_READ_MODE=FORMAL_V5_RESEARCH_EXACT_SCOPE_V1` + `GEOX_PRODUCT_FORMAL_DATABASE_URL`. Both URLs must target exact different DB names on same host, with the exact Product read-only login. **Default OFF.** Enabling without a complete audited source or with a mismatched username fails at startup. `/ready` fails closed with specific namespaced blocker codes while Formal relations, role permissions or first state are missing.
4. Host preflight `scripts/product_acceptance/PREFLIGHT_GEOX_PRODUCT_MCFT_FORMAL_READ_V1.ts --read-only-preflight` checks physical source identity, Catalog relations and SELECT-only grants, one field-index identity row, exactly one live Formal season/zone and first persisted posterior row. No data or tokens are copied into git/CI, no SQL writes, no A0, no direct Site DB credentials.
5. Dedicated GitHub CI checks URI/cross-tenant/ambiguity/ACL negative tests, C01/C02/C03 backend builder conditional outputs, Product auth route, and no unflagged host preflight. Fixture `AVAILABLE` is **synthetic test only**, never evidence that production currently has a state.

### Important qualifier

A passing **physical preflight** is NOT a complete CAP-07 exact read graph qualification or authenticated Site smoke. Only the actual end-to-end source ref/hash/cutoff proofs, authenticated Product API read and Site consumption close the customer readiness gate. This change deliberately **does not modify** the frozen CAP-07 read-model semantics to bypass missing visibility metadata.

## 3. P0 remaining real-world work / owners / stop conditions

| Gate | Owner | Needed action | Closure proof |
|---|---|---|---|
| P0-01 Formal first state | MCFT AM22/start owner | Legally execute A0/O00 and persist one exact posterior with properly pinned lineage; no synthetic seed | Physical readback shows one exact six-key active lineage + posterior/state hash; no future leakage |
| P0-02 CAP-07 visibility | MCFT read-model/schema governance | Decide and independently qualify how canonical fact visibility metadata is materialized/served to Product without violating Formal-v5 frozen 29-table/2-routine zero-state and without in-place retroactive fixes; a versioned separate read projection is acceptable after approved qualification | Canonical S4 read returns `COMPLETE_EXACT_GRAPH` from actual post-O00 source; no forbidden `xmin` substitute |
| P0-03 Product read credential | Product + DB ACL owner | Grant **least-privilege SELECT only** to verified state read surface after its independent schema/ACL impact adjudication; avoid direct tables that expose unrelated scopes if projection/SECURITY DEFINER views provide narrower access | Role cannot INSERT/UPDATE/DELETE, role/session read-only, exact read privilege set PASS |
| P0-04 Dual-DB source adoption | Product API owner | Approve scope-specific flag, dedicated read role and host configuration only after all P0 evidence exists; do not change MCFT writer credentials. Invalidate any deprecated proof if policy changes | In deployed `/ready`: both source DB identities confirmed and no blocker; 3 authorized Product routes smoke PASS |
| P0-05 Site C01/C02/C03 | Site + Product | Reuse existing Site `ApiProductDataSource` and scopes, verify token/CORS and client refresh. Do not rename / rebuild approved Site | C01 overview current=1; C02 field status=AVAILABLE with exact ref; C03 water values/effective_at/provenance; no mocked/borrowed field |
| P0-06 Freshness/qualification label | Product + Site | Keep current Product `freshness=UNKNOWN` until explicit temporal SLA; 24T completion only after G12/G13 | UI differentiates `state available` from `CAP09 qualified`, with explicit reasons and timestamp |

**Stop conditions:** Missing CAP-07 visibility/provenance proof, nonexistent physical state, mismatched host/project/branch, two active zones, unregistered customer scope, missing read privilege, caller out of allowed fields, writer credential, evidence in the future or a red required check. No optimistic `AVAILABLE`, no manual DB edits, no placing a `GEOX_PRODUCT_FORMAL_DATABASE_URL` in a browser/Site variable.

## 4. P1 Field Intelligence expansion after P0

| Successor slice | Actual canonical source | Read-model/Product change | Customer interface |
|---|---|---|---|
| P1-EVIDENCE | KBS raw soil VWC 100 mm/rain/weather/ET0, GFS cycle, causal `Evidence Window`, raw digest/revision | Versioned source-backed safe Evidence summary + bounded artifact index; measured vs modelled label | C03 Evidence |
| P1-FORECAST | 72-point `twin_forecast_run_v1`/`twin_forecast_point_projection_v1`, current vs latest-successful pointer | New `ForecastProjectionV1`; COMPLETED/BLOCKED separations, horizon timestamps, mean/interval/forcing | C03 Forecast new tab |
| P1-HISTORY | CAP-07 signed visibility snapshot, Timeline, Trace, health dual semantics | Versioned cursor-bound historical projection, exact refs/hashes, page consistency, read-only | C03 Activity / History |
| P1-CROP | Crop authority, modelled biological stage, water-use stage/Kc/as-of/expiry, soil model prior | Versioned agronomic context projection with provenance and validity; no site-calibration claim | C03 Overview |
| P1-HEALTH | Terminal health, operational attempt health, missing source, checkpoint, freshness | Customer-safe summary separate from operator secrets; no false `healthy` default | C03 Data Health new tab |
| P2-SCENARIO | Qualified `ScenarioSet` from completed forecast only | Bounded non-recommendation simulation projection | C03 Scenarios, governed |
| P2-ACTION | ADR decisions, B-Line approval/task/dispatch/receipt, Outcome refs | Separate authority-binding Product contracts, no inferred action/attribution from MCFT | C01 Attention / C03 Activity |

Customer Product current `FieldSummaryProjectionV1` deliberately does not infer water stress, confidence, recommendations, severity or execution. Existing Wave-02 Activity, Evidence, History placeholders do not become implemented merely from this integration.

## 5. Parallel-development isolation

- MCFT CAP-09 AM22 execution and 24T remain **separate** from Product API read-source changes.
- Protected main is **not** advanced by this draft. Existing ARM retirement/start authorizations remain unchanged.
- No databases were mutated in this read audit, and the new bridge code has not been deployed to Railway.
- Only one KBS research-scope binding is admitted by this P0. Multitenant/multifield production requires a separate explicitly governed mapping service and access-control proof.
