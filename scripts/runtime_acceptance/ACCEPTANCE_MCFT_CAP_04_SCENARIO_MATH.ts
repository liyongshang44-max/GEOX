// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts
// Purpose: provide the v0.5 exact Scenario-math acceptance entrypoint while reusing the already validated positive and negative CAP-04 Scenario suites.
// Boundary: wrapper only; no duplicated Scenario equations, persistence, route, scheduler, recommendation, decision, action, calibration, or live-field claim.

await import("./ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts");
await import("./ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts");
