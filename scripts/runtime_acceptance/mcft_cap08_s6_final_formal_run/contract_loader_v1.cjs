#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const CAP='docs/digital_twin/mcft/cap_08';
const PATHS={
 authority:`${CAP}/GEOX-MCFT-CAP-08-S6-FINAL-FORMAL-RUN-ORCHESTRATOR-IMPLEMENTATION-AUTHORITY-V1.json`,
 producerEffect:`${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-PRODUCER-EFFECTIVENESS-AUTHORITY-V1.json`,
 run:`${CAP}/GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1.json`,
 s6:`${CAP}/GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json`,
 manifest:`${CAP}/GEOX-MCFT-CAP-08-S6-CLOSURE-MEMBER-MANIFEST-CONTRACT-V1.json`,
 dataset:`${CAP}/GEOX-MCFT-CAP-08-S5-REPLAY-DATASET-V2-EFFECTIVENESS-AUTHORITY-V1.json`,
};
function readJson(repoPath){return JSON.parse(fs.readFileSync(path.join(ROOT,repoPath),'utf8'));}
function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function gitBlob(repoPath,ref='HEAD'){return git('rev-parse',`${ref}:${repoPath}`);}
function loadFinalRunContractsV1({localReplay=process.env.MCFT_LOCAL_REPLAY==='1'}={}){
 const authority=readJson(PATHS.authority),producerEffect=readJson(PATHS.producerEffect),run=readJson(PATHS.run),s6=readJson(PATHS.s6),manifest=readJson(PATHS.manifest),dataset=readJson(PATHS.dataset);
 assert.equal(authority.record_status,'FINAL_FORMAL_RUN_ORCHESTRATOR_IMPLEMENTATION_AUTHORIZED');
 assert.equal(authority.execution_constraints.single_run_database_execution_authorized,false);
 assert.equal(authority.execution_constraints.dual_run_ci_authorized,false);
 assert.equal(producerEffect.record_status,'WITNESS_PRODUCERS_IMPLEMENTED_EFFECTIVE');
 assert.equal(run.record_status,'FROZEN_S0_CONTRACT'); assert.equal(run.tick_ids.length,24); assert.deepEqual(run.post_run_phases,['G00','G01','G02']);
 assert.equal(s6.formal_run_contract.run_count,2); assert.deepEqual(s6.formal_run_contract.run_ids,['RUN_A','RUN_B']);
 assert.equal(manifest.canonical_member_identity.operational_run_instance_id_in_canonical_identity_forbidden,true);
 if(!localReplay){const exact={authority:'4dec4839af8f2ac956c820e21e0b397aa4c32aaf',producerEffect:'a939443498047192f83638435526cd152e7b0639',run:'7a5feecbdb204c8fdf8c21ee8ea66576133c17dd',s6:'9cecc1aa6bd4063b770304f2539bc68a1ed2390c',manifest:'b766bcad82bfa0c1270ee01aeaddf47517dec23e',dataset:'b7baa289daf9f391f0b200d77c6d7ee7f18e7252'};for(const [k,v] of Object.entries(exact))assert.equal(gitBlob(PATHS[k]),v,`AUTHORITY_BLOB_DRIFT:${k}`);}
 return{authority,producerEffect,run,s6,manifest,dataset,paths:PATHS};
}
module.exports={ROOT,CAP,PATHS,readJson,git,gitBlob,loadFinalRunContractsV1};
