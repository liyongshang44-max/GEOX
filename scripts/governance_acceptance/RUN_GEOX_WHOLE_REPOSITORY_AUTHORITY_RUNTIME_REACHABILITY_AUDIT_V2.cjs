#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");
const ROOT=process.cwd();
const OUT=path.join(ROOT,"acceptance-output");
fs.mkdirSync(OUT,{recursive:true});

function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function exists(rel){return fs.existsSync(path.join(ROOT,rel));}
function list(dir){
  const abs=path.join(ROOT,dir);
  if(!fs.existsSync(abs)) return [];
  const skip=new Set([".git","node_modules","dist","acceptance-output",".pnpm-store"]);
  return fs.readdirSync(abs,{withFileTypes:true}).flatMap((e)=>{
    if(skip.has(e.name)) return [];
    const rel=path.posix.join(dir,e.name).replace(/^\.\//,"");
    return e.isDirectory()?list(rel):[rel];
  });
}
function includes(rel,token){return exists(rel)&&read(rel).includes(token);}
function runNode(rel,args=[]){
  const p=cp.spawnSync(process.execPath,[rel,...args],{cwd:ROOT,encoding:"utf8",env:process.env});
  return {status:p.status??1,stdout:p.stdout||"",stderr:p.stderr||""};
}
function git(...args){
  const p=cp.spawnSync("git",args,{cwd:ROOT,encoding:"utf8"});
  if(p.status!==0) throw new Error("GIT_FAILED:"+args.join(" ")+":"+(p.stderr||""));
  return (p.stdout||"").trim();
}

const subjectSha=git("rev-parse","HEAD");
const method=JSON.parse(read("docs/architecture/semantic_convergence/GEOX-WHOLE-REPOSITORY-AUTHORITY-RUNTIME-REACHABILITY-METHOD-V2.json"));
const predecessorAudit=runNode("scripts/governance_acceptance/ACCEPTANCE_BLINE_RESIDUAL_AUTHORITY_AUDIT_V1.cjs");

const packageJson=JSON.parse(read("package.json"));
const packageRoots=Object.entries(packageJson.scripts||{}).map(([name,command])=>({
  execution_root_id:"PKG:"+name,
  root_class:/^dev:server$/.test(name)?"HTTP_SERVER":/^dev:/.test(name)?"OPERATOR_TRIGGERED":/^ci:runtime:/.test(name)?"QUALIFICATION":/^ci:|^acceptance:|^test:/.test(name)?"GOVERNANCE_ONLY":/^seed:/.test(name)?"OPERATOR_TRIGGERED":"GOVERNANCE_ONLY",
  launch_mechanism:"PACKAGE_SCRIPT",
  source:"package.json",
  command
}));

const workflowRoots=list(".github/workflows").filter((x)=>/\.ya?ml$/.test(x)).map((rel)=>({
  execution_root_id:"WF:"+rel,
  root_class:"QUALIFICATION",
  launch_mechanism:"GITHUB_WORKFLOW",
  source:rel
}));

const composeRoots=[];
for(const rel of fs.readdirSync(ROOT).filter((x)=>/^docker-compose[^/]*\.ya?ml$/.test(x))){
  const text=read(rel);
  const lines=text.split(/\r?\n/);
  let inServices=false,current=null;
  for(const line of lines){
    if(/^services:\s*$/.test(line)){inServices=true;continue;}
    if(inServices&&/^\S/.test(line)&&!/^services:/.test(line)){inServices=false;current=null;}
    const m=inServices?/^  ([A-Za-z0-9_.-]+):\s*$/.exec(line):null;
    if(m){current=m[1];composeRoots.push({
      execution_root_id:"COMPOSE:"+rel+"#"+current,
      root_class:/production/i.test(rel)?"PRODUCTION_ONLINE":"QUALIFICATION",
      launch_mechanism:"DOCKER_COMPOSE_SERVICE",
      source:rel,
      service:current
    });}
  }
}

const distSource="apps/server/scripts/write_dist_entries.cjs";
const distText=read(distSource);
const distEntries=[...distText.matchAll(/name:\s*(?:path\.join\(([^\n]+?)\)|"([^"]+\.js)")/g)].map((m,i)=>({
  execution_root_id:"DIST:"+i,
  root_class:/runtime/.test(m[0])?"PRODUCTION_ONLINE":"GOVERNANCE_ONLY",
  launch_mechanism:"GENERATED_DIST_ENTRY",
  source:distSource,
  declaration:m[0].replace(/\s+/g," ")
}));

const executionRoots=[...packageRoots,...workflowRoots,...composeRoots,...distEntries];

const hosting="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md";
const cap05="apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.ts";
const s5Adapter="apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.ts";
const prodCompose="apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v2.ts";
const prodProcess="apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_process_v2.ts";
const qualEntry="apps/server/src/runtime/twin_runtime/qualification/mcft_cap09_phase5_twin_runtime_qualification_v1.ts";
const qualCompose="apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.ts";
const prodDocker="docker-compose.mcft-cap09-production.yml";
const distWriter="apps/server/scripts/write_dist_entries.cjs";
const cap06Runner="apps/server/scripts/mcft/MCFT_CAP_06_CALIBRATION_SHADOW_RUNNER.ts";
const cap06Shadow="apps/server/scripts/mcft/MCFT_CAP_06_PAIRED_HISTORICAL_SHADOW_RUNNER.ts";
const operatorModule="apps/server/src/modules/operator/registerOperatorModule.ts";
const cap07Route="apps/server/src/routes/v1/mcft_field_twin_read_v1.ts";

const m01Intentional=
  includes(hosting,"| CAP-05 | Human Decision / Execution Feedback consumption | Replay | No |") &&
  includes(hosting,"CAP-01 through CAP-06 replay execution") &&
  includes(cap05,"Cap05ForecastResidualOutcomeTickServiceV1") &&
  includes(s5Adapter,"executeOneTickAndCommitResidual") &&
  !includes(prodCompose,"Cap05ForecastResidualOutcomeTickServiceV1");

const m02Producer100=
  includes("apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts","POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1");
const m02Consumer200=
  includes(cap05,"POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1");

const m03Diverged=
  includes(qualEntry,"runMcftCap09TwinRuntimeProcessV1") &&
  includes(qualCompose,"ExternalFormalV3Amendment19RunnerV1") &&
  includes(qualCompose,"materializeExternalFormalA18CropContextV3") &&
  includes(prodProcess,"composeMcftCap09TwinRuntimeV2") &&
  includes(prodCompose,"ExternalFormalV4Amendment19RunnerV2") &&
  includes(prodCompose,"materializeExternalFormalA18CropContextV4");
const m03SharedCore=
  includes(qualCompose,"ExternalFormalV3Amendment19PersistentTickServiceV1") &&
  includes(prodCompose,"ExternalFormalV3Amendment19PersistentTickServiceV1") &&
  includes(qualCompose,"PostgresPersistentSequentialSchedulerAdapterV1") &&
  includes(prodCompose,"PostgresPersistentSequentialSchedulerAdapterV1") &&
  includes(qualCompose,"PostgresExternalFormalAmendment19EvidenceSourceV1") &&
  includes(prodCompose,"PostgresExternalFormalAmendment19EvidenceSourceV1");

const m04Controlled=
  includes(hosting,"CAP-06 candidate generation and historical shadow evaluation remain governed one-shot jobs") &&
  exists(cap06Runner)&&exists(cap06Shadow);

const m05Wired=
  includes(operatorModule,"registerMcftFieldTwinReadRoutesV1") &&
  includes(operatorModule,"PostgresMcftFieldTwinS4ReadApiV1") &&
  exists(cap07Route);

const m06Intentional=
  includes(hosting,"| CAP-08 | 24-Tick End-to-End Closure | Bounded Replay | No permanent host |") &&
  includes(hosting,"CAP-08 bounded 24-tick closure and future regression qualification");

const m07Static=
  includes(prodDocker,"apps/server/dist/runtime/mcft_cap09_twin_runtime_v2.js") &&
  includes(distWriter,"runMcftCap09TwinRuntimeProcessV2") &&
  includes(prodProcess,"composeMcftCap09TwinRuntimeV2") &&
  includes(prodCompose,"ExternalFormalV4Amendment19RunnerV2") &&
  includes(prodCompose,"ExternalFormalV3Amendment19PersistentTickServiceV1");

const mandatory=[
  {
    id:"M-01",
    subject:"CAP05_FORECAST_RESIDUAL_EXECUTION_OWNER_AND_RUNTIME_REACHABILITY",
    final_disposition:m01Intentional?"INTENTIONALLY_DISCONNECTED":"UNWIRED_DEFECT",
    expected_execution_owner:"CONTROLLED_REPLAY / caller-requested CAP-05 outcome tick; not permanent hourly production host",
    static_reachability:{controlled_replay:m01Intentional,production_online:includes(prodCompose,"Cap05ForecastResidualOutcomeTickServiceV1")},
    runtime_reachability_proof:["scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK_DB.ts"],
    evidence:[hosting,cap05,s5Adapter,prodCompose],
    note:"Frozen hosting map assigns CAP-05 primary mode REPLAY and no long-running production host. Production-online absence is intentional if controlled replay proof remains valid."
  },
  {
    id:"M-02",
    subject:"CAP09_100MM_PRODUCER_VS_CAP05_RESIDUAL_CONSUMER_SEMANTIC_COMPATIBILITY",
    final_disposition:(m01Intentional&&m02Producer100&&m02Consumer200)?"INTENTIONALLY_DISCONNECTED":"SEMANTICALLY_INCOMPATIBLE",
    semantic_compatibility:{
      direct_edge_compatible:!(m02Producer100&&m02Consumer200),
      producer_operator:"POINT_100MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
      consumer_operator:"POINT_200MM_TO_ROOT_ZONE_MEAN_H1_WITH_REPRESENTATIVENESS_V1",
      direct_reuse_authorized:false
    },
    evidence:[
      "apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.ts",
      cap05,
      hosting
    ],
    note:"Current direct contracts are incompatible. Because CAP-05 is replay-owned and no direct CAP-09-online -> CAP-05 residual edge is authorized, the current edge is intentionally disconnected; any future connection requires an explicit semantic adapter/contract."
  },
  {
    id:"M-03",
    subject:"REAL_CLOCK_REHEARSAL_V1_VS_PRODUCTION_V2_EXACT_PATH_EQUIVALENCE",
    final_disposition:m03Diverged?"UNWIRED_DEFECT":"WIRED_AND_PROVEN",
    qualification_production_equivalence:{
      exact_path_equal:!m03Diverged,
      shared_persistent_tick_core:m03SharedCore,
      qualification_process:"V1",
      production_process:"V2",
      qualification_runner:"ExternalFormalV3Amendment19RunnerV1",
      production_runner:"ExternalFormalV4Amendment19RunnerV2",
      qualification_crop_context:"V3",
      production_crop_context:"V4",
      explicit_current_equivalence_proof_found:false
    },
    evidence:[qualEntry,qualCompose,prodProcess,prodCompose,hosting],
    note:"Current rehearsal and production share scheduler/evidence/persistent-tick core but differ in process/composition/runner/crop-stage authority path. Under the V2 method this remains a closure defect until an exact bounded equivalence proof or V2 rehearsal route exists."
  },
  {
    id:"M-04",
    subject:"CAP06_CONTROLLED_CALIBRATION_SHADOW_EXECUTION_OWNERSHIP",
    final_disposition:m04Controlled?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",
    expected_execution_owner:"CONTROLLED_REPLAY",
    evidence:[hosting,cap06Runner,cap06Shadow,".github/workflows/mcft-cap-06-s5-candidate.yml",".github/workflows/mcft-cap-06-s6-paired-shadow.yml"]
  },
  {
    id:"M-05",
    subject:"CAP07_FIELD_TWIN_READ_SURFACE_RUNTIME_REACHABILITY",
    final_disposition:m05Wired?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",
    expected_execution_owner:"HTTP_SERVER",
    evidence:[operatorModule,cap07Route,"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S4_API.ts"]
  },
  {
    id:"M-06",
    subject:"CAP08_REPLAY_DECISION_ACTION_EXECUTION_BOUNDARY",
    final_disposition:m06Intentional?"INTENTIONALLY_DISCONNECTED":"UNWIRED_DEFECT",
    expected_execution_owner:"BOUNDED_REPLAY",
    evidence:[hosting,"docs/digital_twin/mcft/cap_08"]
  },
  {
    id:"M-07",
    subject:"CAP09_PRODUCTION_ROOT_EXACTNESS",
    final_disposition:m07Static?"WIRED_AND_PROVEN":"UNWIRED_DEFECT",
    expected_execution_owner:"PRODUCTION_ONLINE",
    static_reachability:m07Static,
    execution_chain:[
      prodDocker,
      distWriter,
      prodProcess,
      prodCompose,
      "apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.ts",
      "apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts"
    ],
    runtime_reachability_proof:[
      "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_TWIN_PROCESS_V2_ROUTING_V1.cjs",
      "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE5_PROCESS_BOUNDARY_V1.ts"
    ]
  }
];

const terminal=new Set(method.terminal_dispositions);
const invalidDisposition=mandatory.filter((x)=>!terminal.has(x.final_disposition));
const defects=mandatory.filter((x)=>x.final_disposition==="UNWIRED_DEFECT"||x.final_disposition==="SEMANTICALLY_INCOMPATIBLE");
const intentional=mandatory.filter((x)=>x.final_disposition==="INTENTIONALLY_DISCONNECTED");
const wired=mandatory.filter((x)=>x.final_disposition==="WIRED_AND_PROVEN");

const oldInventory=JSON.parse(read("docs/architecture/semantic_convergence/GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1.json"));
const result={
  schema_version:"geox_whole_repository_authority_runtime_reachability_audit_result_v2",
  audit_subject_sha:subjectSha,
  baseline_protected_main:method.baseline_protected_main,
  status:(predecessorAudit.status===0&&invalidDisposition.length===0&&defects.length===0)?"PASS":"FAIL",
  product_semantic_delta:0,
  runtime_wiring_delta:0,
  production_database_mutation:false,
  rehearsal_resource_use:false,
  formal_store_mutation:false,
  predecessor_whole_repo_audit:{
    status:predecessorAudit.status===0?"PASS":"FAIL",
    stdout_tail:predecessorAudit.stdout.slice(-4000),
    stderr_tail:predecessorAudit.stderr.slice(-4000),
    registered_surface_count:Array.isArray(oldInventory.surfaces)?oldInventory.surfaces.length:0
  },
  all_execution_roots:executionRoots,
  complete_or_effective_capability_basis:[
    "GEOX-BLINE-RESIDUAL-AUTHORITY-INVENTORY-V1",
    "GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX",
    "current per-CAP lifecycle/status/effectiveness artifacts",
    hosting
  ],
  mandatory_mcft_reconciliation:mandatory,
  static_reachability:mandatory.map((x)=>({id:x.id,static_reachability:x.static_reachability??null})),
  runtime_reachability_proof:mandatory.map((x)=>({id:x.id,proof:x.runtime_reachability_proof??[]})),
  producer_consumer_semantic_compatibility:mandatory.filter((x)=>x.semantic_compatibility).map((x)=>({id:x.id,...x.semantic_compatibility})),
  orphan_capability_list:defects.filter((x)=>x.final_disposition==="UNWIRED_DEFECT").map((x)=>x.id),
  dead_wiring_list:[],
  qualification_production_divergence_list:mandatory.filter((x)=>x.id==="M-03"&&x.final_disposition!=="WIRED_AND_PROVEN").map((x)=>x.id),
  explicit_intentional_disconnected_list:intentional.map((x)=>x.id),
  wired_and_proven_list:wired.map((x)=>x.id),
  unadjudicated_discovery_count:invalidDisposition.length,
  repair_authorized:false
};

fs.writeFileSync(path.join(OUT,"GEOX_WHOLE_REPOSITORY_AUTHORITY_RUNTIME_REACHABILITY_AUDIT_V2.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify({status:result.status,subject_sha:subjectSha,predecessor_whole_repo_audit:result.predecessor_whole_repo_audit.status,mandatory:mandatory.map((x)=>({id:x.id,disposition:x.final_disposition})),execution_root_count:executionRoots.length}));

