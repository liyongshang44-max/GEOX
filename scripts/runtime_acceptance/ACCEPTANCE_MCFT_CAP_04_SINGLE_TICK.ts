// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK.ts
// Purpose: provide the v0.5 exact single-tick acceptance entrypoint while reusing the validated CAP-04 integration and negative suites.
// Boundary: wrapper only; no duplicated tick loop, persistence implementation, route, scheduler, recommendation, decision, action, calibration, or live-field claim.

await import("./ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts");
await import("./ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts");
