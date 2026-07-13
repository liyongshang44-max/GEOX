<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-INTEGRATION-V1.md -->

# GEOX MCFT-CAP-04 S6 — Single-Tick Forecast/Scenario Integration V1

## Identity

```text
baseline merged main: 63c8ba7b8dd314c1224ca8de2914b663b3551092
branch: agent/mcft-cap-04-s6-single-tick-integration-v1
delivery slice: MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1
status: REMEDIATED_AND_VALIDATED_PENDING_MERGE
runtime source authorized: true
```

## Canonical entry boundary

The canonical S6 entry is the pending-Scenario barrier wrapped around exactly one caller-requested Replay tick. Before current-tick Evidence is read, the barrier resolves the immediately previous checkpoint's exact `forecast_result_ref`. A completed CAP-04 Forecast without B is recovered first. A blocked or non-CAP-04 predecessor has no pending-B obligation.

The successful path is:

```text
persisted handoff
→ previous-checkpoint pending-B barrier
→ current canonical Evidence
→ Dynamics
→ Assimilation
→ posterior State
→ coherent 72-hour Future Forcing
→ canonical Forecast authority
→ successful A1
→ three Scenario options
→ B
→ canonical readback
→ T+1 handoff
```

## Canonical Forecast authority

A successful Forecast persists the complete authority required to reproduce and verify its semantics without transient process state:

```text
exact Future Forcing window
72 forcing points and snapshot identities
72 uncertainty traces
72 physical-bound and interval-bound traces
trajectory hash
aggregate metrics
uncertainty basis
```

Forecast validation requires full-field equality with the embedded Future Forcing authority. Comparing only a forcing hash or cycle key is insufficient.

## Forcing outcomes

Future Forcing has three distinct outcomes:

```text
SELECTED
→ successful 72-hour Forecast
→ A1

no complete matching pair, but candidate data is structurally valid
→ BLOCKED
→ legal A2 with zero Forecast points
→ no Scenario Set

malformed or conflicting forcing authority
→ FAILED
→ no A1, no A2, no B
```

A2 advances State, checkpoint and latest Forecast-result authority while preserving the previous latest-successful-Forecast pointer.

## Recovery semantics

A completed A1+B replay returns the existing canonical result without Evidence, Runtime Config, lease, canonical readback or write work.

If A1 exists and B is missing, B is reconstructed from the persisted canonical Forecast authority. Weather/ET0 Evidence is not reloaded or reselected. The original A1 terminal tick is never recommitted.

A1/A2 and B guards are rebuildable. If idempotency or uniqueness guards are deleted, the repository recovers A from the canonical terminal Tick root and recovers B from the canonical Scenario Set fact, repairs the guards, and rejects a second terminal variant or second Scenario Set.

Pending-B authority is exclusively:

```text
latest persisted checkpoint
→ checkpoint.forecast_result_ref
→ exact immediately previous Forecast
```

The latest-successful-Forecast projection is not used as a substitute for the previous checkpoint Forecast.

## Read dispatch

CAP-04 next-tick readback dispatches by exact record-set contract ID, operation variant and canonical Forecast authority contract. Payload-shape guessing, point-count inference and silent fallback are forbidden.

## PostgreSQL proof

The isolated PostgreSQL remediation acceptance proves:

```text
full-authority A1+B from a real CAP-03 sequence-48 handoff
legal A2 when a complete forcing pair is unavailable
deleted A/B guards recover from canonical facts with zero duplicate facts
deleted guards still reject a second terminal variant
deleted guards still reject a second Scenario Set
B failure followed by changed forcing candidates recovers B with zero Evidence reload
```

Strict remediation workflow `29243149582` passed. Bounded PostgreSQL diagnostic workflow `29243149618` exited `0` with `6 PASS, 0 FAIL`.

## Preserved nonclaims

S6 does not implement the 24-tick CAP-04 range, restart/backfill, routes, web, scheduler, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion. S7 remains blocked until S6 is merged and the merged-main S6 Gate passes.
