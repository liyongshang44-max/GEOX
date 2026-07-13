<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-INTEGRATION-V1.md -->

# GEOX MCFT-CAP-04 S6 — Single-Tick Forecast/Scenario Integration V1

## Identity

```text
baseline merged main: 63c8ba7b8dd314c1224ca8de2914b663b3551092
branch: agent/mcft-cap-04-s6-single-tick-integration-v1
delivery slice: MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
```

## Established chain

S6 executes exactly one caller-requested Replay logical tick. The service reads the persisted CAP-03 handoff, validates the pinned CAP-04 Runtime Config, loads current canonical Evidence, reuses the established hourly Dynamics and observation Assimilation mathematics, constructs CAP-04 State source members, selects one coherent 72-hour Future Forcing window, computes one successful 72-hour Forecast, atomically commits A1, computes exactly three Scenario options, atomically commits B, reads both canonical results back, and verifies the T+1 handoff.

## Recovery semantics

A completed A1+B replay returns the existing canonical result before Evidence, Runtime Config, lease, readback or write work. If A1 exists and B is absent, the service revalidates the requested Runtime Config, recomputes deterministic Forecast/Scenario semantics from canonical A1 State plus the same eligible forcing authority, and commits B only. The original terminal tick is never recommitted.

## PostgreSQL proof

The isolated PostgreSQL acceptance seeds a real CAP-03 sequence-48 handoff, compiles the next CAP-04 Runtime Config, runs the production next-tick, Runtime Config and A1/B repositories, verifies one successful A1+B chain, verifies zero duplicate facts on completed replay, injects a B failure after A1, detects the pending Scenario condition, and verifies B-only recovery.

## Preserved nonclaims

S6 does not implement the 24-tick CAP-04 range, restart/backfill, routes, web, scheduler, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
