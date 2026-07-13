// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FORECAST_MATH.ts
// Purpose: provide the v0.5 exact Forecast-math acceptance entrypoint while reusing the already validated positive and negative CAP-04 Forecast suites.
// Boundary: wrapper only; no duplicated Forecast equations, persistence, route, scheduler, recommendation, decision, action, calibration, or live-field claim.

await import("./ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts");
await import("./ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts");
