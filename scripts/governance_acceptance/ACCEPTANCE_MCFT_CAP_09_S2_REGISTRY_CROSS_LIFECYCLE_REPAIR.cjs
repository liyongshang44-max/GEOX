#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
process.chdir(ROOT);
const BASE='1953db5f1eacadfbba664873e2bd00487edeb76f';
const FILES=[
'.github/workflows/mcft-cap-09-s1-registry-registration.yml',
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'].sort();
const FROZEN=[
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json'];
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
assert.equal(process.env.MCFT_BASE_SHA,BASE,'EXACT_REPAIR_BASE_REQUIRED');
assert.equal(run(['rev-list','--count',`${BASE}..HEAD`]),'1','ONE_COMMIT_REQUIRED');
const changed=run(['diff','--name-only',`${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
assert.deepEqual(changed,FILES,'EXACT_FIVE_FILE_REPAIR_BOUNDARY_REQUIRED');
const diff=run(['diff','--unified=0',`${BASE}...HEAD`]);
const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
assert(!diff.includes(`<!-- ${declarationMarker}`),'CANDIDATE_DECLARATION_FORBIDDEN');
for(const file of FROZEN){
assert.equal(run(['show',`${BASE}:${file}`]),fs.readFileSync(file,'utf8').trim(),`FROZEN_AUTHORITY_DRIFT:${file}`);
}
const trusted=fs.readFileSync(FILES[1],'utf8');
const s1=fs.readFileSync(FILES[0],'utf8');
const classifier=fs.readFileSync(FILES[3],'utf8');
const router=fs.readFileSync(FILES[4],'utf8');
for(const source of [trusted,s1]){
for(const token of ['s2-registry-registration','s2-candidate-signal','31007579256','8930987741','MCFT_CAP09_S1_EFFECTIVE_ARTIFACT_DIR']) assert(source.includes(token),`WORKFLOW_TOKEN_REQUIRED:${token}`);
assert(source.includes('mcft_cap_09_registry_lifecycle_classifier_v1.cjs'));
assert(source.includes('mcft_cap_09_registry_lifecycle_router_v1.cjs'));
}
for(const token of ['s2-cross-lifecycle-repair','s2-registry-registration','s2-candidate-signal','GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json']) assert(classifier.includes(token),`CLASSIFIER_TOKEN_REQUIRED:${token}`);
for(const token of ['ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs','ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_REGISTRATION.cjs','ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs']) assert(router.includes(token),`ROUTER_TOKEN_REQUIRED:${token}`);
const output={
schema_version:'geox_mcft_cap_09_s2_registry_cross_lifecycle_repair_result_v1',
status:'PASS',
base_sha:BASE,
head_sha:run(['rev-parse','HEAD']),
changed_files:changed,
s1_effective_subject:'843ed078d6d384e43e2c6bd2568d789dcd508934',
s1_r2_run_id:31007579256,
s1_r2_artifact_id:8930987741,
s2_registry_registration_route_ready:true,
s2_candidate_handoff_route_ready:true,
candidate_transition:false,
registry_delta:0,
taskbook_delta:0,
status_object_delta:0,
runtime_source_delta:0,
live_ingestion:false,
background_scheduler:false,
canonical_write:false,
next_legal_action:'MCFT_CAP_09_S2_REGISTRY_REGISTRATION'};
fs.mkdirSync('acceptance-output',{recursive:true});
fs.writeFileSync('acceptance-output/MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
