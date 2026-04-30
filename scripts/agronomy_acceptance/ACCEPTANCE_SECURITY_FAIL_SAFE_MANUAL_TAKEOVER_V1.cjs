#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
const { Pool } = require('pg');
process.env.GEOX_RUNTIME_ENV='test';
process.env.GEOX_TOKENS_JSON=JSON.stringify({version:'ao_act_tokens_v0',tokens:[{token:'admin_token',token_id:'a1',actor_id:'ad',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['action.task.create','action.read','action.task.dispatch','security.admin','security.audit.read']}]});
(async()=>{const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');const pool=new Pool({connectionString:env('DATABASE_URL','postgres://postgres:postgres@127.0.0.1:5432/geox')});const checks={};
await pool.query(`insert into device_status_index_v1(tenant_id,project_id,group_id,device_id,status,last_heartbeat_ts_ms) values ($1,$2,$3,$4,'OFFLINE',$5) on conflict (tenant_id,project_id,group_id,device_id) do update set status=excluded.status,last_heartbeat_ts_ms=excluded.last_heartbeat_ts_ms`,['tenantA','projectA','groupA','dev_offline_accept_001',Date.now()-600000]);
const blocked=await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',device_id:'dev_offline_accept_001',operation_type:'IRRIGATION',planned_amount:2,unit:'mm'}});
checks.offline_device_blocked=blocked.status===409&&['FAIL_SAFE_TRIGGERED','FAIL_SAFE_OPEN'].includes(blocked.json?.error);
const events=await fetchJson(`${base}/api/v1/fail-safe/events?tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.fail_safe_event_exists=Array.isArray(events.json?.items)&&events.json.items.some((i)=>i.device_id==='dev_offline_accept_001'&&i.tenant_id==='tenantA');
const event = Array.isArray(events.json?.items) ? events.json.items.find((i)=>i.device_id==='dev_offline_accept_001') : null;
const takeovers=await fetchJson(`${base}/api/v1/manual-takeovers?tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
const takeover = Array.isArray(takeovers.json?.items) ? takeovers.json.items.find((i)=>String(i.fail_safe_event_id)===String(event?.fail_safe_event_id||event?.id)) : null;
checks.manual_takeover_requested=Boolean(takeover);
if (takeover) {
  await fetchJson(`${base}/api/v1/manual-takeovers/${encodeURIComponent(takeover.takeover_id||takeover.id)}/ack`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'}});
  await fetchJson(`${base}/api/v1/manual-takeovers/${encodeURIComponent(takeover.takeover_id||takeover.id)}/complete`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',completion_note:'done'}});
}
if (event) await fetchJson(`${base}/api/v1/fail-safe/events/${encodeURIComponent(event.fail_safe_event_id||event.id)}/resolve`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',resolution_note:'resolved'}});
const takeovers2=await fetchJson(`${base}/api/v1/manual-takeovers?tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.manual_takeover_completed=Array.isArray(takeovers2.json?.items)&&takeovers2.json.items.some((i)=>['COMPLETED','completed'].includes(String(i.status)));
const events2=await fetchJson(`${base}/api/v1/fail-safe/events?tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.fail_safe_resolved=Array.isArray(events2.json?.items)&&events2.json.items.some((i)=>['RESOLVED','resolved'].includes(String(i.status)));
const audits=await fetchJson(`${base}/api/v1/security/audit-events?tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.manual_takeover_audit_exists=Array.isArray(audits.json?.items)&&audits.json.items.some((i)=>['manual_override.requested','manual_override.acked','manual_override.completed','fail_safe.resolved'].includes(i.action));
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2)); await pool.end();})();
