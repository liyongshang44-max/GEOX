#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
function canonicalJson(value) { return `${JSON.stringify(canonicalize(value), null, 2)}\n`; }
function sha256Buffer(input) { return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`; }
function sha256File(file) { return sha256Buffer(fs.readFileSync(file)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function requireEqual(actual, expected, code) {
  if (actual !== expected) throw new Error(`${code}:${actual}:${expected}`);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  if (!args['delivery-dir']) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_DELIVERY_DIR_REQUIRED');
  if (!args['run-dir']) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_RUN_DIR_REQUIRED');
  return args;
}
function requireRepoRoot(args) {
  if (args.repo) return path.resolve(args.repo);
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true });
  if (probe.error) throw probe.error;
  if (probe.status !== 0) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_REPOSITORY_REQUIRED');
  return path.resolve(probe.stdout.trim());
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const deliveryDir = path.resolve(args['delivery-dir']);
  const runDir = path.resolve(args['run-dir']);
  const repoRoot = requireRepoRoot(args);

  const required = [
    'QualificationEvidenceManifestV1.json',
    'QualificationEvidenceVerificationResultV1.json',
    'ClosureDeliveryV1.json',
    'FINALIZED.json'
  ];
  const allowed = new Set(required);
  const actualNames = fs.readdirSync(deliveryDir).sort();
  for (const name of actualNames) {
    const full = path.join(deliveryDir, name);
    if (!allowed.has(name) || !fs.statSync(full).isFile()) {
      throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_UNEXPECTED_ENTRY:${name}`);
    }
  }
  for (const name of required) {
    if (!fs.existsSync(path.join(deliveryDir, name))) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_REQUIRED_FILE_MISSING:${name}`);
  }

  const finalized = readJson(path.join(deliveryDir, 'FINALIZED.json'));
  if (finalized.schema_version !== 'GEOXQualificationClosureDeliveryFinalizedV1' || finalized.finalized !== true) {
    throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_NOT_FINALIZED');
  }
  const recomputedEntries = [
    'QualificationEvidenceManifestV1.json',
    'QualificationEvidenceVerificationResultV1.json',
    'ClosureDeliveryV1.json'
  ].map((name) => {
    const full = path.join(deliveryDir, name);
    return { path: name, sha256: sha256File(full), bytes: fs.statSync(full).size };
  }).sort((a, b) => a.path.localeCompare(b.path));
  requireEqual(canonicalJson(recomputedEntries), canonicalJson(finalized.entries), 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_ENTRY_DIGEST_MISMATCH');
  requireEqual(sha256Buffer(canonicalJson(recomputedEntries)), finalized.delivery_package_digest, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_PACKAGE_DIGEST_MISMATCH');

  const manifestPath = path.join(deliveryDir, 'QualificationEvidenceManifestV1.json');
  const descriptor = readJson(path.join(deliveryDir, 'ClosureDeliveryV1.json'));
  const storedVerification = readJson(path.join(deliveryDir, 'QualificationEvidenceVerificationResultV1.json'));
  const manifest = readJson(manifestPath);

  if (descriptor.schema_version !== 'GEOXQualificationClosureDeliveryV1') {
    throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_DESCRIPTOR_SCHEMA_UNSUPPORTED');
  }
  const descriptorBase = { ...descriptor };
  delete descriptorBase.descriptor_digest;
  requireEqual(sha256Buffer(canonicalJson(descriptorBase)), descriptor.descriptor_digest, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_DESCRIPTOR_DIGEST_MISMATCH');
  requireEqual(descriptor.delivery_id, finalized.delivery_id, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_DELIVERY_ID_MISMATCH');
  requireEqual(descriptor.manifest_digest, manifest.manifest_digest, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_MANIFEST_DIGEST_MISMATCH');
  requireEqual(descriptor.manifest_file_digest, sha256File(manifestPath), 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_MANIFEST_FILE_DIGEST_MISMATCH');
  requireEqual(descriptor.verification_result_digest, sha256Buffer(canonicalJson(storedVerification)), 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_STORED_VERIFICATION_DIGEST_MISMATCH');

  const verifier = path.join(repoRoot, 'scripts', 'qualification', 'VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs');
  const rerun = spawnSync(process.execPath, [verifier, '--manifest', manifestPath, '--run-dir', runDir, '--repo', repoRoot], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  if (rerun.error) throw rerun.error;
  if (rerun.status !== 0) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_SOURCE_REVERIFY_FAILED:${rerun.status}:${(rerun.stderr ?? '').trim()}`);
  const currentVerification = JSON.parse(rerun.stdout);
  requireEqual(canonicalJson(currentVerification), canonicalJson(storedVerification), 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_REVERIFY_RESULT_MISMATCH');

  requireEqual(descriptor.run_id, manifest.run_id, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_RUN_ID_MISMATCH');
  requireEqual(descriptor.qualification_subject_sha, manifest.qualification_subject_sha, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_QUALIFICATION_SUBJECT_MISMATCH');
  requireEqual(descriptor.runtime_subject_sha, manifest.runtime_subject_sha, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_RUNTIME_SUBJECT_MISMATCH');
  requireEqual(descriptor.evidence_package_digest, manifest.evidence_package_digest, 'QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_EVIDENCE_PACKAGE_DIGEST_MISMATCH');

  if (descriptor.result !== 'PASS' ||
      descriptor.exact_subject_binding_verified !== true ||
      descriptor.package_integrity_verified !== true ||
      descriptor.repository_inputs_verified !== true ||
      descriptor.latest_run_fallback_used !== false ||
      descriptor.runtime_mutated !== false ||
      descriptor.production_mutation !== false ||
      descriptor.blocker_semantics_modified !== false ||
      descriptor.qcp_semantics_modified !== false ||
      descriptor.closure_subject_mutated !== false ||
      descriptor.supersedes_github_lane !== false) {
    throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_POLICY_WEAKENED');
  }

  process.stdout.write(canonicalJson({
    schema_version: 'geox_qualification_closure_delivery_verification_result_v1',
    status: 'PASS',
    delivery_id: descriptor.delivery_id,
    delivery_package_digest: finalized.delivery_package_digest,
    run_id: descriptor.run_id,
    qualification_subject_sha: descriptor.qualification_subject_sha,
    runtime_subject_sha: descriptor.runtime_subject_sha,
    evidence_package_digest: descriptor.evidence_package_digest,
    manifest_digest: descriptor.manifest_digest,
    exact_subject_binding_verified: true,
    package_integrity_verified: true,
    repository_inputs_verified: true,
    latest_run_fallback_used: false,
    runtime_mutated: false,
    production_mutation: false,
    blocker_semantics_modified: false,
    qcp_semantics_modified: false,
    closure_subject_mutated: false,
    supersedes_github_lane: false
  }));
}

main();
