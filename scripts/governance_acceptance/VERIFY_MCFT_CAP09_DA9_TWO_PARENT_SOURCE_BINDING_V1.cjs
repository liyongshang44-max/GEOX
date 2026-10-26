#!/usr/bin/env node
"use strict";
// Atomic source-version binding for the two-parent merge of #3731 + #3732.
// New PR owner event is required; older #3732 event is NOT replayed or forged.
// NO production, PG, S3, Provider or one-shot Permit is authorized.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const BIND="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-TWO-PARENT-SOURCE-BINDING-V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const TECH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-QCP-TECHNICAL-ENROLLMENT-V1.json";
const OWNER="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-OWNER-DIRECTED-SOURCE-ADMISSION-V1.json";
const CHECK="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING";
const RES="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_REQUEST_EXACT_SCOPE_V1";
const read=(p)=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
const jsonAt=(ref,p)=>JSON.parse(git("show",ref+":"+p));
const shaAt=(ref,p)=>git("rev-parse",ref+":"+p);
const changed=(a,b)=>git("diff","--name-only",a+".."+b).split(/\r?\n/).filter(Boolean).sort();
const exactly=(a,b,label)=>assert.deepEqual(a,b,label);
const governanceFiles=[
 ".github/workflows/mcft-cap09-da9-signed-v2-governance-readonly-v1.yml",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-FORMAL-GOVERNANCE-ADMISSION-REQUEST-V1.json",
 OWNER,
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json",
 TECH,
 "scripts/governance_acceptance/REVIEW_MCFT_CAP09_DA9_SIGNED_V2_PHASE3_FROZEN_V13_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_SIGNED_V2_QCP_TECHNICAL_ENROLLMENT_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_FORMAL_GOVERNANCE_ADMISSION_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_OWNER_DIRECTED_SOURCE_ADMISSION_V1.cjs"
];
function verify(d,t,o,q,e,env,scoped) {
 assert.equal(d.schema_version,"geox_mcft_cap09_da9_signed_source_two_parent_merge_binding_v1");
 assert.equal(d.status,"INTEGRATION_PR_REQUALIFICATION_REQUIRED_NO_PRODUCTION_AUTHORITY");
 assert.deepEqual([d.source_pr,d.governance_pr,d.integration_pr],[3731,3732,3734]);
 assert.equal(d.source_head,"6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0");
 assert.equal(d.governance_head,"bc367f2ead25b9f28dfd61b1aed394fd864d73b2");
 assert.equal(d.historic_main_base,"2162f368899e9a9b5c497d332859e4196f389660");
 assert.equal(d.integrated_two_parent_merge,"876cdcff39fe9c252b591236afd3b9bcdf27a4f4");
 assert.equal(d.integrated_initial_tree,"a4dd8873d6034805aff7b2cbf131eb7b53da8e41");
 assert.equal(d.original_signed_bundle_sha256,t.basis_signed_bundle_sha256);
 assert.equal(d.original_signed_bundle_sha256,o.native_six_bundle_sha256);
 assert.equal(d.six_native_workflow_run,t.basis_original_six_native_workflow_run);
 assert.equal(d.six_native_workflow_run,40188383138);
 assert.equal(d.owner_directed_governance_qcp_run,40215603794);
 assert.equal(d.owner_policy_introduction_commit,o.owner_policy_introduction_commit??"a7739c1cff5f3f3c1f61e0ee19cbb4e659f44c13");
 assert.equal(d.phase3_source_digest,t.adjudications[0].registered_new_dependency_digest);
 assert.equal(d.frozen_semantic_scope_path_count,108);
 assert.equal(d.frozen_exact_successor_delta_paths,2);
 for(const k of ["original_stage3_files_modified_at_merge","original_operator_six_resigned","provider_refetch_authorized","new_merged_head_is_not_operator_signed","postmerge_source_qualification_adopted","new_runtime_installed_binding_signed","original_historic_frozen_v13_qualified","physical_admission_authorized","production_authorized","fenced_pg_admitted","permit_authorized"]){
   assert.equal(d[k],k==="new_merged_head_is_not_operator_signed",k); // signed original != integration HEAD
 }
 for(const k of ["signed_source_git_history_required","governance_git_history_required","owner_event_required","previous_governance_workflow_blob_pins_unchanged_at_merge"])assert.equal(d[k],true,k);
 assert.equal(o.decision,"APPROVE_EXACT_SIGNED_SOURCE_SUCCESSOR_WITHOUT_INDEPENDENT_REVIEW");
 assert.equal(o.independent_approval_claimed,false);
 assert.equal(o.production_authorized,false);assert.equal(o.permit_signing_authorized,false);
 assert.equal(o.signed_source_head,d.source_head);
 assert.equal(t.registration_status,"REGISTERED_TWO_NEW_SUBJECT_TECHNICAL_DECISIONS_WITH_EXECUTION_HOLD");
 assert.equal(t.basis_source_sha,d.source_head);
 assert.equal(env.GITHUB_ACTIONS,"true","HOLD_NO_GITHUB_ACTIONS_EVENT");
 assert.equal(env.GITHUB_EVENT_NAME,"pull_request","HOLD_NOT_PULL_REQUEST_EVENT");
 assert.equal(env.GITHUB_REPOSITORY,"liyongshang44-max/GEOX","HOLD_WRONG_REPOSITORY");
 assert(e&&e.pull_request&&e.repository,"HOLD_UNTRUSTED_PR_EVENT");
 assert.equal(e.pull_request.number,3734,"HOLD_NOT_INTEGRATION_PR_3734");
 assert.equal(e.pull_request.user?.login,"liyongshang44-max","HOLD_NOT_OWNER_PR_AUTHOR");
 assert.equal(e.pull_request.head?.repo?.full_name,"liyongshang44-max/GEOX");
 assert.equal(e.pull_request.base?.repo?.full_name,"liyongshang44-max/GEOX");
 assert.equal(e.repository?.full_name,"liyongshang44-max/GEOX");
 assert.equal(e.pull_request.base?.sha,d.historic_main_base,"HOLD_BASE_CHANGED_REQUALIFICATION_REQUIRED");
 assert.equal(e.pull_request.head?.sha,scoped.head,"HOLD_UNMATCHED_GITHUB_CHECKOUT_HEAD");
 assert.equal(git("rev-parse","HEAD"),scoped.head);
 assert.equal(scoped.merge_first_parent,d.source_head);
 assert.equal(scoped.merge_second_parent,d.governance_head);
 assert.equal(scoped.merge_tree,d.integrated_initial_tree);
 assert.equal(scoped.original_source_tree,d.source_tree);
 assert.equal(scoped.integrated_initial_qcp_blob,d.integrated_qcp_initial_blob);
 assert.equal(scoped.source_initial_qcp_blob,d.source_qcp_blob);
 assert.equal(scoped.governance_initial_qcp_blob,d.governance_qcp_blob);
 assert.equal(scoped.original_owner_blob,scoped.owner_current_blob,"HOLD_OWNER_POLICY_BYTE_DRIFT");
 assert.equal(scoped.owner_introduction_blob,scoped.owner_current_blob,"HOLD_OWNER_POLICY_INTRODUCTION_DRIFT");
 assert.equal(scoped.both_parents_in_integrated_history,true,"HOLD_ORIGINAL_PARENT_NOT_ANCESTOR");
 const sourceToMerge=[QCP,...governanceFiles].sort();
 exactly(scoped.source_to_merge_changed,sourceToMerge,"HOLD_SIGNED_SOURCE_OVERWRITTEN_DURING_GIT_MERGE");
 exactly(scoped.merge_to_current_changed,[
  ".github/workflows/mcft-cap09-da9-signed-v2-governance-readonly-v1.yml",
  ".github/workflows/mcft-cap09-da9-signed-source-merge-binding-v1.yml",
  BIND,QCP,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs",
  "docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json","scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"
 ].sort(),"HOLD_UNREVIEWED_INTEGRATION_FILES");
 for(const p of governanceFiles.filter(x=>!x.endsWith("governance-readonly-v1.yml"))){
   assert.equal(shaAt(d.integrated_two_parent_merge,p),shaAt(d.governance_head,p),"HOLD_GOVERNANCE_PARENT_BLOB_CHANGED:"+p);
   assert.equal(shaAt(scoped.head,p),shaAt(d.governance_head,p),"HOLD_GOVERNANCE_FILE_MODIFIED_AFTER_MERGE:"+p);
 }
 const source=jsonAt(d.source_head,QCP),gov=jsonAt(d.governance_head,QCP),initial=jsonAt(d.integrated_two_parent_merge,QCP);
 assert.equal(source.checks.length,56);assert.equal(gov.checks.length,57);assert.equal(initial.checks.length,58);assert.equal(q.checks.length,58);
 assert.equal(Object.keys(q.dependency_resolvers).length,58);
 const govNew=gov.checks.filter(x=>!source.checks.some(y=>x.check_id===y.check_id));
 assert.equal(govNew.length,2);
 exactly(initial.checks,[...source.checks,...govNew],"HOLD_INITIAL_MERGE_QCP_CHECKS_CHANGED");
 for(const [k,v] of Object.entries(source.dependency_resolvers))exactly(initial.dependency_resolvers[k],v,"HOLD_SOURCE_QCP_RESOLVER_CHANGED:"+k);
 for(const [k,v] of Object.entries(gov.dependency_resolvers))if(!(k in source.dependency_resolvers))exactly(initial.dependency_resolvers[k],v,"HOLD_NEW_GOV_QCP_RESOLVER_CHANGED:"+k);
 const oldCheck=initial.checks.find(x=>x.check_id===CHECK),integratedCheck=q.checks.find(x=>x.check_id===CHECK);
 assert(oldCheck&&integratedCheck);
 assert.equal(integratedCheck.carry_forward_evidence_id,null);
 assert.equal(integratedCheck.carry_forward_policy,"NONE_NO_PREDECESSOR_FROZEN_ZERO_DELTA_CARRY_FORWARD");
 assert.equal(integratedCheck.execution_workflow_status,"INTEGRATION_OWNER_PR_BINDING_QUALIFIED_PREMERGE_ONLY");
 assert.equal(integratedCheck.diagnostic_command,"node scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs");
 assert.deepEqual(integratedCheck.authority_refs,[...oldCheck.authority_refs,BIND]);
 const oldRes=initial.dependency_resolvers[RES],newRes=q.dependency_resolvers[RES];
 assert(oldRes&&newRes&&oldRes.kind==="EXACT_PATH_SET"&&newRes.kind==="EXACT_PATH_SET");
 exactly(newRes.paths,[...oldRes.paths,
  ".github/workflows/mcft-cap09-da9-signed-source-merge-binding-v1.yml",BIND,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs",
  "docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json","scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"
 ].sort(),"HOLD_INTEGRATION_EXACT_PATH_SCOPE");
 const revert=structuredClone(q);revert.checks[revert.checks.findIndex(x=>x.check_id===CHECK)]=oldCheck;revert.dependency_resolvers[RES]=oldRes;
 exactly(revert,initial,"HOLD_OTHER_QCP_CHECK_OR_RESOLVER_DRIFT");
 return {status:"PASS_TWO_PARENT_SIGNED_SOURCE_AND_OWNER_QCP_INTEGRATION_BINDING_ONLY",
  source_sha:d.source_head,governance_sha:d.governance_head,combined_head:scoped.head,
  legacy_signed_source_git_blobs_unchanged:true,original_six_signatures_bound_to_parent_not_merge:true,
  phase3_new_digest_valid:true,frozen_two_blobs_valid:true,historic_frozen_v13_zero_drift_pass:false,
  owner_policy_source_approved:true,integrated_qcp_count:q.checks.length,merge_parents_exact:true,
  formal_postmerge_adoption:false,real_physical_admission:false,permit:false,production:false};
}
function negative(d,t,o,q,e,env,scope){
 let pass=0;
 const reject=(fn)=>{const D=structuredClone(d),T=structuredClone(t),O=structuredClone(o),Q=structuredClone(q),E=structuredClone(e),ENV={...env},SC={...scope};fn(D,T,O,Q,E,ENV,SC);assert.throws(()=>verify(D,T,O,Q,E,ENV,SC));pass++;};
 reject(D=>D.source_head="0".repeat(40));
 reject(D=>D.governance_head="0".repeat(40));
 reject(D=>D.original_signed_bundle_sha256="sha256:"+"0".repeat(64));
 reject(D=>D.frozen_exact_successor_delta_paths=3);
 reject(D=>D.original_historic_frozen_v13_qualified=true);
 reject(D=>D.production_authorized=true);
 reject(D=>D.permit_authorized=true);
 reject((D,T,O,Q,E)=>E.pull_request.number=3732);
 reject((D,T,O,Q,E)=>E.pull_request.user.login="other");
 reject((D,T,O,Q,E)=>E.pull_request.head.sha="0".repeat(40));
 reject((D,T,O,Q,E)=>E.pull_request.base.sha="0".repeat(40));
 reject((D,T,O,Q,E,ENV)=>ENV.GITHUB_ACTIONS="false");
 reject((D,T,O,Q,E,ENV)=>ENV.GITHUB_REPOSITORY="other/repo");
 reject((D,T,O,Q,E,ENV,SC)=>SC.merge_first_parent="0".repeat(40));
 reject((D,T,O,Q,E,ENV,SC)=>SC.owner_current_blob="0".repeat(40));
 reject((D,T,O,Q,E,ENV,SC)=>SC.source_to_merge_changed.push("scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts"));
 reject((D,T,O,Q)=>Q.checks.find(x=>x.check_id===CHECK).carry_forward_evidence_id="legacy");
 reject((D,T,O,Q)=>Q.dependency_resolvers[RES].paths.push("apps/server/src/server.ts"));
 reject((D,T)=>T.adjudications[0].registered_new_dependency_digest="sha256:"+"0".repeat(64));
 reject((D,T,O)=>O.independent_approval_claimed=true);
 return pass;
}
function main(){
 const d=read(BIND),t=read(TECH),o=read(OWNER),q=read(QCP);
 const eventPath=process.env.GITHUB_EVENT_PATH;
 if(!eventPath)throw Error("HOLD_GITHUB_EVENT_PATH_REQUIRED");
 const e=JSON.parse(fs.readFileSync(eventPath,"utf8"));
 const p=git("rev-list","--parents","-n","1",d.integrated_two_parent_merge).split(/\s+/);
 assert.equal(p.length,3,"HOLD_NOT_TWO_PARENT_MERGE");
 const scope={
   head:git("rev-parse","HEAD"),merge_first_parent:p[1],merge_second_parent:p[2],
   merge_tree:git("rev-parse",d.integrated_two_parent_merge+"^{tree}"),
   original_source_tree:git("rev-parse",d.source_head+"^{tree}"),
   source_initial_qcp_blob:shaAt(d.source_head,QCP),governance_initial_qcp_blob:shaAt(d.governance_head,QCP),
   integrated_initial_qcp_blob:shaAt(d.integrated_two_parent_merge,QCP),
   owner_introduction_blob:shaAt(d.owner_policy_introduction_commit,OWNER),
   owner_current_blob:shaAt("HEAD",OWNER),
   original_owner_blob:shaAt(d.governance_head,OWNER),
   source_to_merge_changed:changed(d.source_head,d.integrated_two_parent_merge),
   merge_to_current_changed:changed(d.integrated_two_parent_merge,"HEAD"),
   both_parents_in_integrated_history:
     cp.spawnSync("git",["merge-base","--is-ancestor",d.source_head,"HEAD"],{cwd:ROOT}).status===0 &&
     cp.spawnSync("git",["merge-base","--is-ancestor",d.governance_head,"HEAD"],{cwd:ROOT}).status===0
 };
 const result=verify(d,t,o,q,e,process.env,scope);
 const n=negative(d,t,o,q,e,process.env,scope);assert.equal(n,20);
 const signedV2=require("./VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
 const reviewedEvidence=read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json");
 assert.equal(reviewedEvidence.source_head,d.source_head);
 assert.equal(reviewedEvidence.signed_bundle_sha256,d.original_signed_bundle_sha256);
 assert.equal(reviewedEvidence.evidence_entries.length,6);
 let sixVerified=0;
 for(const x of reviewedEvidence.evidence_entries){
  const v=signedV2.verifyRegisteredEvidence({decision:{check_id:x.check_id,dependency_digest:x.reviewed_dependency_digest},stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head:scope.head,base:d.historic_main_base});
  assert(v&&v.status==="PASS","HOLD_PUBLIC_SIX_SIGNATURE_PROOF_NOT_VERIFIED:"+x.check_id);
  sixVerified++;
 }
 assert.equal(sixVerified,6);
 console.log(JSON.stringify({...result,negative_tests_pass:n,cryptographically_verified_existing_ed25519_reviews:sixVerified}));
}
try{main()}catch(e){console.error("HOLD_TWO_PARENT_SOURCE_BINDING:"+String(e.stack||e));process.exitCode=1;}
