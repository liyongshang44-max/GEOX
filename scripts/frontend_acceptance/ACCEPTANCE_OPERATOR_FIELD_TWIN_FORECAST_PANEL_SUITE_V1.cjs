// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_FORECAST_PANEL_SUITE_V1.cjs
// Purpose: run the full H22 Operator Field Twin Forecast Panel acceptance suite.
// Boundary: H22 ends at forecast_window_v1, ForecastRiskTimeline, runtime shape, and in-window risk preservation.

const { spawnSync } = require("child_process");

const STEPS = [
  {
    name: "H22-A canonical forecast panel contract",
    command: "pnpm",
    args: ["run", "ci:frontend:operator-field-twin-forecast-panel-canonical"],
  },
  {
    name: "H22-B runtime forecast panel shape",
    command: "pnpm",
    args: ["run", "ci:runtime:operator-field-twin-forecast-panel-shape"],
  },
  {
    name: "H21 regression field workspace suite",
    command: "pnpm",
    args: ["run", "ci:h21:operator-field-twin-workspace"],
  },
];

function runStep(step) {
  console.log("[h22-suite] RUN " + step.name);

  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error("[h22-suite] FAIL " + step.name);
    process.exit(result.status || 1);
  }

  console.log("[h22-suite] PASS " + step.name);
}

function main() {
  for (const step of STEPS) {
    runStep(step);
  }

  console.log("[h22-suite] PASS operator field twin forecast panel suite v1");
}

main();
