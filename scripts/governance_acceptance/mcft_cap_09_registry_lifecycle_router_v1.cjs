#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs';
const FROZEN_SUBJECT='ecb23638cd35824db93b81c4c8bca27e7736696d';
const FROZEN_BLOB='f0478813da2b596fcb4b050fd8faef849666089e';
const mode=process.env.MCFT_REGISTRY_MODE;
const S5_SUBJECT='afc882c49d6ec0a475552686200c369eb819b6cd';
const S5_DESCENDANT_BASE=true;
function blobSha(value){const bytes=Buffer.from(value,'utf8');return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');}
function runNode(argv){const r=cp.spawnSync(process.execPath,argv,{cwd:ROOT,env:process.env,stdio:'inherit'});if(r.error)throw r.error;return r.status??1;}
if(mode==='s5-exact-sha-lifecycle-repair')process.exitCode=runNode(['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs','--s5-exact-sha-lifecycle-repair']);
else if(mode==='s5-exact-sha-attestation'){if(!S5_DESCENDANT_BASE||process.env.MCFT_S5_SUBJECT_SHA!==S5_SUBJECT)throw new Error('MCFT_S5_SUBJECT_SHA_REQUIRED');process.exitCode=runNode(['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs','--s5-exact-sha-route-only']);}
else if(mode==='s5-candidate-signal')process.exitCode=runNode(['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs','--s5-candidate-route-only']);
else{const frozen=cp.execFileSync('git',['show',`${FROZEN_SUBJECT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});if(blobSha(frozen)!==FROZEN_BLOB)throw new Error('FROZEN_S5_REGISTRATION_ROUTER_BLOB_MISMATCH');const temp=path.join(__dirname,`.mcft-cap09-s5-registration-router-${process.pid}.cjs`);try{fs.writeFileSync(temp,frozen);process.exitCode=runNode([temp,...process.argv.slice(2)]);}finally{try{fs.unlinkSync(temp);}catch{}}}
