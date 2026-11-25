"use strict";
// Exact source-only successor of #3780. Reuses neither a physical receipt nor
// a current execution authorization. Every scoped row is fail-closed.
const assert=require("node:assert/strict"),cp=require("node:child_process"),fs=require("node:fs"),crypto=require("node:crypto");
const BASE="16fe4dbd03e75acf0209ca3daa906d8c2956b01f",BRANCH="mcft/r4285-formal-budget-successor-20261125",PR=3781;
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",CURRENT="CAP09_R4285_TRUST_V2_NATIVE_ADOPTION_V4_EXACT_SOURCE_V1",RESOLVER="CAP09_R4285_FORMAL_BUDGET_SUCCESSOR_V4_EXACT_PATHS_V1";
const PATHS=Object.freeze([
  ".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",
  ".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",
  ".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml",
  ".github/workflows/mcft-cap09-r4285-prepare-live-v3.yml",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-R4285-FORMAL-BUDGET-SUCCESSOR-V4.md",
  "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
  "scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_FORMAL_BUDGET_SUCCESSOR_V4.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_FORMAL_BUDGET_V4.test.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_BUILD_ADMISSION_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_CHILD_STAGE_V1.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_CONTROLLED_DELAY_V2.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_CREDENTIAL_DELIVERY_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_FORMAL_BUDGET_V4.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_EXEC_V3.cjs",
  "scripts/runtime_acceptance/MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs"
]);
const PRIOR=Object.freeze({pr:3780,base:"a12831a457b9bb47941a8873b7faa0ba880d6f81",head:"a34394be1579b40585a8f57db65d66351b04db4d",qcp:45029574339,ci:45029574373,artifact:14756828892,zip:"de298c72f3b61f9de2febb5208111c0b7a01535da227de867e1ccf48e1795267"});
const AFFECTED=new Set(["CAP09_R4285_HOST_EXACT_SOURCE_ADMISSION_V1","CAP09_R4285_PREPARE_LIVE_V3_EXACT_SOURCE_REVIEW_V1",CURRENT]);
const SCOPED=Object.freeze([...new Set([...require("./VERIFY_MCFT_CAP09_R4285_TRUST_V2_SOURCE_V1.cjs").MC_ADMIN_SCOPED_IDS,...AFFECTED])]);
const STAGE3="STAGE3_20261025_NONAUTHORIZING_EXACT_PATH_REQUALIFICATION";
const WIRING=new Set([...[".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"],Q,"scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs","scripts/governance_acceptance/VERIFY_MCFT_CAP09_R4285_FORMAL_BUDGET_SUCCESSOR_V4.cjs",".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",".github/workflows/mcft-cap09-r4285-prepare-live-v3.yml"]);
const RUNTIME=new Set(PATHS.filter(p=>p.startsWith("scripts/runtime_acceptance/")&&!p.includes("ACCEPTANCE_")));
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function verify({ROOT:root,args,authority,plan,changed,stage}){
 const git=(...a)=>cp.execFileSync("git",a,{cwd:root,encoding:"utf8",timeout:60000,maxBuffer:32*1024*1024}).trim();
 const bytes=(ref,p)=>cp.execFileSync("git",["show",ref+":"+p],{cwd:root,timeout:60000,maxBuffer:32*1024*1024});
 const tree=(ref,p)=>git("ls-tree",ref,"--",p);
 const api=(p,binary=false)=>{const b=cp.execFileSync("gh",["api","repos/liyongshang44-max/GEOX/"+p],{cwd:root,timeout:90000,maxBuffer:32*1024*1024});return binary?b:JSON.parse(b);};
 try{
 assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");assert.equal(args.base,BASE);
 assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
 assert.equal(event.repository?.full_name,"liyongshang44-max/GEOX");assert.equal(event.pull_request?.number,PR);
 assert.equal(event.pull_request?.base?.sha,BASE);assert.equal(event.pull_request?.head?.sha,args.head);
 assert.equal(event.pull_request?.head?.ref,BRANCH);assert.equal(event.pull_request?.head?.repo?.full_name,event.repository.full_name);
 assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",BASE,args.head),BASE);
 assert.equal(git("diff","--name-only"),"");assert.equal(git("diff","--cached","--name-only"),"");
 assert.deepEqual(git("diff","--name-only",BASE,args.head).split(/\r?\n/).filter(Boolean).sort(),PATHS);
 assert.deepEqual([...changed].sort(),PATHS);
 assert.equal(plan.status,"PASS");for(const k of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[k],[]);
 const before=JSON.parse(bytes(BASE,Q)),expected=structuredClone(before);
 assert.equal(before.checks.length,74);assert.equal(before.checks[73].check_id,CURRENT);
 expected.dependency_resolvers[RESOLVER]={kind:"EXACT_PATH_SET",paths:[...PATHS]};
 expected.checks[73].resolver_ids.push(RESOLVER);expected.checks[73].requalification_triggers.push(RESOLVER);
 assert.deepEqual(authority,expected,"BUDGET_QCP_EXACT_AUTHORITY_EXTENSION");
 // Actual previous native GitHub QCP + CI, not copied status strings.
 const pr=api("pulls/"+PRIOR.pr);assert(pr.merged&&pr.merge_commit_sha===BASE&&pr.head.sha===PRIOR.head&&pr.base.sha===PRIOR.base);
 for(const [run,name] of [[PRIOR.qcp,"mcft-cap-09-qualification-control-plane-v1"],[PRIOR.ci,"ci"]]){const x=api("actions/runs/"+run);assert(x.head_sha===PRIOR.head&&x.name===name&&x.event==="pull_request"&&x.status==="completed"&&x.conclusion==="success");}
 const art=api("actions/artifacts/"+PRIOR.artifact);assert(!art.expired&&art.workflow_run.id===PRIOR.qcp&&art.digest==="sha256:"+PRIOR.zip);
 const zip=api("actions/artifacts/"+PRIOR.artifact+"/zip",true);assert.equal(sha(zip),PRIOR.zip);
 const raw=require("../cap09_adoption_v1/MCFT_CAP09_ADOPTION_V2_EVIDENCE_CONSUMER.cjs").zipRaw(zip);
 const previous=JSON.parse(raw.toString("utf8"));
 require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V4.cjs").checkQcp74(previous,before,PRIOR.head,PRIOR.base);
 const priorRows=new Map(previous.results.map(r=>[r.check_id,r]));
 // Verify actual dependency closure before any historical source carry-forward.
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const registry=JSON.parse(bytes(args.head,planner.REGISTRY_PATH));
 const ctx=planner.prepareApplicabilityContext({root,authority,registry,generation:"v13",headSha:args.head});
 assert.deepEqual(ctx.definitionErrors,[]);assert.deepEqual(ctx.resolverResult.errors,[]);
 const projections={};
 for(const def of authority.checks){
  const deps=[...new Set(def.resolver_ids.flatMap(id=>{const r=ctx.resolverResult.resolved[id];assert(r,"BUDGET_RESOLVER_MISSING:"+id);return r.paths;}))].sort();
  const modified=deps.filter(p=>PATHS.includes(p));
  const operational=modified.filter(p=>!WIRING.has(p));
  if(!AFFECTED.has(def.check_id))assert.deepEqual(operational,[],"BUDGET_UNEXPECTED_CHANGED_CHECK:"+def.check_id);
  else assert(operational.every(p=>PATHS.includes(p)),"BUDGET_UNREGISTERED_CONTRACT_DELTA");
  projections[def.check_id]={dependency_count:deps.length,changed_dependencies:modified,operational_delta:operational};
 }
 // Original stage3 six entry blobs are preserved at the frozen ref; current
 // base-to-head scientific bodies must remain exactly unchanged.
 const frozen=JSON.parse(bytes(BASE,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-STAGE3-NONAUTHORIZED-REAL-BODY-QUALIFICATION-V1.json"));
 assert.equal(frozen.frozen_pr_3730_head_sha,"12dcbba6750879f0349c5730f477cb04cd23b560");
 assert.equal(frozen.stages.length,6);
 for(const row of frozen.stages){assert.equal(git("rev-parse",frozen.frozen_pr_3730_head_sha+":"+row.original_entry_script),row.original_entry_git_blob_sha);assert.equal(tree(BASE,row.original_entry_script),tree(args.head,row.original_entry_script));}
 for(const f of ["RUN_MCFT_CAP09_R4285_PRODUCER_V1.ts","RUN_MCFT_CAP09_R4285_TIMING_V1.ts","AGGREGATE_MCFT_CAP09_R4285_TIMING_V1.ts","MCFT_CAP09_R4285_CONTROLLED_DELAY_V1.cjs","MCFT_CAP09_R4285_ADMISSION_V3.cjs","MCFT_CAP09_R4285_PERMIT_EXEC_V3.cjs","MCFT_CAP09_R4285_STAGE_CAPABILITY_EXEC_V3.cjs","MCFT_CAP09_R4285_PERMIT_ATOMIC_EXEC_V3.cjs","MCFT_CAP09_R4285_SCOPE_V3.cjs"]){const p="scripts/runtime_acceptance/"+f;assert.equal(tree(BASE,p),tree(args.head,p),"BUDGET_FROZEN_BODY_CHANGED:"+f);}
 const tests=[];
 function run(file,extra=[]){const x=cp.spawnSync(process.execPath,["--test",...extra,file],{cwd:root,encoding:"utf8",timeout:150000,maxBuffer:8*1024*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME||"",SYSTEMROOT:process.env.SYSTEMROOT||""}});assert.equal(x.status,0,"BUDGET_TARGETED_TEST_FAILED:"+file+":"+String(x.stdout||"").slice(-1000));tests.push({file,exit_code:x.status,stdout_sha256:sha(Buffer.from(x.stdout||""))});}
 for(const file of ["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_FORMAL_BUDGET_V4.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_EXECUTION_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_V2_PERMIT_WINDOW.test.cjs"])run(file);
 run("scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_WINDOWS_HOST_V1.test.cjs",["--test-name-pattern","Host accepts|Host rejects|no incomplete|run and nonce|original scientific stages retain|Windows Host refuses|expired static|forged Stage Ticket"]);
 const rows={};
 for(const id of SCOPED){
  const d=plan.decisions.find(x=>x.check_id===id),prior=priorRows.get(id);assert(d&&prior&&["PASS","NOT_APPLICABLE"].includes(prior.status),"BUDGET_PREDECESSOR_ROW_MISSING:"+id);
  const tested=AFFECTED.has(id),historic=id===STAGE3;
  rows[id]={check_id:id,applicability:d.status,status:tested||historic?"PASS":"NOT_APPLICABLE",
   reason_code:tested?"CURRENT_EXACT_SOURCE_BUDGET_CONTRACT_TESTS_PASS":historic?"FROZEN_STAGE3_BYTE_REPLAY_CURRENT_SCIENCE_UNCHANGED":"PR3780_ACCEPTED_SOURCE_AND_CURRENT_DEPENDENCY_NON_EFFECT",
   source_base:BASE,source_head:args.head,predecessor_qcp_run:PRIOR.qcp,dependency_projection:projections[id],
   tests:tested?tests:[],historical_science_reissued:false,permit_consumed:false,host_started:false,formal_six_stages:0};
 }
 return {status:"PASS",rows,source_head_sha:args.head,base_sha:BASE,tests,source_only:true,physical_stages:0};
 }catch(e){return {status:"FAIL",reason_code:"HOLD_R4285_FORMAL_BUDGET_SUCCESSOR_QCP",detail:String(e.message||e).slice(0,1500),permit_consumed:false,physical_stages:0};}
}
module.exports={BASE,BRANCH,PR,SCOPED,PATHS,verify};
