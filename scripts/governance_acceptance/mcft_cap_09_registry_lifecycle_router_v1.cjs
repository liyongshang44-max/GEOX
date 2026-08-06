#!/usr/bin/env node
'use strict';
const cp=require('node:child_process');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const TARGET='scripts/governance_acceptance/mcft_cap_09_registry_lifecycle_router_v1.cjs';
const SOURCE_COMMIT='881dad9794895c4f50abea358338c440b0ca833e';
const SOURCE_BLOB='1e63719e5d98c9f383360dd9c46da4b64b55c534';
function blob(value){const b=Buffer.from(value);return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`),b])).digest('hex');}
function once(source,from,to,code){if(source.split(from).length!==2)throw new Error(`${code}_CARDINALITY`);return source.replace(from,to);}
let source=cp.execFileSync('git',['show',`${SOURCE_COMMIT}:${TARGET}`],{cwd:ROOT,encoding:'utf8'});
if(blob(source)!==SOURCE_BLOB)throw new Error('FROZEN_ROUTER_BLOB_MISMATCH');
source=once(source,"const routes={", "const routes={\n's4-candidate-lifecycle-repair':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs','--s4-candidate-lifecycle-repair'],\n's4-candidate-signal':['scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S2_REGISTRY_CROSS_LIFECYCLE_REPAIR.cjs','--s4-candidate-route-only'],",'S4_ROUTES');
const temp=path.join(__dirname,`.mcft-cap09-s4-router-${process.pid}.cjs`);
try{fs.writeFileSync(temp,source);const r=cp.spawnSync(process.execPath,[temp,...process.argv.slice(2)],{cwd:ROOT,env:process.env,stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;}finally{try{fs.unlinkSync(temp);}catch{}}
