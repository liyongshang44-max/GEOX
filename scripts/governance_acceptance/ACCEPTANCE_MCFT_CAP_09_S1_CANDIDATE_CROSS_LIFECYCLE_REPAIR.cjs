#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const TRUSTED_OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP_RESULT.json');
const REG_OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_S1_REGISTRY_REGISTRATION_RESULT.json');
const BASE='c420678f12fba8bdb7841237a5abcde6aa7c6a81';
const TRUSTED='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const REG_WORKFLOW='.github/workflows/mcft-cap-09-s1-registry-registration.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_CANDIDATE_CROSS_LIFECYCLE_REPAIR.cjs';
const OLD_TRUSTED_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs';
const TRUSTED_REPAIR_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_S1_LIFECYCLE_REPAIR.cjs';
const OLD_REG_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_REGISTRY_REGISTRATION.cjs';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json';
const RECORD='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-V1.json';
const REG_BOUNDARY='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-REGISTRY-REGISTRATION-BOUNDARY-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SIGNAL='docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
const FILES=[TRUSTED,REG_WORKFLOW,VALIDATOR].sort();
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
 [OLD_TRUSTED_VALIDATOR]:'a46f30e6695444f85628a1720f0765a3e1c99329',
 [TRUSTED_REPAIR_VALIDATOR]:'2a6288bb4bac7493d1e61bb91770f293cf0059a1',
 [OLD_REG_VALIDATOR]:'ef51a38f90e970bec4ba8ab9b5c09b429760c200',
 [REG]:'0f88e2453ef697b012e98edda8635d408b21bc7c',
 [STATUS]:'e11b3b2d257214bb9fceea368a24e7909270ab30',
 [RECORD]:'c07104564264b561b4c9c81c09d4a337e5733844',
 [REG_BOUNDARY]:'27a648ab859c7785d97cb5a185f383cdd22ca655',
 [TASK]:'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
 [SIGNAL]:'479f258e58482f3596ef3f1b88e27ef109b99d4b',
};
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const must=(value,code)=>{if(!value)throw new Error(code);};
const eq=(actual,expected,code)=>{try{assert.deepEqual(actual,expected);}catch{throw new Error(`${code}:${JSON.stringify(actual)}`);}};
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);};
try{
 const base=process.env.MCFT_BASE_SHA;
 const head=git('rev-parse','HEAD');
 must(base===BASE,`BASE:${base}`);
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 eq(changed,FILES,'CROSS_REPAIR_BOUNDARY');
 must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 for(const file of FILES){
  must(!read(file).includes(marker),`DECLARATION:${file}`);
  must(!/^(apps|packages|migrations)\//.test(file),`RUNTIME_PATH:${file}`);
 }
 for(const [file,blob] of Object.entries(FROZEN)){
  must(git('rev-parse',`HEAD:${file}`)===blob,`FROZEN_BLOB:${file}`);
 }
 const trusted=read(TRUSTED),registration=read(REG_WORKFLOW);
 for(const [label,workflow] of [['TRUSTED',trusted],['REGISTRATION',registration]]){
  for(const token of [
   "mode='s1-cross-lifecycle-repair'",
   "mode='s1-registry-registration'",
   "mode='s1-candidate-signal'",
   "mode='unsupported'",
   'ACCEPTANCE_MCFT_CAP_09_S1_CANDIDATE_CROSS_LIFECYCLE_REPAIR.cjs',
   'run-id: 30978738965',
   'artifact-ids: 8919296741',
  ]) must(workflow.includes(token),`${label}_TOKEN:${token}`);
  for(const file of FILES) must(workflow.includes(`'${file}'`),`${label}_CROSS_FILE:${file}`);
  for(const file of CANDIDATE) must(workflow.includes(`'${file}'`),`${label}_CANDIDATE_FILE:${file}`);
  must(!workflow.includes("if: steps.lifecycle.outputs.mode == 's1-cross-lifecycle-repair'\n        uses: actions/download-artifact@v4"),`${label}_REPAIR_DOWNLOAD`);
 }
 for(const token of ["mode='workflow-repair'","mode='registry-existing-paths-correction'","mode='candidate-signal'","mode='bootstrap'"]){
  must(trusted.includes(token),`TRUSTED_HISTORICAL_MODE:${token}`);
 }
 const result={
  status:'PASS',
  change_class:'MCFT_CAP_09_S1_CANDIDATE_CROSS_LIFECYCLE_REPAIR',
  base_sha:base,
  head_sha:head,
  changed_files:FILES,
  trusted_lifecycle_modes:['s1-cross-lifecycle-repair','workflow-repair','registry-existing-paths-correction','s1-registry-registration','s1-candidate-signal','candidate-signal','bootstrap','unsupported'],
  registration_lifecycle_modes:['s1-cross-lifecycle-repair','s1-registry-registration','s1-candidate-signal','unsupported'],
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
 write(TRUSTED_OUT,result);
 write(REG_OUT,result);
 console.log(JSON.stringify(result,null,2));
}catch(error){
 const result={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(error?.message||error)};
 write(TRUSTED_OUT,result);write(REG_OUT,result);console.error(JSON.stringify(result,null,2));process.exitCode=1;
}
