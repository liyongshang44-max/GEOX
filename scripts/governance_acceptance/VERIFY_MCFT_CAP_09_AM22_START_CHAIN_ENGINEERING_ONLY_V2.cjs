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
 const bootstrap=verifyGfsBootstrapOnly();if(bootstrap)return bootstrap;
 const measurement=verifyHostMeasurementOnly();if(measurement)return measurement;
 const keyCandidate=verifyExecutionKeyAdoptionOnly();if(keyCandidate)return keyCandidate;
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
// BEGIN EXECUTION_KEY_ADOPTION_ONLY
const KEY_BASE="0bc5e350bdf2b095c63c2021c05ca3d95a26f105";
const KEY_PEM="-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAdYYE2KRxxslK7wD7ZoRcv3bA4QE/r79jzNdBJWbSAzQ=\n-----END PUBLIC KEY-----\n";
const KEY_DIGEST="sha256:8b2e4dfb37d11d9e4a6f21e1ed215c4ab2e81420c10e60e39eb200e6abbe1c49";
const KEY_PATHS=[POLICY,TRANSPORT_SELF,TRANSPORT_TEST,BOUNDARY].sort();
const KEY_BOUNDARY_BEFORE='const policy=JSON.parse(fs.readFileSync(path.join(root,POLICY),"utf8"));';
const KEY_BOUNDARY_AFTER='const policy=JSON.parse(cp.execFileSync("git",["show","'+BASE+':"+POLICY],{cwd:root,encoding:"utf8"}));';
function validateKeyBoundary(changes,before,after){
 assert.deepEqual(changes.map(x=>x.rel).sort(),KEY_PATHS,"AM22_KEY_EXACT_PATH_SET_REQUIRED");
 for(const x of changes)assert.equal(x.status,"M","AM22_KEY_EXISTING_PATH_ONLY");
 assert.deepEqual(after,{...before,execution_qualification_rule:"DETACHED_ED25519_EXACT_MAIN_HOST_IMAGE_EVIDENCE_V2",execution_qualification_signing_public_key_pem:KEY_PEM},"AM22_KEY_TRUST_FIELDS_ONLY");
 assert.equal(before.status,"PREQUALIFICATION_ONLY_NOT_EFFECTIVE");
 for(const k of ["complete_pre_a0_measurement_qualified","new_handoff_arm_a0_chain_qualified","isolated_postgres_v2_a0_o00_qualified","production_start_authorized","formal_v5_arm_authorized","a0_authorized","mcft_cap09_completed"])assert.equal(after[k],false,"AM22_KEY_AUTHORITY_ESCALATION:"+k);
 const crypto=require("node:crypto"),key=crypto.createPublicKey(after.execution_qualification_signing_public_key_pem);
 assert.equal(key.asymmetricKeyType,"ed25519");
 assert.equal("sha256:"+crypto.createHash("sha256").update(key.export({type:"spki",format:"der"})).digest("hex"),KEY_DIGEST,"AM22_KEY_PUBLIC_FINGERPRINT_MISMATCH");
}
function verifyExecutionKeyAdoptionOnly(){
 if(cp.spawnSync("git",["merge-base","--is-ancestor",KEY_BASE,"HEAD"],{cwd:ROOT}).status!==0)return null;
 const at=rel=>cp.execFileSync("git",["show",KEY_BASE+":"+rel],{cwd:ROOT,encoding:"utf8"});
 const read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
 if(read(POLICY)===at(POLICY))return null;
 assert.equal(git("merge-base",KEY_BASE,"origin/main"),KEY_BASE,"AM22_KEY_BASE_NOT_ADOPTED");
 assert.equal(git("status","--porcelain","--untracked-files=normal"),"","AM22_KEY_DIRTY_SOURCE");
 const changes=git("diff","--name-status",KEY_BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 validateKeyBoundary(changes,JSON.parse(at(POLICY)),JSON.parse(read(POLICY)));
 assert.equal(read(QCP),at(QCP),"AM22_KEY_QCP_CHANGED");
 const route=' const keyCandidate=verifyExecutionKeyAdoptionOnly();if(keyCandidate)return keyCandidate;\n';
 const exported=',KEY_BASE,KEY_PEM,KEY_DIGEST,KEY_PATHS,KEY_BOUNDARY_BEFORE,KEY_BOUNDARY_AFTER,validateKeyBoundary,verifyExecutionKeyAdoptionOnly';
 const normalized=read(TRANSPORT_SELF).replace(route,"").replace(/\/\/ BEGIN EXECUTION_KEY_ADOPTION_ONLY[\s\S]*?\/\/ END EXECUTION_KEY_ADOPTION_ONLY\n/,"").replace(exported,"");
 assert.equal(normalized,at(TRANSPORT_SELF),"AM22_KEY_PREDECESSOR_CHECKER_CHANGED");
 assert.equal(read(BOUNDARY),at(BOUNDARY).replace(KEY_BOUNDARY_BEFORE,KEY_BOUNDARY_AFTER),"AM22_KEY_COMPONENT_NEGATIVES_CHANGED");
 assert.ok(read(TRANSPORT_TEST).startsWith(at(TRANSPORT_TEST)),"AM22_KEY_ENGINEERING_NEGATIVES_CHANGED");
 for(const file of [TRANSPORT_TEST,BOUNDARY,"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_FORMAL_ARM_RETIREMENT_V1.cjs"])cp.execFileSync(process.execPath,[path.join(ROOT,file)],{cwd:ROOT,stdio:"pipe"});
 const historical=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true);
 const adopted=git("diff","--name-only","a60aa6858662ce87b989ff752c50969f21ad4619",KEY_BASE).split(/\r?\n/).filter(Boolean);
 return {status:"PASS",baseline:KEY_BASE,changedPaths:[...new Set([...historical.changedPaths,...adopted,...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"EXECUTION_TRUST_KEY_ADOPTION_ONLY",key_adoption_candidate_qualified:true,public_key_sha256:KEY_DIGEST,complete_host_measurement_proven:false,fresh_authority_generated:false,old_arm_carry_forward_authorized:false,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,mcft_cap09_completed:false};
}
// END EXECUTION_KEY_ADOPTION_ONLY
// BEGIN HOST_MEASUREMENT_ONLY
const MEASUREMENT_BASE="3609bbee463ddc639c10a9993c904175d89892b9";
const MEASUREMENT_DOC="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-SIX-PHASE-HOST-MEASUREMENT-V2.md";
const MEASUREMENT_WORKFLOW=".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml";
const MEASUREMENT_ISOLATED="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_START_CHAIN_ISOLATED_O00_V2.ts";
const MEASUREMENT_NEW=[MEASUREMENT_DOC,...["MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs","RUN_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.ts","MCFT_CAP_09_AM22_PREWRITE_PROBE_V2.ts","ACCEPTANCE_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs"].map(x=>"scripts/runtime_acceptance/"+x)];
const MEASUREMENT_PATHS=[...MEASUREMENT_NEW,TRANSPORT_SELF,QCP,TRANSPORT_TEST,MEASUREMENT_WORKFLOW,MEASUREMENT_ISOLATED].sort();
const MEASUREMENT_CHECK={...CHECK,check_id:"AM22_HOST_MEASUREMENT_ONLY",owner:"MCFT_CAP09_AM22_HOST_MEASUREMENT",generation_scope:["FORMAL_V5","AM22_HOST_MEASUREMENT_ONLY"],authority_refs:[POLICY,MEASUREMENT_DOC],resolver_ids:["AM22_HOST_MEASUREMENT_ONLY_V2"],fail_policy:"FAIL_CLOSED_MEASUREMENT_SCOPE_AND_DISABLED_PRODUCTION_REQUIRED",requalification_triggers:["AM22_HOST_MEASUREMENT_ONLY_V2"]};
const MEASUREMENT_QCP_BEFORE='const after=JSON.parse(fs.readFileSync(path.join(__dirname,"../../",gov.QCP),"utf8"));';
const MEASUREMENT_QCP_AFTER='const after=JSON.parse(cp.execFileSync("git",["show","'+MEASUREMENT_BASE+':"+gov.QCP],{cwd:path.resolve(__dirname,"../.."),encoding:"utf8"}));';
const MEASUREMENT_PROBE_IMPORT='import {probePrewrite} from "./MCFT_CAP_09_AM22_PREWRITE_PROBE_V2.js";\n';
const MEASUREMENT_PROBE_CALL='    const prewrite=await probePrewrite(pool,built.bundle.persistence_bundle,new MemoryEvidenceSource(a0Evidence),A0);\n    assert.equal(prewrite.bootstrap_commit_called,false);\n    assert.equal(prewrite.isolated_lease_released,true);\n    assert.equal(prewrite.a0_execution,false);\n';
const MEASUREMENT_WORKFLOW_PATHS="      - 'scripts/runtime_acceptance/*HOST_MEASUREMENT_V2*'\n      - 'scripts/runtime_acceptance/*PREWRITE_PROBE_V2*'\n";
const MEASUREMENT_WORKFLOW_STEP='      - name: Host measurement negatives and prewrite entry typecheck\n        run: |\n          node scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs\n          pnpm exec tsc --noEmit --module ESNext --moduleResolution Bundler --target ES2022 --esModuleInterop --skipLibCheck scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.ts scripts/runtime_acceptance/MCFT_CAP_09_AM22_PREWRITE_PROBE_V2.ts\n';
function validateMeasurementBoundary(changes,before,after,policy,baselinePolicy){
 assert.deepEqual(changes.map(x=>x.rel).sort(),MEASUREMENT_PATHS,"AM22_MEASUREMENT_EXACT_PATHS_REQUIRED");
 for(const x of changes)assert.equal(x.status,MEASUREMENT_NEW.includes(x.rel)?"A":"M","AM22_MEASUREMENT_DESTRUCTIVE_OR_EXISTING_CHANGE");
 assert.deepEqual(policy,baselinePolicy,"AM22_MEASUREMENT_PRODUCTION_POLICY_CHANGED");
 const measurementView=structuredClone(after);
 if(measurementView.checks.length===before.checks.length+2&&measurementView.checks.at(-1)?.check_id==="AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY"){
  assert.deepEqual(measurementView.checks.at(-1),BOOTSTRAP_CHECK,"AM22_MEASUREMENT_LATER_BOOTSTRAP_CHECK_CHANGED");
  assert.deepEqual(measurementView.dependency_resolvers.AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1,{kind:"EXACT_PATH_SET",paths:BOOTSTRAP_PATHS},"AM22_MEASUREMENT_LATER_BOOTSTRAP_RESOLVER_CHANGED");
  measurementView.checks.pop();delete measurementView.dependency_resolvers.AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1;
 }
 assert.equal(measurementView.checks.length,before.checks.length+1);assert.deepEqual(measurementView.checks.at(-1),MEASUREMENT_CHECK);
 assert.deepEqual(measurementView.dependency_resolvers.AM22_HOST_MEASUREMENT_ONLY_V2,{kind:"EXACT_PATH_SET",paths:MEASUREMENT_PATHS});
 const normalized=structuredClone(measurementView);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_HOST_MEASUREMENT_ONLY_V2;assert.deepEqual(normalized,before,"AM22_MEASUREMENT_PREDECESSOR_QCP_CHANGED");
}
function verifyHostMeasurementOnly(){
 if(!fs.existsSync(path.join(ROOT,MEASUREMENT_DOC)))return null;
 assert.equal(git("merge-base",MEASUREMENT_BASE,"HEAD"),MEASUREMENT_BASE);assert.equal(git("merge-base",MEASUREMENT_BASE,"origin/main"),MEASUREMENT_BASE);
 assert.deepEqual(git("status","--porcelain","--untracked-files=normal").split(/\r?\n/).filter(x=>x&&x!=="?? acceptance-output/"),[],"AM22_MEASUREMENT_DIRTY_SOURCE");
 const at=rel=>cp.execFileSync("git",["show",MEASUREMENT_BASE+":"+rel],{cwd:ROOT,encoding:"utf8"}),read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
 const changes=git("diff","--name-status",MEASUREMENT_BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 validateMeasurementBoundary(changes,JSON.parse(at(QCP)),JSON.parse(read(QCP)),JSON.parse(read(POLICY)),JSON.parse(at(POLICY)));
 assert.equal(read(POLICY),at(POLICY));
 const route=' const measurement=verifyHostMeasurementOnly();if(measurement)return measurement;\n';
 const exported=',MEASUREMENT_BASE,MEASUREMENT_DOC,MEASUREMENT_PATHS,MEASUREMENT_NEW,MEASUREMENT_CHECK,validateMeasurementBoundary,verifyHostMeasurementOnly';
 assert.equal(read(TRANSPORT_SELF).replace(route,"").replace(/\/\/ BEGIN HOST_MEASUREMENT_ONLY[\s\S]*?\/\/ END HOST_MEASUREMENT_ONLY\n/,"").replace(exported,""),at(TRANSPORT_SELF),"AM22_MEASUREMENT_PREDECESSOR_CHECKER_CHANGED");
 assert.equal(read(MEASUREMENT_ISOLATED).replace(MEASUREMENT_PROBE_IMPORT,"").replace(MEASUREMENT_PROBE_CALL,""),at(MEASUREMENT_ISOLATED),"AM22_MEASUREMENT_ORIGINAL_PG_REGRESSION_CHANGED");
 assert.equal(read(MEASUREMENT_WORKFLOW).replace(MEASUREMENT_WORKFLOW_PATHS,"").replace(MEASUREMENT_WORKFLOW_STEP,""),at(MEASUREMENT_WORKFLOW),"AM22_MEASUREMENT_WORKFLOW_SCOPE_CHANGED");
 assert.equal(read(TRANSPORT_TEST).replace(MEASUREMENT_QCP_AFTER,MEASUREMENT_QCP_BEFORE),at(TRANSPORT_TEST),"AM22_MEASUREMENT_ORIGINAL_NEGATIVES_CHANGED");
 for(const file of [TRANSPORT_TEST,"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_HOST_MEASUREMENT_V2.cjs"])cp.execFileSync(process.execPath,[path.join(ROOT,file)],{cwd:ROOT,stdio:"pipe"});
 const historical=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true);
 const adopted=git("diff","--name-only","a60aa6858662ce87b989ff752c50969f21ad4619",MEASUREMENT_BASE).split(/\r?\n/).filter(Boolean);
 return {status:"PASS",baseline:MEASUREMENT_BASE,changedPaths:[...new Set([...historical.changedPaths,...adopted,...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"SIX_PHASE_HOST_MEASUREMENT_ONLY",actual_host_measurement_completed:false,complete_production_pre_a0_qualified:false,fresh_authority_generated:false,old_arm_carry_forward_authorized:false,production_runtime_start_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,mcft_cap09_completed:false};
}
// END HOST_MEASUREMENT_ONLY
// BEGIN GFS_BOOTSTRAP_ORCHESTRATION_ONLY
const BOOTSTRAP_BASE="84afa1f2fd14618860780275809a6a473761beca";
const BOOTSTRAP_DOC="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-GFS-BOOTSTRAP-CUTOVER-V1.md";
const BOOTSTRAP_OWNER_POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json";
const BOOTSTRAP_A0_POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const BOOTSTRAP_COMBINED_A0_POLICY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json";
const BOOTSTRAP_WORKFLOW=".github/workflows/mcft-cap-09-am22-start-chain-v2-engineering.yml";
const BOOTSTRAP_PACKAGING="apps/server/scripts/write_dist_entries.cjs";
const BOOTSTRAP_WRAPPER="apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.ts";
const BOOTSTRAP_OVERLAY="docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml";
const BOOTSTRAP_HELPER="scripts/runtime_acceptance/MCFT_CAP_09_AM22_GFS_BOOTSTRAP_V1.cjs";
const BOOTSTRAP_RUNNER="scripts/runtime_acceptance/RUN_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs";
const BOOTSTRAP_ACCEPTANCE="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs";
const BOOTSTRAP_NEW=[BOOTSTRAP_DOC,BOOTSTRAP_COMBINED_A0_POLICY,BOOTSTRAP_WRAPPER,BOOTSTRAP_OVERLAY,BOOTSTRAP_HELPER,BOOTSTRAP_RUNNER,BOOTSTRAP_ACCEPTANCE].sort();
const BOOTSTRAP_PATHS=[BOOTSTRAP_WORKFLOW,...BOOTSTRAP_NEW,QCP,TRANSPORT_SELF].sort();
const BOOTSTRAP_CHECK={
 check_id:"AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY",
 owner:"MCFT_CAP09_AM22_GFS_BOOTSTRAP",
 generation_scope:["FORMAL_V5","AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY"],
 authority_refs:[BOOTSTRAP_OWNER_POLICY,BOOTSTRAP_A0_POLICY,BOOTSTRAP_DOC,BOOTSTRAP_COMBINED_A0_POLICY],
 resolver_ids:["AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1"],
 historical_evidence_policy:"NO_36H_HANDOFF_OR_FORMAL_EFFECT_CARRY_FORWARD",
 execution_workflow:BOOTSTRAP_WORKFLOW,
 execution_workflow_status:"QUALIFICATION_ONLY_NO_PRODUCTION_CREDENTIALS",
 fail_policy:"FAIL_CLOSED_EXACT_PATH_AND_EXISTING_AUTHORITY_REUSE_REQUIRED",
 carry_forward_policy:"NONE",
 requalification_triggers:["AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1"],
 applicable_stages:["SUCCESSOR_SUBJECT_PRE_MERGE","POST_MERGE_V13_QUALIFICATION"],
 carry_forward_evidence_id:null,
 diagnostic_command:"node scripts/governance_acceptance/VERIFY_MCFT_CAP_09_AM22_START_CHAIN_ENGINEERING_ONLY_V2.cjs"
};
const BOOTSTRAP_ROUTE=' const bootstrap=verifyGfsBootstrapOnly();if(bootstrap)return bootstrap;\n';
const BOOTSTRAP_WORKFLOW_PATHS="      - 'scripts/runtime_acceptance/*AM22_GFS_BOOTSTRAP*'\n      - 'apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.ts'\n      - 'docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml'\n      - 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-GFS-BOOTSTRAP-CUTOVER-V1.md'\n      - 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json'\n";
const BOOTSTRAP_WORKFLOW_STEP="      - name: AM22 short-A0 GFS bootstrap orchestration boundary\n        run: |\n          node scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_AM22_GFS_BOOTSTRAP_CUTOVER_V1.cjs\n          pnpm exec tsc --noEmit --module ESNext --moduleResolution Bundler --target ES2022 --esModuleInterop --skipLibCheck apps/server/src/runtime/mcft_cap09_am22_gfs_bootstrap_evidence_owner_v1.ts\n";
const BOOTSTRAP_MEASUREMENT_BASELINE="function validateMeasurementBoundary(changes,before,after,policy,baselinePolicy){\n assert.deepEqual(changes.map(x=>x.rel).sort(),MEASUREMENT_PATHS,\"AM22_MEASUREMENT_EXACT_PATHS_REQUIRED\");\n for(const x of changes)assert.equal(x.status,MEASUREMENT_NEW.includes(x.rel)?\"A\":\"M\",\"AM22_MEASUREMENT_DESTRUCTIVE_OR_EXISTING_CHANGE\");\n assert.deepEqual(policy,baselinePolicy,\"AM22_MEASUREMENT_PRODUCTION_POLICY_CHANGED\");\n assert.equal(after.checks.length,before.checks.length+1);assert.deepEqual(after.checks.at(-1),MEASUREMENT_CHECK);\n assert.deepEqual(after.dependency_resolvers.AM22_HOST_MEASUREMENT_ONLY_V2,{kind:\"EXACT_PATH_SET\",paths:MEASUREMENT_PATHS});\n const normalized=structuredClone(after);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_HOST_MEASUREMENT_ONLY_V2;assert.deepEqual(normalized,before,\"AM22_MEASUREMENT_PREDECESSOR_QCP_CHANGED\");\n}\n";
const BOOTSTRAP_MEASUREMENT_AWARE="function validateMeasurementBoundary(changes,before,after,policy,baselinePolicy){\n assert.deepEqual(changes.map(x=>x.rel).sort(),MEASUREMENT_PATHS,\"AM22_MEASUREMENT_EXACT_PATHS_REQUIRED\");\n for(const x of changes)assert.equal(x.status,MEASUREMENT_NEW.includes(x.rel)?\"A\":\"M\",\"AM22_MEASUREMENT_DESTRUCTIVE_OR_EXISTING_CHANGE\");\n assert.deepEqual(policy,baselinePolicy,\"AM22_MEASUREMENT_PRODUCTION_POLICY_CHANGED\");\n const measurementView=structuredClone(after);\n if(measurementView.checks.length===before.checks.length+2&&measurementView.checks.at(-1)?.check_id===\"AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY\"){\n  assert.deepEqual(measurementView.checks.at(-1),BOOTSTRAP_CHECK,\"AM22_MEASUREMENT_LATER_BOOTSTRAP_CHECK_CHANGED\");\n  assert.deepEqual(measurementView.dependency_resolvers.AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1,{kind:\"EXACT_PATH_SET\",paths:BOOTSTRAP_PATHS},\"AM22_MEASUREMENT_LATER_BOOTSTRAP_RESOLVER_CHANGED\");\n  measurementView.checks.pop();delete measurementView.dependency_resolvers.AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1;\n }\n assert.equal(measurementView.checks.length,before.checks.length+1);assert.deepEqual(measurementView.checks.at(-1),MEASUREMENT_CHECK);\n assert.deepEqual(measurementView.dependency_resolvers.AM22_HOST_MEASUREMENT_ONLY_V2,{kind:\"EXACT_PATH_SET\",paths:MEASUREMENT_PATHS});\n const normalized=structuredClone(measurementView);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_HOST_MEASUREMENT_ONLY_V2;assert.deepEqual(normalized,before,\"AM22_MEASUREMENT_PREDECESSOR_QCP_CHANGED\");\n}\n";
function validateBootstrapBoundary(changes,before,after){
 assert.deepEqual(changes.map(x=>x.rel).sort(),BOOTSTRAP_PATHS,"AM22_GFS_BOOTSTRAP_EXACT_PATHS_REQUIRED");
 for(const x of changes)assert.equal(x.status,BOOTSTRAP_NEW.includes(x.rel)?"A":"M","AM22_GFS_BOOTSTRAP_DESTRUCTIVE_OR_EXISTING_PATH_CHANGE:"+x.rel);
 assert.equal(after.checks.length,before.checks.length+1,"AM22_GFS_BOOTSTRAP_SINGLE_QCP_CHECK_REQUIRED");
 assert.deepEqual(after.checks.at(-1),BOOTSTRAP_CHECK,"AM22_GFS_BOOTSTRAP_QCP_CHECK_CHANGED");
 assert.deepEqual(after.dependency_resolvers.AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1,{kind:"EXACT_PATH_SET",paths:BOOTSTRAP_PATHS},"AM22_GFS_BOOTSTRAP_RESOLVER_CHANGED");
 const normalized=structuredClone(after);normalized.checks.pop();delete normalized.dependency_resolvers.AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY_V1;
 assert.deepEqual(normalized,before,"AM22_GFS_BOOTSTRAP_PREDECESSOR_QCP_CHANGED");
}
function verifyGfsBootstrapOnly(){
 if(!fs.existsSync(path.join(ROOT,BOOTSTRAP_DOC)))return null;
 assert.equal(git("merge-base",BOOTSTRAP_BASE,"HEAD"),BOOTSTRAP_BASE,"AM22_GFS_BOOTSTRAP_BASE_NOT_ANCESTOR");
 assert.equal(git("merge-base",BOOTSTRAP_BASE,"origin/main"),BOOTSTRAP_BASE,"AM22_GFS_BOOTSTRAP_BASE_NOT_ADOPTED");
 assert.deepEqual(git("status","--porcelain","--untracked-files=normal").split(/\r?\n/).filter(x=>x&&x!=="?? acceptance-output/"),[],"AM22_GFS_BOOTSTRAP_DIRTY_SOURCE");
 const at=rel=>cp.execFileSync("git",["show",BOOTSTRAP_BASE+":"+rel],{cwd:ROOT,encoding:"utf8"}),read=rel=>fs.readFileSync(path.join(ROOT,rel),"utf8");
 const changes=git("diff","--name-status",BOOTSTRAP_BASE,"HEAD").split(/\r?\n/).filter(Boolean).map(x=>{const [status,rel]=x.split("\t");return {status,rel};});
 validateBootstrapBoundary(changes,JSON.parse(at(QCP)),JSON.parse(read(QCP)));
 for(const authority of [POLICY,BOOTSTRAP_OWNER_POLICY,BOOTSTRAP_A0_POLICY])assert.equal(read(authority),at(authority),"AM22_GFS_BOOTSTRAP_EXISTING_AUTHORITY_CHANGED:"+authority);
 const combined=JSON.parse(read(BOOTSTRAP_COMBINED_A0_POLICY));
 assert.equal(combined.status,"AUTHORIZED_FOR_AM22_BOOTSTRAP_EVIDENCE_AND_MEASUREMENT_PLANNING_ONLY","AM22_GFS_BOOTSTRAP_COMBINED_A0_POLICY_STATUS_REQUIRED");
 assert.equal(combined.authority_basis?.pre_formal_a0_planning_authority_ref,BOOTSTRAP_A0_POLICY,"AM22_GFS_BOOTSTRAP_BASE_A0_POLICY_REF_REQUIRED");
 assert.equal(combined.selection_policy?.selected_acquisition_budget_ms,2081804,"AM22_GFS_BOOTSTRAP_ACQUISITION_BUDGET_REQUIRED");
 assert.equal(combined.selection_policy?.required_six_phase_measurement_lead_ms,600000,"AM22_GFS_BOOTSTRAP_MEASUREMENT_LEAD_REQUIRED");
 assert.equal(combined.selection_policy?.required_authority_materialization_to_owner_start_margin_ms,120000,"AM22_GFS_BOOTSTRAP_MATERIALIZATION_MARGIN_REQUIRED");
 assert.equal(combined.selection_policy?.combined_minimum_lead_ms,2801804,"AM22_GFS_BOOTSTRAP_COMBINED_LEAD_REQUIRED");
 assert.equal(combined.authority_ceiling?.production_owner_cutover_authorized_by_this_authority,false);
 assert.equal(combined.authority_ceiling?.formal_v5_arm_authorized,false);assert.equal(combined.authority_ceiling?.a0_execution_authorized,false);assert.equal(combined.authority_ceiling?.o00_execution_authorized,false);

 assert.equal(read(BOOTSTRAP_PACKAGING),at(BOOTSTRAP_PACKAGING),"AM22_GFS_BOOTSTRAP_SHARED_PACKAGING_CHANGED");
 const workflow=read(BOOTSTRAP_WORKFLOW);
 assert.equal(workflow.split(BOOTSTRAP_WORKFLOW_PATHS).length,2,"AM22_GFS_BOOTSTRAP_WORKFLOW_PATHS_EXACT_INSERT_REQUIRED");
 assert.equal(workflow.split(BOOTSTRAP_WORKFLOW_STEP).length,2,"AM22_GFS_BOOTSTRAP_WORKFLOW_STEP_EXACT_INSERT_REQUIRED");
 assert.equal(workflow.replace(BOOTSTRAP_WORKFLOW_PATHS,"").replace(BOOTSTRAP_WORKFLOW_STEP,""),at(BOOTSTRAP_WORKFLOW),"AM22_GFS_BOOTSTRAP_WORKFLOW_OTHER_CHANGE");

 const normalizedSelf=read(TRANSPORT_SELF).replace(BOOTSTRAP_MEASUREMENT_AWARE,BOOTSTRAP_MEASUREMENT_BASELINE).replace(BOOTSTRAP_ROUTE,"").replace(/\/\/ BEGIN GFS_BOOTSTRAP_ORCHESTRATION_ONLY[\s\S]*?\/\/ END GFS_BOOTSTRAP_ORCHESTRATION_ONLY\n/,"").replace(",BOOTSTRAP_BASE,BOOTSTRAP_DOC,BOOTSTRAP_OWNER_POLICY,BOOTSTRAP_A0_POLICY,BOOTSTRAP_COMBINED_A0_POLICY,BOOTSTRAP_PATHS,BOOTSTRAP_NEW,BOOTSTRAP_CHECK,validateBootstrapBoundary,verifyGfsBootstrapOnly","");
 assert.equal(normalizedSelf,at(TRANSPORT_SELF),"AM22_GFS_BOOTSTRAP_PREDECESSOR_CHECKER_CHANGED");
 cp.execFileSync(process.execPath,[path.join(ROOT,BOOTSTRAP_ACCEPTANCE)],{cwd:ROOT,stdio:"pipe"});
 const historical=require("./ACCEPTANCE_MCFT_CAP_09_PROOF_BOUND_FIRST_PARENT_SUCCESSOR_CHAIN_V1.cjs").verifyFormalV5AuthorityContinuity("a60aa6858662ce87b989ff752c50969f21ad4619",true);
 const adopted=git("diff","--name-only","a60aa6858662ce87b989ff752c50969f21ad4619",BOOTSTRAP_BASE).split(/\r?\n/).filter(Boolean);
 return {status:"PASS",baseline:BOOTSTRAP_BASE,changedPaths:[...new Set([...historical.changedPaths,...adopted,...changes.map(x=>x.rel)])],qualification_scope:"AM22_DISABLED_START_CHAIN_ENGINEERING_ONLY",current_delta_scope:"AM22_GFS_BOOTSTRAP_ORCHESTRATION_ONLY",short_a0_bootstrap_port_qualified:true,production_execution_performed:false,existing_owner_cutover_authority_reused:true,existing_preformal_a0_planning_authority_reused:true,derived_bootstrap_timing_authority_qualified:true,provider_semantics_changed:false,twin_runtime_semantics_changed:false,formal_database_credential_consumed:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,mcft_cap09_completed:false};
}
// END GFS_BOOTSTRAP_ORCHESTRATION_ONLY
module.exports={BASE,DOC,POLICY,QCP,PRIOR,RETIRE,BOUNDARY,PATHS,CHECK,ROUTE,RETIRE_BEFORE,RETIRE_AFTER,BOUNDARY_BEFORE,BOUNDARY_AFTER,validateBoundary,verifyEngineeringOnly,TRANSPORT_BASE,TRANSPORT_WORKFLOW,TRANSPORT_PATHS,TRANSPORT_BEFORE,TRANSPORT_AFTER,validateTransportBoundary,verifyFreshAuthorityTransportOnly,KEY_BASE,KEY_PEM,KEY_DIGEST,KEY_PATHS,KEY_BOUNDARY_BEFORE,KEY_BOUNDARY_AFTER,validateKeyBoundary,verifyExecutionKeyAdoptionOnly,MEASUREMENT_BASE,MEASUREMENT_DOC,MEASUREMENT_PATHS,MEASUREMENT_NEW,MEASUREMENT_CHECK,validateMeasurementBoundary,verifyHostMeasurementOnly,BOOTSTRAP_BASE,BOOTSTRAP_DOC,BOOTSTRAP_OWNER_POLICY,BOOTSTRAP_A0_POLICY,BOOTSTRAP_COMBINED_A0_POLICY,BOOTSTRAP_PATHS,BOOTSTRAP_NEW,BOOTSTRAP_CHECK,validateBootstrapBoundary,verifyGfsBootstrapOnly};
if(require.main===module)console.log(JSON.stringify(verifyEngineeringOnly(),null,2));
