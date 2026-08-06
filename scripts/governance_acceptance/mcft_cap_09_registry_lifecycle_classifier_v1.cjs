#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const cp=require('node:child_process');
const lane=process.env.MCFT_REGISTRY_LANE;
const base=process.env.MCFT_BASE_SHA;
if(!base) throw new Error('MCFT_BASE_SHA_REQUIRED');
if(!['trusted-registry-bootstrap','s1-registry-registration','s2-registry-registration','s3-registry-registration'].includes(lane)) throw new Error('MCFT_REGISTRY_LANE_INVALID');
const run=(args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const files=run(['diff','--name-only',`${base}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const historicalS2CrossLifecycleRepair=[
'.github/workflows/mcft-cap-09-s1-registry-registration.yml',
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'];
const s2RegistrationLifecycleRepair=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs'];
const s3RegistrationLifecycleRepair=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'];
const s3CandidateLifecycleRepair=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_classifier_v1.cjs',
'scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs'];
const s2ExactShaAttestation=[
'.github/workflows/mcft-cap-09-s2-exact-sha-attestation.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION_V1.cjs'];
const s3Registration=[
'.github/workflows/mcft-cap-09-s3-registry-registration.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_REGISTRY_REGISTRATION.cjs'];
const s3Candidate=[
'.github/workflows/mcft-cap-09-s3-persistent-sequential-scheduler.yml',
'apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql',
'apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.ts',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-HARD-ACCEPTANCE-EVIDENCE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CANDIDATE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PERSISTENT-SEQUENTIAL-SCHEDULER-CONFIG-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER.ts'];
const s2Registration=[
'.github/workflows/mcft-cap-09-s2-registry-registration.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-REGISTRY-REGISTRATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_REGISTRATION.cjs'];
const s1Cross=[
'.github/workflows/mcft-cap-09-s1-registry-registration.yml',
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_CANDIDATE_CROSS_LIFECYCLE_REPAIR.cjs'];
const trustedRepair=[
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_S1_LIFECYCLE_REPAIR.cjs'];
const correction=[
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-EXISTING-PATHS-CORRECTION-V1.json'];
const s1Registration=[
'.github/workflows/mcft-cap-09-s1-registry-registration.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs'];
const s1Candidate=[
'.github/workflows/mcft-cap-09-s1-adapter-contracts.yml',
'apps/server/src/runtime/twin_runtime/ports.ts',
'apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CONFIG-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-HARD-ACCEPTANCE-EVIDENCE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.ts'];
const s0Candidate=[
'.github/workflows/mcft-cap-09-s0-authorization.yml',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs'];
const bootstrap=[
'.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml',
'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOOTSTRAP-V1.json',
'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TRUSTED-REGISTRY-BOUNDARY-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs'];
const s2StatusPath='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json';
const isS2CandidateBoundary=files.length===10&&files.includes(s2StatusPath)&&
files.includes('.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml')&&
files.includes('apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts')&&
files.includes('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_DATABASE_EVIDENCE_INGRESS.cjs')&&
!files.includes('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json')&&
files.some((p)=>p.endsWith('GEOX-MCFT-CAP-09-S2-DATABASE-EVIDENCE-INGRESS-CANDIDATE-V1.json'));
let baseS2CandidateImplemented=null;
if(isS2CandidateBoundary){baseS2CandidateImplemented=JSON.parse(run(['show',`${base}:${s2StatusPath}`])).s2_candidate_implemented;}
let mode='unsupported';
if(same(files,historicalS2CrossLifecycleRepair)||same(files,s2RegistrationLifecycleRepair)||same(files,s3RegistrationLifecycleRepair)||same(files,s3CandidateLifecycleRepair)) mode='s2-cross-lifecycle-repair';
else if(same(files,s3Registration)) mode='s3-registry-registration';
else if(same(files,s3Candidate)) mode='s3-candidate-signal';
else if(same(files,s2Registration)) mode='s2-registry-registration';
else if(same(files,s2ExactShaAttestation)) mode='s2-exact-sha-attestation';
else if(isS2CandidateBoundary&&baseS2CandidateImplemented===true) mode='s2-postmerge-semantic-correction';
else if(isS2CandidateBoundary) mode='s2-candidate-signal';
else if(same(files,s1Cross)) mode='s1-cross-lifecycle-repair';
else if(lane==='trusted-registry-bootstrap'&&same(files,trustedRepair)) mode='workflow-repair';
else if(lane==='trusted-registry-bootstrap'&&same(files,correction)) mode='registry-existing-paths-correction';
else if(same(files,s1Registration)) mode='s1-registry-registration';
else if(same(files,s1Candidate)) mode='s1-candidate-signal';
else if(lane==='trusted-registry-bootstrap'&&same(files,s0Candidate)) mode='candidate-signal';
else if(lane==='trusted-registry-bootstrap'&&same(files,bootstrap)) mode='bootstrap';
fs.appendFileSync(process.env.GITHUB_OUTPUT,`mode=${mode}\n`);
console.log(JSON.stringify({lane,mode,baseS2CandidateImplemented,files},null,2));
