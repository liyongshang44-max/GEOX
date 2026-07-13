// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_24_TICK.ts
// Purpose: provide the v0.5 exact 24-tick acceptance entrypoint while reusing the validated contiguous-range positive and negative suites.
// Boundary: wrapper only; no duplicated range loop, persistence implementation, route, scheduler, recommendation, decision, action, calibration, or live-field claim.

await import("./ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE.ts");
await import("./ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts");
