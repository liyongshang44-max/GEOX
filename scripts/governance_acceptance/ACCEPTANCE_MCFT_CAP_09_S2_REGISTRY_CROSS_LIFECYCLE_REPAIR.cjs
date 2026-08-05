#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
process.chdir(path.resolve(__dirname,'../..'));
const REPAIR_BASE='a2e23b47abaf571489458363de48f428262b5f31';
const REPAIR_FILES=[
  '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
  'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'
].sort();
const EXACT_SHA_FILES=[
  '.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'
].sort();
const FROZEN=[
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json'
];
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const base=process.env.MCFT_BASE_SHA;
if(!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
const changed=run(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const write=(name,output)=>{
  fs.mkdirSync('acceptance-output',{recursive:true});
  fs.writeFileSync(`acceptance-output/${name}`,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output,null,2));
};
if(process.argv.includes('--exact-sha-route-only')){
  assert(same(changed,EXACT_SHA_FILES),'EXACT_S2_EXACT_SHA_LIFECYCLE_BOUNDARY_REQUIRED');
  const workflow=fs.readFileSync(EXACT_SHA_FILES[0],'utf8');
  const validator=fs.readFileSync(EXACT_SHA_FILES[1],'utf8');
  for(const token of ['mcft-cap-09-s2-exact-sha-attestation','MCFT_SUBJECT_SHA','--attest','retention-days: 90']) assert(workflow.includes(token),`EXACT_SHA_WORKFLOW_TOKEN_REQUIRED:${token}`);
  for(const token of ['a2e23b47abaf571489458363de48f428262b5f31','candidate_to_merge_tree_delta','s2_database_evidence_ingress_effective','MCFT_CAP_09_S3_REGISTRY_REGISTRATION']) assert(validator.includes(token),`EXACT_SHA_VALIDATOR_TOKEN_REQUIRED:${token}`);
  write('MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',{
    schema_version:'geox_mcft_cap_09_s2_exact_sha_lifecycle_route_result_v1',status:'PASS',
    lifecycle:'S2_EXACT_SHA_ATTESTATION_ROUTED_TO_DEDICATED_CONTROL_PLANE',base_sha:base,
    head_sha:run(['rev-parse','HEAD']),changed_files:changed,registry_transition:false,
    candidate_transition:false,runtime_source_delta:0,
    first_legal_next_action:'DEDICATED_S2_EXACT_SHA_CONTROL_PLANE'
  });
  process.exit(0);
}
assert.equal(base,REPAIR_BASE,'EXACT_SHA_ROUTING_REPAIR_BASE_REQUIRED');
assert(same(changed,REPAIR_FILES),'EXACT_SHA_ROUTING_REPAIR_BOUNDARY_REQUIRED');
assert.equal(run(['rev-list','--count',`${base}..HEAD`]),'1','ONE_COMMIT_REQUIRED');
const diff=run(['diff','--unified=0',`${base}...HEAD`]);
assert(!diff.includes(['MCFT','CANDIDATE','DECLARATION','V2'].join('_')),'CANDIDATE_DECLARATION_FORBIDDEN');
for(const file of FROZEN) assert.equal(run(['diff','--quiet',`${base}...HEAD`,'--',file]),'',`FROZEN_AUTHORITY_DRIFT:${file}`);
const classifier=fs.readFileSync(REPAIR_FILES[2],'utf8');
for(const token of ['s2-registry-registration','s2-candidate-signal','s2-cross-lifecycle-repair','s2-exact-sha-attestation','MCFT_REGISTRY_LANE_INVALID']) assert(classifier.includes(token),`CLASSIFIER_TOKEN_REQUIRED:${token}`);
const workflow=fs.readFileSync(REPAIR_FILES[0],'utf8');
for(const token of ['MCFT_REGISTRY_LANE: s2-registry-registration','MCFT_S2_REGISTRATION_MODE','s2-cross-lifecycle-repair','s2-registry-registration','s2-candidate-signal','s2-exact-sha-attestation','--exact-sha-route-only','31007579256','8930987741','MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json']) assert(workflow.includes(token),`WORKFLOW_TOKEN_REQUIRED:${token}`);
write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{
  schema_version:'geox_mcft_cap_09_s2_registry_cross_lifecycle_repair_result_v1',status:'PASS',
  repair_generation:'S2_REGISTRATION_WORKFLOW_EXACT_SHA_ROUTING_REPAIR',base_sha:base,
  head_sha:run(['rev-parse','HEAD']),changed_files:changed,
  s1_effective_subject:'843ed078d6d384e43e2c6bd2568d789dcd508934',s1_r2_run_id:31007579256,
  s1_r2_artifact_id:8930987741,s2_registry_registration_route_ready:true,
  s2_candidate_handoff_route_ready:true,s2_exact_sha_attestation_route_ready:true,
  candidate_transition:false,registry_delta:0,taskbook_delta:0,status_object_delta:0,
  runtime_source_delta:0,live_ingestion:false,background_scheduler:false,canonical_write:false,
  next_legal_action:'REBUILD_MCFT_CAP_09_S2_EXACT_SHA_R2_CONTROL_PLANE'
});
