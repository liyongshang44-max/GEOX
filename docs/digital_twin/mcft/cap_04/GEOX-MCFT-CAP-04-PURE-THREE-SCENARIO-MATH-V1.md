<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-THREE-SCENARIO-MATH-V1.md -->

# GEOX MCFT-CAP-04 S4 — Pure Three-Scenario Math V1

## Identity

```text
baseline merged main: 4a1c9fde05594c97fb949e062df77375a1a27365
branch: agent/mcft-cap-04-s4-pure-three-scenario-math-v1
delivery slice: MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
```

## Established boundary

S4 consumes one completed source Forecast, its already-frozen forcing trace, and one pinned Runtime Config. It emits exactly three pure mathematical options in this order: `NO_ACTION`, `IRRIGATE_NOW_15MM`, `IRRIGATE_NOW_25MM`.

`NO_ACTION.trajectory_points` is an exact deep copy of source Forecast points. The irrigation options inject deterministic assumed irrigation only at horizon 1. Effective irrigation equals requested irrigation multiplied by the Runtime Config efficiency value `1.000000`.

Scenario irrigation is `ASSUMED` and `NOT_EXECUTED`. It has zero modeled irrigation variance. Execution compliance, equipment and application-efficiency uncertainty are not modeled. The Runtime never creates or consumes receipt, as-executed or execution Evidence objects in this slice.

Stress is true only when available-water fraction is strictly less than `0.350000`. Equality is no-stress. Difference fields are option metric minus exact `NO_ACTION` metric.

## Preserved nonclaims

S4 does not append canonical Scenario objects, build A1/A2 record sets, persist A1/A2/B, add migrations, projections, routes or schedulers, or claim recommendation, decision, execution, calibration, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
