// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_CUSTOMER_BOUNDARY_V1.cjs
const fs = require("node:fs");
const path = require("node:path");

const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_CUSTOMER_BOUNDARY_V1";
const scanRoots = ["apps/server/src/routes", "apps/web/src"];
const forbiddenTokens = [
  "root_zone_soil_water_state_v1",
  "root_zone_soil_water_state_index_v1",
  "weighted_matric_potential_kpa",
  "rootZoneSoilWaterState",
  "weightedMatricPotentialKpa",
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

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(filePath) : [filePath];
  });
}

const hits = [];
for (const file of scanRoots.flatMap(walk)) {
  const text = fs.readFileSync(file, "utf8");
  for (const token of forbiddenTokens) {
    if (text.includes(token)) hits.push(`${file}: ${token}`);
  }
}
assert(hits.length === 0, "customer exposure found", hits);

const customerRouteFile = "apps/server/src/routes/customer_v1.ts";
assert(fs.existsSync(customerRouteFile), "customer route file exists");
const customerRouteText = fs.readFileSync(customerRouteFile, "utf8");
assert(
  customerRouteText.includes('/api/v1/customer/fields/:field_id/confirmed-twin-summary'),
  "customer confirmed twin summary route remains registered",
);
assert(
  customerRouteText.includes("customer_confirmed_twin_summary_v1"),
  "customer response remains based on confirmed customer summary payload",
);
assert(
  customerRouteText.includes("dataScope: \"OFFICIAL_CUSTOMER_DELIVERY_PORTAL\""),
  "customer confirmed summary remains official customer delivery output",
);

console.log(`[${name}] PASS`);
