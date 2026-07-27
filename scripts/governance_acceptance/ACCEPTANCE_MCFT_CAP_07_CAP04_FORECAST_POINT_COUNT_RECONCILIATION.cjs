#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const ORIGINAL_BASE='90d2f6179461a890f0b34babccdf9014b6f84f47';
const ORIGINAL_MERGE='242d027101574512decdfa1ee3647b557d2fd858';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_07_CAP04_FORECAST_POINT_COUNT_RECONCILIATION_RESULT.json');
const MATRIX='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json';
const GOVERNANCE='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP06-GOVERNANCE-SCOPE-RECONCILIATION-V1.json';
const PAYLOAD='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-FORECAST-PAYLOAD-RECONCILIATION-V1.json';
const RECONCILIATION='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-FORECAST-POINT-COUNT-RECONCILIATION-V1.json';
const LOADER='apps/server/src/domain/field_twin_read_model/s4_source_obligations_v1.ts';
const RESOLVER='apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.ts';
const CAP06_GATE='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP06_GOVERNANCE_SCOPE_RECONCILIATION.cjs';
const SELF='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_FORECAST_POINT_COUNT_RECONCILIATION.cjs';
const DB='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_FORECAST_POINT_COUNT_COMPATIBILITY_DB.ts';
const WORKFLOW='.github/workflows/mcft-cap-07-cap04-forecast-point-count-reconciliation.yml';
const ORIGINAL_EXPECTED=[WORKFLOW,LOADER,RESOLVER,RECONCILIATION,CAP06_GATE,SELF,DB];
const FROZEN={
 [MATRIX]:'9bc4713357f3c89d1f6d799fd2502a4da7181b00',
 [GOVERNANCE]:'fcdb3858122a6ff370d9490de2dc76003fe6c75a',
 [PAYLOAD]:'fc0ea726fbb5006a16d176b3a7f2be0233c94d89',
};
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`)}
function isAncestor(ancestor,descendant){try{cp.execFileSync('git',['merge-base','--is-ancestor',ancestor,descendant],{cwd:ROOT,stdio:'ignore'});return true}catch{return false}}
function assertAuthoritySemantics(){
 for(const [file,sha] of Object.entries(FROZEN)) assert.equal(git('rev-parse',`HEAD:${file}`),sha,`CAP07_FORECAST_PROJECTION_FROZEN_HEAD:${file}`);
 const reconciliation=JSON.parse(fs.readFileSync(path.join(ROOT,RECONCILIATION),'utf8'));
 assert.equal(reconciliation.record_status,'NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION');
 assert.equal(reconciliation.base_main_sha,ORIGINAL_BASE);
 assert.equal(reconciliation.base_matrix_blob,FROZEN[MATRIX]);
 assert.equal(reconciliation.historical_matrix_mutation,false);
 assert.equal(reconciliation.affected_source_count,1);
 assert.equal(reconciliation.affected_comparison_count,2);
 assert.equal(reconciliation.affected_sources.length,1);
 const source=reconciliation.affected_sources[0];
 assert.equal(source.source_name,'public.twin_forecast_run_projection_v1');
 assert.equal(source.comparison_rules.length,2);
 const rules=Object.fromEntries(source.comparison_rules.map(rule=>[rule.projection_column,rule]));
 assert.deepEqual(Object.keys(rules).sort(),['forecast_status','point_count']);
 assert.equal(rules.forecast_status.prior_canonical_path,'record_json.payload.payload.forecast_status');
 assert.equal(rules.forecast_status.effective_canonical_path,'record_json.payload.payload.status');
 assert.equal(rules.forecast_status.canonical_authority_rule,'CAP04_FORECAST_STATUS_FIELD');
 assert.equal(rules.point_count.prior_canonical_path,'record_json.payload.payload.point_count');
 assert.equal(rules.point_count.effective_canonical_path,'record_json.payload.payload.points.length');
 assert.equal(rules.point_count.canonical_authority_rule,'ARRAY_LENGTH_EQUALS_PROJECTION_POINT_COUNT');
 for(const rule of Object.values(rules)){
  assert.equal(rule.prior_comparison,'EXACT');
  assert.equal(rule.effective_comparison,'EXACT');
 }
 const loader=fs.readFileSync(path.join(ROOT,LOADER),'utf8');
 for(const token of [
  'forecastPointCountReconciliationJson','record_json.payload.payload.forecast_status','record_json.payload.payload.status',
  'record_json.payload.payload.point_count','record_json.payload.payload.points.length','comparisonApplied !== 2',
  'applyForecastProjectionReconciliationV1',
 ]) assert.equal(loader.includes(token),true,`CAP07_FORECAST_PROJECTION_LOADER_TOKEN:${token}`);
 const resolver=fs.readFileSync(path.join(ROOT,RESOLVER),'utf8');
 for(const token of ['Array.isArray(current)','token === "length" && index === tokens.length - 1','current.length : undefined']) {
  assert.equal(resolver.includes(token),true,`CAP07_FORECAST_PROJECTION_RESOLVER_TOKEN:${token}`);
 }
 const cap06Gate=fs.readFileSync(path.join(ROOT,CAP06_GATE),'utf8');
 for(const token of ['ORIGINAL_EXACT_DELIVERY_BOUNDARY','SUCCESSOR_REGRESSION_GUARD','ORIGINAL_MERGE','loader_successor_change_consumed']) {
  assert.equal(cap06Gate.includes(token),true,`CAP07_FORECAST_PROJECTION_CAP06_GATE_TOKEN:${token}`);
 }
 return rules;
}
try{
 const base=String(process.env.MCFT_BASE_SHA||ORIGINAL_BASE).trim();
 const subject=git('rev-parse','HEAD');
 assert.equal(git('merge-base',base,subject),base,'CAP07_FORECAST_PROJECTION_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','CAP07_FORECAST_PROJECTION_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 const rules=assertAuthoritySemantics();
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 if(base===ORIGINAL_BASE){
  assert.deepEqual(changed,[...ORIGINAL_EXPECTED].sort(),'CAP07_FORECAST_PROJECTION_BOUNDARY');
  assert.equal(changed.length,7,'CAP07_FORECAST_PROJECTION_CHANGED_FILE_COUNT');
  for(const [file,sha] of Object.entries(FROZEN)) assert.equal(git('rev-parse',`${base}:${file}`),sha,`CAP07_FORECAST_PROJECTION_FROZEN_BASE:${file}`);
  const all=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
  assert.equal(all.includes(declarationMarker),false,'CAP07_FORECAST_PROJECTION_CANDIDATE_DECLARATION_FORBIDDEN');
  assert.equal(changed.some(file=>file.includes('/routes/')||file.includes('migration')||file.includes('scheduler')||file.includes('model_activation')),false,'CAP07_FORECAST_PROJECTION_FORBIDDEN_BOUNDARY');
  const result={schema_version:'geox_mcft_cap07_cap04_forecast_projection_reconciliation_result_v2',status:'PASS',validation_mode:'ORIGINAL_EXACT_DELIVERY_BOUNDARY',base_sha:base,subject_sha:subject,changed_file_count:7,changed_files:changed,historical_matrix_blob:FROZEN[MATRIX],historical_matrix_mutation:false,affected_source_count:1,affected_comparison_count:2,effective_comparisons:{forecast_status:rules.forecast_status.effective_canonical_path,point_count:rules.point_count.effective_canonical_path},comparison:'EXACT',path_reader_extension:'TERMINAL_ARRAY_LENGTH_ONLY',cap06_successor_gate_enabled:true,route_delta:0,database_schema_delta:0,runtime_write_authority_delta:0,candidate_declaration_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,model_activation_authorized:false,mcft_cap_09_authorized:false};
  write(result);console.log(JSON.stringify(result));
 }else{
  assert.equal(isAncestor(ORIGINAL_MERGE,base),true,'CAP07_FORECAST_SUCCESSOR_BASE_MISSING_EFFECTIVE_RECONCILIATION');
  assert.equal(isAncestor(ORIGINAL_MERGE,subject),true,'CAP07_FORECAST_SUCCESSOR_HEAD_MISSING_EFFECTIVE_RECONCILIATION');
  const protectedFiles=[MATRIX,GOVERNANCE,PAYLOAD,RECONCILIATION,RESOLVER,CAP06_GATE,DB,WORKFLOW];
  for(const file of protectedFiles){
   assert.equal(changed.includes(file),false,`CAP07_FORECAST_SUCCESSOR_PROTECTED_FILE_CHANGED:${file}`);
   assert.equal(git('rev-parse',`HEAD:${file}`),git('rev-parse',`${base}:${file}`),`CAP07_FORECAST_SUCCESSOR_PROTECTED_BLOB_CHANGED:${file}`);
  }
  const originalBoundaryIntersection=changed.filter(file=>ORIGINAL_EXPECTED.includes(file));
  assert.deepEqual(originalBoundaryIntersection.filter(file=>file!==LOADER&&file!==SELF),[],'CAP07_FORECAST_SUCCESSOR_ORIGINAL_BOUNDARY_INTRUSION');
  assert.equal(changed.includes(LOADER),true,'CAP07_FORECAST_SUCCESSOR_LOADER_CHANGE_REQUIRED');
  const all=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
  assert.equal(all.includes(declarationMarker),false,'CAP07_FORECAST_SUCCESSOR_CANDIDATE_DECLARATION_FORBIDDEN');
  const result={schema_version:'geox_mcft_cap07_cap04_forecast_projection_reconciliation_result_v2',status:'PASS',validation_mode:'SUCCESSOR_REGRESSION_GUARD',base_sha:base,subject_sha:subject,original_effective_merge_sha:ORIGINAL_MERGE,changed_file_count:changed.length,changed_files:changed,historical_matrix_blob:FROZEN[MATRIX],historical_matrix_unchanged:true,protected_forecast_file_count:protectedFiles.length,protected_forecast_files_unchanged:true,affected_source_count:1,affected_comparison_count:2,effective_comparisons:{forecast_status:rules.forecast_status.effective_canonical_path,point_count:rules.point_count.effective_canonical_path},loader_successor_change_consumed:true,candidate_declaration_present:false,runtime_write_authority_delta:0,database_schema_delta:0,route_delta:0,s6_candidate_implemented:false,mcft_cap_08_complete:false,model_activation_authorized:false,mcft_cap_09_authorized:false};
  write(result);console.log(JSON.stringify(result));
 }
}catch(error){write({schema_version:'geox_mcft_cap07_cap04_forecast_projection_reconciliation_result_v2',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
