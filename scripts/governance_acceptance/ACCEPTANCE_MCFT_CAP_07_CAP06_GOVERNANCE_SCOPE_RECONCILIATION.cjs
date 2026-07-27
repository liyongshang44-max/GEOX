#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='8f9bcfd5b441317649dd7bcbbc28eec0a17f6bf4';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_07_CAP06_GOVERNANCE_SCOPE_RECONCILIATION_RESULT.json');
const MATRIX='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json';
const RECON='docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CAP06-GOVERNANCE-SCOPE-RECONCILIATION-V1.json';
const LOADER='apps/server/src/domain/field_twin_read_model/s4_source_obligations_v1.ts';
const HASH='apps/server/src/domain/twin_runtime/canonical_identity_v1.ts';
const READER='apps/server/src/repositories/field_twin_read_model/postgres_field_twin_read_repository_v1.ts';
const SELF='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP06_GOVERNANCE_SCOPE_RECONCILIATION.cjs';
const DB='scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_CAP06_GOVERNANCE_SCOPE_COMPATIBILITY_DB.ts';
const WORKFLOW='.github/workflows/mcft-cap-07-cap06-governance-scope-reconciliation.yml';
const EXPECTED=[RECON,LOADER,HASH,READER,SELF,DB,WORKFLOW];
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`)}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'CAP07_CAP06_SCOPE_RECONCILIATION_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'CAP07_CAP06_SCOPE_RECONCILIATION_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','CAP07_CAP06_SCOPE_RECONCILIATION_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'CAP07_CAP06_SCOPE_RECONCILIATION_BOUNDARY');
 assert.equal(changed.length,7);
 assert.equal(git('rev-parse',`HEAD:${MATRIX}`),'9bc4713357f3c89d1f6d799fd2502a4da7181b00','CAP07_SOURCE_MATRIX_MUTATED');
 const reconciliation=readJson(RECON);
 assert.equal(reconciliation.record_status,'NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION');
 assert.equal(reconciliation.base_matrix_blob,'9bc4713357f3c89d1f6d799fd2502a4da7181b00');
 assert.equal(reconciliation.base_matrix_mutated,false);
 assert.equal(reconciliation.affected_source_count,2);
 const expectedSources=['public.twin_calibration_candidate_projection_v1','public.twin_shadow_evaluation_projection_v1'];
 const priorHash='semanticHashV1(omitSemanticFieldsV1(canonical_object,[determinism_hash,fact_id,created_at,persisted_at]))';
 const effectiveHash='semanticHashV1(assign(structuredClone(canonical_object),{determinism_hash:""}))';
 assert.deepEqual(reconciliation.affected_sources.map(x=>x.source_name).sort(),expectedSources);
 for(const item of reconciliation.affected_sources){
  assert.equal(item.canonical_envelope_profile,'NON_LINEAGE_CONTEXT');
  assert.equal(item.prior_canonical_hash_function,priorHash);
  assert.equal(item.effective_canonical_hash_function,effectiveHash);
  for(const key of ['tenant_id','project_id','group_id','field_id','season_id','zone_id']){
   assert.equal(item.prior_scope_path[key],`record_json.payload.${key}`);
   assert.equal(item.effective_scope_path[key],`record_json.payload.scope.${key}`);
  }
 }
 assert.equal(reconciliation.required_invariants.exact_affected_source_count,2);
 assert.equal(reconciliation.required_invariants.base_matrix_blob_unchanged,true);
 assert.equal(reconciliation.required_invariants.canonical_hash_profile_reconciled,true);
 assert.equal(reconciliation.required_invariants.canonical_fact_rewrite,false);
 assert.equal(reconciliation.required_invariants.canonical_hash_rewrite,false);
 for(const [key,value] of Object.entries({candidate_declaration:false,candidate_signal_delta:0,runtime_write_authority_delta:0,database_schema_delta:0,canonical_data_delta:0,route_delta:0,production_runtime_source_authorized:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false})){
  assert.equal(reconciliation.delivery_classification[key],value,`CAP07_CAP06_SCOPE_RECONCILIATION_${key.toUpperCase()}`);
 }
 const loader=fs.readFileSync(path.join(ROOT,LOADER),'utf8');
 for(const token of [RECON.split('/').at(-1),'NON_CANDIDATE_SOURCE_CONTRACT_RECONCILIATION','record_json.payload.scope.','prior_canonical_hash_function','effective_canonical_hash_function','affected.length !== 2','applied !== 2','validateSourceValidationObligationMatrixV1'])assert.equal(loader.includes(token),true,`CAP07_SCOPE_LOADER_TOKEN:${token}`);
 const hash=fs.readFileSync(path.join(ROOT,HASH),'utf8');
 for(const token of ['CAP06_NON_LINEAGE_GOVERNANCE_OBJECT_TYPES_V1','twin_calibration_candidate_v1','twin_shadow_evaluation_v1','NON_LINEAGE_CONTEXT','CANONICAL_MODEL_GOVERNANCE_HISTORY','semantic.determinism_hash = ""','CAP06_NON_LINEAGE_GOVERNANCE_HASH_PROFILE_INVALID'])assert.equal(hash.includes(token),true,`CAP07_SCOPE_HASH_TOKEN:${token}`);
 const reader=fs.readFileSync(path.join(ROOT,READER),'utf8');
 for(const token of ['NON_LINEAGE_CONTEXT_SCOPE_TYPES_V1','twin_calibration_candidate_v1','twin_shadow_evaluation_v1','computeCap04AAggregateDeterminismHashV1','computeCap04AMemberDeterminismHashV1',"identity_kind IN ('A0_RECORD_SET','A1_RECORD_SET','A2_RECORD_SET')",'COALESCE(f.record_json->\'payload\'->\'scope\''])assert.equal(reader.includes(token),true,`CAP07_SCOPE_READER_TOKEN:${token}`);
 for(const sourceFile of [reader,hash])for(const forbidden of [/\bINSERT\s+INTO\b/i,/\bUPDATE\s+[a-z_]/i,/\bDELETE\s+FROM\b/i,/\bCREATE\s+(TABLE|FUNCTION|TRIGGER|ROLE)\b/i,/\bALTER\s+(TABLE|ROLE|DEFAULT)\b/i,/\bDROP\s+(TABLE|FUNCTION|ROLE)\b/i])assert.equal(forbidden.test(sourceFile),false,`CAP07_SCOPE_SOURCE_WRITE_FORBIDDEN:${forbidden}`);
 assert.equal(changed.some(file=>file.startsWith('db/')||file.includes('migration')||file.includes('/routes/')||file.includes('scheduler')),false);
 assert.equal(changed.some(file=>file.includes('MCFT-CANDIDATE-AUTHORITY-REGISTRY')||file.includes('DELIVERY-STATUS')||file.endsWith('GEOX-MCFT-CAP-08-TASK.md')),false);
 const source=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(source.includes(declarationMarker),false);
 const result={schema_version:'geox_mcft_cap07_cap06_governance_scope_reconciliation_result_v1',status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:7,changed_files:changed,historical_matrix_blob:'9bc4713357f3c89d1f6d799fd2502a4da7181b00',historical_matrix_unchanged:true,reconciled_source_count:2,reconciled_sources:expectedSources,reconciled_scope_profile:true,reconciled_canonical_hash_profile:true,canonical_fact_rewrite:false,canonical_hash_rewrite:false,candidate_declaration_present:false,runtime_write_authority_delta:0,database_schema_delta:0,canonical_data_delta:0,route_delta:0,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result));
}catch(error){write({schema_version:'geox_mcft_cap07_cap06_governance_scope_reconciliation_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
