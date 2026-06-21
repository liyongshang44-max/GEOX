// scripts/runtime_acceptance/ACCEPTANCE_SOIL_WATER_POTENTIAL_ESTIMATE_RUNTIME_V1.cjs
// Purpose: verify H31 soil water potential estimate runtime chain writes fact/index rows transactionally and rolls back cleanly.

const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
require("tsx/cjs");

const ACCEPTANCE_NAME = "ACCEPTANCE_SOIL_WATER_POTENTIAL_ESTIMATE_RUNTIME_V1";
const PREFIX = "h31_soil_water_potential_acceptance_";
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
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
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

async function ensureFactsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.facts (
      fact_id text PRIMARY KEY,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      source text NOT NULL,
      record_json jsonb NOT NULL
    )
  `);
}

async function ensureSoilMoistureSensingWindowIndex(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.soil_moisture_sensing_window_index_v1 (
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      field_id text NOT NULL,
      window_id text NOT NULL,
      device_id text,
      metric text,
      window_start timestamptz,
      window_end timestamptz,
      expected_interval_ms integer,
      expected_points integer,
      actual_points integer,
      coverage_ratio numeric,
      max_gap_ms integer,
      quality_status text,
      confidence_json jsonb,
      summary_json jsonb,
      config_snapshot_json jsonb,
      evidence_refs_json jsonb,
      source_fact_ids_json jsonb,
      source_observation_ids_json jsonb,
      source_fact_id text,
      created_at timestamptz,
      updated_at timestamptz,
      PRIMARY KEY (tenant_id, window_id),
      UNIQUE (tenant_id, project_id, group_id, field_id, window_id)
    )
  `);
}

async function upsertSensingWindow(client, scope, ids, computedAt) {
  await client.query(
    `
      INSERT INTO public.soil_moisture_sensing_window_index_v1 (
        tenant_id,
        project_id,
        group_id,
        field_id,
        window_id,
        device_id,
        metric,
        window_start,
        window_end,
        expected_interval_ms,
        expected_points,
        actual_points,
        coverage_ratio,
        max_gap_ms,
        quality_status,
        confidence_json,
        summary_json,
        config_snapshot_json,
        evidence_refs_json,
        source_fact_ids_json,
        source_observation_ids_json,
        source_fact_id,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'volumetric_water_content_percent',
        $7, $7, 900000, 4, 4, 1, 0, 'PASS',
        $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
        $12::jsonb, $13::jsonb, $14, $7, $7
      )
      ON CONFLICT (tenant_id, window_id)
      DO UPDATE SET
        metric = EXCLUDED.metric,
        quality_status = EXCLUDED.quality_status,
        summary_json = EXCLUDED.summary_json,
        updated_at = EXCLUDED.updated_at
    `,
    [
      scope.tenant_id,
      scope.project_id,
      scope.group_id,
      scope.field_id,
      ids.window_id,
      ids.device_id,
      computedAt,
      JSON.stringify({ level: "HIGH", score: 0.95 }),
      JSON.stringify({ last_value: 28 }),
      JSON.stringify({ source: ACCEPTANCE_NAME }),
      JSON.stringify([ids.window_evidence_ref]),
      JSON.stringify([ids.window_fact_id]),
      JSON.stringify([ids.observation_id]),
      ids.window_source_fact_id,
    ],
  );
}

async function appendSoilWaterPotentialFact(client, payload, factId) {
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
      "soil_water_potential_estimate_v1",
      JSON.stringify({ type: "soil_water_potential_estimate_v1", payload }),
    ],
  );
}

async function assertProbeRowsAbsent(pool, ids) {
  const checks = [
    ["soil_hydraulic_profile_index_v1", "profile_id", ids.profile_id],
    ["soil_moisture_sensing_window_index_v1", "window_id", ids.window_id],
    ["soil_water_potential_estimate_index_v1", "estimate_id", ids.estimate_id],
  ];

  for (const [tableName, columnName, value] of checks) {
    const exists = await relationExists(pool, tableName);
    if (!exists) continue;

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE ${columnName} = $1`,
      [value],
    );
    assert(Number(result.rows[0].count) === 0, `${tableName} probe row survived rollback`);
  }

  if (await relationExists(pool, "facts")) {
    const factResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM public.facts WHERE fact_id = $1",
      [ids.estimate_fact_id],
    );
    assert(Number(factResult.rows[0].count) === 0, "soil water potential fact survived rollback");
  }
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(databaseUrl, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const {
    buildSoilWaterPotentialEstimateV1,
  } = require(`${process.cwd()}/apps/server/src/domain/soil_water/soil_water_potential_builder_v1.ts`);
  const {
    upsertSoilHydraulicProfileIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/soil_hydraulic_profile_v1.ts`);
  const {
    ensureSoilWaterPotentialEstimateIndexV1,
    upsertSoilWaterPotentialEstimateIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/soil_water_potential_estimate_v1.ts`);
  const {
    mapSoilMoistureSensingWindowIndexV1Row,
  } = require(`${process.cwd()}/apps/server/src/projections/soil_moisture_sensing_window_v1.ts`);

  const runId = `${PREFIX}${randomUUID().replace(/-/g, "_")}`;
  const computedAt = "2026-06-21T00:00:00.000Z";
  const scope = {
    tenant_id: `${runId}_tenant`,
    project_id: `${runId}_project`,
    group_id: `${runId}_group`,
    field_id: `${runId}_field`,
    zone_id: `${runId}_zone`,
    layer_depth_cm: 30,
  };
  const ids = {
    profile_id: `${runId}_profile`,
    window_id: `${runId}_window`,
    device_id: `${runId}_device`,
    window_fact_id: `${runId}_window_fact`,
    window_source_fact_id: `${runId}_window_source_fact`,
    window_evidence_ref: `${runId}_window_evidence`,
    observation_id: `${runId}_observation`,
    estimate_fact_id: `${runId}_estimate_fact`,
    estimate_id: null,
  };

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureFactsTable(client);
    await ensureSoilMoistureSensingWindowIndex(client);
    await ensureSoilWaterPotentialEstimateIndexV1(client);

    const beforeCounts = {};
    for (const tableName of FORBIDDEN_TABLES) {
      beforeCounts[tableName] = await scopedCount(client, tableName, scope);
    }

    const profile = await upsertSoilHydraulicProfileIndexV1(
      client,
      {
        ...scope,
        profile_id: ids.profile_id,
        texture_class: "loam",
        theta_r: 0.08,
        theta_s: 0.43,
        alpha_per_kpa: 0.035,
        n: 1.56,
        m: 1 - 1 / 1.56,
        parameter_source: "MANUAL",
        calibration_status: "UNVERIFIED",
        confidence_level: "LOW",
        confidence_score: 0.4,
        evidence_refs: [`${runId}_profile_evidence`],
        created_at: computedAt,
      },
      `${runId}_profile_fact`,
    );

    await upsertSensingWindow(client, scope, ids, computedAt);
    const windowResult = await client.query(
      `
        SELECT *
        FROM public.soil_moisture_sensing_window_index_v1
        WHERE tenant_id = $1
          AND window_id = $2
      `,
      [scope.tenant_id, ids.window_id],
    );
    assert(windowResult.rowCount === 1, "sensing window row was not written");

    const sensingWindow = mapSoilMoistureSensingWindowIndexV1Row(windowResult.rows[0]);
    const estimate = buildSoilWaterPotentialEstimateV1({
      ...scope,
      sensingWindow,
      hydraulicProfile: profile,
      computed_at: computedAt,
    });
    const repeatEstimate = buildSoilWaterPotentialEstimateV1({
      ...scope,
      sensingWindow,
      hydraulicProfile: profile,
      computed_at: "2030-01-01T00:00:00.000Z",
    });
    ids.estimate_id = estimate.estimate_id;

    assert(estimate.input_status === "ESTIMATED", "estimate status must be ESTIMATED", estimate);
    assert(
      Number.isFinite(estimate.matric_potential_kpa) && estimate.matric_potential_kpa < 0,
      "matric potential must be finite negative kPa",
      estimate,
    );
    assert(
      estimate.determinism_hash === repeatEstimate.determinism_hash,
      "determinism hash must be stable when computed_at changes",
      { estimate, repeatEstimate },
    );

    await appendSoilWaterPotentialFact(client, estimate, ids.estimate_fact_id);
    await upsertSoilWaterPotentialEstimateIndexV1(client, estimate, ids.estimate_fact_id);

    const readback = await client.query(
      `
        SELECT *
        FROM public.soil_water_potential_estimate_index_v1
        WHERE estimate_id = $1
      `,
      [estimate.estimate_id],
    );
    assert(readback.rowCount === 1, "estimate index row was not written");
    assert(readback.rows[0].source_fact_id === ids.estimate_fact_id, "estimate index source fact mismatch");

    for (const tableName of FORBIDDEN_TABLES) {
      const afterCount = await scopedCount(client, tableName, scope);
      assert(afterCount === beforeCounts[tableName], `cross-write detected in ${tableName}`, {
        before: beforeCounts[tableName],
        after: afterCount,
      });
    }

    await client.query("ROLLBACK");
    await assertProbeRowsAbsent(pool, ids);
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`[${ACCEPTANCE_NAME}] PASS`);
})().catch((error) => {
  fail(error.message || "unexpected failure", error.stack || error);
});
