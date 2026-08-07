#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs';
const FROZEN_SUBJECT='ecb23638cd35824db93b81c4c8bca27e7736696d'; const FROZEN_BLOB='8a2734ce3adfb82e7e432f2a89485b76c9b5e791';
const S5_SUBJECT='afc882c49d6ec0a475552686200c369eb819b6cd';
const S5_DESCENDANT_BASE='f421ab1f2d4ba1b07654fac8f465224f717cb18f';
const S5_EXACT_SHA_REPAIR_FILES=[
  ".github/workflows/mcft-cap-09-s2-registry-registration.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs",
  "scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs",
  "scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs"
];
const S5_EXACT_SHA_ATTESTATION_FILES=[
  ".github/workflows/mcft-cap-09-s5-exact-sha-attestation.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_EXACT_SHA_ATTESTATION_V1.cjs"
];
const CANDIDATE_FILES=[
  ".github/workflows/mcft-cap-09-s5-shadow-online-canonical-integration.yml",
  "apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.ts",
  "apps/server/src/runtime/twin_runtime/postgres_frozen_shadow_online_evidence_source_v1.ts",
  "apps/server/src/runtime/twin_runtime/postgres_read_only_execution_evidence_adapter_v1.ts",
  "apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.ts",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-HARD-ACCEPTANCE-EVIDENCE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-BOUNDARY-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-V1.json",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CONFIG-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION_DB.ts"
];
const AUTHORITY_FALSE_FIELDS=['implementation_authorized','runtime_source_authorized','live_ingestion_authorized','background_scheduler_authorized','canonical_write_authorized','public_http_writer_authorized','model_activation_authorized','controlled_action_authorized'];
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function blobSha(value){const bytes=Buffer.from(value,'utf8');return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');}
function must(v,c){if(!v)throw new Error(c);}
function sameFiles(a,b){return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());}
function changedFiles(base){return git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();}
function write(name,value){fs.mkdirSync(path.join(ROOT,'acceptance-output'),{recursive:true});fs.writeFileSync(path.join(ROOT,'acceptance-output',name),JSON.stringify(value,null,2)+'\n');}
function oneCommit(base){must(git('rev-list','--count',`${base}..HEAD`)==='1','ONE_COMMIT_REQUIRED');}
function ancestor(a,b){const r=cp.spawnSync('git',['merge-base','--is-ancestor',a,b],{cwd:ROOT});must(r.status===0,`ANCESTOR_REQUIRED:${a}:${b}`);}
function noDeclaration(files){const marker=['<!--','MCFT_CANDIDATE_DECLARATION_V2'].join(' ');for(const file of files)must(!fs.readFileSync(path.join(ROOT,file),'utf8').includes(marker),`CANDIDATE_DECLARATION_FORBIDDEN_IN_FILE:${file}`);}
function delegate(){const frozen=cp.execFileSync('git',['show',`${FROZEN_SUBJECT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});must(blobSha(frozen)===FROZEN_BLOB,'FROZEN_S5_REGISTRATION_CROSS_VALIDATOR_BLOB_MISMATCH');const temp=path.join(__dirname,`.mcft-cap09-s5-registration-cross-${process.pid}.cjs`);try{fs.writeFileSync(temp,frozen);const r=cp.spawnSync(process.execPath,[temp,...process.argv.slice(2)],{cwd:ROOT,env:process.env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;}finally{try{fs.unlinkSync(temp);}catch{}}}
const base=process.env.MCFT_BASE_SHA;if(!base)throw new Error('MCFT_BASE_SHA_REQUIRED');const files=changedFiles(base);
try{
 if(process.argv.includes('--s5-exact-sha-lifecycle-repair')){
  must(base===S5_DESCENDANT_BASE,'EXACT_S5_EXACT_SHA_ROUTING_REPAIR_BASE_REQUIRED');oneCommit(base);must(sameFiles(files,S5_EXACT_SHA_REPAIR_FILES),'EXACT_S5_EXACT_SHA_ROUTING_REPAIR_BOUNDARY_REQUIRED');noDeclaration(files);
  for(const file of ['docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json'])must(git('rev-parse',`${base}:${file}`)===git('rev-parse',`HEAD:${file}`),`FROZEN_S5_AUTHORITY_BLOB_DRIFT:${file}`);
  const classifier=fs.readFileSync(path.join(ROOT,'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'),'utf8');const router=fs.readFileSync(path.join(ROOT,'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'),'utf8');const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/mcft-cap-09-s2-registry-registration.yml'),'utf8');
  for(const token of ['s5-exact-sha-lifecycle-repair','s5-exact-sha-attestation','S5_EXACT_SHA_ATTESTATION_FILES','S5_DESCENDANT_BASE'])must(classifier.includes(token),`S5_EXACT_SHA_CLASSIFIER_TOKEN_REQUIRED:${token}`);
  for(const token of ['s5-exact-sha-lifecycle-repair','s5-exact-sha-attestation','--s5-exact-sha-route-only','MCFT_S5_SUBJECT_SHA']){must(router.includes(token),`S5_EXACT_SHA_ROUTER_TOKEN_REQUIRED:${token}`);must(workflow.includes(token),`S5_EXACT_SHA_WORKFLOW_TOKEN_REQUIRED:${token}`);}
  const result={status:'PASS',lifecycle:'S5_EXACT_SHA_LIFECYCLE_ROUTING_REPAIR',base_sha:base,head_sha:git('rev-parse','HEAD'),changed_files:files,candidate_transition:false,registry_transition:false,runtime_source_delta:0,migration_delta:0,external_effectiveness:false,first_legal_next_action:'MCFT_CAP_09_S5_EXACT_SHA_R2_CONTROL_PLANE'};write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',result);write('MCFT_CAP_09_S5_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',result);console.log(JSON.stringify(result,null,2));process.exit(0);
 }
 if(process.argv.includes('--s5-exact-sha-route-only')){
  must(process.env.MCFT_S5_SUBJECT_SHA===S5_SUBJECT,'EXACT_S5_SUBJECT_ENV_REQUIRED');ancestor(S5_SUBJECT,base);oneCommit(base);must(sameFiles(files,S5_EXACT_SHA_ATTESTATION_FILES),'EXACT_S5_EXACT_SHA_CONTROL_PLANE_BOUNDARY_REQUIRED');noDeclaration(files);
  for(const file of ['docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json','scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','.github/workflows/mcft-cap-09-s2-registry-registration.yml'])must(git('rev-parse',`${base}:${file}`)===git('rev-parse',`HEAD:${file}`)||S5_EXACT_SHA_ATTESTATION_FILES.includes(file),`S5_EXACT_SHA_CONTROL_PLANE_DRIFT:${file}`);
  const result={status:'PASS',lifecycle:'S5_EXACT_SHA_ATTESTATION_ROUTED',base_sha:base,head_sha:git('rev-parse','HEAD'),changed_files:files,candidate_transition:false,registry_transition:false,runtime_source_delta:0,migration_delta:0,external_effectiveness:false,first_legal_next_action:'PROTECTED_MERGE_TRIGGERS_S5_EXACT_SHA_R2_ATTESTATION'};write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',result);write('MCFT_CAP_09_S5_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',result);console.log(JSON.stringify(result,null,2));process.exit(0);
 }
 if(process.argv.includes('--s5-candidate-route-only')){
  ancestor(FROZEN_SUBJECT,base);oneCommit(base);must(sameFiles(files,CANDIDATE_FILES),'EXACT_S5_CANDIDATE_BOUNDARY_REQUIRED');
  for(const file of ['docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','.github/workflows/mcft-cap-09-s2-registry-registration.yml'])must(git('rev-parse',`${base}:${file}`)===git('rev-parse',`HEAD:${file}`),`S5_CANDIDATE_CONTROL_PLANE_DRIFT:${file}`);
  const status=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json'),'utf8'));must(status.status==='S5_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE'&&status.s5_candidate_implemented===true&&status.s5_registry_registration_implemented===true&&status.externally_effective===false,'S5_CANDIDATE_SIGNAL_REQUIRED');for(const field of AUTHORITY_FALSE_FIELDS)must(status[field]===false,`S5_AUTHORITY_MUST_REMAIN_FALSE:${field}`);
  const boundary=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-SHADOW-ONLINE-CANONICAL-INTEGRATION-CANDIDATE-BOUNDARY-V1.json'),'utf8'));must(boundary.file_count===13&&boundary.runtime_source_delta===4&&sameFiles(boundary.files,CANDIDATE_FILES),'S5_THIRTEEN_FILE_BOUNDARY_DOCUMENT_REQUIRED');
  const executionAdapter=fs.readFileSync(path.join(ROOT,'apps/server/src/runtime/twin_runtime/postgres_read_only_execution_evidence_adapter_v1.ts'),'utf8');for(const token of ['ExecutionFeedbackPortV1','PostgresActionFeedbackTickSourceV1','selectCap05ActionFeedbackForTickV1'])must(executionAdapter.includes(token),`S5_EXECUTION_FEEDBACK_ADAPTER_REQUIRED:${token}`);
  const result={status:'PASS',lifecycle:'S5_CANDIDATE_SIGNAL_ROUTED',base_sha:base,head_sha:git('rev-parse','HEAD'),changed_files:files,candidate_transition:true,registry_transition:false,runtime_source_delta:4,migration_delta:0,external_effectiveness:false,first_legal_next_action:'RUN_FOCUSED_AND_STANDARD_CANDIDATE_ACCEPTANCE'};write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',result);write('MCFT_CAP_09_S5_REGISTRY_LIFECYCLE_ROUTE_RESULT.json',result);console.log(JSON.stringify(result,null,2));process.exit(0);
 }
 delegate();
}catch(error){const failure={status:'FAIL',error:String(error?.message??error)};write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',failure);if(process.argv.some(v=>v.startsWith('--s5-candidate-')))write('MCFT_CAP_09_S5_REGISTRY_LIFECYCLE_ROUTE_RESULT.json',failure);if(process.argv.some(v=>v.startsWith('--s5-exact-sha-')))write('MCFT_CAP_09_S5_EXACT_SHA_LIFECYCLE_ROUTE_RESULT.json',failure);console.error(error);process.exitCode=1;}
