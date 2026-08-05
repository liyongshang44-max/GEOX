#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP_RESULT.json');
const BASE='d9339a898a8bd22bdf3dd341b73b7469faf9c9d5';
const WORKFLOW='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_S1_LIFECYCLE_REPAIR.cjs';
const OLD_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const FILES=[WORKFLOW,VALIDATOR].sort();
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,b,c)=>{try{assert.deepEqual(a,b);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const write=o=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(o,null,2)+'\n');};
try{
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');must(base===BASE,`BASE:${base}`);const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();eq(changed,FILES,'BOUNDARY');must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');for(const f of FILES){must(!read(f).includes(marker),`DECLARATION:${f}`);must(!/^(apps|packages|migrations)\//.test(f),`RUNTIME:${f}`);}must(git('rev-parse',`${base}:${OLD_VALIDATOR}`)===git('rev-parse',`HEAD:${OLD_VALIDATOR}`),'OLD_VALIDATOR_DRIFT');must(git('rev-parse',`${base}:${REG}`)===git('rev-parse',`HEAD:${REG}`),'REGISTRY_DRIFT');must(git('rev-parse',`${base}:${TASK}`)===git('rev-parse',`HEAD:${TASK}`),'TASKBOOK_DRIFT');
 const w=read(WORKFLOW);for(const token of ["mode='workflow-repair'","mode='registry-existing-paths-correction'","mode='s1-registry-registration'","mode='candidate-signal'","mode='bootstrap'","mode='unsupported'","Download CAP-09 S0 exact-SHA R2 authority","run-id: 30978738965","artifact-ids: 8919296741","path: acceptance-input/cap09-s0-effective","MCFT_CAP09_S0_EFFECTIVE_ARTIFACT_DIR: acceptance-input/cap09-s0-effective","ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs","MCFT_CAP_09_S1_REGISTRY_REGISTRATION_RESULT.json"])must(w.includes(token),`WORKFLOW_TOKEN:${token}`);
 must(w.includes("if: steps.lifecycle.outputs.mode == 's1-registry-registration'\n        uses: actions/download-artifact@v4"),'S1_DOWNLOAD_CONDITION');must(!w.includes("if: steps.lifecycle.outputs.mode == 'workflow-repair'\n        uses: actions/download-artifact@v4"),'REPAIR_DOWNLOAD_FORBIDDEN');
 const result={status:'PASS',change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_S1_EFFECTIVE_ARTIFACT_INPUT_REPAIR',base_sha:base,head_sha:head,changed_files:FILES,historical_validator_unchanged:true,s1_effective_artifact_run_id:30978738965,s1_effective_artifact_id:8919296741,s1_effective_artifact_input_bound:true,registry_delta:0,candidate_transition:false,implementation_authorized:false,runtime_source_delta:0,first_legal_next_action:'MERGE_REPAIR_THEN_REBUILD_MCFT_CAP_09_S1_REGISTRY_REGISTRATION'};write(result);console.log(JSON.stringify(result,null,2));
}catch(e){const result={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(e?.message||e)};write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;}
