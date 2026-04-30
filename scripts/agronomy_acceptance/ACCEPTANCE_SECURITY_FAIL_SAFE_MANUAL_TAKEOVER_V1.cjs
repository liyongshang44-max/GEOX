#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
const { Pool } = require('pg');
process.env.GEOX_RUNTIME_ENV='test';
process.env.GEOX_TOKENS_JSON=JSON.stringify({version:'ao_act_tokens_v0',tokens:[{token:'admin_token',token_id:'a1',actor_id:'ad',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['action.task.create','action.read','action.task.dispatch','security.admin','security.audit.read']}]});
(async()=>{const base=env('BASE_URL','http://127.0.0.1:3000');const pool=new Pool({connectionString:env('DATABASE_URL','postgres://postgres:postgres@127.0.0.1:5432/geox')});const checks={};
await pool.query(`insert into device_status_index_v1(device_id,status,last_heartbeat_ts_ms) values ($1,'OFFLINE',$2) on conflict (device_id) do update set status=excluded.status,last_heartbeat_ts_ms=excluded.last_heartbeat_ts_ms`,['dev_offline_accept_001',Date.now()-600000]);
const blocked=await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',prescription_id:'missing',approval_request_id:'missing',operation_plan_id:'missing',device_id:'dev_offline_accept_001'}});
checks.offline_device_blocked=blocked.status===409&&['FAIL_SAFE_TRIGGERED','FAIL_SAFE_OPEN'].includes(blocked.json?.error);
const events=await fetchJson(`${base}/api/v1/fail-safe/events?tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.fail_safe_event_exists=Array.isArray(events.json?.items)&&events.json.items.some((i)=>i.device_id==='dev_offline_accept_001');
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2)); await pool.end();})();
