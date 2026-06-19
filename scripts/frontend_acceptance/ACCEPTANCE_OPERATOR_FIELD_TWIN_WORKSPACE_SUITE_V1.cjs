// scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_SUITE_V1.cjs
// Purpose: run the full H21 Operator Field Twin Workspace acceptance suite.
// Boundary: H21 ends at field-centered workspace, runtime shape, overview navigation, evidence summary, and data-gap visibility.

const { spawnSync } = require("child_process");

const STEPS = [
  {
    name: "H21-A canonical field workspace contract",
    command: "pnpm",
    args: ["run", "ci:frontend:operator-field-twin-workspace-canonical"],
  },
  {
    name: "H21-B runtime field workspace shape",
    command: "pnpm",
    args: ["run", "ci:runtime:operator-field-twin-workspace-shape"],
  },
  {
    name: "H21-C overview-to-field navigation",
    command: "pnpm",
    args: ["run", "ci:frontend:operator-field-twin-workspace-navigation"],
  },
  {
    name: "H21-D evidence and data-gap visibility",
    command: "pnpm",
    args: ["run", "ci:frontend:operator-field-twin-workspace-evidence-gap"],
  },
];

function runStep(step) {
  console.log("[h21-suite] RUN " + step.name);

  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error("[h21-suite] FAIL " + step.name);
    process.exit(result.status || 1);
  }

  console.log("[h21-suite] PASS " + step.name);
}

function main() {
  for (const step of STEPS) {
    runStep(step);
  }

  console.log("[h21-suite] PASS operator field twin workspace suite v1");
}

main();
