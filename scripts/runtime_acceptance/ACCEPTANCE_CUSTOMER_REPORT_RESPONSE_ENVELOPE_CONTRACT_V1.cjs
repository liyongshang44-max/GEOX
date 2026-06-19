// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RESPONSE_ENVELOPE_CONTRACT_V1.cjs
// Purpose: verify customer report server and frontend API adapters keep the formal response envelope names.
// Boundary: customer reports must keep operation_report_v1, field_report_v1, and aggregate as the official envelopes.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const SERVER_REPORT_ROUTE_PATH = "apps/server/src/routes/reports_v1.ts";
const SERVER_DASHBOARD_ROUTE_PATH = "apps/server/src/routes/reports_dashboard_v1.ts";
const WEB_REPORTS_API_PATH = "apps/web/src/api/reports.ts";
const WEB_CUSTOMER_REPORTS_API_PATH = "apps/web/src/api/customerReports.ts";
const PACKAGE_JSON_PATH = "package.json";
const SUITE_PATH = "scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs";

const SCRIPT_NAME = "ci:customer-report-response-envelope-contract";
const SCRIPT_COMMAND =
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_RESPONSE_ENVELOPE_CONTRACT_V1.cjs";

const OPERATION_ROUTE_TOKEN = 'app.get("/api/v1/reports/operation/:operation_id"';
const FIELD_ROUTE_TOKEN = 'app.get("/api/v1/reports/field/:field_id"';
const DASHBOARD_ROUTE_TOKEN = 'app.get("/api/v1/reports/customer-dashboard/aggregate"';

const REQUIRED_SERVER_ENVELOPES = [
  {
    routePath: SERVER_REPORT_ROUTE_PATH,
    routeToken: OPERATION_ROUTE_TOKEN,
    envelopeToken: "operation_report_v1",
  },
  {
    routePath: SERVER_REPORT_ROUTE_PATH,
    routeToken: FIELD_ROUTE_TOKEN,
    envelopeToken: "field_report_v1",
  },
  {
    routePath: SERVER_DASHBOARD_ROUTE_PATH,
    routeToken: DASHBOARD_ROUTE_TOKEN,
    envelopeToken: "aggregate",
  },
];

const REQUIRED_WEB_TOKENS = [
  "/api/v1/reports/operation/",
  "/api/v1/reports/field/",
  "/api/v1/reports/customer-dashboard/aggregate",
  "operation_report_v1",
  "field_report_v1",
  "aggregate",
];

const FORBIDDEN_SERVER_ROUTE_TOKENS = [
  "operator_twin_source_index_inventory_v1",
  "source_indexes",
  "sourceIndexes",
  "raw_payload",
  "rawPayload",
  "record_json",
  "recordJson",
  "debug_payload",
  "debugPayload",
  "internal_payload",
  "internalPayload",
  "admin_payload",
  "adminPayload",
  "operator_payload",
  "operatorPayload",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
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

function extractRouteBlock(source, routeToken, routePath) {
  const start = source.indexOf(routeToken);

  assert(start >= 0, "customer report response envelope route missing", {
    routePath,
    routeToken,
  });

  const rest = source.slice(start + routeToken.length);
  const nextRoute = rest.search(/\n\s*app\.get\("/);

  if (nextRoute < 0) {
    return source.slice(start);
  }

  return source.slice(start, start + routeToken.length + nextRoute);
}

function assertServerEnvelope(routeSpec) {
  const source = read(routeSpec.routePath);
  const routeBlock = extractRouteBlock(source, routeSpec.routeToken, routeSpec.routePath);

  assert(routeBlock.includes("ok: true"), "customer report response envelope route missing ok:true", {
    routePath: routeSpec.routePath,
    routeToken: routeSpec.routeToken,
  });

  assert(routeBlock.includes(routeSpec.envelopeToken), "customer report response envelope token missing", {
    routePath: routeSpec.routePath,
    routeToken: routeSpec.routeToken,
    envelopeToken: routeSpec.envelopeToken,
  });

  for (const token of FORBIDDEN_SERVER_ROUTE_TOKENS) {
    assert(!routeBlock.includes(token), "customer report response envelope route exposes forbidden payload token", {
      routePath: routeSpec.routePath,
      routeToken: routeSpec.routeToken,
      token,
    });
  }
}

function assertWebApiEnvelopeConsumption() {
  const reportsApi = read(WEB_REPORTS_API_PATH);
  const customerReportsApi = read(WEB_CUSTOMER_REPORTS_API_PATH);
  const combined = reportsApi + "\n" + customerReportsApi;

  for (const token of REQUIRED_WEB_TOKENS) {
    assert(combined.includes(token), "customer report frontend API envelope consumption token missing", {
      paths: [WEB_REPORTS_API_PATH, WEB_CUSTOMER_REPORTS_API_PATH],
      token,
    });
  }
}

function assertPackageScriptPinned() {
  const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
  const actual = pkg.scripts && pkg.scripts[SCRIPT_NAME];

  assert(actual === SCRIPT_COMMAND, "customer report response envelope contract package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function assertSuiteRunsThisGuard() {
  const suite = read(SUITE_PATH);

  assert(suite.includes(SCRIPT_NAME), "customer report response envelope contract is not wired into customer report boundary suite", {
    suitePath: SUITE_PATH,
    scriptName: SCRIPT_NAME,
  });

  assert(suite.includes(SCRIPT_COMMAND), "customer report response envelope contract suite command is missing or drifted", {
    suitePath: SUITE_PATH,
    expected: SCRIPT_COMMAND,
  });
}

function main() {
  for (const routeSpec of REQUIRED_SERVER_ENVELOPES) {
    assertServerEnvelope(routeSpec);
  }

  assertWebApiEnvelopeConsumption();
  assertPackageScriptPinned();
  assertSuiteRunsThisGuard();

  console.log("[customer-report-response-envelope-contract] PASS");
}

try {
  main();
} catch (error) {
  console.error("[customer-report-response-envelope-contract] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
