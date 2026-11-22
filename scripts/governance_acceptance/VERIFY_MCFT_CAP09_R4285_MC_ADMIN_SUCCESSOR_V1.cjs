"use strict";
/*
 * #3780 CTO-bounded A128 Producer native MC Admin successor source proof.
 * This DOES NOT change historical Stage3/DA9/Frozen108 requirements, issue
 * any signer authority, or claim science/runtime/adoption requalification.
 *
 * Previously failed check IDs:
 * V13_AUTONOMOUS_FORCING_FOUNDATION, V13_HOLISTIC_SCHEMA,
 * V13_NEXT_TICK_VIABILITY, EA5C1_DURABLE_RAW_RESTRICTED_INGRESS,
 * PHASE2_EVIDENCE_PROVIDER_MODULES, PHASE3_EVIDENCE_RUNTIME_FOUNDATION,
 * PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION,
 * STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION,
 * DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING,
 * CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1,
 * FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1,
 * DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1,
 * CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY,
 * CAP09_R4285_HOST_ADMISSION_V2_EXACT_SOURCE_REVIEW_V1.
 *
 * Each is adjudicated against immutable #3779 QCP BASE + complete git blob
 * dependency closure, without relabelling old review or signed evidence.
 */
const assert=require("node:assert/strict"),cp=require("node:child_process");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {zipRaw}=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs");
const ROOT=path.resolve(__dirname,"../..");
const BASE="a12831a457b9bb47941a8873b7faa0ba880d6f81";
const SOURCE="scripts/runtime_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs";
const TEST="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs";
const CONTROL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const PREFLIGHT="scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs";
const WORKFLOW=".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml";
const VERIFIER="scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_MC_ADMIN_SUCCESSOR_V1.cjs";
const NEGATIVE="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_MC_ADMIN_SUCCESSOR_V1.test.cjs";
const CURRENT="CAP09_R4285_MC_ADMIN_PRODUCER_EXACT_SUCCESSOR_V1";
const BRANCH="fix/r4285-a128-native-mc-admin-child-only-20261122";
const HISTORICAL="12dcbba6750879f0349c5730f477cb04cd23b560";
const HIST_STAGE="scripts/runtime_acceptance/RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts";
const HIST_BLOB="60ac618f465afd3a9e14325ceb08fd768318431e";
const BASE_STAGE_BLOB="12029e293e7374f3b30258e16ce3b4da7dfa1d47";
const SOURCE_BASE_BLOB="c362416ddae238d6e826f4413c850462abee1f3d";
const SOURCE_HEAD_BLOB="954195e6b07bc70933418fc46cbe9d56824b9c3c";
const TEST_BASE_BLOB="0de0ebe04376a575679952d296c3f4e6e635a5eb";
const TEST_HEAD_BLOB="0db65beccec7083fa64ced56dc14bcf52f7e561c";
const PREDECESSOR={pr:3779,head:"4538cf637bbc106d8e0c88cfdda2f1b16cea278b",
 qcp_run:44887860609,ci_run:44887860580,artifact_id:14700966347,
 artifact_zip_digest:"4e15f83d3676d8c429b4e11788607028c0ad5b5a8ebc776c6fa74fd6f1fb1c52"};
const SCOPED_IDS=Object.freeze([
 "V13_AUTONOMOUS_FORCING_FOUNDATION",
 "V13_HOLISTIC_SCHEMA",
 "V13_NEXT_TICK_VIABILITY",
 "EA5C1_DURABLE_RAW_RESTRICTED_INGRESS",
 "PHASE2_EVIDENCE_PROVIDER_MODULES",
 "PHASE3_EVIDENCE_RUNTIME_FOUNDATION",
 "PHASE7_PRIVATE_CANDIDATE_PROMOTION_COMPOSITION",
 "STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION",
 "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING",
 "CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
 "FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
 "DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
 "CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_TEST_ONLY",
 "CAP09_R4285_HOST_ADMISSION_V2_EXACT_SOURCE_REVIEW_V1"
]);
const SCIENCE=new Set(SCOPED_IDS.slice(0,7));
const HISTORIC_SCOPE=new Set(SCOPED_IDS.slice(8));
const WIRING=new Set([CONTROL,PREFLIGHT,WORKFLOW,VERIFIER,NEGATIVE]);
const EXPECTED_PATHS=[SOURCE,TEST,...WIRING].sort();
function sha(b){return crypto.createHash("sha256").update(b).digest("hex");}
function git(root,...a){return cp.execFileSync("git",a,{cwd:root,encoding:"utf8",timeout:60000,maxBuffer:32*1024*1024}).trim();}
function blob(root,ref,p){return git(root,"rev-parse",ref+":"+p);}
function bytes(root,ref,p){return cp.execFileSync("git",["show",ref+":"+p],{cwd:root,timeout:60000,maxBuffer:16*1024*1024});}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function gitPaths(root,base,head){return git(root,"diff","--name-only",base,head).split(/\r?\n/).filter(Boolean).sort();}
function exactPathBoundary(changed){
 assert.deepEqual([...changed].sort(),EXPECTED_PATHS,"MCADMIN_SUCCESSOR_EXACT_PATH_SET");
 assert.equal(new Set(changed).size,EXPECTED_PATHS.length,"MCADMIN_SUCCESSOR_PATH_DUPLICATE");
 return true;
}
function frozenProducerBoundary(root,head){
 assert.equal(blob(root,BASE,SOURCE),SOURCE_BASE_BLOB,"MCADMIN_SOURCE_BASE_BLOB_CHANGED");
 assert.equal(blob(root,head,SOURCE),SOURCE_HEAD_BLOB,"MCADMIN_SOURCE_CANDIDATE_BLOB_CHANGED");
 assert.equal(blob(root,BASE,TEST),TEST_BASE_BLOB,"MCADMIN_TEST_BASE_BLOB_CHANGED");
 assert.equal(blob(root,head,TEST),TEST_HEAD_BLOB,"MCADMIN_TEST_CANDIDATE_BLOB_CHANGED");
 const previous=bytes(root,BASE,TEST),current=bytes(root,head,TEST);
 assert(current.subarray(0,previous.length).equals(previous),"MCADMIN_PREEXISTING_TEST_BYTES_CHANGED");
 const old=bytes(root,BASE,SOURCE).toString("utf8"),updated=bytes(root,head,SOURCE).toString("utf8");
 assert(updated.includes("const physicalMcAdminContext=new AsyncLocalStorage()"),"MCADMIN_CONTEXT_MISSING");
 assert(updated.includes("withPhysicalMcAdmin(()=>verifyFormalEvidence(i,sources))"),"MCADMIN_FORMAL_SOURCE_SCOPE_MISSING");
 assert(updated.includes("p.state.execution===true?withPhysicalMcAdmin(()=>captureCurrentNativeSourceOnly"),"MCADMIN_CAPTURE_SCOPE_MISSING");
 assert(updated.includes("registeredMcExecutable()"),"MCADMIN_REGISTERED_MC_MISSING");
 for(const unchanged of [
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_SCOPE_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json"
 ])assert.equal(blob(root,BASE,unchanged),blob(root,head,unchanged),
  "MCADMIN_FORBIDDEN_AUTHORITY_OR_HOST_DELTA:"+unchanged);
 // These exact source blobs are one-time CTO-bounded implementation objects,
 // not evidence that any physical receiver, 120s or 15s gate ran.
 return {source_blob:SOURCE_HEAD_BLOB,test_blob:TEST_HEAD_BLOB,
  prior_source_blob:SOURCE_BASE_BLOB,scope:"FIXED_CHILD_MC_ADMIN_AUTHENTICATION_ONLY"};
}
function historicalStage3(root,head){
 const frozen=JSON.parse(bytes(root,BASE,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-STAGE3-NONAUTHORIZED-REAL-BODY-QUALIFICATION-V1.json"));
 assert.equal(frozen.frozen_pr_3730_head_sha,HISTORICAL,"STAGE3_ORIGINAL_FROZEN_SUBJECT_DRIFT");
 const ids=frozen.stages.map(s=>s.id);
 assert.deepEqual(ids,["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]);
 for(const s of frozen.stages)assert.equal(blob(root,HISTORICAL,s.original_entry_script),s.original_entry_git_blob_sha,
   "STAGE3_FROZEN_ORIGINAL_BLOB_INVALID:"+s.id);
 assert.equal(blob(root,HISTORICAL,HIST_STAGE),HIST_BLOB);
 assert.equal(blob(root,BASE,HIST_STAGE),BASE_STAGE_BLOB);
 assert.equal(blob(root,head,HIST_STAGE),BASE_STAGE_BLOB,
   "STAGE3_PRIOR_MAIN_BODY_UNEXPECTED_NEW_DELTA");
 assert.notEqual(BASE_STAGE_BLOB,HIST_BLOB,"STAGE3_PREEXISTING_HISTORY_MUST_NOT_BE_RELABELLED");
 return {historical_3730_frozen_blobs_verified:ids.length,
   current_baseline_drift_preserved:true,original_current_stage3_pass_claimed:false};
}
function preservedAuthority(root,head,current){
 const baseline=JSON.parse(bytes(root,BASE,CONTROL));
 assert.equal(current.checks.length,baseline.checks.length+1,"MCADMIN_QCP_ONLY_ONE_NEW_CHECK");
 assert(same(current.checks.slice(0,-1),baseline.checks),"MCADMIN_PRIOR_QCP_CHECK_DEFINITIONS_CHANGED");
 assert.equal(current.checks.at(-1).check_id,CURRENT,"MCADMIN_NEW_CHECK_NOT_LAST");
 for(const [id,value] of Object.entries(baseline.dependency_resolvers))
  assert(same(current.dependency_resolvers[id],value),"MCADMIN_HISTORICAL_RESOLVER_CHANGED:"+id);
 assert.equal(Object.keys(current.dependency_resolvers).length,
  Object.keys(baseline.dependency_resolvers).length+1,"MCADMIN_ONLY_ONE_NEW_RESOLVER");
 const currentSource=bytes(root,head,PREFLIGHT).toString("utf8");
 const oldSource=bytes(root,BASE,PREFLIGHT).toString("utf8");
 const clean=currentSource.replace(/  \/\/ BEGIN PR3780 EXACT MCADMIN SUCCESSOR PROOF[\s\S]*?  \/\/ END PR3780 EXACT MCADMIN SUCCESSOR PROOF\n/g,"")
   .replace(/    \/\/ BEGIN PR3780 EXACT MCADMIN SUCCESSOR ROUTE[\s\S]*?    \/\/ END PR3780 EXACT MCADMIN SUCCESSOR ROUTE\n/g,"");
 assert.equal(clean,oldSource,"MCADMIN_OTHER_QCP_PREFLIGHT_SEMANTICS_CHANGED");
 const baseWorkflow=bytes(root,BASE,WORKFLOW).toString("utf8"),
   newWorkflow=bytes(root,head,WORKFLOW).toString("utf8");
 const added=" || (github.event.pull_request.number == 3780 && github.event.pull_request.base.sha == '"+BASE+"' && github.head_ref == '"+BRANCH+"')";
 assert.equal(newWorkflow.split(added).join(""),baseWorkflow,
   "MCADMIN_UNRELATED_QCP_WORKFLOW_CHANGED");
 return {prior_check_count:baseline.checks.length,prior_definitions_identical:true,
  prior_resolvers_identical:true,original_preflight_semantics_preserved:true,
  qcp_workflow_only_exact_node20_source_added:true};
}
function dependencyProjection(root,head,authority,plan){
 const p=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const registry=JSON.parse(bytes(root,head,p.REGISTRY_PATH));
 const context=p.prepareApplicabilityContext({root,authority,registry,generation:"v13",headSha:head});
 assert.deepEqual(context.definitionErrors,[],"MCADMIN_CURRENT_QCP_DEFINITION_ERRORS");
 assert.deepEqual(context.resolverResult.errors,[],"MCADMIN_CURRENT_RESOLVER_ERRORS");
 assert.equal(plan.status,"PASS","MCADMIN_PLANNER_NOT_PASS");
 assert.deepEqual(plan.unknown_changed_paths,[],"MCADMIN_UNKNOWN_PATHS");
 assert.deepEqual(plan.authority_errors,[],"MCADMIN_AUTHORITY_ERRORS");
 assert.equal(plan.head_sha,head,"MCADMIN_PLANNER_HEAD_MISMATCH");
 const out={};
 for(const id of SCOPED_IDS){
  const check=authority.checks.find(c=>c.check_id===id),decision=plan.decisions.find(d=>d.check_id===id);
  assert(check&&decision,"MCADMIN_REQUIRED_SCOPE_NOT_REGISTERED:"+id);
  const dependencies=[...new Set(check.resolver_ids.flatMap(id=>{
   const x=context.resolverResult.resolved[id];assert(x,"MCADMIN_UNRESOLVED_CLOSURE:"+id);return x.paths;
  }))].sort();
  const modified=dependencies.filter(file=>blob(root,BASE,file)!==blob(root,head,file));
  const forbidden=modified.filter(file=>!WIRING.has(file));
  assert.deepEqual(forbidden,[],"MCADMIN_OPERATIONAL_DEPENDENCY_CHANGED:"+id);
  assert(!modified.includes(SOURCE)&&!modified.includes(TEST),
    "MCADMIN_CHANGED_PRODUCER_LEAKS_HISTORICAL_CLOSURE:"+id);
  out[id]={dependency_count:dependencies.length,
   unchanged_operational_dependency_count:dependencies.length-modified.length,
   qualification_wiring_delta:modified,proven_no_changed_operational_blobs:true,
   evidence_from_frozen_subject_reissued:false};
 }
 return out;
}
function nativeBaseline(root,head){
 const api=x=>JSON.parse(cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/"+x],
  {cwd:root,encoding:"utf8",timeout:90000,maxBuffer:16*1024*1024}));
 const pr=api("pulls/"+PREDECESSOR.pr);
 assert.equal(pr.state,"closed");assert.equal(pr.merged,true);
 assert.equal(pr.merge_commit_sha,BASE);assert.equal(pr.head.sha,PREDECESSOR.head);
 assert.equal(git(root,"merge-base",BASE,head),BASE,"MCADMIN_NOT_DESCENDANT_BASE");
 for(const [runId,name] of [[PREDECESSOR.qcp_run,"mcft-cap-09-qualification-control-plane-v1"],[PREDECESSOR.ci_run,"ci"]]){
  const run=api("actions/runs/"+runId);
  assert.equal(run.head_sha,PREDECESSOR.head,"MCADMIN_PREDECESSOR_HEAD_NOT_EXACT");
  assert.equal(run.name,name);
  assert.equal(run.event,"pull_request");
  assert.equal(run.status,"completed");
  assert.equal(run.conclusion,"success","MCADMIN_PREDECESSOR_QUALIFICATION_NOT_SUCCESS");
 }
 const artifact=api("actions/artifacts/"+PREDECESSOR.artifact_id);
 assert.equal(artifact.workflow_run?.id,PREDECESSOR.qcp_run,"MCADMIN_PREDECESSOR_ARTIFACT_RUN");
 assert.equal(artifact.expired,false,"MCADMIN_PREDECESSOR_ARTIFACT_EXPIRED");
 assert.equal(artifact.digest,"sha256:"+PREDECESSOR.artifact_zip_digest,
  "MCADMIN_PREDECESSOR_ARTIFACT_DIGEST");
 const zip=cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/actions/artifacts/"+PREDECESSOR.artifact_id+"/zip"],
  {cwd:root,timeout:90000,maxBuffer:32*1024*1024});
 assert.equal(sha(zip),PREDECESSOR.artifact_zip_digest,"MCADMIN_PRIOR_QCP_ZIP_BYTES_MISMATCH");
 const raw=zipRaw(zip),report=JSON.parse(raw.toString("utf8"));
 raw.fill(0);
 assert.equal(report.status,"PASS","MCADMIN_PRIOR_QCP_RESULT_NOT_PASS");
 assert.equal(report.head_sha,PREDECESSOR.head,"MCADMIN_PRIOR_QCP_SOURCE_HEAD");
 assert.equal(report.base_sha,"d97f4b6dadcfa894025fd1634bd69c1c01a8761c",
  "MCADMIN_PRIOR_QCP_BASE");
 assert.equal(report.counts.blocker_count,0,"MCADMIN_PRIOR_QCP_BLOCKERS");
 assert.equal(report.results.length,74,"MCADMIN_PRIOR_QCP_CHECK_COUNT");
 return {predecessor_pr:3779,merge_base_sha:BASE,
  qcp_run_id:PREDECESSOR.qcp_run,ci_run_id:PREDECESSOR.ci_run,
  qcp_artifact_id:PREDECESSOR.artifact_id,
  qcp_artifact_zip_digest:PREDECESSOR.artifact_zip_digest,
  source_only_baseline:true,scientific_evidence_promoted:false};
}
function currentNonconsumingTests(root,head){
 const files=[TEST,
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_MC_ADMIN_SUCCESSOR_V1.test.cjs"];
 const result=[];
 for(const file of files){
  const child=cp.spawnSync(process.execPath,["--test",file],
   {cwd:root,encoding:"utf8",timeout:150000,maxBuffer:4*1024*1024,
    env:{PATH:process.env.PATH,HOME:process.env.HOME||"",SYSTEMROOT:process.env.SYSTEMROOT||""}});
  assert.equal(child.status,0,"MCADMIN_EXACT_HEAD_NATIVE_NONCONSUMING_TEST_FAILED:"+file);
  result.push({file,source_blob_sha:blob(root,head,file),exit_code:child.status,
   stdout_sha256:sha(Buffer.from(child.stdout||""))});
 }
 return result;
}
function rowsFor({authority,plan,projection,historical,baseline,tests,head}){
 const rows={};
 for(const id of SCOPED_IDS){
  const d=plan.decisions.find(x=>x.check_id===id);
  const stage3=id==="STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION";
  rows[id]={
   check_id:id,applicability:d.status,
   status:stage3?"PASS":"NOT_APPLICABLE",
   execution:stage3?"FROZEN_STAGE3_BYTE_REPLAY_AND_CURRENT_SOURCE_NON_EFFECT":
     SCIENCE.has(id)?"CURRENT_PR3780_EXACT_OPERATIONAL_DEPENDENCY_PRESERVATION":
     "PR_SPECIFIC_HISTORICAL_VERIFIER_PRESERVED_QUALIFIED_SUCCESSOR_SCOPE",
   reason_code:stage3?"FROZEN_3730_SIX_BLOBS_VERIFIED_AND_A128_TO_CURRENT_STAGE3_BYTE_INVARIANT":
     SCIENCE.has(id)?"ACTUAL_CHECK_DEPENDENCIES_UNCHANGED_BASE_TO_HEAD_NO_FRESH_SCIENCE_REQUIRED_FOR_MC_ADMIN_DELTA":
     "UNRELATED_HISTORICAL_SOURCE_OR_PR_EVENT_NOT_REPLAYED_ON_3780",
   successor_pr:3780,source_base:BASE,source_head:head,
   exact_no_effect:projection[id],historical_stage3:stage3?historical:null,
   baseline_qcp_run:baseline.qcp_run_id,baseline_accepted_source_only:true,
   old_scientific_result_requalified:false,old_signature_copied:false,
   old_historical_pr_rewritten:false,physical_permit_authorized:false,
   host_started:false,formal_six_stages:0
  };
 }
 rows[CURRENT]={
  check_id:CURRENT,applicability:"REQUALIFY",status:"PASS",
  execution:"CURRENT_HEAD_NATIVE_MC_ADMIN_EXACT_SOURCE_AND_NEGATIVE_TEST_QUALIFICATION",
  reason_code:"CHILD_ONLY_MC_ADMIN_WITH_PREEXISTING_SCOPES_AND_FROZEN_CONTRACTS_PASS",
  source_base:BASE,source_head:head,predecessor:baseline,
  isolated_test_sources:tests,history_mutated:false,
  trust_v2_modified:false,source_approval_signed:false,
  windows_native_physical_receiver_executed:false,
  host_started:false,permit_consumed:false,formal_six_stages:0
 };
 assert.equal(Object.keys(rows).length,15,"MCADMIN_EXACT_FIFTEEN_SCOPED_CHECKS");
 return rows;
}
function verifyProducerAdminSuccessor({ROOT:root=ROOT,args,authority,plan,changed,stage}){
 try{
  assert.equal(process.version,"v20.20.2","MCADMIN_NODE20_EXACT_RUNTIME");
  assert.equal(process.env.GITHUB_ACTIONS,"true","MCADMIN_GITHUB_ACTIONS_REQUIRED");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","MCADMIN_REAL_PR_EVENT_REQUIRED");
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
  assert.equal(args.base,BASE,"MCADMIN_EXACT_BASE");
  assert(/^[a-f0-9]{40}$/.test(args.head));
  assert.equal(git(root,"rev-parse","HEAD"),args.head,"MCADMIN_EXACT_CHECKOUT_HEAD");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.pull_request?.number,3780,"MCADMIN_REAL_PR_NUMBER");
  assert.equal(event.pull_request?.base?.sha,BASE,"MCADMIN_EVENT_BASE");
  assert.equal(event.pull_request?.head?.sha,args.head,"MCADMIN_EVENT_HEAD");
  assert.equal(event.pull_request?.head?.ref,BRANCH,"MCADMIN_EVENT_BRANCH");
  assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX","MCADMIN_EVENT_REPOSITORY");
  assert.equal(event.pull_request?.head?.repo?.full_name,"liyongshang44-max/GEOX","MCADMIN_HEAD_REPOSITORY");
  assert.equal(git(root,"diff","--name-only"),"","MCADMIN_WORKTREE_DIRTY");
  assert.equal(git(root,"diff","--cached","--name-only"),"","MCADMIN_INDEX_DIRTY");
  const paths=gitPaths(root,BASE,args.head);
  exactPathBoundary(paths);assert.deepEqual([...changed].sort(),paths,"MCADMIN_ACTUAL_PATHS_VS_PLANNER");
  const production=frozenProducerBoundary(root,args.head);
  const original=historicalStage3(root,args.head);
  const policy=preservedAuthority(root,args.head,authority);
  const projection=dependencyProjection(root,args.head,authority,plan);
  const predecessor=nativeBaseline(root,args.head);
  const tests=currentNonconsumingTests(root,args.head);
  const rows=rowsFor({authority,plan,projection,historical:original,baseline:predecessor,tests,head:args.head});
  return {status:"PASS",schema_version:"MCFT_CAP09_R4285_MC_ADMIN_SUCCESSOR_QCP_V1",rows,
   head_sha:args.head,base_sha:BASE,production,original,policy,predecessor,
   checked_test_suites:tests.length,old_stage3_replay_attested:true,
   prior_frozen_subject_relabelled:false,zero_external_physical_mutations:true,
   source_approval_signed:false,permit_consumed:false,host_started:false,stages:0};
 }catch(error){return {status:"FAIL",reason_code:"HOLD_R4285_MC_ADMIN_SUCCESSOR_QUALIFICATION",
  failure:String(error.message||error).slice(0,1000),
  source_approval_signed:false,permit_consumed:false,host_started:false,stages:0};}
}
module.exports={BASE,BRANCH,SOURCE,TEST,CONTROL,PREFLIGHT,WORKFLOW,VERIFIER,NEGATIVE,CURRENT,
 SCOPED_IDS,SCIENCE,EXPECTED_PATHS,exactPathBoundary,rowsFor,verifyProducerAdminSuccessor,
 SOURCE_BASE_BLOB,SOURCE_HEAD_BLOB,TEST_BASE_BLOB,TEST_HEAD_BLOB};
