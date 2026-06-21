// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_CUSTOMER_BOUNDARY_V1.cjs
const fs = require("node:fs");
const path = require("node:path");

const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_CUSTOMER_BOUNDARY_V1";
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
  "root_zone_soil_water_forecast_v1",
  "root_zone_soil_water_forecast_index_v1",
  "daily_forecast",
  "projected_available_water_fraction",
  "forecastWaterStatus",
  "rootZoneSoilWaterForecast",
];

function fail(message, detail) {
  console.error(`[${name}] FAIL: ${message}`);
  if (detail !== undefined) {
    console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
  process.exit(1);
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

for (const file of scannedFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const token of forbiddenTokens) {
    if (text.includes(token)) {
      fail(`Customer boundary token exposed: ${token}`, file);
    }
  }
}

console.log(`[${name}] PASS`);
