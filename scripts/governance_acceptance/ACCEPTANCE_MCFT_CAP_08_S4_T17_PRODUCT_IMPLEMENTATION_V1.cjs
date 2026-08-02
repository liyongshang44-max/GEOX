#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');
const DOC='docs/digital_twin/mcft/cap_08';
const BOUNDARY=`${DOC}/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-IMPLEMENTATION-BOUNDARY-V1.json`;
const CANDIDATE=`${DOC}/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-IMPLEMENTATION-CANDIDATE-V1.json`;
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_STATIC_RESULT.json');

const read=(pathname)=>fs.readFileSync(path.join(ROOT,pathname),'utf8');
const readJson=(pathname)=>JSON.parse(read(pathname));
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
function canonical(value){
  if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function semanticDigest(value){const copy=structuredClone(value);delete copy.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;}
function requireTokens(source,tokens,code){for(const token of tokens)assert.equal(source.includes(token),true,`${code}:${token}`);}

const boundary=readJson(BOUNDARY);
const candidate=readJson(CANDIDATE);
assert.equal(boundary.semantic_digest,semanticDigest(boundary));
assert.equal(candidate.semantic_digest,semanticDigest(candidate));
const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
assert.equal(base,boundary.base_main_sha);

const parents=git('rev-list','--parents','-n','1','HEAD').split(/\s+/);
let exactCandidate='HEAD';
if(parents.length===3){assert.equal(parents[1],base,'PR_MERGE_REF_BASE_PARENT');exactCandidate=parents[2];}
else assert.equal(parents.length,2,'CANDIDATE_PARENT_CARDINALITY');
exactCandidate=git('rev-parse',exactCandidate);
assert.equal(git('merge-base',base,exactCandidate),base);
assert.equal(git('rev-list','--count',`${base}..${exactCandidate}`),'1');
assert.equal(git('diff','--check',`${base}...${exactCandidate}`),'');
const changed=git('diff','--name-only',`${base}...${exactCandidate}`).split(/\r?\n/).filter(Boolean).sort();
assert.deepEqual(changed,[...boundary.changed_files].sort());
assert.equal(changed.length,boundary.changed_file_count);
const blob=(pathname)=>git('rev-parse',`${exactCandidate}:${pathname}`);

assert.equal(boundary.formal_authority_chain_status,'PAUSED');
assert.equal(boundary.v10_authorized,false);
assert.equal(boundary.formal_database_execution_authorized,false);
assert.equal(boundary.qualification_only_carrier_changed,false);
assert.equal(candidate.implementation_effective,false);
assert.equal(candidate.stage_1a_end_to_end_closure_established,false);
assert.equal(candidate.s6_candidate_implemented,false);

assert.deepEqual(changed.filter(pathname=>
  pathname.includes('qualification_ports')
  ||/EXECUTION-AUTHORITY-V\d+\.json$/.test(pathname)
  ||pathname.endsWith('postgres_forecast_scenario_repository_v1.ts')
  ||pathname.endsWith('postgres_cap08_s4_append_forward_repository_v1.ts')
  ||pathname.endsWith('cap08_s4_t17_corrected_predecessor_resolver_v1.ts')
),[]);
assert.equal(blob('apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts'),'8e29a72526f92b7094aae4a66a1ef3ceb62e6ea1');
assert.equal(blob('apps/server/src/persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.ts'),'7739aced9c15177a213a3859b7e911548b914ce6');
assert.equal(blob('apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts'),'de3bf12578614d462fad4590ca90f9e892ac690f');
assert.equal(blob('apps/server/src/domain/twin_runtime/cap08_t17_transition_contracts_v1.ts'),'ed3723adfa8d8666f1ed107661878fe4570f389f');

requireTokens(read('apps/server/db/migrations/2026_08_01_mcft_cap08_s4_t17_transition_persistence.sql'),[
  'twin_cap08_s4_t17_transition_guard_v1','correction_authority_ref','expected_latest_base jsonb',
  'corrected_computation_predecessor jsonb','committed_t17 jsonb','GRANT SELECT, INSERT'
],'MIGRATION');
const repositorySource=read('apps/server/src/persistence/twin_runtime/postgres_cap08_t17_transition_repository_v1.ts');
requireTokens(repositorySource,[
  'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE','pg_advisory_xact_lock',
  'CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1','after_replay_classification',
  'classifyCap08S4T17ExistingTransitionV1','latestProjectionStateV1',
  'STATE_LATEST_CAS_CONFLICT','CHECKPOINT_CAS_CONFLICT',
  'FORECAST_RESULT_CAS_CONFLICT','FORECAST_SUCCESS_CAS_CONFLICT','after_transition_witness_fact',
  'before_exact_readback','EXISTING_IDEMPOTENT_SUCCESS'
],'REPOSITORY');
assert.match(repositorySource,/return\s+classifyCap08S4T17ExistingTransitionV1\(\{\s*record_set_presence:\s*record\.presence,\s*witness_presence:\s*witness\.presence,\s*transition_guard_presence:\s*guard\.presence,\s*latest_projection_state:\s*latest\s*\}\);/s,'REPOSITORY:CLASSIFIER_BINDING');
const transitionContractSource=read('apps/server/src/domain/twin_runtime/cap08_t17_transition_contracts_v1.ts');
requireTokens(transitionContractSource,[
  'export function classifyCap08S4T17ExistingTransitionV1',
  'record_set_presence: "ABSENT" | "EXACT" | "CONFLICT"',
  'witness_presence: "ABSENT" | "EXACT" | "CONFLICT"',
  'transition_guard_presence: "ABSENT" | "EXACT" | "CONFLICT"',
  'latest_projection_state: "BASE_T16" | "EXACT_T17" | "OTHER"',
  'POST_TRANSITION_PROJECTION_DIVERGENCE'
],'TRANSITION_CONTRACT');
assert.match(transitionContractSource,/if\s*\(input\.latest_projection_state\s*!==\s*"EXACT_T17"\)\s*\{\s*return\s*"POST_TRANSITION_PROJECTION_DIVERGENCE";\s*\}/s,'TRANSITION_CONTRACT:PROJECTION_DIVERGENCE_CLASSIFICATION');
requireTokens(read('apps/server/src/runtime/twin_runtime/cap08_t17_formal_a1_preflight_v1.ts'),[
  'selectCap04FutureForcingOutcomeV1','assertCap08S4T17FormalA1OutcomeV1',
  'FORMAL_DATASET_INVARIANT_VIOLATION','validateCap08S4T17FormalA1ProofV1'
],'PREFLIGHT');
requireTokens(read('apps/server/src/runtime/twin_runtime/cap08_t17_authority_bound_forecast_resolver_v1.ts'),[
  'Cap08S4T17AuthorityBoundForecastResolverV1','resolvePersistenceContext',
  'CAP08_S4_T17_BASE_FORECAST_BINDING_MISMATCH','CAP08_S4_T17_CORRECTED_FORECAST_BINDING_MISMATCH',
  'return correctedMatches[0]'
],'FORECAST_RESOLVER');
requireTokens(read('apps/server/src/runtime/twin_runtime/cap08_t17_transition_persistence_adapter_v1.ts'),[
  'materializeCap04TickRecoveryAuthorityV1','materializedRecordSet',
  'CAP08_S4_T17_GENERIC_HANDOFF_NOT_CORRECTED_PREDECESSOR',
  'deriveCap08S4T17TransitionWitnessV1','commitAuthorityBoundA1Transition',
  'if (!context) return this.ordinary.commitARecordSet(input)'
],'ADAPTER');
requireTokens(read('apps/server/src/runtime/twin_runtime/cap08_t17_transition_tick_service_v1.ts'),[
  'CAP08_S4_T17_EXPLICIT_ROUTE_REQUIRED','buildCap08S4T17FormalA1ProofV1',
  'this.adapter.activate(context)','Cap08S4T17ExplicitRoutingTickServiceV1',
  'if (input.logical_time !== t17) return this.ordinary.executeOneTick(input)'
],'SERVICE');
requireTokens(read('scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/final_evidence_source_v1.cjs'),[
  'forecastResolver=null','Cap08S4T17AuthorityBoundForecastResolverV1',
  'PostgresCap08S4T17TransitionRepositoryV1','resolveExactForecast','candidates'
],'FORMAL_EVIDENCE');
requireTokens(read('scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs'),[
  'cap08_t17_authority_bound_forecast_resolver_v1.ts','postgres_cap08_t17_transition_repository_v1.ts',
  'S6_S4_RESOLVER_REPOSITORY_SEAM_REQUIRED','this.resolver.repository=this.repository'
],'PRODUCT_LOADER');
requireTokens(read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_DB.ts'),[
  'CONTROLLED_40001','CONTROLLED_ROLLBACK_AFTER_WITNESS','POST_TRANSITION_PROJECTION_DIVERGENCE',
  'EXISTING_IDEMPOTENT_SUCCESS','latest_remained_base_t16','establishT16AndS4V1'
],'DB_ACCEPTANCE');

fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
const result={schema_version:'geox_mcft_cap08_s4_t17_product_implementation_static_result_v1',status:'PASS',base_main_sha:base,exact_head_sha:exactCandidate,changed_file_count:changed.length,generic_cap04_source_unchanged:true,historical_s4_source_unchanged:true,projection_divergence_classifier_bound:true,cap04_recovery_authority_materialized_before_witness:true,authority_bound_forecast_selection:true,formal_evidence_source_integrated:true,dedicated_transition_guard:true,a1_prelease_recomputation:true,four_pointer_cas:true,replay_first:true,bounded_40001_retry:true,formal_authority_chain_status:'PAUSED'};
fs.writeFileSync(OUTPUT,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
