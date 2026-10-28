"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {decide}=require("./MCFT_CAP09_EA5E2_POST_PHASE6_DIFFERENTIAL_ROUTE_V1.cjs");
const main="d38a5b07a92a63c67fbe2fcc3982ff9b9491e5ac",head="e5890cfb774221a8876204e4105082fdea677bb5";
const graphPaths=[".github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml",
"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py",
...Array.from({length:22},(_,i)=>"scripts/runtime_acceptance/frozen_component_"+i+".cjs")];
function fixture(paths=["scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs"]){
 return {baseSha:main,headSha:head,changedPaths:paths,
 plan:{status:"FAIL",stage:"SUCCESSOR_SUBJECT_PRE_MERGE",generation:"v13",
 base_sha:main,head_sha:head,changed_paths:[...paths],authority_errors:[],
 resolver_errors:[],unknown_changed_paths:[],blockers:["HISTORICAL_FROZEN_EVIDENCE_NOT_PROMOTED"],
 decisions:[{check_id:"EA5E2_RUNTIME_DEPENDENCY_GRAPH",status:"REQUIRED"}]},
 graph:{status:"PASS",phase6_retirement_authority_active:true,
 phase6_live_manual_dispatch_forbidden:true,runtime_dependency_graph_paths:graphPaths}};
}
test("central FAIL remains visibly FAIL even when genuine EA5E2 code is outside diff",()=>{
 const p=decide(fixture());
 assert.equal(p.action,"NON_APPLICABLE_SCOPED");
 assert.equal(p.central_planner_status,"FAIL");
 assert.equal(p.central_planner_overridden,false);
 assert.equal(p.central_planner_failures_are_still_failures,true);
 assert.equal(p.permit_authorized,false);
});
test("changed governed EA5E2 workflow must be requalified, not inherited",()=>{
 const f=fixture([graphPaths[0]]);
 const p=decide(f);
 assert.equal(p.action,"FULL_SCOPED");
 assert.deepEqual(p.ea5e2_changed_paths,[graphPaths[0]]);
});
test("wrong git diff, absent full graph, unknown paths, authority drift all HOLD",()=>{
 const mutations=[
 f=>f.changedPaths.push("silent-change"),
 f=>f.plan.changed_paths.push("undisclosed-change"),
 f=>f.plan.unknown_changed_paths.push("some/file"),
 f=>f.plan.authority_errors.push({code:"ERROR"}),
 f=>f.plan.resolver_errors.push({code:"ERROR"}),
 f=>f.plan.status="UNKNOWN",
 f=>f.plan.head_sha="a".repeat(40),
 f=>f.graph.status="FAIL",
 f=>f.graph.phase6_retirement_authority_active=false,
 f=>f.graph.phase6_live_manual_dispatch_forbidden=false,
 f=>f.graph.runtime_dependency_graph_paths=[],
 f=>f.graph.runtime_dependency_graph_paths=graphPaths.filter(x=>x!==graphPaths[0]),
 f=>f.graph.runtime_dependency_graph_paths=graphPaths.filter(x=>x!==graphPaths[1]),
 f=>f.plan.decisions=[{check_id:"EA5E2_RUNTIME_DEPENDENCY_GRAPH",status:"FORBIDDEN"}]
 ];
 for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>decide(f));}
 assert.equal(mutations.length,14);
});
