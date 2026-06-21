// scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_RUNTIME_V1.cjs
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
require("tsx/cjs");

const ACCEPTANCE_NAME = "ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_RUNTIME_V1";
const PREFIX = "h34_root_zone_irrigation_scenario_acceptance_";
const FORBIDDEN_TABLES = [
  "decision_recommendation_index_v1",
  "approval_request_index_v1",
  "approval_decision_index_v1",
  "operation_plan_index_v1",
  "ao_act_task_index_v1",
  "roi_ledger_index_v1",
  "field_memory_index_v1",
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

async function relationExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1)::text AS name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
}

async function scopedCount(client, tableName, scope) {
  if (!(await relationExists(client, tableName))) return 0;

  const result = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.${tableName}
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
    `,
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id],
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function assertFactsTableContract(client) {
  assert(await relationExists(client, "facts"), "public.facts table must already exist");

  const result = await client.query(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'facts'
    `,
  );
  const columns = Object.fromEntries(result.rows.map((row) => [row.column_name, row.data_type]));

  assert(columns.fact_id === "text", "facts.fact_id text column exists");
  assert(columns.occurred_at?.includes("timestamp"), "facts.occurred_at timestamp column exists");
  assert(columns.source === "text", "facts.source text column exists");
  assert(columns.record_json === "jsonb" || columns.record_json === "json", "facts.record_json JSON column exists");
}

function makeForecast(runId, scope, computedAt) {
  const dailyForecast = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
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

  return {
    forecast_id: `${runId}_forecast`,
    ...scope,
    source_state_id: `${runId}_state`,
    source_state_ref: `${runId}_state`,
    weather_forecast_ref: `${runId}_wx`,
    baseline_mode: "NO_NEW_ACTION",
    horizon_days: 7,
    root_zone_depth_cm: 60,
    root_zone_available_water_capacity_mm: 100,
    initial_available_water_fraction: 0.5,
    initial_weighted_matric_potential_kpa: -50,
    daily_forecast: dailyForecast,
    min_available_water_fraction: 0.15,
    max_available_water_fraction: 0.45,
    first_stress_date: "2026-06-26",
    stress_day_count: 2,
    limited_day_count: 5,
    forecast_status: "ESTIMATED",
    blocking_reasons: [],
    calculation_inputs: {},
    derivation: {},
    confidence: { level: "HIGH", score: 0.9, basis: "runtime" },
    computed_at: computedAt,
    determinism_hash: `${runId}_forecast_hash`,
  };
}

async function appendRootZoneIrrigationScenarioFact(client, payload, factId) {
  await client.query(
    `
      INSERT INTO public.facts (fact_id, occurred_at, source, record_json)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (fact_id)
      DO UPDATE SET
        occurred_at = EXCLUDED.occurred_at,
        source = EXCLUDED.source,
        record_json = EXCLUDED.record_json
    `,
    [
      factId,
      payload.computed_at,
      "root_zone_irrigation_scenario_set_v1",
      JSON.stringify({ type: "root_zone_irrigation_scenario_set_v1", payload }),
    ],
  );
}

async function readScenarioRow(client, scenarioSetId) {
  const result = await client.query(
    `
      SELECT *
      FROM public.root_zone_irrigation_scenario_set_index_v1
      WHERE scenario_set_id = $1
    `,
    [scenarioSetId],
  );

  return result.rows[0];
}

function optionById(options, optionId) {
  const option = options.find((candidate) => candidate.option_id === optionId);
  assert(option, `scenario option exists: ${optionId}`);
  return option;
}

function assertScenarioPayload(payload, sourceForecast, scope, buildRootZoneIrrigationScenarioSetV1) {
  assert(payload.input_status === "COMPARABLE", "scenario set is comparable");
  assert(payload.options.length === 5, "verify exactly five options");

  const noAction = optionById(payload.options, "NO_ACTION");
  const irrigate10 = optionById(payload.options, "IRRIGATE_10MM_DAY0");
  const delayed = optionById(payload.options, "DELAY_3_DAYS_THEN_IRRIGATE_20MM");
  const saturatedForecast = {
    ...sourceForecast,
    root_zone_available_water_capacity_mm: 50,
    daily_forecast: sourceForecast.daily_forecast.map((day) => ({
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
  };
  const saturatedScenario = buildRootZoneIrrigationScenarioSetV1({
    ...scope,
    sourceForecast: saturatedForecast,
    application_efficiency: 0.8,
    computed_at: payload.computed_at,
  });
  const irrigate30Saturated = optionById(saturatedScenario.options, "IRRIGATE_30MM_DAY0");

  assert(
    JSON.stringify(noAction.daily_projection.map((day) => day.projected_available_water_mm)) ===
      JSON.stringify(sourceForecast.daily_forecast.map((day) => day.projected_available_water_mm)),
    "verify NO_ACTION equals baseline",
  );
  assert(
    irrigate10.daily_projection[0].projected_available_water_fraction >
      irrigate10.daily_projection[0].baseline_available_water_fraction,
    "verify day0 irrigation raises AWF versus baseline",
  );
  assert(delayed.irrigation_events[0].day_index === 3, "verify delayed option applies on day 3");
  assert(
    delayed.daily_projection[3].delta_vs_baseline_fraction > 0,
    "verify delayed option changes projection on day 3",
  );
  assert(
    irrigate30Saturated.daily_projection[0].bound_applied === "UPPER_BOUND",
    "verify upper bound is recorded when irrigation exceeds capacity",
  );
  assert(
    payload.determinism_hash ===
      buildRootZoneIrrigationScenarioSetV1({
        ...scope,
        sourceForecast,
        application_efficiency: 0.8,
        computed_at: "2026-06-22T00:00:00.000Z",
      }).determinism_hash,
    "verify determinism_hash stable",
  );
}

async function assertProbeAbsent(pool, tableName, columnName, value) {
  if (!(await relationExists(pool, tableName))) return;

  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE ${columnName} = $1`,
    [value],
  );
  assert(Number(result.rows[0]?.count ?? 0) === 0, `${tableName} probe rows absent after rollback`);
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(databaseUrl, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const {
    ensureRootZoneSoilWaterForecastIndexV1,
    upsertRootZoneSoilWaterForecastIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/root_zone_soil_water_forecast_v1.ts`);
  const {
    buildRootZoneIrrigationScenarioSetV1,
  } = require(`${process.cwd()}/apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts`);
  const {
    ensureRootZoneIrrigationScenarioSetIndexV1,
    upsertRootZoneIrrigationScenarioSetIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/root_zone_irrigation_scenario_set_v1.ts`);

  const runId = `${PREFIX}${randomUUID().replace(/-/g, "_")}`;
  const computedAt = "2026-06-21T00:00:00.000Z";
  const scope = {
    tenant_id: `${runId}_tenant`,
    project_id: `${runId}_project`,
    group_id: `${runId}_group`,
    field_id: `${runId}_field`,
    zone_id: `${runId}_zone`,
  };
  const sourceForecast = makeForecast(runId, scope, computedAt);
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRootZoneSoilWaterForecastIndexV1(client);
    await ensureRootZoneIrrigationScenarioSetIndexV1(client);
    await assertFactsTableContract(client);

    const beforeCounts = {};
    for (const tableName of FORBIDDEN_TABLES) {
      beforeCounts[tableName] = await scopedCount(client, tableName, scope);
    }

    await upsertRootZoneSoilWaterForecastIndexV1(client, sourceForecast, `${runId}_forecast_fact`);

    const payload = buildRootZoneIrrigationScenarioSetV1({
      ...scope,
      sourceForecast,
      application_efficiency: 0.8,
      computed_at: computedAt,
    });
    const factId = `${runId}_scenario_fact`;

    assertScenarioPayload(payload, sourceForecast, scope, buildRootZoneIrrigationScenarioSetV1);
    await appendRootZoneIrrigationScenarioFact(client, payload, factId);
    await upsertRootZoneIrrigationScenarioSetIndexV1(client, payload, factId);

    const row = await readScenarioRow(client, payload.scenario_set_id);
    assert(row, "read back scenario index row");
    assert(row.options_json.length === 5, "read back exactly five options");

    for (const tableName of FORBIDDEN_TABLES) {
      assert(
        beforeCounts[tableName] === (await scopedCount(client, tableName, scope)),
        `verify no cross-write tables changed: ${tableName}`,
      );
    }

    await client.query("ROLLBACK");
    await assertProbeAbsent(pool, "root_zone_irrigation_scenario_set_index_v1", "scenario_set_id", payload.scenario_set_id);
    await assertProbeAbsent(pool, "root_zone_soil_water_forecast_index_v1", "forecast_id", sourceForecast.forecast_id);
    await assertProbeAbsent(pool, "facts", "fact_id", factId);

    console.log(`[${ACCEPTANCE_NAME}] PASS`);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    fail(error.message, error.stack);
  } finally {
    client.release();
    await pool.end();
  }
})();
