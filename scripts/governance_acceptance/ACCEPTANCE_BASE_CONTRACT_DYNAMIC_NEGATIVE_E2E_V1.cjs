#!/usr/bin/env node
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('../agronomy_acceptance/_common.cjs');

function nowId(prefix) {
  return `${prefix}_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

async function tableExists(pool, table) {
  const q = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
  return Boolean(q.rows?.[0]?.reg);
}

async function columnsFor(pool, table) {
  const q = await pool.query(
    `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position`,
    [table]
  );
  return q.rows ?? [];
}

async function insertKnownColumns(pool, table, values) {
  const cols = await columnsFor(pool, table);
  if (!cols.length) throw new Error(`missing table or columns: ${table}`);
  const allowed = new Set(cols.map((c) => String(c.column_name)));
  const picked = Object.entries(values).filter(([key]) => allowed.has(key));
  if (!picked.length) throw new Error(`no matching insert columns for ${table}`);
  const missingRequired = cols
    .filter((c) => String(c.is_nullable).toUpperCase() === 'NO' && c.column_default == null && !Object.prototype.hasOwnProperty.call(values, c.column_name))
    .map((c) => c.column_name)
    .filter((name) => name !== 'id');
  if (missingRequired.length) {
    throw new Error(`missing required columns for ${table}: ${missingRequired.join(',')}`);
  }
  const names = picked.map(([key]) => key);
  const placeholders = names.map((_, idx) => `$${idx + 1}`);
  const params = picked.map(([, value]) => value);
  await pool.query(
    `INSERT INTO ${table} (${names.map((n) => `"${n}"`).join(',')}) VALUES (${placeholders.join(',')}) ON CONFLICT DO NOTHING`,
    params
  );
}

async function insertFact(pool, source, record) {
  const fact_id = randomUUID();
  await pool.query(
    `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)`,
    [fact_id, source, JSON.stringify(record)]
  );
  return fact_id;
}

async function requireHealth(base) {
  const resp = await fetchJson(`${base}/api/v1/health`, { method: 'GET' });
  if (!resp.ok) {
    const legacy = await fetchJson(`${base}/api/health`, { method: 'GET' });
    assert.equal(legacy.ok, true, `server health failed status=${resp.status}/${legacy.status}`);
  }
}

async function acceptanceReceiptDoesNotPass({ pool, base, token, tenant }) {
  const field_id = nowId('field_dyn_neg_accept');
  const act_task_id = nowId('task_dyn_neg_accept');
  const operation_plan_id = nowId('op_dyn_neg_accept');
  const device_id = nowId('dev_dyn_neg_accept');
  const start = Date.now() - 60_000;
  const end = Date.now() - 10_000;

  await insertFact(pool, 'dynamic_negative_e2e/task', {
    type: 'ao_act_task_v0',
    payload: {
      ...tenant,
      act_task_id,
      task_id: act_task_id,
      operation_plan_id,
      field_id,
      action_type: 'IRRIGATE',
      target: { kind: 'field', ref: field_id },
      time_window: { start_ts: start, end_ts: end },
      parameters: { duration_min: 30, amount: 20, coverage_percent: 90 },
      meta: { device_id, source_lane: 'DYNAMIC_NEGATIVE_E2E' },
    },
  });
  const receipt_fact_id = await insertFact(pool, 'dynamic_negative_e2e/receipt', {
    type: 'ao_act_receipt_v0',
    payload: {
      ...tenant,
      act_task_id,
      task_id: act_task_id,
      operation_plan_id,
      field_id,
      status: 'executed',
      execution_time: { start_ts: start, end_ts: end },
      observed_parameters: { duration_min: 30, amount: 20, coverage_percent: 90 },
      evidence_refs: [{ kind: 'receipt_only', ref: 'no_formal_evidence' }],
      logs_refs: [{ kind: 'operator_note', ref: 'receipt_success_only' }],
      meta: { is_simulated: false, source_lane: 'RECEIPT_ONLY_NEGATIVE' },
    },
  });

  const resp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
    method: 'POST',
    token,
    body: { ...tenant, act_task_id },
  });
  const json = requireOk(resp, 'receipt-only acceptance evaluate');
  const verdict = String(json.verdict ?? '').toUpperCase();
  assert.notEqual(verdict, 'PASS', `receipt-only acceptance must not PASS; receipt_fact_id=${receipt_fact_id}`);
  return { verdict, act_task_id, receipt_fact_id };
}

async function roiFromAsExecutedNotCustomerVisible({ pool, base, token, tenant }) {
  assert.equal(await tableExists(pool, 'as_executed_v1'), true, 'as_executed_v1 table missing');
  const as_executed_id = nowId('as_exec_dyn_neg');
  const task_id = nowId('task_dyn_neg_roi');
  const field_id = nowId('field_dyn_neg_roi');
  await insertKnownColumns(pool, 'as_executed_v1', {
    as_executed_id,
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    task_id,
    prescription_id: nowId('presc_dyn_neg_roi'),
    field_id,
    planned: JSON.stringify({ amount: 30, unit: 'L', operation_plan_id: nowId('op_dyn_neg_roi') }),
    executed: JSON.stringify({ amount: 25, unit: 'L', status: 'CONFIRMED', resource_usage: { water_l: 25, electric_kwh: 0, chemical_ml: 0 } }),
    evidence_refs: JSON.stringify(['receipt_only_dynamic_negative']),
    created_at: new Date(),
    updated_at: new Date(),
  });
  const resp = await fetchJson(`${base}/api/v1/roi-ledger/from-as-executed`, {
    method: 'POST',
    token,
    body: { ...tenant, as_executed_id },
  });
  const json = requireOk(resp, 'roi from as-executed');
  const rows = Array.isArray(json.roi_ledgers) ? json.roi_ledgers : [];
  assert.ok(rows.length > 0, 'roi ledgers missing for as_executed negative case');
  for (const row of rows) {
    assert.notEqual(String(row.trust_level ?? '').toUpperCase(), 'FORMAL_ACCEPTED', 'as_executed ROI must not default FORMAL_ACCEPTED');
    assert.notEqual(Boolean(row.customer_visible_value), true, 'as_executed ROI must not default customer_visible_value=true');
  }
  return { as_executed_id, roi_count: rows.length, trust_levels: rows.map((r) => r.trust_level) };
}

async function technicalMemoryDoesNotBecomeLearning({ pool, base, token, tenant }) {
  assert.equal(await tableExists(pool, 'field_memory_v1'), true, 'field_memory_v1 table missing');
  const operation_id = nowId('op_dyn_neg_learning');
  const field_id = nowId('field_dyn_neg_learning');
  const task_id = nowId('task_dyn_neg_learning');

  await insertKnownColumns(pool, 'field_memory_v1', {
    memory_id: nowId('mem_skill_dyn_neg'),
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id,
    operation_id,
    task_id,
    memory_type: 'SKILL_PERFORMANCE_MEMORY',
    memory_lane: 'TECHNICAL_SKILL_MEMORY',
    trust_level: 'TECHNICAL_SIGNAL',
    source_lane: 'SKILL_TECHNICAL',
    customer_visible_memory: false,
    learning_eligible: false,
    skill_id: 'dynamic_negative_skill_v1',
    skill_trace_ref: nowId('trace_dyn_neg'),
    summary_text: 'technical skill success signal only; not formal learning',
    confidence: 0.8,
    evidence_refs: JSON.stringify(['skill_run_success_only']),
    occurred_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });
  await insertKnownColumns(pool, 'field_memory_v1', {
    memory_id: nowId('mem_judge_dyn_neg'),
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id,
    operation_id,
    task_id,
    memory_type: 'EXECUTION_QUALITY_MEMORY',
    memory_lane: 'TECHNICAL_EXECUTION_MEMORY',
    trust_level: 'TECHNICAL_SIGNAL',
    source_lane: 'JUDGE_TECHNICAL',
    customer_visible_memory: false,
    learning_eligible: false,
    summary_text: 'judge pass signal only; not formal learning',
    confidence: 0.8,
    evidence_refs: JSON.stringify(['judge_pass_only']),
    occurred_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  const resp = await fetchJson(`${base}/api/v1/operator/learning-validation?tenant_id=${encodeURIComponent(tenant.tenant_id)}&project_id=${encodeURIComponent(tenant.project_id)}&group_id=${encodeURIComponent(tenant.group_id)}&operation_id=${encodeURIComponent(operation_id)}`, {
    method: 'GET',
    token,
  });
  const json = requireOk(resp, 'operator learning validation');
  const validation = json.learning_validation ?? json.learningValidation ?? json;
  assert.notEqual(Boolean(validation.learning_effective), true, 'technical memory must not make learning_effective=true');
  assert.notEqual(String(validation.learning_validation_status ?? '').toUpperCase(), 'FORMAL_LEARNING_ACCEPTED', 'technical memory must not be formal learning accepted');
  return { operation_id, learning_effective: validation.learning_effective, status: validation.learning_validation_status };
}

async function runExistingVariableTaskDynamic() {
  const result = spawnSync(process.execPath, ['scripts/agronomy_acceptance/ACCEPTANCE_VARIABLE_ACTION_TASK_V1.cjs'], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`ACCEPTANCE_VARIABLE_ACTION_TASK_V1 failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  const merged = `${result.stdout}\n${result.stderr}`;
  assert.ok(merged.includes('operation_plan_not_auto_acked') || merged.includes('READY_TO_DISPATCH'), 'variable task dynamic output missing no-auto-ACK checks');
  return { status: result.status, checked: 'ACCEPTANCE_VARIABLE_ACTION_TASK_V1' };
}

async function flightTableDynamicBoundary({ pool, base, token, tenant }) {
  const run_id = nowId('ft_run_dyn_neg');
  const operation_id = `ft_op_${run_id}`;
  const field_id = nowId('field_dyn_neg_ft');
  const artifact_id = nowId('artifact_dyn_neg_ft');
  await insertFact(pool, 'api/v1/dev/flight-table/evidence', {
    type: 'evidence_artifact_v1',
    payload: {
      ...tenant,
      artifact_id,
      operation_id,
      field_id,
      source: 'FLIGHT_TABLE_FORMAL_EVIDENCE',
      source_lane: 'SIMULATED_DEV_ONLY',
      is_simulated: true,
      formal_eligible: false,
      evidence_level: 'DEBUG',
      run_id,
      dev_source: 'flight_table_dynamic_negative_e2e',
      kind: 'metric',
      metric_key: 'soil_moisture',
      value: 0.25,
    },
  });
  const reportResp = await fetchJson(`${base}/api/v1/reports/operation/${encodeURIComponent(operation_id)}?tenant_id=${encodeURIComponent(tenant.tenant_id)}&project_id=${encodeURIComponent(tenant.project_id)}&group_id=${encodeURIComponent(tenant.group_id)}`, {
    method: 'GET',
    token,
  });
  if (reportResp.ok && reportResp.json?.ok !== false) {
    const body = reportResp.json ?? {};
    const chainPassed = Boolean(body.chain_validation?.passed ?? body.report?.chain_validation?.passed);
    const customerEligible = Boolean(body.customer_visible_eligible ?? body.report?.customer_visible_eligible);
    const isSim = Boolean(body.is_simulated ?? body.report?.is_simulated);
    assert.notEqual(chainPassed, true, 'Flight Table operation report must not chain_validation.passed=true');
    assert.notEqual(customerEligible, true, 'Flight Table operation report must not be customer_visible_eligible=true');
    assert.equal(isSim || String(body.trust_level ?? body.report?.trust_level ?? '').includes('SIMULATED'), true, 'Flight Table report should be simulated/limited if returned');
    return { operation_id, report_checked: true, chainPassed, customerEligible };
  }
  const evidenceQ = await pool.query(
    `SELECT record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type')='evidence_artifact_v1'
        AND (record_json::jsonb#>>'{payload,artifact_id}')=$1
      LIMIT 1`,
    [artifact_id]
  );
  const payload = evidenceQ.rows?.[0]?.record_json?.payload ?? {};
  assert.equal(String(payload.source_lane), 'SIMULATED_DEV_ONLY', 'flight-table-like evidence source_lane must be SIMULATED_DEV_ONLY');
  assert.equal(Boolean(payload.formal_eligible), false, 'flight-table-like evidence formal_eligible must be false');
  return { operation_id, report_checked: false, report_status: reportResp.status, artifact_checked: true };
}

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', env('ADMIN_TOKEN', 'admin_token'));
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const tenant = {
    tenant_id: env('TENANT_ID', 'tenantA'),
    project_id: env('PROJECT_ID', 'projectA'),
    group_id: env('GROUP_ID', 'groupA'),
  };
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await requireHealth(base);
    assert.equal(await tableExists(pool, 'facts'), true, 'facts table missing');
    const checks = {};
    checks.receipt_success_does_not_acceptance_pass = await acceptanceReceiptDoesNotPass({ pool, base, token, tenant });
    checks.flight_table_not_customer_valid = await flightTableDynamicBoundary({ pool, base, token, tenant });
    checks.as_executed_roi_not_customer_visible = await roiFromAsExecutedNotCustomerVisible({ pool, base, token, tenant });
    checks.skill_or_judge_signal_not_formal_learning = await technicalMemoryDoesNotBecomeLearning({ pool, base, token, tenant });
    checks.variable_task_creation_not_auto_acked = await runExistingVariableTaskDynamic();
    process.stdout.write(`${JSON.stringify({ ok: true, checks }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
