# MCFT CAP-09 — isolated Producer bucket incompatibility successor

## First real Execute, immutable negative receipt

On protected main `2e4c3e7ac0b0e300b15b26b2f6111e7d39de328b` with run `72dc0304a21a`, Windows scientific core selftest passed, then the first isolated Producer attempt failed during pure composition construction with `POSTMERGE_V13_PRODUCER_CORE_FORMAL_RAW_BUCKET_REQUIRED`.

The frozen production wrapper `apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_composition_v1.ts` requires canonical bucket `geox-mcft-cap09-formal-raw-v1`. The adopted isolated qualification authority and `isolatedTargets` necessarily require `mcft-cap09-requal-72dc0304a21a`. **Never switch the qualification request to the production bucket.** Do not alter frozen Runtime semantics or production object store.

First attempt's immutable output is `D:\gptdown\MCFT-CAP09-ISOLATED-INFRA-20261010\qualification-evidence-72dc0304a21a-20261011T00Z`; preserve started.json and failing Producer receipt. Neither three real Timing measurements nor the controlled delay matrix ran. A local read-only PostgreSQL/S3 audit is required before a **separate** attempt.

## Engineering-only repair

`MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts` is **a qualification-only seam**, never imported from production code. It instantiates the existing frozen production primitive implementations: S3 raw retention, candidate manifests, retained raw reader, ProductionEvidenceWorkItemFactory, fenced PostgreSQL evidence writer, and decoder-backed candidate capture/promotion. It requires a loopback S3 endpoint and exact run-scoped bucket.

The V2 local Producer harness now explicitly sets:

- `production_canonical_core_identical:false`
- `production_wrapper_composer_reused:false`
- `production_canonical_primitive_implementations_reused:true`
- `isolated_composition_id:MCFT_CAP09_V13_ISOLATED_QUALIFICATION_COMPOSITION_V1`

Thus positive observations, if eventually obtained, demonstrate the **same production primitives**, not exact production composition wiring. Never promote the isolated result as the full production-equivalent owner or 24T proof. Existing frozen production Runtime remains unchanged.

## Required checks before next attempt

1. QCP exact-scope successor and immutable historical replay must pass and merge under protected main; engineering CI must pass isolated pure-construction tests and negative tests for production bucket and external endpoint.
2. Audit the first attempt's read-only positive/negative database table counts, evidence receipt, and object-storage namespace. Stop if unexpected persistent writes are present.
3. Adopt a **new exact protected-main** execution subject, fresh output directory (not the failed attempt's directory), and only if still within the existing short-lived qualification authority and greater-than-six-hour target lead. If the clock no longer qualifies, adopt a fresh reviewed qualification ARM instead. Never reset old evidence/containers.
4. First perform guarded Preflight; then independently authorize a **single new** Execute attempt with fresh immutable output and explicit operator action. No unattended retries.
5. Stage/admit Producer and Timing evidence via QCP separately, and require executed controlled-delay cases before any formal timing-budget freeze.

This engineering-only patch does **not** authorize another Execute, Recovery, Formal-v5, A0 or O00.
