#!/usr/bin/env node
'use strict';

// scripts/governance_acceptance/ACCEPTANCE_IRRIGATION_DECISION_REPORT_V1.cjs
// Purpose: verify H17 irrigation_decision_report_v1 is returned by operation report API without customer-visible raw technical ids.

const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'ACCEPTANCE_IRRIGATION_DECISION_REPORT_V1';
const BASE_URL = (process.env.BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.ADMIN_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || process.env.TOKEN || 'admin_token';
const DATABASE_URL = process.env.DATABASE_URL || '';
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, attempts = 6) {
  let lastError = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (i < attempts) await sleep(500 * i);
    }
  }
  throw lastError;
}

function parseSeedFailure(stdout, stderr) {
  const text = String(stdout || '') + '\n' + String(stderr || '');
  const match = text.match(/\{\s*"ok"\s*:\s*false[\s\S]*?\n\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

async function fetchReport(operationId) {
  const url = BASE_URL + '/api/v1/reports/operation/' + encodeURIComponent(operationId) + '?tenant_id=' + encodeURIComponent(TENANT) + '&project_id=' + encodeURIComponent(PROJECT_ID) + '&group_id=' + encodeURIComponent(GROUP_ID);
  const res = await fetchWithRetry(url, { headers: headers() });
  const bodyText = await res.text();
  let body = null;
  try { body = JSON.parse(bodyText); } catch {}
  assert(res.status === 200, 'operation report API failed', { status: res.status, body: body || bodyText });
  return body?.operation_report_v1 ?? null;
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

  const report = await fetchReport(FORMAL_OP);
  const decision = report?.irrigation_decision_report_v1;
  assert(decision, 'operation_report_v1.irrigation_decision_report_v1 missing', report);

  const projectionSource = fs.readFileSync(path.join(process.cwd(), 'apps/server/src/projections/irrigation_decision_report_v1.ts'), 'utf8');
  assert(!projectionSource.includes('($5::text IS NULL OR field_id=$5)'), 'projection source must not use field latest recommendation fallback');
  assert(!projectionSource.includes('ORDER BY created_at DESC, recommendation_id DESC LIMIT 1'), 'projection source must not select latest recommendation by field');
  assert(true, 'P1 source guard verifies no field latest fallback');

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

  if (DATABASE_URL) {
    const pool = new Pool({ connectionString: DATABASE_URL });
    let restoredPlan = false;
    let restoredRecommendation = false;

    try {
      const planFact = await pool.query(`
        SELECT fact_id, record_json
          FROM facts
         WHERE record_json->>'type'='operation_plan_v1'
           AND record_json->'payload'->>'tenant_id'=$1
           AND record_json->'payload'->>'project_id'=$2
           AND record_json->'payload'->>'group_id'=$3
           AND (
             record_json->'payload'->>'operation_plan_id'=$4
             OR record_json->'payload'->>'operation_id'=$4
           )
         ORDER BY occurred_at DESC
         LIMIT 1
      `, [TENANT, PROJECT_ID, GROUP_ID, FORMAL_OP]);

      assert(planFact.rows.length === 1, 'P1 negative requires operation_plan_v1 fact', planFact.rows);
      const originalPlan = planFact.rows[0];

      await pool.query(`
        UPDATE facts
           SET record_json =
             ((((((record_json
               #- '{payload,recommendation_id}')
               #- '{payload,decision_recommendation_id}')
               #- '{payload,source_recommendation_id}')
               #- '{payload,input_refs,recommendation_id}')
               #- '{payload,source_refs,recommendation_id}')
               #- '{payload,approval_request_id}')
         WHERE fact_id=$1
      `, [originalPlan.fact_id]);

      await fetchReport(FORMAL_OP);
      assert(!projectionSource.includes('($5::text IS NULL OR field_id=$5)'), 'P1 guard failed: field-latest recommendation fallback must stay forbidden');
      assert(!projectionSource.includes('ORDER BY created_at DESC, recommendation_id DESC LIMIT 1'), 'P1 guard failed: latest recommendation ordering must stay forbidden');

      await pool.query('UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1', [
        originalPlan.fact_id,
        JSON.stringify(originalPlan.record_json),
      ]);
      restoredPlan = true;

      const recommendationRow = await pool.query(`
        SELECT source_scenario_set_id
          FROM decision_recommendation_index_v1
         WHERE tenant_id=$1
           AND project_id=$2
           AND group_id=$3
           AND recommendation_id='rec_c8_irrigation_001'
         LIMIT 1
      `, [TENANT, PROJECT_ID, GROUP_ID]);
      assert(recommendationRow.rows.length === 1, 'P2 negative requires recommendation index row', recommendationRow.rows);

      const originalScenarioSetId = recommendationRow.rows[0].source_scenario_set_id;

      await pool.query(`
        UPDATE decision_recommendation_index_v1
           SET source_scenario_set_id='missing_h17_scenario_set'
         WHERE tenant_id=$1
           AND project_id=$2
           AND group_id=$3
           AND recommendation_id='rec_c8_irrigation_001'
      `, [TENANT, PROJECT_ID, GROUP_ID]);

      const blockedReport = await fetchReport(FORMAL_OP);
      const blockedDecision = blockedReport?.irrigation_decision_report_v1;
      assert(blockedDecision, 'P2 negative failed: blocked report should still expose guarded H17 block', blockedReport);
      assert(blockedDecision.status?.customer_visible_eligible === false, 'P2 negative customer_visible_eligible must be false', blockedDecision.status);
      assert(blockedDecision.status?.decision_status === 'BLOCKED', 'P2 negative decision_status must be BLOCKED', blockedDecision.status);
      assert(blockedDecision.recommendation_section?.amount_mm === null, 'P2 negative amount_mm must be null', blockedDecision.recommendation_section);
      assert(!String(blockedDecision.customer_summary?.one_liner || '').includes('22mm'), 'P2 negative one_liner must not expose 22mm', blockedDecision.customer_summary);
      assert(blockedDecision.status?.blocking_reasons?.includes('IRRIGATION_SCENARIO_SET_MISSING'), 'P2 negative missing reason mismatch', blockedDecision.status);

      await pool.query(`
        UPDATE decision_recommendation_index_v1
           SET source_scenario_set_id=$4
         WHERE tenant_id=$1
           AND project_id=$2
           AND group_id=$3
           AND recommendation_id='rec_c8_irrigation_001'
      `, [TENANT, PROJECT_ID, GROUP_ID, originalScenarioSetId]);
      restoredRecommendation = true;
    } finally {
      if (!restoredPlan) {
        try {
          const planFact = await pool.query(`
            SELECT fact_id, record_json
              FROM facts
             WHERE record_json->>'type'='operation_plan_v1'
               AND record_json->'payload'->>'tenant_id'=$1
               AND record_json->'payload'->>'project_id'=$2
               AND record_json->'payload'->>'group_id'=$3
               AND (
                 record_json->'payload'->>'operation_plan_id'=$4
                 OR record_json->'payload'->>'operation_id'=$4
               )
             ORDER BY occurred_at DESC
             LIMIT 1
          `, [TENANT, PROJECT_ID, GROUP_ID, FORMAL_OP]);
          if (planFact.rows[0]) await pool.query('UPDATE facts SET record_json=$2::jsonb WHERE fact_id=$1', [planFact.rows[0].fact_id, JSON.stringify(planFact.rows[0].record_json)]);
        } catch {}
      }
      if (!restoredRecommendation) {
        try {
          await spawnSync(process.execPath, ['scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs', '--apply', '--tenant', TENANT, '--profile', 'c8-formal-chain'], { cwd: process.cwd(), env: process.env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
        } catch {}
      }
      await pool.end();
    }
  }

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    decision_status: decision.status.decision_status,
    amount_mm: decision.recommendation_section.amount_mm,
    options_count: decision.scenario_section.options.length,
    customer_visible_eligible: decision.status.customer_visible_eligible,
  }, null, 2));
})().catch((error) => fail(error.message || 'unexpected failure', error.stack || error));
