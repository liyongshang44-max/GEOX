'use strict';

// scripts/governance_acceptance/ACCEPTANCE_H54_CONTROL_CONNECTOR_PREFLIGHT_V1.cjs
// Purpose: read-only preflight for connecting H53.4 recommendation candidate to the existing control chain.
// Boundary: no facts, approvals, operation plans, AO-ACT tasks, receipts, evidence, acceptance, verification, ROI, or Field Memory are written.

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const H53_4_SOURCE = 'H53_4_RECOMMENDATION_CANDIDATE_DERIVATION_V1';
const H53_4_VERSION = 'h53.4.v1';
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo' };
const FORBIDDEN_TYPES = ['approval_request_v1','approval_decision_v1','operation_plan_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','evidence_artifact_v1','acceptance_result_v1','water_response_verification_v1','roi_ledger_v1','field_memory_v1'];
const PREFLIGHT_SOURCE = 'H54_CONTROL_CONNECTOR_PREFLIGHT_V1';

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_H54_CONTROL_CONNECTOR_PREFLIGHT_V1', error, details }, null, 2));
  process.exit(1);
}

function ok(value, error, details = {}) {
  if (!value) fail(error, details);
}

function read(file) {
  return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function has(file, token) {
  const text = read(file);
  ok(text.includes(token), 'TOKEN_MISSING', { file, token });
}

function latestRecommendationSql() {
  return `select fact_id, source, record_json::jsonb as record_json
            from facts
           where source=$1
             and record_json::jsonb->>'type'='decision_recommendation_v1'
             and record_json::jsonb#>>'{payload,derivation_version}'=$2
             and record_json::jsonb#>>'{payload,tenant_id}'=$3
             and record_json::jsonb#>>'{payload,project_id}'=$4
             and record_json::jsonb#>>'{payload,group_id}'=$5
             and record_json::jsonb#>>'{payload,field_id}'=$6
           order by occurred_at desc, fact_id desc
           limit 1`;
}

function staticChecks() {
  has('apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts', 'buildRecommendationApprovalRequestSubmissionV1');
  has('apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts', 'SUBMITTED_TO_APPROVAL_REQUEST');
  has('apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts', 'REJECTED_RECOMMENDATION_NOT_CANDIDATE');
  has('apps/server/src/domain/approval/recommendation_approval_decision_builder_v1.ts', 'buildRecommendationApprovalDecisionSubmissionV1');
  has('apps/server/src/domain/operations/operation_plan_from_approval_decision_builder_v1.ts', 'buildOperationPlanFromApprovalDecisionV1');
  has('apps/server/src/routes/control_approval_request_v1.ts', 'handleRecommendationApprovalRequest');
  has('apps/server/src/routes/control_approval_request_v1.ts', 'handleRecommendationApprovalDecision');
  has('apps/server/src/routes/control_ao_act.ts', 'ao_act_task_v0');
  has('apps/server/src/domain/controlplane/task_service.ts', 'ao_act_task_v0');
}

function classifyCompatibility(payload) {
  const suggestedAction = payload.suggested_action || payload.suggested_action_json || {};
  const actionType = String(suggestedAction.action_type || '').trim();
  const amount = Number(suggestedAction.amount_mm || suggestedAction.water_mm || 0);
  const legacyBuilderCompatible = payload.status === 'CANDIDATE'
    && payload.source === 'ROOT_ZONE_SCENARIO_SELECTION'
    && payload.recommendation_kind === 'IRRIGATION_CANDIDATE_FROM_SCENARIO'
    && Boolean(payload.source_option_id)
    && actionType !== 'NO_ACTION'
    && amount > 0;
  return {
    action_type: actionType || null,
    amount_mm: Number.isFinite(amount) ? amount : null,
    current_selection: payload.selected_scenario_option_id || null,
    direct_approval_request_compatibility: legacyBuilderCompatible ? 'DIRECTLY_COMPATIBLE' : 'NOT_DIRECTLY_COMPATIBLE_CURRENT_H53_4_SHAPE',
    h54_1_required: 'CONNECTOR_ADAPTER_GATE',
    current_demo_control_intent: actionType === 'NO_ACTION' ? 'DO_NOT_CREATE_APPROVAL_REQUEST_FOR_NO_ACTION' : 'ACTIONABLE_RECOMMENDATION_REQUIRES_ADAPTER',
  };
}

async function dbChecks() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const rec = await client.query(latestRecommendationSql(), [H53_4_SOURCE, H53_4_VERSION, SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id]);
    ok(rec.rows.length === 1, 'H53_4_RECOMMENDATION_MISSING');
    const payload = rec.rows[0].record_json.payload || {};
    ok(payload.recommendation_id === 'rec_h53_4_0fa3d7158a6582f5', 'UNEXPECTED_RECOMMENDATION_ID', payload);
    ok(payload.selected_scenario_option_id === 'NO_ACTION', 'CURRENT_DEMO_EXPECTS_NO_ACTION', payload);
    ok(payload.no_direct_execution === true, 'NO_DIRECT_EXECUTION_GUARD_MISSING', payload);
    ok(payload.human_approval_required === true, 'HUMAN_APPROVAL_REQUIRED_MISSING', payload);
    const compatibility = classifyCompatibility(payload);
    ok(compatibility.direct_approval_request_compatibility === 'NOT_DIRECTLY_COMPATIBLE_CURRENT_H53_4_SHAPE', 'DIRECT_COMPATIBILITY_UNEXPECTED', compatibility);
    ok(compatibility.current_demo_control_intent === 'DO_NOT_CREATE_APPROVAL_REQUEST_FOR_NO_ACTION', 'NO_ACTION_GATE_UNEXPECTED', compatibility);
    const forbidden = await client.query(`select record_json::jsonb->>'type' as type, count(*)::int as count from facts where source=$1 and record_json::jsonb->>'type'=any($2::text[]) group by 1`, [PREFLIGHT_SOURCE, FORBIDDEN_TYPES]);
    ok(forbidden.rows.length === 0, 'PREFLIGHT_MUST_NOT_WRITE_FORBIDDEN_FACTS', { rows: forbidden.rows });
    return {
      recommendation_id: payload.recommendation_id,
      recommendation_status: payload.recommendation_status,
      selected_scenario_option_id: payload.selected_scenario_option_id,
      suggested_action: payload.suggested_action || payload.suggested_action_json || null,
      compatibility,
      writes_created: false,
    };
  } finally {
    await client.end();
  }
}

(async function main() {
  staticChecks();
  const db = await dbChecks();
  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_H54_CONTROL_CONNECTOR_PREFLIGHT_V1', db }, null, 2));
})().catch((error) => fail(error.message));
