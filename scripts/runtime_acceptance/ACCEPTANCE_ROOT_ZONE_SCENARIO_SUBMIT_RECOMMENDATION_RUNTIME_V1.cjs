// scripts/runtime_acceptance/ACCEPTANCE_ROOT_ZONE_SCENARIO_SUBMIT_RECOMMENDATION_RUNTIME_V1.cjs
const { randomUUID } = require("node:crypto");
const { Pool } = require("pg");
require("tsx/cjs");

const {
  buildRootZoneIrrigationScenarioSetV1,
} = require(`${process.cwd()}/apps/server/src/domain/soil_water/root_zone_irrigation_scenario_builder_v1.ts`);
const {
  ensureRootZoneIrrigationScenarioSetIndexV1,
  upsertRootZoneIrrigationScenarioSetIndexV1,
} = require(`${process.cwd()}/apps/server/src/projections/root_zone_irrigation_scenario_set_v1.ts`);

const ACCEPTANCE_NAME = "ACCEPTANCE_ROOT_ZONE_SCENARIO_SUBMIT_RECOMMENDATION_RUNTIME_V1";
const PREFIX = "h35_root_zone_scenario_submit_acceptance_";
const BASE_URL = String(process.env.GEOX_BASE_URL || process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const TOKEN = String(process.env.GEOX_ACCEPTANCE_TOKEN || "").trim();
const RUN_ID = `${PREFIX}${randomUUID()}`;
const CREATED_AT = "2026-06-21T00:00:00.000Z";
const SCOPE = {
  tenant_id: `${RUN_ID}_tenant`,
  project_id: `${RUN_ID}_project`,
  group_id: `${RUN_ID}_group`,
  field_id: `${RUN_ID}_field`,
  zone_id: `${RUN_ID}_zone`,
};

function fail(message, detail) {
  const suffix = detail === undefined ? "" : `\n${JSON.stringify(detail, null, 2)}`;
  throw new Error(`${message}${suffix}`);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

async function relationExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1)::text AS name", [`public.${tableName}`]);
  return Boolean(result.rows[0]?.name);
}

function makeForecast(id, overrides = {}) {
  const daily_forecast = [0, 1, 2, 3, 4, 5, 6].map((day_index) => {
    const projected_available_water_mm = 45 - day_index * 5;
    const projected_available_water_fraction = projected_available_water_mm / 100;

    return {
      day_index,
      date: `2026-06-${21 + day_index}`,
      precipitation_mm: 0,
      effective_precipitation_mm: 0,
      et0_mm: 5,
      crop_coefficient: 1,
      estimated_crop_et_mm: 5,
      net_water_change_mm: -5,
      projected_available_water_mm,
      projected_available_water_fraction,
      forecast_water_status: day_index >= 5 ? "STRESS" : "LIMITED_AVAILABLE",
      bound_applied: "NONE",
    };
  });

  return {
    forecast_id: `${id}_forecast`,
    ...SCOPE,
    source_state_id: `${id}_state`,
    source_state_ref: `${id}_state`,
    weather_forecast_ref: `${id}_wx`,
    baseline_mode: "NO_NEW_ACTION",
    horizon_days: 7,
    root_zone_depth_cm: 60,
    root_zone_available_water_capacity_mm: 100,
    initial_available_water_fraction: 0.5,
    initial_weighted_matric_potential_kpa: -50,
    daily_forecast,
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
    computed_at: CREATED_AT,
    determinism_hash: `${id}_hash`,
    ...overrides,
  };
}

function makeScenario(id, overrides = {}) {
  const scenario = buildRootZoneIrrigationScenarioSetV1({
    ...SCOPE,
    sourceForecast: makeForecast(id),
    application_efficiency: 0.8,
    computed_at: CREATED_AT,
  });

  return {
    ...scenario,
    scenario_set_id: id,
    ...overrides,
  };
}

function withNotComparableOption(scenario, optionId) {
  return {
    ...scenario,
    options: scenario.options.map((option) =>
      option.option_id === optionId
        ? { ...option, quality: { status: "NOT_COMPARABLE", reason_codes: ["runtime_probe"] } }
        : option,
    ),
  };
}

async function upsertScenario(pool, scenario) {
  await upsertRootZoneIrrigationScenarioSetIndexV1(pool, scenario, `fact:${scenario.scenario_set_id}`);
}

async function postSubmission({ fieldId, scenarioSetId, optionId, body = {} }) {
  assert(TOKEN, "GEOX_ACCEPTANCE_TOKEN is required for runtime acceptance");

  const response = await fetch(
    `${BASE_URL}/api/v1/operator/twin/fields/${encodeURIComponent(fieldId)}` +
      `/root-zone-scenarios/${encodeURIComponent(scenarioSetId)}` +
      `/options/${encodeURIComponent(optionId)}/submit-recommendation`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        ...SCOPE,
        operator_id: `${RUN_ID}_operator`,
        submission_reason: "review selected root-zone irrigation scenario",
        idempotency_key: `${RUN_ID}:${scenarioSetId}:${optionId}:${randomUUID()}`,
        ...body,
      }),
    },
  );

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fail(`non-json response ${response.status}`, text.slice(0, 300));
  }

  return {
    statusCode: response.status,
    body: payload,
    submission: payload.operator_root_zone_scenario_recommendation_submission_v1,
  };
}

async function factCount(pool, type, scenarioSetId) {
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM facts
      WHERE record_json::jsonb->>'type' = $1
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
        AND (
          (record_json::jsonb#>>'{payload,source_scenario_set_id}') = $3
          OR (record_json::jsonb#>>'{payload,scenario_set_id}') = $3
        )
    `,
    [type, SCOPE.tenant_id, scenarioSetId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

async function assertNoDownstreamFacts(pool, scenarioSetId) {
  const forbiddenTypes = [
    "approval_request_v1",
    "approval_decision_v1",
    "operation_plan_v1",
    "ao_act_task_v0",
    "roi_ledger_v1",
    "field_memory_v1",
  ];

  for (const type of forbiddenTypes) {
    assert((await factCount(pool, type, scenarioSetId)) === 0, `no ${type} fact is created`);
  }
}

async function cleanup(pool) {
  await pool
    .query(
      `DELETE FROM facts WHERE (record_json::jsonb#>>'{payload,tenant_id}') = $1 OR fact_id LIKE $2`,
      [SCOPE.tenant_id, `${PREFIX}%`],
    )
    .catch(() => undefined);
  await pool
    .query("DELETE FROM root_zone_irrigation_scenario_set_index_v1 WHERE tenant_id = $1", [SCOPE.tenant_id])
    .catch(() => undefined);
}

function assertSubmissionFlags(submission) {
  for (const key of [
    "approval_created",
    "operation_plan_created",
    "task_created",
    "dispatch_created",
    "roi_created",
    "field_memory_created",
  ]) {
    assert(submission[key] === false, `${key} must be false`, submission);
  }
  assert(submission.human_approval_required === true, "human_approval_required must be true", submission);
  assert(submission.no_direct_execution === true, "no_direct_execution must be true", submission);
}

async function proveSuccessfulSubmit(pool) {
  const scenarioSetId = `${RUN_ID}_good`;
  const scenario = makeScenario(scenarioSetId);
  assert(!Array.isArray(scenario.derivation?.evidence_refs), "real H34 builder output does not require derivation.evidence_refs");
  await upsertScenario(pool, scenario);

  const idempotencyKey = `${RUN_ID}:stable-key`;
  const result = await postSubmission({
    fieldId: SCOPE.field_id,
    scenarioSetId,
    optionId: "IRRIGATE_20MM_DAY0",
    body: { idempotency_key: idempotencyKey },
  });

  assert(result.statusCode === 200, "successful submit returns 200", result);
  assert(result.submission.status === "SUBMITTED_TO_RECOMMENDATION", "successful submit status", result.submission);
  assert(result.submission.evidence_refs.includes(`root_zone_irrigation_scenario_set_index_v1:${scenarioSetId}`), "evidence derives scenario set ref", result.submission);
  assert(result.submission.evidence_refs.includes(`root_zone_soil_water_forecast_v1:${scenario.source_forecast_id}`), "evidence derives forecast id ref", result.submission);
  assertSubmissionFlags(result.submission);
  assert(await factCount(pool, "operator_root_zone_scenario_recommendation_submission_v1", scenarioSetId) === 1, "one submission fact is created");
  assert(await factCount(pool, "decision_recommendation_v1", scenarioSetId) === 1, "one recommendation fact is created");
  await assertNoDownstreamFacts(pool, scenarioSetId);

  const duplicate = await postSubmission({
    fieldId: SCOPE.field_id,
    scenarioSetId,
    optionId: "IRRIGATE_20MM_DAY0",
    body: { idempotency_key: idempotencyKey },
  });

  assert(duplicate.submission.status === "REJECTED_DUPLICATE", "duplicate status", duplicate.submission);
  assert(duplicate.submission.duplicate === true, "duplicate flag", duplicate.submission);
  assert(await factCount(pool, "decision_recommendation_v1", scenarioSetId) === 1, "duplicate does not create another recommendation");

  return scenarioSetId;
}

async function proveRejectedSubmitCreatesNoRecommendation(pool, label, scenario, optionId, body, expectedStatus) {
  await upsertScenario(pool, scenario);
  const before = await factCount(pool, "decision_recommendation_v1", scenario.scenario_set_id);
  const result = await postSubmission({
    fieldId: SCOPE.field_id,
    scenarioSetId: scenario.scenario_set_id,
    optionId,
    body,
  });

  assert(result.statusCode >= 400, `${label} returns rejection HTTP status`, result);
  assert(result.submission.status === expectedStatus, `${label} returns expected submission status`, result.submission);
  assert(
    (await factCount(pool, "decision_recommendation_v1", scenario.scenario_set_id)) === before,
    `${label} does not write recommendation`,
  );
}

async function proveRejections(pool) {
  await proveRejectedSubmitCreatesNoRecommendation(
    pool,
    "NO_ACTION option",
    makeScenario(`${RUN_ID}_noaction`),
    "NO_ACTION",
    {},
    "REJECTED_NO_ACTION",
  );

  await proveRejectedSubmitCreatesNoRecommendation(
    pool,
    "missing option",
    makeScenario(`${RUN_ID}_missing`),
    "MISSING_OPTION",
    {},
    "REJECTED_OPTION_NOT_FOUND",
  );

  await proveRejectedSubmitCreatesNoRecommendation(
    pool,
    "scope mismatch",
    makeScenario(`${RUN_ID}_scope`),
    "IRRIGATE_20MM_DAY0",
    { zone_id: `${RUN_ID}_other_zone` },
    "REJECTED_SCOPE_MISMATCH",
  );

  await proveRejectedSubmitCreatesNoRecommendation(
    pool,
    "not comparable option",
    withNotComparableOption(makeScenario(`${RUN_ID}_not_comparable`), "IRRIGATE_20MM_DAY0"),
    "IRRIGATE_20MM_DAY0",
    {},
    "REJECTED_NOT_COMPARABLE",
  );

  await proveRejectedSubmitCreatesNoRecommendation(
    pool,
    "missing evidence",
    makeScenario(`${RUN_ID}_evidence_missing`, { source_forecast_id: "", source_forecast_ref: "" }),
    "IRRIGATE_20MM_DAY0",
    {},
    "REJECTED_EVIDENCE_BLOCKING",
  );
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL;
  assert(connectionString, "DATABASE_URL/POSTGRES_URL/PG_URL required");

  const pool = new Pool({ connectionString });
  try {
    assert(await relationExists(pool, "facts"), "facts table required");
    await ensureRootZoneIrrigationScenarioSetIndexV1(pool);
    await cleanup(pool);
    const successfulScenarioSetId = await proveSuccessfulSubmit(pool);
    await proveRejections(pool);
    await assertNoDownstreamFacts(pool, successfulScenarioSetId);
    console.log(`[${ACCEPTANCE_NAME}] PASS`);
  } finally {
    await cleanup(pool);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[${ACCEPTANCE_NAME}] FAIL`);
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
