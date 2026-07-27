#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='242d027101574512decdfa1ee3647b557d2fd858';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_DEVELOPMENT_BOUNDARY_RESULT.json');
const EXPECTED=[
 '.github/workflows/mcft-cap-08-s6-development-preflight.yml',
 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_DEVELOPMENT_BOUNDARY.cjs',
 'scripts/governance_acceptance/mcft_cap08_s6_two_run_compare.cjs',
 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FINAL_RUN_RECOVERY_DB.ts',
 'scripts/runtime_acceptance/mcft_cap08_s6_existing_recovery_support_v1.ts',
];
const FROZEN={
 taskbook:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md','a24114ff629560345b3bd3cda6b4024b9f3d61e4'],
 contract:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json','9cecc1aa6bd4063b770304f2539bc68a1ed2390c'],
 review:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REVIEW-POLICY-V1.json','7a2ed8aac94c86c186f4491c5845320bd8b8ad3c'],
 status:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json','d8128c4ec0c68c86b10578a6e0d5544a66a87a38'],
 predecessor:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREDECESSOR-CONSUMPTION-V1.json','bb199f705b08eca9a152d1d91faeb8cc11658b38'],
 frontier:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json','385433f57a4393596166c124db7b08a2489b238f'],
 registry:['docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','268844d3e690e5241c94b6453999d9454db6a967'],
};
const TRUSTED={
 read_repository:['apps/server/src/repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.ts','655ed7341d4acd6c34383bdb174efefabc55ce73'],
 exact_resolvers:['apps/server/src/domain/field_twin_read_model/exact_resolvers_v1.ts','375207a205a668d33afaa1fb03618ff1cd36078b'],
 source_obligations:['apps/server/src/domain/field_twin_read_model/s4_source_obligations_v1.ts','6d7623aaa67658b2bbe50db6c98b0453837c8cc9'],
 forecast_reconciliation:['docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP04-FORECAST-POINT-COUNT-RECONCILIATION-V1.json','2c976d8ccc67541e957d2492ba18b76de863dd19'],
};
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`)}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'S6_DEV_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'S6_DEV_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','S6_DEV_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'S6_DEV_BOUNDARY');
 assert.equal(changed.length,5,'S6_DEV_CHANGED_FILE_COUNT');
 for(const [name,[file,sha]] of Object.entries(FROZEN)){
  assert.equal(git('rev-parse',`HEAD:${file}`),sha,`S6_DEV_FROZEN_${name.toUpperCase()}`);
  assert.equal(git('rev-parse',`${base}:${file}`),sha,`S6_DEV_BASE_FROZEN_${name.toUpperCase()}`);
 }
 for(const [name,[file,sha]] of Object.entries(TRUSTED)){
  assert.equal(git('rev-parse',`HEAD:${file}`),sha,`S6_DEV_TRUSTED_${name.toUpperCase()}_HEAD`);
  assert.equal(git('rev-parse',`${base}:${file}`),sha,`S6_DEV_TRUSTED_${name.toUpperCase()}_BASE`);
  assert.equal(changed.includes(file),false,`S6_DEV_TRUSTED_${name.toUpperCase()}_MUST_COME_FROM_MAIN`);
 }
 const readRepository=fs.readFileSync(path.join(ROOT,TRUSTED.read_repository[0]),'utf8');
 for(const token of ['A1_RECORD_SET','computeCap04AAggregateDeterminismHashV1','NON_LINEAGE_CONTEXT_SCOPE_TYPES_V1']){
  assert.equal(readRepository.includes(token),true,`S6_DEV_READ_REPOSITORY_TOKEN_${token}`);
 }
 const exactResolvers=fs.readFileSync(path.join(ROOT,TRUSTED.exact_resolvers[0]),'utf8');
 for(const token of ['Array.isArray(current)','token === "length" && index === tokens.length - 1','current.length : undefined']){
  assert.equal(exactResolvers.includes(token),true,`S6_DEV_EXACT_RESOLVER_TOKEN_${token}`);
 }
 const obligations=fs.readFileSync(path.join(ROOT,TRUSTED.source_obligations[0]),'utf8');
 for(const token of ['applyForecastProjectionReconciliationV1','record_json.payload.payload.status','record_json.payload.payload.points.length','comparisonApplied !== 2']){
  assert.equal(obligations.includes(token),true,`S6_DEV_SOURCE_OBLIGATION_TOKEN_${token}`);
 }
 const forecastReconciliation=JSON.parse(fs.readFileSync(path.join(ROOT,TRUSTED.forecast_reconciliation[0]),'utf8'));
 assert.equal(forecastReconciliation.record_status,'NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION');
 assert.equal(forecastReconciliation.affected_source_count,1);
 assert.equal(forecastReconciliation.affected_comparison_count,2);
 assert.equal(forecastReconciliation.nonclaims.s6_candidate_implemented,false);
 assert.equal(forecastReconciliation.nonclaims.mcft_cap_08_complete,false);
 const source=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 for(const token of ['RUN_A','RUN_B','hard_acceptance_item_count','operator_surface_count','semantic_digest','operational_invariant_digest','closure_digest','product_read_write_delta']){
  assert.equal(source.includes(token),true,`S6_DEV_TOKEN_${token}`);
 }
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(source.includes(declarationMarker),false,'S6_DEV_CANDIDATE_DECLARATION_FORBIDDEN');
 assert.equal(changed.filter(file=>file.startsWith('apps/')).length,0,'S6_DEV_APPS_FILE_COUNT');
 assert.equal(changed.some(file=>file.startsWith('db/')||file.includes('migration')||file.includes('/routes/')||file.includes('scheduler')||file.includes('model_activation')),false,'S6_DEV_FORBIDDEN_BOUNDARY');
 const result={
  schema_version:'geox_mcft_cap08_s6_development_boundary_result_v3',
  status:'PASS',
  base_sha:base,
  subject_sha:git('rev-parse','HEAD'),
  changed_file_count:5,
  changed_files:changed,
  trusted_main_blobs:Object.fromEntries(Object.entries(TRUSTED).map(([name,[file,sha]])=>[name,{file,sha}])),
  cap07_forecast_projection_reconciliation_consumed_from_main:true,
  cap07_nested_scope_hash_and_a1_membership_consumed_from_main:true,
  runtime_source_delta:0,
  read_model_source_delta:0,
  database_schema_delta:0,
  route_delta:0,
  two_fresh_runs_required:true,
  hard_acceptance_item_count:24,
  cap07_get_surface_count:10,
  independent_review_required_for_formal_candidate:true,
  candidate_declaration_present:false,
  s6_candidate_implemented:false,
  mcft_cap_08_complete:false,
  production_runtime_source_authorized:false,
  model_activation_authorized:false,
  mcft_cap_09_authorized:false,
 };
 write(result);console.log(JSON.stringify(result));
}catch(error){
 write({schema_version:'geox_mcft_cap08_s6_development_boundary_result_v3',status:'FAIL',error:error instanceof Error?error.message:String(error)});
 console.error(error);process.exitCode=1;
}
