#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S1_REGISTRY_REGISTRATION_RESULT.json');
const BASE='c420678f12fba8bdb7841237a5abcde6aa7c6a81';
const WORKFLOW='.github/workflows/mcft-cap-09-s1-registry-registration.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRATION_CANDIDATE_LIFECYCLE_REPAIR.cjs';
const OLD_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json';
const RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-V1.json';
const REG_BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-BOUNDARY-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const TRUSTED='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const FILES=[WORKFLOW,VALIDATOR].sort();
const REGISTRATION=[WORKFLOW,REG,STATUS,RECORD,REG_BOUNDARY,OLD_VALIDATOR].sort();
const CANDIDATE=[
 '.github/workflows/mcft-cap-09-s1-adapter-contracts.yml',
 'apps/server/src/runtime/twin_runtime/ports.ts',
 'apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CONFIG-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-BOUNDARY-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-V1.json',
 STATUS,
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-HARD-ACCEPTANCE-EVIDENCE-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs',
 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.ts',
].sort();
const FROZEN={
 [OLD_VALIDATOR]:'ef51a38f90e970bec4ba8ab9b5c09b429760c200',
 [REG]:'0f88e2453ef697b012e98edda8635d408b21bc7c',
 [STATUS]:'e11b3b2d257214bb9fceea368a24e7909270ab30',
 [RECORD]:'c07104564264b561b4c9c81c09d4a337e5733844',
 [REG_BOUNDARY]:'27a648ab859c7785d97cb5a185f383cdd22ca655',
 [TASK]:'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
 [TRUSTED]:'e2a5710f0da961d81ab48cfb2eb07e674a87b6d5',
};
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const must=(value,code)=>{if(!value)throw new Error(code);};
const eq=(actual,expected,code)=>{try{assert.deepEqual(actual,expected);}catch{throw new Error(`${code}:${JSON.stringify(actual)}`);}};
const write=value=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`);};
try{
 const base=process.env.MCFT_BASE_SHA;
 const head=git('rev-parse','HEAD');
 must(base===BASE,`BASE:${base}`);
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 eq(changed,FILES,'REPAIR_BOUNDARY');
 must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 for(const file of FILES){
  must(!read(file).includes(marker),`DECLARATION:${file}`);
  must(!/^(apps|packages|migrations)\//.test(file),`RUNTIME_PATH:${file}`);
 }
 for(const [file,blob] of Object.entries(FROZEN)){
  must(git('rev-parse',`HEAD:${file}`)===blob,`FROZEN_BLOB:${file}`);
 }
 const workflow=read(WORKFLOW);
 for(const token of [
  "mode='workflow-repair'",
  "mode='s1-registry-registration'",
  "mode='s1-candidate-signal'",
  "mode='unsupported'",
  "steps.lifecycle.outputs.mode == 's1-registry-registration' || steps.lifecycle.outputs.mode == 's1-candidate-signal'",
  'run-id: 30978738965',
  'artifact-ids: 8919296741',
  'ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs',
  'ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs --registration-lifecycle',
  'ACCEPTANCE_MCFT_CAP_09_S1_REGISTRATION_CANDIDATE_LIFECYCLE_REPAIR.cjs',
  'MCFT_CAP_09_S1_ADAPTER_CONTRACTS_RESULT.json',
 ]) must(workflow.includes(token),`WORKFLOW_TOKEN:${token}`);
 for(const file of REGISTRATION) must(workflow.includes(`'${file}'`),`REGISTRATION_FILE:${file}`);
 for(const file of CANDIDATE) must(workflow.includes(`'${file}'`),`CANDIDATE_FILE:${file}`);
 must(!workflow.includes("if: steps.lifecycle.outputs.mode == 'workflow-repair'\n        uses: actions/download-artifact@v4"),'REPAIR_DOWNLOAD_FORBIDDEN');
 const result={
  status:'PASS',
  change_class:'MCFT_CAP_09_S1_REGISTRATION_CANDIDATE_LIFECYCLE_REPAIR',
  base_sha:base,
  head_sha:head,
  changed_files:FILES,
  lifecycle_modes:['workflow-repair','s1-registry-registration','s1-candidate-signal','unsupported'],
  registration_file_count:REGISTRATION.length,
  candidate_file_count:CANDIDATE.length,
  s0_effective_artifact_run_id:30978738965,
  s0_effective_artifact_id:8919296741,
  registry_delta:0,
  candidate_transition:false,
  implementation_authorized:false,
  runtime_source_delta:0,
  migration_delta:0,
  first_legal_next_action:'MERGE_REPAIR_THEN_REBUILD_MCFT_CAP_09_S1_ADAPTER_CONTRACTS_CANDIDATE',
 };
 write(result);console.log(JSON.stringify(result,null,2));
}catch(error){
 const result={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(error?.message||error)};
 write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;
}
