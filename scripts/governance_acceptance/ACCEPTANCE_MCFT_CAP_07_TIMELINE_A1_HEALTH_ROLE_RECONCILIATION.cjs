#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='46dd7781867fb5a509bdd19efd9348dd7044c8fd';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_07_TIMELINE_A1_HEALTH_ROLE_RECONCILIATION_RESULT.json');
const DOC='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-TIMELINE-A1-HEALTH-ROLE-RECONCILIATION-V1.json';
const REPO='apps/server/src/repositories/field_twin_read_model/postgres_field_twin_s4_timeline_repository_v1.ts';
const SELF='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_TIMELINE_A1_HEALTH_ROLE_RECONCILIATION.cjs';
const DB='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_TIMELINE_A1_HEALTH_ROLE_COMPATIBILITY_DB.ts';
const WORKFLOW='.github/workflows/mcft-cap-07-timeline-a1-health-role-reconciliation.yml';
const EXPECTED=[DOC,REPO,SELF,DB,WORKFLOW];
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`)}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'CAP07_TIMELINE_A1_HEALTH_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'CAP07_TIMELINE_A1_HEALTH_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','CAP07_TIMELINE_A1_HEALTH_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'CAP07_TIMELINE_A1_HEALTH_BOUNDARY');
 assert.equal(changed.length,5);
 const record=readJson(DOC);
 assert.equal(record.record_status,'NON_CANDIDATE_READ_CONTRACT_RECONCILIATION');
 assert.equal(record.baseline_main_commit,BASE);
 assert.equal(record.producer_authority.identity_kind,'A1_RECORD_SET');
 assert.equal(record.producer_authority.member_object_ids_shape,'JSON_OBJECT_TYPE_TO_OBJECT_REF');
 assert.equal(record.producer_authority.member_ref_location,'OBJECT_VALUES');
 assert.deepEqual(record.consumer_remediation.required_identity_kinds,['A0_RECORD_SET','A1_RECORD_SET','A2_RECORD_SET']);
 assert.equal(record.consumer_remediation.object_decode_rule,'Object.values(member_object_ids)');
 assert.equal(record.consumer_remediation.expected_health_resolution.transaction_family,'A_STATE_TICK_COMMIT');
 assert.equal(record.consumer_remediation.expected_health_resolution.health_role,'TERMINAL_RECORD_SET_MEMBER');
 assert.equal(record.consumer_remediation.expected_health_resolution.health_resolution_basis,'EXACT_RECORD_SET_MEMBERSHIP');
 assert.equal(record.focused_proof.timeline_page_limit,10);
 assert.equal(record.focused_proof.minimum_page_count,2);
 assert.equal(record.focused_proof.product_read_write_delta,0);
 assert.equal(record.focused_proof.model_activation_count,0);
 for(const [key,value] of Object.entries({candidate_declaration:false,candidate_signal_delta:0,runtime_write_authority_delta:0,database_schema_delta:0,canonical_data_delta:0,route_delta:0,production_runtime_source_authorized:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false})){
  assert.equal(record.delivery_classification[key],value,`CAP07_TIMELINE_A1_HEALTH_${key.toUpperCase()}`);
 }
 const source=fs.readFileSync(path.join(ROOT,REPO),'utf8');
 for(const token of ["identity_kind IN ('A0_RECORD_SET','A1_RECORD_SET','A2_RECORD_SET')","jsonb_typeof(member_object_ids)='array'","jsonb_typeof(member_object_ids)='object'","jsonb_each_text(member_object_ids)",'member.value=ANY($1::text[])','Object.values(record(row.member_object_ids','resolveHistoricalRuntimeRoot(context, checkpoints[0])'])assert.equal(source.includes(token),true,`CAP07_TIMELINE_A1_HEALTH_SOURCE_TOKEN:${token}`);
 assert.equal(source.includes('Object.keys(record(row.member_object_ids'),false,'CAP07_TIMELINE_A1_HEALTH_OBJECT_KEYS_FORBIDDEN');
 for(const forbidden of [/\bINSERT\s+INTO\b/i,/\bUPDATE\s+[a-z_]/i,/\bDELETE\s+FROM\b/i,/\bCREATE\s+(TABLE|FUNCTION|TRIGGER|ROLE)\b/i,/\bALTER\s+(TABLE|ROLE|DEFAULT)\b/i,/\bDROP\s+(TABLE|FUNCTION|ROLE)\b/i])assert.equal(forbidden.test(source),false,`CAP07_TIMELINE_A1_HEALTH_WRITE_FORBIDDEN:${forbidden}`);
 assert.equal(changed.some(file=>file.startsWith('db/')||file.includes('migration')||file.includes('/routes/')||file.includes('scheduler')),false);
 assert.equal(changed.some(file=>file.includes('MCFT-CANDIDATE-AUTHORITY-REGISTRY')||file.includes('DELIVERY-STATUS')||file.endsWith('GEOX-MCFT-CAP-08-TASK.md')),false);
 const all=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(all.includes(declarationMarker),false);
 const result={schema_version:'geox_mcft_cap07_timeline_a1_health_role_reconciliation_result_v1',status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:5,changed_files:changed,identity_kinds:['A0_RECORD_SET','A1_RECORD_SET','A2_RECORD_SET'],object_member_ref_location:'VALUES',timeline_cursor_continuation_required:true,a1_terminal_health_role_required:true,candidate_declaration_present:false,runtime_write_authority_delta:0,database_schema_delta:0,canonical_data_delta:0,route_delta:0,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result));
}catch(error){write({schema_version:'geox_mcft_cap07_timeline_a1_health_role_reconciliation_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
