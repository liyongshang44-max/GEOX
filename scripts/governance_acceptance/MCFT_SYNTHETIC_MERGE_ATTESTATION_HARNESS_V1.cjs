#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = process.cwd();
const args = process.argv.slice(2);

function argument(name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) throw new Error(`ARGUMENT_REQUIRED:${name}`);
  return args[index + 1];
}
function git(cwd, gitArgs, options = {}) {
  return cp.execFileSync('git', gitArgs, { cwd, encoding: 'utf8', ...options }).trim();
}
function canonicalCommit(value, label) {
  const raw = String(value || '').trim();
  assert.match(raw, /^[0-9a-f]{40}$/, `${label}_INVALID`);
  return git(ROOT, ['rev-parse', `${raw}^{commit}`]);
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function sha256(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function ensureCommand(command, label) {
  assert.ok(Array.isArray(command) && command.length >= 2, `${label}_INVALID`);
  for (const token of command) assert.equal(typeof token, 'string', `${label}_TOKEN_INVALID`);
}
function runCommand(command, cwd, env, label) {
  ensureCommand(command, label);
  const result = cp.spawnSync(command[0], command.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) throw new Error(`${label}_FAILED:${result.status}:${result.stderr || result.stdout}`);
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}
function writeResult(outputPath, value) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const profilePath = path.resolve(ROOT, argument('--profile'));
const outputPath = path.resolve(ROOT, argument('--output'));
const base = canonicalCommit(process.env.MCFT_BASE_SHA, 'MCFT_BASE_SHA');
const candidate = canonicalCommit(process.env.MCFT_CANDIDATE_SHA, 'MCFT_CANDIDATE_SHA');
const profile = readJson(profilePath);

let temp = null;
let candidateWorktree = null;
let mergeWorktree = null;
try {
  assert.equal(profile.schema_version, 'geox_mcft_synthetic_merge_attestation_profile_v1');
  assert.match(String(profile.profile_id || ''), /^[A-Za-z0-9_.-]+$/, 'PROFILE_ID_INVALID');
  assert.equal(git(ROOT, ['merge-base', base, candidate]), base, 'CANDIDATE_NOT_DESCENDANT_OF_BASE');
  if (profile.require_single_candidate_commit !== false) {
    assert.equal(Number(git(ROOT, ['rev-list', '--count', `${base}..${candidate}`])), 1, 'CANDIDATE_COMMIT_CARDINALITY_INVALID');
  }
  for (const name of ['candidate_boundary', 'merge_attestation', 'finalizer', 'archive', 'retention']) {
    ensureCommand(profile.commands?.[name], `${name.toUpperCase()}_COMMAND`);
  }
  const candidateTree = git(ROOT, ['rev-parse', `${candidate}^{tree}`]);
  const commitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'MCFT Synthetic Merge Harness',
    GIT_AUTHOR_EMAIL: 'mcft-synthetic@example.invalid',
    GIT_COMMITTER_NAME: 'MCFT Synthetic Merge Harness',
    GIT_COMMITTER_EMAIL: 'mcft-synthetic@example.invalid',
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  };
  const syntheticMerge = cp.execFileSync('git', ['commit-tree', candidateTree, '-p', base, '-p', candidate], {
    cwd: ROOT, encoding: 'utf8', input: `Synthetic merge for ${profile.profile_id}\n`, env: commitEnv,
  }).trim();
  const parents = git(ROOT, ['rev-list', '--parents', '-n', '1', syntheticMerge]).split(/\s+/);
  assert.deepEqual(parents, [syntheticMerge, base, candidate], 'SYNTHETIC_MERGE_PARENT_ORDER_INVALID');
  const mergeTree = git(ROOT, ['rev-parse', `${syntheticMerge}^{tree}`]);
  assert.equal(mergeTree, candidateTree, 'CANDIDATE_SYNTHETIC_MERGE_TREE_DELTA_NONZERO');

  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-synthetic-merge-harness-'));
  candidateWorktree = path.join(temp, 'candidate');
  mergeWorktree = path.join(temp, 'merge');
  const sharedOutput = path.join(temp, 'shared-output');
  fs.mkdirSync(sharedOutput, { recursive: true });
  git(ROOT, ['worktree', 'add', '--detach', candidateWorktree, candidate]);
  git(ROOT, ['worktree', 'add', '--detach', mergeWorktree, syntheticMerge]);

  const commonEnv = {
    MCFT_BASE_SHA: base,
    MCFT_CANDIDATE_SHA: candidate,
    MCFT_SYNTHETIC_MERGE_SHA: syntheticMerge,
    MCFT_HARNESS_SHARED_OUTPUT_DIR: sharedOutput,
    MCFT_HARNESS_PROFILE_ID: profile.profile_id,
  };
  const candidateRun = runCommand(profile.commands.candidate_boundary, candidateWorktree,
    { ...commonEnv, MCFT_ATTESTATION_CONTEXT: 'CANDIDATE' }, 'CANDIDATE_BOUNDARY');
  const mergeRun = runCommand(profile.commands.merge_attestation, mergeWorktree,
    { ...commonEnv, MCFT_SUBJECT_SHA: syntheticMerge, MCFT_ATTESTATION_CONTEXT: 'MERGE' }, 'MERGE_ATTESTATION');
  const finalizerRun = runCommand(profile.commands.finalizer, mergeWorktree,
    { ...commonEnv, MCFT_SUBJECT_SHA: syntheticMerge, MCFT_ATTESTATION_CONTEXT: 'MERGE' }, 'FINALIZER');

  const canonicalArtifactPath = path.resolve(mergeWorktree, profile.artifact.canonical_path);
  const archivePath = path.resolve(mergeWorktree, profile.artifact.archive_path);
  const retentionLocatorPath = path.resolve(mergeWorktree, profile.artifact.retention_locator_path);
  const artifact = readJson(canonicalArtifactPath);
  assert.equal(artifact.status, 'PASS', 'CANONICAL_ARTIFACT_STATUS_NOT_PASS');
  assert.equal(artifact.subject_commit, syntheticMerge, 'CANONICAL_ARTIFACT_SUBJECT_MISMATCH');
  assert.match(String(artifact.semantic_artifact_digest || ''), /^sha256:[0-9a-f]{64}$/, 'CANONICAL_ARTIFACT_DIGEST_INVALID');
  for (const field of profile.artifact.required_fields || []) {
    assert.notEqual(artifact[field], undefined, `CANONICAL_ARTIFACT_REQUIRED_FIELD_MISSING:${field}`);
    assert.notEqual(artifact[field], null, `CANONICAL_ARTIFACT_REQUIRED_FIELD_NULL:${field}`);
  }

  const archiveEnv = { ...commonEnv, MCFT_SUBJECT_SHA: syntheticMerge, MCFT_ATTESTATION_CONTEXT: 'MERGE' };
  const archiveRunA = runCommand(profile.commands.archive, mergeWorktree, archiveEnv, 'ARCHIVE_A');
  if (!fs.existsSync(archivePath)) throw new Error('ARTIFACT_ARCHIVE_MISSING_AFTER_FIRST_BUILD');
  const archiveDigestA = sha256(fs.readFileSync(archivePath));
  const archiveRunB = runCommand(profile.commands.archive, mergeWorktree, archiveEnv, 'ARCHIVE_B');
  if (!fs.existsSync(archivePath)) throw new Error('ARTIFACT_ARCHIVE_MISSING_AFTER_SECOND_BUILD');
  const archiveDigestB = sha256(fs.readFileSync(archivePath));
  assert.equal(archiveDigestA, archiveDigestB, 'DETERMINISTIC_ARCHIVE_DIGEST_MISMATCH');

  const retentionRoot = path.join(temp, 'retention-store');
  const retentionEnv = {
    ...commonEnv,
    MCFT_SUBJECT_SHA: syntheticMerge,
    MCFT_ATTESTATION_CONTEXT: 'MERGE',
    MCFT_REPOSITORY_ROOT: mergeWorktree,
    MCFT_CANONICAL_ARTIFACT_PATH: canonicalArtifactPath,
    MCFT_ARTIFACT_ARCHIVE_PATH: archivePath,
    MCFT_RETENTION_LOCATOR_PATH: retentionLocatorPath,
    MCFT_ATTESTATION_LOCAL_ROOT: retentionRoot,
    GEOX_MCFT_ATTESTATION_S3_BUCKET: profile.retention.bucket,
    GEOX_MCFT_ATTESTATION_S3_REGION: profile.retention.region,
    MCFT_REPOSITORY_OWNER: profile.retention.repository_owner,
    MCFT_REPOSITORY_NAME: profile.retention.repository_name,
    MCFT_ARTIFACT_NAME: profile.retention.artifact_name,
    MCFT_RETENTION_LEVEL: profile.retention.level,
    MCFT_RETENTION_DAYS: String(profile.retention.days),
    GITHUB_RUN_ID: String(profile.retention.workflow_run_id || '1'),
    GITHUB_JOB: profile.retention.job_id || 'synthetic-merge-attestation',
  };
  const retentionRun = runCommand(profile.commands.retention, mergeWorktree, retentionEnv, 'RETENTION');
  if (!fs.existsSync(retentionLocatorPath)) throw new Error('RETENTION_LOCATOR_MISSING');
  const locator = readJson(retentionLocatorPath);
  assert.equal(locator.store_contract_id, 'MCFT_ATTESTATION_S3_COMPAT_OBJECT_LOCK_V1');
  assert.equal(locator.backend_kind, 'LOCAL_PRODUCTION_LOGIC');
  assert.equal(locator.semantic_artifact_digest, artifact.semantic_artifact_digest);
  assert.equal(locator.transport_archive_sha256, archiveDigestA);
  assert.equal(locator.retention_level, profile.retention.level);
  assert.equal(locator.readback_verified, true);
  assert.equal(locator.locked_version_delete_denied, true);
  assert.deepEqual(Object.keys(locator.object_versions).sort(), [
    'artifact-archive.bin', 'canonical-artifact.json', 'retention-manifest.json', 'transport-metadata.json',
  ]);

  const result = {
    schema_version: 'geox_mcft_synthetic_merge_attestation_harness_result_v1',
    status: 'PASS',
    profile_id: profile.profile_id,
    base_sha: base,
    candidate_sha: candidate,
    synthetic_merge_sha: syntheticMerge,
    candidate_tree_sha: candidateTree,
    merge_tree_sha: mergeTree,
    candidate_to_merge_tree_delta: 0,
    candidate_commit_count: Number(git(ROOT, ['rev-list', '--count', `${base}..${candidate}`])),
    base_to_merge_commit_count: Number(git(ROOT, ['rev-list', '--count', `${base}..${syntheticMerge}`])),
    candidate_boundary_context: candidate,
    merge_attestation_context: syntheticMerge,
    finalizer_context: syntheticMerge,
    candidate_boundary_command: profile.commands.candidate_boundary,
    merge_attestation_command: profile.commands.merge_attestation,
    finalizer_command: profile.commands.finalizer,
    archive_command: profile.commands.archive,
    retention_command: profile.commands.retention,
    candidate_command_output: candidateRun.stdout,
    merge_command_output: mergeRun.stdout,
    finalizer_command_output: finalizerRun.stdout,
    archive_command_output: [archiveRunA.stdout, archiveRunB.stdout].filter(Boolean),
    retention_command_output: retentionRun.stdout,
    canonical_artifact_path: profile.artifact.canonical_path,
    archive_path: profile.artifact.archive_path,
    retention_locator_path: profile.artifact.retention_locator_path,
    semantic_artifact_digest: artifact.semantic_artifact_digest,
    deterministic_archive_digest: archiveDigestA,
    retention_readback: locator,
    retention_backend_scope: 'LOCAL_BACKEND_REUSING_PRODUCTION_RETENTION_LOGIC',
    remote_object_store_exercised: false,
    repository_write_performed: false,
  };
  writeResult(outputPath, result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_synthetic_merge_attestation_harness_result_v1',
    status: 'FAIL', profile_id: profile?.profile_id || null, base_sha: base, candidate_sha: candidate,
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(outputPath, result);
  console.error(result.error);
  process.exitCode = 1;
} finally {
  if (candidateWorktree) cp.spawnSync('git', ['worktree', 'remove', '--force', candidateWorktree], { cwd: ROOT });
  if (mergeWorktree) cp.spawnSync('git', ['worktree', 'remove', '--force', mergeWorktree], { cwd: ROOT });
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
}
