'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const CP5_COMMIT='14653ba622bb12261a1ea79f3ea7e42be0b49f92';
const ARCHITECTURE_COMMIT='2f7a065cc95e4a5a2c95411fb381fe5e4479d645';
const CAP08_COMPLETION='67bd71560268046a7fa9a9433ee074ad3999cb71';
const ARCHITECTURE_PATH='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md';
const SERVICE_PATH='apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.ts';
const RESOLVER_PATH='apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts';
const COMPOSITION_PATH='apps/server/src/runtime/twin_runtime/cap08_replay_host_composition_v1.ts';
const LOADER_PATH='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs';
const PRODUCT_CHAIN_PATH='scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs';
const ADAPTER_PATH='scripts/runtime_acceptance/mcft_cap09_phase1_typed_replay_host_product_chain_v1.cjs';
const OUT='acceptance-output/MCFT_CAP_09_PHASE1_TYPED_RUNTIME_COMPOSITION_V1_RESULT.json';

function read(relative){return fs.readFileSync(path.join(ROOT,relative),'utf8');}
function requireText(source,text,code){assert.ok(source.includes(text),code);}
function forbidText(source,text,code){assert.equal(source.includes(text),false,code);}
function blob(ref,file){return execFileSync('git',['rev-parse',`${ref}:${file}`],{cwd:ROOT,encoding:'utf8'}).trim();}

execFileSync('git',['merge-base','--is-ancestor',CP5_COMMIT,'HEAD'],{cwd:ROOT,stdio:'ignore'});
execFileSync('git',['merge-base','--is-ancestor',ARCHITECTURE_COMMIT,'HEAD'],{cwd:ROOT,stdio:'ignore'});

const architecture=read(ARCHITECTURE_PATH);
const service=read(SERVICE_PATH);
const resolver=read(RESOLVER_PATH);
const composition=read(COMPOSITION_PATH);
const adapter=read(ADAPTER_PATH);

requireText(architecture,'### Phase 1 — Extract common Runtime composition','PHASE1_ARCHITECTURE_ROUTE_REQUIRED');
requireText(architecture,'CAP08_FROZEN_REPLAY_EQUIVALENCE','PHASE1_EQUIVALENCE_GATE_REQUIRED');
requireText(service,'Cap08S4AppendForwardDependenciesV1','TYPED_SERVICE_DEPENDENCIES_REQUIRED');
requireText(service,'dependencies: Cap08S4AppendForwardDependenciesV1 = {}','HISTORICAL_DEFAULT_CONSTRUCTOR_REQUIRED');
requireText(service,'if (dependencies.repository || dependencies.resolver)','EXPLICIT_SUCCESSOR_TOPOLOGY_REQUIRED');
requireText(service,'new Cap08S4T17CorrectedPredecessorResolverV1(pool, this.repository)','SHARED_REPOSITORY_RESOLVER_BINDING_REQUIRED');
requireText(resolver,'repository?: Cap08S4AppendForwardInspectRepositoryPortV1','TYPED_RESOLVER_REPOSITORY_PORT_REQUIRED');
requireText(composition,'createCap08ReplayHostS4AppendForwardServiceV1','FORMAL_REPLAY_HOST_FACTORY_REQUIRED');
requireText(composition,ARCHITECTURE_COMMIT,'ARCHITECTURE_COMMIT_BINDING_REQUIRED');
requireText(composition,CP5_COMMIT,'CP5_COMMIT_BINDING_REQUIRED');
requireText(composition,'repository: input.repository','FORMAL_COMPOSITION_REPOSITORY_INJECTION_REQUIRED');
requireText(adapter,'createS6S4AtomicPersistenceRepositoryV1','QUALIFICATION_ATOMIC_REPOSITORY_REQUIRED');
requireText(adapter,'createCap08ReplayHostS4AppendForwardServiceV1','QUALIFICATION_CALLS_FORMAL_COMPOSITION_REQUIRED');

for(const forbidden of [
  'as unknown as',
  'Object.prototype.hasOwnProperty',
  '.repository =',
  '.resolver =',
  '.chainReader =',
  'GITHUB_RUN_ID',
  'workflow_dispatch',
  'fetch(',
  'https://',
  'scripts/runtime_acceptance',
]) forbidText(composition,forbidden,`FORMAL_COMPOSITION_FORBIDDEN:${forbidden}`);

assert.equal(blob('HEAD',LOADER_PATH),blob(CP5_COMMIT,LOADER_PATH),'FROZEN_PRODUCT_LOADER_MUTATED');
assert.equal(blob('HEAD',PRODUCT_CHAIN_PATH),blob(CP5_COMMIT,PRODUCT_CHAIN_PATH),'FROZEN_PRODUCT_CHAIN_MUTATED');
assert.equal(blob(CP5_COMMIT,PRODUCT_CHAIN_PATH),blob(CAP08_COMPLETION,PRODUCT_CHAIN_PATH),'CAP08_PRODUCT_CHAIN_IDENTITY_DRIFT');

const result={
  schema_version:'geox_mcft_cap09_phase1_typed_runtime_composition_v1_result',
  status:'PASS',
  phase:'PHASE_1_TYPED_RUNTIME_COMPOSITION',
  cp5_predecessor_commit:CP5_COMMIT,
  architecture_authority_commit:ARCHITECTURE_COMMIT,
  frozen_cap08_completion_subject:CAP08_COMPLETION,
  formal_composition_path:COMPOSITION_PATH,
  typed_dependency_injection:true,
  private_field_mutation:false,
  frozen_product_loader_unchanged:true,
  frozen_product_chain_unchanged:true,
  canonical_runtime_kernel_reused:true,
  cap08_frozen_replay_equivalence_status:'PENDING_FRESH_DB_PROOF',
  production_runtime_activation:false,
  production_workflow_activation:false,
  provider_request:false,
  formal_database_mutation:false,
  formal_v5_arm:false,
  graduation_effect:false,
  mcft_cap09_completed:false,
};

const out=path.join(ROOT,OUT);
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
