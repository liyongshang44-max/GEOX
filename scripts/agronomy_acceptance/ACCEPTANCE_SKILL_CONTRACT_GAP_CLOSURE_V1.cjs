#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

const BASE = process.env.GEOX_BASE_URL || 'http://127.0.0.1:8787';
const TOKEN = process.env.GEOX_TOKEN || process.env.AO_ACT_TOKEN || '';
const tenant = {
  tenant_id: process.env.GEOX_TENANT_ID || 'tenantA',
  project_id: process.env.GEOX_PROJECT_ID || 'projectA',
  group_id: process.env.GEOX_GROUP_ID || 'groupA',
};

async function fetchJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(`${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

(async () => {
  const suffix = Date.now();

  const agronomySkill = {
    ...tenant,
    skill_id: 'irrigation_deficit_skill_v1', version: 'v1', skill_version: 'v1',
    display_name: 'Irrigation Deficit Skill', category: 'AGRONOMY', status: 'ACTIVE',
    trigger_stage: 'after_recommendation', scope_type: 'FIELD', rollout_mode: 'DIRECT',
    input_schema_digest: `in_${suffix}`, output_schema_digest: `out_${suffix}`,
    input_schema_ref: 'schema://agronomy/irrigation_deficit/input/v1',
    output_schema_ref: 'schema://agronomy/irrigation_deficit/output/v1',
    capabilities: ['irrigation_deficit_detection'], risk_level: 'MEDIUM',
    fallback_policy: { mode: 'static_default' }, audit_policy: { level: 'standard' },
    binding_conditions: { requires_field_memory: true }, enabled: true,
  };

  const deviceSkill = {
    ...tenant,
    skill_id: 'mock_valve_control_skill_v1', version: 'v1', skill_version: 'v1',
    display_name: 'Mock Valve Control Skill', category: 'DEVICE', status: 'ACTIVE',
    trigger_stage: 'before_acceptance', scope_type: 'DEVICE', rollout_mode: 'DIRECT',
    input_schema_digest: `in_device_${suffix}`, output_schema_digest: `out_device_${suffix}`,
    input_schema_ref: 'schema://device/mock_valve/input/v1',
    output_schema_ref: 'schema://device/mock_valve/output/v1',
    capabilities: ['valve_open_close_mock'], risk_level: 'LOW',
    fallback_policy: { mode: 'none' }, audit_policy: { level: 'strict' },
    binding_conditions: { approval_required: true }, enabled: true,
  };

  await fetchJson('/api/v1/skills/definitions', { method: 'POST', body: agronomySkill });
  await fetchJson('/api/v1/skills/definitions', { method: 'POST', body: deviceSkill });

  const rec = await fetchJson('/api/v1/recommendations', { method: 'POST', body: { ...tenant, field_id: `field_${suffix}`, crop_code: 'tomato' } });
  const recommendation_id = String(rec.recommendation_id || rec.item?.recommendation_id || '');
  const recommendation_skill_trace = rec.skill_trace || rec.item?.skill_trace;
  assert.ok(recommendation_id, 'recommendation missing id');
  assert.ok(recommendation_skill_trace, 'recommendation missing skill_trace');

  const prescription = await fetchJson('/api/v1/prescriptions/from-recommendation', { method: 'POST', body: { ...tenant, recommendation_id } });
  const prescription_id = String(prescription.prescription_id || prescription.item?.prescription_id || '');
  assert.ok(prescription_id, 'prescription missing id');
  assert.ok(prescription.skill_trace || prescription.item?.skill_trace, 'prescription missing skill_trace');

  const submit = await fetchJson(`/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method: 'POST', body: tenant });
  const approval_request_id = String(submit.approval_request_id || '');
  assert.ok(approval_request_id, 'missing approval_request_id');
  await fetchJson(`/api/v1/approvals/${encodeURIComponent(approval_request_id)}/decide`, { method: 'POST', body: { ...tenant, decision: 'APPROVE' } });

  const task = await fetchJson('/api/v1/actions/task/from-prescription', { method: 'POST', body: { ...tenant, prescription_id, approval_request_id, device_id: `device_${suffix}` } });
  assert.ok(task.skill_id || task.item?.skill_id || task.device_skill_id || task.item?.device_skill_id, 'task missing device skill');

  const run = await fetchJson('/api/v1/skill-runs', { method: 'POST', body: { ...tenant, skill_id: 'mock_valve_control_skill_v1', version: 'v1', category: 'DEVICE', status: 'ACTIVE', result_status: 'SUCCESS', trigger_stage: 'before_acceptance', scope_type: 'DEVICE', rollout_mode: 'DIRECT', bind_target: `device_${suffix}`, input_digest: 'in', output_digest: 'out' } });
  assert.ok(run.run_id || run.item?.run_id || run.payload?.run_id, 'skill run missing run_id');

  console.log('ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1 passed');
})();
