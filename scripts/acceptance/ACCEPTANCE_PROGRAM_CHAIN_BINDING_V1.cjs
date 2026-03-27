#!/usr/bin/env node
const base = process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001';
const token = process.env.GEOX_TOKEN || process.env.AO_ACT_TOKEN || 'geox_dev_MqF24b9NHfB6AkBNjKaxP_T0CnL0XZykhdmSyoQvg4';

async function api(path, opts = {}) {
  const r = await fetch(`${base}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${text}`);
  return json;
}

(async () => {
  const seed = Date.now();
  const tenant_id = process.env.GEOX_TENANT_ID || 'tenant_demo';
  const project_id = process.env.GEOX_PROJECT_ID || 'project_demo';
  const group_id = process.env.GEOX_GROUP_ID || 'group_demo';
  const field_id = process.env.GEOX_FIELD_ID || 'field_demo_1';
  const season_id = process.env.GEOX_SEASON_ID || `season_${new Date().getFullYear()}`;
  const device_id = process.env.GEOX_DEVICE_ID || 'device_demo_1';
  const program_id = `prg_chain_${seed}`;

  await api('/api/v1/programs', {
    method: 'POST',
    body: JSON.stringify({ tenant_id, project_id, group_id, program_id, field_id, season_id, crop_code: 'tomato', status: 'ACTIVE', goal_profile: {}, constraints: {} }),
  });

  const recGen = await api('/api/v1/recommendations/generate', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id, project_id, group_id,
      program_id, field_id, season_id, device_id,
      telemetry: { soil_moisture_pct: 20, canopy_temp_c: 33 },
      image_recognition: { stress_score: 0.6, disease_score: 0.2, pest_risk_score: 0.2, confidence: 0.9 },
    }),
  });

  const recId = recGen?.recommendations?.[0]?.recommendation_id;
  if (!recId) throw new Error('RECOMMENDATION_NOT_CREATED');

  await api(`/api/v1/recommendations/${encodeURIComponent(recId)}/submit-approval`, {
    method: 'POST',
    body: JSON.stringify({ tenant_id, project_id, group_id, rationale: 'program chain binding acceptance' }),
  });

  const program = await api(`/api/v1/programs/${encodeURIComponent(program_id)}`);
  if (String(program?.item?.latest_recommendation?.recommendation_id || '') !== recId) throw new Error('PROGRAM_RECOMMENDATION_BINDING_MISSING');
  if (!program?.item?.pending_operation_plan?.operation_plan_id) throw new Error('PROGRAM_PLAN_BINDING_MISSING');

  console.log('PASS ACCEPTANCE_PROGRAM_CHAIN_BINDING_V1', {
    program_id,
    recommendation_id: recId,
    operation_plan_id: program.item.pending_operation_plan.operation_plan_id,
  });
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_PROGRAM_CHAIN_BINDING_V1', e?.message || e);
  process.exit(1);
});
