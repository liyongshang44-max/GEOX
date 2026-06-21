// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_MODEL_BOUNDARY_V1.cjs
const fs = require("node:fs");
require("tsx/cjs");

const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_MODEL_BOUNDARY_V1";
const file = "apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts";
const forbiddenTokens = [
  'from "pg"',
  'require("pg")',
  "express",
  "router",
  "app.get",
  "app.post",
  "process.env",
  "Date.now",
  "new Date",
  "randomUUID",
  "recommendation",
  "approval",
  "operation_plan",
  "ao_act",
  "dispatch",
  "roi_ledger",
  "field_memory",
  "INSERT INTO facts",
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

const text = fs.readFileSync(file, "utf8");
assert(text.startsWith(`// ${file}`), "builder must start with path comment");
for (const token of forbiddenTokens) {
  assert(!text.includes(token), `forbidden token found: ${token}`);
}

const { buildRootZoneSoilWaterStateV1 } = require(`${process.cwd()}/${file}`);

const scope = {
  tenant_id: "tenant_a",
  project_id: "project_a",
  group_id: "group_a",
  field_id: "field_a",
  zone_id: "zone_a",
};
const base = {
  ...scope,
  computed_at: "2026-06-21T00:00:00.000Z",
  root_zone_depth_cm: 60,
};

function classFor(matricPotentialKpa) {
  if (matricPotentialKpa == null || !Number.isFinite(matricPotentialKpa)) return "UNKNOWN";
  if (matricPotentialKpa >= -10) return "SATURATED_OR_NEAR_SATURATED";
  if (matricPotentialKpa >= -60) return "READILY_AVAILABLE";
  if (matricPotentialKpa >= -200) return "LIMITED_AVAILABLE";
  return "STRESS";
}

function layer(overrides = {}) {
  const matricPotentialKpa = overrides.matric_potential_kpa ?? -20;

  return {
    estimate_id: overrides.estimate_id ?? "layer_20",
    ...scope,
    layer_depth_cm: overrides.layer_depth_cm ?? 20,
    source_window_id: null,
    source_profile_id: null,
    observed_theta: null,
    theta_unit: "m3_m3",
    normalized_theta_m3_m3: null,
    matric_potential_kpa: matricPotentialKpa,
    matric_potential_class: overrides.matric_potential_class ?? classFor(matricPotentialKpa),
    available_water_fraction: overrides.available_water_fraction ?? 0.8,
    root_zone_weight: overrides.root_zone_weight ?? 1,
    input_status: overrides.input_status ?? "ESTIMATED",
    blocking_reasons: [],
    hydraulic_profile_ref: null,
    data_quality_ref: null,
    evidence_refs: [],
    calculation_inputs: {},
    derivation: {},
    confidence: { level: "HIGH", score: 0.9, basis: "test" },
    computed_at: "2026-06-21T00:00:00.000Z",
    determinism_hash: overrides.determinism_hash ?? `hash_${overrides.estimate_id ?? "layer_20"}`,
    ...overrides,
  };
}

function build(layerEstimates, overrides = {}) {
  return buildRootZoneSoilWaterStateV1({
    ...base,
    ...overrides,
    layerEstimates,
  });
}

const threeLayerInput = [
  layer({ estimate_id: "a", layer_depth_cm: 20, matric_potential_kpa: -20, available_water_fraction: 0.8 }),
  layer({ estimate_id: "b", layer_depth_cm: 40, matric_potential_kpa: -70, available_water_fraction: 0.4 }),
  layer({ estimate_id: "c", layer_depth_cm: 60, matric_potential_kpa: -100, available_water_fraction: 0.2 }),
];

let output = build(threeLayerInput);
assert(output.input_status === "ESTIMATED", "valid three-layer input returns ESTIMATED");
assert(
  JSON.stringify(output) === JSON.stringify(build(threeLayerInput)),
  "same input returns identical output",
);
assert(
  build([]).input_status === "INSUFFICIENT_LAYER_ESTIMATES",
  "no layer estimate returns INSUFFICIENT_LAYER_ESTIMATES",
);
assert(
  build([layer({ estimate_id: "blocked", input_status: "BLOCKED_BY_DATA_QUALITY" })]).input_status ===
    "INSUFFICIENT_LAYER_ESTIMATES",
  "blocked-only layers return INSUFFICIENT_LAYER_ESTIMATES",
);
assert(
  build([
    layer({ estimate_id: "valid" }),
    layer({ estimate_id: "blocked", layer_depth_cm: 40, input_status: "BLOCKED_BY_DATA_QUALITY" }),
  ]).input_status === "PARTIAL_ESTIMATE",
  "mixed valid/blocked layers return PARTIAL_ESTIMATE",
);
assert(
  build([
    layer({ estimate_id: "readily", layer_depth_cm: 20, matric_potential_kpa: -20 }),
    layer({ estimate_id: "stress", layer_depth_cm: 40, matric_potential_kpa: -250 }),
  ]).root_zone_water_potential_class === "MIXED",
  "mixed stress/readily layers return MIXED",
);
assert(
  build([], { root_zone_depth_cm: 0 }).input_status === "INVALID_INPUT",
  "invalid root_zone_depth_cm returns INVALID_INPUT",
);
output = build(
  [
    layer({ estimate_id: "inside", layer_depth_cm: 20 }),
    layer({ estimate_id: "too_deep", layer_depth_cm: 80, matric_potential_kpa: -250 }),
  ],
  { root_zone_depth_cm: 40 },
);
assert(
  output.layer_count === 1 && output.layer_estimate_refs[0] === "inside",
  "layers deeper than root_zone_depth_cm are excluded",
);

const mismatchedLayer = layer({
  estimate_id: "external_zone",
  layer_depth_cm: 40,
  zone_id: "external_zone",
  matric_potential_kpa: -250,
});
output = build([layer({ estimate_id: "owned", layer_depth_cm: 20 }), mismatchedLayer]);
assert(output.estimated_layer_count === 1, "scope mismatch layer is not estimated");
assert(!output.layer_estimate_refs.includes("external_zone"), "scope mismatch layer is excluded");
assert(output.input_status === "PARTIAL_ESTIMATE", "scope mismatch makes status partial");
assert(
  output.blocking_reasons.includes("scope_mismatch_layer_excluded"),
  "scope mismatch is reported",
);

const tupleA = build([
  layer({ estimate_id: "a", layer_depth_cm: 20, determinism_hash: "hash_a" }),
  layer({ estimate_id: "b", layer_depth_cm: 40, determinism_hash: "hash_b" }),
]);
const tupleB = build([
  layer({ estimate_id: "a", layer_depth_cm: 40, determinism_hash: "hash_a" }),
  layer({ estimate_id: "b", layer_depth_cm: 20, determinism_hash: "hash_b" }),
]);
assert(
  tupleA.determinism_hash !== tupleB.determinism_hash,
  "hash binds estimate id, layer depth, and layer hash as sorted tuples",
);
assert(
  Array.isArray(tupleA.calculation_inputs.sorted_layer_tuples),
  "hash input exposes sorted layer tuple structure",
);

for (const invalidWeight of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  output = build([layer({ estimate_id: `invalid_weight_${String(invalidWeight)}`, root_zone_weight: invalidWeight })]);
  assert(
    output.input_status === "INSUFFICIENT_LAYER_ESTIMATES",
    `invalid root_zone_weight is blocked: ${String(invalidWeight)}`,
  );
}

output = build([layer({ estimate_id: "bad_awf", available_water_fraction: Number.NaN })]);
assert(
  output.input_status === "INSUFFICIENT_LAYER_ESTIMATES",
  "non-finite available water is blocked",
);

output = build([
  layer({ estimate_id: "dup", layer_depth_cm: 20 }),
  layer({ estimate_id: "dup", layer_depth_cm: 40 }),
]);
assert(output.input_status === "INSUFFICIENT_LAYER_ESTIMATES", "duplicate estimate_id is blocked");
assert(output.blocking_reasons.includes("duplicate_estimate_id"), "duplicate estimate_id reported");

output = build([
  layer({ estimate_id: "depth_a", layer_depth_cm: 20 }),
  layer({ estimate_id: "depth_b", layer_depth_cm: 20 }),
]);
assert(output.input_status === "INSUFFICIENT_LAYER_ESTIMATES", "duplicate depth is blocked");
assert(output.blocking_reasons.includes("duplicate_layer_depth_cm"), "duplicate depth reported");

console.log(`[${name}] PASS`);
