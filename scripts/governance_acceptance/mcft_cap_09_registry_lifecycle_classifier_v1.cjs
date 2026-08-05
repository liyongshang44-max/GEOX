#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const cp=require('node:child_process');
const lane=process.env.MCFT_REGISTRY_LANE;
const base=process.env.MCFT_BASE_SHA;
if(!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
if(!['trusted-registry-bootstrap','s1-registry-registration','s2-registry-registration'].includes(lane)) throw new Error('MCFT_REGISTRY_LANE_INVALID');
const files=cp.execFileSync('git',['diff','--name-only',`${base}...HEAD`],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean).sort();
const has=(file)=>files.includes(file);
const exact=(expected)=>files.length===expected.length&&expected.every(has);
let mode='unsupported';
if(lane==='s2-registry-registration'){
  if(exact([
    '.github/workflows/mcft-cap-09-s2-registry-registration.yml',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
    'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'
  ])) mode='s2-cross-lifecycle-repair';
  else if(exact([
    '.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
    'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'
  ])) mode='s2-exact-sha-attestation';
  else if(files.length===6&&has('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json')&&has('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-REGISTRY-REGISTRATION-V1.json')&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_REGISTRATION.cjs')) mode='s2-registry-registration';
  else if(files.length===10&&has('.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml')&&has('apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts')&&has('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json')&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs')&&!has('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json')) mode='s2-candidate-signal';
}else if(lane==='s1-registry-registration'){
  if(files.length===3&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_CANDIDATE_CROSS_LIFECYCLE_REPAIR.cjs')) mode='s1-cross-lifecycle-repair';
  else if(files.length===6&&has('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-V1.json')&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs')) mode='s1-registry-registration';
  else if(files.length===11&&has('.github/workflows/mcft-cap-09-s1-adapter-contracts.yml')&&has('apps/server/src/runtime/twin_runtime/ports.ts')&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs')) mode='s1-candidate-signal';
}else{
  if(files.length===2&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_S1_LIFECYCLE_REPAIR.cjs')) mode='workflow-repair';
  else if(files.length===3&&has('docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-V1.json')) mode='registry-existing-paths-correction';
  else if(files.length===6&&has('.github/workflows/mcft-cap-09-s0-authorization.yml')&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs')) mode='candidate-signal';
  else if(files.length===7&&has('.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml')&&has('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs')) mode='bootstrap';
}
fs.appendFileSync(process.env.GITHUB_OUTPUT,`mode=${mode}\n`);
console.log(JSON.stringify({lane,mode,files},null,2));
