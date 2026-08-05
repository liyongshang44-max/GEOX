#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP_RESULT.json');
const BASE='10bda4db86160b2fe4896f9e5d056d78eda4ca13';
const WORKFLOW='.github/workflows/mcft-cap-09-trusted-registry-bootstrap.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_S1_LIFECYCLE_REPAIR.cjs';
const OLD_VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_TRUSTED_REGISTRY_BOOTSTRAP.cjs';
const REG='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const TASK='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const S1_STATUS='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json';
const FILES=[WORKFLOW,VALIDATOR].sort();
const S1_CANDIDATE=[
 '.github/workflows/mcft-cap-09-s1-adapter-contracts.yml',
 'apps/server/src/runtime/twin_runtime/ports.ts',
 'apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CONFIG-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-BOUNDARY-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-ADAPTER-CONTRACTS-CANDIDATE-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-HARD-ACCEPTANCE-EVIDENCE-V1.json',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-PREDECESSOR-ATTESTATION-CONSUMPTION-V1.json',
 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs',
 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.ts',
].sort();
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const must=(v,c)=>{if(!v)throw new Error(c);};
const eq=(a,b,c)=>{try{assert.deepEqual(a,b);}catch{throw new Error(`${c}:${JSON.stringify(a)}`);}};
const write=o=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(o,null,2)+'\n');};
try{
 const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');
 must(base===BASE,`BASE:${base}`);
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 eq(changed,FILES,'BOUNDARY');
 must(Number(git('rev-list','--count',`${base}..HEAD`))===1,'COMMIT_COUNT');
 const marker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 for(const f of FILES){
  must(!read(f).includes(marker),`DECLARATION:${f}`);
  must(!/^(apps|packages|migrations)\//.test(f),`RUNTIME:${f}`);
 }
 for(const frozen of [OLD_VALIDATOR,REG,TASK,S1_STATUS]){
  must(git('rev-parse',`${base}:${frozen}`)===git('rev-parse',`HEAD:${frozen}`),`FROZEN_DRIFT:${frozen}`);
 }
 const w=read(WORKFLOW);
 for(const token of [
  "mode='workflow-repair'",
  "mode='registry-existing-paths-correction'",
  "mode='s1-registry-registration'",
  "mode='s1-candidate-signal'",
  "mode='candidate-signal'",
  "mode='bootstrap'",
  "mode='unsupported'",
  "Download CAP-09 S0 exact-SHA R2 authority",
  "steps.lifecycle.outputs.mode == 's1-registry-registration' || steps.lifecycle.outputs.mode == 's1-candidate-signal'",
  "run-id: 30978738965",
  "artifact-ids: 8919296741",
  "ACCEPTANCE_MCFT_CAP_09_S1_ADAPTER_CONTRACTS.cjs --trusted-lifecycle",
  "MCFT_CAP_09_S1_ADAPTER_CONTRACTS_RESULT.json",
 ]) must(w.includes(token),`WORKFLOW_TOKEN:${token}`);
 for(const file of S1_CANDIDATE) must(w.includes(`'${file}'`),`S1_CANDIDATE_FILE:${file}`);
 must(!w.includes("if: steps.lifecycle.outputs.mode == 'workflow-repair'\n        uses: actions/download-artifact@v4"),'REPAIR_DOWNLOAD_FORBIDDEN');
 const result={
  status:'PASS',
  change_class:'MCFT_CAP_09_TRUSTED_REGISTRY_S1_CANDIDATE_LIFECYCLE_REPAIR',
  base_sha:base,
  head_sha:head,
  changed_files:FILES,
  s1_candidate_file_count:S1_CANDIDATE.length,
  s1_candidate_mode:'s1-candidate-signal',
  s0_effective_artifact_run_id:30978738965,
  s0_effective_artifact_id:8919296741,
  registry_delta:0,
  candidate_transition:false,
  implementation_authorized:false,
  runtime_source_delta:0,
  first_legal_next_action:'MERGE_REPAIR_THEN_BUILD_MCFT_CAP_09_S1_ADAPTER_CONTRACTS_CANDIDATE',
 };
 write(result);console.log(JSON.stringify(result,null,2));
}catch(e){
 const result={status:'FAIL',base_sha:process.env.MCFT_BASE_SHA||null,error:String(e?.message||e)};
 write(result);console.error(JSON.stringify(result,null,2));process.exitCode=1;
}
