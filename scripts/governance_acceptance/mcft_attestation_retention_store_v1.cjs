#!/usr/bin/env node
// Purpose: upload and read back MCFT exact-SHA attestation bytes through the frozen S3-compatible Object Lock authority.
// Boundary: workflow-only delivery support; never imported by Runtime server and never uses product Evidence Export credentials.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const CONTRACT = path.join(
  ROOT,
  'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-ATTESTATION-RETENTION-STORE-CONTRACT-V1.json',
);

const sha = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const load = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

function safeSegment(value) {
  const text = String(value || '');
  if (!/^[A-Za-z0-9._-]+$/.test(text)) throw new Error(`UNSAFE_SEGMENT:${text}`);
  return text;
}

function subjectIdentity(artifact) {
  const value = artifact.subject_commit || artifact.subject_sha || artifact.merge_commit_sha;
  const subject = safeSegment(value);
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error(`SUBJECT_SHA_INVALID:${subject}`);
  return subject;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function aws(args, allowFail = false) {
  const endpoint = process.env.GEOX_MCFT_ATTESTATION_S3_ENDPOINT;
  const region = process.env.GEOX_MCFT_ATTESTATION_S3_REGION;
  const full = ['--region', region, ...args];
  if (endpoint) full.unshift('--endpoint-url', endpoint);
  const result = cp.spawnSync('aws', full, { encoding: 'utf8', env: process.env });
  if (result.status !== 0 && !allowFail) {
    throw new Error(`AWS_FAILED:${args.join(' ')}:${String(result.stderr || '').slice(0, 500)}`);
  }
  return result;
}

function staticContract() {
  const contract = load(CONTRACT);
  assert.equal(contract.store_contract_id, 'MCFT_ATTESTATION_S3_COMPAT_OBJECT_LOCK_V1');
  assert.equal(contract.namespace_prefix, 'mcft-attestations-v1');
  assert.equal(contract.product_namespace_forbidden, 'evidence-exports-v1');
  assert.equal(contract.required_bucket_controls.versioning, 'Enabled');
  assert.equal(contract.required_bucket_controls.object_lock, 'Enabled');
  assert.equal(contract.required_bucket_controls.worm_mode, 'COMPLIANCE');
  return contract;
}

function requireEnv() {
  for (const name of [
    'GEOX_MCFT_ATTESTATION_S3_ENDPOINT',
    'GEOX_MCFT_ATTESTATION_S3_BUCKET',
    'GEOX_MCFT_ATTESTATION_S3_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ]) {
    if (!process.env[name]) throw new Error(`ENV_REQUIRED:${name}`);
  }
}

function preflight() {
  staticContract();
  requireEnv();
  const bucket = process.env.GEOX_MCFT_ATTESTATION_S3_BUCKET;
  const versioning = JSON.parse(
    aws(['s3api', 'get-bucket-versioning', '--bucket', bucket]).stdout || '{}',
  );
  if (versioning.Status !== 'Enabled') throw new Error('BUCKET_VERSIONING_NOT_ENABLED');
  const lock = JSON.parse(
    aws(['s3api', 'get-object-lock-configuration', '--bucket', bucket]).stdout || '{}',
  );
  if (lock.ObjectLockConfiguration?.ObjectLockEnabled !== 'Enabled') {
    throw new Error('BUCKET_OBJECT_LOCK_NOT_ENABLED');
  }
  return {
    versioning: versioning.Status,
    object_lock: lock.ObjectLockConfiguration.ObjectLockEnabled,
  };
}

function put(bucket, key, file, retainUntil, contentType) {
  const output = JSON.parse(
    aws([
      's3api',
      'put-object',
      '--bucket',
      bucket,
      '--key',
      key,
      '--body',
      file,
      '--content-type',
      contentType,
      '--object-lock-mode',
      'COMPLIANCE',
      '--object-lock-retain-until-date',
      retainUntil,
    ]).stdout || '{}',
  );
  if (!output.VersionId) throw new Error(`VERSION_ID_REQUIRED:${key}`);
  return output;
}

function head(bucket, key, version) {
  return JSON.parse(
    aws(['s3api', 'head-object', '--bucket', bucket, '--key', key, '--version-id', version])
      .stdout || '{}',
  );
}

function get(bucket, key, version, file) {
  aws(['s3api', 'get-object', '--bucket', bucket, '--key', key, '--version-id', version, file]);
}

function upload() {
  const contract = staticContract();
  const controls = preflight();
  const artifactPath = path.resolve(process.env.MCFT_CANONICAL_ARTIFACT_PATH || '');
  const archivePath = path.resolve(process.env.MCFT_ARTIFACT_ARCHIVE_PATH || '');
  if (!fs.existsSync(artifactPath) || !fs.existsSync(archivePath)) {
    throw new Error('ARTIFACT_INPUT_MISSING');
  }

  const artifact = load(artifactPath);
  const semantic = { ...artifact };
  delete semantic.semantic_artifact_digest;
  const semanticDigest = sha(Buffer.from(canonical(semantic)));
  if (artifact.semantic_artifact_digest !== semanticDigest) {
    throw new Error('SEMANTIC_ARTIFACT_DIGEST_MISMATCH');
  }

  const archiveBytes = fs.readFileSync(archivePath);
  const transportDigest = sha(archiveBytes);
  const owner = safeSegment(process.env.MCFT_REPOSITORY_OWNER);
  const repository = safeSegment(process.env.MCFT_REPOSITORY_NAME);
  const capability = safeSegment(artifact.capability_line_id);
  const slice = safeSegment(String(artifact.slice_id || '').replace(/[^A-Za-z0-9._-]/g, '_'));
  const subject = subjectIdentity(artifact);
  const run = safeSegment(process.env.GITHUB_RUN_ID);
  const name = safeSegment(process.env.MCFT_ARTIFACT_NAME);
  const prefix = `${contract.namespace_prefix}/${owner}/${repository}/${capability}/${slice}/${subject}/${run}/${name}`;
  if (prefix.includes('evidence-exports-v1')) throw new Error('PRODUCT_NAMESPACE_FORBIDDEN');

  const bucket = process.env.GEOX_MCFT_ATTESTATION_S3_BUCKET;
  const days = Number(process.env.MCFT_RETENTION_DAYS);
  if (!Number.isInteger(days) || days < 180) throw new Error('RETENTION_DAYS_INVALID');
  const retainUntil = new Date(Date.now() + days * 86400000).toISOString();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-retention-'));
  const transport = {
    schema_version: 'mcft_transport_metadata_v1',
    transport_archive_sha256: transportDigest,
    workflow_run_id: process.env.GITHUB_RUN_ID,
    job_id: process.env.GITHUB_JOB,
    uploaded_at: new Date().toISOString(),
    object_prefix: prefix,
  };
  const retention = {
    schema_version: 'mcft_retention_manifest_v1',
    store_contract_id: contract.store_contract_id,
    retention_level: process.env.MCFT_RETENTION_LEVEL,
    retain_until: retainUntil,
    object_lock_mode: 'COMPLIANCE',
    versioning_proof: controls.versioning,
    credential_identity_class: 'geox_mcft_attestation_retention_writer_v1',
  };
  const transportPath = path.join(temp, 'transport-metadata.json');
  const retentionPath = path.join(temp, 'retention-manifest.json');
  fs.writeFileSync(transportPath, `${JSON.stringify(transport, null, 2)}\n`);
  fs.writeFileSync(retentionPath, `${JSON.stringify(retention, null, 2)}\n`);

  const files = [
    ['canonical-artifact.json', artifactPath, 'application/json'],
    ['artifact-archive.bin', archivePath, 'application/octet-stream'],
    ['transport-metadata.json', transportPath, 'application/json'],
    ['retention-manifest.json', retentionPath, 'application/json'],
  ];
  const versions = {};
  for (const [filename, file, contentType] of files) {
    const key = `${prefix}/${filename}`;
    const existing = aws(['s3api', 'head-object', '--bucket', bucket, '--key', key], true);
    if (existing.status === 0) throw new Error(`IMMUTABLE_KEY_ALREADY_EXISTS:${key}`);
    const stored = put(bucket, key, file, retainUntil, contentType);
    versions[filename] = {
      key,
      version_id: stored.VersionId,
      etag: stored.ETag || null,
    };
    const metadata = head(bucket, key, stored.VersionId);
    if (metadata.ObjectLockMode !== 'COMPLIANCE') {
      throw new Error(`OBJECT_LOCK_MODE_INVALID:${key}`);
    }
    if (
      !metadata.ObjectLockRetainUntilDate ||
      Date.parse(metadata.ObjectLockRetainUntilDate) < Date.parse(retainUntil) - 1000
    ) {
      throw new Error(`RETAIN_UNTIL_INVALID:${key}`);
    }
  }

  const readDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-readback-'));
  for (const [filename] of files) {
    get(bucket, versions[filename].key, versions[filename].version_id, path.join(readDirectory, filename));
  }
  const readArtifact = load(path.join(readDirectory, 'canonical-artifact.json'));
  const readSemantic = { ...readArtifact };
  delete readSemantic.semantic_artifact_digest;
  if (sha(Buffer.from(canonical(readSemantic))) !== semanticDigest) {
    throw new Error('READBACK_SEMANTIC_DIGEST_MISMATCH');
  }
  if (sha(fs.readFileSync(path.join(readDirectory, 'artifact-archive.bin'))) !== transportDigest) {
    throw new Error('READBACK_TRANSPORT_DIGEST_MISMATCH');
  }

  const denied = aws(
    [
      's3api',
      'delete-object',
      '--bucket',
      bucket,
      '--key',
      versions['artifact-archive.bin'].key,
      '--version-id',
      versions['artifact-archive.bin'].version_id,
    ],
    true,
  );
  if (denied.status === 0) throw new Error('LOCKED_VERSION_DELETE_UNEXPECTEDLY_SUCCEEDED');

  const locator = {
    schema_version: 'mcft_attestation_retention_locator_v1',
    store_contract_id: contract.store_contract_id,
    bucket,
    object_prefix: prefix,
    object_versions: versions,
    semantic_artifact_digest: semanticDigest,
    transport_archive_sha256: transportDigest,
    retention_level: process.env.MCFT_RETENTION_LEVEL,
    retain_until: retainUntil,
    readback_verified: true,
    locked_version_delete_denied: true,
  };
  const output = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_ATTESTATION_RETENTION_LOCATOR.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(locator, null, 2)}\n`);
  console.log(JSON.stringify(locator));
}

function subjectIdentitySelftest() {
  const subject = '0123456789abcdef0123456789abcdef01234567';
  assert.equal(subjectIdentity({ subject_commit: subject }), subject);
  assert.equal(subjectIdentity({ subject_sha: subject }), subject);
  assert.equal(subjectIdentity({ merge_commit_sha: subject }), subject);
  assert.throws(() => subjectIdentity({}), /UNSAFE_SEGMENT/);
  assert.throws(() => subjectIdentity({ subject_sha: 'not-a-sha' }), /SUBJECT_SHA_INVALID/);
  return {
    schema_version: 'mcft_attestation_subject_identity_selftest_v1',
    status: 'PASS',
    supported_fields: ['subject_commit', 'subject_sha', 'merge_commit_sha'],
  };
}

const mode = process.argv[2] || '--static-contract';
try {
  if (mode === '--static-contract') console.log(JSON.stringify(staticContract()));
  else if (mode === '--preflight') console.log(JSON.stringify(preflight()));
  else if (mode === '--upload-readback') upload();
  else if (mode === '--subject-identity-selftest') console.log(JSON.stringify(subjectIdentitySelftest()));
  else throw new Error(`MODE_INVALID:${mode}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
