'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const ARCHITECTURE_COMMIT='2f7a065cc95e4a5a2c95411fb381fe5e4479d645';
const ARCHITECTURE_PATH='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md';
const COMPOSITION_PATH='apps/server/src/runtime/twin_runtime/cap08_replay_host_composition_v1.ts';
const PRODUCT_LOADER_PATH='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs';
const QUALIFICATION_CHAIN_PATH='scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports_v2/qualification_product_chain_v2.cjs';
const OUTPUT_PATH='acceptance-output/MCFT_CAP_09_PHASE1_REPLAY_HOST_COMPOSITION_V1_RESULT.json';

function read(relative){
  return fs.readFileSync(path.join(ROOT,relative),'utf8');
}
function requireText(source,text,code){
  assert.ok(source.includes(text),code);
}
function forbidText(source,text,code){
  assert.equal(source.includes(text),false,code);
}

const architecture=read(ARCHITECTURE_PATH);
const composition=read(COMPOSITION_PATH);
const loader=read(PRODUCT_LOADER_PATH);
const qualification=read(QUALIFICATION_CHAIN_PATH);

execFileSync('git',['merge-base','--is-ancestor',ARCHITECTURE_COMMIT,'HEAD'],{cwd:ROOT,stdio:'ignore'});

requireText(architecture,'### Phase 1 — Extract common Runtime composition','PHASE1_ARCHITECTURE_ROUTE_REQUIRED');
requireText(architecture,'CAP08_FROZEN_REPLAY_EQUIVALENCE','PHASE1_EQUIVALENCE_GATE_REQUIRED');
requireText(composition,'createCap08ReplayHostS4AppendForwardServiceV1','FORMAL_REPLAY_HOST_FACTORY_REQUIRED');
requireText(composition,ARCHITECTURE_COMMIT,'FORMAL_REPLAY_HOST_ARCHITECTURE_BINDING_REQUIRED');
requireText(loader,"apps/server/src/runtime/twin_runtime/cap08_replay_host_composition_v1.ts",'CAP08_LOADER_FORMAL_COMPOSITION_REQUIRED');
requireText(loader,'createCap08ReplayHostS4AppendForwardServiceV1','CAP08_LOADER_FACTORY_USAGE_REQUIRED');
requireText(qualification,'QUALIFICATION_V2_REPLAY_HOST_MUST_OWN_RESOLVER_REPOSITORY_BINDING','QUALIFICATION_MUST_VERIFY_FORMAL_BINDING');

forbidText(loader,'this.repository=createS6S4AtomicPersistenceRepositoryV1','ACCEPTANCE_LOADER_MUST_NOT_OWN_REPOSITORY_SEAM');
forbidText(loader,'this.resolver.repository=this.repository','ACCEPTANCE_LOADER_MUST_NOT_OWN_RESOLVER_BINDING');
forbidText(qualification,'this.resolver.repository=this.repository','QUALIFICATION_MUST_NOT_MUTATE_RESOLVER_BINDING');

for(const forbidden of ['GITHUB_RUN_ID','workflow_dispatch','https://','fetch(','R2','S3']){
  forbidText(composition,forbidden,`REPLAY_HOST_COMPOSITION_FORBIDDEN_EXTERNAL_CONTROL:${forbidden}`);
}

const result={
  schema_version:'geox_mcft_cap09_phase1_replay_host_composition_v1_result',
  status:'PASS',
  phase:'PHASE_1A_REPLAY_HOST_COMPOSITION_SEAM',
  architecture_authority_commit:ARCHITECTURE_COMMIT,
  architecture_authority_path:ARCHITECTURE_PATH,
  formal_composition_path:COMPOSITION_PATH,
  cap08_historical_completion_reopened:false,
  cap08_frozen_replay_equivalence_status:'PENDING_PHASE_1B_FRESH_DB_PROOF',
  production_runtime_activation:false,
  production_workflow_activation:false,
  provider_request:false,
  formal_database_mutation:false,
  formal_v5_arm:false,
  graduation_effect:false,
  mcft_cap09_completed:false,
};

const out=path.join(ROOT,OUTPUT_PATH);
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
