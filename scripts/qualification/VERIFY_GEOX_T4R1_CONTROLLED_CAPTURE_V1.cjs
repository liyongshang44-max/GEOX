#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonicalize(value[k])]));
  return value;
}
function canonicalJson(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function sha256Buffer(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function sha256File(file) { return sha256Buffer(fs.readFileSync(file)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function output(command, args, options = {}) {
  const p = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error(`${options.code ?? 'CONTROLLED_CAPTURE_VERIFIER_COMMAND_FAILED'}:${command}:${p.status}:${String(p.stderr ?? '').trim()}`);
  return String(p.stdout ?? '').trim();
}
function requireEqual(actual, expected, code) { if (actual !== expected) throw new Error(`${code}:${actual}:${expected}`); }
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`CONTROLLED_CAPTURE_VERIFIER_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`CONTROLLED_CAPTURE_VERIFIER_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  if (!args['capture-dir']) throw new Error('CONTROLLED_CAPTURE_VERIFIER_CAPTURE_DIR_REQUIRED');
  return args;
}
function walkFiles(root) {
  const out = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).replaceAll('\\', '/');
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) out.push({ path: rel, sha256: sha256File(full), bytes: stat.size });
    }
  }
  walk(root);
  return out;
}
function gitBlob(repoRoot, commit, ref) {
  return output('git', ['rev-parse', `${commit}:${ref}`], { cwd: repoRoot, code: `CONTROLLED_CAPTURE_VERIFIER_GIT_BLOB_MISSING:${ref}` });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const captureDir = path.resolve(args['capture-dir']);
  const repoRoot = path.resolve(args.repo ?? output('git', ['rev-parse', '--show-toplevel'], { code: 'CONTROLLED_CAPTURE_VERIFIER_REPOSITORY_REQUIRED' }));
  const finalized = readJson(path.join(captureDir, 'FINALIZED.json'));
  const digests = readJson(path.join(captureDir, 'digests.json'));
  const result = readJson(path.join(captureDir, 'result.json'));
  const environment = readJson(path.join(captureDir, 'environment-manifest.json'));
  const provenance = readJson(path.join(captureDir, 'provenance', 'git.json'));
  const candidatePath = path.join(captureDir, 'candidate', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json');
  const candidate = readJson(candidatePath);

  if (finalized.finalized !== true) throw new Error('CONTROLLED_CAPTURE_VERIFIER_PACKAGE_NOT_FINALIZED');
  requireEqual(finalized.evidence_package_digest, digests.evidence_package_digest, 'CONTROLLED_CAPTURE_VERIFIER_PACKAGE_DECLARATION_MISMATCH');
  const actual = walkFiles(captureDir).filter((e) => !['digests.json', 'FINALIZED.json'].includes(e.path)).sort((a, b) => a.path.localeCompare(b.path));
  const expected = [...digests.entries].sort((a, b) => a.path.localeCompare(b.path));
  requireEqual(canonicalJson(actual), canonicalJson(expected), 'CONTROLLED_CAPTURE_VERIFIER_PACKAGE_CONTENT_MISMATCH');
  requireEqual(sha256Buffer(canonicalJson(expected)), finalized.evidence_package_digest, 'CONTROLLED_CAPTURE_VERIFIER_PACKAGE_DIGEST_RECOMPUTE_MISMATCH');

  if (result.status !== 'PASS') throw new Error('CONTROLLED_CAPTURE_VERIFIER_NONPASS_CAPTURE_FORBIDDEN');
  if (result.runtime_mutated !== false || result.production_mutation !== false || result.formal_effect !== false || result.github_owner_reactivated !== false) {
    throw new Error('CONTROLLED_CAPTURE_VERIFIER_NON_EFFECT_VIOLATION');
  }
  if (!/^[0-9a-f]{40}$/.test(String(result.producer_subject_sha ?? '')) || !/^[0-9a-f]{40}$/.test(String(result.launcher_subject_sha ?? ''))) throw new Error('CONTROLLED_CAPTURE_VERIFIER_SHA_REQUIRED');
  requireEqual(result.producer_subject_sha, result.origin_main_sha_at_capture, 'CONTROLLED_CAPTURE_VERIFIER_RECORDED_EXACT_MAIN_BINDING_MISMATCH');
  requireEqual(environment.producer_subject_sha, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_ENV_PRODUCER_MISMATCH');
  requireEqual(environment.launcher_subject_sha, result.launcher_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_ENV_LAUNCHER_MISMATCH');
  requireEqual(provenance.producer_subject_sha, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_PROVENANCE_PRODUCER_MISMATCH');
  requireEqual(provenance.origin_main_sha_at_capture, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_PROVENANCE_EXACT_MAIN_MISMATCH');
  requireEqual(provenance.launcher_subject_sha, result.launcher_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_PROVENANCE_LAUNCHER_MISMATCH');
  if (provenance.github_actions_execution !== false || provenance.producer_exact_main_verified !== true || provenance.zero_formal_effect_verified !== true) throw new Error('CONTROLLED_CAPTURE_VERIFIER_PROVENANCE_POLICY_INVALID');
  if (provenance.policy_identity !== 'mcft-cap-09-rolling-preboundary-capture' || provenance.namespace_mode !== 'TARGET_PLUS_CONTROLLED_CAPTURE_RUN_TOKEN') throw new Error('CONTROLLED_CAPTURE_VERIFIER_POLICY_IDENTITY_INVALID');

  if (candidate.schema_version !== 'geox_mcft_cap09_rolling_preboundary_candidate_v1' || candidate.status !== 'PASS' || candidate.temporal_authority !== 'PROVIDER_AVAILABILITY_WATERMARK_V1') throw new Error('CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_AUTHORITY_INVALID');
  requireEqual(candidate.producer_subject_sha, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_PRODUCER_MISMATCH');
  requireEqual(candidate.subject_sha, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_SUBJECT_MISMATCH');
  requireEqual(sha256File(candidatePath), result.candidate_digest, 'CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_DIGEST_MISMATCH');
  requireEqual(canonicalJson(candidate.controlled_capture_provenance), canonicalJson(provenance), 'CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_PROVENANCE_MISMATCH');
  const side = candidate.side_effects;
  if (!side) throw new Error('CONTROLLED_CAPTURE_VERIFIER_CANDIDATE_SIDE_EFFECTS_REQUIRED');
  for (const key of ['formal_database_write_count', 'formal_r2_prefix_write_count', 'scheduler_write_count', 'runtime_write_count']) if (side[key] !== 0) throw new Error(`CONTROLLED_CAPTURE_VERIFIER_ZERO_FORMAL_EFFECT_REQUIRED:${key}`);
  if (side.crop_authority_effect !== 'NONE' || side.formal_effect !== false || candidate.raw_values_emitted !== false) throw new Error('CONTROLLED_CAPTURE_VERIFIER_FORMAL_EFFECT_FORBIDDEN');
  if (candidate.consumption_contract?.producer_exact_main_capture_proof_required !== true || candidate.consumption_contract?.consumer_subject_may_differ_from_producer !== true) throw new Error('CONTROLLED_CAPTURE_VERIFIER_CONSUMPTION_CONTRACT_INVALID');

  for (const sha of [result.producer_subject_sha, result.launcher_subject_sha, provenance.historical_workflow_commit_sha]) {
    output('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: repoRoot, code: `CONTROLLED_CAPTURE_VERIFIER_COMMIT_MISSING:${sha}` });
  }
  requireEqual(gitBlob(repoRoot, result.launcher_subject_sha, provenance.capture_adapter_ref), provenance.capture_adapter_git_blob_sha, 'CONTROLLED_CAPTURE_VERIFIER_ADAPTER_BLOB_MISMATCH');
  requireEqual(gitBlob(repoRoot, result.producer_subject_sha, provenance.source_runner_ref), provenance.source_runner_git_blob_sha, 'CONTROLLED_CAPTURE_VERIFIER_SOURCE_RUNNER_BLOB_MISMATCH');
  requireEqual(gitBlob(repoRoot, result.producer_subject_sha, provenance.historical_deadline_compat_ref), provenance.historical_deadline_compat_git_blob_sha, 'CONTROLLED_CAPTURE_VERIFIER_COMPAT_BLOB_MISMATCH');
  requireEqual(gitBlob(repoRoot, result.producer_subject_sha, provenance.planner_ref), provenance.planner_git_blob_sha, 'CONTROLLED_CAPTURE_VERIFIER_PLANNER_BLOB_MISMATCH');
  requireEqual(gitBlob(repoRoot, result.producer_subject_sha, provenance.assembler_ref), provenance.assembler_git_blob_sha, 'CONTROLLED_CAPTURE_VERIFIER_ASSEMBLER_BLOB_MISMATCH');
  requireEqual(gitBlob(repoRoot, provenance.historical_workflow_commit_sha, provenance.historical_workflow_ref), provenance.historical_workflow_git_blob_sha, 'CONTROLLED_CAPTURE_VERIFIER_HISTORICAL_WORKFLOW_BLOB_MISMATCH');

  const refsLedger = readJson(path.join(captureDir, 'evidence', 'MCFT_CAP_09_EA5E2_TRANSIENT_R2_REFS.json'));
  const preProof = readJson(path.join(captureDir, 'evidence', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PREBOUNDARY_SAFE_PROOF.json'));
  const target = readJson(path.join(captureDir, 'evidence', 'MCFT_CAP_09_ROLLING_PREBOUNDARY_TARGET.json'));
  if (target.status !== 'PASS' || preProof.status !== 'PASS') throw new Error('CONTROLLED_CAPTURE_VERIFIER_CAPTURE_EVIDENCE_NONPASS');
  requireEqual(target.target_t, candidate.target_t, 'CONTROLLED_CAPTURE_VERIFIER_TARGET_MISMATCH');
  requireEqual(preProof.subject_sha, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_PREPROOF_SUBJECT_MISMATCH');
  requireEqual(refsLedger.subject_sha, result.producer_subject_sha, 'CONTROLLED_CAPTURE_VERIFIER_LEDGER_SUBJECT_MISMATCH');
  if (refsLedger.formal_raw_prefix_write_count !== 0 || !Array.isArray(refsLedger.refs) || refsLedger.refs.length < 2) throw new Error('CONTROLLED_CAPTURE_VERIFIER_LEDGER_BOUNDARY_INVALID');

  process.stdout.write(canonicalJson({
    schema_version: 'geox_t4r1_controlled_capture_verification_result_v1',
    status: 'PASS',
    capture_id: result.capture_id,
    capture_package_digest: finalized.evidence_package_digest,
    candidate_digest: result.candidate_digest,
    producer_subject_sha: result.producer_subject_sha,
    launcher_subject_sha: result.launcher_subject_sha,
    exact_main_binding_recorded_and_cross_bound: true,
    package_integrity_verified: true,
    source_blobs_verified: true,
    candidate_provenance_verified: true,
    zero_formal_effect_verified: true,
    runtime_mutated: false,
    production_mutation: false,
    github_owner_reactivated: false
  }));
}

main();
