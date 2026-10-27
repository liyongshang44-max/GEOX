#!/usr/bin/env node
"use strict";
/** Independent TEST_ONLY exact-108 evidence inventory. Never requalifies Frozen V13. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json";
const Q="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const OLD_CONTRACT="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FROZEN-V13-REQUALIFICATION-CONTRACT-V1.json";
const OLD_VERIFIER="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_SUCCESSOR_V1.cjs";
const OLD_TEST="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FROZEN_V13_REQUALIFICATION_V1.cjs";
const HIST_SUCCESS="3a803d703320c5dfb416c6b022767fd1fa1fccba";
const HIST_FROZEN="3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a";
const BASE="63dc3382f879781c604a852c7d1b28af9b0dd9f4";
const HIST_DIGEST="sha256:733739cdb36b50078ce5fc7fb628d252de9b68fb6d4d5e102fbd8ff53ac39c0f";
const BASE_DIGEST="sha256:13884b41d719ad88334e4fe757cd014fa670e363f92e96413ce4ef2fd7f7ba26";
const ALLOWED=[".github/workflows/mcft-cap09-frozen108-runtime-successor-inventory-v1.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-FROZEN108-RUNTIME-SUCCESSOR-INVENTORY-V1.json","scripts/governance_acceptance/VERIFY_MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_INVENTORY_V1.cjs"].sort();
const git=(...a)=>cp.execFileSync("git",a,{cwd:ROOT,encoding:"utf8",timeout:30000,maxBuffer:16*1024*1024}).trim();
const show=(rev,p)=>cp.execFileSync("git",["show",rev+":"+p],{cwd:ROOT,maxBuffer:16*1024*1024,timeout:30000});
const sha=b=>"sha256:"+crypto.createHash("sha256").update(b).digest("hex");
function check(v,m){assert(v,m);}
function unchangedAtBase(file){assert.equal(git("rev-parse","HEAD:"+file),git("rev-parse",BASE+":"+file),"HISTORICAL_PROTECTED_SOURCE_MUTATED:"+file);}
function compute(){
 const head=git("rev-parse","HEAD");
 check(git("merge-base","--is-ancestor",BASE,head)==="", "BASE_NOT_ANCESTOR"); // git command exits nonzero on mismatch
 const changed=git("diff","--name-only",BASE,head).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,ALLOWED,"INVENTORY_ONLY_THREE_NEW_PATHS_ALLOWED");
 for(const f of [Q,OLD_CONTRACT,OLD_VERIFIER,OLD_TEST,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json"])unchangedAtBase(f);
 assert.equal(git("rev-parse",BASE+":"+OLD_TEST),"19659f3f7745a2fb4bb528c6552fb79041e3206f","OLD_FROZEN_SELFTEST_IDENTITY");
 const q=JSON.parse(fs.readFileSync(path.join(ROOT,Q),"utf8"));
 const planner=require("./PLAN_MCFT_CAP_09_CHECK_APPLICABILITY_V1.cjs");
 const r=q.dependency_resolvers.V13_RUNTIME_SEMANTIC_CLOSURE;
 assert.equal(r.kind,"IMPORT_CLOSURE");
 const closure=planner.buildImportClosure(ROOT,r.roots);
 assert.deepEqual(closure.missing,[],"V13_IMPORT_CLOSURE_MISSING");
 const paths=[...new Set([...closure.paths,...r.additional_exact_paths])].sort();
 assert.equal(paths.length,108,"FROZEN108_ACTUAL_RESOLVED_PATH_COUNT");
 const fd=planner.dependencyDigestForPaths(ROOT,HIST_FROZEN,paths,false);
 const cd=planner.dependencyDigestForPaths(ROOT,BASE,paths,false);
 const hd=planner.dependencyDigestForPaths(ROOT,head,paths,false);
 assert.deepEqual(fd.missing,[],"HISTORICAL_FROZEN_MISSING");
 assert.deepEqual(cd.missing,[],"PROTECTED_MAIN_MISSING");
 assert.deepEqual(hd.missing,[],"NEW_PR_HEAD_MISSING");
 assert.equal(fd.digest,HIST_DIGEST,"HISTORICAL_DIGEST_CHANGED");
 assert.equal(cd.digest,BASE_DIGEST,"BASE_DIGEST_CHANGED");
 assert.equal(hd.digest,cd.digest,"PR_MODIFIED_RUNTIME_BYTES");
 assert.notEqual(fd.digest,cd.digest,"NOT_ACTUALLY_DRIFTED");
 const entries=paths.map(p=>{
   const previous=show(HIST_FROZEN,p),current=show(BASE,p);
   const hb=git("rev-parse",HIST_FROZEN+":"+p),cb=git("rev-parse",BASE+":"+p);
   return {path:p,historical_git_blob:hb,current_git_blob:cb,
     historical_sha256:sha(previous),current_sha256:sha(current),changed:hb!==cb};
 });
 const changedEntries=entries.filter(e=>e.changed);
 assert(changedEntries.length>0,"NO_DRIFT_ENTRIES");
 const names=git("diff","--name-only",HIST_FROZEN,BASE,"--",...paths).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changedEntries.map(e=>e.path),names,"DRIFT_INVENTORY_VS_GIT_DIFF");
 const digest=sha(Buffer.from(JSON.stringify(entries),"utf8"));
 return {schema_version:"mcft_cap09_runtime_exact108_successor_path_inventory_v1",state:"READONLY_INVENTORY_NOT_HISTORICAL_QUALIFICATION",protected_main_subject:BASE,head,old_frozen_subject:HIST_FROZEN,original_registered_success_subject:HIST_SUCCESS,
   resolver_id:"V13_RUNTIME_SEMANTIC_CLOSURE",total_paths:entries.length,changed_paths:changedEntries.length,unchanged_paths:entries.length-changedEntries.length,
   historical_runtime_digest:fd.digest,protected_main_runtime_digest:cd.digest,exact_entries_sha256:digest,
   entries,original_historical_gate_pass:false,original_six_stage_count:0,permit:false,production_authorized:false,physical_admission_authorized:false,
   provider_calls:0,pg_reads:0,pg_writes:0,s3_calls:0,s3_writes:0};
}
function validatePinned(inventory,contract){
 assert.equal(contract.contract_id,"MCFT_CAP09_FROZEN108_RUNTIME_SUCCESSOR_EXACT_PATHS_V1");
 assert.equal(contract.subject_base_sha,BASE);
 assert.equal(contract.historical_frozen_sha,HIST_FROZEN);
 assert.equal(contract.registered_history_sha,HIST_SUCCESS);
 assert.equal(contract.expected_path_count,108);
 assert.equal(contract.frozen_digest,HIST_DIGEST);
 assert.equal(contract.protected_main_digest,BASE_DIGEST);
 assert.equal(contract.historical_frozen_requalified,false);
 assert.equal(contract.permit_authorized,false);
 assert.equal(contract.production_authorized,false);
 assert.equal(contract.physical_execution_authorized,false);
 assert.equal(contract.original_six_stage_count,0);
 assert(Array.isArray(contract.entries)&&contract.entries.length===108,"PINNED_EXACT_108_CATALOG_REQUIRED");
 assert.deepEqual(contract.entries,inventory.entries,"RUNTIME_PATH_OR_BLOB_CATALOG_DRIFT");
 assert.equal(contract.entries_sha256,inventory.exact_entries_sha256,"RUNTIME_CATALOG_DIGEST_MISMATCH");
 assert.equal(contract.changed_path_count,inventory.changed_paths,"DRIFT_COUNT_MISMATCH");
 assert(contract.changed_path_count>0);
 return {status:"PASS_READONLY_FROZEN108_SUCCESSOR_EXACT_DEPENDENCY_CATALOG_NOT_HISTORICAL_V13",
     protected_main:BASE,successor_head:inventory.head,path_count:108,changed_path_count:inventory.changed_paths,
     immutable_catalog_digest:inventory.exact_entries_sha256,historical_digest:HIST_DIGEST,current_digest:BASE_DIGEST,
     frozen_historical_qualification:false,formal_stage_completed:0,permit:false,production_authorized:false,
     physical_admission_authorized:false,no_provider:true,no_pg:true,no_s3:true};
}
const args=process.argv.slice(2);
const result=compute();
if(args.includes("--inventory")) {
 console.log("CAP09_FROZEN108_EXACT_INVENTORY_JSON="+JSON.stringify(result));
}else if(args.includes("--verify")){
 const contract=JSON.parse(fs.readFileSync(path.join(ROOT,CONTRACT),"utf8"));
 const proof=validatePinned(result,contract);
 console.log(JSON.stringify(proof));
}else if(args.includes("--negative")){
 const contract=JSON.parse(fs.readFileSync(path.join(ROOT,CONTRACT),"utf8"));
 validatePinned(result,contract);
 for(const edit of [c=>c.entries[0].current_git_blob="0".repeat(40),
                     c=>c.entries.shift(),c=>c.entries[0].historical_sha256="sha256:"+"0".repeat(64),
                     c=>c.changed_path_count=0,c=>c.protected_main_digest=HIST_DIGEST,
                     c=>c.historical_frozen_requalified=true,c=>c.permit_authorized=true]){
  const copy=structuredClone(contract);edit(copy);
  assert.throws(()=>validatePinned(result,copy),"TAMPER_NEGATIVE_NOT_REJECTED");
 }
 console.log(JSON.stringify({status:"PASS_SEVEN_NEGATIVE_FAIL_CLOSED_TESTS",count:7}));
}else{throw Error("MODE_REQUIRED_INVENTORY_VERIFY_NEGATIVE")}
