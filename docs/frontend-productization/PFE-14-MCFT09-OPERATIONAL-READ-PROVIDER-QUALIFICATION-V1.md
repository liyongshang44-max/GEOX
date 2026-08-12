# PFE-14 / MCFT-CAP-09 Operational Read Provider Qualification v1

Status: PROVIDER QUALIFIED FOR NARROW FRONTEND CONSUMPTION / PFE-14 S4 NOT EFFECTIVE  
Qualified subject: `8841cb8adbbc6829bac773bd8252fa4d675da031`

## Ruling

The GET-only MCFT-CAP-09 operational read provider is qualified as the authoritative product source for exactly two PFE-14 read models:

- `scheduler_summary`
- `evidence_availability`

This qualification does not make PFE-14 S4 effective and does not authorize a `SHADOW_ONLINE` Runtime Context claim.

The first legal frontend implementation step is now:

`PFE_14_S4_IMPLEMENT_SINGLE_SCOPE_SCHEDULER_EVIDENCE_READBACK`

It may modify only the existing canonical PFE-14 Runtime API client and the existing exact-Scope Field Runtime Overview presentation needed to consume these two read models. No new frontend route family is required or authorized.

## Exact-head qualification evidence

Focused workflow run: `31563462731`  
Exact candidate head: `8841cb8adbbc6829bac773bd8252fa4d675da031`  
Artifact id: `9128580507`  
Artifact digest: `sha256:f1ccde58651a14af46674d67440fdb234abb561617bb3542361cc92caaa2c05a`

The run passed:

1. parent dependency authority acceptance;
2. provider governance acceptance;
3. real PostgreSQL operational read acceptance;
4. server typecheck;
5. artifact upload.

The provider is registered by the frozen canonical Runtime route owner:

`apps/server/src/routes/v1/mcft_field_twin_read_v1.ts#registerMcftFieldTwinReadRoutesV1`

There is no second `/runtime/*` route owner.

## Frontend consumption authority

The frontend may call:

`GET /api/v1/operator/twin/fields/:field_id/runtime/operational-summary`

using the already-governed exact six-key Scope.

The frontend may display returned Scheduler fields and Evidence Availability fields exactly as supplied by the server. Presentation-only formatting is allowed, but semantic recomputation is not.

The browser must not:

- calculate scheduler lag from its own clock;
- calculate freshness or freshness thresholds;
- infer a Scheduler slot that the server did not return;
- convert `claimed_at` into Runtime tick-start time;
- infer restart/recovery history;
- infer `runtime_mode = SHADOW_ONLINE` from provider availability;
- convert operational provider state into canonical Twin truth.

Null remains null. A missing or unavailable authority must remain visibly unavailable rather than receiving a design/sample fallback.

## Why S4 remains incomplete

The PFE-14 S4 taskbook contains more than the Scheduler/Evidence dependency:

- single exact Scope overview;
- latest / next slot;
- Evidence eligibility / freshness;
- 24-hour O00–O23 strip;
- Runtime Context binding.

This qualification only closes the backend dependency for Scheduler + Evidence Availability.

The 24-hour strip may be rendered structurally, but the frontend may not invent per-slot state that is not returned by a qualified product contract.

Runtime Context remains governed by the existing static nonclaim boundary until a later authority establishes a dynamic context source. Therefore:

- `shadow_online_label_authorized = false`;
- `authoritative_runtime_context_authorized = false`;
- `s4_effective = false`.

## Next gate

After the narrow frontend readback implementation passes exact-head frontend/build/acceptance checks, a separate S4 adjudication must decide whether the product slice is complete or whether Runtime Context / O00–O23 status authority remains outstanding.
