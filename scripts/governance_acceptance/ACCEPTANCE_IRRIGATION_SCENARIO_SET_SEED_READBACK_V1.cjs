// scripts/governance_acceptance/ACCEPTANCE_IRRIGATION_SCENARIO_SET_SEED_READBACK_V1.cjs
// Purpose: prove H15 C8 seed projects formal 5-option irrigation scenario sets into irrigation_scenario_set_index_v1.
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

function assertOptionCommon(option, expected) {
  assert(option, `${expected.option_id} option missing`);
  assert(option.option_id === expected.option_id, `${expected.option_id} option_id mismatch`, option);
  assert(option.action_type === expected.action_type, `${expected.option_id} action_type mismatch`, option);
  assert(option.risk_before === "MODERATE_DEFICIT", `${expected.option_id} risk_before mismatch`, option);
  assert(option.risk_after === expected.risk_after, `${expected.option_id} risk_after mismatch`, option);
  assert(option.risk_delta === expected.risk_delta, `${expected.option_id} risk_delta mismatch`, option);
  assert(option.confidence?.level === expected.confidence_level, `${expected.option_id} confidence level mismatch`, option);
  assert(numberEquals(option.confidence?.score, expected.confidence_score), `${expected.option_id} confidence score mismatch`, option);
  assert(Array.isArray(option.failure_conditions), `${expected.option_id} failure_conditions must be array`, option);
  assert(numberEquals(option.assumed_irrigation_mm, expected.assumed_irrigation_mm), `${expected.option_id} assumed_irrigation_mm mismatch`, option);
  assert(numberEquals(option.effective_irrigation_mm_within_72h, expected.effective_irrigation_mm_within_72h), `${expected.option_id} effective_irrigation_mm_within_72h mismatch`, option);
  assert(option.delay_days === expected.delay_days, `${expected.option_id} delay_days mismatch`, option);
  assert(numberEquals(option.projected_soil_moisture_range?.min, expected.range_min), `${expected.option_id} range min mismatch`, option);
  assert(numberEquals(option.projected_soil_moisture_range?.max, expected.range_max), `${expected.option_id} range max mismatch`, option);
  assert(option.calculation_trace?.formula_version === "formal_irrigation_scenario_delta_model_v1", `${expected.option_id} formula version mismatch`, option);
  assert(option.calculation_trace?.root_zone_depth_mm === 300, `${expected.option_id} root zone depth mismatch`, option);
  assert(option.calculation_trace?.application_efficiency === 0.85, `${expected.option_id} application efficiency mismatch`, option);
  assert(option.calculation_trace?.rounding_policy === "risk_before_rounding_range_min_max_rounded_1_decimal", `${expected.option_id} rounding policy mismatch`, option);

  for (const condition of expected.failure_conditions) {
    assert(option.failure_conditions.includes(condition), `${expected.option_id} missing failure condition ${condition}`, option);
  }
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
    assert(row.source_fact_id === "full_review_seed_tenantA_irrigation_scenario_set_c8_001", "source fact mismatch", row);

    assert(row.input_refs_json?.root_zone_depth_mm === 300, "root zone depth must come from requirement calculation inputs", row.input_refs_json);
    assert(row.input_refs_json?.application_efficiency === 0.85, "application efficiency must come from requirement calculation inputs", row.input_refs_json);
    assert(row.input_refs_json?.weather_provider_status === "OK", "weather provider status mismatch", row.input_refs_json);
    assert(row.input_refs_json?.weather_valid_from, "weather valid_from missing", row.input_refs_json);
    assert(row.input_refs_json?.weather_valid_to, "weather valid_to missing", row.input_refs_json);

    const options = Array.isArray(row.options_json) ? row.options_json : [];
    const expectedOptionIds = ["no_action", "irrigate_10mm", "irrigate_20mm", "irrigate_22mm", "delay_3d"];
    assert(options.length === 5, "expected exactly 5 formal scenario options", options);
    assert(JSON.stringify(options.map((option) => option.option_id)) === JSON.stringify(expectedOptionIds), "formal option order mismatch", options);

    const expectedOptions = [
      {
        option_id: "no_action",
        action_type: "NO_ACTION",
        assumed_irrigation_mm: 0,
        effective_irrigation_mm_within_72h: 0,
        delay_days: 0,
        risk_after: "MODERATE_DEFICIT",
        risk_delta: "UNCHANGED",
        confidence_level: "MEDIUM",
        confidence_score: 0.68,
        range_min: 17.0,
        range_max: 18.6,
        failure_conditions: ["PROJECTED_DEFICIT_REMAINS", "NO_IRRIGATION_APPLIED"],
      },
      {
        option_id: "irrigate_10mm",
        action_type: "IRRIGATE",
        assumed_irrigation_mm: 10,
        effective_irrigation_mm_within_72h: 10,
        delay_days: 0,
        risk_after: "MODERATE_DEFICIT",
        risk_delta: "UNCHANGED",
        confidence_level: "MEDIUM",
        confidence_score: 0.68,
        range_min: 19.8,
        range_max: 21.4,
        failure_conditions: ["PROJECTED_DEFICIT_REMAINS", "EXECUTION_REQUIRED"],
      },
      {
        option_id: "irrigate_20mm",
        action_type: "IRRIGATE",
        assumed_irrigation_mm: 20,
        effective_irrigation_mm_within_72h: 20,
        delay_days: 0,
        risk_after: "NORMAL",
        risk_delta: "IMPROVED",
        confidence_level: "HIGH",
        confidence_score: 0.82,
        range_min: 22.6,
        range_max: 24.2,
        failure_conditions: ["EXECUTION_REQUIRED"],
      },
      {
        option_id: "irrigate_22mm",
        action_type: "IRRIGATE",
        assumed_irrigation_mm: 22,
        effective_irrigation_mm_within_72h: 22,
        delay_days: 0,
        risk_after: "NORMAL",
        risk_delta: "IMPROVED",
        confidence_level: "HIGH",
        confidence_score: 0.82,
        range_min: 23.2,
        range_max: 24.8,
        failure_conditions: ["EXECUTION_REQUIRED"],
      },
      {
        option_id: "delay_3d",
        action_type: "DELAY_IRRIGATION",
        assumed_irrigation_mm: 22,
        effective_irrigation_mm_within_72h: 0,
        delay_days: 3,
        risk_after: "MODERATE_DEFICIT",
        risk_delta: "UNCHANGED",
        confidence_level: "LOW",
        confidence_score: 0.45,
        range_min: 16.3,
        range_max: 19.3,
        failure_conditions: ["PROJECTED_DEFICIT_REMAINS", "IRRIGATION_DELAY_EXPOSURE"],
      },
    ];

    for (const expected of expectedOptions) {
      assertOptionCommon(getOption(row, expected.option_id), expected);
    }

    assert(row.derivation_json?.comparison_only === true, "scenario derivation must be comparison_only", row.derivation_json);
    assert(row.derivation_json?.no_recommendation === true, "scenario derivation must be no_recommendation", row.derivation_json);
    assert(row.derivation_json?.recommended_option_id === null, "scenario derivation recommended_option_id must be null", row.derivation_json);
    assert(JSON.stringify(row.derivation_json?.fixed_option_ids) === JSON.stringify(expectedOptionIds), "fixed option ids mismatch", row.derivation_json);
    assert(row.derivation_json?.delay_3d_semantics === "effective_irrigation_mm_within_72h_is_zero", "delay_3d semantics mismatch", row.derivation_json);

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
      option_ids: options.map((option) => option.option_id),
      recommended_option_id: row.recommended_option_id,
      delay_3d_risk_after: getOption(row, "delay_3d").risk_after,
      delay_3d_effective_irrigation_mm_within_72h: getOption(row, "delay_3d").effective_irrigation_mm_within_72h,
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
