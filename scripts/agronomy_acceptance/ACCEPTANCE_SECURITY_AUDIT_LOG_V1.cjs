#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
const { assertSecurityAcceptanceTokensLoaded } = require('./_security_acceptance_tokens.cjs');
(async()=>{const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');const checks={};
try { await assertSecurityAcceptanceTokensLoaded(base); } catch (err) { console.log(JSON.stringify({ ok:false, error:'SECURITY_ACCEPTANCE_TOKEN_FIXTURE_NOT_LOADED', detail:String(err?.message||err) }, null, 2)); process.exit(1); }
const normalTask=await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',device_id:'audit_dev_normal',operation_type:'IRRIGATION',planned_amount:2,unit:'mm'}});
const normalId=normalTask.json?.act_task_id;
const normalAudit=await fetchJson(`${base}/api/v1/security/audit-events?action=action.task_created&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.normal_task_audit_exists=Array.isArray(normalAudit.json?.items)&&normalAudit.json.items.some((i)=>i.action==='action.task_created'&&i.target_id===normalId&&i.actor_id==='actor_audit_admin'&&i.token_id==='tok_audit_admin');
await fetchJson(`${base}/api/v1/fields/field_c8_demo/zones`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',zone_id:'audit_zone',zone_name:'audit',zone_type:'IRRIGATION_ZONE',geometry:{type:'Polygon',coordinates:[]},area_ha:1,risk_tags:['SECURITY_TEST'],agronomy_tags:['AUDIT'],source_refs:['ACCEPTANCE_SECURITY_AUDIT_LOG_V1']}});
const rec=await fetchJson(`${base}/api/v1/recommendations/generate`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',season_id:'s_audit',device_id:'dev_audit',crop_code:'corn'}});
const vp=await fetchJson(`${base}/api/v1/prescriptions/variable/from-recommendation`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',recommendation_id:rec.json?.recommendation_id,field_id:'field_c8_demo',season_id:'s_audit',crop_id:'corn',variable_plan:{mode:'VARIABLE_BY_ZONE',zone_rates:[{zone_id:'audit_zone',operation_type:'IRRIGATION',planned_amount:7,unit:'mm',priority:'HIGH',reason_codes:['SECURITY_TEST'],source_refs:['AUDIT']}]}}});
const sub=await fetchJson(`${base}/api/v1/prescriptions/${encodeURIComponent(vp.json?.prescription_id)}/submit-approval`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'}});
await fetchJson(`${base}/api/v1/approvals/${encodeURIComponent(sub.json?.approval_request_id)}/decide`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',decision:'APPROVE'}});
const varTask=await fetchJson(`${base}/api/v1/actions/task/from-variable-prescription`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',prescription_id:vp.json?.prescription_id,approval_request_id:sub.json?.approval_request_id,operation_plan_id:sub.json?.operation_plan_id,device_id:'dev_audit'}});
const varAudit=await fetchJson(`${base}/api/v1/security/audit-events?action=action.variable_task_created&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.variable_task_audit_exists=Array.isArray(varAudit.json?.items)&&varAudit.json.items.some((i)=>i.action==='action.variable_task_created'&&i.target_id===varTask.json?.act_task_id&&i.actor_id==='actor_audit_admin'&&i.token_id==='tok_audit_admin');
await fetchJson(`${base}/api/v1/actions/receipt`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',act_task_id:varTask.json?.act_task_id,status:'executed'}});
const receiptAudit=await fetchJson(`${base}/api/v1/security/audit-events?action=action.receipt_submitted&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.receipt_submitted_audit_exists=Array.isArray(receiptAudit.json?.items)&&receiptAudit.json.items.some((i)=>i.action==='action.receipt_submitted'&&i.actor_id==='actor_audit_admin');
await fetchJson(`${base}/api/v1/acceptance/evaluate`,{method:'POST',token:'admin_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',act_task_id:varTask.json?.act_task_id}});
const accAudit=await fetchJson(`${base}/api/v1/security/audit-events?action=acceptance.evaluated&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.acceptance_evaluated_audit_exists=Array.isArray(accAudit.json?.items)&&accAudit.json.items.some((i)=>i.action==='acceptance.evaluated'&&i.actor_id==='actor_audit_admin');
await fetchJson(`${base}/api/v1/skills/rules/switch`,{method:'POST',token:'admin_token',body:{scope:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'},category:'AGRONOMY',trigger_stage:'before_dispatch',requested_action:'human_review',reason:'audit skill switch'}});
const skillAudit=await fetchJson(`${base}/api/v1/security/audit-events?action=skill.binding_switched&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.skill_binding_switched_audit_exists=Array.isArray(skillAudit.json?.items)&&skillAudit.json.items.some((i)=>i.action==='skill.binding_switched'&&i.actor_id==='actor_audit_admin');
const deny=await fetchJson(`${base}/api/v1/actions/task`,{method:'POST',token:'client_token',body:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'field_c8_demo',device_id:'audit_dev_client',operation_type:'IRRIGATION',planned_amount:1,unit:'mm'}});
checks.deny_triggered=deny.status===403;
const denyAudit=await fetchJson(`${base}/api/v1/security/audit-events?result=DENY&tenant_id=tenantA&project_id=projectA&group_id=groupA`,{token:'admin_token'});
checks.deny_audit_exists=Array.isArray(denyAudit.json?.items)&&denyAudit.json.items.some((i)=>i.result==='DENY'&&i.actor_id==='actor_audit_client'&&i.token_id==='tok_audit_client'&&i.error_code);
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));})();
