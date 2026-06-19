// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_DASHBOARD_AGGREGATE_SERVER_CONTRACT_V1.cjs
// Purpose: verify customer dashboard aggregate route stays pinned to the formal dashboard aggregate projector.
// Boundary: customer dashboard aggregate must not drift into raw/debug/operator/internal payload assembly.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const ROUTE_PATH = "apps/server/src/routes/reports_dashboard_v1.ts";
const PACKAGE_JSON_PATH = "package.json";
const SUITE_PATH = "scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_BOUNDARY_SUITE_V1.cjs";

const SCRIPT_NAME = "ci:customer-dashboard-aggregate-server-contract";
const SCRIPT_COMMAND =
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_DASHBOARD_AGGREGATE_SERVER_CONTRACT_V1.cjs";

const ROUTE_TOKEN = 'app.get("/api/v1/reports/customer-dashboard/aggregate"';

const REQUIRED_SOURCE_TOKENS = [
  ROUTE_TOKEN,
  "projectCustomerDashboardAggregateFromStatesV1",
  "projectOperationStateV1",
  "queryPendingActionsSummary",
  "queryDeviceSummary",
];

const REQUIRED_ROUTE_TOKENS = [
  'enforceRouteRoleAuth(req, reply, "summary")',
  'requireAoActScopeV0(req, reply, "ao_act.index.read")',
  "const states = await projectOperationStateV1(pool, tenant)",
  "const aggregate = projectCustomerDashboardAggregateFromStatesV1({",
  "states: scopedStates",
  "field_ids: aggregateFieldIds",
  "pending_actions_summary: pendingActionsSummary",
  "device_summary: deviceSummary",
  "return reply.send({",
  "ok: true",
  "aggregate",
];

const FORBIDDEN_ROUTE_TOKENS = [
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
  "/api/v1/operator",
  "/api/v1/admin",
  "/api/admin",
  "/api/control",
  "/api/control/ao_act",
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

function extractRouteBlock(source, routeToken) {
  const start = source.indexOf(routeToken);

  assert(start >= 0, "customer dashboard aggregate route missing", {
    routePath: ROUTE_PATH,
    routeToken,
  });

  const rest = source.slice(start + routeToken.length);
  const nextRoute = rest.search(/\n\s*app\.get\("/);

  if (nextRoute < 0) {
    return source.slice(start);
  }

  return source.slice(start, start + routeToken.length + nextRoute);
}

function assertIncludes(source, token, message) {
  assert(source.includes(token), message, {
    routePath: ROUTE_PATH,
    token,
  });
}

function assertPackageScriptPinned() {
  const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
  const actual = pkg.scripts && pkg.scripts[SCRIPT_NAME];

  assert(actual === SCRIPT_COMMAND, "customer dashboard aggregate server contract package script missing or drifted", {
    scriptName: SCRIPT_NAME,
    expected: SCRIPT_COMMAND,
    actual,
  });
}

function assertSuiteRunsThisGuard() {
  const suite = read(SUITE_PATH);

  assert(suite.includes(SCRIPT_NAME), "customer dashboard aggregate server contract is not wired into customer report boundary suite", {
    suitePath: SUITE_PATH,
    scriptName: SCRIPT_NAME,
  });

  assert(suite.includes(SCRIPT_COMMAND), "customer dashboard aggregate server contract suite command is missing or drifted", {
    suitePath: SUITE_PATH,
    expected: SCRIPT_COMMAND,
  });
}

function main() {
  const source = read(ROUTE_PATH);

  for (const token of REQUIRED_SOURCE_TOKENS) {
    assertIncludes(source, token, "customer dashboard aggregate source missing required projector token");
  }

  const routeBlock = extractRouteBlock(source, ROUTE_TOKEN);

  for (const token of REQUIRED_ROUTE_TOKENS) {
    assertIncludes(routeBlock, token, "customer dashboard aggregate route missing required contract token");
  }

  for (const token of FORBIDDEN_ROUTE_TOKENS) {
    assert(!routeBlock.includes(token), "customer dashboard aggregate route exposes forbidden customer payload token", {
      routePath: ROUTE_PATH,
      token,
    });
  }

  assertPackageScriptPinned();
  assertSuiteRunsThisGuard();

  console.log("[customer-dashboard-aggregate-server-contract] PASS");
}

try {
  main();
} catch (error) {
  console.error("[customer-dashboard-aggregate-server-contract] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
