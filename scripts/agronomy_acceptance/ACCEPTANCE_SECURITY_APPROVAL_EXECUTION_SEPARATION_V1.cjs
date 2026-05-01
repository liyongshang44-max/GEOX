#!/usr/bin/env node
/* eslint-disable no-console */
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { env, fetchJson } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');

(async()=>{
  const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const checks={};
  const databaseUrl = env('DATABASE_URL', 'postgres://landos:landos_pwd@127.0.0.1:5433/landos');
  const pool = new Pool({ connectionString: databaseUrl });
  const ts0 = Date.now() - 60_000;

  try {
    await assertSecurityAcceptanceTokensLoaded(base);
  } catch (err) {
    console.log(JSON.stringify({ ok:false, error:'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail:String(err?.message||err) }, null, 2));
    await pool.end();
    process.exit(1);
  }

  try {
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS project_id text`);
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS group_id text`);
    await pool.query(`ALTER TABLE derived_sensing_state_index_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb`);

    await pool.query(
      `INSERT INTO derived_sensing_state_index_v1
        (tenant_id, project_id, group_id, field_id, state_type, payload_json, confidence, explanation_codes_json, source_device_ids_json, computed_at, computed_at_ts_ms, fact_id, source_observation_ids_json)
       VALUES
        ($1,$2,$3,$4,'irrigation_effectiveness_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$6,'["obs_sep_irrigation"]'::jsonb),
        ($1,$2,$3,$4,'leak_risk_state','{"level":"LOW"}'::jsonb,0.95,'[]'::jsonb,'[]'::jsonb,NOW(),$5,$7,'["obs_sep_leak"]'::jsonb)
       ON CONFLICT DO NOTHING`,
      ['tenantA', 'projectA', 'groupA', 'field_c8_demo', ts0, randomUUID(), randomUUID()]
    );

    await pool.query(
      `INSERT INTO device_observation_index_v1
        (tenant_id, project_id, group_id, field_id, device_id, metric, observed_at, observed_at_ts_ms, value_num, confidence, fact_id)
       VALUES
        ($1,$2,$3,$4,$5,'soil_moisture',to_timestamp($6 / 1000.0),$6,$7,0.92,$9),
        ($1,$2,$3,$4,$5,'canopy_temp_c',to_timestamp($6 / 1000.0),$6,$8,0.88,$10)
       ON CONFLICT DO NOTHING`,
      [
        'tenantA',
        'projectA',
        'groupA',
        'field_c8_demo',
        'dev_sep',
        ts0,
        0.18,
        31.2,
        `obs_soil_sep_${randomUUID()}`,
        `obs_canopy_sep_${randomUUID()}`
      ]
    );

    const zoneCreate = await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones`, {
      method: 'POST',
      token: 'admin_token',
      body: {
        tenant_id: 'tenantA',
        project_id: 'projectA',
        group_id: 'groupA',
        zone_id: 'sep_zone',
        zone_name: 'sep',
        zone_type: 'IRRIGATION_ZONE',
        geometry: { type: 'Polygon', coordinates: [] },
        area_ha: 1,
        risk_tags: ['SECURITY_TEST'],
        agronomy_tags: ['SEP'],
        source_refs: ['ACCEPTANCE_SECURITY_APPROVAL_EXECUTION_SEPARATION_V1']
      }
    });

    if (!(zoneCreate.ok === true && zoneCreate.json?.ok === true)) {
      console.log(JSON.stringify({
        ok: false,
        error: 'APPROVAL_SEPARATION_ZONE_CREATE_FAILED',
        detail: zoneCreate.json
      }, null, 2));
      await pool.end();
      process.exit(1);
    }
    const rec=await fetchJson(`${base}/api/v1/recommendations/generate`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',season_id:'s_sep',device_id:'dev_sep',crop_code:'corn'}});
    checks.agronomist_generate_allowed=!['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING'].includes(rec.json?.error);

    const recommendation_id = String(
      rec.json?.recommendation_id ??
      rec.json?.recommendations?.[0]?.recommendation_id ??
      ''
    );

    if (!recommendation_id) {
      console.log(JSON.stringify({
        ok: false,
        error: 'APPROVAL_SEPARATION_RECOMMENDATION_ID_MISSING',
        detail: rec.json
      }, null, 2));
      await pool.end();
      process.exit(1);
    }

    const vp=await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',recommendation_id,field_id:'field_c8_demo',season_id:'s_sep',crop_id:'corn',variable_plan:{mode:'VARIABLE_BY_ZONE',zone_rates:[{zone_id:'sep_zone',operation_type:'IRRIGATION',planned_amount:10,unit:'mm',priority:'HIGH',reason_codes:['SECURITY_TEST'],source_refs:['ACCEPTANCE_SECURITY_APPROVAL_EXECUTION_SEPARATION_V1']}]}}});
    checks.agronomist_prescription_allowed=!['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING'].includes(vp.json?.error);

    const pid = String(
      vp.json?.prescription_id ??
      vp.json?.prescription?.prescription_id ??
      vp.json?.prescription?.id ??
      ''
    );

    if (!pid) {
      console.log(JSON.stringify({
        ok: false,
        error: 'APPROVAL_SEPARATION_PRESCRIPTION_ID_MISSING',
        detail: vp.json
      }, null, 2));
      await pool.end();
      process.exit(1);
    }

    const operation_plan_id = `opl_security_sep_${Date.now()}`;

    const sub=await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(pid)}/submit-approval`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'}});
    const arid = String(
      sub.json?.approval_request_id ??
      sub.json?.request_id ??
      ''
    );

    if (!arid) {
      console.log(JSON.stringify({
        ok: false,
        error: 'APPROVAL_SEPARATION_APPROVAL_REQUEST_ID_MISSING',
        detail: sub.json
      }, null, 2));
      await pool.end();
      process.exit(1);
    }

    const agrDec=await fetchJson(`${base}/api/v1/approvals/approve`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',request_id:arid}});
    checks.agronomist_cannot_approve=agrDec.status===403&&['AUTH_SCOPE_DENIED', 'AUTH_ROLE_SCOPE_DENIED', 'ROLE_APPROVER_REQUIRED'].includes(String(agrDec.json?.error ?? ''));

    const appDec=await fetchJson(`${base}/api/v1/approvals/approve`,{method:'POST',token:'approver_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',request_id:arid}});
    checks.approver_can_approve=appDec.ok===true&&appDec.json?.ok===true;

    await pool.query(
      `DELETE FROM device_status_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND device_id=$4`,
      ['tenantA', 'projectA', 'groupA', 'dev_sep']
    );

    await pool.query(
      `INSERT INTO device_status_index_v1
        (tenant_id, project_id, group_id, device_id, status, last_heartbeat_ts_ms, last_telemetry_ts_ms, updated_ts_ms)
       VALUES ($1,$2,$3,$4,'ONLINE',$5,$5,$5)`,
      ['tenantA', 'projectA', 'groupA', 'dev_sep', Date.now()]
    );

    const apTask=await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`,{method:'POST',token:'approver_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',prescription_id:pid,approval_request_id:arid,operation_plan_id,device_id:'dev_sep'}}); checks.approver_cannot_create_task=apTask.status===403;
    const opTask=await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`,{method:'POST',token:'operator_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',prescription_id:pid,approval_request_id:arid,operation_plan_id,device_id:'dev_sep'}});
    if (!(opTask.ok === true && opTask.json?.ok === true)) {
      checks.operator_can_create_task = false;
      console.log(JSON.stringify({
        ok: false,
        error: 'APPROVAL_SEPARATION_OPERATOR_CREATE_TASK_FAILED',
        detail: opTask.json,
        status: opTask.status
      }, null, 2));
      await pool.end();
      process.exit(1);
    }
    checks.operator_can_create_task = true;
    const exTask=await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`,{method:'POST',token:'executor_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',prescription_id:pid,approval_request_id:arid,operation_plan_id,device_id:'dev_sep'}}); checks.executor_cannot_create_task=exTask.status===403;
    const taskId=opTask.json?.act_task_id;
    const exReceipt=await fetchJson(`${base}/api/v1/actions/receipt`,{method:'POST',token:'executor_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',act_task_id:taskId,status:'executed'}}); checks.executor_can_submit_receipt=!['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING'].includes(exReceipt.json?.error);
    const exAcceptance=await fetchJson(`${base}/api/v1/acceptance/evaluate`,{method:'POST',token:'executor_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',act_task_id:taskId}}); checks.executor_cannot_acceptance=exAcceptance.status===403;

    const submitDecision=await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(pid)}/submit-approval`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',decision:'APPROVE',approve:true,status:'APPROVED',approved_by:'x'}});
    checks.submit_approval_cannot_carry_decision=submitDecision.status===400&&submitDecision.json?.error==='APPROVAL_DECISION_NOT_ALLOWED_ON_SUBMIT';

    const selfReq = await fetchJson(`${base}/api/v1/approvals/request`, {
      method: 'POST',
      token: 'self_approval_admin_token',
      body: {
        tenant_id: 'tenantA',
        project_id: 'projectA',
        group_id: 'groupA',
        issuer: { kind: 'human', id: 'actor_self_approval_admin', namespace: 'approval_execution_separation' },
        action_type: 'IRRIGATE',
        target: { kind: 'field', ref: 'field_c8_demo' },
        time_window: { start_ts: Date.now(), end_ts: Date.now() + 60000 },
        parameter_schema: { keys: [{ name: 'amount', type: 'number' }] },
        parameters: { amount: 1 },
        constraints: { approval_required: true },
        meta: { skip_auto_task_issue: true }
      }
    });

    const selfArid = String(
      selfReq.json?.request_id ??
      selfReq.json?.approval_request_id ??
      ''
    );

    const selfDec=await fetchJson(`${base}/api/v1/approvals/approve`,{method:'POST',token:'self_approval_admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',request_id:selfArid}});
    checks.self_approval_denied=selfDec.status===403&&selfDec.json?.error==='APPROVAL_SELF_APPROVAL_DENIED';

    console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));
    await pool.end();
  } catch (err) {
    console.log(JSON.stringify({ ok:false, error:'APPROVAL_EXECUTION_SEPARATION_SCRIPT_ERROR', detail:String(err?.message||err) }, null, 2));
    await pool.end();
    process.exit(1);
  }
})();
