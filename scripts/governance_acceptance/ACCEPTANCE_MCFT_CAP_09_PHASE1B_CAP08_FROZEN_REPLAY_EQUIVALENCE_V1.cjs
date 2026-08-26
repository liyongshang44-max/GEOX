'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const FROZEN_CAP08_COMPLETION_SUBJECT='67bd71560268046a7fa9a9433ee074ad3999cb71';
const PHASE1A_REQUIRED_ANCESTOR='7ea5b4c5c1fb5cd669d75316de140097b41a12de';
const PREDECESSOR=path.join(ROOT,'acceptance-output/MCFT_CAP_09_PHASE1B_CAP08_PREDECESSOR_RESULT.json');
const SUCCESSOR=path.join(ROOT,'acceptance-output/MCFT_CAP_09_PHASE1B_CAP08_SUCCESSOR_RESULT.json');
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_PHASE1B_CAP08_FROZEN_REPLAY_EQUIVALENCE_V1_RESULT.json');

function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value){return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;}
function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(result){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(result,null,2)}\n`);}

try{
  execFileSync('git',['merge-base','--is-ancestor',PHASE1A_REQUIRED_ANCESTOR,'HEAD'],{cwd:ROOT,stdio:'ignore'});
  const predecessor=read(PREDECESSOR);
  const successor=read(SUCCESSOR);
  for(const [label,result] of [['PREDECESSOR',predecessor],['SUCCESSOR',successor]]){
    assert.equal(result.status,'PASS',`${label}_LANE_NOT_PASS`);
    assert.equal(result.frozen_cap08_completion_subject,FROZEN_CAP08_COMPLETION_SUBJECT,`${label}_FROZEN_SUBJECT_DRIFT`);
    assert.equal(result.historical_cap08_authority_reused,false,`${label}_HISTORICAL_AUTHORITY_REUSE_FORBIDDEN`);
    assert.equal(result.historical_cap08_completion_reopened,false,`${label}_CAP08_COMPLETION_REOPEN_FORBIDDEN`);
    assert.equal(result.provider_request,false,`${label}_PROVIDER_REQUEST_FORBIDDEN`);
    assert.equal(result.production_runtime_activation,false,`${label}_PRODUCTION_ACTIVATION_FORBIDDEN`);
    assert.equal(result.formal_database_mutation,false,`${label}_FORMAL_DB_MUTATION_FORBIDDEN`);
    assert.equal(result.formal_v5_arm,false,`${label}_FORMAL_V5_ARM_FORBIDDEN`);
    assert.equal(result.graduation_effect,false,`${label}_GRADUATION_EFFECT_FORBIDDEN`);
    assert.equal(result.mcft_cap09_completed,false,`${label}_CAP09_COMPLETION_FORBIDDEN`);
    assert.equal(result.semantic_manifest.canonical_receipt_count,153,`${label}_RECEIPT_COUNT`);
    assert.equal(result.semantic_manifest.recovery.length,7,`${label}_RECOVERY_VECTOR_COUNT`);
    assert.equal(result.semantic_manifest.cap07_surfaces.length,11,`${label}_CAP07_VARIANT_COUNT`);
    assert.equal(result.semantic_manifest_digest,digest(result.semantic_manifest),`${label}_MANIFEST_DIGEST_INVALID`);
  }
  assert.equal(predecessor.lane,'PREDECESSOR','PREDECESSOR_LANE_ID');
  assert.equal(successor.lane,'SUCCESSOR','SUCCESSOR_LANE_ID');
  assert.equal(predecessor.root_revision,FROZEN_CAP08_COMPLETION_SUBJECT,'PREDECESSOR_MUST_BE_EXACT_CAP08_COMPLETION_SUBJECT');
  assert.equal(successor.root_revision,execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),'SUCCESSOR_MUST_BE_EXACT_HEAD');
  assert.notEqual(successor.root_revision,predecessor.root_revision,'SUCCESSOR_MUST_BE_DISTINCT_REVISION');

  const predecessorCanonical=canonical(predecessor.semantic_manifest);
  const successorCanonical=canonical(successor.semantic_manifest);
  assert.equal(successorCanonical,predecessorCanonical,'CAP08_FROZEN_REPLAY_SEMANTIC_MANIFEST_MISMATCH');
  assert.equal(successor.semantic_manifest_digest,predecessor.semantic_manifest_digest,'CAP08_FROZEN_REPLAY_DIGEST_MISMATCH');

  const result={
    schema_version:'geox_mcft_cap09_phase1b_cap08_frozen_replay_equivalence_v1_result',
    status:'PASS',
    gate:'CAP08_FROZEN_REPLAY_EQUIVALENCE',
    frozen_cap08_completion_subject:FROZEN_CAP08_COMPLETION_SUBJECT,
    successor_subject:successor.root_revision,
    shared_semantic_manifest_digest:successor.semantic_manifest_digest,
    semantic_equivalence:true,
    difference_count:0,
    independent_disposable_databases:true,
    canonical_receipt_count:153,
    recovery_vector_count:7,
    cap07_surface_definition_count:10,
    cap07_request_variant_count:11,
    historical_cap08_completion_reopened:false,
    historical_cap08_authority_reused:false,
    production_runtime_activation:false,
    provider_request:false,
    formal_database_mutation:false,
    formal_v5_arm:false,
    graduation_effect:false,
    mcft_cap09_completed:false,
  };
  write(result);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  const result={
    schema_version:'geox_mcft_cap09_phase1b_cap08_frozen_replay_equivalence_v1_result',
    status:'FAIL',
    gate:'CAP08_FROZEN_REPLAY_EQUIVALENCE',
    frozen_cap08_completion_subject:FROZEN_CAP08_COMPLETION_SUBJECT,
    semantic_equivalence:false,
    historical_cap08_completion_reopened:false,
    historical_cap08_authority_reused:false,
    production_runtime_activation:false,
    provider_request:false,
    formal_database_mutation:false,
    formal_v5_arm:false,
    graduation_effect:false,
    mcft_cap09_completed:false,
    error:error instanceof Error?(error.stack||error.message):String(error),
  };
  write(result);
  console.error(error);
  process.exitCode=1;
}
