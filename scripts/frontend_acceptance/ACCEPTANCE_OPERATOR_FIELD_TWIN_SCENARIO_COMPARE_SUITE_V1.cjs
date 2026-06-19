// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_SUITE_V1.cjs
// Purpose: run the full H23 Operator Field Twin Scenario Compare acceptance suite.
// Boundary: H23 ends at scenario_compare_v1, ScenarioCompareTable, runtime shape, and scenario availability normalization.

const { spawnSync } = require("child_process");

const STEPS = [
  {
    name: "H23-A canonical scenario compare contract",
    command: "pnpm",
    args: ["run", "ci:frontend:operator-field-twin-scenario-compare-canonical"],
  },
  {
    name: "H23-B runtime scenario compare shape",
    command: "pnpm",
    args: ["run", "ci:runtime:operator-field-twin-scenario-compare-shape"],
  },
  {
    name: "H22 regression forecast panel suite",
    command: "pnpm",
    args: ["run", "ci:h22:operator-field-twin-forecast-panel"],
  },
];

function runStep(step) {
  console.log("[h23-suite] RUN " + step.name);

  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error("[h23-suite] FAIL " + step.name);
    process.exit(result.status || 1);
  }

  console.log("[h23-suite] PASS " + step.name);
}

function main() {
  for (const step of STEPS) {
    runStep(step);
  }

  console.log("[h23-suite] PASS operator field twin scenario compare suite v1");
}

main();
