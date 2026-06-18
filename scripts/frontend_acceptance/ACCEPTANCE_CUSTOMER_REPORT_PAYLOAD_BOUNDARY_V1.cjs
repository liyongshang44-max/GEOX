// scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_PAYLOAD_BOUNDARY_V1.cjs
// Purpose: lock customer report payload/view-model boundary.
// Boundary: customer report payloads and customer report view models must not expose Operator, Admin, Control, Source-Index, raw/debug, or table-shape internals.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const REQUIRED_FILES = [
  "apps/web/src/api/reports.ts",
  "apps/web/src/api/customerReports.ts",
  "apps/web/src/views/CustomerDashboardPage.tsx",
  "apps/web/src/views/FieldReportPage.tsx",
  "apps/web/src/views/OperationReportPage.tsx",
  "apps/web/src/viewmodels/customerDashboardViewModel.ts",
  "apps/web/src/viewmodels/customerReportMainVisualVm.ts",
  "apps/web/src/viewmodels/customerDashboardVm.ts",
  "apps/web/src/viewmodels/fieldReportVm.ts",
  "apps/web/src/viewmodels/operationReportVm.ts",
  "apps/web/src/viewmodels/customerC8FormalReportVm.ts",
];

const REQUIRED_REPORT_ENDPOINT_TOKENS = [
  "/api/v1/reports/operation/",
  "/api/v1/reports/field/",
  "/api/v1/reports/customer-dashboard/aggregate",
];

const REQUIRED_VIEWMODEL_BUILDER_LINKS = [
  {
    filePath: "apps/web/src/views/CustomerDashboardPage.tsx",
    token: "buildCustomerDashboardVm",
  },
  {
    filePath: "apps/web/src/views/FieldReportPage.tsx",
    token: "buildFieldReportVm",
  },
  {
    filePath: "apps/web/src/views/FieldReportPage.tsx",
    token: "buildC8FieldMainVisualVm",
  },
  {
    filePath: "apps/web/src/views/OperationReportPage.tsx",
    token: "buildOperationReportVm",
  },
  {
    filePath: "apps/web/src/views/OperationReportPage.tsx",
    token: "buildC8OperationMainVisualVm",
  },
];

const FORBIDDEN_PAYLOAD_TOKENS = [
  "operator_twin_source_index_inventory_v1",
  "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
  "source_indexes",
  "sourceIndexes",
  "scope_columns_present",
  "scopeColumnsPresent",
  "table_name",
  "tableName",
  "row_count",
  "rowCount",
  "latest_ts_ms",
  "latestTsMs",
  "latest_evidence_refs",
  "latestEvidenceRefs",
  "raw_payload",
  "rawPayload",
  "record_json",
  "recordJson",
  "debug_payload",
  "debugPayload",
  "debug_json",
  "debugJson",
  "internal_payload",
  "internalPayload",
  "admin_payload",
  "adminPayload",
  "operator_payload",
  "operatorPayload",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "createAoActTask",
  "/api/v1/operator",
  "/api/v1/admin",
  "/api/admin",
  "/api/control",
  "/api/control/ao_act",
];

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function assertNoForbiddenTokens(relPath, tokens) {
  const text = readText(relPath);

  for (const token of tokens) {
    assert(!text.includes(token), "customer report payload boundary leaks forbidden token", {
      filePath: relPath,
      token,
    });
  }
}

for (const relPath of REQUIRED_FILES) {
  assert(exists(relPath), "required customer report payload boundary file missing", { relPath });
}

const reportsApi = readText("apps/web/src/api/reports.ts");

for (const token of REQUIRED_REPORT_ENDPOINT_TOKENS) {
  assert(reportsApi.includes(token), "official customer report endpoint token missing", { token });
}

for (const link of REQUIRED_VIEWMODEL_BUILDER_LINKS) {
  assert(
    readText(link.filePath).includes(link.token),
    "customer report page must keep active viewmodel builder under payload boundary scan",
    link
  );
}

const filesToScan = [...REQUIRED_FILES];

for (const relPath of filesToScan) {
  assertNoForbiddenTokens(relPath, FORBIDDEN_PAYLOAD_TOKENS);
}

const pkg = JSON.parse(readText("package.json"));

assert(
  pkg.scripts &&
    pkg.scripts["ci:frontend:customer-report-payload-boundary"] ===
      "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_PAYLOAD_BOUNDARY_V1.cjs",
  "package script ci:frontend:customer-report-payload-boundary missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:customer-report-payload-boundary"] }
);

console.log("[customer-report-payload-boundary] PASS");
