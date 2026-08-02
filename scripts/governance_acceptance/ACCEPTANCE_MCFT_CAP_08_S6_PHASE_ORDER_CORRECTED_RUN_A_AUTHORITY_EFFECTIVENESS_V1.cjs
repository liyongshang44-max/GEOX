#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const BASE='156e74208be3d8b57618ccca1fa0b281b19a10d7';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_PHASE_ORDER_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_RESULT.json');
const CANDIDATE='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json';
const EFFECTIVE='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const OBJECTS='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json';
const SETTLEMENT='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-08-s6-phase-order-corrected-run-a-authority-effectiveness.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PHASE_ORDER_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_V1.cjs';
const CHANGED=[WORKFLOW,EFFECTIVE,SETTLEMENT,BOUNDARY,VALIDATOR].sort();
const OP='MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-008',DBID='MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-008',SUBJECT='0186ce5f3ae82724886ea633a29f58791449ddec';
const PHASE_ORDER=['resolve','E','H','A','B','G','C','barrier'];
function git(...a){return execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim()}
function text(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
function json(p){return JSON.parse(text(p))}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function semantic(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`}
function save(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE);assert.equal(git('merge-base',base,'HEAD'),base);assert.equal(git('rev-list','--count',`${base}..HEAD`),'1');assert.equal(git('diff','--check',`${base}...HEAD`),'');assert.deepEqual(git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),CHANGED);
 const c=json(CANDIDATE),e=json(EFFECTIVE),o=json(OBJECTS),s=json(SETTLEMENT),b=json(BOUNDARY);for(const v of [c,e,o,s,b])assert.equal(v.semantic_digest,semantic(v));
 assert.equal(git('rev-parse',`HEAD:${CANDIDATE}`),'a2cce3e339e1c12dda069dad5d4f801df9c1bca8');assert.equal(git('rev-parse',`HEAD:${OBJECTS}`),'53a096f7ab41ce236a3896750fe08d4b81a13e09');assert.equal(git('rev-parse',`HEAD:${EFFECTIVE}`),'bfaa04843c60c36c85261c84a485053972cf5705');
 assert.equal(c.record_status,'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');assert.equal(c.exact_subject_sha,SUBJECT);assert.equal(c.operational_run_instance_id,OP);
 assert.equal(e.record_status,'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED');assert.equal(e.exact_subject_sha,SUBJECT);assert.equal(e.operational_run_instance_id,OP);assert.equal(e.logical_database_identity.identity_id,DBID);assert.equal(e.candidate_head_sha,'b027daa82b459153968d549cf5754cb6a5014a27');assert.equal(e.candidate_merge_sha,BASE);assert.equal(e.candidate_authority_ref.blob_sha,'a2cce3e339e1c12dda069dad5d4f801df9c1bca8');assert.equal(e.candidate_authority_ref.preserved_semantic_digest,c.semantic_digest);assert.equal(e.object_set_manifest_ref.blob_sha,'53a096f7ab41ce236a3896750fe08d4b81a13e09');assert.equal(e.single_use_contract.max_dispatch_count,1);assert.equal(e.single_use_contract.rerun_authorized,false);assert.equal(e.sequence_contract.run_b_remains_blocked,true);assert.deepEqual(e.correction_provenance.required_phase_order,PHASE_ORDER);assert.equal(e.correction_provenance.operational_event_count,224);
 assert.equal(o.object_count,54);const sets=[o.exact_control_plane_object_set,o.exact_database_bootstrap_object_set,o.exact_product_object_set,o.exact_port_bundle_object_set,o.exact_harness_object_set,o.protected_invariant_object_set];assert.equal(sets.reduce((n,x)=>n+Object.keys(x).length,0),54);for(const set of sets)for(const [p,sha] of Object.entries(set))assert.equal(git('rev-parse',`HEAD:${p}`),sha,`OBJECT_BLOB:${p}`);
 process.env.MCFT_LOCAL_REPLAY='1';const {loadSingleRunHarnessContractsV1}=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs'));const {buildSingleRunExecutionSpecV1}=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs'));const {buildOperationalEventsV1}=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs'));const spec=buildSingleRunExecutionSpecV1({contracts:loadSingleRunHarnessContractsV1({localReplay:true}),runLabel:'RUN_A',operationalRunInstanceId:OP,exactSubjectSha:SUBJECT});assert.equal(spec.phase_count,28);assert.equal(buildOperationalEventsV1({spec}).length,224);
 const gate=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs'));assert.throws(()=>gate.validateExecutionAuthorityV1(c,{exactSubjectSha:SUBJECT,runLabel:'RUN_A',operationalRunInstanceId:OP}));gate.validateExecutionAuthorityV1(e,{exactSubjectSha:SUBJECT,runLabel:'RUN_A',operationalRunInstanceId:OP});const identity=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs'));assert.equal(identity.materializePhysicalDatabaseNameV1(e,'30790000008'),'geox_mcft_cap08_s6_run_a_replacement_008_30790000008');
 assert.equal(s.next_legal_action_after_merge,'DISPATCH_PHASE_ORDER_CORRECTED_FORMAL_RUN_A_ONCE');assert.equal(b.changed_file_count,5);assert.deepEqual([...b.changed_files].sort(),CHANGED);assert.equal(b.database_execution_performed,false);assert.equal(b.workflow_dispatch_performed,false);assert.doesNotMatch(text(WORKFLOW),/workflow_dispatch:|postgres:|psql|DATABASE_URL/i);
 const result={schema_version:'geox_mcft_cap08_s6_phase_order_corrected_run_a_authority_effectiveness_result_v1',status:'PASS',base_main_sha:BASE,exact_head_sha:git('rev-parse','HEAD'),candidate_to_merge_file_delta:0,object_count:54,operational_run_instance_id:OP,logical_database_identity:DBID,production_gate_eligible:true,phase_order_transport_preflight:'PASS',operational_event_count:224,database_execution_performed:false,workflow_dispatch_performed:false,run_b_dispatch_authorized:false};save(result);console.log(JSON.stringify(result,null,2));
}catch(error){save({schema_version:'geox_mcft_cap08_s6_phase_order_corrected_run_a_authority_effectiveness_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
