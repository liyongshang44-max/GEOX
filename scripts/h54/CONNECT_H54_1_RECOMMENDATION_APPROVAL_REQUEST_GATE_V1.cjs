'use strict';

// scripts/h54/CONNECT_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1.cjs
// Purpose: classify the latest H53.4 recommendation before it enters the existing approval request control chain.
// Boundary: read-only connector gate; no approval, operation plan, AO-ACT, receipt, evidence, acceptance, verification, ROI, or Field Memory is written.

const { Client } = require('pg');

const DB = process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';
const ACCEPTANCE = 'CONNECT_H54_1_RECOMMENDATION_APPROVAL_REQUEST_GATE_V1';
const H53_4_SOURCE = 'H53_4_RECOMMENDATION_CANDIDATE_DERIVATION_V1';
const H53_4_VERSION = 'h53.4.v1';
const SCOPE = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA', field_id: 'field_c8_demo' };

function fail(error, details = {}) {
  console.error(JSON.stringify({ ok: false, connector: ACCEPTANCE, error, details }, null, 2));
  process.exit(1);
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function latestRecommendationSql() {
  return `select fact_id, source, occurred_at, record_json::jsonb as record_json
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

function classify(payload, factId) {
  const suggested = payload.suggested_action || payload.suggested_action_json || {};
  const actionType = text(suggested.action_type);
  const amountMm = number(suggested.amount_mm ?? suggested.water_mm, 0);
  const noAction = actionType === 'NO_ACTION' || text(payload.selected_scenario_option_id) === 'NO_ACTION' || amountMm <= 0;
  const actionableIrrigation = !noAction && amountMm > 0;
  if (noAction) {
    return {
      ok: true,
      connector: ACCEPTANCE,
      gate_status: 'CONTROL_CHAIN_NOT_REQUIRED',
      gate_lane: 'NO_ACTION',
      recommendation_id: text(payload.recommendation_id),
      recommendation_fact_id: factId,
      selected_scenario_option_id: text(payload.selected_scenario_option_id),
      action_type: actionType || null,
      amount_mm: amountMm,
      reason_codes: ['NO_ACTION_RECOMMENDATION'],
      approval_request_created: false,
      approval_decision_created: false,
      operation_plan_created: false,
      ao_act_task_created: false,
      ao_act_receipt_created: false,
      as_executed_created: false,
      evidence_created: false,
      acceptance_created: false,
      verification_created: false,
      roi_created: false,
      field_memory_created: false,
      writes_created: false,
      next_step: 'NO_CONTROL_CHAIN_ACTION_FOR_CURRENT_RECOMMENDATION',
    };
  }
  if (actionableIrrigation) {
    return {
      ok: true,
      connector: ACCEPTANCE,
      gate_status: 'ACTIONABLE_IRRIGATION_REQUIRES_APPROVAL_REQUEST_ADAPTER',
      gate_lane: 'ACTIONABLE_IRRIGATION',
      recommendation_id: text(payload.recommendation_id),
      recommendation_fact_id: factId,
      selected_scenario_option_id: text(payload.selected_scenario_option_id),
      action_type: actionType || null,
      amount_mm: amountMm,
      reason_codes: ['ACTIONABLE_IRRIGATION_NOT_SUBMITTED_IN_H54_1'],
      approval_request_created: false,
      approval_decision_created: false,
      operation_plan_created: false,
      ao_act_task_created: false,
      ao_act_receipt_created: false,
      as_executed_created: false,
      evidence_created: false,
      acceptance_created: false,
      verification_created: false,
      roi_created: false,
      field_memory_created: false,
      writes_created: false,
      next_step: 'H54_2_APPROVAL_REQUEST_ADAPTER_REQUIRED',
    };
  }
  return {
    ok: true,
    connector: ACCEPTANCE,
    gate_status: 'RECOMMENDATION_NOT_ACTIONABLE',
    gate_lane: 'UNKNOWN',
    recommendation_id: text(payload.recommendation_id),
    recommendation_fact_id: factId,
    selected_scenario_option_id: text(payload.selected_scenario_option_id),
    action_type: actionType || null,
    amount_mm: amountMm,
    reason_codes: ['RECOMMENDATION_ACTION_NOT_CLASSIFIED'],
    approval_request_created: false,
    approval_decision_created: false,
    operation_plan_created: false,
    ao_act_task_created: false,
    writes_created: false,
  };
}

async function main() {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    const result = await client.query(latestRecommendationSql(), [H53_4_SOURCE, H53_4_VERSION, SCOPE.tenant_id, SCOPE.project_id, SCOPE.group_id, SCOPE.field_id]);
    const row = result.rows[0];
    if (!row) fail('H53_4_RECOMMENDATION_MISSING');
    const payload = row.record_json?.payload || {};
    console.log(JSON.stringify(classify(payload, String(row.fact_id ?? '')), null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => fail(error.message));
