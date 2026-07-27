#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='242d027101574512decdfa1ee3647b557d2fd858';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_07_CAP04_SCENARIO_OPTION_COUNT_RECONCILIATION_RESULT.json');
const MATRIX='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json';
const FORECAST='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-FORECAST-POINT-COUNT-RECONCILIATION-V1.json';
const SCENARIO='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-SCENARIO-OPTION-COUNT-RECONCILIATION-V1.json';
const LOADER='apps/server/src/domain/field_twin_read_model/s4_source_obligations_v1.ts';
const FORECAST_GATE='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_FORECAST_POINT_COUNT_RECONCILIATION.cjs';
const EXPECTED=[
 '.github/workflows/mcft-cap-07-cap04-scenario-option-count-reconciliation.yml',
 LOADER,SCENARIO,FORECAST_GATE,
 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_SCENARIO_OPTION_COUNT_RECONCILIATION.cjs',
 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP04_SCENARIO_OPTION_COUNT_COMPATIBILITY_DB.ts',
];
const FROZEN={
 [MATRIX]:'9bc4713357f3c89d1f6d799fd2502a4da7181b00',
 [FORECAST]:'2c976d8ccc67541e957d2492ba18b76de863dd19',
 'apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.ts':'375207a205a668d33afaa1fb03618ff1cd36078b',
};
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`)}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'CAP07_SCENARIO_OPTION_COUNT_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'CAP07_SCENARIO_OPTION_COUNT_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','CAP07_SCENARIO_OPTION_COUNT_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'CAP07_SCENARIO_OPTION_COUNT_BOUNDARY');
 assert.equal(changed.length,6,'CAP07_SCENARIO_OPTION_COUNT_CHANGED_FILE_COUNT');
 for(const [file,sha] of Object.entries(FROZEN)){
  assert.equal(git('rev-parse',`HEAD:${file}`),sha,`CAP07_SCENARIO_OPTION_COUNT_FROZEN_HEAD:${file}`);
  assert.equal(git('rev-parse',`${base}:${file}`),sha,`CAP07_SCENARIO_OPTION_COUNT_FROZEN_BASE:${file}`);
 }
 const reconciliation=JSON.parse(fs.readFileSync(path.join(ROOT,SCENARIO),'utf8'));
 assert.equal(reconciliation.record_status,'NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION');
 assert.equal(reconciliation.base_main_sha,BASE);
 assert.equal(reconciliation.base_matrix_blob,FROZEN[MATRIX]);
 assert.equal(reconciliation.historical_matrix_mutation,false);
 assert.equal(reconciliation.affected_source_count,1);
 assert.equal(reconciliation.affected_comparison_count,1);
 assert.equal(reconciliation.affected_sources.length,1);
 const rule=reconciliation.affected_sources[0];
 assert.equal(rule.source_name,'public.twin_scenario_set_projection_v1');
 assert.equal(rule.projection_column,'option_count');
 assert.equal(rule.prior_canonical_path,'record_json.payload.payload.option_count');
 assert.equal(rule.effective_canonical_path,'record_json.payload.payload.options.length');
 assert.equal(rule.prior_comparison,'EXACT');
 assert.equal(rule.effective_comparison,'EXACT');
 assert.equal(rule.canonical_authority_rule,'ARRAY_LENGTH_EQUALS_PROJECTION_OPTION_COUNT');
 assert.equal(rule.canonical_field_option_count_present,false);
 const audit=Object.fromEntries(reconciliation.audited_successor_sources.map(item=>[item.source_name,item.result]));
 assert.equal(audit['public.twin_action_feedback_projection_v1'],'NO_PATH_DRIFT_FOUND');
 assert.equal(audit['public.twin_forecast_residual_projection_v1'],'NO_PATH_DRIFT_FOUND');
 const loader=fs.readFileSync(path.join(ROOT,LOADER),'utf8');
 for(const token of [
  'scenarioOptionCountReconciliationJson','applyScenarioProjectionReconciliationV1',
  'record_json.payload.payload.option_count','record_json.payload.payload.options.length',
  'sourceApplied !== 1 || comparisonApplied !== 1',
  'applyForecastProjectionReconciliationV1(applyGovernanceScopeReconciliationV1())',
 ]) assert.equal(loader.includes(token),true,`CAP07_SCENARIO_OPTION_COUNT_LOADER_TOKEN:${token}`);
 const forecastGate=fs.readFileSync(path.join(ROOT,FORECAST_GATE),'utf8');
 for(const token of ['ORIGINAL_EXACT_DELIVERY_BOUNDARY','SUCCESSOR_REGRESSION_GUARD','ORIGINAL_MERGE','CAP07_FORECAST_SUCCESSOR_PROTECTED_FILE_CHANGED','loader_successor_change_consumed']) {
  assert.equal(forecastGate.includes(token),true,`CAP07_SCENARIO_OPTION_COUNT_FORECAST_GATE_TOKEN:${token}`);
 }
 const all=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(all.includes(declarationMarker),false,'CAP07_SCENARIO_OPTION_COUNT_CANDIDATE_DECLARATION_FORBIDDEN');
 assert.equal(changed.some(file=>file.includes('/routes/')||file.includes('migration')||file.includes('scheduler')||file.includes('model_activation')),false,'CAP07_SCENARIO_OPTION_COUNT_FORBIDDEN_BOUNDARY');
 const result={
  schema_version:'geox_mcft_cap07_cap04_scenario_option_count_reconciliation_result_v1',
  status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:6,changed_files:changed,
  historical_matrix_blob:FROZEN[MATRIX],historical_matrix_mutation:false,affected_source_count:1,affected_comparison_count:1,
  effective_canonical_path:'record_json.payload.payload.options.length',comparison:'EXACT',path_reader_extension_reused:'TERMINAL_ARRAY_LENGTH_ONLY',
  forecast_successor_gate_enabled:true,audited_action_feedback_path_drift:false,audited_forecast_residual_path_drift:false,
  route_delta:0,database_schema_delta:0,runtime_write_authority_delta:0,candidate_declaration_present:false,
  s6_candidate_implemented:false,mcft_cap_08_complete:false,model_activation_authorized:false,mcft_cap_09_authorized:false,
 };
 write(result);console.log(JSON.stringify(result));
}catch(error){
 write({schema_version:'geox_mcft_cap07_cap04_scenario_option_count_reconciliation_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});
 console.error(error);process.exitCode=1;
}
