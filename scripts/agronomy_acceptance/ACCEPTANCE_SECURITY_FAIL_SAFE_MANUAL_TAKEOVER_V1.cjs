#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');
const { Pool } = require('pg');

(async()=>{
  const base = env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');
  const pool = new Pool({ connectionString: env('DATABASE_URL', 'postgres://landos:landos_pwd@127.0.0.1:5433/landos') });
  const checks = {};
  const tenant_id = 'tenantA';
  const project_id = 'projectA';
  const group_id = 'groupA';
  const device_id = 'dev_offline_accept_001';

  try { await assertSecurityAcceptanceTokensLoaded(base); } catch (err) { console.log(JSON.stringify({ ok:false, error:'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail:String(err?.message||err) }, null, 2)); process.exit(1); }

  await pool.query(`DELETE FROM device_status_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND device_id=$4`, [tenant_id, project_id, group_id, device_id]);
  await pool.query(`INSERT INTO device_status_index_v1(tenant_id,project_id,group_id,device_id,status,last_heartbeat_ts_ms,last_telemetry_ts_ms,updated_ts_ms) VALUES ($1,$2,$3,$4,'OFFLINE',$5,$6,$7)`, [tenant_id, project_id, group_id, device_id, Date.now()-600000, Date.now()-600000, Date.now()]);

  const approvalCreate = await fetchJson(`${base}/api/v1/approvals/request`, {
    method: 'POST', token: 'admin_token', body: {
      tenant_id,
      project_id,
      group_id,
      issuer: { kind: 'human', id: 'tok_admin_actor', namespace: 'fail_safe_acceptance' },
      action_type: 'IRRIGATE',
      target: { kind: 'device', ref: device_id },
      time_window: { start_ts: Date.now(), end_ts: Date.now() + 15 * 60 * 1000 },
      parameter_schema: { keys: [{ name: 'duration_sec', type: 'number', min: 1 }] },
      parameters: { duration_sec: 60 },
      constraints: { approval_required: true },
      meta: { skip_auto_task_issue: true }
    }
  });
  const approval_request_id = String(approvalCreate.json?.request_id ?? approvalCreate.json?.approval_request_id ?? '');
  checks.approval_request_created = approvalCreate.ok && Boolean(approval_request_id);

  let approvalApprove = { ok: false, status: 0, json: {} };
  if (approval_request_id) {
    approvalApprove = await fetchJson(`${base}/api/v1/approvals/approve`, {
      method: 'POST', token: 'approver_token', body: { request_id: approval_request_id, tenant_id, project_id, group_id, decision: 'APPROVE', reason: 'fail_safe_acceptance_approve' }
    });
  }
  checks.approval_request_approved = approvalApprove.ok;

  const blocked = await fetchJson(`${base}/api/v1/actions/task`, { method:'POST', token:'admin_token', body:{
    tenant_id, project_id, group_id, device_id,
    operation_plan_id: `opl_fail_safe_${Date.now()}`,
    approval_request_id,
    issuer: { kind:'human', id:'tok_admin_actor', namespace:'fail_safe_acceptance' },
    action_type: 'IRRIGATE',
    target: { kind:'field', ref:'field_c8_demo' },
    time_window: { start_ts: Date.now(), end_ts: Date.now() + 15*60*1000 },
    parameter_schema: { keys:[{ name:'duration_sec', type:'number', min:1 }] },
    parameters: { duration_sec: 60 },
    constraints: { approval_required: true },
    meta: { device_id, source:'ACCEPTANCE_SECURITY_FAIL_SAFE_MANUAL_TAKEOVER_V1' }
  }});
  checks.offline_device_blocked = blocked.status===409 && ['FAIL_SAFE_TRIGGERED','FAIL_SAFE_OPEN'].includes(blocked.json?.error);

  const blocked_event_id = String(blocked.json?.fail_safe_event_id ?? '');
  checks.blocked_event_id_returned = Boolean(blocked_event_id);

  const events = await fetchJson(`${base}/api/v1/fail-safe/events?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`, { token:'admin_token' });
  const event = Array.isArray(events.json?.items) ? events.json.items.find((i)=>String(i.fail_safe_event_id||i.id)===blocked_event_id) : null;
  checks.fail_safe_event_exists = Boolean(event);

  const takeovers=await fetchJson(`${base}/api/v1/manual-takeovers?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`,{token:'admin_token'});
  const takeover = Array.isArray(takeovers.json?.items) ? takeovers.json.items.find((i)=>String(i.fail_safe_event_id)===blocked_event_id) : null;
  checks.manual_takeover_requested=Boolean(takeover);
  if (takeover) {
    await fetchJson(`${base}/api/v1/manual-takeovers/${encodeURIComponent(takeover.takeover_id||takeover.id)}/ack`,{method:'POST',token:'admin_token',body:{tenant_id,project_id,group_id}});
    await fetchJson(`${base}/api/v1/manual-takeovers/${encodeURIComponent(takeover.takeover_id||takeover.id)}/complete`,{method:'POST',token:'admin_token',body:{tenant_id,project_id,group_id,completion_note:'done'}});
  }
  if (event) await fetchJson(`${base}/api/v1/fail-safe/events/${encodeURIComponent(event.fail_safe_event_id||event.id)}/resolve`,{method:'POST',token:'admin_token',body:{tenant_id,project_id,group_id,resolution_note:'resolved'}});

  const takeovers2=await fetchJson(`${base}/api/v1/manual-takeovers?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`,{token:'admin_token'});
  checks.manual_takeover_completed=Array.isArray(takeovers2.json?.items)&&takeovers2.json.items.some((i)=>String(i.takeover_id||i.id)===String(takeover?.takeover_id||takeover?.id)&&['COMPLETED','completed'].includes(String(i.status)));
  const events2=await fetchJson(`${base}/api/v1/fail-safe/events?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`,{token:'admin_token'});
  checks.fail_safe_resolved=Array.isArray(events2.json?.items)&&events2.json.items.some((i)=>String(i.fail_safe_event_id||i.id)===blocked_event_id&&['RESOLVED','resolved'].includes(String(i.status)));
  const audits=await fetchJson(`${base}/api/v1/security/audit-events?tenant_id=${tenant_id}&project_id=${project_id}&group_id=${group_id}`,{token:'admin_token'});
  const auditItems = Array.isArray(audits.json?.items) ? audits.json.items : [];
  const takeoverId = String(takeover?.takeover_id || takeover?.id || '');
  checks.manual_takeover_audit_exists = Boolean(blocked_event_id) && Boolean(takeoverId) &&
    auditItems.some((i)=>i.action==='manual_override.requested' && String(i.target_id||'')===blocked_event_id) &&
    auditItems.some((i)=>i.action==='manual_override.acked' && String(i.target_id||'')===takeoverId) &&
    auditItems.some((i)=>i.action==='manual_override.completed' && String(i.target_id||'')===takeoverId) &&
    auditItems.some((i)=>i.action==='fail_safe.resolved' && String(i.target_id||'')===blocked_event_id);

  console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));
  await pool.end();
})();
