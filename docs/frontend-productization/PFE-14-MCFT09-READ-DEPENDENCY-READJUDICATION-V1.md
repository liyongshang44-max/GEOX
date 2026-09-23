# PFE-14 / MCFT-CAP-09 Read Dependency Re-adjudication v1

Status: GOVERNANCE ONLY / S4 STILL NOT EFFECTIVE  
Base protected main: `6df2241f1470e1df930498782b42c6ba9e813b41`

## Ruling

PFE-14's old dependency snapshot is stale. It was correct when frozen, but protected main now contains effective MCFT-CAP-09 S4 scheduler/recovery capability and the read-only S2 database Evidence ingress implementation.

This does **not** mean PFE-14 S4 is already unlocked. The missing item has narrowed from "MCFT-9 has not implemented the capability" to "the implemented MCFT-9 capability has not yet been projected through an authorized product GET read contract."

Therefore exactly one new candidate step is authorized:

`MCFT_CAP_09_IMPLEMENT_GET_ONLY_PFE14_OPERATIONAL_READ_PROVIDER_CANDIDATE`

The candidate may expose Scheduler Summary and Evidence Availability only through the existing canonical Operator Runtime API family. It must not create `/operator/shadow/*`, `/operator/mcft9/*`, a writer route, a new Runtime kernel, or frontend-derived verdicts.

## Evidence consumed

### S4 effectiveness

`GEOX-MCFT-CAP-09-S5-REGISTRY-REGISTRATION-V1.json` records the effective S4 predecessor:

- effective subject SHA: `6a4138e77fe6b838bc0f552a0bc5e2ceb84c026f`
- exact-SHA/R2 run: `31108834682`
- artifact: `8970768718`
- semantic digest: `sha256:64e14355edad6e2711cdde26cc3ac2bd6c7795c7e64439b194679350ce7cc80c`

### Scheduler source capability

Protected main contains the S3 operational relations:

- `twin_shadow_online_scheduler_cursor_v1`
- `twin_shadow_online_scheduler_slot_v1`
- `twin_runtime_lease_v1`

and the exact one-scope scheduler/recovery readers. These operational relations are not canonical Twin truth and may only be projected as operational read state.

### Evidence source capability

`PostgresEvidenceIngressAdapterV1` is read-only over governed `facts` and already computes, at an explicit logical boundary:

- selected/excluded Evidence;
- freshest observed time;
- freshness status;
- coverage ratio;
- maximum gap;
- future exclusion;
- late/post-boundary exclusion classes;
- out-of-order Evidence refs.

The product provider must reuse these semantics. It may not implement a second browser/backend freshness algorithm.

## Provider candidate boundary

The candidate route family is fixed to the existing canonical field Runtime namespace:

`GET /api/v1/operator/twin/fields/:field_id/runtime/operational-summary`

Exact six-key Scope remains required:

`tenant_id / project_id / group_id / field_id / season_id / zone_id`

The provider is read-only and may read:

- S3 scheduler cursor/slot/lease operational relations;
- S4 read-only operational recovery inspection;
- S2 read-only Evidence ingress;
- existing persisted Runtime readback only when needed to validate a referenced Runtime state.

It may not call any claim, recovery, terminal-record, canonical commit, recommendation, approval, AO-ACT, dispatch or Model Activation method.

## First provider contract

The first provider candidate is intentionally narrower than all future PFE-14 health surfaces.

It must provide:

### Scheduler Summary

- `scheduler_status`
- `latest_completed_slot`
- `latest_tick_ref`
- `latest_tick_status`
- `latest_tick_started_at`
- `latest_tick_completed_at`
- `next_target_slot`
- `next_target_at`
- `scheduler_lag_ms`

The source clock is PostgreSQL `transaction_timestamp()`, never the browser clock.

`latest_completed_slot` means the latest **terminally resolved scheduler boundary**. Its terminal result remains separately visible in `latest_tick_status`; the field name is retained for PFE-14 S1 contract compatibility.

### Evidence Availability

Evidence is evaluated for one explicit exact-hour eligibility boundary selected by the server:

1. active scheduler slot boundary when an active slot exists;
2. otherwise latest terminal scheduler boundary;
3. otherwise no boundary and `freshness_status = UNKNOWN`.

The server must never evaluate against a future scheduler boundary.

When a boundary exists, the provider reuses `PostgresEvidenceIngressAdapterV1.freezeEligibleEvidence()` for that exact boundary and maps only fields already produced by the adapter.

Required product fields:

- `eligibility_boundary`
- `latest_evidence_observed_at`
- `latest_evidence_ingested_at`
- `evidence_age_ms` measured at the eligibility boundary, not browser-now
- `freshness_status`
- `freshness_threshold_ms`
- `coverage_ratio`
- `maximum_gap_ms`
- `future_excluded_count`
- `late_evidence_count`
- `out_of_order_count`

Mapping rules:

- future exclusion = `OBSERVED_AFTER_BOUNDARY` count;
- late Evidence = `INGESTED_AFTER_BOUNDARY + AVAILABLE_AFTER_BOUNDARY` count;
- out-of-order = `out_of_order_evidence_refs.length`;
- age = `eligibility_boundary - freshest_observed_at`;
- no Evidence boundary or no observed Evidence never creates a synthetic timestamp/count beyond the contract's explicit zero/null/UNKNOWN semantics.

## Explicitly not authorized by this ruling

- dynamic `runtime_mode = SHADOW_ONLINE` product claim;
- PFE-14 page/source/client implementation;
- Scheduler or Evidence UI activation;
- restart-history or recovered-history inference;
- persisted recovery event invention;
- browser freshness/lag calculations;
- Formal O00-O23 claim;
- MCFT-CAP-09 completion claim.

PFE-14 S4 remains ineffective until the provider candidate itself passes focused exact-head qualification and a later PFE authority step explicitly authorizes frontend consumption.
