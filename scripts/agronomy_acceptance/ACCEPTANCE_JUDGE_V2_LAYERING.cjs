const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { assert, env, fetchJson, requireOk } = require('./_common.cjs');

(async () => {
  const base = env('BASE_URL', 'http://127.0.0.1:3001');
  const token = env('AO_ACT_TOKEN', '');
  const tenant_id = env('TENANT_ID', 'tenantA');
  const project_id = env('PROJECT_ID', 'projectA');
  const group_id = env('GROUP_ID', 'groupA');
  const databaseUrl = env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const anchor = Date.now();
    const recommendation_id = `rec_judge_v2_${anchor}`;
    const task_id = `task_judge_v2_${anchor}`;
    const receipt_id = `receipt_judge_v2_${anchor}`;

    const evidenceJson = requireOk(await fetchJson(`${base}/api/v2/judge/evidence/evaluate`, {
      method: 'POST',
      token,
      body: {
        tenant_id,
        project_id,
        group_id,
        task_id,
        receipt_id,
        evidence_refs: [{ kind: 'photo', ref: `photo_${anchor}` }, { kind: 'sensor', ref: `sensor_${anchor}` }],
        source_refs: [{ kind: 'task', ref: task_id }],
        min_evidence_count: 2,
      },
    }), 'judge evidence evaluate');

    const agronomyJson = requireOk(await fetchJson(`${base}/api/v2/judge/agronomy/evaluate`, {
      method: 'POST',
      token,
      body: {
        tenant_id,
        project_id,
        group_id,
        recommendation_id,
        field_id: `field_judge_v2_${anchor}`,
        season_id: `season_judge_v2_${anchor}`,
        device_id: `device_judge_v2_${anchor}`,
        soil_moisture: 0.16,
        deficit_threshold: 0.2,
        evidence_refs: [{ kind: 'state', ref: 'derived_sensing_state_index_v1' }],
      },
    }), 'judge agronomy evaluate');

    const executionJson = requireOk(await fetchJson(`${base}/api/v2/judge/execution/evaluate`, {
      method: 'POST',
      token,
      body: {
        tenant_id,
        project_id,
        group_id,
        task_id,
        receipt_id,
        expected_amount: 20,
        executed_amount: 18,
        tolerance_percent: 20,
        evidence_refs: [{ kind: 'receipt', ref: receipt_id }],
        source_refs: [{ kind: 'recommendation', ref: recommendation_id }],
      },
    }), 'judge execution evaluate');

    const listed = requireOk(await fetchJson(
      `${base}/api/v2/judge/results?tenant_id=${encodeURIComponent(tenant_id)}&project_id=${encodeURIComponent(project_id)}&group_id=${encodeURIComponent(group_id)}&task_id=${encodeURIComponent(task_id)}&limit=10`,
      { method: 'GET', token }
    ), 'judge result list');

    const ids = new Set((listed.items ?? []).map((x) => String(x?.judge_id ?? '')));
    assert.ok(ids.has(String(evidenceJson.judge_result?.judge_id ?? '')), 'evidence judge id missing from list');
    assert.ok(ids.has(String(executionJson.judge_result?.judge_id ?? '')), 'execution judge id missing from list');

    const taskFactIdQ = await pool.query(
      `SELECT fact_id
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'ao_act_task_v0'
          AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
          AND (record_json::jsonb#>>'{payload,project_id}') = $2
          AND (record_json::jsonb#>>'{payload,group_id}') = $3
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [tenant_id, project_id, group_id]
    );

    if (taskFactIdQ.rows?.length > 0) {
      const taskFact = await pool.query(
        `SELECT (record_json::jsonb#>>'{payload,act_task_id}') AS act_task_id
           FROM facts
          WHERE fact_id = $1`,
        [taskFactIdQ.rows[0].fact_id]
      );
      const act_task_id = String(taskFact.rows?.[0]?.act_task_id ?? '').trim();
      if (act_task_id) {
        const acceptanceResp = await fetchJson(`${base}/api/v1/acceptance/evaluate`, {
          method: 'POST',
          token,
          body: {
            tenant_id,
            project_id,
            group_id,
            act_task_id,
            judge_result_ids: [
              String(evidenceJson.judge_result?.judge_id ?? randomUUID()),
              String(agronomyJson.judge_result?.judge_id ?? randomUUID()),
              String(executionJson.judge_result?.judge_id ?? randomUUID()),
            ],
          },
        });
        if (acceptanceResp.ok && acceptanceResp.json?.ok) {
          const used = acceptanceResp.json?.judge_result_ids_used ?? [];
          assert.ok(Array.isArray(used), 'acceptance judge_result_ids_used must be array');
          assert.ok(used.length >= 3, 'acceptance must use provided judge ids');
        }
      }
    }

    console.log('[PASS] ACCEPTANCE_JUDGE_V2_LAYERING', {
      evidence_judge_id: evidenceJson.judge_result?.judge_id,
      agronomy_judge_id: agronomyJson.judge_result?.judge_id,
      execution_judge_id: executionJson.judge_result?.judge_id,
    });
  } finally {
    await pool.end();
  }
})().catch((err) => {
  console.error('[FAIL] ACCEPTANCE_JUDGE_V2_LAYERING', err?.stack || String(err));
  process.exit(1);
});
