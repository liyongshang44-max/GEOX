#!/usr/bin/env node
const fs=require('fs');const cp=require('child_process');const path=require('path');
const ROOT=path.resolve(__dirname,'../..');process.chdir(ROOT);
const BASE=process.env.MCFT_BASE_SHA||'';
const EXPECTED_BASE='4fc792398bcc25243af7c63734fe59beec9b0dcc';
const FILES=[
'.github/workflows/mcft-cap-09-ea5e2-kbs-rpet-contingency-qualification.yml',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-KBS-RPET-CONTINGENCY-QUALIFICATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_KBS_RPET_CONTINGENCY_QUALIFICATION.cjs',
'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA5E2_KBS_RPET_CONTINGENCY_QUALIFICATION.mjs'];
const out='acceptance-output/MCFT_CAP_09_EA5E2_KBS_RPET_CONTINGENCY_QUALIFICATION_GOVERNANCE_RESULT.json';
function req(ok,code){if(!ok)throw new Error(code)}
function git(...args){return cp.execFileSync('git',args,{encoding:'utf8'}).trim()}
function read(f){return fs.readFileSync(f,'utf8')}
function json(f){return JSON.parse(read(f))}
try{
 req(BASE===EXPECTED_BASE,'RPET_BASE_MAIN_MISMATCH');
 const changed=git('diff','--name-only',`${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 req(JSON.stringify(changed)===JSON.stringify([...FILES].sort()),`RPET_EXACT_FOUR_FILE_BOUNDARY_REQUIRED:${JSON.stringify(changed)}`);
 const a=json(FILES[1]),w=read(FILES[0]),p=read(FILES[3]);
 req(a.record_status==='CONTINGENCY_SOURCE_QUALIFICATION_CANDIDATE_NOT_AUTHORITY','RPET_NONAUTHORITY_STATUS_REQUIRED');
 req(a.base_main_sha===EXPECTED_BASE,'RPET_AUTHORITY_BASE_DRIFT');
 req(a.provider_binding_candidate?.api_host==='api.enviroweather.msu.edu'&&a.provider_binding_candidate?.api_path==='/rm-api/api/run'&&a.provider_binding_candidate?.station_slug==='kbs'&&a.provider_binding_candidate?.rpet_field==='rpet_hourly_us','RPET_EXACT_PROVIDER_BINDING_REQUIRED');
 req(a.authority_effect?.source_substitution_authorized===false&&a.authority_effect?.ea5e2_effectiveness_changed===false&&a.authority_effect?.formal_o00_start_authorized===false,'RPET_PREMATURE_AUTHORITY_FORBIDDEN');
 req(a.technical_qualification_requirements?.public_raw_numeric_value_emission_count===0&&a.technical_qualification_requirements?.database_write_count===0&&a.technical_qualification_requirements?.formal_evidence_write_count===0&&a.technical_qualification_requirements?.r2_formal_write_count===0,'RPET_ZERO_WRITE_BOUNDARY_REQUIRED');
 for(const marker of ['GEOX_MCFT_CAP09_S6_DATABASE_URL','DATABASE_URL','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','R2_ACCESS_KEY','R2_SECRET'])req(!w.includes(marker),`RPET_WORKFLOW_SECRET_FORBIDDEN:${marker}`);
 req(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b\s+(?:INTO|FROM|TABLE)?/i.test(p),'RPET_PROBE_DB_WRITE_TOKEN_FORBIDDEN');
 req(p.includes('public_raw_numeric_value_emission_count:0')&&p.includes('source_substitution_authorized:false')&&p.includes('formal_o00_authorized:false'),'RPET_PROBE_NONCLAIM_REQUIRED');
 const result={schema_version:'geox_mcft_cap09_ea5e2_kbs_rpet_contingency_qualification_governance_v1',status:'PASS',base_sha:BASE,exact_file_count:changed.length,changed_files:changed,database_write_count:0,formal_evidence_write_count:0,r2_formal_write_count:0,source_substitution_authorized:false,ea5e2_effectiveness_changed:false,formal_o00_authorized:false};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({schema_version:'geox_mcft_cap09_ea5e2_kbs_rpet_contingency_qualification_governance_v1',status:'FAIL',error:String(error.message||error)},null,2)+'\n');throw error}
