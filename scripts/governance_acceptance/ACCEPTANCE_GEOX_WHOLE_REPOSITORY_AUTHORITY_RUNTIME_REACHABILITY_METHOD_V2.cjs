#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=process.cwd();
const METHOD="docs/architecture/semantic_convergence/GEOX-WHOLE-REPOSITORY-AUTHORITY-RUNTIME-REACHABILITY-METHOD-V2.json";
const DOC="docs/architecture/semantic_convergence/GEOX-WHOLE-REPOSITORY-AUTHORITY-RUNTIME-REACHABILITY-AUDIT-V2.md";
const failures=[];
function readJson(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),"utf8");}
function req(cond,code){if(!cond)failures.push(code);}
const m=readJson(METHOD);
const d=read(DOC);
req(m.schema_version==="geox_whole_repository_authority_runtime_reachability_audit_method_v2","METHOD_SCHEMA_INVALID");
req(m.status==="METHOD_CANDIDATE_AUDIT_NOT_EXECUTED","METHOD_STATUS_INVALID");
req(m.scan_scope?.model==="WHOLE_REPOSITORY","WHOLE_REPOSITORY_SCOPE_REQUIRED");
req(m.scan_scope?.mcft_mutation_allowed===false,"MCFT_MUTATION_MUST_REMAIN_FORBIDDEN");
req(m.scan_scope?.mcft_audit_discovery_allowed===true,"MCFT_AUDIT_DISCOVERY_REQUIRED");
req(m.scan_scope?.business_behavior_change===false,"BUSINESS_BEHAVIOR_CHANGE_FORBIDDEN");
for(const root of ["apps/server/src","apps/executor/src","apps/telemetry-ingest/src","apps/web/src","scripts",".github/workflows","docker","docs/digital_twin"]){
  req(m.scan_scope.roots.includes(root),`SCAN_ROOT_MISSING:${root}`);
}
const expectedDispositions=["WIRED_AND_PROVEN","INTENTIONALLY_DISCONNECTED","SEMANTICALLY_INCOMPATIBLE","UNWIRED_DEFECT"].sort();
req(JSON.stringify([...m.terminal_dispositions].sort())===JSON.stringify(expectedDispositions),"TERMINAL_DISPOSITION_SET_INVALID");
req(m.unclassified_discovery_is_failure===true&&m.unclassified_failure_code==="UNADJUDICATED_DISCOVERY","UNADJUDICATED_FAIL_CLOSED_REQUIRED");
for(const field of ["expected_execution_owner","expected_execution_roots","static_reachability","runtime_reachability_proof","semantic_compatibility","qualification_production_equivalence","final_disposition"]){
  req(m.required_capability_dimensions.includes(field),`CAPABILITY_DIMENSION_MISSING:${field}`);
}
for(const edge of ["DOCKER_COMMAND","COMPOSE_COMMAND","GITHUB_WORKFLOW_COMMAND","SPAWN","EXEC","FORK","GENERATED_DIST_ENTRY"]){
  req(m.static_reachability_edges.includes(edge),`STATIC_EDGE_CLASS_MISSING:${edge}`);
}
for(const dim of ["measurement_depth","observation_operator_id","logical_time","observed_at","available_at_or_available_to_runtime_at","runtime_config_ref_hash","authority_class"]){
  req(m.semantic_compatibility_dimensions.includes(dim),`SEMANTIC_DIMENSION_MISSING:${dim}`);
}
const mcft=new Map((m.mandatory_mcft_reconciliation||[]).map(x=>[x.id,x]));
for(const id of ["M-01","M-02","M-03","M-04","M-05","M-06","M-07"]){
  req(mcft.has(id),`MANDATORY_MCFT_RECONCILIATION_MISSING:${id}`);
  req(mcft.get(id)?.repair_authorized===false,`MCFT_REPAIR_MUST_REMAIN_UNAUTHORIZED:${id}`);
}
for(const code of ["UNREGISTERED_EXECUTION_ROOT","UNREGISTERED_COMPLETE_CAPABILITY","CAPABILITY_STATUS_AUTHORITY_CONFLICT","EXPECTED_OWNER_MISSING","EXPECTED_ROOT_MISSING","SEMANTIC_EDGE_UNCHECKED","QUALIFICATION_PRODUCTION_EQUIVALENCE_UNCHECKED","RUNTIME_PROOF_REQUIRED_BUT_MISSING"]){
  req(m.fail_closed_codes.includes(code),`FAIL_CLOSED_CODE_MISSING:${code}`);
}
for(const [k,v] of Object.entries(m.non_effects||{})) req(v===false,`NON_EFFECT_MUST_BE_FALSE:${k}`);
for(const x of ["CONTINUE_PR_3617_AUDIT_CLOSURE","INDEPENDENT_REPAIR_BRANCH","DRAFT_REPAIR_PR","GITHUB_HOSTED_ISOLATED_CI","STATIC_GOVERNANCE_ACCEPTANCE","ISOLATED_POSTGRESQL_ACCEPTANCE","CONTRACT_DESIGN_AND_CODE_IMPLEMENTATION"]){
  req((m.execution_safety_boundary?.allowed||[]).includes(x),`SAFETY_ALLOWED_MISSING:${x}`);
}
for(const x of ["MERGE_PR_3617","MERGE_REPAIR_PR","ADVANCE_PROTECTED_MAIN","LOCAL_WORKTREE_SWITCH_RESET_PULL_TO_REPAIR_BRANCH","REBUILD_CURRENT_REHEARSAL_IMAGE","RECREATE_CURRENT_REHEARSAL_PROJECT","MUTATE_REHEARSAL_POSTGRESQL","CLEANUP_REHEARSAL","RESTART_REHEARSAL_UNLESS_SELF_FAILURE","MUTATE_FORMAL_STORE","REARM_FORMAL_STORE"]){
  req((m.execution_safety_boundary?.forbidden||[]).includes(x),`SAFETY_FORBIDDEN_MISSING:${x}`);
}
req(m.execution_safety_boundary?.isolated_ci_must_not_use_rehearsal_resources===true,"ISOLATED_CI_RESOURCE_BOUNDARY_REQUIRED");
req(m.execution_safety_boundary?.isolated_postgresql_must_be_disposable===true,"ISOLATED_POSTGRES_DISPOSABLE_REQUIRED");
for(const token of ["IMPLEMENTED != WIRED != RUNTIME_REACHABLE != EFFECTIVE != OBSERVED != PROVEN","WIRED_AND_PROVEN","INTENTIONALLY_DISCONNECTED","SEMANTICALLY_INCOMPATIBLE","UNWIRED_DEFECT","CAPABILITY_STATUS_AUTHORITY_CONFLICT","M-01","M-02","M-03","M-07","Execution safety boundary","MUTATE_FORMAL_STORE"]){
  req(d.includes(token),`METHOD_DOC_TOKEN_MISSING:${token}`);
}
const result={
  schema_version:"geox_whole_repository_authority_runtime_reachability_method_acceptance_v1",
  status:failures.length?"FAIL":"PASS",
  method_ref:METHOD,
  document_ref:DOC,
  baseline_protected_main:m.baseline_protected_main,
  scan_model:m.scan_scope.model,
  terminal_dispositions:m.terminal_dispositions,
  mandatory_mcft_reconciliation_count:(m.mandatory_mcft_reconciliation||[]).length,
  product_semantic_change:false,
  runtime_repair_authorized:false,
  failures
};
fs.mkdirSync(path.join(ROOT,"acceptance-output"),{recursive:true});
fs.writeFileSync(path.join(ROOT,"acceptance-output/GEOX_WHOLE_REPOSITORY_AUTHORITY_RUNTIME_REACHABILITY_METHOD_V2.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
if(failures.length) process.exit(1);
