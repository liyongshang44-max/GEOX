<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE.md -->
# GEOX MCFT-CAP-03 S5 — Twenty-Four Observation-Aware Tick Range

## 1. Activation scope

This artifact freezes the implementation boundary for:

`MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1`

Activation baseline:

`01f705bec9e79b528480b63fe56c6e6c4489845f`

S4 implementation merge:

`f245b46013174e03ad3a6ed4aff0963973fe0c1a`

S4 closure and merged-main verification commit:

`01f705bec9e79b528480b63fe56c6e6c4489845f`

S4 merged-main Gate:

`PASS_121_OF_121`

This activation PR contains no Runtime implementation.

## 2. Frozen execution range

The standard Replay range contains exactly 24 contiguous hourly ticks:

- first tick: `2026-06-02T02:00:00.000Z`
- last tick: `2026-06-03T01:00:00.000Z`
- next handoff: `2026-06-03T02:00:00.000Z`
- checkpoint sequence: `25..48`
- one A2 transaction per tick
- eight canonical facts per tick
- 192 new A2 canonical facts
- 24 new posterior States
- 24 new immutable assimilation updates
- local predecessor-inclusive State range: 25
- global active-lineage State count: 49

The range starts only from the persisted canonical checkpoint next logical time.

Wall-clock-derived logical time is forbidden.

## 3. Runtime composition

S5 must add a thin observation-aware contiguous range orchestrator.

The orchestrator must reuse:

- `AssimilatedContinuationTickServiceV1.executeOneTick`
- persisted canonical handoff preparation
- S4 observation selection and assimilation
- S4 assimilated record-set builder
- existing A2 atomic persistence
- canonical readback and T+1 handoff

The historical CAP-02 `ContiguousContinuationRangeServiceV1` and its contracts remain immutable.

Each successful iteration must consume the prior iteration's canonical readback handoff.

The range must stop on the first failed tick.

## 4. Standard and independent fixtures

The standard range must contain 24 PASS-quality accepted observations.

Separate fixtures must prove:

- LIMITED observation downweighting
- no usable observation
- innovation outlier rejection
- candidate exclusion
- same-input deterministic replay
- idempotent completed-range replay with zero new writes

Independent fixtures do not alter the standard 24-PASS chain.

## 5. Frozen implementation file boundary

1. `apps/server/src/runtime/twin_runtime/assimilated_contiguous_range_service_v1.ts`
2. `apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts`
3. `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-STATUS.json`
4. `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE.md`
5. `docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json`
6. `scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.cjs`
7. `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE.ts`
8. `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_NEGATIVE.ts`
9. `scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_TWENTY_FOUR_OBSERVATION_AWARE_TICK_RANGE_DB.ts`
10. `scripts/runtime_acceptance/mcft_cap_03_twenty_four_observation_aware_tick_range_fixture_v1.ts`

No migration, route, scheduler, web, workflow, new canonical object type, new transaction family, or new projection is authorized.

## 6. Authorized persistence remediation

The S5 isolated PostgreSQL acceptance established that the first CAP-03 tick committed successfully, while the second tick was rejected because the persisted CAP-03 predecessor Forecast was passed to the immutable CAP-02 member validator.

The following remediation is authorized:

- file: `apps/server/src/persistence/twin_runtime/postgres_assimilated_runtime_repository_v1.ts`
- scope: versioned predecessor validation for CAP-02 and CAP-03 persisted A2 members
- CAP-02 predecessor members continue to use the immutable CAP-02 member validator
- CAP-03 predecessor members must be resolved through their A2 idempotency guard
- the complete CAP-03 record set must pass the existing versioned record-set validator
- every requested predecessor member must belong to that validated record set with the same determinism hash
- unknown record-set contracts, duplicate guards, missing guards for CAP-03-shaped members, incomplete record sets, and hash mismatches fail closed

This remediation does not authorize:

- mutation of CAP-02 contracts or Forecast reason codes
- migration or schema change
- new persistence transaction family
- new projection
- successful Forecast
- restart or backfill behavior
- S6 implementation

## 7. Preserved boundaries

S5 does not establish:

- restart or backfill recovery
- late-evidence recomputation
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
- continuous Runtime
- live-field operation
- MCFT-CAP-03 completion
- Minimum Complete Field Twin

S6 remains blocked.

MCFT-CAP-04 remains unauthorized.

## 8. Activation effectiveness

Before the activation PR merges and the merged-main activation Gate passes:

- activation effective = false
- implementation authorized = false
- Runtime source changes are forbidden

Only after activation effectiveness is established may the implementation branch be created from the activation closure baseline.
