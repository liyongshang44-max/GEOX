#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
process.env.GEOX_RUNTIME_ENV='test';
process.env.GEOX_TOKENS_JSON=JSON.stringify({version:'ao_act_tokens_v0',tokens:[{token:'skill_admin_token',token_id:'s1',actor_id:'sa',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['action.task.create','action.receipt.submit','acceptance.evaluate','security.audit.read','skill.rules.switch']},{token:'client_token',token_id:'c1',actor_id:'cl',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'client',revoked:false,allowed_field_ids:[],scopes:['field_memory.read']},{token:'tenantB_token',token_id:'tb',actor_id:'tb',tenant_id:'tenantB',project_id:'projectB',group_id:'groupB',role:'admin',revoked:false,allowed_field_ids:[],scopes:['security.audit.read']}]});
(async()=>{const base=env('BASE_URL','http://127.0.0.1:3000');const checks={};
await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'skill_admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',device_id:'dev1',operation_type:'IRRIGATION',planned_amount:1,unit:'mm'}});
const audit=await fetchJson(`${base}/api/v1/security/audit-events?action=action.variable_task_created&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'skill_admin_token'});
checks.action_task_audit_exists=Array.isArray(audit.json?.items)&&audit.json.items.some((i)=>i.action==='action.variable_task_created'&&i.result==='ALLOW');
const deny=await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'client_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'}});
checks.deny_triggered=deny.status===403;
const denyAudit=await fetchJson(`${base}/api/v1/security/audit-events?result=DENY&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'skill_admin_token'});
checks.deny_audit_exists=Array.isArray(denyAudit.json?.items)&&denyAudit.json.items.some((i)=>i.result==='DENY'&&i.error_code);
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));})();
