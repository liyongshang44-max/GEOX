// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_CUSTOMER_BOUNDARY_V1.cjs
const fs = require("node:fs");
const path = require("node:path");

const name = "ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_CUSTOMER_BOUNDARY_V1";
const customerSurfaceRoots = [
  "apps/web/src/features/customer",
  "apps/web/src/components/customer",
];
const customerRouteFiles = [
  "apps/server/src/routes/customer_v1.ts",
  "apps/server/src/routes/customer_scope_response_hook_v1.ts",
  "apps/server/src/routes/reports_v1.ts",
  "apps/server/src/routes/reports_dashboard_v1.ts",
];
const forbiddenTokens = [
  "root_zone_irrigation_scenario_set_v1",
  "root_zone_irrigation_scenario_set_index_v1",
  "daily_projection",
  "delta_vs_baseline_fraction",
  "rootZoneIrrigationScenario",
  "rootZoneIrrigationScenarioSet",
];

function fail(message, detail) {
  console.error(`[${name}] FAIL: ${message}`);
  if (detail !== undefined) {
    console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function walkFiles(dir, output = []) {
  if (!fs.existsSync(dir)) return output;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, output);
    } else {
      output.push(fullPath);
    }
  }

  return output;
}

const scannedFiles = [
  ...customerSurfaceRoots.flatMap((root) => walkFiles(root)),
  ...customerRouteFiles.filter((file) => fs.existsSync(file)),
].filter((file) => /\.(ts|tsx|js|jsx|cjs|mjs)$/.test(file));

assert(scannedFiles.length > 0, "customer surface files exist");

for (const file of scannedFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const token of forbiddenTokens) {
    if (text.includes(token)) {
      fail(`Customer boundary token exposed: ${token}`, file);
    }
  }
}

const customerRouteFile = "apps/server/src/routes/customer_v1.ts";
assert(fs.existsSync(customerRouteFile), "customer route file exists");
const customerRouteText = fs.readFileSync(customerRouteFile, "utf8");
assert(
  customerRouteText.includes("/api/v1/customer/fields/:field_id/confirmed-twin-summary"),
  "customer confirmed twin summary route remains registered",
);
assert(
  customerRouteText.includes("customer_confirmed_twin_summary_v1"),
  "customer response remains based on confirmed customer summary payload",
);
assert(
  customerRouteText.includes('dataScope: "OFFICIAL_CUSTOMER_DELIVERY_PORTAL"'),
  "customer confirmed summary remains official customer delivery output",
);

console.log(`[${name}] PASS`);