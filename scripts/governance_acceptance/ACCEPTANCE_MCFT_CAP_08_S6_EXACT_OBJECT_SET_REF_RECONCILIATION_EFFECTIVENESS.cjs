#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),O=require('node:os'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08',B=`${D}/GEOX-MCFT-CAP-08-S6-EXACT-OBJECT-SET-REF-RECONCILIATION-EFFECTIVENESS-BOUNDARY-V1.json`,E=`${D}/GEOX-MCFT-CAP-08-S6-EXACT-OBJECT-SET-REF-RECONCILIATION-EFFECTIVENESS-AUTHORITY-V1.json`,N=`${D}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-POST-RECONCILIATION-AUTHORITY-V1.json`,Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_EXACT_OBJECT_SET_REF_RECONCILIATION_EFFECTIVENESS_RESULT.json');
const r=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8')),g=(...a)=>P.execFileSync('git',a,{cwd:R,encoding:'utf8'}).trim();
function c(v){if(Array.isArray(v))return`[${v.map(c).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${c(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function d(v){v=structuredClone(v);delete v.semantic_digest;return`sha256:${C.createHash('sha256').update(c(v)).digest('hex')}`}
function w(v){F.mkdirSync(X.dirname(Q),{recursive:true});F.writeFileSync(Q,JSON.stringify(v,null,2)+'\n')}
try{
 const b=r(B),e=r(E),n=r(N),z=String(process.env.MCFT_BASE_SHA||b.base_main_sha).trim(),s=e.implementation_subject;
 A.equal(z,b.base_main_sha);A.equal(g('merge-base',z,'HEAD'),z);A.equal(g('diff','--check',`${z}...HEAD`),'');
 const h=g('diff','--name-only',`${z}...HEAD`).split(/\r?\n/).filter(Boolean).sort();A.deepEqual(h,[...b.changed_files].sort());A.equal(h.length,5);
 A.equal(h.some(f=>/^(apps|packages|db|migrations|scripts\/runtime_acceptance)\//.test(f)),false);
 for(const v of[b,e,n])A.equal(v.semantic_digest,d(v));
 A.equal(e.record_status,'EXACT_OBJECT_SET_REF_RECONCILIATION_EFFECTIVE');A.equal(n.record_status,'EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION_CONTINUATION_AUTHORIZED');
 A.equal(g('diff','--name-only',s.candidate_head_sha,s.merge_commit_sha),'');A.equal(g('rev-parse',`${s.candidate_head_sha}^{tree}`),s.candidate_tree_sha);A.equal(g('rev-parse',`${s.merge_commit_sha}^{tree}`),s.merge_tree_sha);A.equal(s.candidate_tree_sha,s.merge_tree_sha);
 const m=[
 ['.github/workflows/mcft-cap-08-s6-final-formal-run-orchestrator.yml','30c3036283b477009a9584928eb211c7fa4f1dbf'],
 ['.github/workflows/mcft-cap-08-s6-witness-producers.yml','5862fffffae90c598e407d94cd56d0cfbc9da2f1'],
 [`${D}/GEOX-MCFT-CAP-08-S6-EXACT-OBJECT-SET-REF-RECONCILIATION-AUTHORITY-V1.json`,'e0ef10a304c3a28d4cd8fd6785da73edb9be3e7e'],
 [`${D}/GEOX-MCFT-CAP-08-S6-EXACT-OBJECT-SET-REF-RECONCILIATION-BOUNDARY-V1.json`,'266a0ae387da27b8affa8e6aa840ed1e58991c7f'],
 [`${D}/GEOX-MCFT-CAP-08-S6-EXACT-OBJECT-SET-REF-RECONCILIATION-IMPLEMENTATION-V1.json`,'0027d2fa71892e89123d393504a21d8d6da47359'],
 ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_EXACT_OBJECT_SET_REF_RECONCILIATION.cjs','e08dce05d91531795a453452e445209bdadc2608'],
 ['scripts/governance_acceptance/mcft_cap08_s6_witness/synthetic_fixture_v1.cjs','154141ebf75935fb073b653cdb860601008d110e'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_final_formal_run/object_set_v1.cjs','ae91cfe88b893aecb9c220f4fb1e83d25af856c6'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_final_formal_run/synthetic_adapter_v1.cjs','8a9209e4b340dc4d9c67125c80d857e37e74eab1']];
 for(const [p,x]of m)A.equal(g('rev-parse',`${s.merge_commit_sha}:${p}`),x,`BLOB:${p}`);
 A.equal(g('rev-parse',`${s.merge_commit_sha}:${D}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-IMPLEMENTATION-AUTHORITY-V1.json`),e.authority_consumed.prior_port_bundle_implementation_authority_blob);
 const v=e.exact_head_evidence;
 A.deepEqual([v.orchestrator_workflow_run_id,v.orchestrator_artifact_id,v.orchestrator_artifact_digest],[30361312307,8688904692,'sha256:da75229e0d645ced76c7891d6fcf45dd2478bf682c698a34acb143ed9db50edc']);
 A.deepEqual([v.witness_workflow_run_id,v.witness_artifact_id,v.witness_artifact_digest],[30361312287,8688905417,'sha256:23c3bcfd6a49664931013518a0f10e8e6f719375ac89e76db613a10726db75c3']);
 A.deepEqual([v.standard_ci_run_id,v.standard_ci_status,v.required_workflow_count,v.required_workflow_success_count],[30361312313,'PASS',9,9]);
 const t=F.mkdtempSync(X.join(O.tmpdir(),'mcft08-ref-'));let y;
 try{P.execFileSync('git',['worktree','add','--detach',t,s.merge_commit_sha],{cwd:R,stdio:'pipe'});P.execFileSync('node',['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_EXACT_OBJECT_SET_REF_RECONCILIATION.cjs'],{cwd:t,env:{...process.env,MCFT_BASE_SHA:'c767416f576c2587a1e7513fb30312c9ce5719b4'},stdio:'pipe'});y=JSON.parse(F.readFileSync(X.join(t,'acceptance-output/MCFT_CAP_08_S6_EXACT_OBJECT_SET_REF_RECONCILIATION_RESULT.json'),'utf8'))}
 finally{try{P.execFileSync('git',['worktree','remove','--force',t],{cwd:R,stdio:'pipe'})}catch{}F.rmSync(t,{recursive:true,force:true})}
 A.deepEqual([y.status,y.changed_file_count,y.closure_member_count,y.exact_ref_selector_classes,y.successor_workflow_classifier_count,y.synthetic_orchestrator_regression,y.synthetic_witness_producer_regression,y.logical_alias_as_canonical_ref_count,y.database_execution,y.run_a_executed,y.run_b_executed],['PASS',9,153,4,2,'PASS','PASS',0,false,false,false]);
 const u=e.verified_result;A.deepEqual([u.closure_member_count,u.ledger_item_count,u.proof_contract_count,u.producer_count,u.synthetic_per_run_witness_count,u.handwritten_ha_id_count,u.handwritten_requirement_count,u.logical_alias_as_canonical_ref_count],[153,24,25,19,44,0,0,0]);
 A.equal(e.effect.exact_object_set_ref_reconciliation_effective,true);A.equal(e.effect.exact_database_port_bundle_implementation_may_resume,true);A.equal(e.effect.real_database_port_bundle_implemented,false);A.equal(n.prior_authority.blob_sha,'28de23fabb79a10eebc698ad8fd69449f5e0b929');
 for(const k of['single_run_database_execution_authorized','run_a_execution_authorized','run_b_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized','dual_run_ci_authorized','cross_run_comparator_implementation_authorized','merge_sha_witness_implementation_authorized','r2_retention_witness_implementation_authorized','final_ledger_settlement_authorized'])A.equal(n.execution_constraints[k],false,k);
 for(const k of['s5_slice_helper_import_forbidden','alias_wrapper_object_persistence_forbidden','hard_coded_ha_item_or_requirement_forbidden','global_table_or_type_counts_forbidden','pull_request_ci_database_execution_forbidden'])A.equal(n.implementation_constraints[k],true,k);
 const q={schema_version:'geox_mcft_cap08_s6_exact_object_set_ref_reconciliation_effectiveness_result_v1',status:'PASS',subject_sha:g('rev-parse','HEAD'),base_sha:z,changed_file_count:5,implementation_candidate_head:s.candidate_head_sha,implementation_merge_commit:s.merge_commit_sha,candidate_merge_file_delta:0,merge_replay_status:y.status,closure_member_count:153,ledger_item_count:24,proof_contract_count:25,producer_count:19,synthetic_per_run_witness_count:44,logical_alias_as_canonical_ref_count:0,exact_object_set_ref_reconciliation_effective:true,exact_database_port_bundle_implementation_continuation_authorized:true,real_database_port_bundle_implemented:false,database_execution_authorized:false,run_a_executed:false,run_b_executed:false,workflow_dispatch_execution_authorized:false,dual_run_ci_authorized:false,cross_run_comparator_implemented:false,finalizer_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};w(q);console.log(JSON.stringify(q,null,2))
}catch(e){w({schema_version:'geox_mcft_cap08_s6_exact_object_set_ref_reconciliation_effectiveness_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1}
