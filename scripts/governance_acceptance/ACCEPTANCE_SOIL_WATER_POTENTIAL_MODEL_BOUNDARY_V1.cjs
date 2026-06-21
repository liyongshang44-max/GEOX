// scripts/governance_acceptance/ACCEPTANCE_SOIL_WATER_POTENTIAL_MODEL_BOUNDARY_V1.cjs
// Purpose: prove the H31 soil water potential domain model and builder are deterministic, pure, and guarded.

const fs = require("node:fs");
const path = require("node:path");
require("tsx/cjs");

const ACCEPTANCE_NAME = "ACCEPTANCE_SOIL_WATER_POTENTIAL_MODEL_BOUNDARY_V1";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function assertInvalid(result, label) {
  assert(result.ok === false, `${label}: ok must be false`, result);
  assert(result.input_status === "INVALID_INPUT", `${label}: status must be INVALID_INPUT`, result);
  assert(result.matric_potential_kpa === null, `${label}: matric potential must be null`, result);
  assert(result.effective_saturation === null, `${label}: saturation must be null`, result);
  assert(result.available_water_fraction === null, `${label}: available water must be null`, result);
  assert(Array.isArray(result.blocking_reasons) && result.blocking_reasons.length > 0, `${label}: reason required`, result);
}

const domainFiles = [
  {
    path: path.join(process.cwd(), "apps/server/src/domain/soil_water/van_genuchten_v1.ts"),
    firstLine: "// apps/server/src/domain/soil_water/van_genuchten_v1.ts",
  },
  {
    path: path.join(process.cwd(), "apps/server/src/domain/soil_water/soil_water_potential_builder_v1.ts"),
    firstLine: "// apps/server/src/domain/soil_water/soil_water_potential_builder_v1.ts",
  },
];

for (const file of domainFiles) {
  assert(fs.existsSync(file.path), "domain module missing", file.path);
  const source = fs.readFileSync(file.path, "utf8").replace(/^\uFEFF/, "");
  assert(source.startsWith(file.firstLine), "first-line path comment missing", file.path);
}

const modelPath = domainFiles[0].path;
const { estimateVanGenuchtenMatricPotentialV1 } = require(modelPath);
const validInput = {
  theta: 0.28,
  theta_r: 0.08,
  theta_s: 0.43,
  alpha_per_kpa: 0.035,
  n: 1.56,
};

const firstResult = estimateVanGenuchtenMatricPotentialV1(validInput);
const secondResult = estimateVanGenuchtenMatricPotentialV1(validInput);

assert(firstResult.ok === true, "valid input returns ok=true", firstResult);
assert(firstResult.input_status === "ESTIMATED", "valid input returns ESTIMATED", firstResult);
assert(
  Number.isFinite(firstResult.matric_potential_kpa) && firstResult.matric_potential_kpa < 0,
  "valid input returns finite negative matric_potential_kpa",
  firstResult,
);
assert(JSON.stringify(firstResult) === JSON.stringify(secondResult), "same input returns byte-identical output");

assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, theta: 0.08 }), "theta <= theta_r");
assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, theta: 0.43 }), "theta >= theta_s");
assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, theta_r: 0.43 }), "theta_r >= theta_s");
assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, alpha_per_kpa: 0 }), "alpha <= 0");
assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, n: 1 }), "n <= 1");
assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, m: 0 }), "m <= 0");
assertInvalid(estimateVanGenuchtenMatricPotentialV1({ ...validInput, theta: Number.NaN }), "non-finite theta");
assertInvalid(
  estimateVanGenuchtenMatricPotentialV1({ ...validInput, alpha_per_kpa: Number.POSITIVE_INFINITY }),
  "non-finite alpha",
);

const forbiddenPatterns = [
  /from\s+["']pg["']/,
  /require\(["']pg["']\)/,
  /express/,
  /router/,
  /app\.get/,
  /app\.post/,
  /process\.env/,
  /Date\.now/,
  /new\s+Date/,
  /randomUUID/,
  /recommendation/,
  /approval/,
  /operation_plan/,
  /ao_act/i,
  /dispatch/,
  /roi_ledger/,
  /field_memory/,
  /INSERT\s+INTO\s+facts/i,
  /soil_water_potential_estimate_fact_/,
];

for (const file of domainFiles) {
  const source = fs.readFileSync(file.path, "utf8").replace(/^\uFEFF/, "");
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(source), `${path.basename(file.path)} contains forbidden boundary token ${pattern}`);
  }
}

console.log(`[${ACCEPTANCE_NAME}] PASS`);
