// scripts/governance_acceptance/ACCEPTANCE_WEATHER_FORECAST_VERSION_SEED_READBACK_V1.cjs
// Purpose: prove H13 weather forecast version seed data is projected and bound to irrigation skill input.
// Boundary: H13 weather/schema/readback only; late as-executed derivation auth failures are not accepted as H13 failures.

const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");

const ACCEPTANCE_NAME = "ACCEPTANCE_WEATHER_FORECAST_VERSION_SEED_READBACK_V1";

const WEATHER_PASS_ID = "wf_c8_irrigation_001";
const WEATHER_STALE_ID = "wf_c8_irrigation_stale_001";
const SKILL_INPUT_ID = "iskill_input_c8_irrigation_001";

const H13_FACT_IDS = [
  "full_review_seed_tenantA_weather_forecast_c8_irrigation_001",
  "full_review_seed_tenantA_weather_forecast_c8_irrigation_stale_001",
  "full_review_seed_tenantA_irrigation_requirement_skill_input_c8_001",
];

function fail(message, detail) {
  console.error(`[${ACCEPTANCE_NAME}] FAIL:`, message);
  if (detail !== undefined) console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

async function deleteIfTableExists(client, tableName, sql, params = []) {
  const exists = await client.query("SELECT to_regclass($1) AS table_name", [`public.${tableName}`]);
  if (exists.rows[0]?.table_name) {
    await client.query(sql, params);
  }
}

function runSeedApply() {
  const result = spawnSync(
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
      env: {
        ...process.env,
        BASE_URL: process.env.BASE_URL || "http://127.0.0.1:3001",
      },
      encoding: "utf8",
    },
  );

  if (result.status === 0) {
    return {
      ok: true,
      tolerated_late_failure: false,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  let parsed = null;
  const parseCandidates = [result.stdout, result.stderr].filter((text) => String(text || "").trim());

  for (const candidate of parseCandidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch (_) {}
  }

  const lateAsExecutedAuthFailure =
    parsed &&
    parsed.error === "AS_EXECUTED_DERIVATION_REQUIRED" &&
    String(parsed.detail?.reason || parsed.detail?.skipped || "").includes("as-executed derivation skipped");

  assert(
    lateAsExecutedAuthFailure,
    "seed apply failed before H13 weather readback could be trusted",
    {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      parsed,
    },
  );

  return {
    ok: true,
    tolerated_late_failure: true,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

(async () => {
  assert(process.env.DATABASE_URL, "DATABASE_URL is required");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await deleteIfTableExists(
      client,
      "weather_forecast_index_v1",
      "DELETE FROM weather_forecast_index_v1 WHERE forecast_id = ANY($1::text[])",
      [[WEATHER_PASS_ID, WEATHER_STALE_ID]],
    );

    await deleteIfTableExists(
      client,
      "irrigation_requirement_skill_input_index_v1",
      "DELETE FROM irrigation_requirement_skill_input_index_v1 WHERE skill_input_id = $1",
      [SKILL_INPUT_ID],
    );

    await client.query("DELETE FROM facts WHERE fact_id = ANY($1::text[])", [H13_FACT_IDS]);
  } finally {
    client.release();
    await pool.end();
  }

  const seedResult = runSeedApply();

  const readPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const readClient = await readPool.connect();

  try {
    const weather = await readClient.query(
      `
      SELECT
        forecast_id,
        provider,
        source_type,
        source_id,
        issue_time,
        forecast_version,
        provider_run_id,
        external_forecast_id,
        valid_from,
        valid_to,
        rainfall_forecast_mm_72h,
        temperature_max_c_72h,
        et0_mm_72h,
        quality_json,
        version_json,
        raw_payload_json
      FROM weather_forecast_index_v1
      WHERE forecast_id = ANY($1::text[])
      ORDER BY forecast_id
      `,
      [[WEATHER_PASS_ID, WEATHER_STALE_ID]],
    );

    assert(weather.rows.length === 2, "expected exactly two H13 weather forecasts", weather.rows);

    const pass = weather.rows.find((row) => row.forecast_id === WEATHER_PASS_ID);
    const stale = weather.rows.find((row) => row.forecast_id === WEATHER_STALE_ID);

    assert(pass, "missing pass weather forecast", weather.rows);
    assert(stale, "missing stale weather forecast", weather.rows);

    assert(pass.provider === "C8_EXTERNAL_WEATHER_SAMPLE", "pass provider mismatch", pass);
    assert(pass.source_type === "WEATHER_PROVIDER_API", "pass source_type mismatch", pass);
    assert(pass.source_id === "c8_external_weather_provider_sample_001", "pass source_id mismatch", pass);
    assert(pass.provider_run_id === "provider_run_c8_irrigation_001", "pass provider_run_id mismatch", pass);
    assert(pass.external_forecast_id === "external_forecast_c8_irrigation_001", "pass external_forecast_id mismatch", pass);
    assert(pass.forecast_version && pass.forecast_version.endsWith(":v1"), "pass forecast_version mismatch", pass);
    assert(Number(pass.rainfall_forecast_mm_72h) === 2, "rainfall must remain 2", pass);
    assert(Number(pass.temperature_max_c_72h) === 31, "temperature must remain 31", pass);
    assert(Number(pass.et0_mm_72h) === 3.9, "et0 must remain 3.9", pass);
    assert(pass.quality_json?.provider_status === "OK", "pass provider_status must be OK", pass);
    assert(pass.quality_json?.stale === false, "pass forecast must not be stale", pass);
    assert(pass.quality_json?.version_status === "VERSIONED", "pass forecast must be versioned", pass);
    assert(pass.quality_json?.external_source === true, "pass forecast must be external_source", pass);

    assert(stale.quality_json?.stale === true, "stale forecast must be stale", stale);
    assert(stale.provider_run_id === "provider_run_c8_irrigation_stale_001", "stale provider_run_id mismatch", stale);
    assert(stale.external_forecast_id === "external_forecast_c8_irrigation_stale_001", "stale external_forecast_id mismatch", stale);
    assert(stale.forecast_version && stale.forecast_version.endsWith(":stale"), "stale forecast_version mismatch", stale);

    const skill = await readClient.query(
      `
      SELECT
        skill_input_id,
        source_forecast_id,
        source_refs_json,
        source_fact_id
      FROM irrigation_requirement_skill_input_index_v1
      WHERE skill_input_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [SKILL_INPUT_ID],
    );

    assert(skill.rows.length === 1, "missing irrigation skill input projection", skill.rows);

    const skillRow = skill.rows[0];
    const refs = skillRow.source_refs_json || {};

    assert(skillRow.source_forecast_id === WEATHER_PASS_ID, "skill input source_forecast_id must bind pass forecast", skillRow);
    assert(refs.weather_forecast_id === WEATHER_PASS_ID, "source_refs.weather_forecast_id must bind pass forecast", refs);
    assert(refs.stale_weather_forecast_id === WEATHER_STALE_ID, "source_refs must retain stale forecast negative fixture", refs);
    assert(refs.weather_forecast_quality_status === "PASS", "source_refs weather quality status mismatch", refs);
    assert(refs.weather_forecast_provider_status === "OK", "source_refs weather provider status mismatch", refs);
    assert(refs.weather_forecast_stale === false, "source_refs weather stale flag mismatch", refs);
    assert(refs.provider_run_id === "provider_run_c8_irrigation_001", "source_refs provider_run_id mismatch", refs);
    assert(refs.external_forecast_id === "external_forecast_c8_irrigation_001", "source_refs external_forecast_id mismatch", refs);
    assert(String(refs.weather_forecast_version || "").endsWith(":v1"), "source_refs weather_forecast_version mismatch", refs);

    const skillFact = await readClient.query(
      `
      SELECT
        fact_id,
        record_json #>> '{payload,skill_input_id}' AS skill_input_id,
        record_json #>> '{payload,source_forecast_id}' AS source_forecast_id,
        record_json #> '{payload,source_refs}' AS source_refs
      FROM facts
      WHERE fact_id = $1
      LIMIT 1
      `,
      ["full_review_seed_tenantA_irrigation_requirement_skill_input_c8_001"],
    );

    assert(skillFact.rows.length === 1, "missing refreshed skill input fact", skillFact.rows);
    assert(skillFact.rows[0].source_forecast_id === WEATHER_PASS_ID, "skill input fact source_forecast_id mismatch", skillFact.rows[0]);
    assert(skillFact.rows[0].source_refs?.stale_weather_forecast_id === WEATHER_STALE_ID, "skill input fact must include stale forecast reference", skillFact.rows[0]);

    console.log(JSON.stringify({
      ok: true,
      acceptance: ACCEPTANCE_NAME,
      tolerated_late_seed_failure: seedResult.tolerated_late_failure,
      weather_count: weather.rows.length,
      bound_forecast_id: skillRow.source_forecast_id,
      stale_forecast_id: refs.stale_weather_forecast_id,
    }, null, 2));
  } finally {
    readClient.release();
    await readPool.end();
  }
})().catch((error) => {
  fail(error.message || "unexpected failure", error.stack || error);
});
