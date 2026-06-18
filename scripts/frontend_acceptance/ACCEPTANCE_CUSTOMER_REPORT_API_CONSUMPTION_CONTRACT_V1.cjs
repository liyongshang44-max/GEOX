// scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_API_CONSUMPTION_CONTRACT_V1.cjs
// Purpose: lock customer-facing report pages to official customer/report API consumption.
// Boundary: customer/report surfaces must not call Operator/Admin/Control/Debug APIs or import operator workbench clients.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const REQUIRED_API_FILES = [
  "apps/web/src/api/reports.ts",
  "apps/web/src/api/customerReports.ts",
];

const CUSTOMER_SURFACE_ROOTS = [
  "apps/web/src/features/customer/pages",
  "apps/web/src/features/fields/pages",
  "apps/web/src/features/operations/pages",
  "apps/web/src/views",
  "apps/web/src/components/customer",
  "apps/web/src/layouts/CustomerLayout.tsx",
];

const REQUIRED_CUSTOMER_REPORT_API_TOKENS = [
  "/api/v1/reports/operation/",
  "/api/v1/reports/field/",
  "/api/v1/reports/customer-dashboard/aggregate",
  "fetchOperationReport",
  "fetchFieldReport",
  "fetchCustomerDashboardAggregate",
];

const REQUIRED_CUSTOMER_REPORT_EXPORTS = [
  "fetchCustomerDashboardAggregate",
  "fetchFieldReport",
  "fetchOperationReport",
  "from \"./reports\"",
];

const FORBIDDEN_CUSTOMER_API_TOKENS = [
  "/api/v1/operator",
  "/api/v1/operator/twin",
  "/api/v1/operator/twin/source-indexes",
  "/api/v1/admin",
  "/api/admin",
  "/api/control",
  "/api/control/ao_act",
  "POST /api/control/ao_act/task",
  "operator_twin_source_index_inventory_v1",
  "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
  "fetchOperatorTwinOverview",
  "fetchOperatorTwinSourceIndexInventory",
  "operatorTwin",
  "operatorWorkbench",
  "operatorDispatch",
  "../api/operatorTwin",
  "../../api/operatorTwin",
  "../../../api/operatorTwin",
  "../api/operatorWorkbench",
  "../../api/operatorWorkbench",
  "../../../api/operatorWorkbench",
  "../api/operatorDispatch",
  "../../api/operatorDispatch",
  "../../../api/operatorDispatch",
  "features/operator",
  "AdminOperationDebugPage",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "source_indexes",
  "latest_evidence_refs",
  "scope_columns_present",
  "latest_ts_ms",
  "row_count",
  "table_name",
];

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function walk(relPath) {
  const absPath = path.join(ROOT, relPath);

  if (!fs.existsSync(absPath)) return [];

  const stat = fs.statSync(absPath);

  if (stat.isFile()) {
    if (/\.(ts|tsx|js|jsx)$/.test(relPath)) return [relPath.replace(/\\/g, "/")];
    return [];
  }

  const out = [];

  for (const entry of fs.readdirSync(absPath)) {
    out.push(...walk(path.join(relPath, entry).replace(/\\/g, "/")));
  }

  return out;
}

for (const filePath of REQUIRED_API_FILES) {
  assert(exists(filePath), "required customer report api file missing", { filePath });
}

const reportsApi = readText("apps/web/src/api/reports.ts");
const customerReportsApi = readText("apps/web/src/api/customerReports.ts");

for (const token of REQUIRED_CUSTOMER_REPORT_API_TOKENS) {
  assert(reportsApi.includes(token), "official customer report api token missing from reports api", { token });
}

for (const token of REQUIRED_CUSTOMER_REPORT_EXPORTS) {
  assert(customerReportsApi.includes(token), "customerReports api must re-export official report api only", { token });
}

for (const token of FORBIDDEN_CUSTOMER_API_TOKENS) {
  assert(!customerReportsApi.includes(token), "customerReports api leaks forbidden operator/admin/control token", { token });
}

const customerSurfaceFiles = [...new Set(CUSTOMER_SURFACE_ROOTS.flatMap(walk))];

assert(customerSurfaceFiles.length > 0, "customer surface scan found no files", { CUSTOMER_SURFACE_ROOTS });

const requiredCustomerFiles = [
  "apps/web/src/features/customer/pages/CustomerDashboardPage.tsx",
  "apps/web/src/features/fields/pages/FieldReportPage.tsx",
  "apps/web/src/features/operations/pages/OperationReportPage.tsx",
];

for (const filePath of requiredCustomerFiles) {
  assert(customerSurfaceFiles.includes(filePath), "required customer report page missing from scan", {
    filePath,
    customerSurfaceFiles,
  });
}

for (const filePath of customerSurfaceFiles) {
  const text = readText(filePath);

  for (const token of FORBIDDEN_CUSTOMER_API_TOKENS) {
    assert(!text.includes(token), "customer report surface consumes forbidden operator/admin/control api token", {
      filePath,
      token,
    });
  }
}

const pkg = JSON.parse(readText("package.json"));

assert(
  pkg.scripts &&
    pkg.scripts["ci:frontend:customer-report-api-consumption-contract"] ===
      "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_API_CONSUMPTION_CONTRACT_V1.cjs",
  "package script ci:frontend:customer-report-api-consumption-contract missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:customer-report-api-consumption-contract"] }
);

console.log("[customer-report-api-consumption-contract] PASS");
