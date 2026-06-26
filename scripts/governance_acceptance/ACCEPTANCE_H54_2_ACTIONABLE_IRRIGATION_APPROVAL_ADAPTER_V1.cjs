'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_2_ACTIONABLE_IRRIGATION_APPROVAL_ADAPTER_V1.cjs
// Purpose: prove a future H53.4-like positive irrigation recommendation can be adapted to the existing approval request route.
// Boundary: probe-only runtime acceptance; it may create temporary probe recommendation, submission, and approval_request facts, then removes them. It must not create approval decisions, operation plans, AO-ACT tasks, receipts, acceptance, verification, ROI, or Field Memory.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { adaptH534PositiveIrrigationRecommendationV1 } = require('../h54/h54_2_actionable_irrigation_approval_adapter.cjs');

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const OPERATOR_TOKEN = process.env.GEOX_OPERATOR_ACCEPTANCE_TOKEN || 'set-via-env-or-external-secret-file-pdi-writeonly';
const RUN = `h54_2_actionable_irrigation_adapter_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo', zone_id: null };
const FORBIDDEN_TYPES = ['approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1','roi_ledger_v1','field_memory_v1'];

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H54_2_ACTIONABLE_IRRIGATION_APPROVAL_ADAPTER_V1', error, details }, null, 2));
  process.exit(1);
}

function ok(value, error, details = {}) {
  if (!value) fail(error, details);
}

function read(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

async function cleanup(pool) {
  await pool.query('DELETE FROM facts WHERE record_json::text LIKE $1 OR source = $2', [`%${RUN}%`, RUN]).catch(() => undefined);
}

async function countType(pool, type) {
  const result = await pool.query("SELECT count(*)::int AS n FROM facts WHERE record_json::jsonb->>'type'=$1 AND record_json::text LIKE $2", [type, `%${RUN}%`]);
  return Number(result.rows[0].n);
}

async function probeCount(pool) {
  const result = await pool.query('SELECT count(*)::int AS n FROM facts WHERE record_json::text LIKE $1 OR source = $2', [`%${RUN}%`, RUN]);
  return Number(result.rows[0].n);
}

async function insertRecommendation(pool, payload) {
  const factId = `fact_${RUN}_${crypto.randomUUID()}`;
  await pool.query('INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)', [factId, RUN, JSON.stringify({ type: 'decision_recommendation_v1', payload })]);
  return factId;
}

async function postApprovalRequest(recommendationId, idempotencyKey) {
  const body = {
    ...SCOPE,
    operator_id: 'operator_demo',
    submission_reason: `${RUN} request approval`,
    idempotency_key: idempotencyKey,
    time_window: { start_ts: 1760000000000, end_ts: 1760003600000 },
  };
  const response = await fetch(`${BASE_URL}/api/v1/operator/recommendations/${encodeURIComponent(recommendationId)}/request-approval`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPERATOR_TOKEN}` },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

function staticChecks() {
  const adapter = read('scripts/h54/h54_2_actionable_irrigation_approval_adapter.cjs');
  ok(adapter.includes('ADAPTED_TO_APPROVAL_REQUEST_CANDIDATE'), 'ADAPTER_STATUS_TOKEN_MISSING');
  ok(adapter.includes('IRRIGATION_CANDIDATE_FROM_SCENARIO'), 'LEGACY_CONTRACT_TOKEN_MISSING');
  ok(adapter.includes('total_irrigation_mm'), 'TOTAL_IRRIGATION_TOKEN_MISSING');
  ok(!adapter.includes('INSERT INTO facts'), 'ADAPTER_MUST_NOT_WRITE_FACTS');
  const route = read('apps/server/src/routes/control_approval_request_v1.ts');
  ok(route.includes('/api/v1/operator/recommendations/:recommendation_id/request-approval'), 'APPROVAL_REQUEST_ROUTE_MISSING');
  const builder = read('apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts');
  ok(builder.includes('SUBMITTED_TO_APPROVAL_REQUEST'), 'APPROVAL_BUILDER_SUBMISSION_TOKEN_MISSING');
  ok(builder.includes('operation_plan_created: false'), 'APPROVAL_BUILDER_BOUNDARY_TOKEN_MISSING');
}

function sourceRecommendation() {
  return {
    version: 'h53.4-like',
    ...SCOPE,
    season_id: 'season_h54_2_probe',
    recommendation_id: `${RUN}_rec_actionable`,
    recommendation_status: 'RECOMMENDED',
    selected_scenario_option_id: 'IRRIGATE_DAY0_12MM',
    source_scenario_set_id: `${RUN}_scenario_set`,
    suggested_action: {
      action_type: 'IRRIGATE',
      amount_mm: 12,
      water_mm: 12,
      effective_amount_mm: 10,
      scheduled_day: 0,
      selected_scenario_option_id: 'IRRIGATE_DAY0_12MM',
      source_scenario_set_id: `${RUN}_scenario_set`,
      human_approval_required: true,
      no_direct_execution: true,
    },
    human_approval_required: true,
    no_direct_execution: true,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
    roi_created: false,
    field_memory_created: false,
    evidence_refs: [`${RUN}:h53_4_forecast`, `${RUN}:h53_4_scenario`],
    created_at: new Date().toISOString(),
  };
}

async function main() {
  staticChecks();
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    await cleanup(pool);
    const adaptedResult = adaptH534PositiveIrrigationRecommendationV1(sourceRecommendation(), { source_submission_id: `${RUN}_submission` });
    ok(adaptedResult.ok === true, 'ADAPTER_REJECTED_ACTIONABLE_RECOMMENDATION', adaptedResult);
    ok(adaptedResult.adapter_status === 'ADAPTED_TO_APPROVAL_REQUEST_CANDIDATE', 'ADAPTER_STATUS_UNEXPECTED', adaptedResult);
    const adapted = adaptedResult.adapted_recommendation;
    ok(adapted.status === 'CANDIDATE', 'ADAPTED_STATUS_UNEXPECTED', adapted);
    ok(adapted.source === 'ROOT_ZONE_SCENARIO_SELECTION', 'ADAPTED_SOURCE_UNEXPECTED', adapted);
    ok(adapted.recommendation_kind === 'IRRIGATION_CANDIDATE_FROM_SCENARIO', 'ADAPTED_KIND_UNEXPECTED', adapted);
    ok(adapted.proposed_action.action_type === 'IRRIGATE', 'ADAPTED_ACTION_TYPE_UNEXPECTED', adapted);
    ok(adapted.proposed_action.total_irrigation_mm === 12, 'ADAPTED_AMOUNT_UNEXPECTED', adapted);
    await insertRecommendation(pool, adapted);
    const response = await postApprovalRequest(adapted.recommendation_id, `${RUN}_approval_request_key`);
    ok(response.status >= 200 && response.status < 300, 'APPROVAL_REQUEST_ROUTE_HTTP_FAILED', response);
    ok(response.json.status === 'SUBMITTED_TO_APPROVAL_REQUEST', 'APPROVAL_REQUEST_NOT_CREATED', response);
    ok(await countType(pool, 'operator_recommendation_approval_request_submission_v1') === 1, 'SUBMISSION_FACT_COUNT_UNEXPECTED');
    ok(await countType(pool, 'approval_request_v1') === 1, 'APPROVAL_REQUEST_FACT_COUNT_UNEXPECTED');
    for (const type of FORBIDDEN_TYPES) ok(await countType(pool, type) === 0, `FORBIDDEN_FACT_CREATED:${type}`);
    await cleanup(pool);
    ok(await probeCount(pool) === 0, 'CLEANUP_INCOMPLETE');
    console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H54_2_ACTIONABLE_IRRIGATION_APPROVAL_ADAPTER_V1', adapter_status: adaptedResult.adapter_status, approval_request_created: true, approval_decision_created: false, operation_plan_created: false, ao_act_task_created: false, cleanup_ok: true }, null, 2));
  } finally {
    await cleanup(pool);
    await pool.end();
  }
}

main().catch((error) => fail(error.message));
