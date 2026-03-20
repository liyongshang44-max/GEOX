#!/usr/bin/env node
const base = process.env.GEOX_BASE_URL || 'http://127.0.0.1:3000';
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
  const field_id = process.env.GEOX_FIELD_ID || 'field_demo_1';
  const season_id = process.env.GEOX_SEASON_ID || `season_${new Date().getFullYear()}`;
  const program_id = `prg_acc_${seed}`;

  const created = await api('/api/v1/programs', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: process.env.GEOX_TENANT_ID || 'tenant_demo',
      project_id: process.env.GEOX_PROJECT_ID || 'project_demo',
      group_id: process.env.GEOX_GROUP_ID || 'group_demo',
      program_id,
      field_id,
      season_id,
      crop_code: 'tomato',
      variety_code: 'tomato_cherry',
      status: 'ACTIVE',
      goal_profile: { yield_priority: 'medium', quality_priority: 'high', residue_priority: 'high', water_saving_priority: 'high', cost_priority: 'medium' },
      constraints: { forbid_pesticide_classes: ['high_toxicity'], forbid_fertilizer_types: [], manual_approval_required_for: ['spray', 'fertigation'], allow_night_irrigation: false },
      budget: { max_cost_total: 3000, currency: 'CNY' },
      execution_policy: { mode: 'approval_required', auto_execute_allowed_task_types: ['irrigate'] },
    }),
  });

  if (!created?.program_id) throw new Error('CREATE_PROGRAM_FAILED');

  const current = await api(`/api/v1/fields/${encodeURIComponent(field_id)}/current-program`);
  if (!current?.item?.program_id) throw new Error('CURRENT_PROGRAM_MISSING');
  if (String(current.item.program_id) !== program_id) throw new Error('CURRENT_PROGRAM_ID_MISMATCH');
  if (String(current.item.status) !== 'ACTIVE') throw new Error('CURRENT_PROGRAM_NOT_ACTIVE');

  console.log('PASS ACCEPTANCE_FIELD_PROGRAM_LIFECYCLE_V1', { program_id, field_id, season_id });
})().catch((e) => {
  console.error('FAIL ACCEPTANCE_FIELD_PROGRAM_LIFECYCLE_V1', e?.message || e);
  process.exit(1);
});
