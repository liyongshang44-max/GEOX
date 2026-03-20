#!/usr/bin/env node
const { Client } = require('pg');

const base = process.env.GEOX_BASE_URL || 'http://127.0.0.1:3000';
const tenant_id = process.env.GEOX_TENANT_ID || 'tenant_demo';
const project_id = process.env.GEOX_PROJECT_ID || 'project_demo';
const group_id = process.env.GEOX_GROUP_ID || 'group_demo';
const databaseUrl = process.env.DATABASE_URL || '';

async function api(path, opts = {}) {
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${text}`);
  return json;
}

(async () => {
  if (!databaseUrl) throw new Error('MISSING_DATABASE_URL');

  const seed = Date.now();
  const act_task_id = `act_accept_${seed}`;
  const operation_plan_id = `op_accept_${seed}`;

  const expectedDuration = 10;
  const actualDuration = 8; // ratio=0.8 => PASSED
  const now = Date.now();

  const taskRecord = {
    type: 'ao_act_task_v0',
    payload: {
      tenant_id,
      project_id,
      group_id,
      act_task_id,
      operation_plan_id,
      action_type: 'IRRIGATE',
      parameters: { duration_min: expectedDuration },
      created_at_ts: now,
    },
    entity: { tenant_id, project_id, group_id },
  };

  const receiptRecord = {
    type: 'ao_act_receipt_v0',
    payload: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id,
      act_task_id,
      execution_time: { start_ts: now, end_ts: now + actualDuration * 60 * 1000 },
      observed_parameters: { duration_min: actualDuration },
      created_at_ts: now + 1,
    },
    entity: { tenant_id, project_id, group_id },
  };

  await api('/api/raw', {
    method: 'POST',
    body: JSON.stringify({ source: 'system', record_json: taskRecord }),
  });

  await api('/api/raw', {
    method: 'POST',
    body: JSON.stringify({ source: 'system', record_json: receiptRecord }),
  });

  const evaluation = await api('/api/v1/acceptance/evaluate', {
    method: 'POST',
    body: JSON.stringify({ tenant_id, project_id, group_id, act_task_id }),
  });

  if (evaluation?.ok !== true) throw new Error('ACCEPTANCE_API_NOT_OK');
  if (evaluation?.result !== 'PASSED') throw new Error(`UNEXPECTED_RESULT:${evaluation?.result}`);

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  const q = await db.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'acceptance_result_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,act_task_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [tenant_id, project_id, group_id, act_task_id]
  );
  await db.end();

  if (!q.rows?.length) throw new Error('MISSING_ACCEPTANCE_RESULT_V1');
  const acceptance = q.rows[0].record_json;
  const metrics = acceptance?.payload?.metrics ?? {};
  if (typeof metrics.actual_duration !== 'number') throw new Error('MISSING_METRICS_ACTUAL_DURATION');

  console.log('PASS ACCEPTANCE_ACCEPTANCE_ENGINE_V1', {
    act_task_id,
    acceptance_fact_id: q.rows[0].fact_id,
    result: acceptance?.payload?.result,
    score: acceptance?.payload?.score,
    metrics,
  });
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_ACCEPTANCE_ENGINE_V1', e?.message || e);
  process.exit(1);
});
