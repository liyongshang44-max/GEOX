"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const ROOT=path.resolve(__dirname,"../.."),BASE="648c1499f23c9c5d11483b0b797c8700e398349d";
const DOC="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-START-CHAIN-V2-ENGINEERING.md";
const POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const PRIOR="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs";
const RETIRE="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs";
const BOUNDARY="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_PREQUALIFICATION_BOUNDARY_V1.cjs";
const PATHS=[QCP,PRIOR,RETIRE,BOUNDARY,DOC,
 ".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml",
 "docker-compose.mcft-cap09-production-preformal-am22-v2.yml",
 "scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs",
 ...["ACCEPTANCE_MCFT_CAP_09_AM22_START_CHAIN_ISOLATED_O00_V2.ts","ACCEPTANCE_MCFT_CAP_09_AM22_START_CHAIN_V2.cjs","ASSEMBLE_MCFT_CAP_09_FORMAL_V5_ARM_V2.cjs","MCFT_CAP_09_AM22_EXECUTION_QUALIFICATION_V2.cjs","MCFT_CAP_09_AM22_START_CHAIN_V2.cjs","RUN_MCFT_CAP_09_AM22_CUTOVER_ARM_A0_V2.cjs","RUN_MCFT_CAP_09_AM22_EVIDENCE_OWNER_ENTRY_V2.cjs","RUN_MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V2.cjs"].map(x=>"scripts/runtime_acceptance/"+x)].sort();
const CHECK={check_id:"AM22_START_CHAIN_ENGINEERING_ONLY",owner:"MCFT_CAP09_AM22_START_CHAIN_ENGINEERING",generation_scope:["FORMAL_V5","AM22_START_CHAIN_ENGINEERING_ONLY"],authority_refs:[POLICY,DOC],resolver_ids:["AM22_START_CHAIN_ENGINEERING_ONLY_V2"],historical_evidence_policy:"NO_FORMAL_START_OR_ARM_CARRY_FORWARD",execution_workflow:".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml",execution_workflow_status:"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS",fail_policy:"FAIL_CLOSED_EXACT_ENGINEERING_BOUNDARY_AND_DISABLED_PRODUCTION_REQUIRED",carry_forward_policy:"NONE",requalification_triggers:["AM22_START_CHAIN_ENGINEERING_ONLY_V2"],applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],carry_forward_evidence_id:null,diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs"};
const ROUTE='  if(fs.existsSync(path.join(ROOT,"'+DOC+'"))) return require("./VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs").verifyEngineeringOnly();\n';
const RETIRE_BEFORE='assert.equal(successor.qualification_scope, "AM22_DISABLED_COMPONENT_PREQUALIFICATION_ONLY");';
const RETIRE_AFTER='assert.ok(["AM22_DISABLED_COMPONENT_PREQUALIFICATION_ONLY", "AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY"].includes(successor.qualification_scope));';
const BOUNDARY_BEFORE='const current=JSON.parse(fs.readFileSync(path.join(root,QCP),"utf8"));';
const BOUNDARY_AFTER='// Replay the already-adopted component boundary, separately from the new engineering successor.\nconst cp=require("node:child_process");\nconst current=JSON.parse(cp.execFileSync("git",["show","'+BASE+':"+QCP],{cwd:root,encoding:"utf8"}));';
const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
function validateBoundary(changes,policy,before,after){
 const mutable=[QCP,PRIOR,RETIRE,BOUNDARY];
 for(const x of changes){assert.ok(PATHS.includes(x.rel),"AM22_CHAIN_UNKNOWN_PATH:"+x.rel);assert.equal(x.status,mutable.includes(x.rel)?"M":"A","AM22_CHAIN_DESTRUCTIVE_OR_EXISTING_PATH_CHANGE:"+x.rel);}
 assert.equal(policy.status,"PREQUALIFICATION_ONLY_NOT_EFFECTIVE");
 for(const key of ["production_start_authorized","formal_v5_arm_authorized","a0_authorized","mcft_cap09_completed","complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified"])assert.equal(policy[key],false,"AM22_CHAIN_AUTHORITY_ESCALATION:"+key);
 assert.deepEqual(after.checks.at(-1),CHECK,"AM22_CHAIN_CHECK_CHANGED");
 assert.deepEqual(after.dependency_resolvers.AM22_START_CHAIN_ENGINEERING_ONLY_V2,{kind:"EXACT_PATH_SET",paths:PATHS},"AM22_CHAIN_RESOLVER_CHANGED");
 const normalized=structuredClone(after);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_START_CHAIN_ENGINEERING_ONLY_V2;
 assert.deepEqual(normalized,before,"AM22_CHAIN_PREDECESSOR_QCP_CHANGED");
}
function verifyEngineeringOnly(){
 const transport=verifyFreshAuthorityTransportOnly();if(transport)return transport;
 if(!fs.existsSync(path.join(ROOT,DOC)))return null;
 assert.equal(git("merge-base",BASE,"HEAD"),BASE,"AM22_CHAIN_BASE_NOT_ANCESTOR");
 assert.equal(git("merge-base",BASE,"origin/main"),BASE,"AM22_CHAIN_BASE_NOT_ADOPTED");
 assert.deepEqual(git("status","--porcelain","--untracked-files=normal").split(/\r?\n/).filter(x=>x&&x!=="?? acceptance-output/"),[],"AM22_CHAIN_DIRTY_SOURCE");
 const read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8"),at=rel=>cp.execFileSync("git",["show",BASE+":"+rel],{cwd:ROOT,encoding:"utf8"});
 const changes=git("diff","--name-status",BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 assert.equal(read(POLICY),at(POLICY),"AM22_CHAIN_ROOT_POLICY_OR_TRUST_KEY_CHANGED");
 validateBoundary(changes,JSON.parse(read(POLICY)),JSON.parse(at(QCP)),JSON.parse(read(QCP)));
 assert.equal(read(PRIOR),at(PRIOR).replace('function verifyPrequalificationOnlySuccessor(){','function verifyPrequalificationOnlySuccessor(){\n'+ROUTE.trimEnd()),"AM22_CHAIN_COMPONENT_CHECK_BODY_CHANGED");
 assert.equal(read(RETIRE),at(RETIRE).replace(RETIRE_BEFORE,RETIRE_AFTER),"AM22_CHAIN_RETIREMENT_CHECK_BODY_CHANGED");
 assert.equal(read(BOUNDARY),at(BOUNDARY).replace(BOUNDARY_BEFORE,BOUNDARY_AFTER),"AM22_CHAIN_COMPONENT_BOUNDARY_TEST_CHANGED");
 for(const file of ["ACCEPTANCE_MCFT_CAP_09_AM22_START_CHAIN_V2.cjs","ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"])cp.execFileSync(process.execPath,[path.join(ROOT,"scripts/runtime_acceptance",file)],{cwd:ROOT,stdio:"pipe"});
 const historical=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true);
 return {status:"PASS",baseline:BASE,changedPaths:[...new Set([...historical.changedPaths,...require("./VERIFY_MCFT_CAP_09_ARM_RETIREMENT_ONLY_SUCCESSOR_V1.cjs").PATHS,...require("./VERIFY_MCFT_CAP_09_AM22_PREQUALIFICATION_ONLY_SUCCESSOR_V1.cjs").PATHS,...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",old_arm_carry_forward_authorized:false,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,mcft_cap09_completed:false};
}
// BEGIN FRESH_AUTHORITY_TRANSPORT_ONLY
const TRANSPORT_BASE="e9198c90bcb61fc7fd4a6131348233bc1a365388";
const TRANSPORT_WORKFLOW=".github/workflows/mcft-cap-09-t4r1-rolling-current-crop-candidate-v1.yml";
const TRANSPORT_SELF="scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs";
const TRANSPORT_TEST="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_START_CHAIN_V2.cjs";
const TRANSPORT_PATHS=[TRANSPORT_WORKFLOW,TRANSPORT_SELF,TRANSPORT_TEST].sort();
const TRANSPORT_BEFORE=`        shell: bash
        run: |
          set -euo pipefail
          git fetch --no-tags origin main
          current_main="$(git rev-parse origin/main)"
          subject="$(git rev-parse HEAD)"`;
const TRANSPORT_AFTER=`        shell: bash
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          set -euo pipefail
          current_main="$(gh api "repos/\${GITHUB_REPOSITORY}/git/ref/heads/main" --jq '.object.sha')"
          checkout_main="$(git rev-parse origin/main)"
          if [ "$checkout_main" != "$current_main" ]; then
            echo "T4R1_ROLLING_CHECKOUT_MAIN_STALE:\${checkout_main}:\${current_main}" >&2
            exit 1
          fi
          subject="$(git rev-parse HEAD)"`;
function validateTransportBoundary(changes,before,after){
 for(const x of changes){assert.ok(TRANSPORT_PATHS.includes(x.rel),"AM22_TRANSPORT_UNKNOWN_PATH:"+x.rel);assert.equal(x.status,"M","AM22_TRANSPORT_EXISTING_PATH_ONLY");}
 assert.equal(before.split(TRANSPORT_BEFORE).length,2,"AM22_TRANSPORT_EXACT_PREDECESSOR_BLOCK_REQUIRED");
 assert.equal(after,before.replace(TRANSPORT_BEFORE,TRANSPORT_AFTER),"AM22_TRANSPORT_ONLY_AUTHENTICATED_MAIN_READ_ALLOWED");
}
function verifyFreshAuthorityTransportOnly(){
 if(cp.spawnSync("git",["merge-base","--is-ancestor",TRANSPORT_BASE,"HEAD"],{cwd:ROOT}).status!==0)return null;
 const at=rel=>cp.execFileSync("git",["show",TRANSPORT_BASE+":"+rel],{cwd:ROOT,encoding:"utf8"});
 const read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
 if(read(TRANSPORT_WORKFLOW)===at(TRANSPORT_WORKFLOW))return null;
 assert.equal(git("merge-base",TRANSPORT_BASE,"origin/main"),TRANSPORT_BASE,"AM22_TRANSPORT_BASE_NOT_ADOPTED");
 assert.equal(git("status","--porcelain","--untracked-files=normal"),"","AM22_TRANSPORT_DIRTY_SOURCE");
 const changes=git("diff","--name-status",TRANSPORT_BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 validateTransportBoundary(changes,at(TRANSPORT_WORKFLOW),read(TRANSPORT_WORKFLOW));
 assert.equal(read(POLICY),at(POLICY),"AM22_TRANSPORT_PRODUCTION_POLICY_CHANGED");
 assert.equal(read(QCP),at(QCP),"AM22_TRANSPORT_QCP_CHANGED");
 const route=' const transport=verifyFreshAuthorityTransportOnly();if(transport)return transport;\n';
 const exported=',TRANSPORT_BASE,TRANSPORT_WORKFLOW,TRANSPORT_PATHS,TRANSPORT_BEFORE,TRANSPORT_AFTER,validateTransportBoundary,verifyFreshAuthorityTransportOnly';
 const normalized=read(TRANSPORT_SELF).replace(route,"").replace(/\/\/ BEGIN FRESH_AUTHORITY_TRANSPORT_ONLY[\s\S]*?\/\/ END FRESH_AUTHORITY_TRANSPORT_ONLY\n/,"").replace(exported,"");
 assert.equal(normalized,at(TRANSPORT_SELF),"AM22_TRANSPORT_PREDECESSOR_CHECKER_CHANGED");
 assert.ok(read(TRANSPORT_TEST).startsWith(at(TRANSPORT_TEST)),"AM22_TRANSPORT_PREDECESSOR_NEGATIVES_CHANGED");
 for(const file of [TRANSPORT_TEST,"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"])cp.execFileSync(process.execPath,[path.join(ROOT,file)],{cwd:ROOT,stdio:"pipe"});
 const historical=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true);
 const adopted=git("diff","--name-only","a60aa6858662ce87b989ff752c50969f21ad4619",TRANSPORT_BASE).split(/\r?\n/).filter(Boolean);
 return {status:"PASS",baseline:TRANSPORT_BASE,changedPaths:[...new Set([...historical.changedPaths,...adopted,...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"FRESH_AUTHORITY_AUTHENTICATED_MAIN_READ_ONLY",fresh_authority_generated:false,old_arm_carry_forward_authorized:false,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,mcft_cap09_completed:false};
}
// END FRESH_AUTHORITY_TRANSPORT_ONLY
module.exports={BASE,DOC,POLICY,QCP,PRIOR,RETIRE,BOUNDARY,PATHS,CHECK,ROUTE,RETIRE_BEFORE,RETIRE_AFTER,BOUNDARY_BEFORE,BOUNDARY_AFTER,validateBoundary,verifyEngineeringOnly,TRANSPORT_BASE,TRANSPORT_WORKFLOW,TRANSPORT_PATHS,TRANSPORT_BEFORE,TRANSPORT_AFTER,validateTransportBoundary,verifyFreshAuthorityTransportOnly};
if(require.main===module)console.log(JSON.stringify(verifyEngineeringOnly(),null,2));
