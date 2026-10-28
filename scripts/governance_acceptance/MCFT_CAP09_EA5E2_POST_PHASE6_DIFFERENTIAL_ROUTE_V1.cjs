"use strict";
/*
 * Differential EA5E2 PR route for post-Phase6 GH production retirement.
 * Does NOT alter or relabel the central V13 planner FAIL. Requires genuine
 * exact-head graph requalification and production-owner retirement audit at
 * the workflow before the scoped route can succeed.
 *
 * No evidence inheritance for changed bytes. No Permit/Host authority.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const SHA=/^[a-f0-9]{40}$/;
const unique=x=>[...new Set(x)].sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isPaths=x=>Array.isArray(x)&&x.every(p=>typeof p==="string"&&p.length>0&&!p.includes("\\")&&!p.startsWith("/")&&!p.includes(".."));
function decide({plan,graph,changedPaths,baseSha,headSha}){
 assert(SHA.test(baseSha)&&SHA.test(headSha)&&baseSha!==headSha,"EA5E2_DIFF_SUBJECTS");
 assert(plan&&plan.stage==="SUCCESSOR_SUBJECT_PRE_MERGE"&&plan.generation==="v13","EA5E2_DIFF_PLANNER_STAGE");
 assert.equal(plan.base_sha,baseSha,"EA5E2_DIFF_PLANNER_BASE");
 assert.equal(plan.head_sha,headSha,"EA5E2_DIFF_PLANNER_HEAD");
 assert(["PASS","FAIL"].includes(plan.status),"EA5E2_DIFF_PLANNER_NOT_COMPLETED");
 assert(isPaths(changedPaths)&&changedPaths.length>0,"EA5E2_DIFF_CHANGED_PATHS_REQUIRED");
 const actual=unique(changedPaths);
 assert.equal(actual.length,changedPaths.length,"EA5E2_DIFF_DUPLICATE_PATHS");
 assert.deepEqual(actual,unique(plan.changed_paths||[]),"EA5E2_DIFF_ACTUAL_GIT_DIFFERENCE");
 assert.deepEqual(plan.authority_errors,[],"EA5E2_DIFF_AUTHORITY_ERROR");
 assert.deepEqual(plan.resolver_errors,[],"EA5E2_DIFF_RESOLVER_ERROR");
 assert.deepEqual(plan.unknown_changed_paths,[],"EA5E2_DIFF_UNKNOWN_CHANGED_PATH");
 const row=(plan.decisions||[]).find(x=>x.check_id==="EA5E2_RUNTIME_DEPENDENCY_GRAPH");
 assert(row&&row.status!=="UNKNOWN"&&row.status!=="FORBIDDEN","EA5E2_DIFF_ROW_INVALID");
 assert(graph&&graph.status==="PASS","EA5E2_DIFF_FULL_GRAPH_NOT_PASS");
 assert.equal(graph.phase6_retirement_authority_active,true,"EA5E2_DIFF_PHASE6_RETIRED_AUTHORITY");
 assert.equal(graph.phase6_live_manual_dispatch_forbidden,true,"EA5E2_DIFF_LIVE_DISPATCH_FORBIDDEN");
 assert(isPaths(graph.runtime_dependency_graph_paths),"EA5E2_DIFF_GRAPH_UNVERIFIED_PATHS");
 const graphPaths=unique(graph.runtime_dependency_graph_paths);
 assert(graphPaths.length>20,"EA5E2_DIFF_GRAPH_SUSPICIOUSLY_SMALL");
 assert(graphPaths.includes(".github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml"),
  "EA5E2_DIFF_CENTRAL_WORKFLOW_MISSING");
 assert(graphPaths.includes("apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),
  "EA5E2_DIFF_SCIENCE_MISSING");
 const affected=actual.filter(x=>graphPaths.includes(x));
 const changeDigest=crypto.createHash("sha256").update(actual.join("\n")).digest("hex");
 return Object.freeze({
  schema_version:"GEOX_MCFT_CAP09_EA5E2_POST_PHASE6_DIFFERENTIAL_ROUTE_V1",
  status:"PASS_SCOPED_EA5E2_GRAPH_QUALIFICATION_NOT_GLOBAL_PLANNER_ADOPTION",
  base_sha:baseSha,head_sha:headSha,
  central_planner_status:plan.status,
  central_planner_blockers:(plan.blockers||[]).length,
  central_planner_overridden:false,central_planner_failures_are_still_failures:plan.status!=="PASS",
  phase6_production_retirement:true,global_certification_claimed:false,
  changed_paths_count:actual.length,changed_paths_sha256:changeDigest,
  ea5e2_changed_paths:affected,ea5e2_affected:affected.length>0,
  actual_full_ea5e2_graph_pass:true,
  action:affected.length?"FULL_SCOPED":"NON_APPLICABLE_SCOPED",
  allows_legacy_workflow_activation:false,host_v2_authorized:false,
  permit_authorized:false,production_authorized:false,
  original_six_stages_executed:0
 });
}
module.exports={decide};
