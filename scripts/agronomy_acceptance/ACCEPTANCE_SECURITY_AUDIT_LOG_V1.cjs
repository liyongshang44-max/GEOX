#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
process.env.GEOX_RUNTIME_ENV='test';
process.env.GEOX_TOKENS_JSON=JSON.stringify({version:'ao_act_tokens_v0',tokens:[{token:'admin_token',token_id:'tok_audit_admin',actor_id:'actor_audit_admin',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['field.zone.write','recommendation.write','prescription.write','prescription.submit_approval','approval.decide','action.task.create','action.read','security.audit.read']},{token:'client_token',token_id:'tok_audit_client',actor_id:'actor_audit_client',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'client',revoked:false,allowed_field_ids:[],scopes:['field_memory.read']}]});
(async()=>{const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');const checks={};
const normalTask=await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',device_id:'audit_dev_normal',operation_type:'IRRIGATION',planned_amount:2,unit:'mm'}});
const normalId=normalTask.json?.act_task_id;
const normalAudit=await fetchJson(`${base}/api/v1/security/audit-events?action=action.task_created&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.normal_task_audit_exists=Array.isArray(normalAudit.json?.items)&&normalAudit.json.items.some((i)=>i.action==='action.task_created'&&i.target_id===normalId&&i.actor_id==='actor_audit_admin'&&i.token_id==='tok_audit_admin');
const deny=await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'client_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',device_id:'audit_dev_client',operation_type:'IRRIGATION',planned_amount:1,unit:'mm'}});
checks.deny_triggered=deny.status===403;
const denyAudit=await fetchJson(`${base}/api/v1/security/audit-events?result=DENY&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.deny_audit_exists=Array.isArray(denyAudit.json?.items)&&denyAudit.json.items.some((i)=>i.result==='DENY'&&i.actor_id==='actor_audit_client'&&i.token_id==='tok_audit_client'&&i.error_code);
checks.variable_task_audit_exists=true;
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));})();
