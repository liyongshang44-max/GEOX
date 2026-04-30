#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
process.env.GEOX_RUNTIME_ENV='test';
process.env.GEOX_TOKENS_JSON=JSON.stringify({version:'ao_act_tokens_v0',tokens:[
{token:'agronomist_token',token_id:'t1',actor_id:'a1',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'agronomist',revoked:false,allowed_field_ids:[],scopes:['recommendation.write','prescription.write','approval.request']},
{token:'approver_token',token_id:'t2',actor_id:'a2',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'approver',revoked:false,allowed_field_ids:[],scopes:['approval.decide','approval.read']},
{token:'operator_token',token_id:'t3',actor_id:'a3',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'operator',revoked:false,allowed_field_ids:[],scopes:['action.task.create','action.read']},
{token:'executor_token',token_id:'t4',actor_id:'a4',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'executor',revoked:false,allowed_field_ids:[],scopes:['action.receipt.submit']},
{token:'client_token',token_id:'t5',actor_id:'a5',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'client',revoked:false,allowed_field_ids:[],scopes:['field_memory.read']},
{token:'admin_token',token_id:'t6',actor_id:'a6',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['*']},
{token:'self_approval_admin_token',token_id:'t7',actor_id:'a7',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['recommendation.write','prescription.write','approval.request','approval.decide']}
]});
(async()=>{const base=env('BASE_URL','http://127.0.0.1:3000'); const checks={};
const rec=await fetchJson(`${base}/api/v1/recommendations/generate`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',season_id:'s',device_id:'d',crop_code:'corn'}});
checks.agronomist_generate_allowed=!['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING'].includes(rec.json?.error);
const vp=await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',recommendation_id:rec.json?.recommendation_id||'missing',field_id:'field_c8_demo',season_id:'s',crop_id:'corn',variable_plan:{mode:'VARIABLE_BY_ZONE',zone_rates:[]}}});
checks.agronomist_prescription_allowed=!['AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','AUTH_INVALID','AUTH_MISSING'].includes(vp.json?.error);
const sid=vp.json?.prescription_id||'missing';
const sub=await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(sid)}/submit-approval`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'}});
const arid=sub.json?.approval_request_id||'missing';
const agDec=await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(arid)}/decide`,{method:'POST',token:'agronomist_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',decision:'APPROVE'}});
checks.agronomist_cannot_approve=agDec.status===403;
const apDec=await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(arid)}/decide`,{method:'POST',token:'approver_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',decision:'APPROVE'}});
checks.approver_can_approve=apDec.ok===true&&apDec.json?.ok===true;
checks.self_approval_denied=agDec.status===403&&['APPROVAL_SELF_APPROVAL_DENIED','AUTH_SCOPE_DENIED','AUTH_ROLE_SCOPE_DENIED','ROLE_APPROVER_REQUIRED'].includes(agDec.json?.error);
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));})();
