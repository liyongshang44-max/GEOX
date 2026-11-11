#!/usr/bin/env node
"use strict";
// Independent new-source diagnostic only. Cannot sign evidence or clear old QCP blockers.
const assert=require("node:assert/strict"),fs=require("node:fs"),crypto=require("node:crypto"),cp=require("node:child_process"),path=require("node:path");
const ROOT=path.resolve(__dirname,"../.."),P="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-CURRENT-COMPOSER-FIVE-REQUAL-V1.json";
const c=JSON.parse(fs.readFileSync(path.join(ROOT,P),"utf8"));
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",maxBuffer:32*1024*1024,timeout:45000}).trim();
const spawn=(...a)=>cp.spawnSync("git",a,{cwd:ROOT,encoding:"utf8"}).status===0;
const SHA=s=>crypto.createHash("sha256").update(s).digest("hex");
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
const got=(rev,p)=>git("rev-parse",rev+":"+p);
function check(){
 const head=git("rev-parse","HEAD");
 for(const parent of [c.main_base,c.signed_historical_subject,c.phase3_old_subject,c.current_108_catalog_source_subject])
   assert(spawn("cat-file","-e",parent),"PINNED_COMMIT_NOT_AVAILABLE:"+parent);
 assert(spawn("merge-base","--is-ancestor",c.main_base,head),"BASE_NOT_ANCESTOR");
 const changes=git("diff","--name-only",c.main_base,head).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changes,c.exact_new_paths,"UNREVIEWED_SUCCESSOR_CHANGED_PATHS");
 assert.equal(got(c.signed_historical_subject,c.composer_path),c.original_composer_blob);
 assert.equal(got(c.main_base,c.composer_path),c.current_composer_blob);
 assert.equal(got(head,c.composer_path),c.current_composer_blob,"CURRENT_COMPOSER_UNREVIEWED");
 assert.equal(git("hash-object",c.composer_path),c.current_composer_blob,"COMPOSER_WORKTREE_MUTATED");
 const old=cp.execFileSync("git",["show",c.original_composer_blob],{cwd:ROOT,encoding:"utf8"});
 let expected=old;
 const edits=[
 ["  fetch_impl?: typeof fetch;\n","  fetch_impl?: typeof fetch;\n  python_executable?: string; // Test-only caller pins actual Python binary for Windows science\n"],
 ["{retention,clock,fetch_impl:input.fetch_impl});","{retention,clock,fetch_impl:input.fetch_impl,python_executable:input.python_executable});"],
 ["    rehydration_decoder_factory:new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1(),",`    // The GFS capture factory and Candidate raw-rehydration factory MUST use the
    // same pinned interpreter. Otherwise Windows capture succeeds but replay
    // silently falls back to unqualified "python3" on PATH (often ENOENT).
    // This is isolated-qualification-only wiring; production graph untouched.
    rehydration_decoder_factory:new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1({
      python_executable:input.python_executable,
    }),`]
 ];
 for(const [a,b] of edits){
   assert.equal(expected.split(a).length,2,"COMPOSER_PATCH_ANCHOR_NOT_EXACT");
   expected=expected.replace(a,b);
 }
 assert.equal(expected,fs.readFileSync(path.join(ROOT,c.composer_path),"utf8"),"UNREVIEWED_COMPOSER_DELTA");
 const historic=read(c.original_semantic_contract),registry=read(c.original_signed_six_registry);
 assert.equal(historic.expected_unchanged_isolated_composer_git_blob_sha,c.original_composer_blob,"HISTORIC_CONTRACT_CHANGED");
 assert.equal(registry.subject_source_sha,"ff0183347e783d9e2d35ebdee91c28d4d903aac2");
 assert.equal(registry.entries.length,6);
 const catalogue=JSON.parse(cp.execFileSync("git",["show",c.current_108_catalog_source_subject+":docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json"],{cwd:ROOT,encoding:"utf8"}));
 assert.equal(catalogue.entries_sha256,c.current_runtime_108_source_catalog_sha256);
 assert.equal(catalogue.entries.length,108);assert.equal(catalogue.changed_path_count,2);
 for(const row of catalogue.entries)assert.equal(got(head,row.path),row.current_git_blob,"CURRENT_FROZEN108_SOURCE_DRIFT:"+row.path);
 const q=read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json");
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const result=planner.resolveDependencyResolvers(ROOT,q);assert.deepEqual(result.errors,[]);
 const checks={};
 for(const id of c.five_checks.concat(["PHASE3_EVIDENCE_RUNTIME_FOUNDATION"])){
   const row=q.checks.find(x=>x.check_id===id);
   assert(row&&row.resolver_ids.length>0,"QCP_CHECK_MISSING:"+id);
   const paths=[...new Set(row.resolver_ids.flatMap(k=>result.resolved[k]?.paths||[]))].sort();
   assert(paths.length>0,"CURRENT_SOURCE_PATHS_EMPTY:"+id);
   const cats={};
   for(const key of row.resolver_ids)cats[key]={current:planner.dependencyDigestForPaths(ROOT,head,result.resolved[key].paths,false)};
   const aggregate=planner.aggregateCheckDependencyDigest(row.resolver_ids,cats,"current");
   assert.deepEqual(aggregate.missing,[]);
   checks[id]={path_count:paths.length,source_path_blobs_sha256:"sha256:"+SHA(Buffer.from(JSON.stringify(paths.map(p=>[p,got(head,p)])))),
      dependency_digest:aggregate.digest};
 }
 for(const id of c.five_checks.concat(["PHASE3_EVIDENCE_RUNTIME_FOUNDATION"])){
   const present=registry.entries.filter(e=>e?.payload?.check_id===id);
   assert.equal(present.length,1,"EXACT_ONE_HISTORIC_SIGNED_ITEM_REQUIRED:"+id);
   const signed=present[0].payload;
   assert(/^sha256:[0-9a-f]{64}$/.test(checks[id].dependency_digest),"CANONICAL_DIGEST_FORMAT_REQUIRED");
   assert.equal(checks[id].dependency_digest,signed.dependency_digest,"EXACT_DEPENDENCY_GRAPH_MUST_MATCH_EXISTING_SIGNED_SOURCE:"+id);
   assert.equal(checks[id].source_path_blobs_sha256,"sha256:"+signed.source_blob_sha256,"EXACT_BLOB_GRAPH_MUST_MATCH_SIGNED_SOURCE:"+id);
   assert.notEqual(head,signed.subject_sha,"HISTORICAL_SIGNATURE_CANNOT_BIND_NEW_SUBJECT");
 }
 assert.notEqual(checks.PHASE3_EVIDENCE_RUNTIME_FOUNDATION.dependency_digest,c.phase3_old_digest,"OLD_PHASE3_DIGEST_MUST_NOT_BE_CARRIED_FORWARD");
 const negative=structuredClone(c);negative.current_composer_blob="0".repeat(40);assert.notEqual(got(head,c.composer_path),negative.current_composer_blob);
 const report={status:"PASS_CURRENT_DA9_COMPOSER_EXACT_SOURCE_AUDIT_NOT_SIGNED",
   subject_sha:head,old_composer_blob:c.original_composer_blob,new_composer_blob:c.current_composer_blob,
   exact_three_edits_verified:true,prior_signed_six_unchanged:true,
   current_frozen108_catalog_verified:true,checks,
   four_prior_real_ci_proofs_require_native_run_and_artifact_verification:true,
   phase7_new_real_ci_proof_separately_required:true,phase3_historic_digest_carried_forward:false,
   historical_frozen_zero_drift_claim:false,signed_new_requalification:false,
   global_qcp_zero_blockers:false,permit:false,windows_physical_admission:false,
   original_six_stage_completed:0,production_authorized:false,
   provider_calls:0,pg_reads:0,pg_writes:0,s3_calls:0,s3_writes:0};
 return report;
}
if(!process.argv.includes("--verify"))throw Error("VERIFY_MODE_REQUIRED");
try{console.log(JSON.stringify(check()))}catch(e){console.error("HOLD_COMPOSER_SUCCESSOR:"+String(e.stack||e));process.exitCode=1}
