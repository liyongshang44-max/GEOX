// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_STATE_MATH.ts
// Purpose: prove S3B exact bootstrap mathematics, physical bounds, uncertainty, negative cases, determinism, immutability, compiled config identity, purity, and changed-file boundary.
// Boundary: acceptance-only fixture, authority-artifact, and source reads; no database, canonical write, Runtime orchestration, Evidence selection, network, or wall clock.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_v1.js";
import { assimilateScalarGaussianV1 } from "../../apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.js";
import {
  buildRootZoneWaterPosteriorV1,
  validateRootZoneWaterPosteriorV1,
  type RootZoneWaterPosteriorInputV1,
} from "../../apps/server/src/domain/soil_water/root_zone_water_posterior_v1.js";
import {
  compileRuntimeConfigFromAuthorityArtifactsV1,
  type Mcft00ConfigurationMatrixArtifactV1,
  type Mcft00RealityArtifactV1,
  type Mcft00SourceMatrixArtifactV1,
} from "../../apps/server/src/runtime/twin_runtime/runtime_config_authority_adapter_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE = "4ddd2bbf4d5d421f875e3ab5b1bfd76749f2ca3a";
const EXPECTED_PATH = "fixtures/mcft/water_state/expected/MCFT_CAP_01_STATE_MATH_EXPECTED.json";
const NEGATIVE_PATH = "fixtures/mcft/water_state/negative/MCFT_CAP_01_STATE_MATH_NEGATIVE_FIXTURES.json";
const DOMAIN_FILES = [
  "apps/server/src/domain/twin_runtime/physical_bounds_v1.ts",
  "apps/server/src/domain/soil_water/bootstrap_water_prior_v1.ts",
  "apps/server/src/domain/soil_water/root_zone_observation_operator_v1.ts",
  "apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.ts",
  "apps/server/src/domain/soil_water/root_zone_water_posterior_v1.ts",
];

let pass = 0;
function check(condition: unknown, message: string): void {
  assert.ok(condition, message);
  pass += 1;
  console.log(`PASS ${message}`);
}
function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8")) as T;
}
function standardInput(): RootZoneWaterPosteriorInputV1 {
  return {
    observation_fraction: 0.184,
    quality_status: "PASS",
    hydraulic: {
      wilting_point_fraction: 0.12,
      field_capacity_fraction: 0.3,
      saturation_fraction: 0.45,
      root_zone_depth_mm: 300,
    },
    model_config: MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1,
  };
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
function expectError(fn: () => unknown, code: string, message: string): void {
  assert.throws(fn, new RegExp(code));
  check(true, message);
}

const expectedFixture = readJson<{ case_id: string; input: unknown; expected: unknown }>(EXPECTED_PATH);
const standard = buildRootZoneWaterPosteriorV1(standardInput());
validateRootZoneWaterPosteriorV1(standard);
assert.deepEqual(standard, expectedFixture.expected);
check(expectedFixture.case_id === "mcft_cap_01_bootstrap_water_state_001", "standard fixture identity");
check(true, "standard exact-value fixture matches complete posterior DTO");
check(standard.prior.mean === 0.21 && standard.prior.variance === 0.0081, "weak prior exact values");
check(standard.observation_update.observation_fraction === 0.184, "observation exact value");
check(standard.observation_update.effective_observation_variance === 0.004, "observation variance exact value");
check(standard.observation_update.innovation === -0.026, "innovation exact value");
check(standard.observation_update.assimilation_gain === 0.669421, "assimilation gain exact value");
check(standard.posterior.mean === 0.192595, "posterior mean exact value");
check(standard.posterior.variance === 0.002678, "posterior variance exact value");
check(standard.posterior.stddev === 0.051746, "posterior stddev exact value");
check(standard.posterior.uncertainty.interval_low === 0.091172 && standard.posterior.uncertainty.interval_high === 0.294018, "95 percent interval exact values");
check(standard.derived_state.root_zone_water_storage_mm.mean === 57.778512, "storage mean exact value");
check(standard.derived_state.root_zone_water_storage_mm.stddev === 15.523909, "storage stddev exact value");
check(standard.derived_state.root_zone_water_storage_mm.interval_low === 27.351652 && standard.derived_state.root_zone_water_storage_mm.interval_high === 88.205373, "storage interval exact values");
check(standard.derived_state.available_water_fraction === 0.403306, "available-water exact value");
check(standard.derived_state.depletion_from_field_capacity_mm === 32.221488, "depletion exact value");
check(standard.posterior.mean !== standard.prior.mean && standard.posterior.mean !== standard.observation_update.observation_fraction, "posterior differs from prior and raw observation");
check(standard.posterior.variance < standard.prior.variance, "posterior variance reduced");
check(standard.direct_state_equivalence === false, "point observation is not direct State equivalence");
check(standard.confidence.status === "NOT_ESTABLISHED" && !("score" in standard.confidence), "confidence remains non-numeric and not established");
check(standard.use_eligibility.forecast_source_eligible && !standard.use_eligibility.recommendation_input_eligible && !standard.use_eligibility.action_input_eligible, "eligibility boundary");
check(standard.unavailable_state.surface_soil_moisture_state === "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION", "surface State remains unavailable");

const limitedInput = standardInput();
limitedInput.quality_status = "LIMITED";
const limited = buildRootZoneWaterPosteriorV1(limitedInput);
check(limited.observation_update.quality_weight === 0.5 && limited.observation_update.effective_observation_variance === 0.008, "LIMITED quality variance inflation");
check(limited.observation_update.assimilation_gain < standard.observation_update.assimilation_gain, "LIMITED quality reduces assimilation gain");
check(limited.posterior.variance > standard.posterior.variance, "LIMITED quality retains more posterior uncertainty");

for (const [value, code, label] of [
  [-0.001, "OBSERVATION_BELOW_ZERO", "observation below zero rejected"],
  [1.001, "OBSERVATION_ABOVE_ONE", "observation above one rejected"],
  [undefined, "OBSERVATION_REQUIRED", "missing observation rejected"],
  [Number.NaN, "OBSERVATION_NON_FINITE", "NaN observation rejected"],
  [Number.POSITIVE_INFINITY, "OBSERVATION_NON_FINITE", "Infinity observation rejected"],
] as const) {
  expectError(() => buildRootZoneWaterPosteriorV1({ ...standardInput(), observation_fraction: value }), code, label);
}
expectError(() => buildRootZoneWaterPosteriorV1({ ...standardInput(), quality_status: "FAIL" }), "QUALITY_FAIL_OBSERVATION_REJECTED", "FAIL quality rejected before assimilation");
expectError(() => buildRootZoneWaterPosteriorV1({ ...standardInput(), hydraulic: { wilting_point_fraction: 0.3, field_capacity_fraction: 0.12, saturation_fraction: 0.45, root_zone_depth_mm: 300 } }), "INVALID_HYDRAULIC_ORDERING", "invalid hydraulic ordering rejected");
expectError(() => assimilateScalarGaussianV1({ prior_mean: 0.2, prior_variance: -0.1, observation: 0.18, observation_variance: 0.004, observation_operator_h: 1 }), "NEGATIVE_PRIOR_VARIANCE", "negative prior variance rejected");
expectError(() => assimilateScalarGaussianV1({ prior_mean: 0.2, prior_variance: 0.01, observation: 0.18, observation_variance: -0.004, observation_operator_h: 1 }), "NEGATIVE_OBSERVATION_VARIANCE", "negative observation variance rejected");

const nearCertainConfig = structuredClone(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1) as typeof MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1;
(nearCertainConfig as { sensor_measurement_stddev_fraction: number }).sensor_measurement_stddev_fraction = 0.000001;
(nearCertainConfig as { point_to_zone_representativeness_stddev_fraction: number }).point_to_zone_representativeness_stddev_fraction = 0;
expectError(() => buildRootZoneWaterPosteriorV1({
  observation_fraction: 1,
  quality_status: "PASS",
  hydraulic: { wilting_point_fraction: 0.1, field_capacity_fraction: 0.2, saturation_fraction: 0.21, root_zone_depth_mm: 300 },
  model_config: nearCertainConfig,
}), "POSTERIOR_PHYSICAL_BOUND_VIOLATION", "posterior above saturation rejected");

const clipped = buildRootZoneWaterPosteriorV1({
  observation_fraction: 0,
  quality_status: "PASS",
  hydraulic: { wilting_point_fraction: 0, field_capacity_fraction: 0.02, saturation_fraction: 0.03, root_zone_depth_mm: 300 },
  model_config: MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1,
});
check(clipped.posterior.uncertainty.interval_clipped, "uncertainty interval clipping recorded");
check(clipped.posterior.uncertainty.unclipped_interval.low < 0 && clipped.posterior.uncertainty.interval_low === 0, "unclipped interval retained while low bound clipped");

const dry = buildRootZoneWaterPosteriorV1({ ...standardInput(), observation_fraction: 0 });
check(dry.derived_state.available_water_fraction === 0, "available-water fraction clamps to zero");
const wet = buildRootZoneWaterPosteriorV1({ ...standardInput(), observation_fraction: 0.4 });
check(wet.derived_state.depletion_from_field_capacity_mm === 0, "depletion remains non-negative and clamps to zero above field capacity");

const rerun = buildRootZoneWaterPosteriorV1(standardInput());
assert.deepEqual(rerun, standard);
check(true, "deterministic rerun is byte-structurally identical");
const mutableInput = standardInput();
const beforeInput = JSON.stringify(mutableInput);
buildRootZoneWaterPosteriorV1(deepFreeze(mutableInput));
check(JSON.stringify(mutableInput) === beforeInput, "input object remains immutable");

const numericConfidence = structuredClone(standard) as unknown as Record<string, unknown>;
(numericConfidence.confidence as Record<string, unknown>).score = 0.9;
expectError(() => validateRootZoneWaterPosteriorV1(numericConfidence), "NUMERIC_CONFIDENCE_FORBIDDEN", "numeric confidence rejected");
const recommendationEligible = structuredClone(standard);
(recommendationEligible.use_eligibility as { recommendation_input_eligible: boolean }).recommendation_input_eligible = true;
expectError(() => validateRootZoneWaterPosteriorV1(recommendationEligible), "RECOMMENDATION_ELIGIBILITY_FORBIDDEN", "recommendation eligibility true rejected");
const actionEligible = structuredClone(standard);
(actionEligible.use_eligibility as { action_input_eligible: boolean }).action_input_eligible = true;
expectError(() => validateRootZoneWaterPosteriorV1(actionEligible), "ACTION_ELIGIBILITY_FORBIDDEN", "action eligibility true rejected");
const directEquivalent = structuredClone(standard) as unknown as Record<string, unknown>;
directEquivalent.direct_state_equivalence = true;
expectError(() => validateRootZoneWaterPosteriorV1(directEquivalent), "DIRECT_STATE_EQUIVALENCE_FORBIDDEN", "direct State equivalence true rejected");
const negativePosteriorVariance = structuredClone(standard);
(negativePosteriorVariance.posterior as { variance: number }).variance = -0.1;
expectError(() => validateRootZoneWaterPosteriorV1(negativePosteriorVariance), "NEGATIVE_POSTERIOR_VARIANCE", "negative posterior variance rejected");
const inferredSurface = structuredClone(standard);
(inferredSurface.unavailable_state as { surface_soil_moisture_state: string }).surface_soil_moisture_state = "ESTIMATED";
expectError(() => validateRootZoneWaterPosteriorV1(inferredSurface), "SURFACE_STATE_INFERENCE_FORBIDDEN", "surface State inference rejected");

check(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.physical_bound_version === "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1", "Runtime Config physical-bound identity present");
check(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.gaussian_interval_rule === "NORMAL_95_Z_1_96_V1", "Runtime Config Gaussian interval identity present");
check(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.uncertainty_interval_clip_rule === "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1", "Runtime Config clipping identity present");
check(JSON.stringify(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.interval_clip_bounds) === JSON.stringify([0, "saturation_fraction"]), "Runtime Config clipping bounds present");

const compiledRuntimeConfig = compileRuntimeConfigFromAuthorityArtifactsV1({
  realityArtifact: readJson<Mcft00RealityArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-REALITY-BINDING.json"),
  sourceMatrixArtifact: readJson<Mcft00SourceMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-SOURCE-BINDING-MATRIX.json"),
  configurationMatrixArtifact: readJson<Mcft00ConfigurationMatrixArtifactV1>("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json"),
  logical_time: "2026-06-01T00:00:00.000Z",
  created_at: "2026-06-01T00:00:00.000Z",
});
const compiledBootstrapConfig = compiledRuntimeConfig.payload.bootstrap_model_config as Record<string, unknown>;
check(compiledRuntimeConfig.object_type === "twin_runtime_config_v1", "compiled Runtime Config object type");
check(compiledBootstrapConfig.physical_bound_version === "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1", "compiled Runtime Config carries physical-bound identity");
check(compiledBootstrapConfig.gaussian_interval_rule === "NORMAL_95_Z_1_96_V1", "compiled Runtime Config carries Gaussian interval identity");
check(compiledBootstrapConfig.uncertainty_interval_clip_rule === "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1", "compiled Runtime Config carries clipping identity");
check(JSON.stringify(compiledBootstrapConfig.interval_clip_bounds) === JSON.stringify([0, "saturation_fraction"]), "compiled Runtime Config carries symbolic clipping bounds");

const negativeFixture = readJson<{ fixtures: Array<Record<string, unknown>> }>(NEGATIVE_PATH);
check(negativeFixture.fixtures.length >= 18, "negative fixture catalog is complete");
for (const fixture of negativeFixture.fixtures) {
  check(typeof fixture.fixture_id === "string" && typeof fixture.failure_stage === "string" && typeof fixture.expected_reason_code === "string", `negative fixture metadata ${String(fixture.fixture_id)}`);
  check(fixture.expected_fact_delta === 0 && fixture.expected_projection_delta === 0 && fixture.expected_pointer_delta === 0, `negative fixture zero-write contract ${String(fixture.fixture_id)}`);
}

const purityPattern = /Date\.now|new Date\s*\(|process\.env|from ["']node:fs|from ["']fs|from ["']pg["']|Fastify|from ["']node:https?|\bfetch\s*\(|randomUUID|nanoid|Math\.random|root_zone_soil_water_state_builder_v1/;
for (const relativePath of DOMAIN_FILES) {
  const text = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  check(!purityPattern.test(text), `${relativePath} domain purity`);
}

const changed = cp.execFileSync("git", ["diff", "--name-only", `${BASELINE}...HEAD`], { cwd: ROOT, encoding: "utf8" })
  .trim().split(/\r?\n/).filter((file: string) => Boolean(file));
const allowedPatterns = [
  /^apps\/server\/src\/domain\/soil_water\/(bootstrap_water_prior_v1|root_zone_observation_operator_v1|scalar_gaussian_assimilation_v1|root_zone_water_posterior_v1)\.ts$/,
  /^apps\/server\/src\/domain\/twin_runtime\/(physical_bounds_v1|runtime_config_v1)\.ts$/,
  /^fixtures\/mcft\/water_state\/(expected|negative)\//,
  /^scripts\/runtime_acceptance\/ACCEPTANCE_MCFT_CAP_01_STATE_MATH\.ts$/,
  /^docs\/digital_twin\/mcft\/cap_01\//,
];
const forbiddenChangedFiles = changed.filter((file: string) => !allowedPatterns.some((pattern) => pattern.test(file)));
check(forbiddenChangedFiles.length === 0, `S3B changed-file boundary: ${forbiddenChangedFiles.join(",")}`);
check(changed.every((file: string) => !file.includes("persistence") && !file.includes("migration") && !file.includes("route") && !file.startsWith("apps/web/")), "S3B excludes persistence migration route and web changes");

console.log(`MCFT-CAP-01 S3B State Math: ${pass} PASS, 0 FAIL`);
