// scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_ROUTE_CONTRACT_V1.cjs
// Purpose: lock customer-facing report route wiring to customer/report pages.
// Boundary: customer routes must not mount Operator, Admin, Debug, AO-ACT, approval, dispatch, or source-index inventory surfaces.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertIncludes(text, needle, label) {
  assert(text.includes(needle), "missing required token: " + label, { needle });
}

function assertNotIncludes(text, needle, label) {
  assert(!text.includes(needle), "forbidden token present: " + label, { needle });
}

function assertRegex(text, regex, label) {
  assert(regex.test(text), "missing required regex: " + label, { regex: String(regex) });
}

function assertNotRegex(text, regex, label) {
  assert(!regex.test(text), "forbidden regex present: " + label, { regex: String(regex) });
}

function sliceFrom(text, startNeedle, endNeedle) {
  const start = text.indexOf(startNeedle);
  assert(start >= 0, "start marker not found", { startNeedle });

  const end = endNeedle === null ? text.length : text.indexOf(endNeedle, start);
  assert(end > start, "end marker not found", { endNeedle });

  return text.slice(start, end);
}

function assertNoForbidden(block, forbiddenTokens, label) {
  for (const token of forbiddenTokens) {
    assertNotIncludes(block, token, label + " must not include " + token);
  }
}

const app = readText("apps/web/src/app/App.tsx");
const dashboardRoutes = readText("apps/web/src/app/routes/dashboardRoutes.tsx");
const fieldsRoutes = readText("apps/web/src/app/routes/fieldsRoutes.tsx");
const customerOperationsRoutes = readText("apps/web/src/app/routes/customerOperationsRoutes.tsx");
const pkg = JSON.parse(readText("package.json"));

const appRoutesBlock = sliceFrom(app, "function AppRoutes", "function CustomerRoutes");
const customerRoutesBlock = sliceFrom(app, "function CustomerRoutes", "function CustomerShell");
const customerShellBlock = sliceFrom(app, "function CustomerShell", "function OperatorRoutes");
const operatorRoutesBlock = sliceFrom(app, "function OperatorRoutes", "function OperatorShell");
const dashboardBlock = sliceFrom(dashboardRoutes, "export function renderDashboardRoutes", null);
const customerFieldsBlock = sliceFrom(fieldsRoutes, "export function renderCustomerFieldsRoutes", "export function renderAdminFieldsRoutes");
const customerOperationsBlock = sliceFrom(customerOperationsRoutes, "export function renderCustomerOperationsRoutes", null);

const FORBIDDEN_CUSTOMER_ROUTE_TOKENS = [
  "OperatorTwinOverviewPage",
  "OperatorFieldTwinWorkspacePage",
  "OperatorTwinFieldWorkspacePage",
  "OperatorShell",
  "OperatorLayout",
  "AdminLayout",
  "AdminOperationDebugPage",
  "DevToolsPage",
  "FlightTablePage",
  "features/operator",
  "features/admin",
  "features/dev",
  "fetchOperatorTwinOverview",
  "fetchOperatorTwinSourceIndexInventory",
  "operator_twin_source_index_inventory_v1",
  "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
  "/api/v1/operator/twin",
  "/api/v1/operator/twin/source-indexes",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/control/ao_act/task",
];

const topLevelCustomerRoutePattern = new RegExp(
  String.raw`<Route\\s+path=["']/customer/\\*["'][^>]*element=\\{<([^>\\s/]+)\\s*/?>\\}\\s*/?>`,
  "g"
);

const topLevelCustomerRouteMatches = [...appRoutesBlock.matchAll(topLevelCustomerRoutePattern)];

if (topLevelCustomerRouteMatches.length > 0) {
  assert(
    topLevelCustomerRouteMatches.length === 1,
    "customer top-level route must be unique when present",
    { count: topLevelCustomerRouteMatches.length }
  );

  assert(
    topLevelCustomerRouteMatches[0][1] === "CustomerShell",
    "customer top-level route must mount CustomerShell when present",
    { actual: topLevelCustomerRouteMatches[0][1] }
  );
}

assertNotRegex(
  appRoutesBlock,
  new RegExp(String.raw`<Route\\s+path=["']/customer/\\*["'][^>]*element=\\{<OperatorShell\\s*/?>\\}\\s*/?>`),
  "customer top-level route must not mount OperatorShell"
);

assertNotRegex(
  appRoutesBlock,
  new RegExp(String.raw`<Route\\s+path=["']/customer/\\*["'][^>]*element=\\{<AdminShell\\s*/?>\\}\\s*/?>`),
  "customer top-level route must not mount AdminShell"
);

assertNotRegex(
  appRoutesBlock,
  new RegExp(String.raw`<Route\\s+path=["']/customer/\\*["'][^>]*element=\\{<OperatorTwinOverviewPage\\s*/?>\\}\\s*/?>`),
  "customer top-level route must not mount OperatorTwinOverviewPage"
);

assertIncludes(appRoutesBlock, '<Route path="/operator/*" element={<OperatorShell />} />', "operator root remains isolated under /operator/*");
assertIncludes(appRoutesBlock, "{renderDashboardRoutes(expert)}", "dashboard route renderer included");
assertIncludes(appRoutesBlock, "{renderCustomerFieldsRoutes()}", "customer fields route renderer included");
assertIncludes(appRoutesBlock, "{renderCustomerOperationsRoutes()}", "customer operations route renderer included");

assertIncludes(customerShellBlock, "<CustomerLayout>", "customer shell uses CustomerLayout");
assertIncludes(customerShellBlock, "<CustomerRoutes />", "customer shell mounts CustomerRoutes");
assertNoForbidden(customerShellBlock, FORBIDDEN_CUSTOMER_ROUTE_TOKENS, "CustomerShell");

assertIncludes(customerRoutesBlock, '<Route path="dashboard" element={<CustomerDashboardPage />} />', "nested customer dashboard route");
assertIncludes(customerRoutesBlock, '<Route path="export" element={<CustomerDashboardExportPage />} />', "nested customer export route");
assertIncludes(customerRoutesBlock, '<Route path="fields/:fieldId" element={<FieldReportPage />} />', "nested customer field report route");
assertIncludes(customerRoutesBlock, '<Route path="fields/:fieldId/export" element={<FieldReportExportPage />} />', "nested customer field report export route");
assertIncludes(customerRoutesBlock, '<Route path="operations/:operationId" element={<OperationReportPage />} />', "nested customer operation report route");
assertIncludes(customerRoutesBlock, '<Route path="operations/:operationId/export" element={<CustomerReportExportPage />} />', "nested customer operation export route");
assertNoForbidden(customerRoutesBlock, FORBIDDEN_CUSTOMER_ROUTE_TOKENS, "CustomerRoutes");

assertIncludes(operatorRoutesBlock, '<Route path="twin" element={<OperatorTwinOverviewPage />} />', "operator twin route remains under OperatorRoutes");
assertIncludes(operatorRoutesBlock, '<Route path="twin/fields/:fieldId" element={<OperatorFieldTwinWorkspacePage />} />', "operator field twin route remains under OperatorRoutes");

assertIncludes(dashboardBlock, 'path="/customer/dashboard"', "absolute customer dashboard route");
assertIncludes(dashboardBlock, "<CustomerDashboardPage />", "absolute customer dashboard route page");
assertIncludes(dashboardBlock, 'path="/customer/export"', "absolute customer export route");
assertIncludes(dashboardBlock, "<CustomerDashboardExportPage />", "absolute customer export route page");
assertNoForbidden(dashboardBlock.replace("...renderOperatorRoutes(),", ""), FORBIDDEN_CUSTOMER_ROUTE_TOKENS, "dashboard customer routes");

assertIncludes(customerFieldsBlock, 'path="/customer/fields"', "customer fields index route");
assertIncludes(customerFieldsBlock, "<CustomerFieldsIndexPage />", "customer fields index page");
assertIncludes(customerFieldsBlock, 'path="/customer/fields/:fieldId"', "customer field report route");
assertIncludes(customerFieldsBlock, "<FieldReportPage />", "customer field report page");
assertIncludes(customerFieldsBlock, 'path="/customer/fields/:fieldId/export"', "customer field report export route");
assertIncludes(customerFieldsBlock, "<FieldReportExportPage />", "customer field report export page");
assertNoForbidden(customerFieldsBlock, FORBIDDEN_CUSTOMER_ROUTE_TOKENS, "customer fields routes");

assertIncludes(customerOperationsBlock, 'path="/customer/operations/:operationId"', "customer operation report route");
assertIncludes(customerOperationsBlock, "<OperationReportPage />", "customer operation report page");
assertIncludes(customerOperationsBlock, 'path="/customer/operations/:operationId/export"', "customer operation report export route");
assertIncludes(customerOperationsBlock, "<CustomerReportExportPage />", "customer operation report export page");
assertNoForbidden(customerOperationsBlock, FORBIDDEN_CUSTOMER_ROUTE_TOKENS, "customer operations routes");

assert(
  pkg.scripts &&
    pkg.scripts["ci:frontend:customer-report-route-contract"] ===
      "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_ROUTE_CONTRACT_V1.cjs",
  "package script ci:frontend:customer-report-route-contract missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:customer-report-route-contract"] }
);

console.log("[customer-report-route-contract] PASS");
