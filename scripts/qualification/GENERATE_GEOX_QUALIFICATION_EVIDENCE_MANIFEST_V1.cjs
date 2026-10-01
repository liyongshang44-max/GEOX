#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
function canonicalJson(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function sha256Buffer(input) { return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJsonExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx' });
}
function output(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${options.errorCode ?? 'QUALIFICATION_MANIFEST_COMMAND_FAILED'}:${command}:${result.status}:${(result.stderr ?? '').trim()}`);
  return (result.stdout ?? '').trim();
}
function gitFileSha256(repoRoot, commit, ref) {
  const result = spawnSync('git', ['show', `${commit}:${ref}`], { cwd: repoRoot, encoding: null, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`QUALIFICATION_MANIFEST_GIT_OBJECT_UNAVAILABLE:${commit}:${ref}`);
  return sha256Buffer(result.stdout);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QUALIFICATION_MANIFEST_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`QUALIFICATION_MANIFEST_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  if (!args['run-dir']) throw new Error('QUALIFICATION_MANIFEST_RUN_DIR_REQUIRED');
  return args;
}
function requireEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(`${code}:${actual}:${expected}`);
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = path.resolve(args['run-dir']);
  const repoRoot = path.resolve(args.repo ?? output('git', ['rev-parse', '--show-toplevel'], { errorCode: 'QUALIFICATION_MANIFEST_REPOSITORY_REQUIRED' }));
  const finalized = readJson(path.join(runDir, 'FINALIZED.json'));
  const digests = readJson(path.join(runDir, 'digests.json'));
  const result = readJson(path.join(runDir, 'result.json'));
  const runManifest = readJson(path.join(runDir, 'manifest.json'));
  const environment = readJson(path.join(runDir, 'environment-manifest.json'));
  const provenance = readJson(path.join(runDir, 'provenance', 'git.json'));

  if (finalized.finalized !== true) throw new Error('QUALIFICATION_MANIFEST_PACKAGE_NOT_FINALIZED');
  requireEqual(finalized.evidence_package_digest, digests.evidence_package_digest, 'QUALIFICATION_MANIFEST_PACKAGE_DIGEST_MISMATCH');
  requireEqual(result.subject_sha, runManifest.subject_sha, 'QUALIFICATION_MANIFEST_SUBJECT_MISMATCH');
  requireEqual(result.runtime_sha, runManifest.runtime_sha, 'QUALIFICATION_MANIFEST_RUNTIME_MISMATCH');
  requireEqual(result.environment_digest, runManifest.environment_digest, 'QUALIFICATION_MANIFEST_ENVIRONMENT_MISMATCH');
  requireEqual(result.environment_digest, environment.environment_digest, 'QUALIFICATION_MANIFEST_ENVIRONMENT_DIGEST_MISMATCH');
  requireEqual(provenance.subject_sha, result.subject_sha, 'QUALIFICATION_MANIFEST_PROVENANCE_SUBJECT_MISMATCH');
  requireEqual(provenance.runtime_sha, result.runtime_sha, 'QUALIFICATION_MANIFEST_PROVENANCE_RUNTIME_MISMATCH');
  requireEqual(environment.repository_subject_sha, result.subject_sha, 'QUALIFICATION_MANIFEST_ENVIRONMENT_SUBJECT_MISMATCH');
  requireEqual(environment.runtime_sha, result.runtime_sha, 'QUALIFICATION_MANIFEST_ENVIRONMENT_RUNTIME_MISMATCH');
  requireEqual(environment.contract_id, result.contract_id, 'QUALIFICATION_MANIFEST_CONTRACT_ID_MISMATCH');
  requireEqual(environment.contract_version, result.contract_version, 'QUALIFICATION_MANIFEST_CONTRACT_VERSION_MISMATCH');
  if (result.closure_semantic_subject_sha !== undefined) {
    requireEqual(result.closure_semantic_subject_sha, runManifest.closure_semantic_subject_sha, 'QUALIFICATION_MANIFEST_CLOSURE_SEMANTIC_SUBJECT_MISMATCH');
    requireEqual(result.closure_semantic_subject_sha, environment.closure_semantic_subject_sha, 'QUALIFICATION_MANIFEST_ENV_CLOSURE_SEMANTIC_SUBJECT_MISMATCH');
    requireEqual(result.closure_semantic_subject_sha, provenance.closure_semantic_subject_sha, 'QUALIFICATION_MANIFEST_PROVENANCE_CLOSURE_SEMANTIC_SUBJECT_MISMATCH');
  }

  output('git', ['cat-file', '-e', `${result.subject_sha}^{commit}`], { cwd: repoRoot, errorCode: 'QUALIFICATION_MANIFEST_SUBJECT_COMMIT_MISSING' });
  output('git', ['cat-file', '-e', `${result.runtime_sha}^{commit}`], { cwd: repoRoot, errorCode: 'QUALIFICATION_MANIFEST_RUNTIME_COMMIT_MISSING' });
  if (result.closure_semantic_subject_sha !== undefined) output('git', ['cat-file', '-e', `${result.closure_semantic_subject_sha}^{commit}`], { cwd: repoRoot, errorCode: 'QUALIFICATION_MANIFEST_CLOSURE_SEMANTIC_SUBJECT_COMMIT_MISSING' });
  const contractDigest = gitFileSha256(repoRoot, result.subject_sha, environment.qualification_contract_ref);
  const runnerDigest = gitFileSha256(repoRoot, result.subject_sha, environment.qualification_runner_ref);
  requireEqual(contractDigest, environment.qualification_contract_digest, 'QUALIFICATION_MANIFEST_CONTRACT_DIGEST_MISMATCH');
  requireEqual(runnerDigest, environment.qualification_runner_digest, 'QUALIFICATION_MANIFEST_RUNNER_DIGEST_MISMATCH');
  requireEqual(contractDigest, provenance.contract_digest, 'QUALIFICATION_MANIFEST_PROVENANCE_CONTRACT_DIGEST_MISMATCH');
  requireEqual(runnerDigest, provenance.runner_digest, 'QUALIFICATION_MANIFEST_PROVENANCE_RUNNER_DIGEST_MISMATCH');

  const evidenceRefs = digests.entries
    .filter((entry) => entry.path.startsWith('evidence/') || entry.path.startsWith('database/') || entry.path.startsWith('provenance/'))
    .map((entry) => ({ path: entry.path, sha256: entry.sha256, bytes: entry.bytes }));
  if (evidenceRefs.length === 0) throw new Error('QUALIFICATION_MANIFEST_EVIDENCE_REFS_EMPTY');

  const inputArtifactDigests = {
    contract: { ref: environment.qualification_contract_ref, digest: contractDigest },
    runner: { ref: environment.qualification_runner_ref, digest: runnerDigest },
    dependency_lock: { ref: 'pnpm-lock.yaml', digest: environment.dependency_lock_digest },
    container_images: environment.container_images,
    runtime_source: { path: provenance.runtime_source_path, git_blob_sha: provenance.runtime_source_blob_sha },
    semantic_revision_sha: provenance.semantic_revision_sha,
  };
  const explicitInputsPath = path.join(runDir, 'provenance', 'input-artifacts.json');
  if (fs.existsSync(explicitInputsPath)) {
    const explicitInputs = readJson(explicitInputsPath);
    if (explicitInputs.schema_version !== 'geox_qualification_input_artifacts_v1') throw new Error('QUALIFICATION_MANIFEST_INPUT_ARTIFACT_SCHEMA_UNSUPPORTED');
    inputArtifactDigests.qualification_inputs = explicitInputs;
  }

  const base = {
    schema_version: 'QualificationEvidenceManifestV1',
    contract_id: result.contract_id,
    contract_version: result.contract_version,
    contract_digest: contractDigest,
    runtime_subject_sha: result.runtime_sha,
    qualification_subject_sha: result.subject_sha,
    ...(result.closure_semantic_subject_sha !== undefined ? { closure_semantic_subject_sha: result.closure_semantic_subject_sha } : {}),
    qualification_subject_type: 'REPOSITORY_COMMIT_WITH_FROZEN_RUNTIME_BINDING',
    qualification_runner_ref: environment.qualification_runner_ref,
    qualification_runner_digest: runnerDigest,
    environment_digest: result.environment_digest,
    run_id: runManifest.qualification_run_id,
    started_at: runManifest.started_at,
    completed_at: runManifest.completed_at,
    result: result.status,
    evidence_package_digest: finalized.evidence_package_digest,
    evidence_refs: evidenceRefs,
    input_artifact_digests: inputArtifactDigests,
    runtime_mutated: result.runtime_mutated,
    production_mutation: result.production_mutation,
    producer_identity: {
      host_class: environment.host_class,
      producer_role: 'QUALIFICATION_EVIDENCE_PRODUCER_NOT_AUTHORITY_SYSTEM',
      signer: null,
      signature_status: 'UNSIGNED_DIGEST_BOUND_V1',
    },
    generated_at: new Date().toISOString(),
    verification_instructions: {
      verifier_ref: 'scripts/qualification/VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs',
      package_required_files: ['FINALIZED.json', 'digests.json', 'result.json', 'manifest.json', 'environment-manifest.json', 'provenance/git.json'],
      no_latest_run_fallback: true,
      exact_subject_binding_required: true,
      fail_closed: true,
    },
    authority_ceiling: runManifest.authority_ceiling,
    limitations: result.limitations ?? [],
    manifest_digest_policy: 'SHA256_CANONICAL_JSON_WITHOUT_MANIFEST_DIGEST_FIELD',
  };
  const manifest = { ...base, manifest_digest: sha256Buffer(canonicalJson(base)) };
  const manifestRoot = path.resolve(args.out ?? path.join(path.dirname(path.dirname(runDir)), 'manifests', runManifest.qualification_run_id));
  const manifestPath = manifestRoot.endsWith('.json') ? manifestRoot : path.join(manifestRoot, 'QualificationEvidenceManifestV1.json');
  writeJsonExclusive(manifestPath, manifest);
  process.stdout.write(`${canonicalJson({
    status: 'PASS',
    schema_version: manifest.schema_version,
    run_id: manifest.run_id,
    qualification_subject_sha: manifest.qualification_subject_sha,
    runtime_subject_sha: manifest.runtime_subject_sha,
    closure_semantic_subject_sha: manifest.closure_semantic_subject_sha ?? null,
    evidence_package_digest: manifest.evidence_package_digest,
    manifest_digest: manifest.manifest_digest,
    manifest_path: manifestPath,
    runtime_mutated: manifest.runtime_mutated,
    production_mutation: manifest.production_mutation,
  })}`);
}

main();
