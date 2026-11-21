"use strict";
/* Strict QCP74 source-only gate for PR #3772.
 * No Trust activation, signed payloads, DB, Docker or live execution.
 */
const assert=require("node:assert/strict"),cp=require("node:child_process"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const BASE="9ed82b7c92c7e0ecaaa53a452568e7def7f8a8e6",PR=3772,CHECK="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_SOURCE_V1",RESOLVER="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_PATHS_V1";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
function verify({ROOT,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
 try{
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
  assert.equal(args.base,BASE);assert.equal(git("rev-parse","HEAD"),args.head);
  assert.equal(git("merge-base",args.base,args.head),args.base);
  // Central QCP writes these eight machine results before invoking the source gate.
  // Permit only their untracked output paths; reject any tracked/staged change and
  // every unrecognized untracked file, including new source under any directory.
  const qcpOutputs=new Set(["acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json","acceptance-output/MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json","acceptance-output/MCFT_CAP_09_CP2_CURRENT_PLAN_DEBUG.json","acceptance-output/MCFT_CAP_09_CP2_FUTURE_PLAN_DEBUG.json","acceptance-output/MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json","acceptance-output/MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json","acceptance-output/MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json","acceptance-output/MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json","acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json"]);
  const dirty=git("status","--porcelain=v1","--untracked-files=all").split(/\r?\n/).filter(Boolean);
  const unexpected=dirty.filter(line=>!line.startsWith("?? ")||!qcpOutputs.has(line.slice(3)));
  assert.deepEqual(unexpected,[],"TRUST_V2_SOURCE_WORKTREE_DIRTY");
  assert.equal(plan.status,"PASS");
  assert.deepEqual(plan.unknown_changed_paths,[]);assert.deepEqual(plan.authority_errors,[]);
  const old=JSON.parse(git("show",BASE+":"+QCP));
  assert.equal(old.checks.length,73);assert.equal(authority.checks.length,74);
  assert.deepEqual(authority.checks.slice(0,73),old.checks,"TRUST_V2_PRIOR_73_CHECKS_CHANGED");
  assert.equal(authority.checks[73].check_id,CHECK);
  assert.deepEqual(authority.checks[73].resolver_ids,[RESOLVER]);
  const remaining={...authority.dependency_resolvers};delete remaining[RESOLVER];
  assert.deepEqual(remaining,old.dependency_resolvers,"TRUST_V2_PRIOR_RESOLVERS_CHANGED");
  const paths=git("diff","--name-only",BASE,args.head).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(paths,authority.dependency_resolvers[RESOLVER]?.paths,"TRUST_V2_CHANGED_PATHS_DRIFT");
  assert.deepEqual(changed.slice().sort(),paths);
  assert.deepEqual(paths,[".github/workflows/mcft-cap-09-biological-stage-post-merge-effectiveness-v1.yml",".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs","scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs","scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs","scripts/governance_acceptance/SIGN_MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_ATTESTATION_V2.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_RESTRICTED_PARENT_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_PRODUCER_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json","scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs","scripts/runtime_acceptance/PREPARE_MCFT_CAP09_OPERATOR_V2_KEY_LOCAL.cjs"],"TRUST_V2_UNREVIEWED_SOURCE_PATH");
  assert.equal(git("show",BASE+":"+TRUST),git("show",args.head+":"+TRUST),"TRUST_V2_OLD_TRUST_CHANGED");
  const gate=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
  assert.equal(gate.SOURCE_PATHS.length,23);
  for(const f of gate.SOURCE_PATHS){
   assert.equal(git("ls-tree",BASE,"--",f),git("ls-tree",args.head,"--",f),"TRUST_V2_HISTORIC_23_SOURCE_CHANGED:"+f);
  }
  for(const f of [
   "scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs",
   "scripts/governance_acceptance/SIGN_MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_ATTESTATION_V2.cjs",
   "scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs",
   "scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs",
   "scripts/runtime_acceptance/PREPARE_MCFT_CAP09_OPERATOR_V2_KEY_LOCAL.cjs",
   "scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs"]){
   cp.execFileSync(process.execPath,["--check",f],{cwd:ROOT,timeout:30000,maxBuffer:1048576});
  }
  cp.execFileSync(process.execPath,["--test","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  cp.execFileSync(process.execPath,["--test","scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  cp.execFileSync(process.execPath,["--test","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs"],
   {cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  assert.equal(process.env.GITHUB_ACTIONS,"true","TRUST_V2_GITHUB_ACTIONS_REQUIRED");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","TRUST_V2_GITHUB_EVENT");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.pull_request?.number,PR);assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");
  assert.equal(event.pull_request?.base?.sha,BASE);assert.equal(event.pull_request?.head?.sha,args.head);
  assert.equal(event.pull_request?.head?.ref,"mcft/r4285-trust-v2-successor-20261115");
  return {status:"PASS",base_sha:BASE,head_sha:args.head,changed_paths:paths.length,
   trust_v1_unchanged:true,historical_source_23_preserved:true,trust_v2_activated:false,
   synthetic_negative_tests:true,signatures_created:false,permit_issued:false,stages:0};
 }catch(e){
  return {status:"FAIL",reason_code:"HOLD_R4285_TRUST_V2_QCP74_SOURCE",
   failure:String(e.message||e).slice(0,450),trust_v2_activated:false,permit_issued:false,stages:0};
 }
}
module.exports={verify};

// Exact #3776 Timing successor. This is source-delta qualification, not a
// replacement of historical scientific evidence or a grant of execution rights.
const TIMING_BASE="27dd160877d81446faaa857b0c80428eb80735c0";
const TIMING_PREDECESSOR="1f1e2704543924560139e7ec05c67a6d06f5dc45";
const TIMING_SOURCE="47a617ff095c77aebf73c564a22509518f1f60e0";
const TIMING_FILE="scripts/runtime_acceptance/RUN_MCFT_CAP09_R4285_TIMING_V1.ts";
const TIMING_TEST="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_DA9_RETENTION_AUTHORITY_CONTRACT_V1.ts";
const TIMING_WORKFLOW=".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml";
const TIMING_GATE="scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs";
const TIMING_PREFLIGHT="scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs";
const TIMING_AUX=[".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml", ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"];
const TIMING_AUX_HASHES={".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml": "79f16bcafdfe7c37e0a7368d7535e4c4f1eaf829fa405808123cc5eeba36ef86", ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml": "e7844909532835f69bc55af851025e4314d11d1d6c5deea56e82e862fb08837a"};
const TIMING_NEGATIVES="scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs";
function validateTimingDeltaProof(p){
 assert.equal(p.base,TIMING_BASE,"TIMING_BASE");
 assert.equal(p.stage,"SUCCESSOR_SUBJECT_PRE_MERGE","TIMING_STAGE");
 assert.equal(p.pr,3776,"TIMING_PR");
 assert.equal(p.branch,"fix/r4285-qcp-timing-path-triggers","TIMING_BRANCH");
 assert.deepEqual(p.paths.slice().sort(),[TIMING_WORKFLOW,TIMING_GATE,TIMING_PREFLIGHT,TIMING_NEGATIVES,...TIMING_AUX].sort(),"TIMING_EXACT_PATHS");
 assert.deepEqual(p.aux_sha256,TIMING_AUX_HASHES,"TIMING_HISTORICAL_WORKFLOW_DRIFT");
 assert.equal(p.workflow_sha256,"66831e46e7a1e9c50f96bc041b54fee5245119abaee6d263e951b5e4b7b0cb46","TIMING_WORKFLOW_DELTA");
 assert.equal(p.preflight_sha256,"0d5fdcc82e6398c69f90fd93529e62d8f2d7758aa7f3ca9c315b7606a90ad3a7","TIMING_PREFLIGHT_DELTA");
 assert.equal(p.timing_blob,"46868f9d0684934094a45ce431e272fbf00657fd","TIMING_BODY_DRIFT");
 assert.equal(p.test_blob,"279fa791d6ded0415f0b5831f5fdb95cbff70f2e","TIMING_REGRESSION_DRIFT");
 for(const k of ["manifest_unchanged","gate_prefix_preserved","tests_prefix_preserved","clean","merge_tree_exact","original_timing_negative_detected"])
  assert.equal(p[k],true,"TIMING_PROOF_REQUIRED:"+k);
 assert.deepEqual(p.unknown,[],"TIMING_UNKNOWN_PATH");
 assert.deepEqual(p.authority_errors,[],"TIMING_AUTHORITY_ERROR");
 return true;
}
function verifyTimingSuccessor({ROOT,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
 const bytes=(ref,f)=>cp.execFileSync("git",["show",ref+":"+f],{cwd:ROOT,timeout:30000,maxBuffer:16*1024*1024});
 const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
 const blob=(ref,f)=>git("rev-parse",ref+":"+f);
 const api=(suffix,binary=false)=>{
  const b=cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/"+suffix],
   {cwd:ROOT,timeout:60000,maxBuffer:32*1024*1024,stdio:["ignore","pipe","pipe"]});
  return binary?b:JSON.parse(b.toString("utf8"));
 };
 try{
  assert.equal(process.env.GITHUB_ACTIONS,"true","TIMING_NATIVE_GITHUB_REQUIRED");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","TIMING_NATIVE_PR_REQUIRED");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");
  assert.equal(event.pull_request?.head?.sha,args.head);
  assert.equal(event.pull_request?.base?.sha,args.base);
  assert.equal(event.pull_request?.head?.repo?.full_name,event.repository.full_name);
  assert.equal(git("rev-parse","HEAD"),args.head);
  assert.equal(git("merge-base",args.base,args.head),TIMING_BASE);
  assert.equal(plan.status,"PASS");assert.equal(authority.checks.length,74);
  assert(bytes(TIMING_PREDECESSOR,QCP).equals(bytes(args.head,QCP)),"TIMING_QCP_MANIFEST_CHANGED");
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean);
  assert.deepEqual(changed.slice().sort(),paths.slice().sort());
  const originalGate=bytes(args.base,TIMING_GATE),originalTests=bytes(args.base,TIMING_NEGATIVES);
  const outputs=new Set(["MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json","MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json","MCFT_CAP_09_CP2_CURRENT_PLAN_DEBUG.json","MCFT_CAP_09_CP2_FUTURE_PLAN_DEBUG.json","MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json","MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json","MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json","MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json","MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json"].map(f=>"acceptance-output/"+f));
  const dirty=git("status","--porcelain=v1","--untracked-files=all").split(/\r?\n/).filter(Boolean);
  const clean=dirty.every(line=>line.startsWith("?? ")&&outputs.has(line.slice(3)));
  // Bind the only two runtime/test changes to the reviewed, native-tested #3775.
  assert.deepEqual(git("diff","--name-only",TIMING_PREDECESSOR,TIMING_BASE).split(/\r?\n/).sort(),[TIMING_TEST,TIMING_FILE].sort());
  assert.equal(git("rev-parse",TIMING_BASE+"^1"),TIMING_PREDECESSOR);
  assert.equal(git("rev-parse",TIMING_BASE+"^2"),TIMING_SOURCE);
  for(const f of [TIMING_FILE,TIMING_TEST])assert.equal(blob(TIMING_BASE,f),blob(args.head,f));
  const merged=api("pulls/3775");
  assert.equal(merged.merged,true);assert.equal(merged.merge_commit_sha,TIMING_BASE);
  assert.equal(merged.head.sha,TIMING_SOURCE);assert.equal(merged.base.sha,TIMING_PREDECESSOR);
  for(const [id,name,workflow] of [[44678804254,"ci",".github/workflows/ci.yml"],
   [44678804280,"mcft-cap09-da9-nonauthorized-real-s3-pg-full-chain",".github/workflows/mcft-cap09-da9-nonauthorized-real-s3-pg-full-chain.yml"]]){
   const r=api("actions/runs/"+id);assert.equal(r.id,id);assert.equal(r.name,name);
   assert.equal(r.path,workflow);assert.equal(r.head_sha,TIMING_SOURCE);
   assert.equal(r.event,"pull_request");assert.equal(r.status,"completed");assert.equal(r.conclusion,"success");
  }
  // Verify actual immutable original QCP bytes; do not manufacture carry-forward.
  const originalPr=api("pulls/3772"),qcpRun=api("actions/runs/43679771739");
  assert.equal(originalPr.merged,true);assert.equal(originalPr.merge_commit_sha,TIMING_PREDECESSOR);
  assert.equal(qcpRun.head_sha,originalPr.head.sha);assert.equal(qcpRun.event,"pull_request");
  assert.equal(qcpRun.name,"mcft-cap-09-qualification-control-plane-v1");
  assert.equal(qcpRun.path,TIMING_WORKFLOW);assert.equal(qcpRun.status,"completed");assert.equal(qcpRun.conclusion,"success");
  const artifact=api("actions/artifacts/14147828585");
  assert.equal(artifact.workflow_run.id,qcpRun.id);assert.equal(artifact.workflow_run.head_sha,originalPr.head.sha);
  const zip=api("actions/artifacts/14147828585/zip",true);
  assert.equal(hash(zip),"48f68fd3e5c5bb5ea76ad95c466367c435ccf6fab68828e21128f406d5e74b12");
  assert.equal(artifact.digest,"sha256:"+hash(zip));
  const raw=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs").zipRaw(zip);
  assert.equal(hash(raw),"c6aafe9ad760573fadb6f79273692a854496a6a658f6b88415c9cbb8f01ff411");
  const prior=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs")
   .checkQcp74(JSON.parse(raw),authority,originalPr.head.sha,originalPr.base.sha);
  assert.equal(prior.status,"V2_QCP74_EXACT_SOURCE_VERIFIED_NO_ADOPTION");
  // Real validator/constructor contract test, no Stage wrapper import or PG/S3 I/O.
  const suite=cp.execFileSync(process.execPath,["--import","tsx",TIMING_TEST],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024}).toString();
  assert(suite.includes('"suite":"R4285_TIMING_RETENTION_BINDING"')&&suite.includes('"status":"PASS"'));
  // Check the actual old constructor argument against the new regression without
  // altering the checked-out source. The bounded test subprocess must reject it.
  const old=bytes(TIMING_PREDECESSOR,TIMING_FILE).toString();
  const ts=require("typescript"),file=ts.createSourceFile("old.ts",old,ts.ScriptTarget.Latest,true),nodes=[];
  const visit=n=>{if(ts.isNewExpression(n)&&n.expression.getText(file)==="PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1")nodes.push(n);ts.forEachChild(n,visit);};visit(file);
  assert.equal(nodes.length,1);
  const oldConfig=require("node:vm").runInNewContext("("+nodes[0].arguments[2].getText(file)+")",{MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1:"test",epoch:"test",subject:"b".repeat(40)});
  assert.equal(oldConfig.retention_authority,undefined,"TIMING_ORIGINAL_DEFECT_NOT_PRESENT");
  validateTimingDeltaProof({base:args.base,stage,pr:event.pull_request.number,branch:event.pull_request.head.ref,paths,
   aux_sha256:Object.fromEntries(TIMING_AUX.map(f=>[f,hash(bytes(args.head,f))])),
   workflow_sha256:hash(bytes(args.head,TIMING_WORKFLOW)),preflight_sha256:hash(bytes(args.head,TIMING_PREFLIGHT)),
   timing_blob:blob(args.head,TIMING_FILE),test_blob:blob(args.head,TIMING_TEST),
   manifest_unchanged:true,gate_prefix_preserved:bytes(args.head,TIMING_GATE).subarray(0,originalGate.length).equals(originalGate),
   tests_prefix_preserved:bytes(args.head,TIMING_NEGATIVES).subarray(0,originalTests.length).equals(originalTests),
   clean,merge_tree_exact:git("rev-parse",TIMING_BASE+"^{tree}")===git("rev-parse",TIMING_SOURCE+"^{tree}"),
   original_timing_negative_detected:true,unknown:plan.unknown_changed_paths,authority_errors:plan.authority_errors});
  for(const f of [TIMING_NEGATIVES,"scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs",
   "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs"])
   cp.execFileSync(process.execPath,["--test",f],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  return {status:"PASS",base_sha:args.base,head_sha:args.head,source_delta_only:true,
   baseline_qcp_run_id:43679771739,reviewed_timing_source:TIMING_SOURCE,
   timing_regression_pass:true,original_missing_authority_detected:true,
   historical_scientific_results_reissued:false,trust_activated:false,signatures_created:false,
   permit_issued:false,permit_consumed:false,execute_authorized:false,stages:0};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_EXACT_TIMING_SUCCESSOR_SOURCE",failure:String(e.message||e).slice(0,500),permit_issued:false,stages:0};}
}
module.exports.validateTimingDeltaProof=validateTimingDeltaProof;
module.exports.verifyTimingSuccessor=verifyTimingSuccessor;

// PR #3777: qualify only the Trust registration/current Subject separation.
// Prior physical/scientific evidence stays historical, never an execution PASS.
const TRUST_SUBJECT_BASE="37dfa24ee6e60891995836f7a142a898c445d9df";
const TRUST_SUBJECT_HASHES=Object.freeze({"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.cjs": "49cc6c6649f5195363630b228ac8df59e3985e6f1af2e23f9e36861f3121d61f", "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs": "7df7d9f62d5a59e76c91294421dc9255a5cbb5c12ebf582da4d4c9f4e0762a1c", ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml": "8955a3af3ceffabcd7c6817dc0b42fbf669d1d5e1573bcd897dab4cbf62b87e6", "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs": "a835dc2c924611136a3e938edec1af5b6b7b9320eaa53a0b5e4dd7ae07aaeccf", ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml": "97c5bbdbec3218a0b04ed9f15fdb91c10a8e9caddd03b10c869f7c2612457d2d", ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml": "d86353ede488b1ba6566637c5b6d467a75e7611c762b8678e14697dbb2536f2e"});
function verifyTrustSubjectSuccessor({ROOT,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
 const bytes=(ref,f)=>cp.execFileSync("git",["show",ref+":"+f],{cwd:ROOT,timeout:30000,maxBuffer:16*1024*1024});
 const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
 const api=(p)=>JSON.parse(cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/"+p],{cwd:ROOT,timeout:60000,maxBuffer:8*1024*1024}));
 try{
  assert.equal(process.env.GITHUB_ACTIONS,"true","TRUST_SUBJECT_NATIVE_CI_REQUIRED");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","TRUST_SUBJECT_PR_REQUIRED");
  assert.equal(process.version,"v20.20.2","TRUST_SUBJECT_NODE20_REQUIRED");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");
  assert.equal(event.pull_request?.number,3777);assert.equal(event.pull_request?.base?.sha,TRUST_SUBJECT_BASE);
  assert.equal(event.pull_request?.head?.ref,"fix/r4285-trust-v2-successor-subject");
  assert.equal(event.pull_request?.head?.repo?.full_name,event.repository.full_name);
  assert.equal(event.pull_request?.head?.sha,args.head);assert.equal(args.base,TRUST_SUBJECT_BASE);
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");
  assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",args.base,args.head),args.base);
  assert.equal(plan.status,"PASS");assert.deepEqual(plan.unknown_changed_paths,[]);assert.deepEqual(plan.authority_errors,[]);
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();
  const expected=[...Object.keys(TRUST_SUBJECT_HASHES),"scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs"].sort();
  assert.deepEqual(paths,expected,"TRUST_SUBJECT_EXACT_DELTA_PATHS");assert.deepEqual(changed.slice().sort(),paths);
  for(const [f,digest] of Object.entries(TRUST_SUBJECT_HASHES))assert.equal(hash(bytes(args.head,f)),digest,"TRUST_SUBJECT_UNREVIEWED_DELTA:"+f);
  const self="scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs";
  const prior=bytes(args.base,self);assert(bytes(args.head,self).subarray(0,prior.length).equals(prior),"TRUST_SUBJECT_HISTORICAL_SOURCE_GATE_CHANGED");
  const tests="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs",oldTests=bytes(args.base,tests);
  assert(bytes(args.head,tests).subarray(0,oldTests.length).equals(oldTests),"TRUST_SUBJECT_OLD_ASSERTIONS_CHANGED");
  const outputs=new Set(["MCFT_CAP_09_CHECK_APPLICABILITY_V1_RESULT.json","MCFT_CAP_09_CP2_GENERATION_DEPENDENCY_DIGEST_V1_RESULT.json","MCFT_CAP_09_CP2_CURRENT_PLAN_DEBUG.json","MCFT_CAP_09_CP2_FUTURE_PLAN_DEBUG.json","MCFT_CAP_09_IMMUTABLE_EVIDENCE_REFS_V1_RESULT.json","MCFT_CAP_09_CHECK_APPLICABILITY_V1_PLAN.json","MCFT_CAP_09_ALL_BLOCKERS_PREFLIGHT_V1_RESULT.json","MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1_RESULT.json","MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH_V4.json"].map(f=>"acceptance-output/"+f));
  assert(git("status","--porcelain=v1","--untracked-files=all").split(/\r?\n/).filter(Boolean).every(l=>l.startsWith("?? ")&&outputs.has(l.slice(3))),"TRUST_SUBJECT_WORKTREE_DIRTY");
  assert(bytes(args.base,QCP).equals(bytes(args.head,QCP)),"TRUST_SUBJECT_QCP_MANIFEST_CHANGED");assert.equal(authority.checks.length,74);
  const fullchain=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
  assert.equal(fullchain.SOURCE_PATHS.length,23);
  for(const f of fullchain.SOURCE_PATHS)assert(bytes(args.base,f).equals(bytes(args.head,f)),"TRUST_SUBJECT_HISTORICAL_23_CHANGED:"+f);
  for(const f of [TRUST,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json",
   "scripts/runtime_acceptance/RUN_MCFT_CAP09_R4285_TIMING_V1.ts",
   "scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs",
   "scripts/cap09_adoption_v1/SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2_LOCAL.cjs"])
   assert(bytes(args.base,f).equals(bytes(args.head,f)),"TRUST_SUBJECT_OTHER_RUNTIME_CHANGED:"+f);
  // Independently read the accepted predecessor QCP/CI and actual artifact bytes.
  const meta={repository:"liyongshang44-max/GEOX",pr_number:3776,base_sha:"27dd160877d81446faaa857b0c80428eb80735c0",
   source_head_sha:"845d18fcec58130f1fa80f055a5049ba2bd66155",subject_sha:TRUST_SUBJECT_BASE,
   qcp_run_id:44691239747,qcp_run_attempt:1,qcp_job_id:136137300825,qcp_artifact_id:14608358189,
   qcp_zip_sha256:"23be964b3a6d98920284fcb53a8e5236491c73d76a66ff1aecfb79a05139a52e",
   qcp_raw_sha256:"05d44dbd040d3783c76ec83a77afd6cd80bc3b3f016f0a047ac2ea216e370761",ci_run_id:44691239755,ci_run_attempt:1};
  const zip=cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/actions/artifacts/14608358189/zip"],{cwd:ROOT,timeout:60000,maxBuffer:32*1024*1024});
  const zipRaw=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs").zipRaw,raw=zipRaw(zip);
  const baseline=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs").verifyGitHubNativeProof(meta,{
   pr:api("pulls/3776"),baseCommit:api("git/commits/"+meta.base_sha),sourceCommit:api("git/commits/"+meta.source_head_sha),
   mergeCommit:api("git/commits/"+meta.subject_sha),main:api("git/ref/heads/main"),qcpRun:api("actions/runs/44691239747"),
   qcpJobs:api("actions/runs/44691239747/attempts/1/jobs?per_page=100"),qcpArtifacts:api("actions/runs/44691239747/artifacts?per_page=100"),ciRun:api("actions/runs/44691239755")
  },raw,zip,authority,zipRaw);
  for(const f of [tests,"scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs",
   "scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs"])
   cp.execFileSync(process.execPath,["--test",f],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024});
  return {status:"PASS",base_sha:args.base,head_sha:args.head,changed_paths:paths.length,
   source_delta_only:true,baseline_qcp_run_id:meta.qcp_run_id,baseline_native_proof:baseline.status,
   trust_v1_v2_bytes_preserved:true,historical_23_preserved:true,old_assertions_preserved:true,
   regression_suites:3,historical_scientific_results_reissued:false,signatures_transferred:false,
   trust_activated:false,permit_issued:false,permit_consumed:false,execute_authorized:false,stages:0};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_TRUST_SUBJECT_SUCCESSOR_SOURCE",failure:String(e.message||e).slice(0,600),permit_issued:false,stages:0};}
}
module.exports.verifyTrustSubjectSuccessor=verifyTrustSubjectSuccessor;

// PR3778: exact Node20 loader source qualification; no live admission authority.
const LOADER_BASE="f74a5677b6ecd784e283c25d71e7253897df15a1",LOADER_BRANCH="fix/r4285-node20-pinned-loading-candidate";
const LOADER_HASHES=Object.freeze({
 "scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs":"c436cae9f793904fef17cc890070518b095dd439d038234fdb40331feb402f07",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs":"bdcecee8f458682ee0d06574a3e0b1eedb53d406988bbd08cddec8364debf11d"
});
const LOADER_WIRING=Object.freeze([
 ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
 "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs",
 ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
 ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"
]);
const LOADER_CHECKS=Object.freeze(["CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1",CHECK]);
function inspectLoaderDelta({base,stage,paths,hashes,plan}){
 assert.equal(base,LOADER_BASE,"LOADER_EXACT_BASE");assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","LOADER_EXACT_STAGE");
 assert.equal(plan.status,"PASS");for(const k of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[k],[],"LOADER_PLAN_UNRESOLVED");
 assert.deepEqual(paths.slice().sort(),[...Object.keys(LOADER_HASHES),...LOADER_WIRING].sort(),"LOADER_EXACT_EIGHT_SOURCE_PATHS");
 for(const [f,h] of Object.entries(LOADER_HASHES))assert.equal(hashes[f],h,"LOADER_CANDIDATE_BYTES_CHANGED:"+f);
 return Object.freeze({status:"INSPECTED_EXACT_DELTA_NOT_NATIVE_QUALIFICATION",runtime_paths:Object.keys(LOADER_HASHES),qualification_wiring_paths:[...LOADER_WIRING]});
}
function loaderDependencyProjection(paths,baseBlobs,headBlobs){
 const rows=[];for(const f of [...new Set(paths)].sort()){
  if(LOADER_WIRING.includes(f))continue;
  assert(baseBlobs.has(f)&&headBlobs.has(f),"LOADER_DEPENDENCY_MISSING:"+f);
  assert.equal(headBlobs.get(f),baseBlobs.get(f),"LOADER_UNDECLARED_RUNTIME_QUALIFICATION_IMPACT:"+f);rows.push([f,headBlobs.get(f)]);
 }
 return {path_count:rows.length,git_blob_catalog_sha256:crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex")};
}
function verifyLoaderSuccessor({ROOT,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:32*1024*1024}).trim();
 const bytes=(sha,f)=>cp.execFileSync("git",["show",sha+":"+f],{cwd:ROOT,timeout:30000,maxBuffer:8*1024*1024});
 const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
 const api=p=>JSON.parse(cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/"+p],{cwd:ROOT,encoding:"utf8",timeout:60000,maxBuffer:8*1024*1024}));
 try{
  assert.equal(process.version,"v20.20.2","LOADER_EXACT_NODE20_SOURCE_RUNTIME");
  assert.equal(process.env.GITHUB_ACTIONS,"true","LOADER_NATIVE_GITHUB_ONLY");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.pull_request?.number,3778);assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");assert.equal(event.pull_request?.head?.repo?.full_name,event.repository.full_name);
  assert.equal(event.pull_request?.base?.sha,args.base);assert.equal(event.pull_request?.head?.sha,args.head);assert.equal(event.pull_request?.head?.ref,LOADER_BRANCH);
  assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",args.base,args.head),args.base);
  assert.equal(git("rev-parse",args.base+"^{tree}"),"f57a859fe75f16691f50330af15d52e77d7bc61a");
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed.slice().sort(),paths);
  inspectLoaderDelta({base:args.base,stage,paths,hashes:Object.fromEntries(Object.keys(LOADER_HASHES).map(f=>[f,hash(bytes(args.head,f))])),plan});
  assert.equal(git("diff","--name-only"),"","LOADER_TRACKED_WORKTREE_DRIFT");assert.equal(git("diff","--cached","--name-only"),"","LOADER_STAGED_WORKTREE_DRIFT");
  assert(bytes(args.base,QCP).equals(bytes(args.head,QCP)),"LOADER_QCP74_DEFINITIONS_CHANGED");assert.equal(authority.checks.length,74);
  // Retain all previous verifier and Trust test bytes; only append this gate.
  for(const f of LOADER_WIRING.slice(2,4)){const before=bytes(args.base,f);assert(bytes(args.head,f).subarray(0,before.length).equals(before),"LOADER_OLD_QUALIFICATION_ASSERTIONS_CHANGED:"+f);}
  const pre=LOADER_WIRING[1],current=bytes(args.head,pre).toString();
  const stripped=current.replace(/    \/\/ BEGIN PR3778 EXACT LOADER ROUTE[\s\S]*?    \/\/ END PR3778 EXACT LOADER ROUTE\n/g,"").replace(/  \/\/ BEGIN PR3778 EXACT LOADER PROOF[\s\S]*?  \/\/ END PR3778 EXACT LOADER PROOF\n/g,"");
  assert.equal(stripped,bytes(args.base,pre).toString(),"LOADER_PRIOR_PREFLIGHT_CHANGED");
  const workflow=LOADER_WIRING[0],oldWorkflow=bytes(args.base,workflow).toString();
  const addition=" || (github.event.pull_request.number == 3778 && github.event.pull_request.base.sha == '"+LOADER_BASE+"' && github.head_ref == '"+LOADER_BRANCH+"')";
  assert.equal(bytes(args.head,workflow).toString().replace(addition,""),oldWorkflow,"LOADER_OTHER_WORKFLOW_CHANGED");
  const shellAddition=" || { [ \"${{ github.event.pull_request.number }}\" = \"3778\" ] && [ \"${{ github.event.pull_request.base.sha }}\" = \"f74a5677b6ecd784e283c25d71e7253897df15a1\" ] && [ \"${{ github.head_ref }}\" = \"fix/r4285-node20-pinned-loading-candidate\" ]; }";
  for(const f of LOADER_WIRING.slice(4)){const routed=bytes(args.head,f).toString();assert.equal(routed.split(shellAddition).join("").split(addition).join(""),bytes(args.base,f).toString(),"LOADER_HISTORICAL_WORKFLOW_CHANGED:"+f);}
  const historical=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");for(const f of historical.SOURCE_PATHS)assert(bytes(args.base,f).equals(bytes(args.head,f)),"LOADER_HISTORICAL_23_CHANGED:"+f);
  for(const f of [TRUST,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json","scripts/runtime_acceptance/MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs"])
   assert(bytes(args.base,f).equals(bytes(args.head,f)),"LOADER_UNAUTHORIZED_RUNTIME_CHANGED:"+f);
  // Real native predecessor: QCP artifact bytes plus exact merge/QCP/CI metadata.
  const meta={repository:"liyongshang44-max/GEOX",pr_number:3777,base_sha:"37dfa24ee6e60891995836f7a142a898c445d9df",source_head_sha:"5862de274e83ebfb33e3be8da53692bd72832e0d",subject_sha:LOADER_BASE,qcp_run_id:44729553238,qcp_run_attempt:1,qcp_job_id:136265535989,qcp_artifact_id:14626430343,qcp_zip_sha256:"43ecc24a780cd13e8adf7960a31dcdbcbb9feffd36b5e7cf29a9464c39f8b454",qcp_raw_sha256:"5e4c0c37ecb3502f0583ae3b7c3ba42b25e8c6087b0c0be5a15a7f8fab9e0245",ci_run_id:44729553114,ci_run_attempt:1};
  const zip=cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/actions/artifacts/14626430343/zip"],{cwd:ROOT,timeout:60000,maxBuffer:32*1024*1024});
  const zipRaw=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs").zipRaw,raw=zipRaw(zip);
  const baseline=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs").verifyGitHubNativeProof(meta,{pr:api("pulls/3777"),baseCommit:api("git/commits/"+meta.base_sha),sourceCommit:api("git/commits/"+meta.source_head_sha),mergeCommit:api("git/commits/"+LOADER_BASE),main:api("git/ref/heads/main"),qcpRun:api("actions/runs/44729553238"),qcpJobs:api("actions/runs/44729553238/attempts/1/jobs?per_page=100"),qcpArtifacts:api("actions/runs/44729553238/artifacts?per_page=100"),ciRun:api("actions/runs/44729553114")},raw,zip,authority,zipRaw);
  const currentPR=api("pulls/3778");assert.equal(currentPR.head.sha,args.head);assert.equal(currentPR.base.sha,args.base);assert.equal(currentPR.head.ref,LOADER_BRANCH);
  const nativeJobs=api("actions/runs/"+process.env.GITHUB_RUN_ID+"/jobs?per_page=100"),nativeJob=nativeJobs.jobs.find(j=>j.name==="applicability-and-blocker-inventory");
  for(const name of ["Prove central applicability semantics","Prove generation, durable-anchor, and dependency-digest semantics","Resolve immutable qualification evidence references","Attest exact QCP source identity after historical diagnostics"])
   assert(nativeJob?.steps.some(s=>s.name===name&&s.conclusion==="success"),"LOADER_CURRENT_NATIVE_CONTROL_STEP_REQUIRED:"+name);
  const suites=["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs"];
  const tests=[];for(const f of suites){const r=cp.spawnSync(process.execPath,["--test",f],{cwd:ROOT,encoding:"utf8",timeout:120000,maxBuffer:4*1024*1024});assert.equal(r.status,0,"LOADER_EXACT_REGRESSION_FAILED:"+f);tests.push({file:f,source_sha256:hash(bytes(args.head,f)),exit_code:r.status,stdout_sha256:hash(Buffer.from(r.stdout))});}
  const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"),registry=JSON.parse(bytes(args.head,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json"));
  const context=planner.prepareApplicabilityContext({root:ROOT,authority,registry,generation:"v13",headSha:args.head});assert.deepEqual(context.definitionErrors,[]);assert.deepEqual(context.resolverResult.errors,[]);
  const catalog=sha=>new Map(git("ls-tree","-r",sha).split(/\r?\n/).map(l=>{const at=l.indexOf("\t");return [l.slice(at+1),l.slice(0,at).split(" ")[2]];}));const baseBlobs=catalog(args.base),headBlobs=catalog(args.head),baselineRows=new Map(JSON.parse(raw).results.map(r=>[r.check_id,r]));
  const rows={};for(const definition of authority.checks){const id=definition.check_id,decision=plan.decisions.find(d=>d.check_id===id);assert(decision,"LOADER_CURRENT_CHECK_MISSING");assert(baselineRows.has(id),"LOADER_BASELINE_CHECK_MISSING");
   if(LOADER_CHECKS.includes(id)){rows[id]={check_id:id,applicability:decision.status,status:"PASS",execution:"EXACT_PR3778_NODE20_NATIVE_SOURCE_QUALIFICATION",reason_code:"NODE20_EXACT_SOURCE_AND_REGISTERED_TRUST_NEGATIVES_PASS",current_source:{base_sha:args.base,head_sha:args.head,candidate_runtime_sha256:LOADER_HASHES,baseline_qcp_run_id:meta.qcp_run_id,native_baseline_status:baseline.status,tests},whole_120s_admission:"UNPROVEN"};continue;}
   const owned=[...new Set(definition.resolver_ids.flatMap(r=>{assert(context.resolverResult.resolved[r],"LOADER_CHECK_RESOLVER_MISSING");return context.resolverResult.resolved[r].paths;}))];const projection=loaderDependencyProjection(owned,baseBlobs,headBlobs);
   rows[id]={check_id:id,applicability:decision.status,status:id==="CONTROL_PLANE_INTEGRITY"?"PASS":"NOT_APPLICABLE",execution:id==="CONTROL_PLANE_INTEGRITY"?"CURRENT_NATIVE_CONTROL_PLANE_STEPS_EXACT_SOURCE":"PER_CHECK_UNCHANGED_OPERATIONAL_SOURCE_PROJECTION",reason_code:id==="CONTROL_PLANE_INTEGRITY"?"CURRENT_NATIVE_PLANNER_AND_EXACT_ROUTING_PROVEN":"EXACT_CHECK_DEPENDENCIES_UNCHANGED_NO_HISTORICAL_REISSUE",current_source:{base_sha:args.base,head_sha:args.head,resolver_ids:definition.resolver_ids,operational_projection:projection,changed_qualification_wiring:paths.filter(f=>owned.includes(f)&&LOADER_WIRING.includes(f)),baseline_qcp_run_id:meta.qcp_run_id,baseline_check_status:baselineRows.get(id).status},historical_qualification_reissued:false};
  }
  assert.equal(Object.keys(rows).length,74);return {status:"PASS",rows,permit_issued:false,permit_consumed:false,stages:0};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_EXACT_NODE20_LOADER_SOURCE_QUALIFICATION",failure:String(e.message||e).slice(0,700),permit_consumed:false,stages:0};}
}
module.exports.inspectLoaderDelta=inspectLoaderDelta;
module.exports.loaderDependencyProjection=loaderDependencyProjection;
module.exports.verifyLoaderSuccessor=verifyLoaderSuccessor;
module.exports.LOADER_HASHES=LOADER_HASHES;
module.exports.LOADER_WIRING=LOADER_WIRING;

// PR3779: exact Node20 physical source qualification; no live admission authority.
const PHYSICAL_BASE="d97f4b6dadcfa894025fd1634bd69c1c01a8761c",PHYSICAL_BRANCH="fix/r4285-physical-cli-producer-candidate";
const PHYSICAL_HASHES=Object.freeze({
 "scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs": "98c51499947a380f7370e2896c8551b70de18fa37dd52f0d2dd09e4a4bfa5024",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs": "5e02277e69cd7e9d0b4ae1e4c2eb9d1256af917d9bb3b83c59a584a10d42f5ad"
});
const PHYSICAL_WIRING=Object.freeze([
 ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
 "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs",
 ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
 ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"
]);
const PHYSICAL_CHECKS=Object.freeze(["CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1",CHECK]);
function inspectPhysicalDelta({base,stage,paths,hashes,plan}){
 assert.equal(base,PHYSICAL_BASE,"PHYSICAL_EXACT_BASE");assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE","PHYSICAL_EXACT_STAGE");
 assert.equal(plan.status,"PASS");for(const k of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[k],[],"PHYSICAL_PLAN_UNRESOLVED");
 assert.deepEqual(paths.slice().sort(),[...Object.keys(PHYSICAL_HASHES),...PHYSICAL_WIRING].sort(),"PHYSICAL_EXACT_EIGHT_SOURCE_PATHS");
 for(const [f,h] of Object.entries(PHYSICAL_HASHES))assert.equal(hashes[f],h,"PHYSICAL_CANDIDATE_BYTES_CHANGED:"+f);
 return Object.freeze({status:"INSPECTED_EXACT_DELTA_NOT_NATIVE_QUALIFICATION",runtime_paths:Object.keys(PHYSICAL_HASHES),qualification_wiring_paths:[...PHYSICAL_WIRING]});
}
function physicalDependencyProjection(paths,baseBlobs,headBlobs){
 const rows=[];for(const f of [...new Set(paths)].sort()){
  if(PHYSICAL_WIRING.includes(f))continue;
  assert(baseBlobs.has(f)&&headBlobs.has(f),"PHYSICAL_DEPENDENCY_MISSING:"+f);
  assert.equal(headBlobs.get(f),baseBlobs.get(f),"PHYSICAL_UNDECLARED_RUNTIME_QUALIFICATION_IMPACT:"+f);rows.push([f,headBlobs.get(f)]);
 }
 return {path_count:rows.length,git_blob_catalog_sha256:crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex")};
}
function verifyPhysicalSuccessor({ROOT,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:32*1024*1024}).trim();
 const bytes=(sha,f)=>cp.execFileSync("git",["show",sha+":"+f],{cwd:ROOT,timeout:30000,maxBuffer:8*1024*1024});
 const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
 const api=p=>JSON.parse(cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/"+p],{cwd:ROOT,encoding:"utf8",timeout:60000,maxBuffer:8*1024*1024}));
 try{
  assert.equal(process.version,"v20.20.2","PHYSICAL_EXACT_NODE20_SOURCE_RUNTIME");
  assert.equal(process.env.GITHUB_ACTIONS,"true","PHYSICAL_NATIVE_GITHUB_ONLY");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(event.pull_request?.number,3779);assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");assert.equal(event.pull_request?.head?.repo?.full_name,event.repository.full_name);
  assert.equal(event.pull_request?.base?.sha,args.base);assert.equal(event.pull_request?.head?.sha,args.head);assert.equal(event.pull_request?.head?.ref,PHYSICAL_BRANCH);
  assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",args.base,args.head),args.base);
  assert.equal(git("rev-parse",args.base+"^{tree}"),"5ae4f6c731a0ddd005f8ac4db35d627360b4ab6b");
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed.slice().sort(),paths);
  inspectPhysicalDelta({base:args.base,stage,paths,hashes:Object.fromEntries(Object.keys(PHYSICAL_HASHES).map(f=>[f,hash(bytes(args.head,f))])),plan});
  assert.equal(git("diff","--name-only"),"","PHYSICAL_TRACKED_WORKTREE_DRIFT");assert.equal(git("diff","--cached","--name-only"),"","PHYSICAL_STAGED_WORKTREE_DRIFT");
  assert(bytes(args.base,QCP).equals(bytes(args.head,QCP)),"PHYSICAL_QCP74_DEFINITIONS_CHANGED");assert.equal(authority.checks.length,74);
  // Retain all previous verifier and Trust test bytes; only append this gate.
  for(const f of PHYSICAL_WIRING.slice(2,4)){const before=bytes(args.base,f);assert(bytes(args.head,f).subarray(0,before.length).equals(before),"PHYSICAL_OLD_QUALIFICATION_ASSERTIONS_CHANGED:"+f);}
  const pre=PHYSICAL_WIRING[1],current=bytes(args.head,pre).toString();
  const stripped=current.replace(/    \/\/ BEGIN PR3779 EXACT PHYSICAL ROUTE[\s\S]*?    \/\/ END PR3779 EXACT PHYSICAL ROUTE\n/g,"").replace(/  \/\/ BEGIN PR3779 EXACT PHYSICAL PROOF[\s\S]*?  \/\/ END PR3779 EXACT PHYSICAL PROOF\n/g,"");
  assert.equal(stripped,bytes(args.base,pre).toString(),"PHYSICAL_PRIOR_PREFLIGHT_CHANGED");
  const workflow=PHYSICAL_WIRING[0],oldWorkflow=bytes(args.base,workflow).toString();
  const addition=" || (github.event.pull_request.number == 3779 && github.event.pull_request.base.sha == '"+PHYSICAL_BASE+"' && github.head_ref == '"+PHYSICAL_BRANCH+"')";
  assert.equal(bytes(args.head,workflow).toString().replace(addition,""),oldWorkflow,"PHYSICAL_OTHER_WORKFLOW_CHANGED");
  const shellAddition=" || { [ \"${{ github.event.pull_request.number }}\" = \"3779\" ] && [ \"${{ github.event.pull_request.base.sha }}\" = \"d97f4b6dadcfa894025fd1634bd69c1c01a8761c\" ] && [ \"${{ github.head_ref }}\" = \"fix/r4285-physical-cli-producer-candidate\" ]; }";
  for(const f of PHYSICAL_WIRING.slice(4)){const routed=bytes(args.head,f).toString();assert.equal(routed.split(shellAddition).join("").split(addition).join(""),bytes(args.base,f).toString(),"PHYSICAL_HISTORICAL_WORKFLOW_CHANGED:"+f);}
  const historical=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");for(const f of historical.SOURCE_PATHS)assert(bytes(args.base,f).equals(bytes(args.head,f)),"PHYSICAL_HISTORICAL_23_CHANGED:"+f);
  for(const f of [TRUST,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V2.json","scripts/runtime_acceptance/MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs","scripts/runtime_acceptance/MCFT_CAP09_R4285_PINNED_LOADING_V3.cjs"])
   assert(bytes(args.base,f).equals(bytes(args.head,f)),"PHYSICAL_UNAUTHORIZED_RUNTIME_CHANGED:"+f);
  const cli="scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs",test="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs";
  assert.equal(bytes(args.head,cli).toString().split("function parse(argv)")[0],bytes(args.base,cli).toString().split("function parse(argv)")[0],"PHYSICAL_RECEIVER_OR_ATOMIC_BYTES_CHANGED");
  const oldTests=bytes(args.base,test);assert(bytes(args.head,test).subarray(0,oldTests.length).equals(oldTests),"PHYSICAL_PRIOR_EXECUTION_ASSERTIONS_CHANGED");
  // Real native predecessor: QCP artifact bytes plus exact merge/QCP/CI metadata.
  const meta={"base_sha":"f74a5677b6ecd784e283c25d71e7253897df15a1","ci_run_attempt":1,"ci_run_id":44829050098,"pr_number":3778,"qcp_artifact_id":14674679784,"qcp_job_id":136608983127,"qcp_raw_sha256":"30e5cc15814cc5c8363090bc0060631c3e908f9bc362bb45d962248f700419f7","qcp_run_attempt":1,"qcp_run_id":44829050174,"qcp_zip_sha256":"e065bbf73e6b40c01aa0635f54929a1eb33fc97b35be1ef0fe6c0c512fee975a","repository":"liyongshang44-max/GEOX","source_head_sha":"324070511f4b74e67dad904a97c1a8744c811c2e","subject_sha":"d97f4b6dadcfa894025fd1634bd69c1c01a8761c"};
  const zip=cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/actions/artifacts/14674679784/zip"],{cwd:ROOT,timeout:60000,maxBuffer:32*1024*1024});
  const zipRaw=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs").zipRaw,raw=zipRaw(zip);
  const baseline=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs").verifyGitHubNativeProof(meta,{pr:api("pulls/3778"),baseCommit:api("git/commits/"+meta.base_sha),sourceCommit:api("git/commits/"+meta.source_head_sha),mergeCommit:api("git/commits/"+PHYSICAL_BASE),main:api("git/ref/heads/main"),qcpRun:api("actions/runs/"+meta.qcp_run_id),qcpJobs:api("actions/runs/"+meta.qcp_run_id+"/attempts/1/jobs?per_page=100"),qcpArtifacts:api("actions/runs/"+meta.qcp_run_id+"/artifacts?per_page=100"),ciRun:api("actions/runs/"+meta.ci_run_id)},raw,zip,authority,zipRaw);
  const currentPR=api("pulls/3779");assert.equal(currentPR.head.sha,args.head);assert.equal(currentPR.base.sha,args.base);assert.equal(currentPR.head.ref,PHYSICAL_BRANCH);
  const nativeJobs=api("actions/runs/"+process.env.GITHUB_RUN_ID+"/jobs?per_page=100"),nativeJob=nativeJobs.jobs.find(j=>j.name==="applicability-and-blocker-inventory");
  for(const name of ["Prove central applicability semantics","Prove generation, durable-anchor, and dependency-digest semantics","Resolve immutable qualification evidence references","Attest exact QCP source identity after historical diagnostics"])
   assert(nativeJob?.steps.some(s=>s.name===name&&s.conclusion==="success"),"PHYSICAL_CURRENT_NATIVE_CONTROL_STEP_REQUIRED:"+name);
  const suites=["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_RETRY_TRUST_V2_SUCCESSION_V1.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.test.cjs","scripts/cap09_adoption_v1/ACCEPTANCE_SIGN_R4285_OWNER_LINEAGE_ADOPTION_V5_TRUST_V2.test.cjs"];
  const tests=[];for(const f of suites){const r=cp.spawnSync(process.execPath,["--test",f],{cwd:ROOT,encoding:"utf8",timeout:120000,maxBuffer:4*1024*1024});assert.equal(r.status,0,"PHYSICAL_EXACT_REGRESSION_FAILED:"+f);tests.push({file:f,source_sha256:hash(bytes(args.head,f)),exit_code:r.status,stdout_sha256:hash(Buffer.from(r.stdout))});}
  const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs"),registry=JSON.parse(bytes(args.head,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json"));
  const context=planner.prepareApplicabilityContext({root:ROOT,authority,registry,generation:"v13",headSha:args.head});assert.deepEqual(context.definitionErrors,[]);assert.deepEqual(context.resolverResult.errors,[]);
  const catalog=sha=>new Map(git("ls-tree","-r",sha).split(/\r?\n/).map(l=>{const at=l.indexOf("\t");return [l.slice(at+1),l.slice(0,at).split(" ")[2]];}));const baseBlobs=catalog(args.base),headBlobs=catalog(args.head),baselineRows=new Map(JSON.parse(raw).results.map(r=>[r.check_id,r]));
  const rows={};for(const definition of authority.checks){const id=definition.check_id,decision=plan.decisions.find(d=>d.check_id===id);assert(decision,"PHYSICAL_CURRENT_CHECK_MISSING");assert(baselineRows.has(id),"PHYSICAL_BASELINE_CHECK_MISSING");
   if(PHYSICAL_CHECKS.includes(id)){rows[id]={check_id:id,applicability:decision.status,status:"PASS",execution:"EXACT_PR3779_PHYSICAL_CLI_NATIVE_SOURCE_QUALIFICATION",reason_code:"NODE20_EXACT_SOURCE_AND_REGISTERED_TRUST_NEGATIVES_PASS",current_source:{base_sha:args.base,head_sha:args.head,candidate_runtime_sha256:PHYSICAL_HASHES,baseline_qcp_run_id:meta.qcp_run_id,native_baseline_status:baseline.status,tests},whole_120s_admission:"UNPROVEN"};continue;}
   const owned=[...new Set(definition.resolver_ids.flatMap(r=>{assert(context.resolverResult.resolved[r],"PHYSICAL_CHECK_RESOLVER_MISSING");return context.resolverResult.resolved[r].paths;}))];const projection=physicalDependencyProjection(owned,baseBlobs,headBlobs);
   rows[id]={check_id:id,applicability:decision.status,status:id==="CONTROL_PLANE_INTEGRITY"?"PASS":"NOT_APPLICABLE",execution:id==="CONTROL_PLANE_INTEGRITY"?"CURRENT_NATIVE_CONTROL_PLANE_STEPS_EXACT_SOURCE":"PER_CHECK_UNCHANGED_OPERATIONAL_SOURCE_PROJECTION",reason_code:id==="CONTROL_PLANE_INTEGRITY"?"CURRENT_NATIVE_PLANNER_AND_EXACT_ROUTING_PROVEN":"EXACT_CHECK_DEPENDENCIES_UNCHANGED_NO_HISTORICAL_REISSUE",current_source:{base_sha:args.base,head_sha:args.head,resolver_ids:definition.resolver_ids,operational_projection:projection,changed_qualification_wiring:paths.filter(f=>owned.includes(f)&&PHYSICAL_WIRING.includes(f)),baseline_qcp_run_id:meta.qcp_run_id,baseline_check_status:baselineRows.get(id).status},historical_qualification_reissued:false};
  }
  assert.equal(Object.keys(rows).length,74);return {status:"PASS",rows,permit_issued:false,permit_consumed:false,stages:0};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_EXACT_NODE20_PHYSICAL_SOURCE_QUALIFICATION",failure:String(e.message||e).slice(0,700),permit_consumed:false,stages:0};}
}
module.exports.inspectPhysicalDelta=inspectPhysicalDelta;
module.exports.physicalDependencyProjection=physicalDependencyProjection;
module.exports.verifyPhysicalSuccessor=verifyPhysicalSuccessor;
module.exports.PHYSICAL_HASHES=PHYSICAL_HASHES;
module.exports.PHYSICAL_WIRING=PHYSICAL_WIRING;
