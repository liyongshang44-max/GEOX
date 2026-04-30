#!/usr/bin/env node
/* eslint-disable no-console */
const { env, fetchJson } = require('./_common.cjs');
process.env.GEOX_RUNTIME_ENV='test';
process.env.GEOX_TOKENS_JSON=JSON.stringify({version:'ao_act_tokens_v0',tokens:[
{token:'client_without_skill_read',token_id:'c1',actor_id:'c1',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'client',revoked:false,allowed_field_ids:[],scopes:['field_memory.read']},
{token:'auditor_token',token_id:'au1',actor_id:'au1',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'auditor',revoked:false,allowed_field_ids:[],scopes:['skill.read']},
{token:'agronomist_token',token_id:'ag1',actor_id:'ag1',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'agronomist',revoked:false,allowed_field_ids:[],scopes:['recommendation.write']},
{token:'skill_admin_token',token_id:'sa1',actor_id:'sa1',tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',role:'admin',revoked:false,allowed_field_ids:[],scopes:['skill.read','skill.binding.write','skill.admin']},
{token:'tenantB_auditor_token',token_id:'tb1',actor_id:'tb1',tenant_id:'tenantB',project_id:'projectB',group_id:'groupB',role:'auditor',revoked:false,allowed_field_ids:[],scopes:['skill.read']}
]});
(async()=>{const base=env('BASE_URL', process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001');const q='tenant_id=tenantA&project_id=projectA&group_id=groupA';const checks={};
const c=await fetchJson(`${base}/api/v1/skills/rules?${q}`,{token:'client_without_skill_read'}); checks.client_without_skill_read_denied=c.status===403&&c.json?.error==='AUTH_SCOPE_DENIED';
const a=await fetchJson(`${base}/api/v1/skills/rules?${q}`,{token:'auditor_token'}); checks.auditor_can_read=a.ok===true&&a.json?.ok===true;
const swDenied=await fetchJson(`${base}/api/v1/skills/rules/switch`,{method:'POST',token:'agronomist_token',body:{scope:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'},category:'AGRONOMY',trigger_stage:'before_dispatch',requested_action:'human_review',reason:'x'}}); checks.agronomist_cannot_switch=swDenied.status===403;
const noReason=await fetchJson(`${base}/api/v1/skills/rules/switch`,{method:'POST',token:'skill_admin_token',body:{scope:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'},category:'AGRONOMY',trigger_stage:'before_dispatch',requested_action:'human_review'}}); checks.skill_admin_reason_required=noReason.status===400&&noReason.json?.error==='SKILL_CHANGE_REASON_REQUIRED';
const withReason=await fetchJson(`${base}/api/v1/skills/rules/switch`,{method:'POST',token:'skill_admin_token',body:{scope:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'},category:'AGRONOMY',trigger_stage:'before_dispatch',requested_action:'human_review',reason:'acceptance test switch'}});
checks.skill_admin_switch_with_reason_ok=withReason.ok===true&&withReason.json?.ok===true;
const forbidden=await fetchJson(`${base}/api/v1/skills/rules/switch`,{method:'POST',token:'skill_admin_token',body:{scope:{tenant_id:'tenantA',project_id:'projectA',group_id:'groupA'},category:'AGRONOMY',trigger_stage:'before_dispatch',requested_action:'device_command',reason:'security negative test'}});
checks.agronomy_device_command_forbidden=forbidden.status===400&&['SKILL_CATEGORY_BOUNDARY_VIOLATION','SKILL_OUTPUT_FORBIDDEN_ACTION'].includes(forbidden.json?.error);
const cross=await fetchJson(`${base}/api/v1/skills/rules?${q}`,{token:'tenantB_auditor_token'}); checks.cross_tenant_rules_hidden=cross.status===404&&cross.json?.error==='NOT_FOUND';
console.log(JSON.stringify({ok:Object.values(checks).every(Boolean),checks},null,2));})();
