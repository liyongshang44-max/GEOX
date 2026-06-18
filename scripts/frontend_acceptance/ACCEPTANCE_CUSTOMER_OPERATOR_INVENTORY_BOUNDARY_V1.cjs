// scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_OPERATOR_INVENTORY_BOUNDARY_V1.cjs
// Purpose: prevent Operator Twin source-index inventory internals from leaking into customer-facing pages.
// Boundary: customer surface must not import operator workbench APIs, source-index inventory projections, raw/debug table terms, or action surfaces.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

const CUSTOMER_SCAN_ROOTS = [
  "apps/web/src/views",
  "apps/web/src/components/customer",
  "apps/web/src/layouts/CustomerLayout.tsx",
];

const ROUTING_SCAN_ROOTS = [
  "apps/web/src/app/App.tsx",
  "apps/web/src/app/routes",
];

const CUSTOMER_ROUTE_MARKERS = [
  '"/customer',
  "'/customer",
  "path: \"/customer",
  "path=\"/customer",
  "to=\"/customer",
  "href=\"/customer",
];

const FORBIDDEN_CUSTOMER_ROUTE_TOKENS = [
  "OperatorTwinOverviewPage",
  "OperatorTwinFieldWorkspacePage",
  "fetchOperatorTwinOverview",
  "fetchOperatorTwinSourceIndexInventory",
  "operator_twin_source_index_inventory_v1",
  "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
  "/api/v1/operator/twin",
  "/api/v1/operator/twin/source-indexes",
  "features/operator",
  "../features/operator",
  "../../features/operator",
  "../../../features/operator",
];

const REQUIRED_CUSTOMER_FILES = [
  "apps/web/src/views/FieldReportPage.tsx",
  "apps/web/src/views/CustomerDashboardPage.tsx",
  "apps/web/src/views/CustomerFieldsIndexPage.tsx",
  "apps/web/src/views/OperationReportPage.tsx",
];

const FORBIDDEN_CUSTOMER_TOKENS = [
  "fetchOperatorTwinSourceIndexInventory",
  "operator_twin_source_index_inventory_v1",
  "OPERATOR_TWIN_SOURCE_INDEX_INVENTORY",
  "/api/v1/operator/twin/source-indexes",
  "SourceIndexInventoryCard",
  "data-card=\"operator-twin-source-index-inventory\"",
  "data-table=\"operator-twin-source-index-inventory\"",
  "OFFICIAL_OPERATOR_TWIN_API",
  "source_indexes",
  "latest_evidence_refs",
  "scope_columns_present",
  "latest_ts_ms",
  "row_count",
  "table_name",
  "../../../api/operatorTwin",
  "../../api/operatorTwin",
  "../api/operatorTwin",
  "features/operator",
  "createAoActTask",
  "dispatchNow",
  "approveNow",
  "sendTask",
  "POST /api/control/ao_act/task",
];

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail === undefined ? "" : "\n" + JSON.stringify(detail, null, 2);
    throw new Error(message + suffix);
  }
}

function walk(relPath) {
  const abs = path.join(ROOT, relPath);

  if (!fs.existsSync(abs)) return [];

  const stat = fs.statSync(abs);

  if (stat.isFile()) {
    return relPath.endsWith(".ts") || relPath.endsWith(".tsx") || relPath.endsWith(".css") ? [relPath] : [];
  }

  return fs.readdirSync(abs).flatMap((entry) => walk(path.join(relPath, entry).replace(/\\/g, "/")));
}

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

const pkg = JSON.parse(readText("package.json"));
const customerFiles = [...new Set(CUSTOMER_SCAN_ROOTS.flatMap(walk))];
const routingFiles = [...new Set(ROUTING_SCAN_ROOTS.flatMap(walk))];

assert(routingFiles.length > 0, "routing files missing from boundary scan", { ROUTING_SCAN_ROOTS });

for (const requiredRoutingFile of ["apps/web/src/app/App.tsx"]) {
  assert(routingFiles.includes(requiredRoutingFile), "required routing file missing from boundary scan", {
    requiredRoutingFile,
    routingFiles,
  });
}

for (const requiredFile of REQUIRED_CUSTOMER_FILES) {
  assert(customerFiles.includes(requiredFile), "required customer file missing from boundary scan", { requiredFile, customerFiles });
}

for (const filePath of customerFiles) {
  const text = readText(filePath);

  for (const token of FORBIDDEN_CUSTOMER_TOKENS) {
    assert(!text.includes(token), "customer surface leaks operator inventory/internal token", { filePath, token });
  }
}

for (const filePath of routingFiles) {
  const routingText = readText(filePath);
  const routingLines = routingText.split(/\n/);

  const isCustomerRouteFile = /customer|fieldreport|operationreport/i.test(path.basename(filePath));

  if (isCustomerRouteFile) {
    for (const token of FORBIDDEN_CUSTOMER_ROUTE_TOKENS) {
      assert(!routingText.includes(token), "customer route file leaks operator/internal token", { filePath, token });
    }
  }

  routingLines.forEach((line, index) => {
    const hasCustomerMarker = CUSTOMER_ROUTE_MARKERS.some((marker) => line.includes(marker));

    if (!hasCustomerMarker) return;

    const isRouteDeclaration =
      /<Route\\b/.test(line) ||
      /\\bpath\\s*[:=]/.test(line) ||
      /\\bto=/.test(line) ||
      /\\bhref=/.test(line);

    if (!isRouteDeclaration) return;

    const start = Math.max(0, index - 6);
    const end = Math.min(routingLines.length, index + 7);
    const routeWindow = routingLines.slice(start, end).join("\n");

    for (const token of FORBIDDEN_CUSTOMER_ROUTE_TOKENS) {
      assert(!routeWindow.includes(token), "customer route leaks operator/internal token near route declaration", {
        filePath,
        token,
        line: index + 1,
        routeWindow,
      });
    }
  });
}

assert(
    pkg.scripts["ci:frontend:customer-operator-inventory-boundary"] ===
      "node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_OPERATOR_INVENTORY_BOUNDARY_V1.cjs",
  "package script ci:frontend:customer-operator-inventory-boundary missing or incorrect",
  { actual: pkg.scripts && pkg.scripts["ci:frontend:customer-operator-inventory-boundary"] }
);

console.log("[customer-operator-inventory-boundary] PASS");
