// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_CI_WIRING_V1.cjs
// Purpose: verify customer report boundary suite is documented and wired into CI.
// Boundary: the suite must not exist only as an unreferenced package script.
// Scope note: cookie-only auth must not be advertised inside the Customer Report Boundary Suite section.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const DOC_PATH = "docs/ci/CI_ACCEPTANCE_SECRETS.md";
const WORKFLOW_PATH = ".github/workflows/ci.yml";
const SUITE_PATH = "scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs";
const SECTION_TITLE = "## Customer Report Boundary Suite";

const SUITE_SCRIPT_NAME = "ci:customer-report-boundary-suite";
const SUITE_SCRIPT_COMMAND = "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs";

const WIRING_SCRIPT_NAME = "ci:customer-report-boundary-suite-wiring";
const WIRING_SCRIPT_COMMAND = "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_CI_WIRING_V1.cjs";

const REQUIRED_DOC_TOKENS = [
  "ci:customer-report-boundary-suite",
  "ci:customer-dashboard-aggregate-server-contract",
  "ci:customer-report-server-projector-contract",
  "GEOX_BASE_URL",
  "GEOX_AO_ACT_TOKEN",
  "GEOX_TOKEN",
  "Authorization: Bearer",
];

const REQUIRED_WORKFLOW_TOKENS = [
  "pnpm run ci:customer-report-boundary-suite-wiring",
  "pnpm run ci:customer-report-boundary-suite",
  "GEOX_BASE_URL=http://127.0.0.1:3001",
  "source .env.ci",
];

const REQUIRED_SUITE_TOKENS = [
  "ci:customer-report-server-projector-contract",
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_PROJECTOR_CONTRACT_V1.cjs",
  "ci:customer-report-server-route-registration-contract",
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_ROUTE_REGISTRATION_CONTRACT_V1.cjs",
  "ci:customer-report-response-envelope-contract",
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RESPONSE_ENVELOPE_CONTRACT_V1.cjs",
  "ci:customer-dashboard-aggregate-server-contract",
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_DASHBOARD_AGGREGATE_SERVER_CONTRACT_V1.cjs",
];

const FORBIDDEN_SECTION_TOKENS = [
  "GEOX_COOKIE",
  "COOKIE",
];

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/\r\n/g, "\n");
}

function extractSection(markdown, title) {
  const start = markdown.indexOf(title);

  assert(start >= 0, "customer report boundary suite CI doc section missing", {
    docPath: DOC_PATH,
    title,
  });

  const rest = markdown.slice(start + title.length);
  const nextSection = rest.search(/\n##\s+/);

  if (nextSection < 0) {
    return markdown.slice(start);
  }

  return markdown.slice(start, start + title.length + nextSection);
}

function assertPackageScript(pkg, scriptName, expectedCommand) {
  assert(
    pkg.scripts && pkg.scripts[scriptName] === expectedCommand,
    "customer report boundary suite package script is missing or drifted",
    {
      scriptName,
      expected: expectedCommand,
      actual: pkg.scripts && pkg.scripts[scriptName],
    }
  );
}

function main() {
  const docPath = path.join(ROOT, DOC_PATH);
  const workflowPath = path.join(ROOT, WORKFLOW_PATH);

  assert(fs.existsSync(docPath), "customer report boundary suite CI wiring doc missing", {
    docPath: DOC_PATH,
  });

  assert(fs.existsSync(workflowPath), "customer report boundary suite CI workflow missing", {
    workflowPath: WORKFLOW_PATH,
  });

  const doc = read(DOC_PATH);
  const workflow = read(WORKFLOW_PATH);
  const suite = read(SUITE_PATH);
  const section = extractSection(doc, SECTION_TITLE);
  const pkg = JSON.parse(read("package.json"));

  assertPackageScript(pkg, SUITE_SCRIPT_NAME, SUITE_SCRIPT_COMMAND);
  assertPackageScript(pkg, WIRING_SCRIPT_NAME, WIRING_SCRIPT_COMMAND);

  for (const token of REQUIRED_DOC_TOKENS) {
    assert(section.includes(token), "customer report boundary suite CI doc section missing required token", {
      docPath: DOC_PATH,
      sectionTitle: SECTION_TITLE,
      token,
    });
  }

  for (const token of FORBIDDEN_SECTION_TOKENS) {
    assert(!section.includes(token), "customer report boundary suite CI doc section advertises unsupported cookie auth", {
      docPath: DOC_PATH,
      sectionTitle: SECTION_TITLE,
      token,
    });
  }

  for (const token of REQUIRED_WORKFLOW_TOKENS) {
    assert(workflow.includes(token), "customer report boundary suite CI workflow missing required token", {
      workflowPath: WORKFLOW_PATH,
      token,
    });
  }

  for (const token of REQUIRED_SUITE_TOKENS) {
    assert(suite.includes(token), "customer report boundary suite missing required server contract token", {
      suitePath: SUITE_PATH,
      token,
    });
  }

  console.log("[customer-report-boundary-suite-ci-wiring] PASS");
}

try {
  main();
} catch (error) {
  console.error("[customer-report-boundary-suite-ci-wiring] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
