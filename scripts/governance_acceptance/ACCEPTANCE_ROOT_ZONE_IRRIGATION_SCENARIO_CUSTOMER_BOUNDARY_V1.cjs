// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_CUSTOMER_BOUNDARY_V1.cjs
const fs = require("node:fs");
const cp = require("node:child_process");

const ACCEPTANCE_NAME = "ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_CUSTOMER_BOUNDARY_V1";
const SCAN_ROOTS = ["apps/server/src/routes", "apps/web/src"];
const FORBIDDEN_CUSTOMER_TOKENS = [
  "root_zone_irrigation_scenario_set_v1",
  "root_zone_irrigation_scenario_set_index_v1",
  "daily_projection",
  "delta_vs_baseline_fraction",
  "rootZoneIrrigationScenario",
  "rootZoneIrrigationScenarioSet",
];
const REQUIRED_CUSTOMER_ROUTE_MARKERS = [
  "/api/v1/customer/fields",
  "/api/v1/customer/reports",
  "/api/v1/customer/operations",
];

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) {
    console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function listedFiles() {
  return cp
    .execFileSync("rg", ["--files", ...SCAN_ROOTS], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => !/operator|admin/i.test(file));
}

function assertCustomerRoutesExist(files) {
  const routeText = files
    .filter((file) => file.startsWith("apps/server/src/routes"))
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");

  for (const marker of REQUIRED_CUSTOMER_ROUTE_MARKERS) {
    assert(routeText.includes(marker), `customer route marker exists: ${marker}`);
  }
}

function assertNoCustomerExposure(files) {
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const token of FORBIDDEN_CUSTOMER_TOKENS) {
      assert(!text.includes(token), `customer surface must not expose ${token}`, { file });
    }
  }
}

const files = listedFiles();
assert(files.length > 0, "customer surface files exist");
assertCustomerRoutesExist(files);
assertNoCustomerExposure(files);

console.log(`[${ACCEPTANCE_NAME}] PASS`);
