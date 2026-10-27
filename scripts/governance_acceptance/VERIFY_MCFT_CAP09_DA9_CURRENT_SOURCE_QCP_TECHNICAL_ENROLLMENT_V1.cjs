#!/usr/bin/env node
"use strict";
/* NEW successor native technical QCP enrollment only. It never approves governance.
   Native GitHub run and exact ZIP artifact identities are checked by central QCP job. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4",Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json",A="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-FORMAL-REVIEW-REQUEST-V1.json";
const ID="DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",RES="DA9_CURRENT_SOURCE_SUCCESSOR_QCP_EXACT_FIVE_PATHS_V1";
const PATHS=[".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-FORMAL-REVIEW-REQUEST-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json","scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_CURRENT_SOURCE_QCP_TECHNICAL_ENROLLMENT_V1.cjs"];
const EXPECTED=[{"pr":3741,"head":"ef3649e40f0d3ab542fe9f365275708b23c53cab","ci_run":40516250068,"qualification_run":40516250234,"artifacts":[{"id":12739696790,"name":"da9-composer-four-native-source-ef3649e40f0d3ab542fe9f365275708b23c53cab","digest":"sha256:2b2ed72d9f0ba4f63a237c6df18edc5ae2b25c1d65bb448e82dff38b42e8900a"},{"id":12738798554,"name":"da9-current-composer-phase7-testonly-ef3649e40f0d3ab542fe9f365275708b23c53cab","digest":"sha256:8936f407a94b95c86c61c1f04c7c229f547e07516c3b1b47173d99f8774ed67e"}]},{"pr":3742,"head":"96ae42a7aeb3be83933faadafb65f1b72379b2cf","ci_run":40516837352,"qualification_run":40516836986,"artifacts":[]},{"pr":3743,"head":"cd18701600346840b7e4cc3611a7108f2e713490","ci_run":40517266880,"qualification_run":40517266887,"artifacts":[{"id":12738863652,"name":"cap09-phase3-current-source-pg-testonly-cd18701600346840b7e4cc3611a7108f2e713490","digest":"sha256:0a05c94f21df6f8164b4cc3e37f09fbddf6663dfabee605443ec833e58177502"}]}];
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:45000,maxBuffer:32*1024*1024}).trim();
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const sha=p=>"sha256:"+crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,p))).digest("hex");
function verify(){
 const head=git("rev-parse","HEAD");
 assert.equal(git("merge-base",BASE,head),BASE,"PROTECTED_MAIN_ANCESTRY");
 assert.deepEqual(git("diff","--name-only",BASE,head).split(/\r?\n/).filter(Boolean).sort(),PATHS,"EXACT_FIVE_PATHS_ONLY");
 const historic=JSON.parse(git("show",BASE+":"+Q)),now=read(Q);
 assert.equal(historic.checks.length,60);
 assert.equal(now.checks.length,61);
 assert.deepEqual(now.checks.slice(0,60),historic.checks,"HISTORIC_CHECKS_CHANGED");
 assert.deepEqual(now.checks[60],{"check_id":"DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1","owner":"MCFT_CAP09_CURRENT_SOURCE_SEPARATE_TECHNICAL_QCP_REVIEW","generation_scope":["V13","PHASE3_EVIDENCE_RUNTIME_FOUNDATION","PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION"],"authority_refs":["docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-FORMAL-REVIEW-REQUEST-V1.json"],"resolver_ids":["DA9_CURRENT_SOURCE_SUCCESSOR_QCP_EXACT_FIVE_PATHS_V1"],"historical_evidence_policy":"FRESH_THREE_SOURCE_EXACT_HEAD_NATIVE_SUCCESS_QUORUM_NO_OLD_SIGNED_SUBJECT_CARRY_FORWARD","execution_workflow":".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml","execution_workflow_status":"READONLY_THREE_SOURCE_NATIVE_QCP_PROOF_FORMAL_GOVERNANCE_SEPARATE_HOLD","fail_policy":"FAIL_CLOSED_THREE_PR_HEAD_CI_JOB_ARTIFACT_DIGEST_AND_APPROVER_DELEGATION_HOLD","carry_forward_policy":"NONE_HISTORICAL_FROZEN_AND_OPERATOR_SIGNATURE_CANNOT_TRANSFER","requalification_triggers":["DA9_CURRENT_SOURCE_SUCCESSOR_QCP_EXACT_FIVE_PATHS_V1"],"applicable_stages":["SUCCESSOR_SUBJECT_PRE_MERGE"],"carry_forward_evidence_id":null,"diagnostic_command":"node scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_CURRENT_SOURCE_QCP_TECHNICAL_ENROLLMENT_V1.cjs --verify"},"NEW_QCP_SCOPED_CHECK_CHANGED");
 const reverted=structuredClone(now);reverted.checks=historic.checks;delete reverted.dependency_resolvers[RES];
 assert.deepEqual(reverted,historic,"HISTORIC_RESOLVERS_OR_AUTHORITY_CHANGED");
 assert.deepEqual(now.dependency_resolvers[RES],{kind:"EXACT_PATH_SET",paths:PATHS});
 const bound=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs").resolveDependencyResolvers(ROOT,now);
 assert.deepEqual(bound.errors,[]);assert.deepEqual(bound.resolved[RES].paths,PATHS);
 for(const p of [
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FROZEN-V13-REQUALIFICATION-CONTRACT-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json",
 "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIX-CHECK-EVIDENCE-V1.json",
 "docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json",
 "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs",
 "scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts",
 "scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs"
 ])assert.equal(git("rev-parse",BASE+":"+p),git("rev-parse",head+":"+p),"AUTHORITY_OR_HISTORIC_SOURCE_CHANGED:"+p);
 const evidence=read(C),req=read(A);
 assert.equal(evidence.schema_version,"geox_mcft_cap09_da9_current_source_successor_qcp_evidence_v1");
 assert.equal(evidence.protected_main_base_sha,BASE);
 assert.equal(evidence.qcp_check_id,ID);assert.equal(evidence.qcp_resolver_id,RES);
 assert.deepEqual(evidence.qcp_exact_path_set,PATHS);
 assert.deepEqual(evidence.source_evidence.map(x=>({pr:x.pr,head:x.head,ci_run:x.ci_run,qualification_run:x.qualification_run,artifacts:x.artifacts})),EXPECTED);
 assert.deepEqual(evidence.source_evidence.map(x=>x.jobs.map(Boolean)),[[true,true],[true],[true]]);
 assert.deepEqual(evidence.source_evidence.map(x=>x.changed_paths.length),[3,4,3]);
 assert.equal(evidence.historical_phase3_dependency_digest,"sha256:d5d1cf09c4cde3b0fe82e658d9af2b25fe5beccee1a582d40ba00349fab8534b");
 assert.equal(evidence.current_phase3_dependency_digest,"sha256:8af6025cd4be03227ed06a39f8f5f7fc51cdc862f3e12319fcb318e00864f145");
 assert.equal(evidence.source_graph_sha256,"sha256:eb54bf64d15a01659d8ab5df4c23efc76b0a4aeb898e415536ef98581a10caaf");
 assert.equal(evidence.frozen108_catalog_sha256,"sha256:6458abd6c365c4e7c0d0e805d7d77910afdce74bc711d5f399e455d2c9f996e1");
 assert.equal(evidence.independent_authorized_governance_signature_present,false);
 assert.equal(evidence.historic_signed_six_not_reissued,true);
 assert.equal(evidence.historical_frozen_v13_zero_drift_false,true);
 assert.equal(evidence.windows_physical_injection_authorized,false);
 assert.equal(evidence.permit,"HOLD");
 assert.equal(evidence.old_failed_run_id,"df091a71aafc");
 assert.equal(evidence.old_failed_run_reusable,false);
 assert.equal(req.technical_evidence_ref,C);
 assert.equal(req.qcp_check_id,ID);
 assert.deepEqual(req.source_heads,EXPECTED.map(x=>x.head));
 assert.deepEqual(req.source_prs,[3741,3742,3743]);
 for(const x of ["purpose_specific_delegation_signed","approved","formal_qcp_zero_blockers","windows_physical_injection_authorized"])assert.equal(req[x],false,"REVIEW_PENDING_REQUIRED:"+x);
 for(const x of ["delegation_document_sha256","explicit_new_evidence_payload_signature_base64","approval_subject_current_qcp_head_sha","reviewer_approved_native_pr_review_id"])assert.equal(req[x],null,"IMPERSONATED_APPROVAL:"+x);
 assert.equal(req.existing_retry_role_sufficient_for_this_source_purpose,false);
 assert.equal(req.independent_candidate_spki_sha256,"ef7459a5918e35c90913532a7c8af545fbca4fec0b7dc95916797db3303fa870");
 const candidates=structuredClone(req);candidates.approved=true;
 assert.notDeepEqual(candidates,req,"APPROVAL_FORGERY_NEGATIVE_TEST");
 const mutation=structuredClone(evidence);mutation.source_evidence[0].artifacts[0].digest="sha256:"+"0".repeat(64);
 assert.notDeepEqual(mutation.source_evidence.map(x=>x.artifacts),evidence.source_evidence.map(x=>x.artifacts),"ARTIFACT_TAMPER_NEGATIVE_TEST");
 return {status:"PASS_DA9_THREE_SOURCE_QCP_TECHNICAL_CONTRACT_ONLY",
   current_review_head:head,current_evidence_sha256:sha(C),pending_governance_request_sha256:sha(A),
   source_prs:[3741,3742,3743],source_heads:EXPECTED.map(x=>x.head),
   qcp_check_id:ID,original_qcp_checks_preserved:60,exact_paths:PATHS.length,
   source_ci_and_artifact_final_validation_requires_native_github_job:true,
   authorized_independent_purpose_delegation_present:false,
   authorized_review_signature_present:false,
   full_qcp_zero_blockers:false,original_frozen_requalified:false,
   physical_windows_admission:false,production_authorized:false,original_six_stages:0,permit:"HOLD"};
}
if(!process.argv.includes("--verify"))throw Error("VERIFY_FLAG_REQUIRED");
try{console.log(JSON.stringify(verify()))}catch(error){console.error("HOLD_DA9_CURRENT_SOURCE_QCP:"+String(error.stack||error));process.exitCode=1}
