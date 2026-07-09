// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_01_STATE_MATH.ts
// Purpose: verify the complete bounded S3B bootstrap State mathematics, physical bounds, deterministic output, input immutability, and Domain purity.
// Boundary: acceptance-only filesystem reads; no database, route, Runtime orchestration, canonical write, Forecast, propagation, or web code.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1 } from "../../apps/server/src/domain/twin_runtime/runtime_config_v1.js";
import { assimilateScalarGaussianObservationV1 } from "../../apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.js";
import { computeRootZoneWaterBootstrapPosteriorV1, validateBootstrapWaterPosteriorOutputV1, type BootstrapWaterPosteriorInputV1, type BootstrapWaterPosteriorOutputV1 } from "../../apps/server/src/domain/soil_water/root_zone_water_posterior_v1.js";
import { validatePosteriorPhysicalStateV1 } from "../../apps/server/src/domain/twin_runtime/physical_bounds_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/mcft/water_state/expected/MCFT_CAP_01_STATE_MATH_EXPECTED.json"), "utf8")) as {
  hydraulic_configuration: BootstrapWaterPosteriorInputV1["hydraulic_configuration"];
  observation: NonNullable<BootstrapWaterPosteriorInputV1["observation"]>;
  expected: Record<string, number>;
};

type NegativeFixtureV1 = {
  fixture_id: string;
  failure_stage: string;
  expected_reason_code: string;
  expected_output_delta: number;
};
const negativeFixtures = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/mcft/water_state/negative/MCFT_CAP_01_STATE_MATH_NEGATIVE_FIXTURES.json"), "utf8")) as NegativeFixtureV1[];
const negativeById = new Map(negativeFixtures.map((item) => [item.fixture_id, item]));
function negativeReason(fixtureId: string): RegExp {
  const fixtureItem = negativeById.get(fixtureId);
  if (!fixtureItem) throw new Error(`MISSING_NEGATIVE_FIXTURE:${fixtureId}`);
  assert.equal(fixtureItem.expected_output_delta, 0, `${fixtureId} must declare zero output delta`);
  assert.ok(fixtureItem.failure_stage, `${fixtureId} failure stage required`);
  return new RegExp(fixtureItem.expected_reason_code);
}

let pass = 0;
function check(condition: unknown, message: string): void {
  assert.ok(condition, message);
  pass += 1;
  console.log(`PASS ${message}`);
}
function exact(actual: unknown, expected: unknown, message: string): void {
  assert.deepEqual(actual, expected, message);
  pass += 1;
  console.log(`PASS ${message}`);
}
function rejection(run: () => unknown, reasonCode: RegExp, message: string): void {
  assert.throws(run, reasonCode);
  pass += 1;
  console.log(`PASS ${message}`);
}

const standardInput: BootstrapWaterPosteriorInputV1 = {
  hydraulic_configuration: fixture.hydraulic_configuration,
  observation: fixture.observation,
};
const standard = computeRootZoneWaterBootstrapPosteriorV1(standardInput);
const expected = fixture.expected;
exact(standard.bootstrap_prior.mean, expected.prior_mean, "standard prior mean");
exact(standard.bootstrap_prior.stddev, expected.prior_stddev, "standard prior stddev");
exact(standard.bootstrap_prior.variance, expected.prior_variance, "standard prior variance");
exact(standard.assimilation_update.predicted_observation, expected.predicted_observation, "standard predicted observation");
exact(standard.assimilation_update.innovation, expected.innovation, "standard innovation");
exact(standard.assimilation_update.sensor_variance, expected.sensor_variance, "standard sensor variance");
exact(standard.assimilation_update.representativeness_variance, expected.representativeness_variance, "standard representativeness variance");
exact(standard.assimilation_update.base_observation_variance, 0.004, "standard base observation variance");
exact(standard.assimilation_update.effective_observation_variance, expected.effective_observation_variance, "standard effective observation variance");
exact(standard.assimilation_update.assimilation_gain, expected.assimilation_gain, "standard assimilation gain");
const standardVwc = standard.posterior_state.root_zone_volumetric_water_content_fraction as Record<string, unknown>;
const standardStorage = standard.posterior_state.root_zone_water_storage_mm as Record<string, unknown>;
exact(standardVwc.mean, expected.posterior_mean, "standard posterior mean");
exact(standardVwc.variance, expected.posterior_variance, "standard posterior variance");
exact(standardVwc.stddev, expected.posterior_stddev, "standard posterior stddev");
exact(standardVwc.interval_low, expected.interval_low, "standard interval low");
exact(standardVwc.interval_high, expected.interval_high, "standard interval high");
exact(standardStorage.mean, expected.storage_mean_mm, "standard storage mean");
exact(standardStorage.stddev, expected.storage_stddev_mm, "standard storage stddev");
exact(standardStorage.interval_low, expected.storage_interval_low_mm, "standard storage interval low");
exact(standardStorage.interval_high, expected.storage_interval_high_mm, "standard storage interval high");
exact(standard.posterior_state.available_water_fraction, expected.available_water_fraction, "standard available-water fraction");
exact(standard.posterior_state.root_zone_depletion_from_field_capacity_mm, expected.depletion_from_field_capacity_mm, "standard depletion from field capacity");
check(Number(standard.assimilation_update.posterior_variance) < Number(standard.assimilation_update.prior_variance), "posterior variance is below prior variance");
exact(standard.observation_operator.direct_state_equivalence, false, "point observation is not direct State equivalence");
exact(standard.posterior_state.surface_soil_moisture_state.status, "UNAVAILABLE_NO_BOUND_SURFACE_OBSERVATION", "surface State remains unavailable");
exact(standard.posterior_state.water_stress_state.status, "NOT_ESTABLISHED_NO_STRESS_MODEL", "water-stress State remains not established");
exact(standard.posterior_state.drainage_state.status, "NOT_ESTABLISHED_MCFT_06_NOT_STARTED", "drainage State remains not established");
exact(standard.posterior_state.confidence, { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" }, "confidence remains non-numeric and not established");
exact(standard.posterior_state.use_eligibility, {
  state_valid: true,
  posterior_chain_eligible: true,
  forecast_source_eligible: true,
  recommendation_input_eligible: false,
  action_input_eligible: false,
}, "State eligibility matches frozen boundary");

const limited = computeRootZoneWaterBootstrapPosteriorV1({
  ...standardInput,
  observation: { ...fixture.observation, quality_status: "LIMITED" },
});
exact(limited.assimilation_update.quality_weight, 0.5, "LIMITED quality weight");
exact(limited.assimilation_update.effective_observation_variance, 0.008, "LIMITED effective observation variance");
exact(limited.assimilation_update.assimilation_gain, 0.503106, "LIMITED assimilation gain");
exact((limited.posterior_state.root_zone_volumetric_water_content_fraction as Record<string, unknown>).mean, 0.196919, "LIMITED posterior mean");

rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, quality_status: "FAIL" } }), negativeReason("mcft_s3b_quality_fail_consumed"), "FAIL quality observation rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: null }), /MISSING_OBSERVATION/, "missing observation rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: -0.001 } }), negativeReason("mcft_s3b_vwc_below_zero"), "observation below zero rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: 1.001 } }), negativeReason("mcft_s3b_vwc_above_one"), "observation above one rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: Number.NaN } }), negativeReason("mcft_s3b_vwc_nan"), "NaN observation rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: Number.POSITIVE_INFINITY } }), negativeReason("mcft_s3b_vwc_infinity"), "Infinity observation rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, hydraulic_configuration: { ...fixture.hydraulic_configuration, field_capacity_fraction: 0.1 } }), negativeReason("mcft_s3b_invalid_hydraulic_ordering"), "invalid hydraulic ordering rejected");
rejection(() => assimilateScalarGaussianObservationV1({
  prior_mean: Number.NaN,
  prior_variance: 0.0081,
  observation: 0.184,
  h: 1,
  sensor_measurement_stddev_fraction: 0.02,
  point_to_zone_representativeness_stddev_fraction: 0.06,
  quality_status: "PASS",
  quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0 },
}), /INVALID_PRIOR_MEAN/, "invalid prior mean rejected");
rejection(() => assimilateScalarGaussianObservationV1({
  prior_mean: 0.21,
  prior_variance: -0.1,
  observation: 0.184,
  h: 1,
  sensor_measurement_stddev_fraction: 0.02,
  point_to_zone_representativeness_stddev_fraction: 0.06,
  quality_status: "PASS",
  quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0 },
}), negativeReason("mcft_s3b_negative_prior_variance"), "negative prior variance rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, direct_state_equivalence: true as false } }), negativeReason("mcft_s3b_direct_state_equivalence"), "direct State equivalence rejected");
rejection(() => computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: 1 } }), negativeReason("mcft_s3b_posterior_above_saturation"), "posterior above saturation rejected");
rejection(() => validatePosteriorPhysicalStateV1({ posterior_mean: 0.2, posterior_variance: -0.001, posterior_stddev: 0.01, saturation_fraction: 0.45 }), negativeReason("mcft_s3b_negative_posterior_variance"), "negative posterior variance rejected");
const numericConfidence = JSON.parse(JSON.stringify(standard)) as BootstrapWaterPosteriorOutputV1;
(numericConfidence.posterior_state.confidence as unknown as Record<string, unknown>).score = 0.8;
rejection(() => validateBootstrapWaterPosteriorOutputV1(numericConfidence), negativeReason("mcft_s3b_numeric_confidence"), "numeric confidence score rejected");
const recommendationEligible = JSON.parse(JSON.stringify(standard)) as BootstrapWaterPosteriorOutputV1;
(recommendationEligible.posterior_state.use_eligibility as unknown as Record<string, unknown>).recommendation_input_eligible = true;
rejection(() => validateBootstrapWaterPosteriorOutputV1(recommendationEligible), negativeReason("mcft_s3b_recommendation_eligible"), "recommendation eligibility true rejected");
const actionEligible = JSON.parse(JSON.stringify(standard)) as BootstrapWaterPosteriorOutputV1;
(actionEligible.posterior_state.use_eligibility as unknown as Record<string, unknown>).action_input_eligible = true;
rejection(() => validateBootstrapWaterPosteriorOutputV1(actionEligible), negativeReason("mcft_s3b_action_eligible"), "action eligibility true rejected");

const clipped = computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: 0 } });
const clippedUncertainty = ((clipped.posterior_state.root_zone_volumetric_water_content_fraction as Record<string, unknown>).uncertainty ?? {}) as Record<string, unknown>;
exact(clippedUncertainty.interval_clipped, true, "uncertainty interval clipping detected");
exact(clippedUncertainty.interval_low, 0, "clipped interval respects zero lower bound");
check(Number((clippedUncertainty.unclipped_interval as Record<string, unknown>).low) < 0, "unclipped interval metadata preserved");
exact(clipped.posterior_state.available_water_fraction, 0, "available-water fraction clamps at zero");

const upperClipped = computeRootZoneWaterBootstrapPosteriorV1({ ...standardInput, observation: { ...fixture.observation, value_fraction: 0.45 } });
const upperClippedUncertainty = ((upperClipped.posterior_state.root_zone_volumetric_water_content_fraction as Record<string, unknown>).uncertainty ?? {}) as Record<string, unknown>;
exact(upperClippedUncertainty.interval_high, 0.45, "uncertainty interval clips at saturation");
exact(upperClipped.posterior_state.available_water_fraction, 1, "available-water fraction clamps at one");
exact(upperClipped.posterior_state.root_zone_depletion_from_field_capacity_mm, 0, "depletion never becomes negative");

exact(computeRootZoneWaterBootstrapPosteriorV1(standardInput), standard, "deterministic rerun is byte-semantic equivalent");
const mutableProbe = JSON.parse(JSON.stringify(standardInput)) as BootstrapWaterPosteriorInputV1;
const before = JSON.stringify(mutableProbe);
computeRootZoneWaterBootstrapPosteriorV1(mutableProbe);
exact(JSON.stringify(mutableProbe), before, "input object remains immutable");

exact(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.physical_bound_version, "ROOT_ZONE_WATER_PHYSICAL_BOUNDS_V1", "Runtime Config carries physical-bound version");
exact(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.gaussian_interval_rule, "NORMAL_95_Z_1_96_V1", "Runtime Config carries Gaussian interval rule");
exact(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.uncertainty_interval_clip_rule, "CLIP_TO_ZERO_AND_SATURATION_WITH_UNCLIPPED_METADATA_V1", "Runtime Config carries clipping rule");
exact(MCFT_CAP_01_BOOTSTRAP_MODEL_CONFIG_V1.interval_clip_bounds, [0, 0.45], "Runtime Config carries frozen clipping bounds");

const domainFiles = [
  "apps/server/src/domain/twin_runtime/physical_bounds_v1.ts",
  "apps/server/src/domain/soil_water/bootstrap_water_prior_v1.ts",
  "apps/server/src/domain/soil_water/root_zone_observation_operator_v1.ts",
  "apps/server/src/domain/soil_water/scalar_gaussian_assimilation_v1.ts",
  "apps/server/src/domain/soil_water/root_zone_water_posterior_v1.ts",
];
const forbiddenPatterns = [
  /from\s+["']node:fs["']/,
  /from\s+["']pg["']/,
  /process\.env/,
  /Date\.now\s*\(/,
  /new\s+Date\s*\(/,
  /Math\.random\s*\(/,
  /randomUUID/,
  /nanoid/,
  /from\s+["']node:(?:http|https|net|tls|dns)["']/,
  /^(?:export\s+)?let\s+/m,
  /fetch\s*\(/,
  /Fastify/,
  /setInterval\s*\(/,
  /setTimeout\s*\(/,
];
exact(negativeFixtures.length, 19, "all required negative fixtures declared");
for (const fixtureItem of negativeFixtures) {
  check(Boolean(fixtureItem.fixture_id && fixtureItem.failure_stage && fixtureItem.expected_reason_code), `negative fixture ${fixtureItem.fixture_id} declares required metadata`);
  exact(fixtureItem.expected_output_delta, 0, `negative fixture ${fixtureItem.fixture_id} declares zero output delta`);
}

for (const relativePath of domainFiles) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  for (const pattern of forbiddenPatterns) assert.doesNotMatch(source, pattern, `${relativePath} violates Domain purity with ${pattern}`);
}
check(true, "Domain purity scan");

console.log(`MCFT-CAP-01 S3B State Math: ${pass} PASS, 0 FAIL`);
