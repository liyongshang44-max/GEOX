<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md -->
# GEOX MCFT-CAP-03 S6 — Restart, Backfill and Recovery

## 1. Effective implementation scope

This artifact governs the implementation boundary for:

`MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1`

Activation baseline:

`8190e93f3b520ce15dcbe40b2a92e759176ef9a1`

Activation PR:

`#2344`

Activation locked head:

`23c84a2a6338ea40295bbade2a18c428f434f672`

Activation exact-head CI:

`CI_4715_SUCCESS`

Activation merge:

`41316ace4d332273150b3cd7ce7548304862b33d`

Activation effectiveness merge and implementation baseline:

`5070d350238fa3af8fcc5bab43cc14bba8e7a3c8`

Merged-main activation Gate:

`PASS_81_OF_81`

The implementation branch may change only the nine frozen files in section 5.

## 2. Frozen restart and resume proof

The standard Replay proof executes the same 24 observation-aware hourly ticks frozen by S5:

- process 1 commits ticks 1–12: `2026-06-02T02:00:00.000Z` through `2026-06-02T13:00:00.000Z`
- a fresh service composition resumes ticks 13–24: `2026-06-02T14:00:00.000Z` through `2026-06-03T01:00:00.000Z`
- checkpoint sequence remains `25..48`
- next handoff remains `2026-06-03T02:00:00.000Z`
- restarted and uninterrupted canonical hashes are identical for all 24 A2 record sets
- bounded forward catch-up from persisted next-tick authority produces the same canonical hashes

Restart authority comes only from persisted checkpoint and canonical readback. Wall-clock-derived logical time is forbidden.

## 3. Runtime composition

S6 adds one thin orchestrator:

`apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.ts`

The orchestrator reuses:

- `PreparedRestartInputV1`
- `PostgresNextTickRepositoryV1`
- `PrepareNextTickInputServiceV1.resumeFromCheckpointV1`
- `AssimilatedContiguousRangeServiceV1.runAssimilatedContiguousRangeV1`
- `PostgresAssimilatedRuntimeRepositoryV1`
- existing A2 lease, fencing, CAS, idempotency, canonical readback, fault injection, and five-projection rebuild behavior

The orchestrator contains no tick loop and no persistence call. It validates operator intent, reads persisted restart authority, delegates one bounded range, and verifies that the delegated range began at the same persisted next logical tick.

It does not repair projections automatically, revise late Evidence, derive logical time from the wall clock, expose a route, or create a scheduler.

## 4. Frozen recovery proof

Acceptance proves:

- precommit process crash rolls back with no canonical commit and no projection advance
- postcommit response loss resolves as idempotent canonical success without duplicate facts or lease acquisition
- stale fencing fails closed through the reused PostgreSQL persistence contract
- State/checkpoint/Forecast CAS conflict fails closed through the reused PostgreSQL persistence contract
- projection divergence prevents restart
- explicit canonical five-projection rebuild remains the only repair path
- late Evidence is rejected before checkpoint read, Evidence evaluation, or range execution
- completed-target resume and backfill perform zero mutation

## 5. Frozen implementation file boundary

1. `apps/server/src/runtime/twin_runtime/assimilated_restart_resume_service_v1.ts`
2. `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY-STATUS.json`
3. `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md`
4. `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json`
5. `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.cjs`
6. `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY.ts`
7. `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_NEGATIVE.ts`
8. `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_RESTART_BACKFILL_RECOVERY_DB.ts`
9. `scripts/runtime_acceptance/mcft_cap_03_restart_backfill_recovery_fixture_v1.ts`

No migration, route, scheduler, web, workflow, new canonical object type, new transaction family, new projection, CAP-02 Runtime mutation, successful Forecast, or late-Evidence revision is authorized.

## 6. Preserved boundaries

S6 does not establish:

- successful Forecast
- 72-hour Forecast
- Scenario
- Recommendation
- Policy Evaluation
- Decision
- AO-ACT
- calibration
- shadow evaluation
- model activation
- active model parameter change
- late-Evidence revision
- continuous Runtime
- live-field operation
- MCFT-CAP-03 completion
- Minimum Complete Field Twin

S7 remains blocked until the S6 implementation PR merges and the merged-main S6 implementation Gate passes.

MCFT-CAP-04 remains unauthorized.

## 7. Activation effectiveness

Activation effectiveness is established by:

- activation PR `#2344` merged
- activation CI `#4715` passed on locked head
- activation merge `41316ace4d332273150b3cd7ce7548304862b33d`
- effectiveness PR `#2345` merged
- effectiveness merge `5070d350238fa3af8fcc5bab43cc14bba8e7a3c8`
- synchronized-main activation Gate `81 PASS, 0 FAIL`

Therefore:

- activation effective = true
- implementation authorized = true
- implementation branch baseline = `5070d350238fa3af8fcc5bab43cc14bba8e7a3c8`

## 8. Implementation effectiveness condition

Implementation claims remain pending until all of the following are true:

1. Draft and Final S6 implementation Gates pass on one locked implementation head.
2. Positive, negative, source-shape, server typecheck, and isolated PostgreSQL acceptance pass.
3. Exact-head CI succeeds.
4. The implementation PR merges to `main`.
5. A governance-only effectiveness closure records the implementation evidence.
6. The synchronized-main S6 implementation Gate passes in `--postmerge` mode.

Before that condition is satisfied, S7 remains blocked and no S6 completion claim is effective.
