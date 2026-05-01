#!/usr/bin/env node
/* eslint-disable no-console */
const { Pool } = require('pg');
const { env, fetchJson, requireOk } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');

(async () => {
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const tenant_id = 'tenantA'; const project_id = 'projectA'; const group_id = 'groupA';
  const checks = {};
  try { await assertSecurityAcceptanceTokensLoaded(base); } catch (err) { console.log(JSON.stringify({ ok:false, error:'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail:String(err?.message||err) }, null, 2)); process.exit(1); }

  const pool = new Pool({
    connectionString: env('DATABASE_URL', 'postgres://landos:landos_pwd@127.0.0.1:5433/landos')
  });
  const ts0 = Date.now() - 60_000;
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
  await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

  await pool.query(`DELETE FROM derived_sensing_state_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id='field_c8_demo'`, [tenant_id, project_id, group_id]);
  await pool.query(`INSERT INTO derived_sensing_state_index_v1
    (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
    VALUES
    ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_audit_irrigation"]'::jsonb),
    ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'["obs_audit_leak"]'::jsonb)
    ON CONFLICT DO NOTHING`, [tenant_id, project_id, group_id, 'field_c8_demo', ts0, `audit_irr_${ts0}`, `audit_leak_${ts0}`]);

  await pool.query(`INSERT INTO device_observation_index_v1
    (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
    VALUES
    ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.92,$9),
    ($1,$2,$3,$4,$5,'canopy_temp_c',to_timestamp($6 / 1000.0),$6,$8,0.88,$10)
    ON CONFLICT DO NOTHING`, [tenant_id, project_id, group_id, 'field_c8_demo', 'dev_audit', ts0, 0.18, 31.2, `obs_soil_audit_${ts0}`, `obs_canopy_audit_${ts0}`]);

  const rec = requireOk(await fetchJson(`${base}/api/v1/recommendations/generate`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id, field_id:'field_c8_demo', season_id:'s_audit', device_id:'dev_audit', crop_code:'corn' } }), 'recommendation generate');
  const recommendation_id = String(rec.recommendation_id ?? rec.recommendations?.[0]?.recommendation_id ?? '');
  if (!recommendation_id) { console.error('recommendation_id missing'); process.exit(1); }

  await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id, zone_id:'audit_zone', zone_name:'audit', zone_type:'IRRIGATION_ZONE', geometry:{type:'Polygon',coordinates:[]}, area_ha:1 } });
  const vp = requireOk(await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id, recommendation_id, field_id:'field_c8_demo', season_id:'s_audit', crop_id:'corn', variable_plan:{ mode:'VARIABLE_BY_ZONE', zone_rates:[{ zone_id:'audit_zone', operation_type:'IRRIGATION', planned_amount:7, unit:'mm', priority:'HIGH', reason_codes:['SECURITY_TEST'], source_refs:['AUDIT'] }] } } }), 'variable prescription');
  const prescription_id = String(vp.prescription_id ?? vp.prescription?.prescription_id ?? vp.prescription?.id ?? '');
  if (!prescription_id) { console.error('prescription_id missing'); process.exit(1); }

  const sub = requireOk(await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(prescription_id)}/submit-approval`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id } }), 'submit approval');
  const approval_request_id = String(sub.approval_request_id ?? '');
  requireOk(await fetchJson(`${base}/api/v1/approvals/approve`, {
    method: 'POST',
    token: 'approver_token',
    body: { tenant_id, project_id, group_id, request_id: approval_request_id }
  }), 'approve request');

  const operation_plan_id = `opl_security_audit_${Date.now()}`;

  const normal_operation_plan_id = `opl_security_audit_normal_${Date.now()}`;

  const normalTask = requireOk(await fetchJson(`${base}/api/v1/actions/task`, {
    method: 'POST',
    token: 'admin_token',
    body: {
      tenant_id,
      project_id,
      group_id,
      operation_plan_id: normal_operation_plan_id,
      approval_request_id,
      issuer: {
        kind: 'human',
        id: 'tok_admin_actor',
        namespace: 'security_audit_acceptance'
      },
      action_type: 'IRRIGATE',
      target: {
        kind: 'field',
        ref: 'field_c8_demo'
      },
      time_window: {
        start_ts: Date.now(),
        end_ts: Date.now() + 30 * 60 * 1000
      },
      parameter_schema: {
        keys: [
          { name: 'duration_sec', type: 'number', min: 1 }
        ]
      },
      parameters: {
        duration_sec: 60
      },
      constraints: {
        approval_required: true,
        device_id: 'dev_audit'
      },
      meta: {
        device_id: 'dev_audit',
        audit_acceptance: true
      }
    }
  }), 'create normal task');

  const normal_task_id = String(normalTask.act_task_id || '');

  if (!normal_task_id) {
    console.log(JSON.stringify({
      ok: false,
      error: 'AUDIT_NORMAL_TASK_ID_MISSING',
      detail: normalTask
    }, null, 2));
    process.exit(1);
  }
  const normalAudit = await fetchJson(`${base}/api/v1/security/audit-events?action=action.task_created&target_id=${encodeURIComponent(normal_task_id)}&tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token:'admin_token' });
  checks.normal_task_audit_exists = Array.isArray(normalAudit.json?.items) && normalAudit.json.items.some((i)=>i.target_id===normal_task_id&&i.result==='ALLOW');

  await pool.query(`DELETE FROM device_status_index_v1
WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND device_id=$4;`, [tenant_id, project_id, group_id, 'dev_audit']);
  const nowTs = Date.now();
  await pool.query(`INSERT INTO device_status_index_v1
  (tenant_id, project_id, group_id, device_id, status, last_heartbeat_ts_ms, last_telemetry_ts_ms, updated_ts_ms)
VALUES
  ($1,$2,$3,$4,'ONLINE',$5,$5,$5);`, [tenant_id, project_id, group_id, 'dev_audit', nowTs]);

  const varTask = requireOk(await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id, prescription_id, approval_request_id, operation_plan_id, device_id:'dev_audit' } }), 'create variable task');
  const act_task_id = String(varTask.act_task_id || '');

  const varAudit = await fetchJson(`${base}/api/v1/security/audit-events?action=action.variable_task_created&target_id=${encodeURIComponent(act_task_id)}&tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token:'admin_token' });
  checks.variable_task_audit_exists = Array.isArray(varAudit.json?.items) && varAudit.json.items.some((i)=>i.target_id===act_task_id&&i.result==='ALLOW');

  const receipt = requireOk(await fetchJson(`${base}/api/v1/actions/receipt`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id, operation_plan_id, act_task_id, executor_id:{kind:'device',id:'dev_audit',namespace:'device'}, execution_time:{start_ts:Date.now()-60000,end_ts:Date.now()}, execution_coverage:{percent:100,area_ha:1}, resource_usage:{water_liters:100,energy_kwh:1}, logs_refs:[], status:'executed', constraint_check:{violated:false,violations:[]}, observed_parameters:{duration_sec:60}, meta:{idempotency_key:`rcpt_${Date.now()}`,command_id:`cmd_${Date.now()}`,device_id:'dev_audit'} } }), 'submit receipt');
  const receipt_fact_id = String(receipt.fact_id || '');
  const receiptAudit = await fetchJson(`${base}/api/v1/security/audit-events?action=action.receipt_submitted&target_id=${encodeURIComponent(receipt_fact_id)}&tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token:'admin_token' });
  checks.receipt_submitted_audit_exists = Array.isArray(receiptAudit.json?.items) && receiptAudit.json.items.some((i)=>i.target_id===receipt_fact_id&&i.result==='ALLOW');

  const acc = requireOk(await fetchJson(`${base}/api/v1/acceptance/evaluate`, { method:'POST', token:'admin_token', body:{ tenant_id, project_id, group_id, act_task_id } }), 'acceptance evaluate');
  const accAudit = await fetchJson(`${base}/api/v1/security/audit-events?action=acceptance.evaluated&target_id=${encodeURIComponent(acc.fact_id)}&tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token:'admin_token' });
  checks.acceptance_evaluated_audit_exists = Array.isArray(accAudit.json?.items) && accAudit.json.items.some((i)=>i.target_id===acc.fact_id&&i.result==='ALLOW');

  const skillSwitchReason = `audit skill switch ${Date.now()}`;
  await fetchJson(`${base}/api/v1/skills/rules/switch`, { method:'POST', token:'admin_token', body:{ skill_id:`security_audit_skill_${Date.now()}`, version:'v1', enabled:true, category:'AGRONOMY', scope:{ tenant_id, project_id, group_id, scope_type:'TENANT', bind_target:'tenantA', trigger_stage:'before_recommendation', rollout_mode:'DIRECT' }, priority:10, reason:skillSwitchReason } });
  const skillAudit = await fetchJson(`${base}/api/v1/security/audit-events?action=skill.binding_switched&result=ALLOW&actor_id=tok_admin_actor&token_id=tok_admin&tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token:'admin_token' });
  checks.skill_binding_switched_audit_exists = Array.isArray(skillAudit.json?.items) && skillAudit.json.items.some((i)=>i.action==='skill.binding_switched'&&i.result==='ALLOW'&&i.actor_id==='tok_admin_actor'&&i.token_id==='tok_admin'&&i.reason===skillSwitchReason);

  const deny = await fetchJson(`${base}/api/v1/skills/rules/switch`,{method:'POST',token:'skill_admin_token',body:{skill_id:`security_audit_deny_${Date.now()}`,version:'v1',enabled:true,category:'AGRONOMY',scope:{tenant_id,project_id,group_id,scope_type:'TENANT',bind_target:'tenantA',trigger_stage:'before_dispatch',rollout_mode:'DIRECT'},priority:11,reason:'audit deny boundary test'}});
  checks.deny_triggered = deny.status === 403 && String(deny.json?.error ?? '') === 'SKILL_CATEGORY_BOUNDARY_VIOLATION';
  const denyAudit = await fetchJson(`${base}/api/v1/security/audit-events?result=DENY&actor_id=actor_skill_admin&token_id=tok_skill_admin&error_code=SKILL_CATEGORY_BOUNDARY_VIOLATION&tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`,{token:'admin_token'});
  checks.deny_audit_exists = Array.isArray(denyAudit.json?.items)&&denyAudit.json.items.some((i)=>i.result==='DENY'&&i.actor_id==='actor_skill_admin'&&i.token_id==='tok_skill_admin'&&i.error_code==='SKILL_CATEGORY_BOUNDARY_VIOLATION');

  await pool.end();
  console.log(JSON.stringify({ ok:Object.values(checks).every(Boolean), checks }, null, 2));
})();
