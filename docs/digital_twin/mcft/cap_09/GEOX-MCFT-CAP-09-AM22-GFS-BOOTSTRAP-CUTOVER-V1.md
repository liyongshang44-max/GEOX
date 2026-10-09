# MCFT CAP-09 AM22 short-A0 GFS bootstrap seam

Status: **engineering orchestration; no host execution is performed by CI**.

## Why this exists

The adopted six-phase host measurement requires the canonical same-cycle GFS weather + ET0 pair for its selected A0 to already exist in the operational Evidence store. The AM22 V2 pre-Formal Evidence handoff, however, is guarded by the fully effective AM22 start policy. That creates a bootstrap dependency: complete pre-A0 measurement needs the new A0 GFS pair, while the V2 Evidence process that would acquire that pair cannot start until complete pre-A0 qualification is already effective.

The older V1 Evidence handoff does not solve this. It selects its Evidence epoch from the retired 36-hour governance-lead clock, while the current current-crop authority has 30 hours of forward stability. Its target therefore cannot be the near-term A0 that the six-phase measurement must prove.

## Bounded solution

This seam does **not** add a new evidence provider, target policy, retry semantic, database writer, Twin kernel, scheduler semantic, schema, or authority domain. It reuses the already-authorized:

- production local owner-cutover authority;
- pre-Formal A0 Evidence target-planning authority;
- runtime-start authority builder;
- production Evidence process and its existing GFS planner/provider/lease/fencing path;
- Twin pre-Formal owner standby;
- production artifact attestation and live-owner verifier.

The only new runtime wrapper validates the existing owner-cutover authority and then passes the short-A0 base runtime-start authority to the existing production Evidence process. It intentionally does not load the old 36-hour Formal-v5 Evidence handoff.

## Operator sequence

The local runner is effectful only when explicitly invoked with `--operator-authorized`. It requires clean exact protected main and the exact current host binding. It reads the operational database clock, uses the frozen forcing-acquisition budget to select the next whole-hour A0, and requires the latest effective registry authority to cover A0 through O23.

It first uses local operator-host UTC, as required by the existing pre-Formal A0 planning authority, and fail-closes if the operational database clock differs by more than 60 seconds. It then:

1. writes local runtime-start and owner-cutover authority instances whose later authority ceiling remains false;
2. builds and attests the exact-main Runtime image and records the build duration;
3. recreates the existing Evidence and Twin pre-Formal owner services with the same project/service identities;
4. measures the live dual-owner cutover;
5. waits only until A0 minus the six-phase minimum lead for the exact A0 weather + ET0 pair;
6. requires same selected GFS cycle and same retained raw bundle;
7. proves the Twin remains pre-Formal with zero state/scheduler rows;
8. emits `six-phase-input.json` for the existing six-phase measurement.

If exact-one owner verification fails, the runner follows the existing owner-cutover authority and performs the required dual-service Compose rollback attempt before failing. After owner verification has passed, a later GFS-seed failure does not silently perform a second owner mutation; it writes a fail receipt and leaves reconciliation explicit. The receipt records whether rollback was required, attempted and successful.

## Hard nonclaims

This seam does not consume Formal-v5 database credentials, write the Formal database, write Formal raw storage, ARM Formal-v5, execute A0, start O00, or complete CAP-09. A successful bootstrap only proves that the real production owner cutover and the exact near-term GFS causal seed have been obtained for the subsequent six-phase measurement.

The six-phase measurement remains independently required. Formal raw retention/promotion timing and the final complete production-equivalent preparation-envelope adjudication remain separately required before AM22 can become effective.
