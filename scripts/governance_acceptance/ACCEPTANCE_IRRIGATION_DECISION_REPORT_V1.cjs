#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_IRRIGATION_DECISION_REPORT_V1.cjs
// Purpose: verify H17 irrigation_decision_report_v1 is returned by operation report API without customer-visible raw technical ids.

const { spawnSync } = require('node:child_process');

const ACCEPTANCE = 'ACCEPTANCE_IRRIGATION_DECISION_REPORT_V1';
const BASE_URL = (process.env.BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.ADMIN_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || process.env.TOKEN || 'admin_token';
const TENANT = process.env.TENANT_ID || 'tenantA';
const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';

function fail(message, detail) {
  console.error('[' + ACCEPTANCE + '] FAIL:', message);
  if (detail !== undefined) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function headers() {
  return {
    accept: 'application/json',
    authorization: 'Bearer ' + TOKEN,
    'x-geox-token': TOKEN,
    'x-geox-ao-act-token': TOKEN,
    'x-ao-act-token': TOKEN,
  };
}

function parseSeedFailure(stdout, stderr) {
  const text = String(stdout || '') + '\n' + String(stderr || '');
  const match = text.match(/\{\s*"ok"\s*:\s*false[\s\S]*?\n\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function assertNoCustomerRawTokens(value) {
  const text = JSON.stringify(value);
  for (const token of [
    'field_c8_demo',
    'dev_soil_c8_001',
    'dev_valve_pump_c8_001',
    'full_review_seed_',
    'rec_c8_irrigation_001',
    'op_plan_c8_irrigation_formal_001',
  ]) {
    assert(!text.includes(token), 'customer text leaks raw token: ' + token, text);
  }
}

(async () => {
  assert(BASE_URL, 'BASE_URL or API_BASE_URL is required');

  const seed = spawnSync(
    process.execPath,
    ['scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs', '--apply', '--tenant', TENANT, '--profile', 'c8-formal-chain'],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );

  if (seed.status !== 0) {
    const parsed = parseSeedFailure(seed.stdout, seed.stderr);
    const message = String(parsed?.error || parsed?.code || seed.stderr || seed.stdout || '');
    if (!message.includes('AS_EXECUTED_DERIVATION_REQUIRED')) {
      fail('seed apply failed before H17 report acceptance', { status: seed.status, stdout: seed.stdout, stderr: seed.stderr, parsed });
    }
  }

  const url = BASE_URL + '/api/v1/reports/operation/' + encodeURIComponent(FORMAL_OP) + '?tenant_id=' + encodeURIComponent(TENANT) + '&project_id=' + encodeURIComponent(PROJECT_ID) + '&group_id=' + encodeURIComponent(GROUP_ID);
  const res = await fetch(url, { headers: headers() });
  const bodyText = await res.text();
  let body = null;
  try { body = JSON.parse(bodyText); } catch {}
  assert(res.status === 200, 'operation report API failed', { status: res.status, body: body || bodyText });

  const report = body?.operation_report_v1;
  const decision = report?.irrigation_decision_report_v1;
  assert(decision, 'operation_report_v1.irrigation_decision_report_v1 missing', report);

  assert(decision.version === 'v1', 'decision report version mismatch', decision);
  assert(decision.report_kind === 'IRRIGATION_DECISION_REPORT', 'decision report kind mismatch', decision);
  assert(decision.customer_title === '灌溉决策依据', 'decision customer title mismatch', decision);

  assert(decision.status?.decision_status === 'RECOMMENDED', 'decision status mismatch', decision.status);
  assert(decision.status?.customer_visible_eligible === true, 'customer_visible_eligible mismatch', decision.status);
  assert(decision.status?.human_approval_required === true, 'human_approval_required mismatch', decision.status);
  assert(decision.status?.no_direct_execution === true, 'no_direct_execution mismatch', decision.status);

  assert(decision.fact_section?.sensing_window?.quality_status === 'PASS', 'sensing window quality mismatch', decision.fact_section?.sensing_window);
  assert(decision.fact_section?.weather_forecast?.provider_status === 'OK', 'weather provider status mismatch', decision.fact_section?.weather_forecast);
  assert(Number(decision.fact_section?.irrigation_requirement?.gross_irrigation_requirement_mm) === 22, 'gross irrigation requirement mismatch', decision.fact_section?.irrigation_requirement);

  assert(decision.estimate_section?.state === 'MODERATE_DEFICIT', 'estimate state mismatch', decision.estimate_section);
  assert(Array.isArray(decision.scenario_section?.options) && decision.scenario_section.options.length === 5, 'scenario options length mismatch', decision.scenario_section);
  assert(decision.scenario_section?.selected_option_id === 'irrigate_22mm', 'selected option mismatch', decision.scenario_section);
  assert(decision.recommendation_section?.recommendation_status === 'RECOMMENDED', 'recommendation status mismatch', decision.recommendation_section);
  assert(Number(decision.recommendation_section?.amount_mm) === 22, 'recommendation amount mismatch', decision.recommendation_section);
  assert(decision.recommendation_section?.approval_boundary_text.includes('不直接触发作业'), 'approval boundary missing no-direct-execution text', decision.recommendation_section);

  assert(decision.classification?.facts?.includes('soil_moisture_sensing_window_v1'), 'classification facts missing sensing window', decision.classification);
  assert(decision.classification?.estimates?.includes('water_state_estimate_v1'), 'classification estimates missing water state', decision.classification);
  assert(decision.classification?.scenarios?.includes('irrigation_scenario_set_v1'), 'classification scenarios missing scenario set', decision.classification);
  assert(decision.classification?.recommendations?.includes('decision_recommendation_v1'), 'classification recommendations missing recommendation', decision.classification);

  assert(decision.customer_summary?.one_liner?.includes('灌溉 22mm'), 'customer summary missing 22mm text', decision.customer_summary);
  assert(decision.customer_summary?.boundary_line?.includes('人工审批'), 'customer summary missing approval boundary', decision.customer_summary);

  assertNoCustomerRawTokens({
    customer_summary: decision.customer_summary,
    sensing_window: decision.fact_section?.sensing_window?.customer_text,
    weather_forecast: decision.fact_section?.weather_forecast?.customer_text,
    irrigation_requirement: decision.fact_section?.irrigation_requirement?.customer_text,
    estimate: decision.estimate_section?.customer_text,
    scenario: decision.scenario_section?.customer_text,
    recommendation: decision.recommendation_section,
  });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    decision_status: decision.status.decision_status,
    amount_mm: decision.recommendation_section.amount_mm,
    options_count: decision.scenario_section.options.length,
    customer_visible_eligible: decision.status.customer_visible_eligible,
  }, null, 2));
})().catch((error) => fail(error.message || 'unexpected failure', error.stack || error));
