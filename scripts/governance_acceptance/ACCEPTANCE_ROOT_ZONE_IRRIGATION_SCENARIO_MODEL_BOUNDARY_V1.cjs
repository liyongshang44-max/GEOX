// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_BOUNDARY_V1.cjs
const fs = require("node:fs");
require("tsx/cjs");

const ACCEPTANCE_NAME = "ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_MODEL_BOUNDARY_V1";
const BUILDER_FILE = "apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts";
const FORBIDDEN_TOKENS = [
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
  console.error(`[${ACCEPTANCE_NAME}] FAIL: ${message}`);
  if (detail !== undefined) {
    console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function assertBuilderBoundary() {
  const text = fs.readFileSync(BUILDER_FILE, "utf8");
  assert(text.startsWith(`// ${BUILDER_FILE}`), "builder must start with path comment");

  for (const token of FORBIDDEN_TOKENS) {
    assert(!text.includes(token), `forbidden token found: ${token}`);
  }
}

const { buildRootZoneIrrigationScenarioSetV1 } = require(`${process.cwd()}/${BUILDER_FILE}`);
const scope = {
  tenant_id: "tenant_a",
  project_id: "project_a",
  group_id: "group_a",
  field_id: "field_a",
  zone_id: "zone_a",
};
const computed_at = "2026-06-21T00:00:00.000Z";

function makeDailyForecast() {
  return [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
    const projectedAvailableWaterMm = 45 - dayIndex * 5;
    const projectedAvailableWaterFraction = projectedAvailableWaterMm / 100;

    return {
      day_index: dayIndex,
      date: `2026-06-${21 + dayIndex}`,
      precipitation_mm: 0,
      effective_precipitation_mm: 0,
      et0_mm: 5,
      crop_coefficient: 1,
      estimated_crop_et_mm: 5,
      net_water_change_mm: dayIndex === 0 ? -5 : -5,
      projected_available_water_mm: projectedAvailableWaterMm,
      projected_available_water_fraction: projectedAvailableWaterFraction,
      forecast_water_status: projectedAvailableWaterFraction < 0.25 ? "STRESS" : "LIMITED_AVAILABLE",
      bound_applied: "NONE",
    };
  });
}

function makeForecast(overrides = {}) {
  return {
    forecast_id: "forecast_a",
    ...scope,
    source_state_id: "state_a",
    source_state_ref: "state_a",
    weather_forecast_ref: "wx",
    baseline_mode: "NO_NEW_ACTION",
    horizon_days: 7,
    root_zone_depth_cm: 60,
    root_zone_available_water_capacity_mm: 100,
    initial_available_water_fraction: 0.5,
    initial_weighted_matric_potential_kpa: -50,
    daily_forecast: makeDailyForecast(),
    min_available_water_fraction: 0.15,
    max_available_water_fraction: 0.45,
    first_stress_date: "2026-06-26",
    stress_day_count: 2,
    limited_day_count: 5,
    forecast_status: "ESTIMATED",
    blocking_reasons: [],
    calculation_inputs: {},
    derivation: {},
    confidence: { level: "HIGH", score: 0.9, basis: "test" },
    computed_at,
    determinism_hash: "forecast_hash",
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildRootZoneIrrigationScenarioSetV1({
    ...scope,
    sourceForecast: makeForecast(),
    application_efficiency: 0.8,
    computed_at,
    ...overrides,
  });
}

function option(output, optionId) {
  const found = output.options.find((candidate) => candidate.option_id === optionId);
  assert(found, `option exists: ${optionId}`);
  return found;
}

function assertNoNanProjection(output) {
  for (const scenarioOption of output.options) {
    for (const day of scenarioOption.daily_projection) {
      assert(Number.isFinite(day.projected_available_water_mm), "projection mm remains finite", day);
      assert(Number.isFinite(day.projected_available_water_fraction), "projection AWF remains finite", day);
      assert(Number.isFinite(day.delta_vs_baseline_fraction), "projection delta remains finite", day);
    }
  }
}

assertBuilderBoundary();

const output = build();
assert(output.input_status === "COMPARABLE", "valid scenario set returns COMPARABLE");
assert(JSON.stringify(output) === JSON.stringify(build()), "same input returns identical output");
assert(output.options.length === 5, "exactly five fixed options");

const reorderedDailyForecast = [...makeDailyForecast()].reverse();
const reorderedOutput = build({ sourceForecast: makeForecast({ daily_forecast: reorderedDailyForecast }) });
assert(output.determinism_hash === reorderedOutput.determinism_hash, "daily_forecast reorder keeps hash stable");
assert(JSON.stringify(output) === JSON.stringify(reorderedOutput), "daily_forecast reorder keeps output stable");

const noAction = option(output, "NO_ACTION");
assert(
  JSON.stringify(noAction.daily_projection.map((day) => day.projected_available_water_mm)) ===
    JSON.stringify(makeForecast().daily_forecast.map((day) => day.projected_available_water_mm)),
  "NO_ACTION reproduces baseline",
);

const irrigate10 = option(output, "IRRIGATE_10MM_DAY0");
const irrigate20 = option(output, "IRRIGATE_20MM_DAY0");
const delayed = option(output, "DELAY_3_DAYS_THEN_IRRIGATE_20MM");
assert(
  irrigate10.daily_projection[0].projected_available_water_fraction >
    irrigate10.daily_projection[0].baseline_available_water_fraction,
  "IRRIGATE_10MM_DAY0 improves AWF vs baseline",
);
assert(
  irrigate20.daily_projection[0].projected_available_water_fraction > irrigate10.daily_projection[0].projected_available_water_fraction,
  "IRRIGATE_20MM_DAY0 improves AWF more than 10mm",
);
assert(delayed.irrigation_events[0].day_index === 3, "DELAY_3_DAYS_THEN_IRRIGATE_20MM applies event on day 3");
assert(delayed.daily_projection[3].delta_vs_baseline_fraction > 0, "delayed option changes day 3 projection");

const saturatedForecast = makeForecast({
  root_zone_available_water_capacity_mm: 50,
  daily_forecast: makeDailyForecast().map((day) => ({
    ...day,
    net_water_change_mm: 0,
    projected_available_water_mm: 45,
    projected_available_water_fraction: 0.9,
    forecast_water_status: "SATURATED_OR_NEAR_SATURATED",
  })),
  min_available_water_fraction: 0.9,
  max_available_water_fraction: 0.9,
  first_stress_date: null,
  stress_day_count: 0,
  limited_day_count: 0,
});
assert(
  option(build({ sourceForecast: saturatedForecast }), "IRRIGATE_30MM_DAY0").daily_projection[0].bound_applied === "UPPER_BOUND",
  "upper bound is recorded",
);

assert(build({ application_efficiency: 0 }).input_status === "INVALID_INPUT", "invalid application_efficiency returns INVALID_INPUT");
assert(build({ application_efficiency: Number.NaN }).input_status === "INVALID_INPUT", "NaN application_efficiency returns INVALID_INPUT");
assertNoNanProjection(build({ application_efficiency: Number.NaN }));
assert(build({ application_efficiency: Number.POSITIVE_INFINITY }).input_status === "INVALID_INPUT", "Infinity application_efficiency returns INVALID_INPUT");
assertNoNanProjection(build({ application_efficiency: Number.POSITIVE_INFINITY }));
assert(build({ sourceForecast: makeForecast({ zone_id: "other" }) }).input_status === "INVALID_INPUT", "source forecast scope mismatch returns INVALID_INPUT");
assert(build({ sourceForecast: makeForecast({ forecast_status: "UNKNOWN" }) }).input_status === "INSUFFICIENT_FORECAST", "forecast_status not ESTIMATED returns INSUFFICIENT_FORECAST");
assert(build({ sourceForecast: makeForecast({ horizon_days: 6 }) }).input_status === "INSUFFICIENT_FORECAST", "sourceForecast.horizon_days !== 7 returns INSUFFICIENT_FORECAST");
assert(build({ sourceForecast: makeForecast({ daily_forecast: makeDailyForecast().slice(0, 6) }) }).input_status === "INSUFFICIENT_FORECAST", "daily_forecast length not 7 returns INSUFFICIENT_FORECAST");
assert(build({ sourceForecast: makeForecast({ daily_forecast: makeDailyForecast().map((day, index) => (index === 1 ? { ...day, day_index: 0 } : day)) }) }).input_status === "INVALID_INPUT", "duplicate day_index returns INVALID_INPUT");
assert(build({ sourceForecast: makeForecast({ daily_forecast: makeDailyForecast().map((day, index) => (index === 6 ? { ...day, day_index: 8 } : day)) }) }).input_status === "INVALID_INPUT", "day_index set not exactly 0..6 returns INVALID_INPUT");
assert(build({ sourceForecast: makeForecast({ daily_forecast: makeDailyForecast().map((day, index) => (index === 1 ? { ...day, date: "2026-06-21" } : day)) }) }).input_status === "INVALID_INPUT", "duplicate date returns INVALID_INPUT");
assert(build({ sourceForecast: makeForecast({ daily_forecast: makeDailyForecast().map((day, index) => (index === 0 ? { ...day, projected_available_water_fraction: 0.99 } : day)) }) }).input_status === "INVALID_INPUT", "baseline AWF inconsistent with mm/capacity returns INVALID_INPUT");
assert(build({ sourceForecast: makeForecast({ determinism_hash: "" }) }).input_status === "INSUFFICIENT_FORECAST", "missing source forecast determinism_hash returns INSUFFICIENT_FORECAST");

console.log(`[${ACCEPTANCE_NAME}] PASS`);
