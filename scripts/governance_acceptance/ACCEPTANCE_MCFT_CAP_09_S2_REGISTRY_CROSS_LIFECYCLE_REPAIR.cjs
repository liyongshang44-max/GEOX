#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
process.chdir(ROOT);
const LEGACY_BASE='1953db5f1eacadfbba664873e2bd00487edeb76f';
const CANDIDATE_ROUTING_BASE='508da08b2c5855e6391bc87e0d56042fc9232a97';
const POSTMERGE_CORRECTION_ROUTING_BASE='a2e23b47abaf571489458363de48f428262b5f31';
const HISTORICAL_LANE_COMPATIBILITY_BASE='3c55344f0463b3603ee92da150273b19b45137fa';
const EXACT_SHA_ROUTING_REPAIR_BASE='126257e1a08d116089f5f28bd733e6abfd92f290';
const CORRECTED_S2_SUBJECT='126257e1a08d116089f5f28bd733e6abfd92f290';
const HISTORICAL_FILES=[
'.github/workflows/mcft-cap-09-s1-registry-registration.yml',
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'].sort();
const REGISTRATION_REPAIR_FILES=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'].sort();
const EXACT_SHA_FILES=[
'.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'].sort();
const FROZEN=[
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts'];
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const write=(name,output)=>{
  fs.mkdirSync('acceptance-output',{recursive:true});
  fs.writeFileSync(`acceptance-output/${name}`,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output,null,2));
};
const base=process.env.MCFT_BASE_SHA;
if(!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
const changed=run(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');

if(process.argv.includes('--exact-sha-route-only')){
  assert(same(changed,EXACT_SHA_FILES),'EXACT_S2_EXACT_SHA_LIFECYCLE_BOUNDARY_REQUIRED');
  assert.equal(run(['rev-list','--count',`${base}..HEAD`]),'1','ONE_COMMIT_REQUIRED');
  const diff=run(['diff','--unified=0',`${base}...HEAD`]);
  assert(!diff.includes(declarationMarker),'CANDIDATE_DECLARATION_FORBIDDEN');
  const workflow=fs.readFileSync(EXACT_SHA_FILES[0],'utf8');
  const validator=fs.readFileSync(EXACT_SHA_FILES[1],'utf8');
  for(const token of [
    'mcft-cap-09-s2-exact-sha-attestation',
    'MCFT_SUBJECT_SHA',
    '--attest',
    'retention-days: 90',
    'mcft-cap-09/s2-exact-sha-attestation',
  ]) assert(workflow.includes(token),`EXACT_SHA_WORKFLOW_TOKEN_REQUIRED:${token}`);
  for(const token of [
    CORRECTED_S2_SUBJECT,
    'correction_to_merge_tree_delta',
    's2_database_evidence_ingress_effective',
    'MCFT_CAP_09_S3_REGISTRY_REGISTRATION',
    'semantic_artifact_digest',
  ]) assert(validator.includes(token),`EXACT_SHA_VALIDATOR_TOKEN_REQUIRED:${token}`);
  write('MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',{
    schema_version:'geox_mcft_cap_09_s2_exact_sha_lifecycle_route_result_v1',
    status:'PASS',
    lifecycle:'S2_EXACT_SHA_ATTESTATION_ROUTED_TO_DEDICATED_CONTROL_PLANE',
    base_sha:base,
    head_sha:run(['rev-parse','HEAD']),
    changed_files:changed,
    corrected_s2_subject_sha:CORRECTED_S2_SUBJECT,
    registry_transition:false,
    candidate_transition:false,
    runtime_source_delta:0,
    first_legal_next_action:'DEDICATED_S2_EXACT_SHA_CONTROL_PLANE'
  });
  process.exit(0);
}

const historical=same(changed,HISTORICAL_FILES);
const registrationRepair=same(changed,REGISTRATION_REPAIR_FILES);
const legacy=base===LEGACY_BASE&&historical;
const candidateRouting=base===CANDIDATE_ROUTING_BASE&&registrationRepair;
const postmergeRouting=base===POSTMERGE_CORRECTION_ROUTING_BASE&&registrationRepair;
const historicalCompatibility=base===HISTORICAL_LANE_COMPATIBILITY_BASE&&historical;
const exactShaRoutingRepair=base===EXACT_SHA_ROUTING_REPAIR_BASE&&registrationRepair;
assert(legacy||candidateRouting||postmergeRouting||historicalCompatibility||exactShaRoutingRepair,
  'EXACT_S2_LIFECYCLE_REPAIR_BASE_AND_BOUNDARY_REQUIRED');
assert.equal(run(['rev-list','--count',`${base}..HEAD`]),'1','ONE_COMMIT_REQUIRED');
const diff=run(['diff','--unified=0',`${base}...HEAD`]);
assert(!diff.includes(`<!-- ${declarationMarker}`),'CANDIDATE_DECLARATION_FORBIDDEN');
for(const file of FROZEN) assert.equal(run(['diff','--quiet',`${base}...HEAD`,'--',file]),'',
  `FROZEN_AUTHORITY_DRIFT:${file}`);
const classifier=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','utf8');
for(const token of [
  'historicalS2CrossLifecycleRepair',
  's2-cross-lifecycle-repair',
  's2-postmerge-semantic-correction',
  's2-exact-sha-attestation',
  's2ExactShaAttestation',
  's2_candidate_implemented',
  'MCFT_REGISTRY_LANE_INVALID',
]) assert(classifier.includes(token),`CLASSIFIER_TOKEN_REQUIRED:${token}`);
const router=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','utf8');
for(const token of [
  's2-postmerge-semantic-correction',
  '--postmerge-semantic-correction',
  'ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs',
]) assert(router.includes(token),`ROUTER_TOKEN_REQUIRED:${token}`);
for(const workflowPath of [
  '.github/workflows/mcft-cap-09-s1-registry-registration.yml',
  '.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
]) {
  const workflow=fs.readFileSync(workflowPath,'utf8');
  assert(workflow.includes("steps.lifecycle.outputs.mode == 's2-postmerge-semantic-correction'"),
    `HISTORICAL_WORKFLOW_S1_AUTHORITY_DOWNLOAD_REQUIRED:${workflowPath}`);
  assert(workflow.includes('mcft_cap_09_registry_lifecycle_router_v1.cjs'),
    `HISTORICAL_WORKFLOW_ROUTER_REQUIRED:${workflowPath}`);
  assert(workflow.includes('31007579256')&&workflow.includes('8930987741'),
    `HISTORICAL_WORKFLOW_S1_R2_IDENTITY_REQUIRED:${workflowPath}`);
}
if(exactShaRoutingRepair){
  const workflow=fs.readFileSync('.github/workflows/mcft-cap-09-s2-registry-registration.yml','utf8');
  for(const token of [
    's2-exact-sha-attestation',
    '--exact-sha-route-only',
    'MCFT_CAP_09_S2_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',
  ]) assert(workflow.includes(token),`S2_EXACT_SHA_ROUTE_TOKEN_REQUIRED:${token}`);
}
const generation=exactShaRoutingRepair
  ?'S2_REGISTRATION_WORKFLOW_EXACT_SHA_ROUTING_REPAIR'
  :historicalCompatibility
    ?'S2_POSTMERGE_SEMANTIC_CORRECTION_HISTORICAL_LANE_COMPATIBILITY'
    :postmergeRouting
      ?'S2_POSTMERGE_PRE_EFFECTIVENESS_SEMANTIC_CORRECTION_ROUTING'
      :candidateRouting
        ?'S2_REGISTRATION_WORKFLOW_CANDIDATE_ROUTING_REPAIR'
        :'INITIAL_S2_CROSS_LIFECYCLE_REPAIR';
const output={
 schema_version:'geox_mcft_cap_09_s2_registry_cross_lifecycle_repair_result_v1',
 status:'PASS',
 repair_generation:generation,
 base_sha:base,
 head_sha:run(['rev-parse','HEAD']),
 changed_files:changed,
 s1_effective_subject:'843ed078d6d384e43e2c6bd2568d789dcd508934',
 s1_r2_run_id:31007579256,
 s1_r2_artifact_id:8930987741,
 corrected_s2_subject_sha:CORRECTED_S2_SUBJECT,
 s2_registry_registration_route_ready:true,
 s2_candidate_handoff_route_ready:true,
 s2_postmerge_semantic_correction_route_ready:true,
 s2_exact_sha_attestation_route_ready:exactShaRoutingRepair,
 historical_s1_lane_correction_route_ready:historicalCompatibility||exactShaRoutingRepair,
 historical_trusted_lane_correction_route_ready:historicalCompatibility||exactShaRoutingRepair,
 candidate_transition:false,
 registry_delta:0,
 taskbook_delta:0,
 status_object_delta:0,
 runtime_source_delta:0,
 live_ingestion:false,
 background_scheduler:false,
 canonical_write:false,
 next_legal_action:exactShaRoutingRepair
   ?'REBUILD_MCFT_CAP_09_S2_EXACT_SHA_R2_CONTROL_PLANE'
   :historicalCompatibility
     ?'REBUILD_MCFT_CAP_09_S2_POSTMERGE_PRE_EFFECTIVENESS_SEMANTIC_CORRECTION'
     :postmergeRouting
       ?'MCFT_CAP_09_S2_POSTMERGE_PRE_EFFECTIVENESS_SEMANTIC_CORRECTION'
       :candidateRouting
         ?'REBUILD_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS_CANDIDATE'
         :'MCFT_CAP_09_S2_REGISTRY_REGISTRATION'
};
write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',output);
