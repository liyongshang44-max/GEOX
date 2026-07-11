<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-RESTART-BACKFILL-RECOVERY.md -->
# GEOX MCFT-CAP-03 S6 — Restart, Backfill and Recovery

## 1. Activation scope

This artifact freezes the implementation boundary for:

`MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1`

Activation baseline:

`8190e93f3b520ce15dcbe40b2a92e759176ef9a1`

S5 implementation merge:

`aa781f94d752337e3d06ff8b7dceb7b2e2b7c56c`

S5 postmerge effectiveness merge:

`8190e93f3b520ce15dcbe40b2a92e759176ef9a1`

S5 merged-main Gate:

`PASS_110_OF_110`

S5 isolated PostgreSQL acceptance:

`PASS_9_OF_9`

This activation PR contains no Runtime implementation.

## 2. Frozen restart and resume proof

The standard Replay proof must execute the same 24 observation-aware hourly ticks already frozen by S5:

- process 1 commits ticks 1–12: `2026-06-02T02:00:00.000Z` through `2026-06-02T13:00:00.000Z`
- a fresh process resumes ticks 13–24: `2026-06-02T14:00:00.000Z` through `2026-06-03T01:00:00.000Z`
- checkpoint sequence remains `25..48`
- next handoff remains `2026-06-03T02:00:00.000Z`
- restarted and uninterrupted canonical hashes must be identical for all 24 A2 record sets
- a bounded forward backfill from persisted next-tick authority must produce the same canonical hashes

Restart authority must come only from persisted checkpoint and canonical readback. Wall-clock-derived logical time is forbidden.

## 3. Runtime composition

S6 may add one thin assimilated restart/resume and bounded-forward-backfill orchestrator.

The orchestrator must reuse:

- `PreparedRestartInputV1`
- `PostgresNextTickRepositoryV1`
- `NextTickInputServiceV1`
- `AssimilatedContiguousRangeServiceV1.runAssimilatedContiguousRangeV1`
- `PostgresAssimilatedRuntimeRepositoryV1`
- existing A2 lease, fencing, CAS, idempotency, canonical readback, fault injection, and five-projection rebuild behavior

The orchestrator must not add a second tick loop, write directly to persistence, repair projections automatically, revise late Evidence, derive logical time from the wall clock, expose a route, or create a scheduler.

## 4. Frozen recovery proof

Acceptance must prove:

- precommit process crash rolls back with no partial facts and no projection advance
- postcommit response loss resolves as idempotent canonical success without duplicate facts
- stale fencing fails closed
- State/checkpoint/Forecast CAS conflict fails closed
- projection divergence fails closed
- explicit canonical five-projection rebuild restores canonical readback
- late Evidence does not trigger recomputation or revision

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
- Policy
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

S7 remains blocked.

MCFT-CAP-04 remains unauthorized.

## 7. Activation effectiveness

Before the activation PR merges and the merged-main activation Gate passes:

- activation effective = false
- implementation authorized = false
- Runtime source changes are forbidden

Only after activation effectiveness is established may the implementation branch be created from the activation closure baseline.
