#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='12df989d370b047020b264625f901a93f0330947';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_07_CAP04_FORECAST_PAYLOAD_RECONCILIATION_RESULT.json');
const DOC='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-FORECAST-PAYLOAD-RECONCILIATION-V1.json';
const SERVICE='apps/server/src/services/mcft_field_twin_read_api_v1.ts';
const SELF='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_FORECAST_PAYLOAD_RECONCILIATION.cjs';
const DB='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_FORECAST_PAYLOAD_COMPATIBILITY_DB.ts';
const WORKFLOW='.github/workflows/mcft-cap-07-cap04-forecast-payload-reconciliation.yml';
const EXPECTED=[DOC,SERVICE,SELF,DB,WORKFLOW];
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`)}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'CAP07_CAP04_FORECAST_RECONCILIATION_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'CAP07_CAP04_FORECAST_RECONCILIATION_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','CAP07_CAP04_FORECAST_RECONCILIATION_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'CAP07_CAP04_FORECAST_RECONCILIATION_BOUNDARY');
 assert.equal(changed.length,5);
 const record=readJson(DOC);
 assert.equal(record.record_status,'NON_CANDIDATE_READ_CONTRACT_RECONCILIATION');
 assert.equal(record.baseline_main_commit,BASE);
 assert.equal(record.producer_authority.canonical_object_type,'twin_forecast_run_v1');
 assert.equal(record.producer_authority.canonical_points_path,'record_json.payload.payload.points');
 assert.equal(record.producer_authority.canonical_point_count,72);
 assert.equal(record.producer_authority.authoritative_validator,'validateCap04ForecastRunPayloadV1');
 assert.equal(record.producer_authority.nonexistent_consumer_path,'record_json.payload.payload.point_count');
 assert.deepEqual(record.focused_proof.required_http_surfaces,['runtime','timeline_first_page']);
 assert.equal(record.focused_proof.product_read_write_delta,0);
 assert.equal(record.focused_proof.model_activation_count,0);
 assert.equal(record.explicit_follow_on.timeline_cursor_continuation_status,'OUT_OF_SCOPE_BLOCKED');
 assert.equal(record.explicit_follow_on.failure_code,'MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF');
 assert.equal(record.explicit_follow_on.classification,'SEPARATE_CAP07_HISTORICAL_ROOT_HEALTH_ROLE_REMEDIATION');
 assert.equal(record.explicit_follow_on.must_not_be_hidden_by_this_reconciliation,true);
 for(const [key,value] of Object.entries({candidate_declaration:false,candidate_signal_delta:0,runtime_write_authority_delta:0,database_schema_delta:0,canonical_data_delta:0,route_delta:0,production_runtime_source_authorized:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false})){
  assert.equal(record.delivery_classification[key],value,`CAP07_CAP04_FORECAST_RECONCILIATION_${key.toUpperCase()}`);
 }
 const service=fs.readFileSync(path.join(ROOT,SERVICE),'utf8');
 for(const token of ['validateCap04ForecastRunPayloadV1','Cap04ForecastRunPayloadV1','Array.isArray(payload.points)','payload.points.length !== 72','SOURCE_FORECAST_NOT_COMPLETED_72','SOURCE_FORECAST_CAP04_CONTRACT_INVALID'])assert.equal(service.includes(token),true,`CAP07_CAP04_FORECAST_SERVICE_TOKEN:${token}`);
 assert.equal(service.includes('payload.point_count'),false,'CAP07_CAP04_FORECAST_NONCANONICAL_POINT_COUNT_FORBIDDEN');
 for(const forbidden of [/\bINSERT\s+INTO\b/i,/\bUPDATE\s+[a-z_]/i,/\bDELETE\s+FROM\b/i,/\bCREATE\s+(TABLE|FUNCTION|TRIGGER|ROLE)\b/i,/\bALTER\s+(TABLE|ROLE|DEFAULT)\b/i,/\bDROP\s+(TABLE|FUNCTION|ROLE)\b/i])assert.equal(forbidden.test(service),false,`CAP07_CAP04_FORECAST_SERVICE_WRITE_FORBIDDEN:${forbidden}`);
 assert.equal(changed.some(file=>file.startsWith('db/')||file.includes('migration')||file.includes('/routes/')||file.includes('scheduler')),false);
 assert.equal(changed.some(file=>file.includes('MCFT-CANDIDATE-AUTHORITY-REGISTRY')||file.includes('DELIVERY-STATUS')||file.endsWith('GEOX-MCFT-CAP-08-TASK.md')),false);
 const source=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(source.includes(declarationMarker),false);
 const result={schema_version:'geox_mcft_cap07_cap04_forecast_payload_reconciliation_result_v1',status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:5,changed_files:changed,canonical_points_path:'record_json.payload.payload.points',canonical_point_count:72,authoritative_validator:'validateCap04ForecastRunPayloadV1',noncanonical_point_count_reference_present:false,runtime_readback_required:true,timeline_first_page_readback_required:true,timeline_cursor_continuation_status:'OUT_OF_SCOPE_BLOCKED',timeline_cursor_follow_on_failure_code:'MCFT_RUNTIME_HEALTH_ROLE_UNRESOLVED:ATTEMPT_REF',candidate_declaration_present:false,runtime_write_authority_delta:0,database_schema_delta:0,canonical_data_delta:0,route_delta:0,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result));
}catch(error){write({schema_version:'geox_mcft_cap07_cap04_forecast_payload_reconciliation_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
