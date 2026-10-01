#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync,spawnSync}=require('node:child_process');
function fail(code,detail=''){throw new Error(detail?`${code}:${detail}`:code)}
function assert(v,code,detail=''){if(!v)fail(code,detail)}
function json(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function git(...a){return execFileSync('git',a,{encoding:'utf8'}).trim()}
function checkNode(f){const p=spawnSync(process.execPath,['--check',f],{encoding:'utf8',windowsHide:true});if(p.status!==0)fail('AM19_QMIG_NODE_CHECK_FAILED',`${f}:${String(p.stderr||p.stdout||'').trim()}`)}
const ROOT=git('rev-parse','--show-toplevel');process.chdir(ROOT);
const BASE='c676420dc81c318e9e0981228ba59545c30b2c9c';
const CLOSURE='da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9';
const MAIN='8f63c498bd48978e2dd525ad57b6b8fdb7ada560';
const RUNTIME='3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a';
const F={
 contract:'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_V1.json',
 runner:'scripts/qualification/RUN_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_V1.cjs',
 adapter:'scripts/qualification/adapters/EXECUTE_MCFT_CAP_09_AM19_PERSISTENT_24T_CONTROLLED_V1.ts',
 capture:'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V1.cjs',
 captureVerifier:'scripts/qualification/VERIFY_GEOX_T4R1_CONTROLLED_CAPTURE_V1.cjs',
 generator:'scripts/qualification/GENERATE_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs',
 verifier:'scripts/qualification/VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs',
 spec:'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-PERSISTENT-24T-QUALIFICATION-MIGRATION-V1.json',
 self:'scripts/governance_acceptance/ACCEPTANCE_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_MIGRATION_V1.cjs',
 hist:'scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts',
 runtime:'apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts'
};
const c=json(F.contract),s=json(F.spec);const runner=fs.readFileSync(F.runner,'utf8'),adapter=fs.readFileSync(F.adapter,'utf8'),capture=fs.readFileSync(F.capture,'utf8'),cv=fs.readFileSync(F.captureVerifier,'utf8'),gen=fs.readFileSync(F.generator,'utf8'),ver=fs.readFileSync(F.verifier,'utf8');
for(const f of [F.runner,F.capture,F.captureVerifier,F.generator,F.verifier])checkNode(f);
assert(c.schema_version==='geox_qualification_contract_v1','AM19_QMIG_CONTRACT_SCHEMA_INVALID');
assert(c.contract_id==='MCFT_CAP09_AM19_PERSISTENT_24T_V1'&&c.contract_version===1,'AM19_QMIG_CONTRACT_ID_OR_VERSION_INVALID');
assert(c.run_class==='L3_REALITY_COUPLED'&&c.authority_ceiling==='QUALIFICATION_EVIDENCE_PRODUCER_ONLY','AM19_QMIG_AUTHORITY_INVALID');
assert(c.github_actions_execution==='FORBIDDEN','AM19_QMIG_GITHUB_EXECUTION_MUST_BE_FORBIDDEN');
assert(c.candidate_policy==='FINALIZED_CONTROLLED_CAPTURE_EXPLICIT_FILE_AND_SOURCE_REF_NO_LATEST_FALLBACK','AM19_QMIG_CANDIDATE_POLICY_INVALID');
assert(c.capture_producer_subject_policy==='EXACT_PROTECTED_MAIN_AT_CAPTURE','AM19_QMIG_CAPTURE_PRODUCER_POLICY_INVALID');
assert(c.capture_policy_identity==='mcft-cap-09-rolling-preboundary-capture','AM19_QMIG_CAPTURE_POLICY_IDENTITY_INVALID');
assert(c.pilot_base_sha===MAIN&&c.closure_semantic_subject_sha===CLOSURE&&c.frozen_runtime_sha===RUNTIME,'AM19_QMIG_SUBJECT_BINDING_INVALID');
assert(c.historical_runner_blob_sha==='ae3e47593ef35cba08946427304a0d3271bb86e9','AM19_QMIG_HISTORICAL_RUNNER_BLOB_INVALID');
assert(c.runtime_source_blob_sha==='5e132eb1b307f908dea6118292fb8e0e9d53084c','AM19_QMIG_RUNTIME_BLOB_INVALID');
assert(c.parent_database_name==='geox_mcft_cap09_s6_formal_t4r1_24h','AM19_QMIG_PARENT_DB_INVALID');
assert(c.accelerated_clock_scope==='REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY','AM19_QMIG_CLOCK_SCOPE_INVALID');
assert(c.controlled_capture_adapter_ref===F.capture,'AM19_QMIG_CAPTURE_ADAPTER_REF_INVALID');
assert(c.historical_capture_workflow_commit_sha==='75d4961279bd64dc1c9dd7d68aac189c72c98846','AM19_QMIG_HIST_CAPTURE_COMMIT_INVALID');
assert(c.historical_capture_workflow_blob_sha==='800cbd91a5d84801405affa6f372c0aa6388b173','AM19_QMIG_HIST_CAPTURE_BLOB_INVALID');
assert(c.rolling_capture_source_blob_sha==='26dd21c5a0b7a60fca06e5e4c2ec92289a102a47','AM19_QMIG_CAPTURE_SOURCE_BLOB_INVALID');
assert(c.rolling_capture_deadline_compat_blob_sha==='9d0ba5913fada1573da954c24b59490376a32ef7','AM19_QMIG_CAPTURE_COMPAT_BLOB_INVALID');
assert(c.rolling_capture_planner_blob_sha==='42f5cc0c3b216d83ebf4471c8ddb544347a0bc8e','AM19_QMIG_CAPTURE_PLANNER_BLOB_INVALID');
assert(c.rolling_capture_assembler_blob_sha==='4e0934fd339bbba09782655869cdefa32ae45c2d','AM19_QMIG_CAPTURE_ASSEMBLER_BLOB_INVALID');
const statuses=['PERSISTENCE_FREE_24T','PERSISTENT_24T','O00_WARM_START','MODE_A','MODE_B','PARTIAL_PAIR','LATE_EXACT_NO_REWRITE','RESTART','MISSED_SLOT_BACKFILL','IDEMPOTENCY','ZERO_PROVIDER_WAIT','SCHEMA_ENV_PREFLIGHT','FULL_CHAIN_READBACK'];
assert(JSON.stringify(c.required_machine_statuses)===JSON.stringify(statuses),'AM19_QMIG_13_MACHINE_STATUSES_REQUIRED');
for(const [k,v] of Object.entries(c.non_effects||{}))assert(v===false,'AM19_QMIG_NON_EFFECT_WEAKENED',k);
assert(s.owner==='MIGRATION_TEAM'&&s.adjudication_owner==='CLOSURE_TEAM','AM19_QMIG_AUTHORITY_BOUNDARY_INVALID');
assert(s.controlled_rolling_capture?.historical_workflow_reactivated===false,'AM19_QMIG_GITHUB_CAPTURE_OWNER_REACTIVATION_FORBIDDEN');
assert(s.controlled_rolling_capture?.causal_retention_reuse_rule_preserved===true&&s.controlled_rolling_capture?.stale_intrarun_retention_delete_before_reretention===true,'AM19_QMIG_CAPTURE_CAUSAL_REUSE_REQUIRED');
assert(s.controlled_rolling_capture?.zero_formal_effect_contract_preserved===true&&s.controlled_rolling_capture?.capture_package_finalized_immutable===true,'AM19_QMIG_CAPTURE_PACKAGE_BOUNDARY_INVALID');
assert(s.semantic_preservation?.fresh_pass_required===true&&s.semantic_preservation?.already_qualified_read_only_accepted===false,'AM19_QMIG_FRESH_PASS_POLICY_INVALID');
assert(runner.includes('AM19_QMIG_FRESH_PASS_REQUIRED')&&runner.includes('AM19_QMIG_GOVERNED_DEPENDENCY_DRIFT_FROM_CLOSURE_SUBJECT'),'AM19_QMIG_RUNNER_GUARDS_REQUIRED');
assert(runner.includes('rehydration.provider_refetch_count !== 0')&&runner.includes('latest_run_fallback_used: false'),'AM19_QMIG_REHYDRATION_OR_FALLBACK_GUARD_REQUIRED');
assert(adapter.includes('SOURCE_BLOB = "ae3e47593ef35cba08946427304a0d3271bb86e9"')&&adapter.includes('GITHUB_ACTIONS_FORBIDDEN'),'AM19_QMIG_PERSISTENT_ADAPTER_BOUNDARY_INVALID');
for(const marker of ['CONTROLLED_CAPTURE_GITHUB_ACTIONS_FORBIDDEN','CONTROLLED_CAPTURE_EXACT_PROTECTED_MAIN_REQUIRED','HISTORICAL_WORKFLOW_BLOB','SOURCE_BLOB','HISTORICAL_COMPAT_BLOB','PLANNER_BLOB','ASSEMBLER_BLOB','GEOX_QUALIFICATION_CAPTURE_RUN_TOKEN','Date.parse(retainedAt) >= Date.parse(retrievedAt)','await this.deleteRetainedRawEvidence(ref);','const MIN_INGRESS_MARGIN_MINUTES = 0','github_owner_reactivated: false','finalizePackage(captureDir)','pnpm.cmd'])assert(capture.includes(marker),'AM19_QMIG_CAPTURE_ADAPTER_GUARD_MISSING',marker);
for(const marker of ['CONTROLLED_CAPTURE_VERIFIER_PACKAGE_DIGEST_RECOMPUTE_MISMATCH','CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_PROVENANCE_MISMATCH','CONTROLLED_CAPTURE_VERIFIER_ADAPTER_BLOB_MISMATCH','CONTROLLED_CAPTURE_VERIFIER_SOURCE_RUNNER_BLOB_MISMATCH','CONTROLLED_CAPTURE_VERIFIER_HISTORICAL_WORKFLOW_BLOB_MISMATCH','github_owner_reactivated: false'])assert(cv.includes(marker),'AM19_QMIG_CAPTURE_VERIFIER_GUARD_MISSING',marker);
assert(gen.includes('qualification_inputs')&&ver.includes('verifyQualificationInputs'),'AM19_QMIG_MANIFEST_INPUT_BINDING_REQUIRED');
assert(ver.includes('QUALIFICATION_VERIFIER_EXTERNAL_INPUT_FILE_DIGEST_MISMATCH')&&ver.includes('QUALIFICATION_VERIFIER_REPOSITORY_INPUT_BLOB_MISMATCH'),'AM19_QMIG_MANIFEST_VERIFIER_INPUT_GUARDS_REQUIRED');
assert(git('rev-parse',`HEAD:${F.hist}`)===c.historical_runner_blob_sha,'AM19_QMIG_HISTORICAL_RUNNER_BLOB_DRIFT');
assert(git('rev-parse',`HEAD:${F.runtime}`)===c.runtime_source_blob_sha&&git('rev-parse',`${RUNTIME}:${F.runtime}`)===c.runtime_source_blob_sha,'AM19_QMIG_RUNTIME_SOURCE_BLOB_DRIFT');
for(const [ref,blob] of [[c.rolling_capture_planner_ref,c.rolling_capture_planner_blob_sha],[c.rolling_capture_source_ref,c.rolling_capture_source_blob_sha],[c.rolling_capture_deadline_compat_ref,c.rolling_capture_deadline_compat_blob_sha],[c.rolling_capture_assembler_ref,c.rolling_capture_assembler_blob_sha]])assert(git('rev-parse',`${MAIN}:${ref}`)===blob,'AM19_QMIG_PRODUCER_CAPTURE_BLOB_DRIFT',ref);
assert(git('rev-parse',`${c.historical_capture_workflow_commit_sha}:${c.historical_capture_workflow_ref}`)===c.historical_capture_workflow_blob_sha,'AM19_QMIG_HISTORICAL_CAPTURE_WORKFLOW_BLOB_DRIFT');
const sentinel=fs.readFileSync(c.historical_capture_workflow_ref,'utf8');assert(sentinel.includes('Phase 6 retirement sentinel')&&sentinel.includes('No production schedule, dispatch, workflow-run, push, or callable trigger remains.'),'AM19_QMIG_RETIRED_GITHUB_OWNER_SENTINEL_REQUIRED');
assert(spawnSync('git',['merge-base','--is-ancestor',CLOSURE,'HEAD'],{cwd:ROOT}).status===0,'AM19_QMIG_CLOSURE_ANCESTRY_REQUIRED');
assert(spawnSync('git',['diff','--quiet',CLOSURE,'HEAD','--',...c.governed_dependency_refs],{cwd:ROOT}).status===0,'AM19_QMIG_GOVERNED_DEPENDENCY_DRIFT_FROM_DA09');
const changed=git('diff','--name-only',BASE,'HEAD').split(/\r?\n/).filter(Boolean).sort();
const allowed=new Set([F.contract,F.runner,F.adapter,F.capture,F.captureVerifier,F.generator,F.verifier,F.spec,F.self]);
assert(changed.length===allowed.size,'AM19_QMIG_CHANGESET_CARDINALITY_INVALID',JSON.stringify(changed));assert(changed.every(p=>allowed.has(p)),'AM19_QMIG_CHANGESET_OUT_OF_SCOPE',JSON.stringify(changed));
assert(!changed.some(p=>p.startsWith('.github/workflows/')),'AM19_QMIG_WORKFLOW_MUTATION_FORBIDDEN');assert(!changed.some(p=>p.startsWith('apps/server/')),'AM19_QMIG_RUNTIME_OR_PRODUCTION_CODE_MUTATION_FORBIDDEN');assert(!changed.some(p=>p.includes('QUALIFICATION-CONTROL-PLANE')||p.includes('QUALIFICATION-EVIDENCE-REGISTRY')),'AM19_QMIG_QCP_OR_REGISTRY_MUTATION_FORBIDDEN');
process.stdout.write(JSON.stringify({schema_version:'geox_am19_persistent_24t_qualification_migration_acceptance_v1',status:'PASS',blocker_target:'LEGACY_AM19_PERSISTENT_24T',migration_base:BASE,closure_semantic_subject_sha:CLOSURE,protected_main_capture_subject_sha:MAIN,frozen_runtime_sha:RUNTIME,contract_id:c.contract_id,run_class:c.run_class,historical_runner_blob_sha:c.historical_runner_blob_sha,controlled_capture_adapter:F.capture,controlled_capture_verifier:F.captureVerifier,controlled_capture_source_blobs_verified:true,github_capture_owner_reactivated:false,governed_dependency_zero_diff_from_closure_subject:true,machine_gate_count:c.required_machine_statuses.length,fresh_pass_required:true,latest_run_fallback_forbidden:true,runtime_semantic_mutation:false,production_mutation:false,qcp_semantics_mutation:false,closure_subject_mutation:false,changed_files:changed},null,2)+'\n');
