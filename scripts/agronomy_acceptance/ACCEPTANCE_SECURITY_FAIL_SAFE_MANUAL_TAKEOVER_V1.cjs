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
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2)); await pool.end();})();
