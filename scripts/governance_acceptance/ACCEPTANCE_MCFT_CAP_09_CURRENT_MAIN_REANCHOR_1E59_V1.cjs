#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "../..");
const ARTIFACT = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-MAIN-REANCHOR-1E59-V1.json";
const ACCEPTANCE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_CURRENT_MAIN_REANCHOR_1E59_V1.cjs";
const QCP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const ARTIFACT_SHA256 = "d17c0c74761e6cb86422942f77715ebbbf3777a7c69ed9dabeb06cf30289b1ab";
const OLD_BASE = "512fb706040bf609c949aabb641afa300bd4c91b";
const NEW_BASE = "1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20";
const NEW_TREE = "5ea0e43f43e6765f424b872d60099d9466f3cb33";
function git(args) { return cp.execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim(); }
function lines(value) { return value.split(/\r?\n/).filter(Boolean); }
function verifyObserved(artifact, observed) {
  assert.equal(observed.current_main, NEW_BASE, "REANCHOR_1E59_PROTECTED_MAIN_DRIFT");
  assert.equal(observed.tree, NEW_TREE, "REANCHOR_1E59_TREE_DRIFT");
  assert.equal(observed.old_is_ancestor, true, "REANCHOR_1E59_OLD_BASE_NOT_ANCESTOR");
  assert.equal(observed.head_descends_from_main, true, "REANCHOR_1E59_HEAD_NOT_DESCENDANT");
  assert.deepEqual(observed.first_parent_successors, artifact.exact_first_parent_successors, "REANCHOR_1E59_FIRST_PARENT_LINEAGE_DRIFT");
  assert.deepEqual(observed.changed_paths, artifact.exact_changed_paths.map((row) => row.path).sort(), "REANCHOR_1E59_CHANGED_PATH_SET_DRIFT");
  for (const row of artifact.exact_changed_paths) assert.equal(observed.blobs[row.path], row.blob_sha, `REANCHOR_1E59_ADOPTED_BLOB_DRIFT:${row.path}`);
}
function main() {
  const bytes = fs.readFileSync(path.join(ROOT, ARTIFACT));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), ARTIFACT_SHA256, "REANCHOR_1E59_DECLARATION_DIGEST_DRIFT");
  const artifact = JSON.parse(bytes);
  assert.equal(artifact.previous_accepted_mcft_base, OLD_BASE);
  assert.equal(artifact.current_protected_main, NEW_BASE);
  assert.equal(artifact.current_protected_main_tree, NEW_TREE);
  assert.equal(artifact.qcp_admission.baseline_qualification_carry_forward_authorized, false);
  for (const value of Object.values(artifact.non_effects)) assert.equal(value, false);
  if (process.argv.includes("--selftest")) {
    const good={current_main:NEW_BASE,tree:NEW_TREE,old_is_ancestor:true,head_descends_from_main:true,first_parent_successors:structuredClone(artifact.exact_first_parent_successors),changed_paths:artifact.exact_changed_paths.map(r=>r.path).sort(),blobs:Object.fromEntries(artifact.exact_changed_paths.map(r=>[r.path,r.blob_sha]))};
    verifyObserved(artifact,good);
    const cases=[["MAIN_DRIFT",x=>{x.current_main=OLD_BASE;}],["TREE_DRIFT",x=>{x.tree="0".repeat(40);}],["OLD_BASE_NOT_ANCESTOR",x=>{x.old_is_ancestor=false;}],["HEAD_NOT_DESCENDANT",x=>{x.head_descends_from_main=false;}],["FIRST_PARENT_LINEAGE_DRIFT",x=>{x.first_parent_successors[0].sha="0".repeat(40);}],["CHANGED_PATH_SET_DRIFT",x=>{x.changed_paths.push("apps/server/src/runtime/unadjudicated.ts");}],["ADOPTED_BLOB_DRIFT",x=>{x.blobs[x.changed_paths[0]]="0".repeat(40);}]];
    for(const [code,mutate] of cases){const altered=structuredClone(good);mutate(altered);assert.throws(()=>verifyObserved(artifact,altered),new RegExp(code));}
    console.log(JSON.stringify({status:"PASS",scope:"REANCHOR_OBSERVATION_NEGATIVE_TESTS_ONLY",positive_cases:1,negative_cases:cases.length,base_admitted:false}));return;
  }
  const observed={current_main:git(["rev-parse","origin/main"]),tree:git(["rev-parse",`1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20^{tree}`]),old_is_ancestor:cp.spawnSync("git",["merge-base","--is-ancestor",OLD_BASE,NEW_BASE],{cwd:ROOT}).status===0,head_descends_from_main:cp.spawnSync("git",["merge-base","--is-ancestor",NEW_BASE,"HEAD"],{cwd:ROOT}).status===0,first_parent_successors:lines(git(["rev-list","--first-parent","--reverse",`512fb706040bf609c949aabb641afa300bd4c91b..1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20`])).map((sha)=>{const parents=git(["rev-list","--parents","-n","1",sha]).split(/\s+/).slice(1);const match=git(["show","-s","--format=%s",sha]).match(/^Merge pull request #(\d+) /);assert(match,"REANCHOR_1E59_MERGE_PR_IDENTITY_MISSING");return{sha,parents,pr_number:Number(match[1])};}),changed_paths:lines(git(["diff","--name-only",`512fb706040bf609c949aabb641afa300bd4c91b..1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20`])).sort(),blobs:Object.fromEntries(artifact.exact_changed_paths.map(r=>[r.path,git(["rev-parse",`1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20:${r.path}`])]))};
  verifyObserved(artifact,observed);
  const qcp=JSON.parse(fs.readFileSync(path.join(ROOT,QCP),"utf8"));
  const priorQcp=JSON.parse(git(["show",`1e59d001cbb8c1b858cd24caf61dbc02b3b0bf20:${QCP}`]));
  assert.deepEqual(qcp.governed_successor_predecessor_shas,priorQcp.governed_successor_predecessor_shas,"REANCHOR_1E59_BARE_ALLOWLIST_CHANGE_FORBIDDEN");
  assert(!qcp.governed_successor_predecessor_shas.includes(NEW_BASE),"REANCHOR_1E59_BARE_ALLOWLIST_FORBIDDEN");
  assert.equal(qcp.proof_bound_exact_base_admissions?.length,1,"REANCHOR_1E59_ADMISSION_CARDINALITY");
  const admission=qcp.proof_bound_exact_base_admissions[0];
  assert.equal(admission.base_sha,NEW_BASE);assert.equal(admission.current_protected_main_tree,NEW_TREE);assert.equal(admission.proof_artifact,ARTIFACT);assert.equal(admission.proof_acceptance,ACCEPTANCE);assert.equal(admission.proof_workflow,".github/workflows/mcft-cap-09-current-main-reanchor-2144-v1.yml");assert.equal(admission.mode,"PROOF_BOUND_EXACT_BASE");assert.equal(admission.bare_sha_allowlist_admission_authorized,false);assert.equal(admission.admission_requires_exact_lineage_and_overlap_proof,true);assert.equal(admission.baseline_qualification_carry_forward_authorized,false);
  for(const rel of [ARTIFACT,ACCEPTANCE]) assert(qcp.dependency_resolvers.CONTROL_PLANE_FILES.paths.includes(rel));
  const result={status:"PASS",scope:"EXACT_MERGED_LINEAGE_AND_OVERLAP_PRESERVATION_ONLY",base_sha:NEW_BASE,head_sha:git(["rev-parse","HEAD"]),tree_sha:NEW_TREE,first_parent_merges:observed.first_parent_successors.length,changed_paths:observed.changed_paths.length,zero_mcft_overlap_claimed:false,baseline_qualification_carried_forward:false,production_owner_proven:false,production_runtime_started:false,formal_v5_armed:false};
  fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});fs.writeFileSync(path.join(ROOT,"acceptance-output/MCFT_CAP_09_CURRENT_MAIN_REANCHOR_1E59_V1_RESULT.json"),JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main();
module.exports={verifyObserved};
