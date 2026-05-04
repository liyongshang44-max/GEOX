#!/usr/bin/env node
/* eslint-disable no-console */
const assert = require('node:assert/strict');

const BASE_URL = process.env.JUDGE_API_BASE_URL || 'http://127.0.0.1:3000';
const AUTH = process.env.JUDGE_API_AUTH || '';

async function call(path, method, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(AUTH ? { authorization: AUTH } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  assert.equal(res.ok, true, `${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

function assertSourceRefs(judge) {
  assert(Array.isArray(judge.source_refs) && judge.source_refs.length > 0, 'source_refs must be non-empty');
  for (const ref of judge.source_refs) {
    assert(ref.skill_id, 'missing source_refs[].skill_id');
    assert(ref.skill_version, 'missing source_refs[].skill_version');
    assert(ref.trace_id, 'missing source_refs[].trace_id');
    assert(ref.run_id, 'missing source_refs[].run_id');
    assert(ref.input_digest || ref.inputs, 'missing source_refs[].input_digest/inputs');
    assert(ref.outputs, 'missing source_refs[].outputs');
    assert(ref.confidence?.level, 'missing source_refs[].confidence.level');
    assert(Array.isArray(ref.evidence_refs), 'missing source_refs[].evidence_refs');
  }
}

(async () => {
  if (!globalThis.fetch) {
    throw new Error('Global fetch unavailable. Use Node.js >= 18.');
  }

  const t = Date.now();
  const tenant = { tenant_id: 't1', project_id: 'p1', group_id: 'g1' };

  const evidence = await call('/api/v1/judge/evidence/evaluate', 'POST', {
    ...tenant,
    field_id: `field_${t}`,
    device_id: `device_${t}`,
    soil_moisture: 0.52,
    observed_at_ts_ms: t - 60_000,
    now_ts_ms: t,
    last_heartbeat_ts_ms: t - 60_000,
    evidence_refs: ['sensor:e1'],
  });
  assert(evidence?.judge_result?.judge_id, 'missing evidence judge_id');
  assertSourceRefs(evidence.judge_result);

  const execution = await call('/api/v1/judge/execution/evaluate', 'POST', {
    ...tenant,
    field_id: `field_${t}`,
    prescription_id: `pres_${t}`,
    receipt: { receipt_id: `r_${t}`, task_id: `task_${t}`, status: 'executed', evidence_refs: ['receipt:e1'] },
    as_executed: { as_executed_id: `ae_${t}`, task_id: `task_${t}` },
    as_applied: { as_applied_id: `aa_${t}` },
    pre_soil_moisture: 0.30,
    post_soil_moisture: 0.35,
    evidence_refs: ['receipt:e1'],
  });
  assert(execution?.judge_result?.judge_id, 'missing execution judge_id');
  assertSourceRefs(execution.judge_result);

  const readBack = await call(`/api/v1/judge/results/${execution.judge_result.judge_id}?tenant_id=${tenant.tenant_id}&project_id=${tenant.project_id}&group_id=${tenant.group_id}`, 'GET');
  assert.equal(readBack?.judge_result?.judge_id, execution.judge_result.judge_id, 'read-back judge_id mismatch');
  assertSourceRefs(readBack.judge_result);

  console.log('ACCEPTANCE_JUDGE_API_PERSISTENCE_TRACEABILITY_V1: PASS');
})();
