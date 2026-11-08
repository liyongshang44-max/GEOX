# GEOX MCFT → Product verified read-only publication V1

**Classification:** bounded engineering candidate, not production deployment authority.
**Current source anchor:** protected main `3609bbee463ddc639c10a9993c904175d89892b9` (2026-10-09 02:31Z).
**Operator objective:** publish eligible real MCFT field-state facts to Product API and Sites before 24T is finally adjudicated, without mutating the Formal-v5 29-table qualification database or creating a third Neon database.

## 1. Chosen physical layout

```text
MCFT Formal-v5 DB (29 tables; canonical facts; no change)
  |
  | Verifiable exact CAP07 graph proof + immutable source/readback receipt
  | NO privilege to write Formal-v5
  v
Offline/host-authorized Product publication attestor
  | Source verifier contract pinned, Ed25519 signer purpose isolated,
  | exact runtime subject, six-key research scope, source db identity,
  | source revision visibility/as-of, evidence refs/hashes
  v
EXISTING production operational DB:
  geox_mcft_cap09_production_runtime_v1
  + product_mcft_publication_v1.field_state_receipt_v1
    (separate schema, append-only signed snapshots)
  |
  | SELECT only, customer token scope, signature VERIFIED AGAIN
  v
Product API Product Projection (non-authoritative)
  v
Sites C01/C02/C03: water, time, provenance, qualification pending
```

The publisher trust-key is **not** the AM22 execution signing key, nor a Product API bearer token, nor a client browser key. It requires a future separately authorized Ed25519 publication trust policy. No private key is checked into Git, workflows or the Product database.

The schema is **one additive namespace inside an existing operational database**, not a new physical database. There is no FDW/dblink/live cross-database SQL, no automatic replication, no imported facts, no Formal-v5 DDL or ACL widening.

## 2. Versioned contract and reliability semantics

Each signed capsule MUST carry:
- exact six-key `tenant/project/group/field/season/zone`; P0 is restricted to `tenant_mcft_external/project_mcft_cap09/group_public_research/field_kbs_mcse_t4r1/season_2026_corn/zone_kbs_mcse_t4r1_crop_formal_v1`;
- source Neon project/branch/Formal DB and exact Runtime subject SHA;
- exact active-lineage ref/hash, posterior ref/hash and source-fact ref;
- source `CAP07_COMPLETE_EXACT_GRAPH` proof and **its per-state receipt digest**;
- qualified reader/verifier **contract digest pinned in the trust policy** (constant across the eligible publishing period, but each state graph receipt may differ);
- logical time, evidence visible time, source readback as-of, certificate time with monotone causality;
- modeled root-zone water fraction/storage mean/stddev/interval/depletion, and explicitly `NOT_ESTABLISHED` confidence / stress;
- explicit `cap09_final_qualification_claim=false`; a customer-visible state does NOT imply G12/G13 PASS.

The Ed25519 signature signs the complete canonicalized statement. Semantic publication ID hashes the statement, not the row insertion timestamp. A first-party read path verifies the signature, key ID, trust subject, exact source identity, all columns against the statement, time ordering and entire capsule again. Ingestion ID is idempotent. No UPDATE/DELETE is granted, and the table also has an append-only rejection trigger. Competing signed states for the same hour with incompatible hashes return `LIMITED` — never select one silently.

The exact trust policy is independently authorized and supplied to the **host publisher and read consumer**. A signature by an unknown key or a fixture-generated key is NOT production truth. Neither the publisher app nor the database table can independently reconstruct missing physical CAP07 visibility metadata; the source graph attestation is a **hard upstream prerequisite**.

Publication-state result `PUBLISHED_UNQUALIFIED_24T` is **not** a qualified CAP09 terminal tick, not a Product freshness SLA, and not a recommendation.

## 3. Artifacts in this change

| Path | Implementation |
|---|---|
| `apps/server/src/product_projection/publication/mcft_verified_field_state_publication_v1.ts` | Pure signed capsule schema, pinning, signature and cause/time validation |
| `scripts/product_publication/postgres_mcft_verified_publication_v1.ts` | Strict publisher role + append-only idempotent sink + distinct read-only signed source reader |
| `scripts/product_publication/sql/2026_10_09_product_mcft_verified_publication_v1.sql` | Independently provisioned schema in operational DB with exact P0 scope, no writes into Formal-v5 |
| `scripts/product_acceptance/ACCEPTANCE_PRODUCT_MCFT_VERIFIED_PUBLICATION_ISOLATED_DB_V1.ts` | Real locally isolated PostgreSQL test with ephemeral Ed25519 issuer, replay and negative cases |
| `.github/workflows/product-mcft-verified-publication-v1.yml` | Postgres16 runner and typecheck with no live production creds |

Migration is stored outside the automatic startup migration scanner and is not linked into general migrations; any deployment requires explicit operator approval and an independently qualified zero-impact materialization contract. The PR is **Draft / Unmerged / no production effect**.

## 4. Physical evidence and current blocker (read-only audit 2026-10-08T16:53Z)

- Neon project `delicate-glade-62464340`, branch `br-cold-dust-a6j6aymz`.
- Operational DB identity `field_index_v1`: **1** KBS research field; operational active lineage and posterior: **0**.
- Formal-v5: 29 tables, `facts`: **0**, active lineage **0**, posterior projection **0**.
- Both existing DBs lack `public.twin_fact_visibility_index_v1` and `public.twin_fact_visibility_epoch_v1`. CAP07 S4 source proof cannot be claimed complete until it is independently qualified **without altering the frozen Formal-v5 store**; an alternative exact source attestor requires its own proof and adoption.
- Product read-only login exists but does not currently have the full canonical CAP07 table read rights; this publication design does not grant it broad Formal access.
- Railway public Product API is deployed but was SLEEPING; verified Product HTTP and actual Sites token-based read smoke were not completed.

**Present truthful verdict:** `VERIFIED_PUBLICATION_PRODUCTION_READINESS=BLOCKED`. CI synthetic capsules are proof of the publication mechanism, **not** evidence of live MCFT data.

## 5. Separate production-enablement gates (never implied by code merge)

| Gate | Owner | Evidence required |
|---|---|---|
| PUB-01 | MCFT CAP09 runtime | Real A0→O00 poster state physically persisted + lawful six-dimensional active lineage and source snapshot |
| PUB-02 | CAP07 / evidence authority | Independent canonical graph verification; real fact visibility/as-of/temporal semantics with immutable per-state receipt and pinned qualified verifier contract, no source DB mutation |
| PUB-03 | Security/DB governance | Provision publication signing identity, publish writer login and read-only Product role; approve additive schema **only in operational DB**; least-privilege write/read negative proof |
| PUB-04 | Publisher owner | Versioned host-only attestor connects only through approved read-only source path, signs **after** verifying graph; stage rollback/stop/fencing, unavailable source => zero publish |
| PUB-05 | Product API backend | Separate authorized adapter reads verified signed publications, not raw CAPS; bound Product scope, consistent C01/C02/C03 contract, no client private keys |
| PUB-06 | Site | Original Site page layout unchanged; authenticated read smoke for one KBS research scope, state+valid-time+provenance available, other fields unavailable, no synthetic model/attention claims |
| PUB-07 | Runtime qualification | G12/G13 still independent. Rolling continuation after O23 requires its own contract; no silent switch to qualified on receipt insertion |

The MCFT and Product teams may work concurrently. It is explicitly NOT necessary for 24T to finish before a **legally verified, read-only** state is shown, but it IS necessary that all publication-specific P0 gates pass before enabling it.

## 6. Next engineering connection

Versioned Product API `PublishedFieldStateReadAdapterV1` should consume `readVerifiedPublishedCurrentV1` through a dedicated repository and customer token binding, preserving Wave-02 `FieldSummary/Overview/Workspace` semantics, not bypassing them. Until adoption, current Wave-02 remains on its original pool and its `UNAVAILABLE` output is correct. The evidence, forecast, history, crop-stage and health publication families must each be added under own immutable source DTO/eligibility and customer-safe serialization contracts. Never copy raw provider secrets or executables to the public read schema.

**Boundary claim:** This PR implements and verifies the independent publication storage and trust layer. It does **not** itself sign production source facts, authorize a trust key, alter Product API routes or cause Sites to show data. Those require the explicit PUB-01 through PUB-07 closure.
