#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE6-GITHUB-PRODUCTION-EXECUTION-RETIREMENT-AUTHORITY-V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PHASE6_GITHUB_PRODUCTION_OWNERS_AUDIT_V1.json");

function req(ok,code,detail){if(!ok)throw new Error(detail===undefined?code:code+":"+JSON.stringify(detail));}
function load(){return JSON.parse(fs.readFileSync(AUTH,"utf8"));}
function workflowText(rel){const p=path.join(ROOT,rel);req(fs.existsSync(p),"PHASE6_WORKFLOW_REQUIRED",rel);return fs.readFileSync(p,"utf8");}
function triggerBlock(text){
  const m=text.match(/^on:\s*\n([\s\S]*?)(?=^[A-Za-z_][A-Za-z0-9_-]*:\s*$|^permissions:\s*$)/m);
  req(m,"PHASE6_TRIGGER_BLOCK_REQUIRED");
  return m[1];
}
function triggerNames(text){
  const block=triggerBlock(text), out=[];
  for(const m of block.matchAll(/^  ([A-Za-z0-9_]+):/gm))out.push(m[1]);
  return [...new Set(out)].sort();
}
function actionsWrite(text){return /^  actions:\s*write\s*$/m.test(text);}
function cap09Workflows(){
  return fs.readdirSync(path.join(ROOT,".github/workflows"))
    .filter(n=>/^mcft-cap-09-.*\.ya?ml$/.test(n))
    .map(n=>".github/workflows/"+n).sort();
}
function ancestor(a,b){
  return cp.spawnSync("git",["merge-base","--is-ancestor",a,b],{cwd:ROOT,stdio:"ignore"}).status===0;
}
function result(authority,enforce){
  const head=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
  req(/^[0-9a-f]{40}$/.test(head),"PHASE6_HEAD_INVALID");
  req(authority.schema_version==="geox_mcft_cap09_phase6_github_production_execution_retirement_authority_v1","PHASE6_AUTHORITY_SCHEMA_REQUIRED");
  req(ancestor(authority.phase5_closure_head,head),"PHASE6_PHASE5_CLOSURE_ANCESTOR_REQUIRED");

  const production=authority.retirement_targets.production_execution.map(x=>x.path);
  const providerAudit=authority.retirement_targets.provider_facing_audit_schedule.map(x=>x.path);
  const retired=[...new Set([...production,...providerAudit])].sort();
  req(retired.length===production.length+providerAudit.length,"PHASE6_RETIREMENT_PATH_DUPLICATE");
  const allowedRetired=new Set(authority.retirement_contract.retired_workflow_allowed_top_level_triggers);
  const forbiddenRetired=new Set(authority.retirement_contract.forbidden_retired_workflow_triggers);
  const preservedScheduled=new Set(authority.preserved_automatic_github_workflows.scheduled.map(x=>x.path));
  const preservedWorkflowRun=new Set(authority.preserved_automatic_github_workflows.workflow_run.map(x=>x.path));

  const inventory=cap09Workflows().map(rel=>{
    const text=workflowText(rel), triggers=triggerNames(text);
    return {path:rel,triggers,actions_write:actionsWrite(text)};
  });
  const byPath=new Map(inventory.map(x=>[x.path,x]));
  const violations=[];

  for(const rel of retired){
    const row=byPath.get(rel); req(row,"PHASE6_RETIRED_WORKFLOW_NOT_FOUND",rel);
    const forbidden=row.triggers.filter(t=>forbiddenRetired.has(t));
    const unexpected=row.triggers.filter(t=>!allowedRetired.has(t));
    if(forbidden.length)violations.push({class:"RETIRED_WORKFLOW_FORBIDDEN_TRIGGER",path:rel,triggers:forbidden});
    if(unexpected.length)violations.push({class:"RETIRED_WORKFLOW_UNEXPECTED_TRIGGER",path:rel,triggers:unexpected});
    if(row.actions_write)violations.push({class:"RETIRED_WORKFLOW_ACTIONS_WRITE",path:rel});
  }

  const scheduled=inventory.filter(x=>x.triggers.includes("schedule")).map(x=>x.path).sort();
  const unexpectedScheduled=scheduled.filter(x=>!preservedScheduled.has(x)&&!retired.includes(x));
  for(const rel of unexpectedScheduled)violations.push({class:"UNCLASSIFIED_CAP09_SCHEDULED_WORKFLOW",path:rel});
  for(const rel of preservedScheduled)if(!scheduled.includes(rel))violations.push({class:"PRESERVED_SCHEDULED_WORKFLOW_MISSING_SCHEDULE",path:rel});

  const workflowRun=inventory.filter(x=>x.triggers.includes("workflow_run")).map(x=>x.path).sort();
  const unexpectedWorkflowRun=workflowRun.filter(x=>!preservedWorkflowRun.has(x)&&!retired.includes(x));
  for(const rel of unexpectedWorkflowRun)violations.push({class:"UNCLASSIFIED_CAP09_WORKFLOW_RUN",path:rel});
  for(const rel of preservedWorkflowRun)if(!workflowRun.includes(rel))violations.push({class:"PRESERVED_WORKFLOW_RUN_MISSING",path:rel});

  const activeRetired=retired.filter(rel=>{
    const row=byPath.get(rel); return row&&row.triggers.some(t=>forbiddenRetired.has(t));
  });
  const retiredWithActionsWrite=retired.filter(rel=>byPath.get(rel)?.actions_write===true);
  const proof={
    schema_version:"geox_mcft_cap09_phase6_github_production_owners_audit_v1",
    status:violations.length===0?"PASS":(enforce?"FAIL":"AUDIT_FINDINGS_PRESENT"),
    mode:enforce?"ENFORCE":"INVENTORY",
    subject_sha:head,
    phase5_closure_head:authority.phase5_closure_head,
    cap09_workflow_count:inventory.length,
    retirement_target_count:retired.length,
    production_execution_retirement_target_count:production.length,
    provider_facing_audit_retirement_target_count:providerAudit.length,
    actual_scheduled_workflows:scheduled,
    preserved_scheduled_workflows:[...preservedScheduled].sort(),
    actual_workflow_run_workflows:workflowRun,
    preserved_workflow_run_workflows:[...preservedWorkflowRun].sort(),
    active_retired_owner_or_trigger_count:activeRetired.length,
    active_retired_owner_or_trigger_paths:activeRetired,
    retired_actions_write_count:retiredWithActionsWrite.length,
    retired_actions_write_paths:retiredWithActionsWrite,
    unclassified_scheduled_count:unexpectedScheduled.length,
    unclassified_workflow_run_count:unexpectedWorkflowRun.length,
    violations,
    target_after_retirement:{
      github_provider_request_count_during_formal:0,
      github_formal_twin_db_mutation_count:0,
      github_production_tick_execution_count:0,
      github_hourly_wake_dependency_count:0
    },
    production_runtime_mutation:false,
    formal_v5_armed:false,
    mcft_cap09_completed:false
  };
  return proof;
}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");process.stdout.write(JSON.stringify(v,null,2)+"\n");}
function selftest(){
  const a="on:\n  pull_request:\n    paths: []\n  schedule:\n    - cron: '* * * * *'\npermissions:\n  contents: read\n";
  const b="on:\n  pull_request:\n    paths: []\npermissions:\n  contents: read\n# grep schedule:\n";
  req(JSON.stringify(triggerNames(a))===JSON.stringify(["pull_request","schedule"]),"PHASE6_SELFTEST_TRIGGER_PARSE");
  req(JSON.stringify(triggerNames(b))===JSON.stringify(["pull_request"]),"PHASE6_SELFTEST_TRIGGER_SCOPE");
  req(actionsWrite("permissions:\n  actions: write\n")===true,"PHASE6_SELFTEST_ACTIONS_WRITE");
  process.stdout.write(JSON.stringify({status:"PASS",trigger_parser_fail_closed:true})+"\n");
}
const mode=process.argv[2]||"inventory";
if(mode==="selftest")selftest();
else if(mode==="inventory"){const p=result(load(),false);write(p);}
else if(mode==="enforce"){const p=result(load(),true);write(p);if(p.status!=="PASS")process.exitCode=1;}
else throw new Error("PHASE6_AUDIT_MODE_INVALID:"+mode);
