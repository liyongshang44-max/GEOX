// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs
// Purpose: run the complete customer report boundary suite from one CI entrypoint.
// Boundary: customer report route/API/frontend-payload/runtime-auth/runtime-payload guards must not drift apart.

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const REQUIRED_FILES = [
  "scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_OPERATOR_INVENTORY_BOUNDARY_V1.cjs",
  "scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_ROUTE_CONTRACT_V1.cjs",
  "scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_API_CONSUMPTION_CONTRACT_V1.cjs",
  "scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_PAYLOAD_BOUNDARY_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RUNTIME_AUTH_BOUNDARY_V1.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RUNTIME_PAYLOAD_BOUNDARY_V1.cjs",
];

const REQUIRED_PACKAGE_SCRIPTS = [
  "ci:frontend:customer-operator-inventory-boundary",
  "ci:frontend:customer-report-route-contract",
  "ci:frontend:customer-report-api-consumption-contract",
  "ci:frontend:customer-report-payload-boundary",
  "ci:runtime:customer-report-auth-boundary",
  "ci:runtime:customer-report-payload-boundary",
];

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function loadPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

function assertSuiteInputs() {
  for (const rel of REQUIRED_FILES) {
    assert(fs.existsSync(path.join(ROOT, rel)), "customer report boundary suite required file missing", { rel });
  }

  const pkg = loadPackageJson();

  for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
    assert(pkg.scripts && typeof pkg.scripts[scriptName] === "string", "customer report boundary suite required package script missing", {
      scriptName,
    });
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

  for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
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
