// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_MATH.ts
// Purpose: provide the v0.5 exact Scenario-math acceptance entrypoint while reusing the already validated positive and negative CAP-04 Scenario suites.
// Boundary: wrapper only; no duplicated Scenario equations, persistence, route, scheduler, recommendation, decision, action, calibration, or live-field claim.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
  "ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts",
  "ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts",
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
