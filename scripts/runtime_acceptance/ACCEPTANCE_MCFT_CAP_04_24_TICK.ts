// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_24_TICK.ts
// Purpose: provide the v0.5 exact 24-tick acceptance entrypoint while reusing the validated contiguous-range positive and negative suites.
// Boundary: wrapper only; no duplicated range loop, persistence implementation, route, scheduler, recommendation, decision, action, calibration, or live-field claim.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
  "ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE.ts",
  "ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_NEGATIVE.ts",
];

for (const suite of SUITES) {
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(DIRECTORY, suite)], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
