#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const REGISTRATION_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-SUCCESSOR-VERIFIED-DELIVERY-REGISTRATION-V1.json';
const ACCEPTANCE_REF = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_VERIFIED_DELIVERY_REGISTRATION_V1.cjs';
const QCP_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
const REGISTRY_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-EVIDENCE-REGISTRY-V1.json';
const VERIFIER2_REF = 'scripts/qualification/VERIFY_GEOX_QUALIFICATION_CLOSURE_DELIVERY_V1.cjs';
const CONTRACT_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1.json';
const DEFAULT_ADJUDICATION_OUT = 'acceptance-output/MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_CLOSURE_ADJUDICATION_V1.json';

const EXPECTED = Object.freeze({
  registrationId: 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_VERIFIED_DELIVERY_4EE4989F_V1',
  subject: '4ee4989fc4f40cc52a3819be282c1d192b58a9b2',
  runtime: '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a',
  closureSemanticSubject: 'da09a68fc7ed39a0bc702a0c6cf8ef9e334dd8c9',
  frozenQcpSubject: '3bbf096ee5cb73e8e0e0251dc400733d6cab501f',
  preRegistrationQcpBlob: '63a04286600a03463b22bb066ca88c1860b2d9d5',
  registryBlob: '626d5c277b7f8fbd194d3c0849a9337082d6e2b5',
  runId: 'mcft_cap09_am19_persistent_24t_historical_logical_v1-20261002t122627462z-4ee4989fc4f4-dd17a3a4',
  environmentDigest: 'sha256:7ca3312d9343566c196f697cf2f03848e2dacd7d44190b92e828ea286bca2039',
  evidencePackageDigest: 'sha256:99ddad64a525f7bd22c55be5a9d994bd09118e77ae7e86d383056ca4f492e40f',
  manifestDigest: 'sha256:970cfbf743d44f9c1c84e9fd20e297f90a41e611b3466d55f97985d9534ecaec',
  deliveryId: 'mcft_cap09_am19_persistent_24t_historical_logical_v1-20261002t122627462z-4ee4989fc4f4-dd17a3a4-970cfbf743d4',
  deliveryPackageDigest: 'sha256:c1f9987f7fd5776a1683b85f95941bd454aac1ea1410a1921809f5c9c4404a1a',
  legacyEvidenceId: 'LEGACY_AM19_24T_SUCCESSOR_ROUTING_3BBF096E',
  legacyCheckId: 'LEGACY_AM19_PERSISTENT_24T',
  legacyGeneration: 'historical-am19-successor-maintenance-routing',
});

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, ref), 'utf8'));
}

function readJsonPath(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
}

function isAncestor(ancestor, descendant) {
  if (!/^[0-9a-f]{40}$/.test(String(ancestor || '')) || !/^[0-9a-f]{40}$/.test(String(descendant || ''))) return false;
  const r = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
  return r.status === 0;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`VERIFIED_DELIVERY_REGISTRATION_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  return out;
}

function requireBool(value, expected, code) {
  assert.equal(value, expected, code);
}

function verifyRegistration(reg) {
  assert.equal(reg.schema_version, 'geox_mcft_cap09_am19_historical_logical_successor_verified_delivery_registration_v1', 'REGISTRATION_SCHEMA_REQUIRED');
  assert.equal(reg.registration_id, EXPECTED.registrationId, 'REGISTRATION_ID_REQUIRED');
  assert.equal(reg.registration_version, 1, 'REGISTRATION_VERSION_REQUIRED');
  assert.equal(reg.status, 'VERIFIED_DELIVERY_READY_FOR_QCP_CENTRAL_OWNERSHIP', 'REGISTRATION_STATUS_REQUIRED');
  assert.equal(reg.current_admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1', 'REGISTRATION_ROUTE_REQUIRED');

  assert.equal(reg.qualification.contract_id, 'MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1', 'REGISTRATION_CONTRACT_REQUIRED');
  assert.equal(reg.qualification.qualification_subject_sha, EXPECTED.subject, 'REGISTRATION_SUBJECT_REQUIRED');
  assert.equal(reg.qualification.runtime_subject_sha, EXPECTED.runtime, 'REGISTRATION_RUNTIME_REQUIRED');
  assert.equal(reg.qualification.closure_semantic_subject_sha, EXPECTED.closureSemanticSubject, 'REGISTRATION_CLOSURE_SEMANTIC_SUBJECT_REQUIRED');
  assert.equal(reg.qualification.run_id, EXPECTED.runId, 'REGISTRATION_RUN_ID_REQUIRED');
  assert.equal(reg.qualification.environment_digest, EXPECTED.environmentDigest, 'REGISTRATION_ENVIRONMENT_DIGEST_REQUIRED');
  assert.equal(reg.qualification.evidence_package_digest, EXPECTED.evidencePackageDigest, 'REGISTRATION_EVIDENCE_PACKAGE_DIGEST_REQUIRED');
  assert.equal(reg.qualification.result, 'PASS', 'REGISTRATION_QUALIFICATION_PASS_REQUIRED');
  requireBool(reg.qualification.fresh_historical_successor_13_of_13, true, 'REGISTRATION_13OF13_REQUIRED');

  assert.equal(reg.manifest.manifest_digest, EXPECTED.manifestDigest, 'REGISTRATION_MANIFEST_DIGEST_REQUIRED');
  assert.equal(reg.manifest.verifier_1_status, 'PASS', 'REGISTRATION_VERIFIER1_PASS_REQUIRED');
  requireBool(reg.manifest.exact_subject_binding_verified, true, 'REGISTRATION_VERIFIER1_SUBJECT_BINDING_REQUIRED');
  requireBool(reg.manifest.package_integrity_verified, true, 'REGISTRATION_VERIFIER1_PACKAGE_REQUIRED');
  requireBool(reg.manifest.repository_inputs_verified, true, 'REGISTRATION_VERIFIER1_REPOSITORY_INPUTS_REQUIRED');
  requireBool(reg.manifest.qualification_inputs_verified, true, 'REGISTRATION_VERIFIER1_QUALIFICATION_INPUTS_REQUIRED');
  requireBool(reg.manifest.latest_run_fallback_used, false, 'REGISTRATION_VERIFIER1_LATEST_FALLBACK_FORBIDDEN');

  assert.equal(reg.closure_delivery.delivery_id, EXPECTED.deliveryId, 'REGISTRATION_DELIVERY_ID_REQUIRED');
  assert.equal(reg.closure_delivery.delivery_package_digest, EXPECTED.deliveryPackageDigest, 'REGISTRATION_DELIVERY_PACKAGE_DIGEST_REQUIRED');
  assert.equal(reg.closure_delivery.verifier_2_status, 'PASS', 'REGISTRATION_VERIFIER2_PASS_REQUIRED');
  requireBool(reg.closure_delivery.exact_subject_binding_verified, true, 'REGISTRATION_VERIFIER2_SUBJECT_BINDING_REQUIRED');
  requireBool(reg.closure_delivery.package_integrity_verified, true, 'REGISTRATION_VERIFIER2_PACKAGE_REQUIRED');
  requireBool(reg.closure_delivery.repository_inputs_verified, true, 'REGISTRATION_VERIFIER2_REPOSITORY_INPUTS_REQUIRED');
  requireBool(reg.closure_delivery.latest_run_fallback_used, false, 'REGISTRATION_VERIFIER2_LATEST_FALLBACK_FORBIDDEN');
  for (const key of ['runtime_mutated', 'production_mutation', 'blocker_semantics_modified', 'qcp_semantics_modified', 'closure_subject_mutated', 'supersedes_github_lane']) {
    requireBool(reg.closure_delivery[key], false, `REGISTRATION_VERIFIER2_NON_EFFECT_REQUIRED:${key}`);
  }

  assert.equal(reg.qcp_registration.qcp_ref, QCP_REF, 'REGISTRATION_QCP_REF_REQUIRED');
  assert.equal(reg.qcp_registration.qcp_pre_registration_blob_sha, EXPECTED.preRegistrationQcpBlob, 'REGISTRATION_QCP_PRE_BLOB_REQUIRED');
  assert.equal(reg.qcp_registration.qcp_existing_frozen_successor_subject_sha, EXPECTED.frozenQcpSubject, 'REGISTRATION_QCP_FROZEN_SUBJECT_REQUIRED');
  assert.equal(reg.qcp_registration.registration_mechanism, 'CONTROL_PLANE_FILES_CENTRAL_OWNERSHIP_ONLY', 'REGISTRATION_MECHANISM_REQUIRED');
  assert.equal(reg.qcp_registration.registration_basis_ref, REGISTRATION_REF, 'REGISTRATION_BASIS_REF_REQUIRED');
  assert.equal(reg.qcp_registration.registration_acceptance_ref, ACCEPTANCE_REF, 'REGISTRATION_ACCEPTANCE_REF_REQUIRED');
  requireBool(reg.qcp_registration.must_not_change_frozen_successor_subject_sha, true, 'REGISTRATION_QCP_FROZEN_SUBJECT_GUARD_REQUIRED');
  requireBool(reg.qcp_registration.must_not_register_into_legacy_workflow_evidence_entries, true, 'REGISTRATION_LEGACY_ENTRY_GUARD_REQUIRED');
  requireBool(reg.qcp_registration.must_not_change_v13_qualification_harness_dependency_set, true, 'REGISTRATION_V13_RESOLVER_GUARD_REQUIRED');
  requireBool(reg.qcp_registration.must_not_change_qcp_check_decision_semantics, true, 'REGISTRATION_QCP_DECISION_GUARD_REQUIRED');

  assert.equal(reg.legacy_registry_boundary.registry_ref, REGISTRY_REF, 'REGISTRATION_REGISTRY_REF_REQUIRED');
  assert.equal(reg.legacy_registry_boundary.registry_blob_sha, EXPECTED.registryBlob, 'REGISTRATION_REGISTRY_BLOB_REQUIRED');
  assert.equal(reg.legacy_registry_boundary.legacy_evidence_id, EXPECTED.legacyEvidenceId, 'REGISTRATION_LEGACY_EVIDENCE_ID_REQUIRED');
  assert.equal(reg.legacy_registry_boundary.legacy_check_id, EXPECTED.legacyCheckId, 'REGISTRATION_LEGACY_CHECK_ID_REQUIRED');
  assert.equal(reg.legacy_registry_boundary.legacy_generation, EXPECTED.legacyGeneration, 'REGISTRATION_LEGACY_GENERATION_REQUIRED');
  requireBool(reg.legacy_registry_boundary.legacy_entry_must_remain_unchanged, true, 'REGISTRATION_LEGACY_ENTRY_IMMUTABILITY_REQUIRED');
  requireBool(reg.legacy_registry_boundary.current_successor_must_not_be_inserted_into_legacy_entries, true, 'REGISTRATION_CURRENT_SUCCESSOR_LEGACY_INSERT_FORBIDDEN');

  assert.equal(reg.consumer_boundary.consumer_scope, 'MCFT_CAP_09_CLOSURE_TEAM_EVIDENCE_INPUT', 'REGISTRATION_CONSUMER_SCOPE_REQUIRED');
  assert.equal(reg.consumer_boundary.authority_ceiling, 'EVIDENCE_INPUT_ONLY_CLOSURE_TEAM_RETAINS_BLOCKER_ADJUDICATION_AUTHORITY', 'REGISTRATION_AUTHORITY_CEILING_REQUIRED');
  requireBool(reg.consumer_boundary.closure_adjudication_performed, false, 'REGISTRATION_PREMATURE_CLOSURE_ADJUDICATION_FORBIDDEN');
  requireBool(reg.consumer_boundary.mcft_cap09_completion_claim, false, 'REGISTRATION_PREMATURE_COMPLETION_FORBIDDEN');
}

function verifyQcpAndRegistry(reg, args) {
  const qcp = readJson(QCP_REF);
  const registry = readJson(REGISTRY_REF);
  assert.equal(qcp.authority_id, 'MCFT_CAP09_CHECK_APPLICABILITY_V1', 'REGISTRATION_QCP_AUTHORITY_REQUIRED');
  assert.equal(qcp.frozen_successor_subject_sha, EXPECTED.frozenQcpSubject, 'REGISTRATION_QCP_FROZEN_SUBJECT_DRIFT');
  assert.equal(registry.registry_id, 'MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1', 'REGISTRATION_REGISTRY_ID_REQUIRED');
  assert.equal(git('rev-parse', `HEAD:${REGISTRY_REF}`), EXPECTED.registryBlob, 'REGISTRATION_REGISTRY_BLOB_DRIFT');

  const legacy = (registry.entries || []).find((entry) => entry.evidence_id === EXPECTED.legacyEvidenceId);
  assert(legacy, 'REGISTRATION_LEGACY_ENTRY_REQUIRED');
  assert.equal(legacy.check_id, EXPECTED.legacyCheckId, 'REGISTRATION_LEGACY_CHECK_DRIFT');
  assert.equal(legacy.generation, EXPECTED.legacyGeneration, 'REGISTRATION_LEGACY_GENERATION_DRIFT');
  assert.equal((registry.entries || []).some((entry) => entry.subject_sha === EXPECTED.subject), false, 'REGISTRATION_CURRENT_SUCCESSOR_LEGACY_REGISTRY_INSERT_FORBIDDEN');

  const control = qcp.dependency_resolvers?.CONTROL_PLANE_FILES;
  assert.equal(control?.kind, 'EXACT_PATH_SET', 'REGISTRATION_CONTROL_PLANE_RESOLVER_REQUIRED');
  const paths = control.paths || [];
  const basisPresent = paths.includes(REGISTRATION_REF);
  const acceptancePresent = paths.includes(ACCEPTANCE_REF);
  assert.equal(basisPresent, acceptancePresent, 'REGISTRATION_QCP_PARTIAL_OWNERSHIP_FORBIDDEN');
  if (args['require-qcp-registered']) assert.equal(basisPresent, true, 'REGISTRATION_QCP_CENTRAL_OWNERSHIP_REQUIRED');
  if (args['require-qcp-unregistered']) assert.equal(basisPresent, false, 'REGISTRATION_QCP_MUST_BE_UNREGISTERED_BEFORE_PATCH');

  const v13Paths = qcp.dependency_resolvers?.V13_QUALIFICATION_HARNESS_CLOSURE?.paths || [];
  assert.equal(v13Paths.includes(REGISTRATION_REF), false, 'REGISTRATION_V13_RESOLVER_CIRCULARITY_FORBIDDEN');
  assert.equal(v13Paths.includes(ACCEPTANCE_REF), false, 'REGISTRATION_V13_RESOLVER_ACCEPTANCE_CIRCULARITY_FORBIDDEN');

  return { qcp, registry, qcpRegistered: basisPresent, controlPlanePathCount: paths.length };
}

function verifyLocalDelivery(args) {
  if (!args['delivery-dir'] && !args['run-dir']) return { performed: false };
  if (!args['delivery-dir'] || !args['run-dir']) throw new Error('REGISTRATION_LOCAL_DELIVERY_AND_RUN_DIR_REQUIRED_TOGETHER');
  const deliveryDir = path.resolve(args['delivery-dir']);
  const runDir = path.resolve(args['run-dir']);
  const verifier = path.join(ROOT, VERIFIER2_REF);
  const r = spawnSync(process.execPath, [verifier, '--delivery-dir', deliveryDir, '--run-dir', runDir, '--repo', ROOT], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`REGISTRATION_LOCAL_DELIVERY_REVERIFY_FAILED:${r.status}:${String(r.stderr || '').trim()}`);
  const proof = JSON.parse(r.stdout);
  assert.equal(proof.status, 'PASS', 'REGISTRATION_LOCAL_DELIVERY_PASS_REQUIRED');
  assert.equal(proof.delivery_id, EXPECTED.deliveryId, 'REGISTRATION_LOCAL_DELIVERY_ID_MISMATCH');
  assert.equal(proof.delivery_package_digest, EXPECTED.deliveryPackageDigest, 'REGISTRATION_LOCAL_DELIVERY_DIGEST_MISMATCH');
  assert.equal(proof.evidence_package_digest, EXPECTED.evidencePackageDigest, 'REGISTRATION_LOCAL_EVIDENCE_DIGEST_MISMATCH');
  assert.equal(proof.qualification_subject_sha, EXPECTED.subject, 'REGISTRATION_LOCAL_SUBJECT_MISMATCH');
  assert.equal(proof.runtime_subject_sha, EXPECTED.runtime, 'REGISTRATION_LOCAL_RUNTIME_MISMATCH');
  assert.equal(proof.exact_subject_binding_verified, true, 'REGISTRATION_LOCAL_SUBJECT_BINDING_REQUIRED');
  assert.equal(proof.package_integrity_verified, true, 'REGISTRATION_LOCAL_PACKAGE_INTEGRITY_REQUIRED');
  assert.equal(proof.repository_inputs_verified, true, 'REGISTRATION_LOCAL_REPOSITORY_INPUTS_REQUIRED');
  assert.equal(proof.latest_run_fallback_used, false, 'REGISTRATION_LOCAL_LATEST_FALLBACK_FORBIDDEN');
  return { performed: true, proof };
}

function adjudicateLegacyAm19(reg, qcpProof, args) {
  assert.equal(args['adjudicate-legacy-am19'], true, 'AM19_CLOSURE_ADJUDICATION_MODE_REQUIRED');
  const allBlockersRef = String(args['all-blockers'] || '').trim();
  assert(allBlockersRef, 'AM19_CLOSURE_ADJUDICATION_ALL_BLOCKERS_REQUIRED');
  const allBlockers = readJsonPath(allBlockersRef);
  const contract = readJson(CONTRACT_REF);

  assert.equal(allBlockers.preflight_id, 'MCFT_CAP09_ALL_BLOCKERS_PREFLIGHT_V1', 'AM19_CLOSURE_ADJUDICATION_PREFLIGHT_ID_REQUIRED');
  assert.equal(allBlockers.planner_status, 'PASS', 'AM19_CLOSURE_ADJUDICATION_PLANNER_PASS_REQUIRED');
  assert.equal(allBlockers.base_sha, EXPECTED.subject, 'AM19_CLOSURE_ADJUDICATION_BASE_SUBJECT_MISMATCH');
  assert(/^[0-9a-f]{40}$/.test(String(allBlockers.head_sha || '')), 'AM19_CLOSURE_ADJUDICATION_HEAD_SHA_REQUIRED');
  assert.equal(isAncestor(EXPECTED.subject, allBlockers.head_sha), true, 'AM19_CLOSURE_ADJUDICATION_SUBJECT_ANCESTRY_REQUIRED');

  const legacyResults = (allBlockers.results || []).filter((row) => row.check_id === EXPECTED.legacyCheckId);
  assert.equal(legacyResults.length, 1, 'AM19_CLOSURE_ADJUDICATION_LEGACY_RESULT_CARDINALITY');
  const legacyResult = legacyResults[0];
  assert.equal(legacyResult.status, 'FAIL', 'AM19_CLOSURE_ADJUDICATION_RAW_LEGACY_FAIL_REQUIRED');
  assert.equal(legacyResult.reason_code, 'NO_VALID_REQUALIFICATION_EVIDENCE', 'AM19_CLOSURE_ADJUDICATION_RAW_REASON_REQUIRED');

  const legacyBlockers = (allBlockers.blockers || []).filter((row) => row.check_id === EXPECTED.legacyCheckId);
  assert.equal(legacyBlockers.length, 1, 'AM19_CLOSURE_ADJUDICATION_LEGACY_BLOCKER_CARDINALITY');

  assert.equal(contract.contract_id, 'MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1', 'AM19_CLOSURE_ADJUDICATION_CONTRACT_ID_REQUIRED');
  assert.equal(contract.frozen_runtime_sha, EXPECTED.runtime, 'AM19_CLOSURE_ADJUDICATION_RUNTIME_SUBJECT_MISMATCH');
  assert.equal(contract.closure_semantic_subject_sha, EXPECTED.closureSemanticSubject, 'AM19_CLOSURE_ADJUDICATION_SEMANTIC_SUBJECT_MISMATCH');
  assert.equal(legacyResult.dependency_digest, contract.closure_authoritative_dependency_digest, 'AM19_CLOSURE_ADJUDICATION_DEPENDENCY_DIGEST_MISMATCH');

  assert.equal(reg.qualification.qualification_subject_sha, allBlockers.base_sha, 'AM19_CLOSURE_ADJUDICATION_REGISTRATION_BASE_MISMATCH');
  assert.equal(reg.qualification.result, 'PASS', 'AM19_CLOSURE_ADJUDICATION_QUALIFICATION_PASS_REQUIRED');
  assert.equal(reg.qualification.fresh_historical_successor_13_of_13, true, 'AM19_CLOSURE_ADJUDICATION_13OF13_REQUIRED');
  assert.equal(reg.manifest.verifier_1_status, 'PASS', 'AM19_CLOSURE_ADJUDICATION_MANIFEST_PASS_REQUIRED');
  assert.equal(reg.manifest.exact_subject_binding_verified, true, 'AM19_CLOSURE_ADJUDICATION_MANIFEST_SUBJECT_BINDING_REQUIRED');
  assert.equal(reg.manifest.package_integrity_verified, true, 'AM19_CLOSURE_ADJUDICATION_MANIFEST_PACKAGE_REQUIRED');
  assert.equal(reg.manifest.repository_inputs_verified, true, 'AM19_CLOSURE_ADJUDICATION_MANIFEST_REPOSITORY_INPUTS_REQUIRED');
  assert.equal(reg.manifest.qualification_inputs_verified, true, 'AM19_CLOSURE_ADJUDICATION_MANIFEST_QUALIFICATION_INPUTS_REQUIRED');
  assert.equal(reg.manifest.latest_run_fallback_used, false, 'AM19_CLOSURE_ADJUDICATION_MANIFEST_FALLBACK_FORBIDDEN');
  assert.equal(reg.closure_delivery.verifier_2_status, 'PASS', 'AM19_CLOSURE_ADJUDICATION_DELIVERY_PASS_REQUIRED');
  assert.equal(reg.closure_delivery.exact_subject_binding_verified, true, 'AM19_CLOSURE_ADJUDICATION_DELIVERY_SUBJECT_BINDING_REQUIRED');
  assert.equal(reg.closure_delivery.package_integrity_verified, true, 'AM19_CLOSURE_ADJUDICATION_DELIVERY_PACKAGE_REQUIRED');
  assert.equal(reg.closure_delivery.repository_inputs_verified, true, 'AM19_CLOSURE_ADJUDICATION_DELIVERY_REPOSITORY_INPUTS_REQUIRED');
  assert.equal(reg.closure_delivery.latest_run_fallback_used, false, 'AM19_CLOSURE_ADJUDICATION_DELIVERY_FALLBACK_FORBIDDEN');
  assert.equal(qcpProof.qcpRegistered, true, 'AM19_CLOSURE_ADJUDICATION_QCP_OWNERSHIP_REQUIRED');
  assert.equal(git('rev-parse', `HEAD:${REGISTRY_REF}`), EXPECTED.registryBlob, 'AM19_CLOSURE_ADJUDICATION_LEGACY_REGISTRY_BLOB_DRIFT');
  assert.equal((qcpProof.registry.entries || []).some((entry) => entry.subject_sha === EXPECTED.subject), false, 'AM19_CLOSURE_ADJUDICATION_CURRENT_SUCCESSOR_LEGACY_INSERT_FORBIDDEN');

  for (const key of ['runtime_mutated', 'production_mutation', 'blocker_semantics_modified', 'qcp_semantics_modified', 'closure_subject_mutated', 'supersedes_github_lane']) {
    assert.equal(reg.closure_delivery[key], false, `AM19_CLOSURE_ADJUDICATION_DELIVERY_NON_EFFECT_REQUIRED:${key}`);
  }

  const rawBlockers = allBlockers.blockers || [];
  const remainingBlockers = rawBlockers.filter((row) => row.check_id !== EXPECTED.legacyCheckId);
  assert.equal(rawBlockers.length - remainingBlockers.length, 1, 'AM19_CLOSURE_ADJUDICATION_EXACTLY_ONE_BLOCKER_ADMITTED');

  const result = {
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_closure_adjudication_v1',
    status: 'PASS',
    adjudication_id: 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_CLOSURE_ADJUDICATION_4EE4989F_V1',
    check_id: EXPECTED.legacyCheckId,
    execution: 'AM19_HISTORICAL_LOGICAL_SUCCESSOR_VERIFIED_DELIVERY_ADJUDICATION',
    reason_code: 'CURRENT_SUCCESSOR_VERIFIED_DELIVERY_AND_DEPENDENCY_DIGEST_VALID',
    raw_preflight_ref: allBlockersRef,
    raw_preflight_status: allBlockers.status,
    planner_status: allBlockers.planner_status,
    base_sha: allBlockers.base_sha,
    head_sha: allBlockers.head_sha,
    qualification_subject_sha: EXPECTED.subject,
    runtime_subject_sha: EXPECTED.runtime,
    closure_semantic_subject_sha: EXPECTED.closureSemanticSubject,
    dependency_digest: legacyResult.dependency_digest,
    contract_dependency_digest: contract.closure_authoritative_dependency_digest,
    evidence_package_digest: EXPECTED.evidencePackageDigest,
    manifest_digest: EXPECTED.manifestDigest,
    delivery_id: EXPECTED.deliveryId,
    delivery_package_digest: EXPECTED.deliveryPackageDigest,
    qcp_central_ownership_registered: true,
    legacy_registry_blob_unchanged: true,
    current_successor_inserted_into_legacy_registry: false,
    raw_blocker_count: rawBlockers.length,
    admitted_blocker_count: 1,
    adjudicated_blocker_count: remainingBlockers.length,
    remaining_blockers: remainingBlockers,
    closure_effect: 'LEGACY_AM19_PERSISTENT_24T_SATISFIED_BY_CURRENT_SUCCESSOR_VERIFIED_DELIVERY',
    non_effects: {
      legacy_registry_mutation: false,
      qcp_planner_decision_semantics_mutation: false,
      runtime_mutation: false,
      production_mutation: false,
      formal_v5_arm: false,
      a0: false,
      o00_o23: false,
      mcft_cap09_completion_claim: false,
    },
  };

  const outRef = String(args['adjudication-out'] || DEFAULT_ADJUDICATION_OUT).trim();
  const outPath = path.resolve(ROOT, outRef);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const reg = readJson(REGISTRATION_REF);
  verifyRegistration(reg);
  const qcpProof = verifyQcpAndRegistry(reg, args);
  const local = verifyLocalDelivery(args);
  const adjudication = args['adjudicate-legacy-am19'] ? adjudicateLegacyAm19(reg, qcpProof, args) : null;

  process.stdout.write(`${JSON.stringify({
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_verified_delivery_registration_acceptance_v1',
    status: 'PASS',
    registration_id: reg.registration_id,
    qualification_subject_sha: EXPECTED.subject,
    runtime_subject_sha: EXPECTED.runtime,
    evidence_package_digest: EXPECTED.evidencePackageDigest,
    manifest_digest: EXPECTED.manifestDigest,
    delivery_id: EXPECTED.deliveryId,
    delivery_package_digest: EXPECTED.deliveryPackageDigest,
    local_delivery_reverified: local.performed,
    qcp_central_ownership_registered: qcpProof.qcpRegistered,
    control_plane_path_count: qcpProof.controlPlanePathCount,
    qcp_frozen_successor_subject_unchanged: true,
    legacy_registry_blob_unchanged: true,
    current_successor_inserted_into_legacy_registry: false,
    v13_harness_dependency_set_modified: false,
    qcp_check_decision_semantics_modified: false,
    closure_adjudication_performed: Boolean(adjudication),
    closure_adjudication_status: adjudication?.status ?? null,
    closure_adjudication_check_id: adjudication?.check_id ?? null,
    raw_blocker_count: adjudication?.raw_blocker_count ?? null,
    adjudicated_blocker_count: adjudication?.adjudicated_blocker_count ?? null,
    formal_v5_arm: false,
    a0: false,
    o00_o23: false,
  }, null, 2)}\n`);
}

main();
