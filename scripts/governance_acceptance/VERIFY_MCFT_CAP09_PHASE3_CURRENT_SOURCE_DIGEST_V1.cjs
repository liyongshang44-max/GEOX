#!/usr/bin/env node
"use strict";
// Read-only exact-current Phase3 digest difference and source-graph check.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../.."),C="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-PHASE3-CURRENT-SOURCE-DIGEST-DISPOSITION-V1.json";
const c=JSON.parse(fs.readFileSync(path.join(ROOT,C),"utf8"));
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024,timeout:45000}).trim();
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
function audit(){
 const head=git("rev-parse","HEAD");
 assert.equal(git("merge-base",c.base_sha,head),c.base_sha,"BASE_NOT_ANCESTOR");
 assert.deepEqual(git("diff","--name-only",c.base_sha,head).split(/\r?\n/).filter(Boolean).sort(),
   c.approved_new_paths,"PHASE3_UNREVIEWED_DIFF");
 const q=JSON.parse(fs.readFileSync(path.join(ROOT,
   "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json"),"utf8"));
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const a=planner.resolveDependencyResolvers(ROOT,q);assert.deepEqual(a.errors,[]);
 const check=q.checks.find(x=>x.check_id==="PHASE3_EVIDENCE_RUNTIME_FOUNDATION");
 assert(check&&check.resolver_ids?.length);
 const paths=[...new Set(check.resolver_ids.flatMap(r=>a.resolved[r]?.paths||[]))].sort();
 assert.equal(paths.length,c.current_scope_files);
 const entries=paths.map(p=>[p,git("rev-parse",head+":"+p)]);
 const graph="sha256:"+sha(Buffer.from(JSON.stringify(entries)));
 assert.equal(graph,c.current_blob_graph_sha256,"CURRENT_SOURCE_GRAPH_MISMATCH");
 const catalog={};
 for(const r of check.resolver_ids)catalog[r]={current:planner.dependencyDigestForPaths(ROOT,head,a.resolved[r].paths,false)};
 const dep=planner.aggregateCheckDependencyDigest(check.resolver_ids,catalog,"current");
 assert.deepEqual(dep.missing,[]);
 assert.equal(dep.digest,c.current_digest,"CURRENT_PHASE3_DEPENDENCY_DIGEST_MISMATCH");
 assert.notEqual(dep.digest,c.previous_historical_digest,"OLD_PHASE3_DIGEST_CANNOT_BE_REUSED");
 const historic=paths.map(p=>{
    const current=git("rev-parse",head+":"+p);
    const old=cp.spawnSync("git",["rev-parse",c.previous_historical_subject+":"+p],{cwd:ROOT,encoding:"utf8"});
    const oldBlob=old.status===0?old.stdout.trim():null;
    return {path:p,old_blob:oldBlob,current_blob:current,changed_or_not_present:oldBlob!==current};
 });
 assert(historic.some(x=>x.changed_or_not_present),"REAL_DEPENDENCY_DRIFT_MUST_NOT_BE_FABRICATED");
 return {status:"PASS_PHASE3_CURRENT_SOURCE_EXACT_DIGEST_CLASSIFIED_TEST_ONLY",
   current_head:head,previous_subject:c.previous_historical_subject,
   prior_digest:c.previous_historical_digest,current_digest:dep.digest,
   graph_sha256:graph,paths_total:paths.length,
   changed_paths:historic.filter(x=>x.changed_or_not_present),
   previous_historical_run_carry_forward:false,
   new_native_pg_evidence_signed:false,
   formal_governance_approval:false,formal_six_stage_completed:0,
   permit:false,windows_physical_admission:false,production_authorized:false};
}
if(!process.argv.includes("--verify"))throw Error("VERIFY_ONLY");
try{
 const result=audit();
 if(process.argv.includes("--out")){
   fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
   fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP09_PHASE3_CURRENT_SOURCE_DIGEST_V1.json"),
     JSON.stringify(result,null,2)+"\n");
 }
 console.log(JSON.stringify({status:result.status,head:result.current_head,
   prior_digest:result.prior_digest,current_digest:result.current_digest,
   paths_total:result.paths_total,changed_paths_count:result.changed_paths.length,permit:false}));
}catch(e){console.error("HOLD_PHASE3_CURRENT:"+String(e.stack||e));process.exitCode=1}
