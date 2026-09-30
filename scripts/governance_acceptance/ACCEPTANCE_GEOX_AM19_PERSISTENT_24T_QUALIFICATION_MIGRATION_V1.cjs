#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

function fail(code, detail = '') { throw new Error(detail ? `${code}:${detail}` : code); }
function assert(value, code, detail = '') { if (!value) fail(code, detail); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function checkNode(file) {
  const p = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (p.status !== 0) fail('AM19_QMIG_NODE_CHECK_FAILED', `${file}:${String(p.stderr || p.stdout || '').trim()}`);
}

const repoRoot = git('rev-parse', '--show-toplevel');
process.chdir(repoRoot);

const canonicalBase = 'c676420dc81c318e9e0981228ba59545c30b2c9c';
const closureSemantic = 'da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9';
const frozenRuntime = '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a';
const contractRef = 'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_V1.json';
const runnerRef = 'scripts/qualification/RUN_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_V1.cjs';
const adapterRef = 'scripts/qualification/adapters/EXECUTE_MCFT_CAP_09_AM19_PERSISTENT_24T_CONTROLLED_V1.ts';
const generatorRef = 'scripts/qualification/GENERATE_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs';
const verifierRef = 'scripts/qualification/VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs';
const specRef = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-PERSISTENT-24T-QUALIFICATION-MIGRATION-V1.json';
const selfRef = 'scripts/governance_acceptance/ACCEPTANCE_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_MIGRATION_V1.cjs';
const historicalRunnerRef = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts';
const runtimeSourceRef = 'apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts';

const contract = readJson(contractRef);
const spec = readJson(specRef);
const runner = fs.readFileSync(runnerRef, 'utf8');
const adapter = fs.readFileSync(adapterRef, 'utf8');
const generator = fs.readFileSync(generatorRef, 'utf8');
const verifier = fs.readFileSync(verifierRef, 'utf8');

checkNode(runnerRef);
checkNode(generatorRef);
checkNode(verifierRef);

assert(contract.schema_version === 'geox_qualification_contract_v1', 'AM19_QMIG_CONTRACT_SCHEMA_INVALID');
assert(contract.contract_id === 'MCFT_CAP09_AM19_PERSISTENT_24T_V1', 'AM19_QMIG_CONTRACT_ID_INVALID');
assert(contract.contract_version === 1, 'AM19_QMIG_CONTRACT_VERSION_INVALID');
assert(contract.run_class === 'L3_REALITY_COUPLED', 'AM19_QMIG_RUN_CLASS_INVALID');
assert(contract.authority_ceiling === 'QUALIFICATION_EVIDENCE_PRODUCER_ONLY', 'AM19_QMIG_AUTHORITY_CEILING_INVALID');
assert(contract.github_actions_execution === 'FORBIDDEN', 'AM19_QMIG_GITHUB_EXECUTION_MUST_BE_FORBIDDEN');
assert(contract.candidate_policy === 'EXPLICIT_FILE_AND_SOURCE_REF_NO_LATEST_FALLBACK', 'AM19_QMIG_CANDIDATE_POLICY_INVALID');
assert(contract.closure_semantic_subject_sha === closureSemantic, 'AM19_QMIG_CLOSURE_SEMANTIC_SUBJECT_INVALID');
assert(contract.frozen_runtime_sha === frozenRuntime, 'AM19_QMIG_FROZEN_RUNTIME_INVALID');
assert(contract.historical_runner_blob_sha === 'ae3e47593ef35cba08946427304a0d3271bb86e9', 'AM19_QMIG_HISTORICAL_RUNNER_BLOB_INVALID');
assert(contract.parent_database_name === 'geox_mcft_cap09_s6_formal_t4r1_24h', 'AM19_QMIG_T4R1_PARENT_DATABASE_INVALID');
assert(contract.accelerated_clock_scope === 'REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY', 'AM19_QMIG_CLOCK_SCOPE_INVALID');
assert(contract.closure_authoritative_dependency_digest === 'sha256:2ec59117bc25b8848fed8acaeccfe0f20a20fcc0db87ecb7258722bc320263f0', 'AM19_QMIG_CLOSURE_DEPENDENCY_DIGEST_INVALID');

const requiredStatuses = ['PERSISTENCE_FREE_24T','PERSISTENT_24T','O00_WARM_START','MODE_A','MODE_B','PARTIAL_PAIR','LATE_EXACT_NO_REWRITE','RESTART','MISSED_SLOT_BACKFILL','IDEMPOTENCY','ZERO_PROVIDER_WAIT','SCHEMA_ENV_PREFLIGHT','FULL_CHAIN_READBACK'];
assert(JSON.stringify(contract.required_machine_statuses) === JSON.stringify(requiredStatuses), 'AM19_QMIG_13_MACHINE_STATUSES_REQUIRED');
assert(contract.required_machine_statuses.length === 13, 'AM19_QMIG_MACHINE_STATUS_COUNT_INVALID');

const expectedDeps = [
  '.github/workflows/mcft-cap-09-amendment19-persistent-24t-qualification.yml',
  'apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.ts',
  'apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.ts',
  'apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.ts',
  'apps/server/src/runtime/twin_runtime/postgres_external_formal_amendment19_evidence_source_v1.ts'
];
assert(JSON.stringify(contract.governed_dependency_refs) === JSON.stringify(expectedDeps), 'AM19_QMIG_GOVERNED_DEPENDENCY_SET_INVALID');

for (const [key, value] of Object.entries(contract.non_effects ?? {})) assert(value === false, 'AM19_QMIG_NON_EFFECT_WEAKENED', key);
assert(spec.blocker_target === 'LEGACY_AM19_PERSISTENT_24T', 'AM19_QMIG_SPEC_BLOCKER_INVALID');
assert(spec.owner === 'MIGRATION_TEAM' && spec.adjudication_owner === 'CLOSURE_TEAM', 'AM19_QMIG_AUTHORITY_BOUNDARY_INVALID');
assert(spec.semantic_preservation.fresh_pass_required === true && spec.semantic_preservation.already_qualified_read_only_accepted === false, 'AM19_QMIG_FRESH_PASS_POLICY_INVALID');
assert(spec.non_effects.qcp_semantics_mutation === false && spec.non_effects.closure_subject_mutation === false && spec.non_effects.github_lane_superseded === false, 'AM19_QMIG_SPEC_NON_EFFECT_INVALID');

assert(runner.includes("AM19_QMIG_GITHUB_ACTIONS_EXECUTION_FORBIDDEN"), 'AM19_QMIG_RUNNER_GITHUB_FORBIDDEN_GUARD_REQUIRED');
assert(runner.includes("AM19_QMIG_GOVERNED_DEPENDENCY_DRIFT_FROM_CLOSURE_SUBJECT"), 'AM19_QMIG_CLOSURE_DEPENDENCY_ZERO_DIFF_GUARD_REQUIRED');
assert(runner.includes("AM19_QMIG_FRESH_PASS_REQUIRED"), 'AM19_QMIG_FRESH_PASS_GUARD_REQUIRED');
assert(runner.includes("GEOX_AM19_PARENT_DATABASE_CLASS"), 'AM19_QMIG_PARENT_DATABASE_CLASS_GUARD_REQUIRED');
assert(runner.includes("QUALIFICATION_T4R1_NONPRODUCTION"), 'AM19_QMIG_NONPRODUCTION_PARENT_CLASS_REQUIRED');
assert(runner.includes("AM19_QMIG_CANDIDATE_SIDE_EFFECTS_REQUIRED"), 'AM19_QMIG_CANDIDATE_SIDE_EFFECTS_FAIL_CLOSED_REQUIRED');
assert(runner.includes("side[key] !== 0"), 'AM19_QMIG_CANDIDATE_ZERO_EFFECT_EXPLICIT_REQUIRED');
assert(runner.includes("candidate.raw_values_emitted !== false"), 'AM19_QMIG_CANDIDATE_RAW_VALUES_FAIL_CLOSED_REQUIRED');
assert(runner.includes("rehydration.provider_refetch_count !== 0"), 'AM19_QMIG_REHYDRATION_ZERO_REFETCH_REQUIRED');
assert(runner.includes("rehydration.formal_effect !== false") && runner.includes("rehydration.raw_values_emitted !== false"), 'AM19_QMIG_REHYDRATION_ZERO_EFFECT_FAIL_CLOSED_REQUIRED');
assert(runner.includes("FRESH_ACCELERATED_PERSISTENT_24T_DOES_NOT_SUBSTITUTE_FINAL_REAL_CLOCK_O00_O23"), 'AM19_QMIG_FINAL_REAL_CLOCK_LIMITATION_REQUIRED');
assert(runner.includes("latest_run_fallback_used: false"), 'AM19_QMIG_LATEST_FALLBACK_FORBIDDEN');
assert(runner.includes("remote_qualification_database_mutation: true") && runner.includes("production_database_mutation: false"), 'AM19_QMIG_DATABASE_EFFECT_DISCLOSURE_REQUIRED');

assert(adapter.includes('SOURCE_BLOB = "ae3e47593ef35cba08946427304a0d3271bb86e9"'), 'AM19_QMIG_ADAPTER_SOURCE_BLOB_REQUIRED');
assert(adapter.includes('GITHUB_ACTIONS_FORBIDDEN'), 'AM19_QMIG_ADAPTER_GITHUB_EXECUTION_FORBIDDEN');
assert(adapter.includes('EXACT_CONTROLLED_HOST_CHECKOUT'), 'AM19_QMIG_ADAPTER_CONTROLLED_SUBJECT_BINDING_REQUIRED');
assert(adapter.includes('MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA'), 'AM19_QMIG_ADAPTER_PRODUCER_BINDING_REQUIRED');
assert(adapter.includes('geox_mcft_cap09_s6_formal_t4r1_24h'), 'AM19_QMIG_ADAPTER_T4R1_PARENT_REQUIRED');
assert(adapter.includes('MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4') && adapter.includes('MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4'), 'AM19_QMIG_ADAPTER_V4_AUTHORITY_REQUIRED');
assert(adapter.includes("process.platform === \"win32\" && name === \"pnpm\" ? \"pnpm.cmd\""), 'AM19_QMIG_ADAPTER_WINDOWS_PNPM_GUARD_REQUIRED');

assert(generator.includes('qualification_inputs'), 'AM19_QMIG_MANIFEST_EXPLICIT_INPUTS_REQUIRED');
assert(generator.includes('geox_qualification_input_artifacts_v1'), 'AM19_QMIG_MANIFEST_INPUT_SCHEMA_REQUIRED');
assert(verifier.includes('verifyQualificationInputs'), 'AM19_QMIG_VERIFIER_EXPLICIT_INPUT_VERIFICATION_REQUIRED');
assert(verifier.includes('QUALIFICATION_VERIFIER_EXTERNAL_INPUT_FILE_DIGEST_MISMATCH'), 'AM19_QMIG_VERIFIER_EXTERNAL_INPUT_DIGEST_GUARD_REQUIRED');
assert(verifier.includes('QUALIFICATION_VERIFIER_REPOSITORY_INPUT_BLOB_MISMATCH'), 'AM19_QMIG_VERIFIER_REPO_INPUT_BLOB_GUARD_REQUIRED');
assert(verifier.includes('QUALIFICATION_VERIFIER_CLOSURE_SEMANTIC_ANCESTRY_REQUIRED'), 'AM19_QMIG_VERIFIER_CLOSURE_ANCESTRY_REQUIRED');

assert(git('rev-parse', `HEAD:${historicalRunnerRef}`) === contract.historical_runner_blob_sha, 'AM19_QMIG_HISTORICAL_RUNNER_BLOB_DRIFT');
assert(git('rev-parse', `HEAD:${runtimeSourceRef}`) === contract.runtime_source_blob_sha, 'AM19_QMIG_RUNTIME_SOURCE_BLOB_DRIFT');
assert(git('rev-parse', `${frozenRuntime}:${runtimeSourceRef}`) === contract.runtime_source_blob_sha, 'AM19_QMIG_FROZEN_RUNTIME_SOURCE_BLOB_DRIFT');
const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', closureSemantic, 'HEAD'], { cwd: repoRoot });
assert(ancestry.status === 0, 'AM19_QMIG_CLOSURE_SEMANTIC_ANCESTRY_REQUIRED');
const depDiff = spawnSync('git', ['diff', '--quiet', closureSemantic, 'HEAD', '--', ...expectedDeps], { cwd: repoRoot });
assert(depDiff.status === 0, 'AM19_QMIG_GOVERNED_DEPENDENCY_DRIFT_FROM_DA09');

const changed = git('diff', '--name-only', canonicalBase, 'HEAD').split(/\r?\n/).filter(Boolean).sort();
const allowed = new Set([contractRef, runnerRef, adapterRef, generatorRef, verifierRef, specRef, selfRef]);
assert(changed.length === allowed.size, 'AM19_QMIG_CHANGESET_CARDINALITY_INVALID', JSON.stringify(changed));
assert(changed.every((p) => allowed.has(p)), 'AM19_QMIG_CHANGESET_OUT_OF_SCOPE', JSON.stringify(changed));
assert(!changed.some((p) => p.startsWith('.github/workflows/')), 'AM19_QMIG_WORKFLOW_MUTATION_FORBIDDEN');
assert(!changed.some((p) => p.startsWith('apps/server/')), 'AM19_QMIG_RUNTIME_OR_PRODUCTION_CODE_MUTATION_FORBIDDEN');
assert(!changed.some((p) => p.includes('QUALIFICATION-CONTROL-PLANE') || p.includes('QUALIFICATION-EVIDENCE-REGISTRY')), 'AM19_QMIG_QCP_OR_REGISTRY_MUTATION_FORBIDDEN');

process.stdout.write(`${JSON.stringify({
  schema_version: 'geox_am19_persistent_24t_qualification_migration_acceptance_v1',
  status: 'PASS',
  blocker_target: 'LEGACY_AM19_PERSISTENT_24T',
  migration_base: canonicalBase,
  closure_semantic_subject_sha: closureSemantic,
  frozen_runtime_sha: frozenRuntime,
  contract_id: contract.contract_id,
  run_class: contract.run_class,
  historical_runner_blob_sha: contract.historical_runner_blob_sha,
  governed_dependency_zero_diff_from_closure_subject: true,
  machine_gate_count: contract.required_machine_statuses.length,
  fresh_pass_required: true,
  latest_run_fallback_forbidden: true,
  exact_external_input_digest_binding_guarded: true,
  exact_repository_input_blob_binding_guarded: true,
  runtime_semantic_mutation: false,
  production_mutation: false,
  qcp_semantics_mutation: false,
  closure_subject_mutation: false,
  changed_files: changed
}, null, 2)}\n`);
