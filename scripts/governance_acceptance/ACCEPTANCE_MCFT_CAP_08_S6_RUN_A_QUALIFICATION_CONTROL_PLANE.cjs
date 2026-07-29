#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08';
const B=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-CONTROL-PLANE-BOUNDARY-V1.json`;
const I=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-CONTROL-PLANE-IMPLEMENTATION-V1.json`;
const S=`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-SUBJECT-RECONCILIATION-V1.json`;
const Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_CONTROL_PLANE_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),text=p=>F.readFileSync(X.join(R,p),'utf8'),git=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
const canon=v=>Array.isArray(v)?`[${v.map(canon).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`:JSON.stringify(v);
function sd(v){const x=structuredClone(v);delete x.semantic_digest;return`sha256:${C.createHash('sha256').update(canon(x)).digest('hex')}`;}
function write(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n');}
try{
 const b=read(B),i=read(I),s=read(S),base=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim();
 A.equal(base,b.base_main_sha);A.equal(git('merge-base',base,'HEAD'),base);A.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 A.deepEqual(changed,[...b.changed_files].sort());A.equal(changed.length,9);
 for(const v of[b,i,s])A.equal(v.semantic_digest,sd(v),'SEMANTIC_DIGEST');
 A.equal(changed.some(f=>/^(apps|packages|db|migrations)\//.test(f)),false);
 const execution=text('.github/workflows/mcft-cap-08-s6-run-a-qualification-database-execution.yml');
 const focused=text('.github/workflows/mcft-cap-08-s6-run-a-qualification-control-plane.yml');
 const gate=text('scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_execution_authority_gate_v1.cjs');
 const entry=text('scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_workflow_entrypoint_v1.ts');
 const harness=text('scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification/qualification_harness_v1.cjs');
 A.match(execution,/workflow_dispatch:/);A.doesNotMatch(execution,/pull_request:/);A.match(execution,/authorize-before-database:/);A.match(execution,/execute-one-fresh-qualification-database:/);
 A.match(execution,/RUN_A/);A.doesNotMatch(execution,/RUN_B/);A.match(execution,/qualification_workflow_entrypoint_v1\.ts/);A.doesNotMatch(execution,/mcft_cap08_s6_single_run_workflow\/workflow_entrypoint_v1\.ts/);
 A.match(focused,/pull_request:/);A.doesNotMatch(focused,/services:\s*\n\s*postgres:/);A.doesNotMatch(focused,/workflow_dispatch:/);
 for(const f of b.changed_files.filter(f=>f.endsWith('.cjs')))P.execFileSync(process.execPath,['--check',f],{cwd:R,stdio:'pipe'});
 A.match(gate,/SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED/);A.match(gate,/DEVELOPMENT_QUALIFICATION_ONLY/);A.match(gate,/final_closure_eligible,false/);A.match(gate,/hard_acceptance_eligible,false/);
 A.match(entry,/qualification_execution_authority_gate_v1/);A.match(entry,/qualification_harness_v1/);A.match(entry,/QUALIFICATION_PORT_BUNDLE_BLOB_DRIFT/);
 A.match(harness,/canonical_receipt_count:153/);A.match(harness,/recovery_vector_count:7/);A.match(harness,/cap07_surface_count:10/);A.match(harness,/ha_witness_count:0/);
 A.match(harness,/final_closure_source_generated:false/);A.match(harness,/hard_acceptance_eligible:false/);A.match(harness,/fs\.rmSync\(probePath\)/);
 A.doesNotMatch(harness,/buildFinalClosureDatabaseSourceV1/);A.doesNotMatch(harness,/producePerRunWitnessBundleV1/);A.doesNotMatch(harness,/invokePerRunWitnessesV1/);
 A.equal(s.reconciled_subject_contract.effective_port_bundle_blob_sha,'2f574588ba3010a94e64f965bb17fc97b3b33c72');A.equal(s.reconciled_subject_contract.qualification_execution_subject_may_be_descendant_of_effective_port_bundle_merge,true);
 A.equal(i.record_status,'IMPLEMENTED_NOT_EFFECTIVE');A.equal(i.execution_constraints.database_execution_performed,false);
 const result={schema_version:'geox_mcft_cap08_s6_run_a_qualification_control_plane_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:9,execution_workflow_trigger:'WORKFLOW_DISPATCH_ONLY',pull_request_database_execution:false,run_label:'RUN_A',evidence_class:'DEVELOPMENT_QUALIFICATION_ONLY',canonical_receipt_count:153,recovery_vector_count:7,cap07_surface_count:10,ha_witness_count:0,hard_acceptance_eligible:false,final_closure_source_generated:false,database_execution_performed:false,actual_execution_authority_present:false,run_a_executed:false,run_b_executed:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result,null,2));
}catch(e){write({schema_version:'geox_mcft_cap08_s6_run_a_qualification_control_plane_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1;}
