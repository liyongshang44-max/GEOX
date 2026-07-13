# GEOX MCFT-CAP-04 S8 Restart, Backfill and Failure-Recovery Contract

## Identity

```text
contract_id: MCFT_CAP_04_RESTART_BACKFILL_FAILURE_RECOVERY_V1
delivery_slice: MCFT-CAP-04.MCFT-03-04-07-09-10.RESTART-BACKFILL-FAILURE-RECOVERY-V1
baseline: bdc3e93ce755e237655f7bfc98b117a6e842d030
runtime_mode: REPLAY
```

## Restart authority

Restart starts exclusively from `PrepareNextTickInputServiceV1.resumeFromCheckpointV1`. The persisted checkpoint, terminal Tick, posterior State, latest Forecast result, latest successful Forecast, Runtime Config and Reality Binding are authority. Wall-clock time, caller-provided prior State and reconstruction from projections are forbidden.

The standard proof is `12 ticks -> fresh service composition -> 12 ticks`. Process 1 ends at checkpoint sequence 60. The fresh composition starts at `2026-06-03T14:00:00.000Z`, ends at sequence 72 and hands off `2026-06-04T02:00:00.000Z`. All 24 A1 aggregate hashes and all 24 Scenario Set aggregate hashes must equal uninterrupted execution.

## Bounded forward backfill

Backfill is forward-only missed-schedule catch-up. Its requested start, when supplied, must equal the persisted `next_tick_logical_time`. Backfill before bootstrap, backward execution, skipped hours and late-Evidence revision are rejected. Completed-target retry returns `ALREADY_COMPLETE` with zero Evidence loads and zero canonical writes.

## Lease and fencing

A fresh process may take authority only after the previous lease has expired or otherwise been lawfully released. The new process acquires a new fencing token. Stale token, foreign owner, expired claim and checkpoint/state/Forecast CAS mismatch fail closed before canonical writes.

## Failure matrix

- A1 committed and response lost: recover canonical A1, create only missing B, no duplicate A facts.
- B committed and response lost: return existing canonical A1+B, no duplicate B fact.
- A1 committed and B failed before commit: pending-Scenario barrier creates B before any new tick reads Evidence.
- Legal A2: return explicit `BLOCKED`, stop the range, write no B and preserve the prior successful-Forecast pointer.
- A1/A2 cross-variant conflict: reject the second terminal variant.
- Scenario Set conflict: reject a second canonical Scenario Set for the same Forecast authority.
- Projection divergence: restart fails closed. Repair is an explicit operator-invoked rebuild from append-only canonical facts; automatic repair in the restart orchestrator is forbidden.

## Implementation boundary

The S8 service is a thin intent and persisted-authority validator. It delegates execution to `Cap04ForecastScenarioRangeServiceV1`. A second tick loop, direct persistence, new canonical object types, new transaction families, migrations, routes, scheduler, web behavior and late-Evidence revision are forbidden.

## Validation evidence

```text
in-memory restart/backfill and failure recovery: 29251031846 PASS
PostgreSQL uniqueness/rebuild and fencing/CAS: 29251564080 PASS
PostgreSQL fresh-process restart: 29252000320 PASS
final S8 Governance Gate: 29252432954 PASS
```

## Preserved nonclaims

S8 does not establish continuous Runtime, live-field operation, recommendation, decision, AO-ACT, calibration, model activation, MCFT Gate A closure or Minimum Complete Field Twin completion.
