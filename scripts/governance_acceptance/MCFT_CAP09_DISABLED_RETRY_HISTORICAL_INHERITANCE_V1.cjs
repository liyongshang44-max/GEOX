#!/usr/bin/env node
"use strict";
// Historical exact-merge proof is executed in a private clone pinned to PR #3691.
// Its original verifier and assertions remain unchanged; current-main ancestry
// never substitutes for historical first-parent/merge-tree/path/frozen checks.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../..");
const HISTORICAL_MERGE="0d62e7fa4f0905151b38c25964b48d672187e6d3";
const BASE="c9e027b832d1e25a20384d4853ed5564ed405fd4";
const VERIFIER="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_DISABLED_RETRY_SUCCESSOR_V1.cjs";
function assertLineage({head,main,firstParent,parents,tree,changedPaths,verifyHistorical}) {
 assert(/^[0-9a-f]{40}$/.test(head)&&/^[0-9a-f]{40}$/.test(main),"SUBJECT_SHA_INVALID");
 assert(firstParent.includes(HISTORICAL_MERGE),"DISABLED_RETRY_FIRST_PARENT_CHAIN_BROKEN");
 const historicalParents=parents(HISTORICAL_MERGE);
 assert.equal(historicalParents.length,2,"HISTORICAL_MERGE_TWO_PARENTS_REQUIRED");
 assert.equal(historicalParents[0],BASE,"HISTORICAL_FIRST_PARENT_CHANGED");
 assert.equal(tree(HISTORICAL_MERGE),tree(historicalParents[1]),"HISTORICAL_MERGE_TREE_CHANGED");
 assert(firstParent[0]===head,"CURRENT_HEAD_NOT_FIRST_PARENT_TIP");
 assert(firstParent[firstParent.length-1]===HISTORICAL_MERGE,"HISTORICAL_CHAIN_NOT_CONTIGUOUS");
 const historical=verifyHistorical();
 assert.equal(historical.status,"PASS","HISTORICAL_EXACT_PROOF_NOT_PASS");
 assert.equal(historical.head,HISTORICAL_MERGE,"HISTORICAL_SUBJECT_CHANGED");
 assert.equal(historical.qcp_check_count,52,"HISTORICAL_52_CHECKS_CHANGED");
 assert.equal(historical.frozen_runtime_108_unchanged,true,"HISTORICAL_FROZEN_RUNTIME_CHANGED");
 const changed=changedPaths(HISTORICAL_MERGE,head);
 assert(Array.isArray(changed),"POST_MERGE_DIFF_UNAVAILABLE");
 return {status:"PASS",adjudication:"HISTORICAL_EXACT_MERGE_PROVEN_SUCCESSOR_INHERITANCE_ONLY",
 historical_merge:HISTORICAL_MERGE,head,main,first_parent_successor_count:firstParent.length-1,
 downstream_changed_paths:changed,downstream_qcp_applicability_required:true,
 downstream_qcp_adopted:false,execute_authorized:false,production_authorized:false};
}
const git=(cwd,...args)=>cp.execFileSync("git",args,{cwd,encoding:"utf8",timeout:120000,maxBuffer:16*1024*1024}).trim();
function verifyHistoricalInClone() {
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),"mcft-3691-history-"));
 const checkout=path.join(temp,"historical");
 try {
  cp.execFileSync("git",["clone","--shared","--no-checkout",ROOT,checkout],{stdio:"ignore",timeout:240000});
  git(checkout,"checkout","--detach",HISTORICAL_MERGE);
  // This ref changes ONLY inside the independent clone, never in the working repo.
  git(checkout,"update-ref","refs/remotes/origin/main",HISTORICAL_MERGE);
  assert.equal(git(checkout,"rev-parse","origin/main"),HISTORICAL_MERGE);
  const text=cp.execFileSync(process.execPath,[VERIFIER],{cwd:checkout,encoding:"utf8",timeout:27*60*1000,maxBuffer:16*1024*1024});
  return JSON.parse(text);
 } finally { fs.rmSync(temp,{recursive:true,force:true}); }
}
function verifyInheritedSuccessor() {
 const head=git(ROOT,"rev-parse","HEAD"),main=git(ROOT,"rev-parse","origin/main");
 const original=git(ROOT,"show","-s","--format=%P",HISTORICAL_MERGE).split(" ");
 const full=git(ROOT,"rev-list","--first-parent",head).split("\n");
 const index=full.indexOf(HISTORICAL_MERGE);
 assert(index>=0,"DISABLED_RETRY_FIRST_PARENT_CHAIN_BROKEN");
 assert(head===main||git(ROOT,"merge-base","--is-ancestor",main,head)==="","CURRENT_MAIN_NOT_ANCESTOR");
 const status=git(ROOT,"status","--porcelain").split(/\r?\n/).filter(x=>x&&!x.startsWith("?? acceptance-output/"));
 assert.deepEqual(status,[],"DIRTY_SOURCE");
 const ancestors=full.slice(0,index+1);
 return assertLineage({head,main,firstParent:ancestors,parents:sha=>git(ROOT,"show","-s","--format=%P",sha).split(" "),
 tree:sha=>git(ROOT,"rev-parse",sha+"^{tree}"),
 changedPaths:(a,b)=>git(ROOT,"diff","--name-only",a,b).split("\n").filter(Boolean),
 verifyHistorical:verifyHistoricalInClone});
}
module.exports={HISTORICAL_MERGE,BASE,assertLineage,verifyInheritedSuccessor};
if(require.main===module){try{console.log(JSON.stringify(verifyInheritedSuccessor(),null,2));}catch(e){console.error(e.stack||String(e));process.exitCode=1;}}
