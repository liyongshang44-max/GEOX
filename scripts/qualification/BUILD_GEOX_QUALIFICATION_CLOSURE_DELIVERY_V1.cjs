#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
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
function writeJsonExclusive(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx' });
}
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  if (!args.manifest) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_MANIFEST_REQUIRED');
  if (!args['run-dir']) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_RUN_DIR_REQUIRED');
  return args;
}
function requireRepoRoot(args) {
  if (args.repo) return path.resolve(args.repo);
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true });
  if (probe.error) throw probe.error;
  if (probe.status !== 0) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_REPOSITORY_REQUIRED');
  return path.resolve(probe.stdout.trim());
}
function runVerifier(repoRoot, manifestPath, runDir) {
  const verifier = path.join(repoRoot, 'scripts', 'qualification', 'VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs');
  const result = spawnSync(process.execPath, [verifier, '--manifest', manifestPath, '--run-dir', runDir, '--repo', repoRoot], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_SOURCE_VERIFICATION_FAILED:${result.status}:${(result.stderr ?? '').trim()}`);
  }
  const parsed = JSON.parse(result.stdout);
  if (parsed.status !== 'PASS' ||
      parsed.package_integrity_verified !== true ||
      parsed.repository_inputs_verified !== true ||
      parsed.exact_subject_binding_verified !== true ||
      parsed.latest_run_fallback_used !== false) {
    throw new Error('QUALIFICATION_CLOSURE_DELIVERY_SOURCE_VERIFICATION_NOT_STRONG_PASS');
  }
  return parsed;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(args.manifest);
  const runDir = path.resolve(args['run-dir']);
  const repoRoot = requireRepoRoot(args);
  const manifest = readJson(manifestPath);

  if (manifest.schema_version !== 'QualificationEvidenceManifestV1') throw new Error('QUALIFICATION_CLOSURE_DELIVERY_MANIFEST_SCHEMA_UNSUPPORTED');
  if (manifest.result !== 'PASS') throw new Error('QUALIFICATION_CLOSURE_DELIVERY_NONPASS_MANIFEST_FORBIDDEN');
  if (manifest.runtime_mutated !== false) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_RUNTIME_MUTATION_FORBIDDEN');
  if (manifest.production_mutation !== false) throw new Error('QUALIFICATION_CLOSURE_DELIVERY_PRODUCTION_MUTATION_FORBIDDEN');
  if (manifest.verification_instructions?.no_latest_run_fallback !== true ||
      manifest.verification_instructions?.exact_subject_binding_required !== true ||
      manifest.verification_instructions?.fail_closed !== true) {
    throw new Error('QUALIFICATION_CLOSURE_DELIVERY_MANIFEST_POLICY_WEAKENED');
  }

  const verification = runVerifier(repoRoot, manifestPath, runDir);
  if (verification.manifest_digest !== manifest.manifest_digest ||
      verification.evidence_package_digest !== manifest.evidence_package_digest ||
      verification.run_id !== manifest.run_id ||
      verification.qualification_subject_sha !== manifest.qualification_subject_sha ||
      verification.runtime_subject_sha !== manifest.runtime_subject_sha) {
    throw new Error('QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_BINDING_MISMATCH');
  }

  const manifestFileDigest = sha256File(manifestPath);
  const verificationBytes = canonicalJson(verification);
  const verificationDigest = sha256Buffer(verificationBytes);
  const digestSuffix = manifest.manifest_digest.slice('sha256:'.length, 'sha256:'.length + 12);
  const deliveryId = `${manifest.run_id}-${digestSuffix}`;
  const deliveryDir = path.resolve(args.out ?? path.join(os.homedir(), '.geox', 'qualification', 'deliveries', deliveryId));
  if (fs.existsSync(deliveryDir)) throw new Error(`QUALIFICATION_CLOSURE_DELIVERY_ALREADY_EXISTS:${deliveryDir}`);
  const deliveryParentDir = path.dirname(deliveryDir);
  fs.mkdirSync(deliveryParentDir, { recursive: true });
  fs.mkdirSync(deliveryDir, { recursive: false });

  fs.copyFileSync(manifestPath, path.join(deliveryDir, 'QualificationEvidenceManifestV1.json'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(path.join(deliveryDir, 'QualificationEvidenceVerificationResultV1.json'), verificationBytes, { flag: 'wx' });

  const descriptorBase = {
    schema_version: 'GEOXQualificationClosureDeliveryV1',
    delivery_id: deliveryId,
    consumer_scope: 'MCFT_CAP_09_CLOSURE_TEAM_EVIDENCE_INPUT',
    authority_ceiling: 'EVIDENCE_INPUT_ONLY_CLOSURE_TEAM_RETAINS_BLOCKER_ADJUDICATION_AUTHORITY',
    contract_id: manifest.contract_id,
    contract_version: manifest.contract_version,
    run_id: manifest.run_id,
    qualification_subject_sha: manifest.qualification_subject_sha,
    runtime_subject_sha: manifest.runtime_subject_sha,
    environment_digest: manifest.environment_digest,
    result: manifest.result,
    evidence_package_digest: manifest.evidence_package_digest,
    manifest_digest: manifest.manifest_digest,
    manifest_file_digest: manifestFileDigest,
    verification_result_digest: verificationDigest,
    exact_subject_binding_verified: true,
    package_integrity_verified: true,
    repository_inputs_verified: true,
    latest_run_fallback_used: false,
    runtime_mutated: false,
    production_mutation: false,
    blocker_semantics_modified: false,
    qcp_semantics_modified: false,
    closure_subject_mutated: false,
    supersedes_github_lane: false,
    generated_at: new Date().toISOString(),
    handoff_rule: 'CONSUMER_MUST_VERIFY_EXACT_DELIVERY_AND_SOURCE_PACKAGE_BEFORE_ADJUDICATION',
    mutation_rule: 'FINALIZED_DELIVERY_MUST_NOT_BE_MODIFIED_IN_PLACE_NEW_DELIVERY_ID_REQUIRED'
  };
  const descriptor = { ...descriptorBase, descriptor_digest: sha256Buffer(canonicalJson(descriptorBase)) };
  writeJsonExclusive(path.join(deliveryDir, 'ClosureDeliveryV1.json'), descriptor);

  const packageEntries = [
    'QualificationEvidenceManifestV1.json',
    'QualificationEvidenceVerificationResultV1.json',
    'ClosureDeliveryV1.json'
  ].map((name) => {
    const full = path.join(deliveryDir, name);
    return { path: name, sha256: sha256File(full), bytes: fs.statSync(full).size };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const deliveryPackageDigest = sha256Buffer(canonicalJson(packageEntries));
  writeJsonExclusive(path.join(deliveryDir, 'FINALIZED.json'), {
    schema_version: 'GEOXQualificationClosureDeliveryFinalizedV1',
    finalized: true,
    delivery_id: deliveryId,
    delivery_package_digest: deliveryPackageDigest,
    entries: packageEntries,
    finalized_at: new Date().toISOString(),
    mutation_rule: 'FINALIZED_DELIVERY_MUST_NOT_BE_MODIFIED_IN_PLACE_NEW_DELIVERY_ID_REQUIRED'
  });

  process.stdout.write(canonicalJson({
    schema_version: 'geox_qualification_closure_delivery_build_result_v1',
    status: 'PASS',
    delivery_id: deliveryId,
    delivery_dir: deliveryDir,
    run_id: manifest.run_id,
    qualification_subject_sha: manifest.qualification_subject_sha,
    runtime_subject_sha: manifest.runtime_subject_sha,
    evidence_package_digest: manifest.evidence_package_digest,
    manifest_digest: manifest.manifest_digest,
    delivery_package_digest: deliveryPackageDigest,
    runtime_mutated: false,
    production_mutation: false,
    closure_subject_mutated: false,
    qcp_semantics_modified: false
  }));
}

main();
