// scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_RUNTIME_V1.cjs
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
require("tsx/cjs");

const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_RUNTIME_V1";
const PREFIX = "h33_root_zone_soil_water_forecast_acceptance_";
const forbiddenTables = [
  "decision_recommendation_index_v1",
  "approval_request_index_v1",
  "approval_decision_index_v1",
  "operation_plan_index_v1",
  "ao_act_task_index_v1",
  "roi_ledger_index_v1",
  "field_memory_index_v1",
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

async function appendRootZoneForecastFact(client, payload, factId) {
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
      "root_zone_soil_water_forecast_v1",
      JSON.stringify({ type: "root_zone_soil_water_forecast_v1", payload }),
    ],
  );
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(databaseUrl, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const {
    ensureRootZoneSoilWaterStateIndexV1,
    upsertRootZoneSoilWaterStateIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/root_zone_soil_water_state_v1.ts`);
  const {
    buildRootZoneSoilWaterForecastV1,
  } = require(`${process.cwd()}/apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts`);
  const {
    ensureRootZoneSoilWaterForecastIndexV1,
    upsertRootZoneSoilWaterForecastIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/root_zone_soil_water_forecast_v1.ts`);

  const runId = `${PREFIX}${randomUUID().replace(/-/g, "_")}`;
  const computed_at = "2026-06-21T00:00:00.000Z";
  const scope = {
    tenant_id: `${runId}_tenant`,
    project_id: `${runId}_project`,
    group_id: `${runId}_group`,
    field_id: `${runId}_field`,
    zone_id: `${runId}_zone`,
  };
  const sourceState = {
    state_id: `${runId}_state`,
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
    confidence: { level: "HIGH", score: 0.9, basis: "acceptance" },
    computed_at,
    determinism_hash: `${runId}_state_hash`,
  };
  const dailyWeather = [
    { date: "2026-06-21", precipitation_mm: 0, et0_mm: 5, crop_coefficient: 1 },
    { date: "2026-06-22", precipitation_mm: 0, et0_mm: 10, crop_coefficient: 1 },
    { date: "2026-06-23", precipitation_mm: 0, et0_mm: 10, crop_coefficient: 1 },
    { date: "2026-06-24", precipitation_mm: 0, et0_mm: 10, crop_coefficient: 1 },
    { date: "2026-06-25", precipitation_mm: 0, et0_mm: 10, crop_coefficient: 1 },
    { date: "2026-06-26", precipitation_mm: 0, et0_mm: 10, crop_coefficient: 1 },
    { date: "2026-06-27", precipitation_mm: 0, et0_mm: 10, crop_coefficient: 1 },
  ];

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureRootZoneSoilWaterStateIndexV1(client);
    await ensureRootZoneSoilWaterForecastIndexV1(client);
    await assertFactsTableContract(client);

    const beforeCounts = {};
    for (const tableName of forbiddenTables) {
      beforeCounts[tableName] = await scopedCount(client, tableName, scope);
    }

    await upsertRootZoneSoilWaterStateIndexV1(client, sourceState, `${runId}_state_fact`);

    const payload = buildRootZoneSoilWaterForecastV1({
      ...scope,
      sourceState,
      weather_forecast_ref: `${runId}_wx`,
      root_zone_available_water_capacity_mm: 100,
      effective_rainfall_factor: 0.8,
      dailyWeather,
      computed_at,
    });

    assert(payload.forecast_status === "ESTIMATED", "forecast is estimated");
    assert(payload.daily_forecast.length === 7, "verify daily forecast count");
    assert(payload.daily_forecast[0].projected_available_water_mm === 45, "verify first day calculation");
    assert(payload.min_available_water_fraction === 0, "verify min available water fraction");
    assert(payload.max_available_water_fraction === 0.45, "verify max available water fraction");
    assert(payload.stress_day_count === 4, "verify stress_day_count");
    assert(payload.limited_day_count === 2, "verify limited_day_count");
    assert(
      payload.determinism_hash ===
        buildRootZoneSoilWaterForecastV1({
          ...scope,
          sourceState,
          weather_forecast_ref: `${runId}_wx`,
          root_zone_available_water_capacity_mm: 100,
          effective_rainfall_factor: 0.8,
          dailyWeather: [...dailyWeather].reverse(),
          computed_at,
        }).determinism_hash,
      "verify determinism_hash stable",
    );

    const factId = `${runId}_forecast_fact`;
    await appendRootZoneForecastFact(client, payload, factId);
    await upsertRootZoneSoilWaterForecastIndexV1(client, payload, factId);

    const row = (
      await client.query(
        "SELECT * FROM public.root_zone_soil_water_forecast_index_v1 WHERE forecast_id = $1",
        [payload.forecast_id],
      )
    ).rows[0];
    assert(row, "read back forecast index row");
    assert(row.daily_forecast_json.length === 7, "read back daily forecast count");

    for (const tableName of forbiddenTables) {
      assert(
        beforeCounts[tableName] === (await scopedCount(client, tableName, scope)),
        `no cross-write table changed: ${tableName}`,
      );
    }

    await client.query("ROLLBACK");

    if (await relationExists(pool, "root_zone_soil_water_forecast_index_v1")) {
      const forecastResult = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM public.root_zone_soil_water_forecast_index_v1
          WHERE forecast_id = $1
        `,
        [payload.forecast_id],
      );
      assert(Number(forecastResult.rows[0].count) === 0, "probe forecast row absent");
    }

    const factResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM public.facts WHERE fact_id = $1",
      [factId],
    );
    assert(Number(factResult.rows[0].count) === 0, "probe fact absent");

    console.log(`[${name}] PASS`);
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
