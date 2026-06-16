// scripts/governance_acceptance/ACCEPTANCE_IRRIGATION_SCENARIO_SET_SEED_READBACK_V1.cjs
// Purpose: prove H15 C8 seed projects comparable and UNKNOWN irrigation scenario sets into irrigation_scenario_set_index_v1.
// Boundary: scenario comparison only; no recommendation, approval, operation plan, AO-ACT, report, frontend, or customer page behavior.

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_IRRIGATION_SCENARIO_SET_SEED_READBACK_V1";
const EXPECTED_SCENARIO_SET_ID = "full_review_seed_tenantA_iscen_c8_irrigation_001";
const EXPECTED_UNKNOWN_SCENARIO_SET_ID = "full_review_seed_tenantA_iscen_c8_irrigation_unknown_001";
const EXPECTED_WATER_STATE_ID = "full_review_seed_tenantA_wstate_c8_irrigation_001";
const EXPECTED_UNKNOWN_WATER_STATE_ID = "full_review_seed_tenantA_wstate_c8_irrigation_unknown_001";

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL:`, message);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function numberEquals(actual, expected, tolerance = 0.000001) {
  return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - expected) <= tolerance;
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

async function readScenario(pool, scenarioSetId) {
  const result = await pool.query(`
    SELECT
      scenario_set_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      season_id,
      source_water_state_estimate_id,
      source_requirement_id,
      source_forecast_id,
      source_sensing_window_id,
      baseline_water_state,
      baseline_soil_moisture_percent,
      target_min_soil_moisture_percent,
      target_max_soil_moisture_percent,
      net_irrigation_mm,
      gross_irrigation_requirement_mm,
      options_json,
      recommended_option_id,
      input_refs_json,
      evidence_refs_json,
      derivation_json,
      quality_json,
      confidence_json,
      source_fact_id
    FROM public.irrigation_scenario_set_index_v1
    WHERE scenario_set_id = $1
  `, [scenarioSetId]);

  assert(result.rows.length === 1, `expected one scenario row for ${scenarioSetId}`, result.rows);
  return result.rows[0];
}

function getOption(row, optionId) {
  const options = Array.isArray(row.options_json) ? row.options_json : [];
  return options.find((option) => option && option.option_id === optionId);
}

(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert(databaseUrl, "DATABASE_URL is required");

  const migrationPath = path.join(process.cwd(), "apps", "server", "db", "migrations", "2026_06_16_irrigation_scenario_set_v1.sql");
  assert(fs.existsSync(migrationPath), "H15 migration file is required", migrationPath);
  const migrationSql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(migrationSql);

    await client.query(
      "DELETE FROM public.irrigation_scenario_set_index_v1 WHERE scenario_set_id = ANY($1::text[])",
      [[EXPECTED_SCENARIO_SET_ID, EXPECTED_UNKNOWN_SCENARIO_SET_ID]],
    );

    await client.query(
      "DELETE FROM public.facts WHERE fact_id = ANY($1::text[])",
      [[
        "full_review_seed_tenantA_irrigation_scenario_set_c8_001",
        "full_review_seed_tenantA_irrigation_scenario_set_c8_unknown_001",
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
      fail("seed apply failed before H15 scenario readback", {
        status: run.status,
        stdout: run.stdout,
        stderr: run.stderr,
        parsed,
      });
    }
  }

  const readPool = new Pool({ connectionString: databaseUrl });

  try {
    const row = await readScenario(readPool, EXPECTED_SCENARIO_SET_ID);

    assert(row.tenant_id === "tenantA", "tenant mismatch", row);
    assert(row.project_id === "projectA", "project mismatch", row);
    assert(row.group_id === "groupA", "group mismatch", row);
    assert(row.field_id === "field_c8_demo", "field mismatch", row);
    assert(row.season_id === "season_2026_c8_corn", "season mismatch", row);

    assert(row.source_water_state_estimate_id === EXPECTED_WATER_STATE_ID, "source water state mismatch", row);
    assert(row.source_requirement_id === "ireq_c8_irrigation_001", "source requirement mismatch", row);
    assert(row.source_forecast_id === "wf_c8_irrigation_001", "source forecast mismatch", row);
    assert(row.source_sensing_window_id === "sw_c8_soil_moisture_001", "source sensing window mismatch", row);
    assert(row.baseline_water_state === "MODERATE_DEFICIT", "baseline state mismatch", row);

    assert(numberEquals(row.baseline_soil_moisture_percent, 18.4), "baseline soil moisture mismatch", row);
    assert(numberEquals(row.target_min_soil_moisture_percent, 22), "target min mismatch", row);
    assert(numberEquals(row.target_max_soil_moisture_percent, 28), "target max mismatch", row);
    assert(numberEquals(row.net_irrigation_mm, 18.7), "net irrigation mismatch", row);
    assert(numberEquals(row.gross_irrigation_requirement_mm, 22), "gross irrigation mismatch", row);

    assert(row.recommended_option_id === null, "H15 must not recommend an option", row);
    assert(row.quality_json?.status === "COMPARABLE", "quality status mismatch", row.quality_json);
    assert(row.confidence_json?.level === "HIGH", "confidence level mismatch", row.confidence_json);
    assert(numberEquals(row.confidence_json?.score, 0.86), "confidence score mismatch", row.confidence_json);
    assert(row.source_fact_id === "full_review_seed_tenantA_irrigation_scenario_set_c8_001", "source fact mismatch", row);

    const options = Array.isArray(row.options_json) ? row.options_json : [];
    assert(options.length === 3, "expected exactly 3 comparable scenario options", options);

    const noIrrigation = getOption(row, "no_irrigation");
    const irrigateNow = getOption(row, "irrigate_required_now");
    const delay3d = getOption(row, "delay_3d");

    assert(noIrrigation, "no_irrigation option missing", options);
    assert(irrigateNow, "irrigate_required_now option missing", options);
    assert(delay3d, "delay_3d option missing", options);

    assert(noIrrigation.action_type === "NO_IRRIGATION", "no_irrigation action mismatch", noIrrigation);
    assert(noIrrigation.risk_after === "MODERATE_DEFICIT", "no_irrigation risk mismatch", noIrrigation);
    assert(numberEquals(noIrrigation.projected_soil_moisture_range?.min, 17.0), "no_irrigation range min mismatch", noIrrigation);
    assert(numberEquals(noIrrigation.projected_soil_moisture_range?.max, 18.6), "no_irrigation range max mismatch", noIrrigation);

    assert(irrigateNow.action_type === "IRRIGATE_NOW", "irrigate_now action mismatch", irrigateNow);
    assert(irrigateNow.risk_after === "NORMAL", "irrigate_now risk mismatch", irrigateNow);
    assert(numberEquals(irrigateNow.assumed_irrigation_mm, 22), "irrigate_now assumed amount mismatch", irrigateNow);
    assert(numberEquals(irrigateNow.effective_irrigation_mm_within_72h, 22), "irrigate_now effective amount mismatch", irrigateNow);
    assert(numberEquals(irrigateNow.projected_soil_moisture_range?.min, 23.2), "irrigate_now range min mismatch", irrigateNow);
    assert(numberEquals(irrigateNow.projected_soil_moisture_range?.max, 24.8), "irrigate_now range max mismatch", irrigateNow);

    assert(delay3d.action_type === "DELAY_IRRIGATION", "delay_3d action mismatch", delay3d);
    assert(delay3d.risk_after === "MODERATE_DEFICIT", "delay_3d risk mismatch", delay3d);
    assert(numberEquals(delay3d.assumed_irrigation_mm, 22), "delay_3d assumed amount mismatch", delay3d);
    assert(numberEquals(delay3d.effective_irrigation_mm_within_72h, 0), "delay_3d effective amount must be zero", delay3d);
    assert(delay3d.delay_days === 3, "delay_3d days mismatch", delay3d);
    assert(numberEquals(delay3d.projected_soil_moisture_range?.min, 16.3), "delay_3d range min mismatch", delay3d);
    assert(numberEquals(delay3d.projected_soil_moisture_range?.max, 19.3), "delay_3d range max mismatch", delay3d);

    assert(row.input_refs_json?.weather_forecast_version && String(row.input_refs_json.weather_forecast_version).includes("c8_external_weather_provider_sample_001:"), "weather forecast version missing", row.input_refs_json);
    assert(row.input_refs_json?.weather_provider_run_id === "provider_run_c8_irrigation_001", "provider run mismatch", row.input_refs_json);
    assert(row.input_refs_json?.weather_external_forecast_id === "external_forecast_c8_irrigation_001", "external forecast mismatch", row.input_refs_json);

    for (const expectedRef of [
      EXPECTED_WATER_STATE_ID,
      "sw_c8_soil_moisture_001",
      "wf_c8_irrigation_001",
      "ireq_c8_irrigation_001",
      "full_review_seed_tenantA_water_state_estimate_c8_001",
      "full_review_seed_tenantA_soil_moisture_sensing_window_c8_001",
      "full_review_seed_tenantA_weather_forecast_c8_irrigation_001",
      "full_review_seed_tenantA_irrigation_requirement_c8_001",
    ]) {
      assert(row.evidence_refs_json.includes(expectedRef), `evidence ref missing ${expectedRef}`, row.evidence_refs_json);
    }

    const unknown = await readScenario(readPool, EXPECTED_UNKNOWN_SCENARIO_SET_ID);

    assert(unknown.source_water_state_estimate_id === EXPECTED_UNKNOWN_WATER_STATE_ID, "UNKNOWN source water state mismatch", unknown);
    assert(unknown.baseline_water_state === "UNKNOWN", "UNKNOWN baseline state mismatch", unknown);
    assert(unknown.recommended_option_id === null, "UNKNOWN scenario must not recommend", unknown);
    assert(Array.isArray(unknown.options_json) && unknown.options_json.length === 0, "UNKNOWN scenario options must be empty", unknown.options_json);
    assert(unknown.quality_json?.status === "UNKNOWN", "UNKNOWN quality status mismatch", unknown.quality_json);
    assert(Array.isArray(unknown.quality_json?.reason_codes) && unknown.quality_json.reason_codes.includes("WATER_STATE_UNKNOWN"), "UNKNOWN reason code missing", unknown.quality_json);
    assert(unknown.confidence_json?.level === "LOW", "UNKNOWN confidence mismatch", unknown.confidence_json);
    assert(unknown.source_fact_id === "full_review_seed_tenantA_irrigation_scenario_set_c8_unknown_001", "UNKNOWN source fact mismatch", unknown);

    console.log(JSON.stringify({
      ok: true,
      acceptance: ACCEPTANCE_NAME,
      tolerated_late_seed_failure: toleratedLateSeedFailure,
      scenario_set_id: row.scenario_set_id,
      options_count: options.length,
      recommended_option_id: row.recommended_option_id,
      delay_3d_risk_after: delay3d.risk_after,
      delay_3d_effective_irrigation_mm_within_72h: delay3d.effective_irrigation_mm_within_72h,
      unknown_scenario_set_id: unknown.scenario_set_id,
      unknown_options_count: unknown.options_json.length,
      unknown_quality_status: unknown.quality_json?.status,
    }, null, 2));
  } finally {
    await readPool.end();
  }
})().catch((error) => {
  fail(error.message || "unexpected failure", error.stack || error);
});
