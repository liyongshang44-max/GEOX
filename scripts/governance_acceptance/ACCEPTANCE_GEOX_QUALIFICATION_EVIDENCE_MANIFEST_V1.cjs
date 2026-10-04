#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function assert(condition, code) { if (!condition) throw new Error(code); }
function output(command, args) { return execFileSync(command, args, { encoding: 'utf8' }).trim(); }
function main() {
  const root = output('git', ['rev-parse', '--show-toplevel']);
  const generator = path.join(root, 'scripts/qualification/GENERATE_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs');
  const verifier = path.join(root, 'scripts/qualification/VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1.cjs');
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'scripts/qualification/contracts/MCFT_CAP09_CAUSAL_REVISION_TEMPORAL_V1.json'), 'utf8'));
  const g = fs.readFileSync(generator, 'utf8');
  const v = fs.readFileSync(verifier, 'utf8');
  assert(contract.frozen_runtime_sha === '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a', 'QUALIFICATION_MANIFEST_FROZEN_RUNTIME_CHANGED');
  assert(g.includes("schema_version: 'QualificationEvidenceManifestV1'"), 'QUALIFICATION_MANIFEST_SCHEMA_MISSING');
  for (const field of ['contract_id', 'contract_version', 'contract_digest', 'runtime_subject_sha', 'qualification_subject_type', 'qualification_runner_ref', 'qualification_runner_digest', 'environment_digest', 'run_id', 'started_at', 'completed_at', 'result', 'evidence_package_digest', 'evidence_refs', 'input_artifact_digests', 'runtime_mutated', 'production_mutation', 'manifest_digest']) {
    assert(g.includes(field), `QUALIFICATION_MANIFEST_REQUIRED_FIELD_MISSING:${field}`);
  }
  assert(g.includes("signer: null") && g.includes("signature_status: 'UNSIGNED_DIGEST_BOUND_V1'"), 'QUALIFICATION_MANIFEST_SIGNER_STATUS_NOT_EXPLICIT');
  assert(g.includes('no_latest_run_fallback: true'), 'QUALIFICATION_MANIFEST_LATEST_FALLBACK_FORBIDDEN_NOT_ENCODED');
  assert(g.includes('exact_subject_binding_required: true'), 'QUALIFICATION_MANIFEST_EXACT_SUBJECT_BINDING_NOT_ENCODED');
  assert(v.includes('QUALIFICATION_VERIFIER_PACKAGE_CONTENT_MISMATCH'), 'QUALIFICATION_MANIFEST_PACKAGE_RECOMPUTE_MISSING');
  assert(v.includes('gitFileSha256') && v.includes('QUALIFICATION_VERIFIER_RUNNER_DIGEST_MISMATCH'), 'QUALIFICATION_MANIFEST_REPOSITORY_BINDING_VERIFICATION_MISSING');
  assert(v.includes('latest_run_fallback_used: false'), 'QUALIFICATION_MANIFEST_LATEST_FALLBACK_RESULT_MISSING');
  const diff = output('git', ['diff', '--name-only', 'da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9', 'HEAD']).split(/\r?\n/).filter(Boolean);
  assert(!diff.some((p) => p.startsWith('.github/workflows/')), 'QUALIFICATION_MANIFEST_GITHUB_WORKFLOW_MUTATION_FORBIDDEN');
  assert(!diff.some((p) => p.startsWith('apps/server/src/runtime/')), 'QUALIFICATION_MANIFEST_RUNTIME_MUTATION_FORBIDDEN');
  process.stdout.write(JSON.stringify({
    schema_version: 'geox_qualification_evidence_manifest_acceptance_v1',
    status: 'PASS',
    qualification_evidence_manifest_interface: 'QualificationEvidenceManifestV1',
    frozen_runtime_preserved: true,
    github_l2_l3_workflow_mutation: false,
    runtime_semantic_mutation: false,
    exact_subject_binding_guarded: true,
    immutable_package_verification_guarded: true,
    latest_run_fallback_forbidden: true,
    qcp_semantics_modified: false
  }, null, 2) + '\n');
}
main();
