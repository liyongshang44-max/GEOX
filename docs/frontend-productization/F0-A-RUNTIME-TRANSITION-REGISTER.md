<!-- docs/frontend-productization/F0-A-RUNTIME-TRANSITION-REGISTER.md -->
# F0-A Runtime Transition Register

## Purpose

Runtime Transition Register prevents frontend readiness from being mistaken for runtime readiness.

Frontend Productization is not Runtime Readiness.
Frontend Release Readiness is not live production.
Runtime Readiness starts at R1.

## Frontend nonclaims

F0-A records these frontend nonclaims:

```text
not live production runtime
not live device connected
not real device deployed
not production gateway online
not continuous runtime monitoring active
not field pilot execution started
not field pilot started
not AO-ACT dispatch enabled
not ROI computed
not Field Memory learned
not online state estimation active
not online state estimation loop active
not forecast calibration loop active
```

These nonclaims apply to H67 release surfaces and F0-A registers. The frontend can display replay-backed or checked-in snapshots, but that does not start a production runtime loop.

## R-series transition

Runtime readiness should proceed through these stages:

```text
R1 Runtime Evidence Stream Readiness
R2 Online State Estimation Loop
R3 Forecast Calibration & Residual Loop
R4 Runtime Health Service Gate
R5 Field Pilot Runtime Readiness
```

## R1 handoff seed

R1 should start from evidence stream readiness, not from frontend page expansion.

R1 should define:

```text
evidence source identity
timestamp semantics
freshness
replay equivalence
missing behavior
delayed behavior
acceptance
```

R1 should not create recommendations, dispatch, AO-ACT, ROI, Field Memory, or model updates.

## Transition boundary

F0-A prepares the handoff from frontend productization to runtime readiness.

F0-A does not start R1.
F0-A does not create evidence streams.
F0-A does not create online estimators.
F0-A does not create forecast calibration.
F0-A does not create Runtime Health Service.
F0-A does not start field pilot runtime readiness.
