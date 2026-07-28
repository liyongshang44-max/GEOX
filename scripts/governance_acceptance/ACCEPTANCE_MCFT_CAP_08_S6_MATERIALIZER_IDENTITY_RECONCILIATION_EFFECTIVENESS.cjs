#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),C=require('node:crypto'),P=require('node:child_process'),F=require('node:fs'),O=require('node:os'),X=require('node:path');
const R=X.resolve(__dirname,'../..'),D='docs/digital_twin/mcft/cap_08',B=`${D}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-EFFECTIVENESS-BOUNDARY-V1.json`,E=`${D}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-EFFECTIVENESS-AUTHORITY-V1.json`,N=`${D}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-POST-MATERIALIZER-IDENTITY-AUTHORITY-V1.json`,Q=X.join(R,'acceptance-output/MCFT_CAP_08_S6_MATERIALIZER_IDENTITY_RECONCILIATION_EFFECTIVENESS_RESULT.json');
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
 A.equal(e.record_status,'MATERIALIZER_IDENTITY_RECONCILIATION_EFFECTIVE');A.equal(n.record_status,'EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION_POST_MATERIALIZER_IDENTITY_AUTHORIZED');
 A.equal(g('diff','--name-only',s.candidate_head_sha,s.merge_commit_sha),'');A.equal(g('rev-parse',`${s.candidate_head_sha}^{tree}`),s.candidate_tree_sha);A.equal(g('rev-parse',`${s.merge_commit_sha}^{tree}`),s.merge_tree_sha);A.equal(s.candidate_tree_sha,s.merge_tree_sha);
 const m=[
 ['.github/workflows/mcft-cap-08-s6-materializer-identity-reconciliation.yml','c52c9411eeca5b1d99183fc2aea7f4a234bdb3ff'],
 ['.github/workflows/mcft-cap-08-s6-single-run-database-execution-harness.yml','a59a2522b36d4bfcf3629a14edf4cc87f47658f6'],
 [`${D}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-AUTHORITY-V1.json`,'5691318501dc797e5cb305699d7e664528680c7f'],
 [`${D}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-IMPLEMENTATION-V1.json`,'a8389c6dee28e0dd52a6e5df2f8af5af0e131337'],
 [`${D}/GEOX-MCFT-CAP-08-S6-MATERIALIZER-IDENTITY-RECONCILIATION-BOUNDARY-V1.json`,'87795b10f504cb5b1b1b1c4ed94c4c199788fab2'],
 ['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_MATERIALIZER_IDENTITY_RECONCILIATION.cjs','b1d3ec2184a2291d80891f357404cf66c908bfa3'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs','906b2287dea662a74101fcbdf7bb2265f22976fa'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/materializer_adapter_v1.cjs','ef4831dd32069be4976785e16d90bc7a262bf00d'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs','68ef6934bab0243b29c3ae90b22d4e5603f1c4fb'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs','0009facd64cc81c946351c901ba26a257548f29a'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/synthetic_fixture_v1.cjs','41c1919aa0af4aa35f2b83ac3a6e742ff1ff13d6'],
 ['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/synthetic_data_acceptance_v1.cjs','94e2791802a84bc7a6eccb7bcc98ed4fc225e044']];
 for(const [p,x]of m)A.equal(g('rev-parse',`${s.merge_commit_sha}:${p}`),x,`BLOB:${p}`);
 A.equal(g('rev-parse',`${s.merge_commit_sha}:${D}/GEOX-MCFT-CAP-08-S6-EXACT-DATABASE-PORT-BUNDLE-POST-RECONCILIATION-AUTHORITY-V1.json`),e.authority_consumed.prior_post_reconciliation_port_bundle_authority_blob);
 const v=e.exact_head_evidence;
 A.deepEqual([v.reconciliation_workflow_run_id,v.reconciliation_artifact_id,v.reconciliation_artifact_digest],[30375356541,8694676017,'sha256:77cd5355cfaa3905cf8445adc24af9509003f6c076ab3bb798322c61544914e3']);
 A.deepEqual([v.historical_harness_workflow_run_id,v.historical_harness_artifact_id,v.historical_harness_artifact_digest],[30375356391,8694679803,'sha256:c2622e304fc0bbb8f4f4ea5f8a9a03104c78f7a8228302a90308186cebefef68']);
 A.deepEqual([v.standard_ci_run_id,v.standard_ci_status,v.required_workflow_count,v.required_workflow_success_count],[30375356411,'PASS',9,9]);
 const t=F.mkdtempSync(X.join(O.tmpdir(),'mcft08-materializer-'));let y;
 try{P.execFileSync('git',['worktree','add','--detach',t,s.merge_commit_sha],{cwd:R,stdio:'pipe'});P.execFileSync('node',['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_MATERIALIZER_IDENTITY_RECONCILIATION.cjs'],{cwd:t,env:{...process.env,MCFT_BASE_SHA:'1993130d859b68807f733ef9ac69ebb9dd8de08b'},stdio:'pipe'});y=JSON.parse(F.readFileSync(X.join(t,'acceptance-output/MCFT_CAP_08_S6_MATERIALIZER_IDENTITY_RECONCILIATION_RESULT.json'),'utf8'))}
 finally{try{P.execFileSync('git',['worktree','remove','--force',t],{cwd:R,stdio:'pipe'})}catch{}F.rmSync(t,{recursive:true,force:true})}
 A.deepEqual([y.status,y.changed_file_count,y.phase_count,y.canonical_receipt_count,y.per_run_witness_count,y.proof_object_set_count,y.exact_ref_query_count,y.canonical_identity_binding,y.formal_run_id_algorithm_changed,y.database_execution_authorized,y.run_a_executed,y.run_b_executed],['PASS',12,28,153,22,22,1,'BOUND_TO_PRODUCT_A0_IDENTITY',false,false,false,false]);
 A.equal(y.unbound_lineage_id,null);A.equal(y.unbound_revision_id,null);A.equal(y.bound_lineage_profile,'lineage_<product-a0-semantic-hash>');A.equal(y.bound_revision_profile,'revision_<product-a0-semantic-hash>');
 const u=e.verified_result;A.deepEqual([u.changed_file_count,u.phase_count,u.canonical_receipt_count,u.per_run_witness_count,u.proof_object_set_count,u.exact_ref_query_count,u.canonical_identity_binding,u.formal_run_id_algorithm_changed],[12,28,153,22,22,1,'BOUND_TO_PRODUCT_A0_IDENTITY',false]);
 A.equal(e.effect.materializer_identity_reconciliation_effective,true);A.equal(e.effect.exact_database_port_bundle_implementation_may_resume,true);A.equal(e.effect.real_database_port_bundle_implemented,false);A.equal(n.prior_authority.blob_sha,'71265b77a74a890252ecc88e492b4aacb3e5cc89');
 for(const k of['single_run_database_execution_authorized','run_a_execution_authorized','run_b_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized','dual_run_ci_authorized','cross_run_comparator_implementation_authorized','merge_sha_witness_implementation_authorized','r2_retention_witness_implementation_authorized','final_ledger_settlement_authorized'])A.equal(n.execution_constraints[k],false,k);
 for(const k of['lineage_and_revision_must_be_unbound_before_materialization','lineage_and_revision_must_bind_from_direct_materializer_result','every_canonical_receipt_must_match_bound_product_identity','precomputed_twin_lineage_or_revision_forbidden','receipt_identity_relabeling_forbidden','s5_slice_helper_import_forbidden','alias_wrapper_object_persistence_forbidden','hard_coded_ha_item_or_requirement_forbidden','global_table_or_type_counts_forbidden','pull_request_ci_database_execution_forbidden'])A.equal(n.implementation_constraints[k],true,k);
 const q={schema_version:'geox_mcft_cap08_s6_materializer_identity_reconciliation_effectiveness_result_v1',status:'PASS',subject_sha:g('rev-parse','HEAD'),base_sha:z,changed_file_count:5,implementation_candidate_head:s.candidate_head_sha,implementation_merge_commit:s.merge_commit_sha,candidate_merge_file_delta:0,merge_replay_status:y.status,phase_count:28,canonical_receipt_count:153,per_run_witness_count:22,proof_object_set_count:22,exact_ref_query_count:1,canonical_identity_binding:'BOUND_TO_PRODUCT_A0_IDENTITY',materializer_identity_reconciliation_effective:true,exact_database_port_bundle_implementation_continuation_authorized:true,real_database_port_bundle_implemented:false,database_execution_authorized:false,run_a_executed:false,run_b_executed:false,workflow_dispatch_execution_authorized:false,dual_run_ci_authorized:false,cross_run_comparator_implemented:false,finalizer_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};w(q);console.log(JSON.stringify(q,null,2))
}catch(e){w({schema_version:'geox_mcft_cap08_s6_materializer_identity_reconciliation_effectiveness_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)});console.error(e);process.exitCode=1}
