"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {validateBoundary,PATHS,CHECKERS,QCP,POLICY,CHAIN}=require("../governance_acceptance/VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs");
const root=path.resolve(__dirname,"../..");
const current=JSON.parse(fs.readFileSync(path.join(root,QCP),"utf8"));
const prior=structuredClone(current);prior.checks.pop();delete prior.dependency_resolvers.AM22_PREQUALIFICATION_ONLY_V1;
const policy=JSON.parse(fs.readFileSync(path.join(root,POLICY),"utf8"));
const changes=PATHS.map(rel=>({rel,status:rel===QCP||rel===CHAIN||CHECKERS.includes(rel)?"M":"A"}));
let cases=0;
function test(change,pattern){const input=structuredClone({changes,policy,before:prior,after:current});change(input);assert.throws(()=>validateBoundary(input.changes,input.policy,input.before,input.after),pattern);cases++;}
validateBoundary(changes,policy,prior,current);cases++;
test(x=>x.changes.push({status:"A",rel:"unknown/provider.ts"}),/UNKNOWN_OR_DESTRUCTIVE_PATH/);
test(x=>x.changes.push({status:"M",rel:"scripts/runtime_acceptance/RUN_MCFT_CAP_09_FORMAL_V5_A0_BOOTSTRAP_V1.ts"}),/UNKNOWN_OR_DESTRUCTIVE_PATH/);
test(x=>x.changes[0].status="D",/UNKNOWN_OR_DESTRUCTIVE_PATH/);
test(x=>x.changes.find(x=>x.status==="A").status="M",/EXISTING_SURFACE_CHANGED/);
test(x=>x.policy.status="EFFECTIVE_ON_PROTECTED_MAIN",/PRODUCTION_POLICY_FORBIDDEN/);
for(const key of ["complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified","production_start_authorized","formal_v5_arm_authorized","a0_authorized","mcft_cap09_completed"])test(x=>x.policy[key]=true,/AUTHORITY_ESCALATION/);
test(x=>x.policy.extra_authorization=true,/POLICY_FIELD_DRIFT/);
test(x=>x.after.checks[0].owner="changed",/EXISTING_QCP_CHANGED/);
test(x=>x.after.dependency_resolvers.AM22_PREQUALIFICATION_ONLY_V1.paths.push("unknown/provider.ts"),/RESOLVER_DRIFT/);
test(x=>x.after.checks.at(-1).carry_forward_policy="ALL",/CHECK_DRIFT/);
// Replay is explicit and cannot silently replace current-main admission.
const {verifyFormalV5AuthorityContinuity}=require("../governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs");
assert.throws(()=>verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619"),/FORMAL_V5_AUTHORITY_BASE_NOT_CURRENT_MAIN_ANCESTOR/);cases++;
assert.ok(verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true));cases++;
console.log(JSON.stringify({status:"PASS",cases,qualification_scope:"PREQUALIFICATION_BOUNDARY_NEGATIVES_ONLY",production_start_authorized:false,database_write_count:0,service_stop_count:0}));
