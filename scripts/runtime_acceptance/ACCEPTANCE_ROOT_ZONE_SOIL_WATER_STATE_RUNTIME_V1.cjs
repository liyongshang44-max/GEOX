// scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_RUNTIME_V1.cjs
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
require("tsx/cjs");

const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_RUNTIME_V1";
const PREFIX = "h32_root_zone_soil_water_state_acceptance_";
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

async function appendRootZoneStateFact(client, payload, factId) {
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
      "root_zone_soil_water_state_v1",
      JSON.stringify({ type: "root_zone_soil_water_state_v1", payload }),
    ],
  );
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(databaseUrl, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const {
    ensureSoilWaterPotentialEstimateIndexV1,
    upsertSoilWaterPotentialEstimateIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/soil_water_potential_estimate_v1.ts`);
  const {
    buildRootZoneSoilWaterStateV1,
  } = require(`${process.cwd()}/apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts`);
  const {
    ensureRootZoneSoilWaterStateIndexV1,
    upsertRootZoneSoilWaterStateIndexV1,
  } = require(`${process.cwd()}/apps/server/src/projections/root_zone_soil_water_state_v1.ts`);

  const runId = `${PREFIX}${randomUUID().replace(/-/g, "_")}`;
  const computed_at = "2026-06-21T00:00:00.000Z";
  const scope = {
    tenant_id: `${runId}_tenant`,
    project_id: `${runId}_project`,
    group_id: `${runId}_group`,
    field_id: `${runId}_field`,
    zone_id: `${runId}_zone`,
  };

  function layer(n, depth, matricPotentialKpa, availableWaterFraction, overrides = {}) {
    return {
      estimate_id: `${runId}_layer_${n}`,
      ...scope,
      layer_depth_cm: depth,
      source_window_id: null,
      source_profile_id: null,
      observed_theta: null,
      theta_unit: "m3_m3",
      normalized_theta_m3_m3: null,
      matric_potential_kpa: matricPotentialKpa,
      matric_potential_class:
        matricPotentialKpa >= -10
          ? "SATURATED_OR_NEAR_SATURATED"
          : matricPotentialKpa >= -60
            ? "READILY_AVAILABLE"
            : matricPotentialKpa >= -200
              ? "LIMITED_AVAILABLE"
              : "STRESS",
      available_water_fraction: availableWaterFraction,
      root_zone_weight: 1,
      input_status: "ESTIMATED",
      blocking_reasons: [],
      hydraulic_profile_ref: null,
      data_quality_ref: null,
      evidence_refs: [],
      calculation_inputs: {},
      derivation: {},
      confidence: { level: "HIGH", score: 0.9, basis: "acceptance" },
      computed_at,
      determinism_hash: `${runId}_hash_${n}`,
      ...overrides,
    };
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertFactsTableContract(client);
    await ensureSoilWaterPotentialEstimateIndexV1(client);
    await ensureRootZoneSoilWaterStateIndexV1(client);

    const beforeCounts = {};
    for (const tableName of forbiddenTables) {
      beforeCounts[tableName] = await scopedCount(client, tableName, scope);
    }

    const layers = [
      layer(20, 20, -20, 0.8),
      layer(40, 40, -70, 0.4),
      layer(60, 60, -100, 0.2),
    ];
    const externalLayer = layer("external", 40, -250, 0.1, {
      estimate_id: `${runId}_external_field_layer`,
      field_id: `${runId}_external_field`,
      zone_id: `${runId}_external_zone`,
      determinism_hash: `${runId}_external_hash`,
    });

    for (const candidate of [...layers, externalLayer]) {
      await upsertSoilWaterPotentialEstimateIndexV1(
        client,
        candidate,
        `${candidate.estimate_id}_fact`,
      );
    }

    const scopedPayload = buildRootZoneSoilWaterStateV1({
      ...scope,
      root_zone_depth_cm: 60,
      layerEstimates: layers,
      computed_at,
    });
    const mismatchPayload = buildRootZoneSoilWaterStateV1({
      ...scope,
      root_zone_depth_cm: 60,
      layerEstimates: [...layers, externalLayer],
      computed_at,
    });

    assert(scopedPayload.weighted_matric_potential_kpa === -63.333333, "verify weighted result");
    assert(scopedPayload.root_zone_water_potential_class === "LIMITED_AVAILABLE", "verify class");
    assert(
      scopedPayload.determinism_hash ===
        buildRootZoneSoilWaterStateV1({
          ...scope,
          root_zone_depth_cm: 60,
          layerEstimates: [layers[2], layers[0], layers[1]],
          computed_at,
        }).determinism_hash,
      "verify stable determinism_hash",
    );
    assert(
      mismatchPayload.weighted_matric_potential_kpa === scopedPayload.weighted_matric_potential_kpa,
      "scope mismatch layer does not affect weighted result",
    );
    assert(
      !mismatchPayload.layer_estimate_refs.includes(externalLayer.estimate_id),
      "scope mismatch layer is not projected into refs",
    );
    assert(
      mismatchPayload.blocking_reasons.includes("scope_mismatch_layer_excluded"),
      "scope mismatch layer is reported",
    );

    const factId = `${runId}_state_fact`;
    await appendRootZoneStateFact(client, scopedPayload, factId);
    await upsertRootZoneSoilWaterStateIndexV1(client, scopedPayload, factId);

    const row = (
      await client.query(
        "SELECT * FROM public.root_zone_soil_water_state_index_v1 WHERE state_id = $1",
        [scopedPayload.state_id],
      )
    ).rows[0];
    assert(row, "read back index row");
    assert(Number(row.weighted_matric_potential_kpa) === -63.333333, "read back weighted result");

    for (const tableName of forbiddenTables) {
      assert(
        beforeCounts[tableName] === (await scopedCount(client, tableName, scope)),
        `no cross-write table changed: ${tableName}`,
      );
    }

    await client.query("ROLLBACK");

    for (const [tableName, columnName, value] of [
      ["root_zone_soil_water_state_index_v1", "state_id", scopedPayload.state_id],
      ["soil_water_potential_estimate_index_v1", "tenant_id", scope.tenant_id],
    ]) {
      if (!(await relationExists(pool, tableName))) continue;

      const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE ${columnName} = $1`,
        [value],
      );
      assert(Number(result.rows[0].count) === 0, `${tableName} probe rows absent after rollback`);
    }

    const factResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM public.facts WHERE fact_id = $1",
      [factId],
    );
    assert(Number(factResult.rows[0].count) === 0, "fact probe absent after rollback");

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
