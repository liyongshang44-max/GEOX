#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');

function fail(code, detail = '') { throw new Error(detail ? `${code}:${detail}` : code); }
function assert(value, code, detail = '') { if (!value) fail(code, detail); }
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function checkNode(file) {
  const p = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (p.status !== 0) fail('AM19_QMIG_V4_NODE_CHECK_FAILED', `${file}:${String(p.stderr || p.stdout || '').trim()}`);
}

const ROOT = git('rev-parse', '--show-toplevel');
process.chdir(ROOT);
const V3_HEAD = 'c4c78186d52c8a85c65e44abf736df5c02213fea';
const CLOSURE = 'da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9';
const MAIN = '8f63c498bd48978e2dd525ad57b6b8fdb7ada560';
const RUNTIME = '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a';
const SOURCE_COMMIT = 'f1c43c5c7379748c5609184cd8acc86ff9b1608e';
const SOURCE_BLOB = '26dd21c5a0b7a60fca06e5e4c2ec92289a102a47';
const HELPER_REF = 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py';
const HELPER_BLOB = 'c9bab62c980273ba3669b2bff002d66244916d1b';
const EA4_REF = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py';
const EA4_BLOB = 'ff2ad210387402a74731968e14746210fd2440dd';
const PRODUCT_DECODER_REF = 'apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_raw_bundle_decoder_v1.py';
const PRODUCT_DECODER_BLOB = '876030274005052bb41cffe767c1ba884edddc9c';
const PARENT_DB = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5';

const F = {
  contract: 'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_V1.json',
  spec: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-PERSISTENT-24T-QUALIFICATION-MIGRATION-V1.json',
  binding: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CONTROLLED-CAPTURE-SOURCE-BINDING-V1.json',
  captureV4: 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V4.cjs',
  verifierV4: 'scripts/qualification/VERIFY_GEOX_T4R1_CONTROLLED_CAPTURE_V4.cjs',
  self: 'scripts/governance_acceptance/ACCEPTANCE_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_MIGRATION_V4.cjs',
  legacyEntry: 'scripts/governance_acceptance/ACCEPTANCE_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_MIGRATION_V1.cjs',
};

for (const f of [F.captureV4, F.verifierV4, F.self, F.legacyEntry]) checkNode(f);

const c = json(F.contract);
const s = json(F.spec);
const b = json(F.binding);
const capture = fs.readFileSync(F.captureV4, 'utf8');
const verifier = fs.readFileSync(F.verifierV4, 'utf8');

assert(c.contract_id === 'MCFT_CAP09_AM19_PERSISTENT_24T_V1' && c.contract_version === 1, 'AM19_QMIG_V4_CONTRACT_ID_INVALID');
assert(c.run_class === 'L3_REALITY_COUPLED' && c.authority_ceiling === 'QUALIFICATION_EVIDENCE_PRODUCER_ONLY', 'AM19_QMIG_V4_AUTHORITY_INVALID');
assert(c.github_actions_execution === 'FORBIDDEN', 'AM19_QMIG_V4_GITHUB_EXECUTION_FORBIDDEN_REQUIRED');
assert(c.pilot_base_sha === MAIN && c.closure_semantic_subject_sha === CLOSURE && c.frozen_runtime_sha === RUNTIME, 'AM19_QMIG_V4_SUBJECT_BINDING_INVALID');
assert(c.parent_database_name === PARENT_DB, 'AM19_QMIG_V4_PARENT_DB_INVALID');
assert(c.controlled_capture_adapter_ref === F.captureV4 && c.controlled_capture_verifier_ref === F.verifierV4, 'AM19_QMIG_V4_CAPTURE_BINDING_REQUIRED');
assert(c.rolling_capture_source_commit_sha === SOURCE_COMMIT && c.rolling_capture_source_blob_sha === SOURCE_BLOB, 'AM19_QMIG_V4_SOURCE_AUTHORITY_INVALID');
assert(c.rolling_capture_provider_helper_ref === HELPER_REF && c.rolling_capture_provider_helper_source_commit_sha === SOURCE_COMMIT && c.rolling_capture_provider_helper_blob_sha === HELPER_BLOB, 'AM19_QMIG_V4_HELPER_AUTHORITY_INVALID');
assert(c.rolling_capture_provider_helper_ea4_ref === EA4_REF && c.rolling_capture_provider_helper_ea4_blob_sha === EA4_BLOB, 'AM19_QMIG_V4_EA4_AUTHORITY_INVALID');
assert(c.rolling_capture_provider_helper_binding_policy === 'EXACT_HISTORICAL_HELPER_PLUS_ZERO_DIFF_EA4_DEPENDENCY_V1', 'AM19_QMIG_V4_TRANSITIVE_POLICY_INVALID');
assert(c.target_mismatch_guard_relaxation === 'FORBIDDEN', 'AM19_QMIG_V4_TARGET_GUARD_RELAXATION_FORBIDDEN');
for (const [key, value] of Object.entries(c.non_effects || {})) assert(value === false, 'AM19_QMIG_V4_NON_EFFECT_WEAKENED', key);

assert(b.provider_source_authority.exact_provider_runner_source_commit === SOURCE_COMMIT && b.provider_source_authority.exact_provider_runner_blob === SOURCE_BLOB, 'AM19_QMIG_V4_BINDING_SOURCE_INVALID');
assert(b.transitive_provider_helper_authority.provider_helper_source_commit === SOURCE_COMMIT, 'AM19_QMIG_V4_BINDING_HELPER_COMMIT_INVALID');
assert(b.transitive_provider_helper_authority.exact_provider_helper_blob === HELPER_BLOB, 'AM19_QMIG_V4_BINDING_HELPER_BLOB_INVALID');
assert(b.transitive_provider_helper_authority.historical_ea4_dependency_blob === EA4_BLOB && b.transitive_provider_helper_authority.producer_subject_ea4_dependency_blob === EA4_BLOB, 'AM19_QMIG_V4_BINDING_EA4_ZERO_DIFF_REQUIRED');
assert(b.transitive_provider_helper_authority.mixed_historical_runner_current_helper_execution_forbidden === true, 'AM19_QMIG_V4_MIXED_EXECUTION_FORBIDDEN');
assert(b.transitive_provider_helper_authority.target_mismatch_guard_relaxation_forbidden === true, 'AM19_QMIG_V4_TARGET_GUARD_BINDING_REQUIRED');
assert(b.controlled_adapter.github_actions_execution_required === false && b.controlled_adapter.github_production_owner_revival === false, 'AM19_QMIG_V4_OWNER_BOUNDARY_INVALID');

assert(s.owner === 'MIGRATION_TEAM' && s.adjudication_owner === 'CLOSURE_TEAM', 'AM19_QMIG_V4_AUTHORITY_BOUNDARY_INVALID');
assert(s.controlled_rolling_capture.adapter_ref === F.captureV4 && s.controlled_rolling_capture.verifier_ref === F.verifierV4, 'AM19_QMIG_V4_SPEC_CAPTURE_BINDING_INVALID');
assert(s.controlled_rolling_capture.provider_helper_blob_sha === HELPER_BLOB && s.controlled_rolling_capture.provider_helper_ea4_dependency_blob_sha === EA4_BLOB, 'AM19_QMIG_V4_SPEC_TRANSITIVE_BLOBS_INVALID');
assert(s.controlled_rolling_capture.transitive_execution_closure_policy === 'EXACT_HISTORICAL_HELPER_PLUS_ZERO_DIFF_EA4_DEPENDENCY_V1', 'AM19_QMIG_V4_SPEC_TRANSITIVE_POLICY_INVALID');
assert(s.controlled_rolling_capture.target_mismatch_guard_relaxed === false, 'AM19_QMIG_V4_SPEC_TARGET_GUARD_RELAXED');
assert(s.semantic_preservation.provider_fetch_logic_changed === false && s.semantic_preservation.decoder_logic_changed === false && s.semantic_preservation.target_identity_guard_relaxed === false, 'AM19_QMIG_V4_SEMANTIC_PRESERVATION_INVALID');

assert(git('rev-parse', `${SOURCE_COMMIT}:${c.rolling_capture_source_ref}`) === SOURCE_BLOB, 'AM19_QMIG_V4_HISTORICAL_SOURCE_BLOB_DRIFT');
assert(git('rev-parse', `${SOURCE_COMMIT}:${HELPER_REF}`) === HELPER_BLOB, 'AM19_QMIG_V4_HISTORICAL_HELPER_BLOB_DRIFT');
assert(git('rev-parse', `${SOURCE_COMMIT}:${EA4_REF}`) === EA4_BLOB, 'AM19_QMIG_V4_HISTORICAL_EA4_BLOB_DRIFT');
assert(git('rev-parse', `${MAIN}:${EA4_REF}`) === EA4_BLOB, 'AM19_QMIG_V4_PRODUCER_EA4_BLOB_DRIFT');
assert(git('rev-parse', `${MAIN}:${PRODUCT_DECODER_REF}`) === PRODUCT_DECODER_BLOB, 'AM19_QMIG_V4_PRODUCT_DECODER_BLOB_DRIFT');
assert(spawnSync('git', ['diff', '--quiet', V3_HEAD, 'HEAD', '--', PRODUCT_DECODER_REF], { cwd: ROOT }).status === 0, 'AM19_QMIG_V4_PRODUCT_DECODER_MUTATION_FORBIDDEN');

const decoder = execFileSync('git', ['show', `${MAIN}:${PRODUCT_DECODER_REF}`], { cwd: ROOT, encoding: 'utf8' });
assert(decoder.includes('MCFT_CAP09_GFS_BUNDLE_TARGET_MISMATCH'), 'AM19_QMIG_V4_TARGET_MISMATCH_GUARD_MISSING');
assert(decoder.includes('iso(target).replace(".000Z", "Z")'), 'AM19_QMIG_V4_TARGET_MISMATCH_GUARD_CHANGED');

for (const marker of [
  'HISTORICAL_HELPER_BLOB',
  'HISTORICAL_EA4_BLOB',
  'CONTROLLED_CAPTURE_V4_MATERIALIZED_HELPER_BLOB_MISMATCH',
  'CONTROLLED_CAPTURE_V4_PRODUCER_EA4_BLOB_DRIFT',
  'transitive_provider_helper_binding_verified: true',
  'target_mismatch_guard_relaxed: false',
]) assert(capture.includes(marker), 'AM19_QMIG_V4_CAPTURE_GUARD_MISSING', marker);
for (const marker of [
  'CONTROLLED_CAPTURE_V4_VERIFIER_HELPER_AUTHORITY_BLOB_MISMATCH',
  'CONTROLLED_CAPTURE_V4_VERIFIER_EA4_PRODUCER_ZERO_DIFF_MISMATCH',
  'CONTROLLED_CAPTURE_V4_VERIFIER_REBOUND_SOURCE_DIGEST_MISMATCH',
  'target_mismatch_guard_relaxed: false',
]) assert(verifier.includes(marker), 'AM19_QMIG_V4_VERIFIER_GUARD_MISSING', marker);

const captureSelftest = JSON.parse(execFileSync(process.execPath, [F.captureV4, 'selftest'], { cwd: ROOT, encoding: 'utf8' }));
assert(captureSelftest.status === 'PASS', 'AM19_QMIG_V4_CAPTURE_SELFTEST_REQUIRED');
assert(captureSelftest.historical_provider_helper_blob_sha === HELPER_BLOB, 'AM19_QMIG_V4_CAPTURE_SELFTEST_HELPER_INVALID');
assert(captureSelftest.historical_ea4_dependency_blob_sha === EA4_BLOB && captureSelftest.producer_ea4_dependency_blob_sha === EA4_BLOB, 'AM19_QMIG_V4_CAPTURE_SELFTEST_EA4_INVALID');
assert(captureSelftest.transitive_provider_helper_binding_required === true && captureSelftest.target_mismatch_guard_relaxed === false, 'AM19_QMIG_V4_CAPTURE_SELFTEST_POLICY_INVALID');
assert(captureSelftest.provider_semantics_changed === false && captureSelftest.runtime_semantic_mutation === false && captureSelftest.production_mutation === false, 'AM19_QMIG_V4_CAPTURE_SELFTEST_NON_EFFECT_INVALID');

assert(spawnSync('git', ['merge-base', '--is-ancestor', CLOSURE, 'HEAD'], { cwd: ROOT }).status === 0, 'AM19_QMIG_V4_CLOSURE_ANCESTRY_REQUIRED');
assert(spawnSync('git', ['diff', '--quiet', CLOSURE, 'HEAD', '--', ...c.governed_dependency_refs], { cwd: ROOT }).status === 0, 'AM19_QMIG_V4_GOVERNED_DEPENDENCY_DRIFT_FROM_CLOSURE');

const changed = git('diff', '--name-only', V3_HEAD, 'HEAD').split(/\r?\n/).filter(Boolean).sort();
const allowed = new Set([
  F.contract,
  F.spec,
  F.binding,
  F.captureV4,
  F.verifierV4,
  F.self,
  F.legacyEntry,
]);
assert(changed.every((p) => allowed.has(p)), 'AM19_QMIG_V4_CHANGESET_OUT_OF_SCOPE', JSON.stringify(changed));
assert(!changed.some((p) => p.startsWith('.github/workflows/')), 'AM19_QMIG_V4_WORKFLOW_MUTATION_FORBIDDEN');
assert(!changed.some((p) => p.startsWith('apps/server/')), 'AM19_QMIG_V4_RUNTIME_OR_PRODUCTION_MUTATION_FORBIDDEN');
assert(!changed.some((p) => p.includes('QUALIFICATION-CONTROL-PLANE') || p.includes('QUALIFICATION-EVIDENCE-REGISTRY')), 'AM19_QMIG_V4_QCP_OR_REGISTRY_MUTATION_FORBIDDEN');

process.stdout.write(JSON.stringify({
  schema_version: 'geox_am19_persistent_24t_qualification_migration_acceptance_v4',
  status: 'PASS',
  blocker_target: 'LEGACY_AM19_PERSISTENT_24T',
  closure_semantic_subject_sha: CLOSURE,
  protected_main_capture_subject_sha: MAIN,
  frozen_runtime_sha: RUNTIME,
  parent_database_name: PARENT_DB,
  controlled_capture_adapter: F.captureV4,
  controlled_capture_verifier: F.verifierV4,
  historical_provider_source_commit_sha: SOURCE_COMMIT,
  historical_provider_source_blob_sha: SOURCE_BLOB,
  historical_provider_helper_blob_sha: HELPER_BLOB,
  historical_ea4_dependency_blob_sha: EA4_BLOB,
  producer_ea4_dependency_blob_sha: EA4_BLOB,
  transitive_provider_helper_binding: 'EXACT_HISTORICAL_HELPER_PLUS_ZERO_DIFF_EA4_DEPENDENCY_V1',
  mixed_historical_runner_current_helper_execution: false,
  target_mismatch_guard_relaxed: false,
  product_decoder_mutated: false,
  provider_semantics_changed: false,
  runtime_semantic_mutation: false,
  production_mutation: false,
  qcp_semantics_mutation: false,
  closure_subject_mutation: false,
  github_capture_owner_reactivated: false,
  changed_files: changed,
}, null, 2) + '\n');
