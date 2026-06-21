// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_BOUNDARY_V1.cjs
const fs = require("node:fs");
require("tsx/cjs");

const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_BOUNDARY_V1";
const file = "apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts";
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

const { buildRootZoneSoilWaterForecastV1 } = require(`${process.cwd()}/${file}`);

const scope = {
  tenant_id: "tenant_a",
  project_id: "project_a",
  group_id: "group_a",
  field_id: "field_a",
  zone_id: "zone_a",
};

const computed_at = "2026-06-21T00:00:00.000Z";
const baseSourceState = {
  state_id: "state_a",
  ...scope,
  root_zone_depth_cm: 60,
  layer_estimate_refs: [],
  layer_count: 1,
  estimated_layer_count: 1,
  blocked_layer_count: 0,
  weighted_matric_potential_kpa: -50,
  root_zone_available_water_fraction: 0.5,
  root_zone_water_potential_class: "READILY_AVAILABLE",
  worst_layer_class: "READILY_AVAILABLE",
  stress_layer_count: 0,
  limited_layer_count: 0,
  input_status: "ESTIMATED",
  blocking_reasons: [],
  calculation_inputs: {},
  derivation: {},
  confidence: { level: "HIGH", score: 0.9, basis: "test" },
  computed_at,
  determinism_hash: "state_hash",
};

const sevenDayWeather = [
  { date: "2026-06-23", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  { date: "2026-06-21", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  { date: "2026-06-22", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  { date: "2026-06-24", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  { date: "2026-06-25", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  { date: "2026-06-26", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  { date: "2026-06-27", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
];

function build(overrides = {}) {
  return buildRootZoneSoilWaterForecastV1({
    ...scope,
    sourceState: baseSourceState,
    weather_forecast_ref: "wx",
    root_zone_available_water_capacity_mm: 100,
    effective_rainfall_factor: 0.8,
    dailyWeather: sevenDayWeather,
    computed_at,
    ...overrides,
  });
}

let output = build();
assert(output.forecast_status === "ESTIMATED", "valid forecast returns ESTIMATED");
assert(JSON.stringify(output) === JSON.stringify(build()), "same input returns identical output");
assert(output.daily_forecast[0].date === "2026-06-21", "daily weather sorted deterministically");

const reordered = build({ dailyWeather: [...sevenDayWeather].reverse() });
assert(output.determinism_hash === reordered.determinism_hash, "same weather reordered gives same hash");
assert(JSON.stringify(output) === JSON.stringify(reordered), "same weather reordered gives same result");

const changedDate = build({
  dailyWeather: sevenDayWeather.map((day) =>
    day.date === "2026-06-27" ? { ...day, date: "2026-06-28" } : day,
  ),
});
assert(changedDate.determinism_hash !== output.determinism_hash, "changed date changes hash");

const changedValue = build({
  dailyWeather: sevenDayWeather.map((day) =>
    day.date === "2026-06-21" ? { ...day, et0_mm: day.et0_mm + 1 } : day,
  ),
});
assert(changedValue.determinism_hash !== output.determinism_hash, "changed value changes hash");

assert(
  build({ root_zone_available_water_capacity_mm: 0 }).forecast_status === "INVALID_INPUT",
  "invalid capacity returns INVALID_INPUT",
);
assert(
  build({ effective_rainfall_factor: 1.1 }).forecast_status === "INVALID_INPUT",
  "invalid rainfall factor returns INVALID_INPUT",
);
assert(
  build({ dailyWeather: [] }).forecast_status === "INVALID_INPUT",
  "empty dailyWeather returns INVALID_INPUT",
);
assert(
  build({ dailyWeather: sevenDayWeather.slice(0, 6) }).forecast_status === "INVALID_INPUT",
  "non-7-day weather returns INVALID_INPUT",
);
assert(
  build({ dailyWeather: sevenDayWeather.slice(0, 6) }).blocking_reasons.includes("invalid_horizon_days"),
  "non-7-day weather records invalid_horizon_days",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      index === 1 ? { ...day, date: sevenDayWeather[0].date } : day,
    ),
  }).forecast_status === "INVALID_INPUT",
  "duplicate dates return INVALID_INPUT",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      index === 0 ? { ...day, date: "2026/06/21" } : day,
    ),
  }).forecast_status === "INVALID_INPUT",
  "invalid date format returns INVALID_INPUT",
);
assert(
  build({ sourceState: { ...baseSourceState, input_status: "INSUFFICIENT_LAYER_ESTIMATES" } }).forecast_status ===
    "INSUFFICIENT_STATE",
  "invalid source state returns INSUFFICIENT_STATE",
);
assert(
  build({ sourceState: { ...baseSourceState, zone_id: "other_zone" } }).forecast_status === "INSUFFICIENT_STATE",
  "sourceState scope mismatch returns INSUFFICIENT_STATE",
);
assert(
  build({ sourceState: { ...baseSourceState, determinism_hash: "" } }).forecast_status === "INSUFFICIENT_STATE",
  "sourceState missing determinism_hash returns INSUFFICIENT_STATE",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      index === 0 ? { ...day, precipitation_mm: -1 } : day,
    ),
  }).forecast_status === "INVALID_INPUT",
  "negative precipitation returns INVALID_INPUT",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      index === 0 ? { ...day, et0_mm: -1 } : day,
    ),
  }).forecast_status === "INVALID_INPUT",
  "negative ET0 returns INVALID_INPUT",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      index === 0 ? { ...day, crop_coefficient: -1 } : day,
    ),
  }).forecast_status === "INVALID_INPUT",
  "negative crop coefficient returns INVALID_INPUT",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      day.date === "2026-06-21" ? { ...day, et0_mm: 99 } : day,
    ),
  }).daily_forecast[0].bound_applied === "LOWER_BOUND",
  "lower bound is recorded",
);
assert(
  build({
    dailyWeather: sevenDayWeather.map((day, index) =>
      day.date === "2026-06-21" ? { ...day, precipitation_mm: 99, et0_mm: 0 } : day,
    ),
  }).daily_forecast[0].bound_applied === "UPPER_BOUND",
  "upper bound is recorded",
);

output = build({
  sourceState: { ...baseSourceState, root_zone_available_water_fraction: 0.3 },
  dailyWeather: [
    { date: "2026-06-21", precipitation_mm: 0, et0_mm: 1, crop_coefficient: 1 },
    { date: "2026-06-22", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
    { date: "2026-06-23", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
    { date: "2026-06-24", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
    { date: "2026-06-25", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
    { date: "2026-06-26", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
    { date: "2026-06-27", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
  ],
});
assert(output.limited_day_count === 1, "limited day count is correct");
assert(output.stress_day_count === 6, "stress day count is correct");

console.log(`[${name}] PASS`);
