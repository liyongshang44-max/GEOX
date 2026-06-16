// scripts/governance_acceptance/ACCEPTANCE_WATER_STATE_ESTIMATE_SEED_READBACK_V1.cjs
// Purpose: prove H14 C8 seed projects tenant-scoped water_state_estimate_v1 rows and UNKNOWN guard rows into water_state_estimate_index_v1.
// Boundary: no irrigation scenario, no recommendation, no prescription, no operation route, no frontend, and no customer page behavior.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_WATER_STATE_ESTIMATE_SEED_READBACK_V1";
const EXPECTED_WATER_STATE_ESTIMATE_ID = "full_review_seed_tenantA_wstate_c8_irrigation_001";
const EXPECTED_UNKNOWN_WATER_STATE_ESTIMATE_ID = "full_review_seed_tenantA_wstate_c8_irrigation_unknown_001";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL:`, message);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function parseSeedFailure(stdout, stderr) {
  const text = `${stdout || ""}\n${stderr || ""}`;
  const match = text.match(/\{\s*"ok"\s*:\s*false[\s\S]*?\n\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

function numberEquals(actual, expected, tolerance = 0.000001) {
  return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) <= tolerance;
}

async function readEstimate(pool, estimateId) {
  const result = await pool.query(`
    SELECT
      estimate_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      state,
      root_zone_soil_moisture_percent,
      target_min_soil_moisture_percent,
      target_max_soil_moisture_percent,
      net_irrigation_mm,
      gross_irrigation_requirement_mm,
      source_sensing_window_id,
      source_forecast_id,
      source_requirement_id,
      source_input_id,
      source_sensing_window_fact_id,
      source_weather_fact_id,
      source_requirement_fact_id,
      input_refs_json,
      evidence_refs_json,
      calculation_inputs_json,
      derivation_json,
      quality_json,
      confidence_json,
      source_fact_id
    FROM public.water_state_estimate_index_v1
    WHERE estimate_id = $1
  `, [estimateId]);

  assert(result.rows.length === 1, `expected one H14 water state estimate row for ${estimateId}`, result.rows);
  return result.rows[0];
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required");

  const migrationPath = path.join(process.cwd(), "apps", "server", "db", "migrations", "2026_06_16_water_state_estimate_v1.sql");
  assert(fs.existsSync(migrationPath), "H14 migration file is required", migrationPath);
  const migrationSql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(migrationSql);

    await client.query(
      "DELETE FROM public.water_state_estimate_index_v1 WHERE estimate_id = ANY($1::text[])",
      [[
        "wstate_c8_irrigation_001",
        EXPECTED_WATER_STATE_ESTIMATE_ID,
        EXPECTED_UNKNOWN_WATER_STATE_ESTIMATE_ID,
      ]],
    );

    await client.query(
      "DELETE FROM public.facts WHERE fact_id = ANY($1::text[])",
      [[
        "full_review_seed_tenantA_water_state_estimate_c8_001",
        "full_review_seed_tenantA_water_state_estimate_c8_unknown_001",
      ]],
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const run = spawnSync(
    process.execPath,
    [
      "scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs",
      "--apply",
      "--tenant",
      "tenantA",
      "--profile",
      "c8-formal-chain",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  let toleratedLateSeedFailure = false;

  if (run.status !== 0) {
    const parsed = parseSeedFailure(run.stdout, run.stderr);
    const message = String(parsed?.error || parsed?.code || run.stderr || run.stdout || "");

    if (message.includes("AS_EXECUTED_DERIVATION_REQUIRED")) {
      toleratedLateSeedFailure = true;
    } else {
      fail("seed apply failed before H14 readback", {
        status: run.status,
        stdout: run.stdout,
        stderr: run.stderr,
        parsed,
      });
    }
  }

  const readPool = new Pool({ connectionString: databaseUrl });

  try {
    const row = await readEstimate(readPool, EXPECTED_WATER_STATE_ESTIMATE_ID);

    assert(row.state === "MODERATE_DEFICIT", "water state must be MODERATE_DEFICIT", row);
    assert(numberEquals(row.root_zone_soil_moisture_percent, 18.4), "root zone soil moisture mismatch", row);
    assert(numberEquals(row.target_min_soil_moisture_percent, 22), "target min soil moisture mismatch", row);
    assert(numberEquals(row.target_max_soil_moisture_percent, 28), "target max soil moisture mismatch", row);
    assert(numberEquals(row.net_irrigation_mm, 18.7), "net irrigation mismatch", row);
    assert(numberEquals(row.gross_irrigation_requirement_mm, 22), "gross irrigation mismatch", row);

    assert(row.source_sensing_window_id === "sw_c8_soil_moisture_001", "source sensing window mismatch", row);
    assert(row.source_forecast_id === "wf_c8_irrigation_001", "source forecast mismatch", row);
    assert(row.source_requirement_id === "ireq_c8_irrigation_001", "source requirement mismatch", row);
    assert(row.source_input_id === "iskill_input_c8_irrigation_001", "source input mismatch", row);

    assert(row.source_sensing_window_fact_id === "full_review_seed_tenantA_soil_moisture_sensing_window_c8_001", "source sensing window fact mismatch", row);
    assert(row.source_weather_fact_id === "full_review_seed_tenantA_weather_forecast_c8_irrigation_001", "source weather fact mismatch", row);
    assert(row.source_requirement_fact_id === "full_review_seed_tenantA_irrigation_requirement_c8_001", "source requirement fact mismatch", row);
    assert(row.source_fact_id === "full_review_seed_tenantA_water_state_estimate_c8_001", "source fact id mismatch", row);

    const inputRefs = row.input_refs_json || {};
    const quality = row.quality_json || {};
    const confidence = row.confidence_json || {};
    const calc = row.calculation_inputs_json || {};
    const evidenceRefs = Array.isArray(row.evidence_refs_json) ? row.evidence_refs_json : [];

    assert(inputRefs.weather_forecast_id === "wf_c8_irrigation_001", "input_refs weather forecast mismatch", inputRefs);
    assert(typeof inputRefs.weather_forecast_version === "string" && inputRefs.weather_forecast_version.includes("c8_external_weather_provider_sample_001:"), "weather forecast version missing", inputRefs);
    assert(inputRefs.weather_provider_run_id === "provider_run_c8_irrigation_001", "provider run id mismatch", inputRefs);
    assert(inputRefs.weather_external_forecast_id === "external_forecast_c8_irrigation_001", "external forecast id mismatch", inputRefs);

    assert(quality.status === "ESTIMATED", "quality status must be ESTIMATED", quality);
    assert(quality.deterministic === true, "quality deterministic must be true", quality);
    assert(confidence.level === "HIGH", "confidence level must be HIGH", confidence);
    assert(numberEquals(confidence.score, 0.9), "confidence score mismatch", confidence);

    assert(numberEquals(calc.soil_moisture_percent, 18.4), "calculation soil moisture mismatch", calc);
    assert(numberEquals(calc.net_irrigation_mm, 18.7), "calculation net irrigation mismatch", calc);
    assert(calc.weather_provider_status === "OK", "calculation weather provider status mismatch", calc);
    assert(calc.weather_stale === false, "calculation weather stale mismatch", calc);

    for (const expectedRef of [
      "sw_c8_soil_moisture_001",
      "wf_c8_irrigation_001",
      "ireq_c8_irrigation_001",
      "full_review_seed_tenantA_soil_moisture_sensing_window_c8_001",
      "full_review_seed_tenantA_weather_forecast_c8_irrigation_001",
      "full_review_seed_tenantA_irrigation_requirement_c8_001",
    ]) {
      assert(evidenceRefs.includes(expectedRef), `evidence ref missing ${expectedRef}`, evidenceRefs);
    }

    const unknown = await readEstimate(readPool, EXPECTED_UNKNOWN_WATER_STATE_ESTIMATE_ID);

    assert(unknown.state === "UNKNOWN", "unknown fixture state must be UNKNOWN", unknown);
    assert(unknown.source_sensing_window_id === "sw_c8_soil_moisture_fail_001", "unknown source sensing window mismatch", unknown);
    assert(unknown.source_sensing_window_fact_id === "full_review_seed_tenantA_soil_moisture_sensing_window_c8_fail_001", "unknown source sensing window fact mismatch", unknown);
    assert(unknown.quality_json?.status === "UNKNOWN", "unknown quality status mismatch", unknown.quality_json);
    assert(Array.isArray(unknown.quality_json?.reason_codes) && unknown.quality_json.reason_codes.includes("SENSING_WINDOW_NOT_PASS"), "unknown reason code missing", unknown.quality_json);
    assert(unknown.confidence_json?.level === "LOW", "unknown confidence level mismatch", unknown.confidence_json);
    assert(unknown.calculation_inputs_json?.sensing_window_quality_status === "FAIL", "unknown sensing quality mismatch", unknown.calculation_inputs_json);

    console.log(JSON.stringify({
      ok: true,
      acceptance: ACCEPTANCE_NAME,
      tolerated_late_seed_failure: toleratedLateSeedFailure,
      estimate_id: row.estimate_id,
      state: row.state,
      confidence_level: confidence.level,
      quality_status: quality.status,
      source_forecast_id: row.source_forecast_id,
      unknown_estimate_id: unknown.estimate_id,
      unknown_state: unknown.state,
      unknown_confidence_level: unknown.confidence_json?.level,
    }, null, 2));
  } finally {
    await readPool.end();
  }
})().catch((error) => {
  fail(error.message || "unexpected failure", error.stack || error);
});
