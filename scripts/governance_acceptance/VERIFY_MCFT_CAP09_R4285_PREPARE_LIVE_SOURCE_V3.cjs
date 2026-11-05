"use strict";
// Source-only QCP73 extension. Does not qualify an installed release, resource
// authority or a Windows live session, and never rewrites prior QCP evidence.
const fs=require("node:fs"),cp=require("node:child_process"),assert=require("node:assert/strict");
const spec=require("../runtime_acceptance/MCFT_CAP09_R4285_V3_SOURCE_PATHS.cjs");
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
let cached=null;
function verify({ROOT,args,authority,plan,changed,stage}){
 if(cached)return cached;
 const git=(...xs)=>cp.execFileSync("git",xs,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:8*1024*1024}).trim();
 try{
  assert.equal(stage,"SUCCESSOR_SUBJECT_PRE_MERGE");assert.equal(args.base,spec.base);
  assert.equal(git("rev-parse","HEAD"),args.head);assert.equal(git("merge-base",args.base,args.head),args.base);
  assert.equal(plan.status,"PASS");for(const key of ["unknown_changed_paths","authority_errors","resolver_errors"])assert.deepEqual(plan[key],[]);
  const before=JSON.parse(git("show",args.base+":"+QCP));assert.equal(before.checks.length,72);assert.equal(authority.checks.length,73);
  assert.deepEqual(authority.checks.slice(0,72),before.checks);assert.equal(authority.checks[72].check_id,spec.checkId);
  assert.deepEqual(authority.checks[72].resolver_ids,[spec.resolverId]);
  const retained={...authority.dependency_resolvers};delete retained[spec.resolverId];assert.deepEqual(retained,before.dependency_resolvers);
  const paths=git("diff","--name-only",args.base,args.head).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(paths,spec.changedPaths);assert.deepEqual(changed.slice().sort(),paths);
  assert.equal(authority.dependency_resolvers[spec.resolverId]?.kind,"EXACT_PATH_SET");assert.deepEqual(authority.dependency_resolvers[spec.resolverId].paths,paths);
  // Every historical source outside the explicit governance/workflow edit surfaces
  // is immutable. New code cannot hide modifications behind a V3 resolver.
  const allowed=new Set([QCP,"scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",".github/workflows/mcft-cap-09-qualification-control-plane-v1.yml",".github/workflows/mcft-cap-09-frozen-v13-isolated-requalification-v1.yml",".github/workflows/mcft-cap09-adoption-v2-attempt3-engineering-v1.yml"]);
  for(const rel of paths)if(!allowed.has(rel))assert.equal(git("ls-tree",args.base,"--",rel),"","V3_EXISTING_SOURCE_MODIFIED");
  assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request");
  const ev=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  assert.equal(ev.pull_request?.number,3758);assert.equal(ev.repository?.full_name,"liyongshang44-max/GEOX");assert.equal(ev.pull_request?.base?.sha,args.base);assert.equal(ev.pull_request?.head?.sha,args.head);
  assert.equal(ev.pull_request?.head?.ref,"mcft/r4285-prepare-live-v3");assert.equal(ev.pull_request?.head?.repo?.full_name,"liyongshang44-max/GEOX");
  const comment=JSON.parse(cp.execFileSync("curl",["--fail","--silent","--show-error","--max-time","20","https://api.github.com/repos/liyongshang44-max/GEOX/issues/comments/6647496120"],{encoding:"utf8",timeout:25000,maxBuffer:524288}));
  assert.equal(comment.id,6647496120);assert.equal(comment.user?.login,"liyongshang44-max");assert.equal(comment.author_association,"OWNER");
  assert.equal(comment.created_at,"2026-11-05T01:56:32Z");assert.equal(comment.updated_at,comment.created_at);
  assert(comment.body.includes("R4285_CTO_APPROVE_SINGLE_VERSIONED_PREPARE_LIVE_IMPLEMENTATION_20261105"));assert(comment.body.includes(spec.base));
  cp.execFileSync(process.execPath,["--test","scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_R4285_PREPARE_LIVE_V3.test.cjs"],{cwd:ROOT,timeout:120000,maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]});
  cached={status:"PASS",base_sha:args.base,source_head_sha:args.head,changed_paths:paths.length,historical_qcp72_preserved:true,source_contract_only:true,installed_release_qualified:false,windows_session_run:false,permit_consumed:false,execute_authorized:false,stage_count:0};
 }catch(error){cached={status:"FAIL",reason_code:"HOLD_V3_QCP73_SOURCE_QUALIFICATION",error_code:typeof error.code==="string"?error.code:"ASSERTION",detail:String(error.message||error).slice(0,700),permit_consumed:false,stage_count:0};}
 return cached;
}
module.exports={verify};
