#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
function canonicalJson(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function sha256Buffer(input) { return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`; }
function sha256File(file) { return sha256Buffer(fs.readFileSync(file)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function output(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${options.errorCode ?? 'QUALIFICATION_VERIFIER_COMMAND_FAILED'}:${command}:${result.status}:${(result.stderr ?? '').trim()}`);
  return (result.stdout ?? '').trim();
}
function gitFileSha256(repoRoot, commit, ref) {
  const result = spawnSync('git', ['show', `${commit}:${ref}`], { cwd: repoRoot, encoding: null, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`QUALIFICATION_VERIFIER_GIT_OBJECT_UNAVAILABLE:${commit}:${ref}`);
  return sha256Buffer(result.stdout);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QUALIFICATION_VERIFIER_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`QUALIFICATION_VERIFIER_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  if (!args.manifest) throw new Error('QUALIFICATION_VERIFIER_MANIFEST_REQUIRED');
  if (!args['run-dir']) throw new Error('QUALIFICATION_VERIFIER_RUN_DIR_REQUIRED');
  return args;
}
function requireEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(`${code}:${actual}:${expected}`);
}
function walkFiles(root) {
  const rows = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).replaceAll('\\', '/');
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) rows.push({ path: rel, sha256: sha256File(full), bytes: stat.size });
    }
  }
  walk(root);
  return rows;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const runDir = path.resolve(args['run-dir']);
  const repoRoot = path.resolve(args.repo ?? output('git', ['rev-parse', '--show-toplevel'], { errorCode: 'QUALIFICATION_VERIFIER_REPOSITORY_REQUIRED' }));
  const manifest = readJson(manifestPath);
  if (manifest.schema_version !== 'QualificationEvidenceManifestV1') throw new Error('QUALIFICATION_VERIFIER_SCHEMA_UNSUPPORTED');
  const manifestBase = { ...manifest };
  delete manifestBase.manifest_digest;
  requireEqual(sha256Buffer(canonicalJson(manifestBase)), manifest.manifest_digest, 'QUALIFICATION_VERIFIER_MANIFEST_DIGEST_MISMATCH');

  const finalized = readJson(path.join(runDir, 'FINALIZED.json'));
  const digests = readJson(path.join(runDir, 'digests.json'));
  const result = readJson(path.join(runDir, 'result.json'));
  const runManifest = readJson(path.join(runDir, 'manifest.json'));
  const environment = readJson(path.join(runDir, 'environment-manifest.json'));
  const provenance = readJson(path.join(runDir, 'provenance', 'git.json'));
  if (finalized.finalized !== true) throw new Error('QUALIFICATION_VERIFIER_PACKAGE_NOT_FINALIZED');
  requireEqual(finalized.evidence_package_digest, digests.evidence_package_digest, 'QUALIFICATION_VERIFIER_PACKAGE_DECLARATION_MISMATCH');
  requireEqual(manifest.evidence_package_digest, finalized.evidence_package_digest, 'QUALIFICATION_VERIFIER_MANIFEST_PACKAGE_DIGEST_MISMATCH');

  const actual = walkFiles(runDir).filter((entry) => !['digests.json', 'FINALIZED.json'].includes(entry.path));
  const expected = [...digests.entries].sort((a, b) => a.path.localeCompare(b.path));
  const actualSorted = actual.sort((a, b) => a.path.localeCompare(b.path));
  requireEqual(canonicalJson(actualSorted), canonicalJson(expected), 'QUALIFICATION_VERIFIER_PACKAGE_CONTENT_MISMATCH');
  requireEqual(sha256Buffer(canonicalJson(expected)), digests.evidence_package_digest, 'QUALIFICATION_VERIFIER_PACKAGE_DIGEST_RECOMPUTE_MISMATCH');

  requireEqual(manifest.run_id, runManifest.qualification_run_id, 'QUALIFICATION_VERIFIER_RUN_ID_MISMATCH');
  requireEqual(manifest.qualification_subject_sha, result.subject_sha, 'QUALIFICATION_VERIFIER_QUALIFICATION_SUBJECT_MISMATCH');
  requireEqual(manifest.runtime_subject_sha, result.runtime_sha, 'QUALIFICATION_VERIFIER_RUNTIME_SUBJECT_MISMATCH');
  requireEqual(manifest.contract_id, result.contract_id, 'QUALIFICATION_VERIFIER_CONTRACT_ID_MISMATCH');
  requireEqual(manifest.contract_version, result.contract_version, 'QUALIFICATION_VERIFIER_CONTRACT_VERSION_MISMATCH');
  requireEqual(manifest.environment_digest, result.environment_digest, 'QUALIFICATION_VERIFIER_ENVIRONMENT_MISMATCH');
  requireEqual(manifest.result, result.status, 'QUALIFICATION_VERIFIER_RESULT_MISMATCH');
  requireEqual(manifest.runtime_mutated, result.runtime_mutated, 'QUALIFICATION_VERIFIER_RUNTIME_MUTATION_MISMATCH');
  requireEqual(manifest.production_mutation, result.production_mutation, 'QUALIFICATION_VERIFIER_PRODUCTION_MUTATION_MISMATCH');
  requireEqual(manifest.started_at, runManifest.started_at, 'QUALIFICATION_VERIFIER_STARTED_AT_MISMATCH');
  requireEqual(manifest.completed_at, runManifest.completed_at, 'QUALIFICATION_VERIFIER_COMPLETED_AT_MISMATCH');
  requireEqual(environment.repository_subject_sha, manifest.qualification_subject_sha, 'QUALIFICATION_VERIFIER_ENV_SUBJECT_MISMATCH');
  requireEqual(environment.runtime_sha, manifest.runtime_subject_sha, 'QUALIFICATION_VERIFIER_ENV_RUNTIME_MISMATCH');
  requireEqual(provenance.subject_sha, manifest.qualification_subject_sha, 'QUALIFICATION_VERIFIER_PROVENANCE_SUBJECT_MISMATCH');
  requireEqual(provenance.runtime_sha, manifest.runtime_subject_sha, 'QUALIFICATION_VERIFIER_PROVENANCE_RUNTIME_MISMATCH');

  output('git', ['cat-file', '-e', `${manifest.qualification_subject_sha}^{commit}`], { cwd: repoRoot, errorCode: 'QUALIFICATION_VERIFIER_SUBJECT_COMMIT_MISSING' });
  output('git', ['cat-file', '-e', `${manifest.runtime_subject_sha}^{commit}`], { cwd: repoRoot, errorCode: 'QUALIFICATION_VERIFIER_RUNTIME_COMMIT_MISSING' });
  const contractDigest = gitFileSha256(repoRoot, manifest.qualification_subject_sha, manifest.input_artifact_digests.contract.ref);
  const runnerDigest = gitFileSha256(repoRoot, manifest.qualification_subject_sha, manifest.qualification_runner_ref);
  requireEqual(contractDigest, manifest.contract_digest, 'QUALIFICATION_VERIFIER_CONTRACT_DIGEST_MISMATCH');
  requireEqual(contractDigest, manifest.input_artifact_digests.contract.digest, 'QUALIFICATION_VERIFIER_CONTRACT_INPUT_DIGEST_MISMATCH');
  requireEqual(runnerDigest, manifest.qualification_runner_digest, 'QUALIFICATION_VERIFIER_RUNNER_DIGEST_MISMATCH');
  requireEqual(runnerDigest, manifest.input_artifact_digests.runner.digest, 'QUALIFICATION_VERIFIER_RUNNER_INPUT_DIGEST_MISMATCH');
  requireEqual(environment.qualification_contract_digest, manifest.contract_digest, 'QUALIFICATION_VERIFIER_ENV_CONTRACT_DIGEST_MISMATCH');
  requireEqual(environment.qualification_runner_digest, manifest.qualification_runner_digest, 'QUALIFICATION_VERIFIER_ENV_RUNNER_DIGEST_MISMATCH');
  requireEqual(environment.dependency_lock_digest, manifest.input_artifact_digests.dependency_lock.digest, 'QUALIFICATION_VERIFIER_DEPENDENCY_DIGEST_MISMATCH');

  const evidenceMap = new Map(expected.map((entry) => [entry.path, entry]));
  for (const ref of manifest.evidence_refs) {
    const entry = evidenceMap.get(ref.path);
    if (!entry) throw new Error(`QUALIFICATION_VERIFIER_EVIDENCE_REF_MISSING:${ref.path}`);
    requireEqual(entry.sha256, ref.sha256, `QUALIFICATION_VERIFIER_EVIDENCE_DIGEST_MISMATCH:${ref.path}`);
    requireEqual(entry.bytes, ref.bytes, `QUALIFICATION_VERIFIER_EVIDENCE_BYTES_MISMATCH:${ref.path}`);
  }
  if (manifest.verification_instructions.no_latest_run_fallback !== true || manifest.verification_instructions.exact_subject_binding_required !== true || manifest.verification_instructions.fail_closed !== true) {
    throw new Error('QUALIFICATION_VERIFIER_POLICY_WEAKENED');
  }

  process.stdout.write(canonicalJson({
    schema_version: 'geox_qualification_evidence_manifest_verification_result_v1',
    status: 'PASS',
    run_id: manifest.run_id,
    qualification_subject_sha: manifest.qualification_subject_sha,
    runtime_subject_sha: manifest.runtime_subject_sha,
    contract_id: manifest.contract_id,
    contract_version: manifest.contract_version,
    environment_digest: manifest.environment_digest,
    result: manifest.result,
    evidence_package_digest: manifest.evidence_package_digest,
    manifest_digest: manifest.manifest_digest,
    runtime_mutated: manifest.runtime_mutated,
    production_mutation: manifest.production_mutation,
    latest_run_fallback_used: false,
    exact_subject_binding_verified: true,
    package_integrity_verified: true,
    repository_inputs_verified: true,
  }));
}

main();
