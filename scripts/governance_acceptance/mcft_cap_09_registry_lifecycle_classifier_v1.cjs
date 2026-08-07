#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs';
const FROZEN_SUBJECT='ecb23638cd35824db93b81c4c8bca27e7736696d';
const FROZEN_BLOB='1c5746385f1c63a873d036a22ba9dbddb32d7354';
const S5_SUBJECT='afc882c49d6ec0a475552686200c369eb819b6cd';
const S5_DESCENDANT_BASE=true;
const S6_REGISTRATION_FILES=[".github/workflows/mcft-cap-09-s2-registry-registration.yml",".github/workflows/mcft-cap-09-s6-registry-registration.yml","docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-DELIVERY-STATUS-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-REGISTRY-REGISTRATION-BOUNDARY-V1.json","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-REGISTRY-REGISTRATION-V1.json","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S6_REGISTRY_REGISTRATION.cjs","scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs","scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs"];
const S5_EXACT_SHA_LIFECYCLE_REPAIR_FILES=[
  ".github/workflows/mcft-cap-09-s2-registry-registration.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs",
  "scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs",
  "scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs"
];
const S5_EXACT_SHA_ATTESTATION_FILES=[
  ".github/workflows/mcft-cap-09-s5-exact-sha-attestation.yml",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S5_EXACT_SHA_ATTESTATION_V1.cjs"
];
const S5_CANDIDATE_FILES=[
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
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function blobSha(value){const bytes=Buffer.from(value,'utf8');return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');}
function sameFiles(a,b){return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());}
function ancestor(a,b){const r=cp.spawnSync('git',['merge-base','--is-ancestor',a,b],{cwd:ROOT});if(r.status!==0)throw new Error(`ANCESTOR_REQUIRED:${a}:${b}`);}
function publish(mode,files){if(!process.env.GITHUB_OUTPUT)throw new Error('GITHUB_OUTPUT_REQUIRED');fs.appendFileSync(process.env.GITHUB_OUTPUT,`mode=${mode}\n`);console.log(JSON.stringify({lane:process.env.MCFT_REGISTRY_LANE??null,mode,base_sha:process.env.MCFT_BASE_SHA??null,files},null,2));}
const base=process.env.MCFT_BASE_SHA;if(!base)throw new Error('MCFT_BASE_SHA_REQUIRED');
const files=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
if(sameFiles(files,S6_REGISTRATION_FILES)){publish('s6-registry-registration',files);process.exit(0);}
if(sameFiles(files,S5_EXACT_SHA_LIFECYCLE_REPAIR_FILES)){publish('s5-exact-sha-lifecycle-repair',files);process.exit(0);}
if(sameFiles(files,S5_EXACT_SHA_ATTESTATION_FILES)){if(!S5_DESCENDANT_BASE)throw new Error('S5_DESCENDANT_BASE_DISABLED');ancestor(S5_SUBJECT,base);publish('s5-exact-sha-attestation',files);process.exit(0);}
if(sameFiles(files,S5_CANDIDATE_FILES)){publish('s5-candidate-signal',files);process.exit(0);}
const frozen=cp.execFileSync('git',['show',`${FROZEN_SUBJECT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});if(blobSha(frozen)!==FROZEN_BLOB)throw new Error('FROZEN_S5_REGISTRATION_CLASSIFIER_BLOB_MISMATCH');
const temp=path.join(__dirname,`.mcft-cap09-s5-registration-classifier-${process.pid}.cjs`);
try{fs.writeFileSync(temp,frozen);const r=cp.spawnSync(process.execPath,[temp,...process.argv.slice(2)],{cwd:ROOT,env:process.env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;}finally{try{fs.unlinkSync(temp);}catch{}}
