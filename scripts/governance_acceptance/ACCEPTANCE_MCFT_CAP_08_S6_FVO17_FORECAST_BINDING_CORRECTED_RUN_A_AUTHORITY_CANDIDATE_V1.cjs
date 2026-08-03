#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const BASE='89517a1b3ff61a1a1ba3259ef4e04001d6e1fee8';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_FVO17_FORECAST_BINDING_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_RESULT.json');
const CANDIDATE='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json';
const OBJECTS='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json';
const ISSUANCE='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-RUN-A-AUTHORITY-ISSUANCE-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-RUN-A-AUTHORITY-BOUNDARY-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-08-s6-fvo17-forecast-binding-corrected-run-a-authority-candidate.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FVO17_FORECAST_BINDING_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_V1.cjs';
const CONSUMED='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const PRODUCT_CHAIN='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs';
const CLOSURE_READER='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs';
const CHANGED=[WORKFLOW,CANDIDATE,ISSUANCE,BOUNDARY,OBJECTS,VALIDATOR].sort();
const OP='MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-010',DBID='MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-010',DBNAME='geox_mcft_cap08_s6_run_a_replacement_010_30790000010';
function git(...a){return execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim()}
function text(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
function json(p){return JSON.parse(text(p))}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function semantic(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`}
function save(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')}
function effective(c){const a=structuredClone(c);a.record_status='SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED';a.evidence_class='FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS';a.expires_at='2099-08-06T03:50:00.000Z';for(const k of ['authority_effective','single_run_database_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized','final_formal_run_execution_authorized','hard_acceptance_eligible','s6_candidate_evidence_eligible'])a.authorization_state[k]=true;Object.assign(a,{single_run_database_execution_authorized:true,database_execution_workflow_authorized:true,workflow_dispatch_execution_authorized:true,final_formal_run_execution_authorized:true,dual_run_ci_authorized:false,cross_run_comparator_authorized:false,final_ledger_settlement_authorized:false});return a}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();assert.equal(base,BASE);assert.equal(git('merge-base',base,'HEAD'),base);assert.equal(git('rev-list','--count',`${base}..HEAD`),'1');assert.equal(git('diff','--check',`${base}...HEAD`),'');assert.deepEqual(git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),CHANGED);
 const c=json(CANDIDATE),o=json(OBJECTS),i=json(ISSUANCE),b=json(BOUNDARY),consumed=json(CONSUMED);for(const v of [c,o,i,b])assert.equal(v.semantic_digest,semantic(v));
 assert.equal(git('rev-parse',`HEAD:${CANDIDATE}`),'3873a9c3b7a64a63287d24fec17e587d01a96eb5');assert.equal(git('rev-parse',`HEAD:${OBJECTS}`),'cbeae03ad6118c8f8138df18b7260e5d20cdbb3e');assert.equal(git('rev-parse',`HEAD:${CONSUMED}`),'c8e718ffb4c75af47287b45fbc682d2494081fc1');
 assert.equal(consumed.authority_consumed,true);assert.equal(consumed.consumption_evidence.github_workflow_run_id,30781414909);assert.equal(consumed.single_use_contract.rerun_authorized,false);assert.equal(consumed.replacement_authority_issued,false);
 assert.equal(c.record_status,'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');assert.equal(c.exact_subject_sha,BASE);assert.equal(c.operational_run_instance_id,OP);assert.equal(c.logical_database_identity.identity_id,DBID);assert.equal(c.logical_database_identity.physical_name_template,'geox_mcft_cap08_s6_run_a_replacement_010_<github_run_id>');assert.ok(Object.values(c.authorization_state).every(v=>v===false));assert.equal(c.sequence_contract.run_b_remains_blocked,true);assert.equal(c.replaces_consumed_authority.failed_workflow_run_id,30781414909);
 assert.equal(o.object_count,54);assert.equal(o.exact_subject_sha,BASE);assert.equal(o.exact_port_bundle_object_set[PRODUCT_CHAIN],'de12666d4d5bebeac9b57f07d663a0f0f2dc4de1');assert.equal(o.exact_port_bundle_object_set[CLOSURE_READER],'cdee98e8b7bbd4a1d5ba45361978d5803873b610');const sets=[o.exact_control_plane_object_set,o.exact_database_bootstrap_object_set,o.exact_product_object_set,o.exact_port_bundle_object_set,o.exact_harness_object_set,o.protected_invariant_object_set];assert.equal(sets.reduce((n,x)=>n+Object.keys(x).length,0),54);for(const set of sets)for(const [p,sha] of Object.entries(set))assert.equal(git('rev-parse',`HEAD:${p}`),sha,`OBJECT_BLOB:${p}`);
 const source=text(PRODUCT_CHAIN);assert.match(source,/const residualForecast=order===17\?s4\.corrected_set\.forecast:observationSourceForecast;/);assert.match(source,/forecast:residualForecast,/);assert.equal((source.match(/forecast:residualForecast,/g)||[]).length,1);assert.doesNotMatch(source,/forecast:observationSourceForecast,/);
 assert.equal(i.identity.operational_run_instance_id,OP);assert.equal(i.activation.database_execution_authorized,false);assert.equal(i.activation.run_b_dispatch_authorized,false);assert.equal(b.changed_file_count,6);assert.deepEqual([...b.changed_files].sort(),CHANGED);assert.equal(b.object_set_count,54);assert.equal(b.candidate_runtime_gate_eligible,false);
 const gate=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs'));assert.throws(()=>gate.validateExecutionAuthorityV1(c,{exactSubjectSha:BASE,runLabel:'RUN_A',operationalRunInstanceId:OP}));gate.validateExecutionAuthorityV1(effective(c),{exactSubjectSha:BASE,runLabel:'RUN_A',operationalRunInstanceId:OP});
 const identity=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs'));assert.equal(identity.materializePhysicalDatabaseNameV1(effective(c),'30790000010'),DBNAME);
 const workflow=text(WORKFLOW);assert.doesNotMatch(workflow,/workflow_dispatch:|postgres:|psql|DATABASE_URL/i);assert.match(workflow,/54-object set/);
 const result={schema_version:'geox_mcft_cap08_s6_fvo17_forecast_binding_corrected_run_a_authority_candidate_result_v1',status:'PASS',base_main_sha:BASE,exact_head_sha:git('rev-parse','HEAD'),object_count:54,operational_run_instance_id:OP,logical_database_identity:DBID,candidate_runtime_gate_eligible:false,product_chain_blob_sha:'de12666d4d5bebeac9b57f07d663a0f0f2dc4de1',closure_reader_blob_sha:'cdee98e8b7bbd4a1d5ba45361978d5803873b610',fvo17_forecast_binding_preflight:'PASS',authority_bound_database_identity_preflight:'PASS',database_execution_performed:false,workflow_dispatch_performed:false,run_b_dispatch_authorized:false};save(result);console.log(JSON.stringify(result,null,2));
}catch(error){save({schema_version:'geox_mcft_cap08_s6_fvo17_forecast_binding_corrected_run_a_authority_candidate_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
