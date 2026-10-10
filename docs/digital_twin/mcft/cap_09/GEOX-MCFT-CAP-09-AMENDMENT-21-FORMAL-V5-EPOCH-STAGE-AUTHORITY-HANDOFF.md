# GEOX MCFT-CAP-09 Amendment-21 — Formal-v5 Epoch / Stage Authority Handoff

Status: CANDIDATE — EFFECTIVE ONLY WHEN MERGED TO PROTECTED `main`

Exact predecessor protected main: `67bfdc5216ccc210c6479548297dd284bcb6a3f6`

## 1. Purpose

This amendment resolves one narrow T4R1 / Formal-v5 authority conflict exposed by the first real H6 arm attempt after protected-main owner cutover.

It does not reopen H6 architecture, historical Formal-v4, DT02, Amendment-20 scope authority, database schema, Runtime Kernel, scheduler semantics, production-owner semantics, or the actual-UTC Formal clock.

The real H6 arm reached all prior readiness gates and failed closed at epoch selection because the historical Amendment-06 calendar / FAO envelope rule could not produce a future 24-slot LATE window under the frozen T4R1 planting uncertainty and six FAO-56 maize duration variants. Meanwhile, the already-effective DT02 / A18 path used by the Formal-v5 manifest and Runtime Config materialization derives the governed current T4R1 water-use stage from Biological Stage Authority.

This amendment makes the handoff explicit.

## 2. Authority relationship

For T4R1 / Formal-v5 only:

- Amendment-06 remains authoritative for the 36-hour minimum governance lead, actual-UTC hourly epoch clock, O00/O23 span, A0 = O00 - 1h, readiness deadline = O00 - 12h, lifecycle-horizon bound, no retroactive start, and no accelerated/replay clock.
- The six frozen FAO calendar-duration variants in `GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json` remain a model-stage prior and historical conservative derivation authority.
- After DT02 Biological Stage Authority effectiveness and the A18 T4R1 binding, that historical calendar envelope is not future Formal-v5 stage truth and must not independently veto a clock-only arm when future stage pins are intentionally deferred.
- DT02 Amendment-03 itself is not rewritten or superseded.
- Historical Formal-v4 and its stage semantics are unchanged.

This is a narrow successor ruling over the T4R1 / Formal-v5 epoch-selection stage gate only. It is not a general Amendment-06 rewrite.

## 3. Arm responsibility

The Formal-v5 arm freezes only:

- exact protected-main subject;
- exact Formal-v5 physical store identity;
- database-clock arm time;
- future actual-UTC A0/O00/O23 clock;
- 36-hour minimum governance lead;
- O00/O23 lifecycle-horizon inclusion;
- forcing acquisition timing authority;
- zero-state proof;
- exact live-owner proof;
- retired GitHub production-trigger zero;
- explicit operator authorization.

The arm must not freeze future stage/context pins.

The arm-time current-crop authority may be retained as lineage and diagnostic evidence, including current stage and lifecycle horizon, but:

```text
arm_time_stage_snapshot_is_runtime_pin = false
formal_stage_authority_pins_frozen = false
formal_runtime_config_pins_frozen = false
```

## 4. Post-arm stage successor requirement

After arm and before any A0 mutation, a newly effective current T4R1 Biological Stage Authority binding must be selected through the existing effective-current-crop registry and the existing post-arm continuity verifier.

That selected authority must satisfy all existing DT02 / A18 fail-closed contracts and must cover the complete interval:

```text
A0 through O23 inclusive
```

Coverage of A0 alone is insufficient.

The selected authority must prove:

- lifecycle remains ACTIVE / RESOLVED / VALID;
- lifecycle horizon covers O23;
- Biological Stage Authority is resolved under an allowed epistemic class;
- no observed biological-stage claim is fabricated for a derived class;
- singleton crop-water-use stage is available;
- exact governed Kc lookup succeeds;
- authority validity covers O23;
- authority graduation is effective no later than A0;
- no future observation is consumed.

If any item fails, A0 and O00 remain unauthorized.

## 5. Formal-v5 manifest and hourly pinning

The existing Formal-v5 manifest path remains controlling:

`scripts/runtime_acceptance/mcft_cap09_formal_v5_manifest_from_stage_authority_v1.ts`

It must continue to generate exact A0 and O00–O23 Runtime Config stage/context hashes from the selected DT02 / A18 current authority.

Every hourly config remains explicitly pinned.

No implicit latest-stage lookup is authorized during execution.

No arm-time stage snapshot may be promoted into a future Runtime Config pin.

## 6. Forbidden substitutions

The following remain forbidden:

- future observations used to manufacture eligibility;
- most-likely stage selection;
- human-specified LATE;
- choosing one FAO regional variant as T4R1 truth;
- silently treating lifecycle ACTIVE as stage authority;
- silently treating stage authority as lifecycle authority;
- bypassing uncertainty or validity windows;
- carrying a prior stage authority beyond its valid-until boundary;
- changing historical V4 behavior;
- changing DT02 architecture semantics;
- rewriting Amendment-06 actual-UTC clock rules.

## 7. Real late-season regression requirement

A focused machine regression must preserve the real T4R1 late-season contradiction that exposed this handoff.

Using the frozen T4R1 planting window, all six frozen FAO-56 maize variants, and the Amendment-06 T-6h / T+30h guard, the historical selector must prove that at the 2026-09-19 real activation boundary there is no eligible future 24-slot window before the lifecycle horizon when the current governed water-use stage is LATE.

The regression must also prove that:

- the new arm selector does not use that historical calendar envelope as future Formal-v5 stage truth;
- the 36-hour governance lead remains enforced;
- O23 must remain within the lifecycle horizon;
- stage pins remain deferred;
- the downstream manifest still requires effective stage authority coverage through O23.

A synthetic arm selftest alone is insufficient.

## 8. Production and persistence non-effects

This amendment and its qualification may not:

- restart current production owners;
- mutate owner leases;
- arm Formal-v5 in GitHub Actions;
- mutate the Formal-v5 database;
- materialize schema;
- promote A0 evidence;
- bootstrap A0;
- start O00;
- issue provider requests;
- claim MCFT-CAP-09 completion.

The current `67bfdc5216ccc210c6479548297dd284bcb6a3f6` production owners may continue running while this successor is qualified. A later protected-main merge changes the exact execution subject and therefore requires the normal exact-main production-owner refresh before a new real arm attempt.

## 9. Success effect

If this amendment and its focused implementation merge to protected `main` with exact-head qualification:

```text
FORMAL_V5_EPOCH_STAGE_AUTHORITY_HANDOFF = EFFECTIVE

Formal-v5 arm:
  selects clock only under Amendment-06 timing/lifecycle rules

Future Formal-v5 stage truth:
  DT02 / A18 effective current Biological Stage Authority

Stage pin freeze:
  post-arm / pre-A0 only
  must cover A0 through O23

historical Formal-v4:
  unchanged

DT02:
  unchanged

Formal-v5 database mutation:
  not authorized by this amendment

A0:
  not authorized by this amendment

O00:
  not authorized by this amendment
```

Next legal frontier after merge and exact-main production-owner refresh:

`ARM_FRESH_V5_EPOCH -> POST_ARM_STAGE_AUTHORITY_CONTINUITY -> A0 PRECONDITIONS`
