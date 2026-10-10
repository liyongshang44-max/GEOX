#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');
const CP5_BASE='14653ba622bb12261a1ea79f3ea7e42be0b49f92';
const ARCHITECTURE='2f7a065cc95e4a5a2c95411fb381fe5e4479d645';
const FROZEN_CAP08_COMPLETION='67bd71560268046a7fa9a9433ee074ad3999cb71';
const HISTORICAL_BOUNDARY='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_BOUNDARY.cjs';
const THIS='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_SUCCESSOR_REQUALIFICATION_BOUNDARY_V1.cjs';
const FOCUSED='.github/workflows/mcft-cap-08-s4-late-evidence-append-forward.yml';
const COMPOSITION='apps/server/src/runtime/twin_runtime/cap08_replay_host_composition_v1.ts';
const SERVICE='apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.ts';
const RESOLVER='apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S4_SUCCESSOR_REQUALIFICATION_BOUNDARY_V1_RESULT.json');
const p=n=>`docs/digital_twin/mcft/cap_08/${n}`;
const FROZEN_GOVERNANCE=[
  p('GEOX-MCFT-CAP-08-TASK.md'),
  p('GEOX-MCFT-CAP-08-S4-DELIVERY-STATUS-V1.json'),
  p('GEOX-MCFT-CAP-08-S4-IMPLEMENTATION-V1.json'),
  p('GEOX-MCFT-CAP-08-S4-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json'),
  p('GEOX-MCFT-CAP-08-S4-CONTRACT-V1.json'),
  p('GEOX-MCFT-CAP-08-S4-REVIEW-POLICY-V1.json'),
  p('GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json'),
  p('GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json'),
  p('GEOX-MCFT-CAP-08-S5-CONTRACT-V1.json'),
  'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  '.github/workflows/mcft-cap-08-s4-exact-sha-attestation.yml',
  HISTORICAL_BOUNDARY,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_EXACT_SHA_ATTESTATION.cjs',
  'scripts/governance_acceptance/mcft_cap08_s4_artifact_finalize.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_LATE_CORRECTION_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_APPEND_FORWARD_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s4_acceptance_support_v1.ts',
];
const ALLOWED_S4_SUCCESSOR_DELTA=new Set([SERVICE,RESOLVER,COMPOSITION,FOCUSED,THIS]);

function git(...args){return cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();}
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`);}
function exactCommit(value,code){const text=String(value||'').trim();assert.match(text,/^[0-9a-f]{40}$/,code);return git('rev-parse',`${text}^{commit}`);}
function isS4Sensitive(file){return file===FOCUSED||file===THIS||file===COMPOSITION||file.startsWith('apps/server/src/domain/twin_runtime/cap08_s4_')||file.startsWith('apps/server/src/persistence/twin_runtime/postgres_cap08_s4_')||file.startsWith('apps/server/src/runtime/twin_runtime/cap08_s4_')||file.startsWith('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-')||file.startsWith('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_')||file.startsWith('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_');}

try{
  const base=exactCommit(process.env.MCFT_BASE_SHA,'S4_SUCCESSOR_BASE_SHA_INVALID');
  assert.equal(base,CP5_BASE,'S4_SUCCESSOR_BASE_MISMATCH');
  assert.equal(git('merge-base',base,'HEAD'),base,'S4_SUCCESSOR_BASE_NOT_ANCESTOR');
  assert.equal(git('merge-base',ARCHITECTURE,'HEAD'),ARCHITECTURE,'S4_SUCCESSOR_ARCHITECTURE_NOT_ANCESTOR');
  assert.equal(git('merge-base',FROZEN_CAP08_COMPLETION,'HEAD'),FROZEN_CAP08_COMPLETION,'S4_SUCCESSOR_CAP08_COMPLETION_NOT_ANCESTOR');

  for(const file of FROZEN_GOVERNANCE){
    assert.equal(git('rev-parse',`HEAD:${file}`),git('rev-parse',`${base}:${file}`),`S4_SUCCESSOR_FROZEN_AUTHORITY_DRIFT:${file}`);
  }

  const raw=git('diff','--name-only',`${base}...HEAD`);
  const changed=raw?raw.split(/\r?\n/).filter(Boolean).sort():[];
  const sensitive=changed.filter(isS4Sensitive);
  const forbiddenSensitive=sensitive.filter(file=>!ALLOWED_S4_SUCCESSOR_DELTA.has(file));
  assert.deepEqual(forbiddenSensitive,[],'S4_SUCCESSOR_UNDECLARED_SENSITIVE_PATH');
  for(const required of [SERVICE,RESOLVER,COMPOSITION,FOCUSED,THIS]) assert.equal(sensitive.includes(required),true,`S4_SUCCESSOR_REQUIRED_DELTA_MISSING:${required}`);

  const diffCheck=cp.spawnSync('git',['diff','--check',`${base}...HEAD`,'--',...sensitive],{cwd:ROOT,encoding:'utf8'});
  assert.equal(diffCheck.status,0,`S4_SUCCESSOR_DIFF_CHECK_FAILED:${String(diffCheck.stdout||'')}${String(diffCheck.stderr||'')}`);

  const service=fs.readFileSync(path.join(ROOT,SERVICE),'utf8');
  const resolver=fs.readFileSync(path.join(ROOT,RESOLVER),'utf8');
  const composition=fs.readFileSync(path.join(ROOT,COMPOSITION),'utf8');
  assert.ok(service.includes('Cap08S4AppendForwardDependenciesV1'),'S4_SUCCESSOR_TYPED_SERVICE_DEPENDENCIES_REQUIRED');
  assert.ok(service.includes('dependencies: Cap08S4AppendForwardDependenciesV1 = {}'),'S4_SUCCESSOR_HISTORICAL_DEFAULT_CONSTRUCTOR_REQUIRED');
  assert.ok(resolver.includes('repository?: Cap08S4AppendForwardInspectRepositoryPortV1'),'S4_SUCCESSOR_TYPED_RESOLVER_PORT_REQUIRED');
  assert.ok(composition.includes('createCap08ReplayHostS4AppendForwardServiceV1'),'S4_SUCCESSOR_FORMAL_COMPOSITION_REQUIRED');
  assert.equal(composition.includes('as unknown as'),false,'S4_SUCCESSOR_PRIVATE_MUTATION_CAST_FORBIDDEN');

  const result={
    schema_version:'geox_mcft_cap08_s4_successor_requalification_boundary_v1',
    status:'PASS',
    classification:'PHASE1_TYPED_SUCCESSOR_REQUALIFICATION',
    governed_base_sha:base,
    candidate_sha:git('rev-parse','HEAD'),
    architecture_authority_commit:ARCHITECTURE,
    frozen_cap08_completion_subject:FROZEN_CAP08_COMPLETION,
    historical_s4_authority_unchanged:true,
    historical_s4_boundary_unchanged:true,
    sensitive_changed_files:sensitive,
    private_field_mutation:false,
    full_s4_runtime_requalification_required:true,
    production_runtime_source_authorized:false,
    provider_request:false,
    formal_database_mutation:false,
    graduation_effect:false,
    mcft_cap09_completed:false,
  };
  write(result);
  console.log(JSON.stringify(result));
}catch(error){
  const result={schema_version:'geox_mcft_cap08_s4_successor_requalification_boundary_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)};
  write(result);
  console.error(error);
  process.exitCode=1;
}
