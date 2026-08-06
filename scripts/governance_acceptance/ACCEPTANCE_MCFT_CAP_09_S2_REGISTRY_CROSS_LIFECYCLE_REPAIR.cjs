#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs';
const SOURCE_COMMIT='881dad9794895c4f50abea358338c440b0ca833e';
const SOURCE_BLOB='ea9285af8d1361ccc0faed758475b0fa1259092e';
const ROUTE_FILES=['.github/workflows/mcft-cap-09-s2-registry-registration.yml', '.github/workflows/mcft-cap-09-s3-registry-registration.yml', '.github/workflows/mcft-cap-09-s4-registry-registration.yml', 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs', 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs', 'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'];
const CANDIDATE_FILES=['.github/workflows/mcft-cap-09-s4-restart-backfill-stale-detection.yml', 'apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.ts', 'apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts', 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json', 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-HARD-ACCEPTANCE-EVIDENCE-V1.json', 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json', 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-BOUNDARY-V1.json', 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-V1.json', 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CONFIG-V1.json', 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.cjs', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts'];
function blob(value){const b=Buffer.from(value);return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');}
function once(source,from,to,code){if(source.split(from).length!==2)throw new Error(`${code}_CARDINALITY`);return source.replace(from,to);}
let source=cp.execFileSync('git',['show',`${SOURCE_COMMIT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});
if(blob(source)!==SOURCE_BLOB)throw new Error('FROZEN_CROSS_VALIDATOR_BLOB_MISMATCH');
const insertion=`
const S4_CANDIDATE_ROUTE_FILES=${JSON.stringify(CANDIDATE_FILES)};
const S4_CANDIDATE_REPAIR_FILES=${JSON.stringify(ROUTE_FILES)};
if(process.argv.includes('--s4-candidate-route-only')){
 must(same(files,S4_CANDIDATE_ROUTE_FILES),'EXACT_S4_CANDIDATE_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',\`${base}..HEAD\`])==='1','ONE_COMMIT_REQUIRED');
 const status=JSON.parse(fs.readFileSync('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json','utf8'));
 must(status.s4_candidate_implemented===true&&status.externally_effective===false,'S4_CANDIDATE_STATUS_REQUIRED');
 must(status.authorized_s4_scope==='RESTART_BACKFILL_STALE_DETECTION_ONLY','S4_CANDIDATE_SCOPE_REQUIRED');
 authorityFalse(status,'S4_CAND_STATUS');
 write('MCFT_CAP_09_S4_CANDIDATE_LIFECYCLE_ROUTE_RESULT.json',{status:'PASS',lifecycle:'S4_CANDIDATE_ROUTED',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,candidate_transition:true,registry_transition:false,runtime_source_delta:2,migration_delta:0});
 process.exit(0);
}
if(process.argv.includes('--s4-candidate-lifecycle-repair')){
 must(base==='881dad9794895c4f50abea358338c440b0ca833e','EXACT_S4_CANDIDATE_ROUTING_BASE_REQUIRED');
 must(same(files,S4_CANDIDATE_REPAIR_FILES),'EXACT_S4_CANDIDATE_ROUTING_BOUNDARY_REQUIRED');
 must(run(['rev-list','--count',\`${base}..HEAD\`])==='1','ONE_COMMIT_REQUIRED');
 for(const file of [
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json',
  'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts',
  'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql'
 ]) must(run(['rev-parse',\`${base}:${file}\`])===run(['rev-parse',\`HEAD:${file}\`]),\`FROZEN_BLOB_DRIFT:${file}\`);
 const classifier=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs','utf8');
 const router=fs.readFileSync('scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs','utf8');
 const workflows=S4_CANDIDATE_REPAIR_FILES.filter((f)=>f.endsWith('.yml')).map((f)=>fs.readFileSync(f,'utf8'));
 for(const token of ['s4-candidate-lifecycle-repair','s4-candidate-signal','S4_CAND']) must(classifier.includes(token),\`CLASSIFIER_TOKEN:${token}\`);
 for(const token of ['s4-candidate-lifecycle-repair','s4-candidate-signal','--s4-candidate-route-only']) must(router.includes(token),\`ROUTER_TOKEN:${token}\`);
 for(const workflow of workflows) must(workflow.includes('MCFT_CAP_09_S4_CANDIDATE_LIFECYCLE_ROUTE_RESULT.json'), 'WORKFLOW_S4_ROUTE_OUTPUT_REQUIRED');
 write('MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR_RESULT.json',{status:'PASS',repair_generation:'S4_CANDIDATE_LIFECYCLE_ROUTING',base_sha:base,head_sha:run(['rev-parse','HEAD']),changed_files:files,candidate_transition:false,registry_delta:0,status_object_delta:0,runtime_source_delta:0,migration_delta:0,next_legal_action:'MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION_CANDIDATE'});
 process.exit(0);
}
`;
source=once(source,"if(process.argv.includes('--exact-sha-route-only')){",insertion+"\nif(process.argv.includes('--exact-sha-route-only')){",'S4_BLOCKS');
const temp=path.join(__dirname,`.mcft-cap09-s4-cross-${process.pid}.cjs`);
try{fs.writeFileSync(temp,source);const r=cp.spawnSync(process.execPath,[temp,...process.argv.slice(2)],{cwd:ROOT,env:process.env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;}finally{try{fs.unlinkSync(temp);}catch{}}
