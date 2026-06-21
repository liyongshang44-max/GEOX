// scripts/governance_acceptance/ACCEPTANCE_SOIL_WATER_POTENTIAL_CUSTOMER_BOUNDARY_V1.cjs
// Purpose: prove unconfirmed H31 soil water potential estimates are not exposed through Customer routes or web surfaces.

const fs = require("node:fs");
const path = require("node:path");

const ACCEPTANCE_NAME = "ACCEPTANCE_SOIL_WATER_POTENTIAL_CUSTOMER_BOUNDARY_V1";
const SCAN_ROOTS = [
  "apps/server/src/routes",
  "apps/server/src/routes/v1",
  "apps/web/src",
];
const FORBIDDEN_TOKENS = [
  "soil_water_potential_estimate_v1",
  "soil_water_potential_estimate_index_v1",
  "matric_potential_kpa",
  "soilWaterPotentialEstimate",
  "soilWaterPotentialEstimateIndex",
  "matricPotentialKpa",
];

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isCustomerScopedFile(relativePath, content) {
  const normalizedPath = relativePath.replace(/\\/g, "/").toLowerCase();
  const lowerContent = content.toLowerCase();

  return (
    normalizedPath.includes("customer") ||
    normalizedPath.includes("confirmed-twin-summary") ||
    lowerContent.includes("/customer/") ||
    lowerContent.includes("confirmed-twin-summary") ||
    lowerContent.includes("official_customer_delivery_portal")
  );
}

const repoRoot = process.cwd();
const scannedFiles = [];
const customerFiles = [];
const violations = [];

for (const root of SCAN_ROOTS) {
  for (const filePath of listFiles(path.join(repoRoot, root))) {
    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    scannedFiles.push(relativePath);

    if (!isCustomerScopedFile(relativePath, content)) continue;
    customerFiles.push(relativePath);

    for (const token of FORBIDDEN_TOKENS) {
      if (content.includes(token)) {
        violations.push({ file: relativePath, token });
      }
    }
  }
}

assert(scannedFiles.length > 0, "scan roots contained no source files", SCAN_ROOTS);
assert(customerFiles.length > 0, "no customer route/web files were detected", scannedFiles.slice(0, 25));
assert(violations.length === 0, "Customer surface exposes unconfirmed soil water potential estimate", violations);

const customerRouteFiles = customerFiles.filter((file) => file.startsWith("apps/server/src/routes"));
assert(customerRouteFiles.length > 0, "no customer route files were detected", customerFiles);

console.log(`[${ACCEPTANCE_NAME}] PASS`);
