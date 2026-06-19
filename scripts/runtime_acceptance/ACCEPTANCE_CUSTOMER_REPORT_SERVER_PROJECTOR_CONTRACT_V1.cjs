// scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_PROJECTOR_CONTRACT_V1.cjs
// Purpose: verify customer report server routes stay pinned to formal report projectors.
// Boundary: customer report endpoints must not drift into ad-hoc raw fact/debug/operator/control responses.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const REPORT_ROUTE_PATH = "apps/server/src/routes/reports_v1.ts";
const PACKAGE_JSON_PATH = "package.json";

const REQUIRED_ROUTE_TOKENS = [
  'app.get("/api/v1/reports/operation/:operation_id"',
  'app.get("/api/v1/reports/field/:field_id"',
  "projectReportV1",
  "projectFieldReportDetailV1",
  "buildGuardedOperationReportV1",
  "buildIrrigationDecisionReportV1",
  "const payload: OperationReportSingleResponseV1 = { ok: true, operation_report_v1: guardedOperationReport",
  "const payload: FieldReportDetailResponseV1 = { ok: true, field_report_v1: fieldReport",
];

const REQUIRED_PACKAGE_SCRIPT_NAME = "ci:customer-report-server-projector-contract";
const REQUIRED_PACKAGE_SCRIPT_COMMAND =
  "node scripts/runtime_acceptance/ACCEPTANCE_CUSTOMER_REPORT_SERVER_PROJECTOR_CONTRACT_V1.cjs";

const FORBIDDEN_RESPONSE_TOKENS = [
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

function extractRouteBlock(source, routeToken) {
  const start = source.indexOf(routeToken);

  assert(start >= 0, "customer report server route missing", {
    routePath: REPORT_ROUTE_PATH,
    routeToken,
  });

  const rest = source.slice(start + routeToken.length);
  const nextRoute = rest.search(/\n\s*app\.get\("/);

  if (nextRoute < 0) {
    return source.slice(start);
  }

  return source.slice(start, start + routeToken.length + nextRoute);
}

function assertIncludes(source, token) {
  assert(source.includes(token), "customer report server projector contract missing required token", {
    routePath: REPORT_ROUTE_PATH,
    token,
  });
}

function assertRouteDoesNotExposeForbiddenPayload(routeBlock, routeName) {
  for (const token of FORBIDDEN_RESPONSE_TOKENS) {
    assert(!routeBlock.includes(token), "customer report server route exposes forbidden customer payload token", {
      routePath: REPORT_ROUTE_PATH,
      routeName,
      token,
    });
  }
}

function assertPackageScriptPinned() {
  const pkg = JSON.parse(read(PACKAGE_JSON_PATH));
  const actual = pkg.scripts && pkg.scripts[REQUIRED_PACKAGE_SCRIPT_NAME];

  assert(actual === REQUIRED_PACKAGE_SCRIPT_COMMAND, "customer report server projector contract package script missing or drifted", {
    scriptName: REQUIRED_PACKAGE_SCRIPT_NAME,
    expected: REQUIRED_PACKAGE_SCRIPT_COMMAND,
    actual,
  });
}

function main() {
  const routeSource = read(REPORT_ROUTE_PATH);

  for (const token of REQUIRED_ROUTE_TOKENS) {
    assertIncludes(routeSource, token);
  }

  const operationRouteBlock = extractRouteBlock(routeSource, 'app.get("/api/v1/reports/operation/:operation_id"');
  const fieldRouteBlock = extractRouteBlock(routeSource, 'app.get("/api/v1/reports/field/:field_id"');

  assert(
    operationRouteBlock.includes("await buildGuardedOperationReportV1({ pool, report: enrichedReport })"),
    "operation report route must build final response through guarded projector",
    { routePath: REPORT_ROUTE_PATH }
  );

  assert(
    fieldRouteBlock.includes("return buildGuardedOperationReportV1({ pool, report: projected });"),
    "field report route must build nested operation reports through guarded projector",
    { routePath: REPORT_ROUTE_PATH }
  );

  assertRouteDoesNotExposeForbiddenPayload(operationRouteBlock, "operation");
  assertRouteDoesNotExposeForbiddenPayload(fieldRouteBlock, "field");

  assertPackageScriptPinned();

  console.log("[customer-report-server-projector-contract] PASS");
}

try {
  main();
} catch (error) {
  console.error("[customer-report-server-projector-contract] FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
