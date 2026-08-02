#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const BASE='7faa047da78e3a227a18bea62bcd40d870469b2f';
const CANDIDATE_HEAD='3f353ee44e4d0db73b10b703eac0a1070516eba3';
const SUBJECT='93eb19f74faed372908764e5e3d2410a2ff50b45';
const NEW_ID='MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-001';
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_PREHARNESS_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_RESULT.json');
const P={
 workflow:'.github/workflows/mcft-cap-08-s6-preharness-corrected-run-a-authority-effectiveness.yml',
 effective:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
 settlement:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-V1.json',
 boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json',
 validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PREHARNESS_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_V1.cjs',
 candidate:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json',
 manifest:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json',
 retiredRunA:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
 retiredRunB:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-B-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
 gate:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs'
};
const FILES=[P.workflow,P.effective,P.settlement,P.boundary,P.validator].sort();
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const j=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function digest(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`}
function out(v){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(v,null,2)+'\n')}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE);assert.equal(git('merge-base',base,'HEAD'),base);assert.equal(git('diff','--check',`${base}...HEAD`),'');
 assert.equal(git('diff','--name-only',`${CANDIDATE_HEAD}...${BASE}`),'','CANDIDATE_TO_MERGE_FILE_DELTA');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed,FILES);
 const e=j(P.effective),s=j(P.settlement),b=j(P.boundary),c=j(P.candidate),m=j(P.manifest),ra=j(P.retiredRunA),rb=j(P.retiredRunB);
 assert.equal(git('rev-parse',`HEAD:${P.candidate}`),'81bc764a3c1ee1e1b63564f8c220dafc8509d34c');
 assert.equal(git('rev-parse',`HEAD:${P.manifest}`),'88b70f6153111e2975c4366be6e36d4def1c600b');
 assert.equal(git('rev-parse',`HEAD:${P.retiredRunA}`),'712fc4b59c870f9b7e243c21b29c2eac24d8b9e3');
 assert.equal(git('rev-parse',`HEAD:${P.retiredRunB}`),'8cbb319aa24c919cddb5a82f62c3fcdcb41e050f');
 assert.equal(c.record_status,'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
 assert.equal(c.semantic_digest,'sha256:5a6ecd7a755772d51ba040a5090a996872b5f5f326f017dc4c41a80f92b2334d');
 assert.equal(m.exact_subject_sha,SUBJECT);assert.equal(m.semantic_digest,'sha256:0a7e1dfdbb306a1a9f606be75789f54a32d382264d2efb0f932d903b149e5790');
 assert.equal(ra.authority_consumed,true);assert.equal(ra.single_run_database_execution_authorized,false);
 assert.equal(rb.record_status,'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_RETIRED_OBSOLETE_SUBJECT');assert.equal(rb.workflow_dispatch_execution_authorized,false);
 assert.equal(e.record_status,'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED');
 assert.equal(e.exact_subject_sha,SUBJECT);assert.equal(e.authorized_run_label,'RUN_A');assert.equal(e.operational_run_instance_id,NEW_ID);
 assert.equal(e.logical_database_identity.identity_id,'MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-001');
 assert.equal(e.candidate_authority_ref.blob_sha,'81bc764a3c1ee1e1b63564f8c220dafc8509d34c');
 assert.equal(e.candidate_authority_ref.preserved_semantic_digest,c.semantic_digest);
 assert.equal(e.candidate_merge_sha,BASE);assert.equal(e.object_set_manifest_ref.blob_sha,'88b70f6153111e2975c4366be6e36d4def1c600b');
 assert.equal(e.single_run_database_execution_authorized,true);assert.equal(e.database_execution_workflow_authorized,true);
 assert.equal(e.workflow_dispatch_execution_authorized,true);assert.equal(e.final_formal_run_execution_authorized,true);
 assert.equal(e.dual_run_ci_authorized,false);assert.equal(e.cross_run_comparator_authorized,false);assert.equal(e.final_ledger_settlement_authorized,false);
 assert.equal(e.database_execution_performed,false);assert.equal(e.workflow_dispatch_performed,false);assert.equal(e.formal_run_executed,false);
 assert.equal(e.semantic_digest,digest(e));
 const {validateExecutionAuthorityV1}=require(path.join(ROOT,P.gate));
 const accepted=validateExecutionAuthorityV1(e,{exactSubjectSha:SUBJECT,runLabel:'RUN_A',operationalRunInstanceId:NEW_ID});
 assert.equal(accepted.module_path,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs');
 assert.throws(()=>validateExecutionAuthorityV1(c,{exactSubjectSha:SUBJECT,runLabel:'RUN_A',operationalRunInstanceId:NEW_ID}),/record_status|Expected values/);
 assert.equal(s.base_main_sha,BASE);assert.equal(s.candidate_to_merge_file_delta,0);assert.equal(s.effective_authority.blob_sha,'82be6bdd511f118e5a6e3ad0b5c2fa5024c9a9bc');
 assert.equal(s.effective_authority.runtime_gate_eligible_after_merge,true);assert.equal(s.effect.max_dispatch_count,1);
 assert.equal(s.effect.rerun_authorized,false);assert.equal(s.effect.run_b_dispatch_authorized,false);
 assert.equal(s.effect.database_execution_performed_in_effectiveness_pr,false);assert.equal(s.effect.workflow_dispatch_performed_in_effectiveness_pr,false);
 assert.equal(s.semantic_digest,digest(s));
 assert.equal(b.base_main_sha,BASE);assert.equal(b.changed_file_count,5);assert.deepEqual([...b.changed_files].sort(),FILES);
 assert.equal(b.database_execution_performed,false);assert.equal(b.workflow_dispatch_performed,false);assert.equal(b.run_b_dispatch_authorized,false);assert.equal(b.semantic_digest,digest(b));
 const wf=fs.readFileSync(path.join(ROOT,P.workflow),'utf8');assert.doesNotMatch(wf,/workflow_dispatch:|postgres|psql|DATABASE_URL/i);
 assert.equal(changed.some(p=>p.startsWith('apps/server/')||p.startsWith('apps/web/')||p.startsWith('scripts/runtime_acceptance/')||/migration/i.test(p)),false);
 const result={schema_version:'geox_mcft_cap08_s6_preharness_corrected_run_a_authority_effectiveness_result_v1',status:'PASS',base_main_sha:base,exact_head_sha:git('rev-parse','HEAD'),candidate_to_merge_file_delta:0,corrected_subject_sha:SUBJECT,operational_run_instance_id:NEW_ID,runtime_gate_eligible_after_merge:true,production_gate_accepts_effective_authority:true,production_gate_rejects_candidate:true,old_run_a_authority_consumed:true,old_run_b_authority_retired:true,run_b_dispatch_authorized:false,max_dispatch_count:1,rerun_authorized:false,database_execution_performed:false,workflow_dispatch_performed:false,formal_run_result_present:false,cross_run_comparator_authorized:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};out(result);console.log(JSON.stringify(result,null,2))
}catch(error){out({schema_version:'geox_mcft_cap08_s6_preharness_corrected_run_a_authority_effectiveness_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});throw error}
