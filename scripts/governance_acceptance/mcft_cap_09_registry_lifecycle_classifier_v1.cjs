#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs';
const SOURCE_COMMIT='881dad9794895c4f50abea358338c440b0ca833e';
const SOURCE_BLOB='e82db75c5fd66922fe905d262a68a43fcd080122';
const S4_ROUTE=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'.github/workflows/mcft-cap-09-s4-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'];
const S4_CAND=[
'.github/workflows/mcft-cap-09-s4-restart-backfill-stale-detection.yml',
'apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.ts',
'apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.ts',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-HARD-ACCEPTANCE-EVIDENCE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CANDIDATE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-RESTART-BACKFILL-STALE-DETECTION-CONFIG-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S4_RESTART_BACKFILL_STALE_DETECTION.ts'];
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function blob(value){const b=Buffer.from(value);return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');}
function once(source,from,to,code){if(source.split(from).length!==2)throw new Error(`${code}_CARDINALITY`);return source.replace(from,to);}
let source=cp.execFileSync('git',['show',`${SOURCE_COMMIT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});
if(blob(source)!==SOURCE_BLOB)throw new Error('FROZEN_CLASSIFIER_BLOB_MISMATCH');
source=once(source,"const s3ExactShaLifecycleRepair=[...s3CandidateLifecycleRepair];",`const s3ExactShaLifecycleRepair=[...s3CandidateLifecycleRepair];\nconst s4CandidateLifecycleRepair=${JSON.stringify(S4_ROUTE)};`,'ROUTE_SET');
source=once(source,"const s3Registration=[",`const s4Candidate=${JSON.stringify(S4_CAND)};\nconst s3Registration=[`,'CANDIDATE_SET');
source=once(source,"if(same(files,historicalS2CrossLifecycleRepair)||same(files,s2RegistrationLifecycleRepair)||same(files,s3RegistrationLifecycleRepair)||same(files,s3CandidateLifecycleRepair)||same(files,s3ExactShaLifecycleRepair)) mode='s2-cross-lifecycle-repair';", "if(same(files,s4CandidateLifecycleRepair)) mode='s4-candidate-lifecycle-repair';\nelse if(same(files,historicalS2CrossLifecycleRepair)||same(files,s2RegistrationLifecycleRepair)||same(files,s3RegistrationLifecycleRepair)||same(files,s3CandidateLifecycleRepair)||same(files,s3ExactShaLifecycleRepair)) mode='s2-cross-lifecycle-repair';",'ROUTE_MODE');
source=once(source,"else if(same(files,s4Registration)) mode='s4-registry-registration';", "else if(same(files,s4Candidate)) mode='s4-candidate-signal';\nelse if(same(files,s4Registration)) mode='s4-registry-registration';",'CANDIDATE_MODE');
const temp=path.join(__dirname,`.mcft-cap09-s4-classifier-${process.pid}.cjs`);
try{fs.writeFileSync(temp,source);const r=cp.spawnSync(process.execPath,[temp,...process.argv.slice(2)],{cwd:ROOT,env:process.env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;}finally{try{fs.unlinkSync(temp);}catch{}}
