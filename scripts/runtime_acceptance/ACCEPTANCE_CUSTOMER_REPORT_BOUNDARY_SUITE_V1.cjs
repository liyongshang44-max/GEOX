// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs
// Purpose: run the complete customer report boundary suite from one CI entrypoint.
// Boundary: customer report route/API/frontend-payload/runtime-auth/runtime-payload guards must not drift apart.
// Drift guard: each package script must be pinned to its exact expected acceptance file.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const SUITE_SCRIPT_NAME = "ci:customer-report-boundary-suite";
const SUITE_SCRIPT_COMMAND = "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs";

const REQUIRED_SCRIPT_MAP = {
  "ci:frontend:customer-operator-inventory-boundary":
    "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_OPERATOR_INVENTORY_BOUNDARY_V1.cjs",

  "ci:frontend:customer-report-route-contract":
    "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_ROUTE_CONTRACT_V1.cjs",

  "ci:frontend:customer-report-api-consumption-contract":
    "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_API_CONSUMPTION_CONTRACT_V1.cjs",

  "ci:frontend:customer-report-payload-boundary":
    "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_PAYLOAD_BOUNDARY_V1.cjs",

  "ci:runtime:customer-report-auth-boundary":
    "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RUNTIME_AUTH_BOUNDARY_V1.cjs",

  "ci:runtime:customer-report-payload-boundary":
    "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RUNTIME_PAYLOAD_BOUNDARY_V1.cjs",
  "ci:customer-dashboard-aggregate-server-contract":
    "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_DASHBOARD_AGGREGATE_SERVER_CONTRACT_V1.cjs",
  "ci:customer-report-server-projector-contract":
    "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_PROJECTOR_CONTRACT_V1.cjs",
};

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function loadPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

function scriptCommandToFilePath(command) {
  const prefix = "node ";

  assert(command.startsWith(prefix), "customer report boundary suite expected node script command", {
    command,
  });

  return command.slice(prefix.length).trim();
}

function assertScriptPinned(pkg, scriptName, expectedCommand) {
  const actualCommand = pkg.scripts && pkg.scripts[scriptName];

  assert(typeof actualCommand === "string", "customer report boundary suite required package script missing", {
    scriptName,
  });

  assert(actualCommand.trim() === expectedCommand, "customer report boundary suite package script drifted", {
    scriptName,
    expectedCommand,
    actualCommand,
  });

  const expectedFilePath = scriptCommandToFilePath(expectedCommand);

  assert(fs.existsSync(path.join(ROOT, expectedFilePath)), "customer report boundary suite pinned guard file missing", {
    scriptName,
    expectedFilePath,
  });
}

function assertSuiteInputs() {
  const pkg = loadPackageJson();

  assertScriptPinned(pkg, SUITE_SCRIPT_NAME, SUITE_SCRIPT_COMMAND);

  for (const [scriptName, expectedCommand] of Object.entries(REQUIRED_SCRIPT_MAP)) {
    assertScriptPinned(pkg, scriptName, expectedCommand);
  }
}

function runPnpmScript(scriptName) {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  console.log("[customer-report-boundary-suite] RUN " + scriptName);

  const result = spawnSync(pnpmCmd, ["run", scriptName], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  assert(result.status === 0, "customer report boundary suite child script failed", {
    scriptName,
    status: result.status,
    signal: result.signal,
  });
}

function main() {
  assertSuiteInputs();

  for (const scriptName of Object.keys(REQUIRED_SCRIPT_MAP)) {
    runPnpmScript(scriptName);
  }

  console.log("[customer-report-boundary-suite] PASS");
}

try {
  main();
} catch (error) {
  console.error("[customer-report-boundary-suite] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
