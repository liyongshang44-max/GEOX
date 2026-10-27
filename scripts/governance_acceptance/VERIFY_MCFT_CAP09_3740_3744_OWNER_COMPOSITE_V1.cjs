#!/usr/bin/env node
"use strict";
// Composite exact-HEAD technical review only. Old Frozen V13 and seven required blockers remain effective.
const assert=require("node:assert/strict"),fs=require("node:fs"),cp=require("node:child_process");
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
const OWNER="liyongshang44-max",REPO="liyongshang44-max/GEOX";
const BRANCH="qualification/cap09-owner-frozen108-da9-composite-20261027";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const S="scripts/governance_acceptance/VERIFY_MCFT_CAP09_3740_3744_OWNER_COMPOSITE_V1.cjs";
const REFS=[
 {n:3740,head:"cd8d5909fb600535445298b48c2ca25a1e9032a7",
  ci:40446287281,qcp:40446287200,job:"frozen108-successor-scoped-technical-registration",
  artifact:12708053283,digest:"sha256:3e847de5b05fef9d13f739ef02410de1a62699d081c3a0a7e81d807f4fd6def8",
  check:"FROZEN108_CURRENT_RUNTIME_SUCCESSOR_TEST_ONLY_QCP_ENROLLMENT_V1",
  resolver:"FROZEN108_CURRENT_RUNTIME_SUCCESSOR_EXACT_SIX_PATHS_V1",files:[
   ".github/workflows/mcft-cap09-frozen108-runtime-successor-inventory-v1.yml",
   "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json",
   "scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_INVENTORY_V1.cjs",
   "scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_SUCCESSOR_QCP_ENROLLMENT_V1.cjs"]},
 {n:3744,head:"c99c6ce846cf1d17d6193930956a30d3b05199cb",
  ci:40519872857,qcp:40519871969,job:"da9-current-sources-scoped-qcp-evidence",
  artifact:12741276233,digest:"sha256:1e39c12ac51d5db0219aef1bf5ff603a5aa74f7ad19c0654adc2b1abfc8a6950",
  check:"DA9_CURRENT_COMPOSER_PHASE3_SIGNATURE_SUCCESSOR_QCP_TEST_ONLY_V1",
  resolver:"DA9_CURRENT_SOURCE_SUCCESSOR_QCP_EXACT_FIVE_PATHS_V1",files:[
   "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-FORMAL-REVIEW-REQUEST-V1.json",
   "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-SOURCE-SUCCESSOR-QCP-TECHNICAL-EVIDENCE-V1.json",
   "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_CURRENT_SOURCE_QCP_TECHNICAL_ENROLLMENT_V1.cjs"]},
 {n:3745,head:"368cb5518562794314bf4ba61140308894f85214",
  ci:40527803833,qcp:40527803707,job:"owner-directed-scoped-qcp-technical",
  artifact:12743824633,digest:"sha256:89d7ca7f07487984f0510ce149a77f8d3c15849141a971ccddba44184e1029d8",
  check:"CAP09_3740_3744_OWNER_DIRECTED_SOURCE_REVIEW_TECHNICAL_V1",
  resolver:"CAP09_3740_3744_OWNER_POLICY_EXACT_FIVE_PATHS_V1",files:[
   ".github/workflows/mcft-cap09-3740-3744-owner-directed-policy-v1.yml",
   "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-3740-3744-OWNER-DIRECTED-POLICY-V1.json",
   "scripts/governance_acceptance/VERIFY_MCFT_CAP09_3740_3744_OWNER_DIRECTED_POLICY_V1.cjs"]}
];
const git=(...a)=>cp.execFileSync("git",a,{encoding:"utf8",timeout:60000,maxBuffer:32*1024*1024}).trim();
const parse=(sha,p)=>JSON.parse(git("show",sha+":"+p));
const shared=[".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",Q];
const EXTRA=["scripts/governance_acceptance/VERIFY_MCFT_CAP09_3746_CURRENT_PHASE3_OWNER_REQUAL_V1.cjs","scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs"];
const expected=[...new Set([...shared,S,...EXTRA,...REFS.flatMap(x=>x.files)])].sort();
function technical(){
 const head=git("rev-parse","HEAD");
 assert.equal(git("merge-base",BASE,head),BASE);
 assert.deepEqual(git("diff","--name-only",BASE,head).split(/\r?\n/).filter(Boolean).sort(),expected,"HOLD_COMPOSITE_EXACT_13_PATHS");
 const before=parse(BASE,Q),now=JSON.parse(fs.readFileSync(Q,"utf8"));
 assert.equal(before.checks.length,60);assert.equal(now.checks.length,63);
 assert.deepEqual(now.checks.slice(0,60),before.checks,"HOLD_HISTORICAL_SIXTY_CHANGED");
 assert.deepEqual(Object.fromEntries(Object.entries(now.dependency_resolvers).filter(([k])=>!(REFS.some(x=>x.resolver===k)))),before.dependency_resolvers,"HOLD_OLD_RESOLVER_MUTATED");
 assert.equal(Object.keys(now.dependency_resolvers).length,63);
 for(const source of REFS){
  const q=parse(source.head,Q);
  assert.equal(q.checks.length,61);
  assert.equal(q.checks[60].check_id,source.check);
  const current=now.checks.find(x=>x.check_id===source.check);
  assert(current,"HOLD_LOST_SUCCESSOR_QCP_CHECK");
  const baseline=structuredClone(q.checks[60]);
  baseline.diagnostic_command="node "+S+" --technical";
  assert.deepEqual(current,baseline,"HOLD_SUCCESSOR_SEMANTIC_QCP_DRIFT");
  const resolver=structuredClone(q.dependency_resolvers[source.resolver]);
  if(source.n===3745)resolver.paths=[...resolver.paths,S,...EXTRA].sort();
  assert.deepEqual(now.dependency_resolvers[source.resolver],resolver,"HOLD_SUCCESSOR_RESOLVER_DRIFT");
  for(const p of source.files) {
   if(source.n===3740 && p===".github/workflows/mcft-cap09-frozen108-runtime-successor-inventory-v1.yml"){
    // Existing old branch is unchanged. On this composite only, exact-source
    // workflow is skipped, not waived: independent native composite QCP executes.
    const historic=git("show",source.head+":"+p);
    const old="  exact108-readonly-inventory:\n    runs-on: ubuntu-latest";
    const guard="  exact108-readonly-inventory:\n"+
     "    # Original exact-source 3/6-path verifier cannot run as a 13-path composite.\n"+
     "    # Its native source runs remain preserved; composite uses its own exact-head verifier.\n"+
     "    if: github.event_name == 'workflow_dispatch' || (github.event_name == 'pull_request' && (github.event.pull_request.number == 3739 || github.event.pull_request.number == 3740))\n"+
     "    runs-on: ubuntu-latest";
    assert.equal(historic.split(old).length,2,"HOLD_SOURCE_STANDALONE_ANCHOR");
    const expectedWorkflow=historic.replace(old,guard);
    const currentWorkflow=fs.readFileSync(p,"utf8").trim();
    assert.equal(currentWorkflow,expectedWorkflow,"HOLD_STANDALONE_WORKFLOW_DIFF_UNBOUNDED");
   } else {
    assert.equal(git("rev-parse",head+":"+p),git("rev-parse",source.head+":"+p),"HOLD_CHANGED_SOURCE_BLOB:"+p);
   }
  }
 }
 const policy=parse(REFS[2].head,REFS[2].files[1]);
 assert.equal(policy.status,"PROPOSED_PENDING_EXACT_HEAD_CI_AND_QCP");
 assert.equal(policy.independent_ed25519_signature_claimed,false);
 assert.equal(policy.full_central_qcp_pass,false);
 assert.equal(policy.physical_execution_approved,false);
 assert.equal(policy.permit_approved,false);
 const review=parse(REFS[1].head,REFS[1].files[0]);
 assert.equal(review.approved,false);
 assert.equal(review.purpose_specific_delegation_signed,false);
 assert.equal(review.explicit_new_evidence_payload_signature_base64,null);
 const frozen=parse(REFS[0].head,REFS[0].files[1]);
 assert.equal(frozen.historical_frozen_requalified,false);
 assert.equal(frozen.changed_path_count,2);
 const trust=parse(BASE,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json");
 assert.equal(trust.execution_enabled,false);assert.equal(trust.adopted,false);
 return {status:"PASS_COMPOSITE_63_TECHNICAL_REGISTRATION_ONLY",head,
   total_qcp_checks:63,original_checks_unchanged:60,successor_checks:3,exact_paths:expected.length,
   full_qcp_zero_blockers:false,original_frozen_requalified:false,
   original_formal_six:0,old_run_id:"df091a71aafc",permit:"HOLD",windows_physical_authorized:false};
}
async function native(){
 const head=git("rev-parse","HEAD");
 const ev=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH||"/dev/null","utf8"));
 assert.equal(process.env.GITHUB_ACTIONS,"true");
 assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
 assert.equal(process.env.GITHUB_REPOSITORY,REPO);
 assert.equal(ev.repository?.full_name,REPO);
 assert.equal(ev.pull_request?.head?.sha,head);
 assert.equal(ev.pull_request?.head?.ref,BRANCH);
 assert.equal(ev.pull_request?.base?.sha,BASE);
 assert.equal(ev.pull_request?.user?.login,OWNER);
 assert.equal(ev.pull_request?.head?.repo?.full_name,REPO);
 const headers={Authorization:"Bearer "+process.env.GH_TOKEN,Accept:"application/vnd.github+json"};
 assert(process.env.GH_TOKEN);
 const root="https://api.github.com/repos/"+REPO;
 async function get(u){const r=await fetch(root+u,{headers});assert(r.ok,"HOLD_GITHUB_NATIVE:"+u+":"+r.status);return r.json()}
 const verified=[];
 for(const x of REFS){
  const pr=await get("/pulls/"+x.n);
  assert.equal(pr.head.sha,x.head);assert.equal(pr.base.sha,BASE);assert.equal(pr.draft,true);assert.equal(pr.state,"open");
  const ci=await get("/actions/runs/"+x.ci);
  assert.equal(ci.head_sha,x.head);assert.equal(ci.conclusion,"success","HOLD_SOURCE_GENERIC_CI");
  const cs=await get("/actions/runs/"+x.ci+"/jobs?per_page=50");
  for(const name of ["build-test","acceptance"])assert(cs.jobs.some(j=>j.name===name&&j.conclusion==="success"),"HOLD_SOURCE_CI_JOB:"+name);
  const q=await get("/actions/runs/"+x.qcp);assert.equal(q.head_sha,x.head);assert.equal(q.conclusion,"failure","HOLD_HISTORICAL_GLOBAL_QCP_NONCLAIM");
  const jobs=await get("/actions/runs/"+x.qcp+"/jobs?per_page=50");
  assert(jobs.jobs.some(j=>j.name===x.job&&j.conclusion==="success"),"HOLD_SCOPED_SOURCE_QCP");
  assert(jobs.jobs.some(j=>j.name==="applicability-and-blocker-inventory"&&j.conclusion==="failure"),"HOLD_GLOBAL_BLOCKER_CHANGED");
  const a=await get("/actions/runs/"+x.qcp+"/artifacts?per_page=100");
  const v=a.artifacts.find(z=>z.id===x.artifact);
  assert(v&&!v.expired&&v.digest===x.digest&&v.workflow_run?.head_sha===x.head&&v.workflow_run?.id===x.qcp);
  verified.push({pr:x.n,head:x.head,ci:"SUCCESS",scoped_qcp:"SUCCESS",global_qcp:"FAILURE",artifact:x.artifact});
 }
 return verified;
}
async function main(){
 const result=technical();
 if(process.argv.includes("--technical")){console.log(JSON.stringify(result));return;}
 if(!process.argv.includes("--native"))throw Error("HOLD_EXPLICIT_MODE_REQUIRED");
 const verified=await native();
 const all={...result,native_predecessors:verified,independent_signature_claimed:false};
 fs.mkdirSync("acceptance-output",{recursive:true});
 fs.writeFileSync("acceptance-output/MCFT_CAP09_3740_3744_COMPOSITE_QCP_NATIVE_V1.json",JSON.stringify(all,null,2)+"\n");
 console.log(JSON.stringify(all));
}
main().catch(e=>{console.error("HOLD_COMPOSITE_SUCCESSOR:"+String(e.stack||e));process.exitCode=1});
