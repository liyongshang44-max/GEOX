#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PROFILE_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1.json';
const CONTRACT_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1.json';
const BINDING_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_BINDINGS_V1.json';
const RUNNER_REF = 'scripts/qualification/RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_V1.cjs';
const VERIFIER_REF = 'scripts/qualification/VERIFY_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_V1.cjs';
const PREFLIGHT_REF = 'scripts/qualification/RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PREFLIGHT_V1.cjs';
const PROFILE_ID = 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1';
const CONTRACT_ID = 'MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1';
const BINDING_ID = 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_BINDINGS_V1';
const RUNTIME_SHA = '3d5fd13c8f5babd2edc5107206f43a5e5d12eb4a';
const DESCRIPTOR_REF = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json';
const EPOCH_ID = 'mcft_cap09_am19_historical_logical_20260821t190000z_v1';
const PRODUCER_SHA = '91d2f518efc5c4c7796c398dabd12801949a9289';
const TARGET_T = '2026-08-21T19:00:00.000Z';
const SEMANTIC_DIGEST = 'sha256:4123573d4a936a8d4c5c39da2d323b10426fbd156b34aa2d6866490ba7c3a132';
const EXECUTION_PLANE = 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER';
const EXECUTION_POSTGRES_IMAGE = 'postgres@sha256:3725f4e2499eef5134592b3b4ab79a543ed7f8e533b05b5b637af926630f6650';
const SCHEMA_CLIENT_IMAGE = 'postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722';
const PARENT_DATABASE_NAME = 'geox_mcft_cap09_s6_formal_t4r1_24h_v5';
const REMOTE_PARENT_POLICY = 'READ_ONLY_SCHEMA_SOURCE_AND_REHYDRATION_PROVENANCE_ONLY';
const FORMAL_ADMISSION_POLICY = 'DECOUPLED_UNCHANGED_REAL_CLOCK_CROP_PREFLIGHT';
const CROP_WINDOW = 'CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS';
const HISTORICAL_RUNNER_REF = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts';
const HISTORICAL_CROP_PREFLIGHT_SOURCE_REF = 'scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1.cjs';
const REHYDRATION_SOURCE_REF = 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts';

function readJson(root, ref) {
  return JSON.parse(fs.readFileSync(path.resolve(root, ref), 'utf8'));
}

function readText(root, ref) {
  return fs.readFileSync(path.resolve(root, ref), 'utf8');
}

function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function gitBlob(root, ref) {
  return execFileSync('git', ['rev-parse', `HEAD:${ref}`], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

function assertBlob(root, ref, expected, code) {
  const actual = gitBlob(root, ref);
  assert.equal(actual, expected, `${code}:${actual}:${expected}`);
  return actual;
}

function assertSource(source, pattern, code) {
  assert.match(source, pattern, code);
}

function run() {
  const root = process.cwd();
  const profile = readJson(root, PROFILE_REF);
  const contract = readJson(root, CONTRACT_REF);
  const binding = readJson(root, BINDING_REF);
  const descriptor = readJson(root, contract.historical_logical_epoch_descriptor_ref);
  const runner = readText(root, RUNNER_REF);
  const preflight = readText(root, PREFLIGHT_REF);

  assert.equal(profile.schema_version, 'geox_mcft_cap09_am19_historical_logical_successor_profile_v1');
  assert.equal(profile.profile_id, PROFILE_ID);
  assert.equal(profile.profile_version, 1);
  assert.equal(profile.status, 'CURRENT_SUCCESSOR_PROFILE');
  assert.equal(profile.admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1');
  assert.equal(profile.authority_ceiling, 'QUALIFICATION_EVIDENCE_PRODUCER_ONLY');
  assert.equal(profile.single_current_contract_ref, CONTRACT_REF);
  assert.equal(profile.single_current_contract_id, CONTRACT_ID);
  assert.equal(profile.single_current_runner_ref, RUNNER_REF);
  assert.equal(profile.controlled_host_preflight_ref, PREFLIGHT_REF);
  assert.equal(profile.design_reconciliation_binding_ref, BINDING_REF);

  assert.equal(contract.schema_version, 'geox_qualification_contract_v1');
  assert.equal(contract.contract_id, CONTRACT_ID);
  assert.equal(contract.contract_version, 1);
  assert.equal(contract.authority_ceiling, 'QUALIFICATION_EVIDENCE_PRODUCER_ONLY');
  assert.equal(contract.successor_profile_ref, PROFILE_REF);
  assert.equal(contract.successor_profile_id, PROFILE_ID);
  assert.equal(contract.successor_profile_version, 1);
  assert.equal(contract.current_admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1');
  assert.equal(contract.reconciliation_verifier_ref, VERIFIER_REF);
  assert.equal(contract.successor_preflight_ref, PREFLIGHT_REF);
  assert.equal(contract.design_reconciliation_binding_ref, BINDING_REF);
  assert.equal(contract.qualification_runner_ref, RUNNER_REF);

  assert.equal(binding.schema_version, 'geox_mcft_cap09_am19_historical_logical_successor_reconciliation_bindings_v1');
  assert.equal(binding.binding_id, BINDING_ID);
  assert.equal(binding.binding_version, 1);
  assert.equal(binding.status, 'CURRENT_STATIC_RECONCILIATION_BINDING');
  assert.equal(binding.admission_route, 'HISTORICAL_LOGICAL_SUCCESSOR_V1');
  assert.equal(binding.profile_ref, PROFILE_REF);
  assert.equal(binding.contract_ref, CONTRACT_REF);
  assert.equal(binding.runner_ref, RUNNER_REF);
  assert.equal(binding.preflight_ref, PREFLIGHT_REF);
  assert.equal(binding.reconciliation_verifier_ref, VERIFIER_REF);

  assert.equal(profile.frozen_runtime_sha, RUNTIME_SHA);
  assert.equal(contract.frozen_runtime_sha, RUNTIME_SHA);
  assert.equal(binding.frozen_runtime_sha, RUNTIME_SHA);
  assert.equal(profile.historical_logical_epoch.descriptor_ref, DESCRIPTOR_REF);
  assert.equal(contract.historical_logical_epoch_descriptor_ref, DESCRIPTOR_REF);
  assert.equal(binding.historical_logical_epoch.descriptor_ref, DESCRIPTOR_REF);
  assert.equal(profile.historical_logical_epoch.epoch_id, EPOCH_ID);
  assert.equal(contract.historical_logical_epoch_id, EPOCH_ID);
  assert.equal(binding.historical_logical_epoch.epoch_id, EPOCH_ID);
  assert.equal(descriptor.epoch_id, EPOCH_ID);
  assert.equal(profile.historical_logical_epoch.producer_subject_sha, PRODUCER_SHA);
  assert.equal(contract.historical_producer_subject_sha, PRODUCER_SHA);
  assert.equal(binding.historical_logical_epoch.producer_subject_sha, PRODUCER_SHA);
  assert.equal(descriptor.historical_producer.producer_subject_sha, PRODUCER_SHA);
  assert.equal(profile.historical_logical_epoch.target_t, TARGET_T);
  assert.equal(contract.historical_target_t, TARGET_T);
  assert.equal(binding.historical_logical_epoch.target_t, TARGET_T);
  assert.equal(descriptor.logical_epoch.target_t, TARGET_T);
  assert.equal(profile.historical_logical_epoch.semantic_manifest_digest, SEMANTIC_DIGEST);
  assert.equal(binding.historical_logical_epoch.semantic_manifest_digest, SEMANTIC_DIGEST);
  assert.equal(descriptor.logical_epoch.semantic_manifest_digest, SEMANTIC_DIGEST);
  assert.equal(profile.historical_logical_epoch.retained_raw_object_count, 2);
  assert.equal(binding.historical_logical_epoch.retained_raw_object_count, 2);
  assert.equal(descriptor.retained_raw_objects.length, 2);
  assert.equal(profile.historical_logical_epoch.provider_refetch_authorized, false);
  assert.equal(binding.historical_logical_epoch.provider_refetch_authorized, false);

  assert.equal(profile.database.execution_plane, EXECUTION_PLANE);
  assert.equal(contract.database_execution_plane, EXECUTION_PLANE);
  assert.equal(binding.provisioning.database_execution_plane, EXECUTION_PLANE);
  assert.equal(profile.database.execution_postgres_image, EXECUTION_POSTGRES_IMAGE);
  assert.equal(contract.execution_postgres_image, EXECUTION_POSTGRES_IMAGE);
  assert.equal(profile.database.execution_postgres_required_major, 18);
  assert.equal(contract.execution_postgres_required_major, 18);
  assert.equal(profile.database.schema_client_image, SCHEMA_CLIENT_IMAGE);
  assert.equal(contract.schema_client_image, SCHEMA_CLIENT_IMAGE);
  assert.equal(profile.database.schema_client_required_major, 18);
  assert.equal(contract.schema_client_required_major, 18);
  assert.notEqual(EXECUTION_POSTGRES_IMAGE, SCHEMA_CLIENT_IMAGE);
  assert.equal(profile.database.parent_database_name, PARENT_DATABASE_NAME);
  assert.equal(contract.parent_database_name, PARENT_DATABASE_NAME);
  assert.equal(profile.database.parent_database_access, REMOTE_PARENT_POLICY);
  assert.equal(contract.remote_parent_database_policy, REMOTE_PARENT_POLICY);
  assert.equal(binding.provisioning.remote_parent_database_policy, REMOTE_PARENT_POLICY);
  assert.equal(profile.database.data_clone_forbidden, true);
  assert.equal(binding.provisioning.data_clone_forbidden, true);
  assert.equal(profile.database.remote_parent_mutation_authorized, false);
  assert.equal(profile.database.formal_database_mutation_authorized, false);
  assert.equal(profile.database.production_database_mutation_authorized, false);
  assert.equal(binding.provisioning.remote_parent_mutation_authorized, false);
  assert.equal(binding.provisioning.formal_database_mutation_authorized, false);
  assert.equal(binding.provisioning.production_database_mutation_authorized, false);
  assert.equal(binding.provisioning.expected_public_table_count, 29);

  assertBlob(root, binding.provisioning.provisioner_ref, binding.provisioning.provisioner_blob_sha, 'AM19_RECONCILIATION_PROVISIONER_BLOB_DRIFT');
  assertBlob(root, binding.provisioning.inner_ref, binding.provisioning.inner_blob_sha, 'AM19_RECONCILIATION_INNER_BLOB_DRIFT');
  assertBlob(root, binding.provisioning.formal_store_authority_ref, binding.provisioning.formal_store_authority_blob_sha, 'AM19_RECONCILIATION_FORMAL_STORE_AUTHORITY_BLOB_DRIFT');

  assert.equal(profile.current_season_boundary.current_2026_crop_window_status, CROP_WINDOW);
  assert.equal(contract.current_2026_crop_window_status, CROP_WINDOW);
  assert.equal(profile.current_season_boundary.formal_current_season_admission_policy, FORMAL_ADMISSION_POLICY);
  assert.equal(contract.formal_current_season_admission_policy, FORMAL_ADMISSION_POLICY);
  assert.equal(profile.current_season_boundary.current_season_formal_admission_substituted, false);
  assert.equal(profile.current_season_boundary.current_season_recapture_authorized, false);
  assert.equal(profile.current_season_boundary.current_season_retry_authorized, false);
  assert.equal(profile.current_season_boundary.current_season_bypass_authorized, false);

  assert.equal(profile.legacy_capture_lane.classification, 'HISTORICAL_PROVENANCE_FALLBACK_COMPARISON_ONLY');
  assert.equal(profile.legacy_capture_lane.required_for_current_admission, false);
  assert.equal(profile.legacy_capture_lane.reactivation_authorized, false);
  assert.equal(profile.legacy_capture_lane.may_replace_historical_logical_epoch, false);
  assert.equal(binding.legacy_capture_lane.classification, 'HISTORICAL_PROVENANCE_FALLBACK_COMPARISON_ONLY');
  assert.equal(binding.legacy_capture_lane.required_for_current_admission, false);
  assert.equal(binding.legacy_capture_lane.reactivation_authorized, false);
  assert.equal(binding.legacy_capture_lane.may_replace_historical_logical_epoch, false);
  assert.equal(contract.legacy_controlled_capture_required_for_current_admission, false);
  assert.equal(contract.legacy_controlled_capture_reactivation_authorized, false);
  assert.equal(contract.legacy_controlled_capture_policy, 'HISTORICAL_PROVENANCE_FALLBACK_COMPARISON_ONLY');
  assert.equal(own(contract, 'controlled_capture_required_before_rerun'), false);
  assert.equal(own(contract, 'capture_verifier_required'), false);

  assert.equal(profile.historical_source_assets.historical_runner_ref, HISTORICAL_RUNNER_REF);
  assert.equal(contract.historical_runner_ref, HISTORICAL_RUNNER_REF);
  assert.equal(profile.historical_source_assets.historical_crop_preflight_source_ref, HISTORICAL_CROP_PREFLIGHT_SOURCE_REF);
  assert.equal(contract.historical_crop_preflight_source_ref, HISTORICAL_CROP_PREFLIGHT_SOURCE_REF);
  assert.equal(profile.historical_source_assets.rehydration_source_ref, REHYDRATION_SOURCE_REF);
  assert.equal(contract.rehydration_source_ref, REHYDRATION_SOURCE_REF);
  assert.equal(profile.historical_source_assets.classification, 'SOURCE_PROVENANCE_ONLY_NOT_CURRENT_ADMISSION_AUTHORITY');

  const packageBinding = binding.package_and_verification;
  assert.equal(packageBinding.manifest_schema_version, 'QualificationEvidenceManifestV1');
  assert.equal(packageBinding.closure_delivery_schema_version, 'GEOXQualificationClosureDeliveryV1');
  assert.equal(packageBinding.no_latest_run_fallback_required, true);
  assert.equal(packageBinding.exact_subject_binding_required, true);
  assert.equal(packageBinding.fail_closed_required, true);
  assert.equal(packageBinding.package_policy, 'EXACT_SUBJECT_IMMUTABLE_PACKAGE_TWO_STAGE_INDEPENDENT_VERIFICATION_V1');

  assertBlob(root, packageBinding.manifest_generator_ref, packageBinding.manifest_generator_blob_sha, 'AM19_RECONCILIATION_MANIFEST_GENERATOR_BLOB_DRIFT');
  assertBlob(root, packageBinding.evidence_manifest_verifier_ref, packageBinding.evidence_manifest_verifier_blob_sha, 'AM19_RECONCILIATION_VERIFIER1_BLOB_DRIFT');
  assertBlob(root, packageBinding.closure_delivery_builder_ref, packageBinding.closure_delivery_builder_blob_sha, 'AM19_RECONCILIATION_CLOSURE_BUILDER_BLOB_DRIFT');
  assertBlob(root, packageBinding.closure_delivery_verifier_ref, packageBinding.closure_delivery_verifier_blob_sha, 'AM19_RECONCILIATION_VERIFIER2_BLOB_DRIFT');

  const manifestGenerator = readText(root, packageBinding.manifest_generator_ref);
  const verifier1 = readText(root, packageBinding.evidence_manifest_verifier_ref);
  const closureBuilder = readText(root, packageBinding.closure_delivery_builder_ref);
  const verifier2 = readText(root, packageBinding.closure_delivery_verifier_ref);

  assertSource(manifestGenerator, /QualificationEvidenceManifestV1/, 'AM19_RECONCILIATION_MANIFEST_SCHEMA_BINDING_REQUIRED');
  assertSource(manifestGenerator, /VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1\.cjs/, 'AM19_RECONCILIATION_MANIFEST_VERIFIER_BINDING_REQUIRED');
  assertSource(manifestGenerator, /no_latest_run_fallback:\s*true/, 'AM19_RECONCILIATION_MANIFEST_NO_LATEST_REQUIRED');
  assertSource(manifestGenerator, /exact_subject_binding_required:\s*true/, 'AM19_RECONCILIATION_MANIFEST_EXACT_SUBJECT_REQUIRED');
  assertSource(manifestGenerator, /fail_closed:\s*true/, 'AM19_RECONCILIATION_MANIFEST_FAIL_CLOSED_REQUIRED');

  assertSource(verifier1, /QUALIFICATION_VERIFIER_PACKAGE_DIGEST_RECOMPUTE_MISMATCH/, 'AM19_RECONCILIATION_VERIFIER1_PACKAGE_RECOMPUTE_REQUIRED');
  assertSource(verifier1, /repository_inputs_verified:\s*true/, 'AM19_RECONCILIATION_VERIFIER1_REPOSITORY_INPUTS_REQUIRED');
  assertSource(verifier1, /qualification_inputs_verified/, 'AM19_RECONCILIATION_VERIFIER1_QUALIFICATION_INPUTS_REQUIRED');
  assertSource(verifier1, /QUALIFICATION_VERIFIER_POLICY_WEAKENED/, 'AM19_RECONCILIATION_VERIFIER1_FAIL_CLOSED_POLICY_REQUIRED');

  assertSource(closureBuilder, /GEOXQualificationClosureDeliveryV1/, 'AM19_RECONCILIATION_CLOSURE_SCHEMA_REQUIRED');
  assertSource(closureBuilder, /MCFT_CAP_09_CLOSURE_TEAM_EVIDENCE_INPUT/, 'AM19_RECONCILIATION_CLOSURE_CONSUMER_SCOPE_REQUIRED');
  assertSource(closureBuilder, /EVIDENCE_INPUT_ONLY_CLOSURE_TEAM_RETAINS_BLOCKER_ADJUDICATION_AUTHORITY/, 'AM19_RECONCILIATION_CLOSURE_AUTHORITY_CEILING_REQUIRED');
  assertSource(closureBuilder, /VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1\.cjs/, 'AM19_RECONCILIATION_CLOSURE_VERIFIER1_REUSE_REQUIRED');
  assertSource(closureBuilder, /qcp_semantics_modified:\s*false/, 'AM19_RECONCILIATION_CLOSURE_QCP_NON_EFFECT_REQUIRED');
  assertSource(closureBuilder, /closure_subject_mutated:\s*false/, 'AM19_RECONCILIATION_CLOSURE_SUBJECT_NON_EFFECT_REQUIRED');

  assertSource(verifier2, /VERIFY_GEOX_QUALIFICATION_EVIDENCE_MANIFEST_V1\.cjs/, 'AM19_RECONCILIATION_VERIFIER2_SOURCE_REVERIFY_REQUIRED');
  assertSource(verifier2, /QUALIFICATION_CLOSURE_DELIVERY_VERIFIER_REVERIFY_RESULT_MISMATCH/, 'AM19_RECONCILIATION_VERIFIER2_RECOMPUTE_REQUIRED');
  assertSource(verifier2, /qcp_semantics_modified\s*!==\s*false/, 'AM19_RECONCILIATION_VERIFIER2_QCP_POLICY_REQUIRED');
  assertSource(verifier2, /closure_subject_mutated\s*!==\s*false/, 'AM19_RECONCILIATION_VERIFIER2_CLOSURE_POLICY_REQUIRED');

  const downstream = binding.downstream_governance;
  assertBlob(root, downstream.qcp_ref, downstream.qcp_blob_sha, 'AM19_RECONCILIATION_QCP_BLOB_DRIFT');
  assertBlob(root, downstream.qualification_evidence_registry_ref, downstream.qualification_evidence_registry_blob_sha, 'AM19_RECONCILIATION_REGISTRY_BLOB_DRIFT');
  const qcp = readJson(root, downstream.qcp_ref);
  const registry = readJson(root, downstream.qualification_evidence_registry_ref);

  assert.equal(qcp.authority_id, 'MCFT_CAP09_CHECK_APPLICABILITY_V1');
  assert.equal(qcp.fail_closed_rules?.unknown_changed_path, 'FAIL');
  assert.equal(qcp.fail_closed_rules?.missing_required_evidence, 'FAIL');
  assert.ok(qcp.dependency_resolvers?.[downstream.qcp_current_resolver_id], 'AM19_RECONCILIATION_CURRENT_QCP_RESOLVER_REQUIRED');
  assert.ok(qcp.dependency_resolvers?.[downstream.qcp_legacy_check_id], 'AM19_RECONCILIATION_LEGACY_QCP_RESOLVER_PRESERVED');
  const legacyCheck = (qcp.checks ?? []).find((row) => row.check_id === downstream.qcp_legacy_check_id);
  assert.ok(legacyCheck, 'AM19_RECONCILIATION_LEGACY_QCP_CHECK_PRESERVED');
  assert.ok((legacyCheck.generation_scope ?? []).includes('HISTORICAL_AM19_PRE_V13'), 'AM19_RECONCILIATION_LEGACY_QCP_GENERATION_MUST_BE_HISTORICAL');
  assert.equal(legacyCheck.carry_forward_policy, 'NONE_AFTER_PHASE2_PROVIDER_EXTRACTION');
  assert.equal(legacyCheck.carry_forward_evidence_id, null);
  assert.equal(downstream.qcp_legacy_check_classification, 'HISTORICAL_ONLY_NOT_CURRENT_SUCCESSOR_ADMISSION');

  assert.equal(registry.registry_id, 'MCFT_CAP09_QUALIFICATION_EVIDENCE_REGISTRY_V1');
  assert.equal(registry.schema_version, 2);
  assert.equal(registry.rules?.missing_evidence_id, 'FAIL_CLOSED');
  assert.equal(registry.rules?.subject_mismatch, 'FAIL_CLOSED');
  const legacyEntry = (registry.entries ?? []).find((row) => row.evidence_id === downstream.legacy_registry_evidence_id);
  assert.ok(legacyEntry, 'AM19_RECONCILIATION_LEGACY_REGISTRY_ENTRY_PRESERVED');
  assert.equal(legacyEntry.check_id, downstream.qcp_legacy_check_id);
  assert.match(String(legacyEntry.generation ?? ''), /^historical-/i, 'AM19_RECONCILIATION_LEGACY_REGISTRY_GENERATION_MUST_BE_HISTORICAL');
  assert.equal(downstream.legacy_registry_entry_classification, 'HISTORICAL_ONLY_NOT_CURRENT_SUCCESSOR_ADMISSION');
  assert.equal(downstream.current_successor_registration_policy, 'NO_PREMATURE_REGISTRATION_BEFORE_FRESH_QUALIFICATION_PACKAGE_AND_BOTH_VERIFIERS_PASS');
  const registryText = JSON.stringify(registry);
  assert.equal(registryText.includes(PROFILE_ID), false, 'AM19_RECONCILIATION_CURRENT_PROFILE_PREMATURELY_REGISTERED');
  assert.equal(registryText.includes(BINDING_ID), false, 'AM19_RECONCILIATION_CURRENT_BINDING_PREMATURELY_REGISTERED');
  assert.equal(downstream.closure_consumer_scope, 'MCFT_CAP_09_CLOSURE_TEAM_EVIDENCE_INPUT');
  assert.equal(downstream.closure_authority_ceiling, 'EVIDENCE_INPUT_ONLY_CLOSURE_TEAM_RETAINS_BLOCKER_ADJUDICATION_AUTHORITY');
  assert.equal(downstream.qcp_semantics_mutation_authorized, false);
  assert.equal(downstream.closure_semantics_mutation_authorized, false);

  assert.equal(binding.execution_gate.qualification_execution_allowed_before_static_reconciliation_pass, false);
  assert.equal(binding.execution_gate.required_static_blocker_count, 0);
  assert.equal(binding.execution_gate.fresh_13_of_13_is_next_only_after_full_static_pass, true);

  assert.equal(profile.non_effects.runtime_mutation, false);
  assert.equal(profile.non_effects.provider_semantics_mutation, false);
  assert.equal(profile.non_effects.authority_semantics_mutation, false);
  assert.equal(profile.non_effects.qcp_semantics_mutation, false);
  assert.equal(profile.non_effects.closure_semantics_mutation, false);
  assert.equal(profile.non_effects.formal_v5_arm, false);
  assert.equal(profile.non_effects.a0, false);
  assert.equal(profile.non_effects.o00_o23, false);
  assert.equal(contract.non_effects.runtime_mutation, false);
  assert.equal(contract.non_effects.production_mutation, false);
  assert.equal(contract.non_effects.qcp_semantics_mutation, false);
  assert.equal(contract.non_effects.closure_subject_mutation, false);
  assert.equal(contract.non_effects.production_owner_cutover, false);
  assert.equal(contract.non_effects.github_capture_owner_reactivated, false);
  assert.equal(contract.non_effects.formal_v5_arm, false);
  assert.equal(contract.non_effects.a0, false);
  assert.equal(contract.non_effects.o00_o23, false);
  assert.equal(contract.non_effects.current_crop_admission_claim, false);
  assert.equal(binding.non_effects.runtime_mutation, false);
  assert.equal(binding.non_effects.provider_semantics_mutation, false);
  assert.equal(binding.non_effects.authority_semantics_mutation, false);
  assert.equal(binding.non_effects.qcp_semantics_mutation, false);
  assert.equal(binding.non_effects.closure_semantics_mutation, false);
  assert.equal(binding.non_effects.formal_v5_arm, false);
  assert.equal(binding.non_effects.a0, false);
  assert.equal(binding.non_effects.o00_o23, false);

  assertSource(runner, /MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1/, 'AM19_RECONCILIATION_RUNNER_CONTRACT_REQUIRED');
  assertSource(runner, /MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1/, 'AM19_RECONCILIATION_RUNNER_PROFILE_REQUIRED');
  assertSource(runner, /VERIFY_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_V1\.cjs/, 'AM19_RECONCILIATION_RUNNER_STATIC_GATE_REQUIRED');
  assertSource(runner, /CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS/, 'AM19_RECONCILIATION_RUNNER_CROP_WINDOW_REQUIRED');
  assertSource(runner, /LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER/, 'AM19_RECONCILIATION_RUNNER_EXECUTION_PLANE_REQUIRED');
  assertSource(preflight, /MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1/, 'AM19_RECONCILIATION_PREFLIGHT_CONTRACT_REQUIRED');
  assertSource(preflight, /MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1/, 'AM19_RECONCILIATION_PREFLIGHT_PROFILE_REQUIRED');

  const result = {
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_reconciliation_v1',
    status: 'PASS',
    blocker_count: 0,
    profile_id: PROFILE_ID,
    contract_id: CONTRACT_ID,
    design_reconciliation_binding_id: BINDING_ID,
    current_admission_route: profile.admission_route,
    controlled_host_preflight_ref: PREFLIGHT_REF,
    frozen_runtime_sha: RUNTIME_SHA,
    descriptor_ref: DESCRIPTOR_REF,
    historical_logical_epoch_id: EPOCH_ID,
    producer_subject_sha: PRODUCER_SHA,
    target_t: TARGET_T,
    semantic_manifest_digest: SEMANTIC_DIGEST,
    retained_raw_object_count: descriptor.retained_raw_objects.length,
    legacy_controlled_capture_required_for_current_admission: false,
    current_2026_crop_window_status: CROP_WINDOW,
    database_execution_plane: EXECUTION_PLANE,
    execution_postgres_image: EXECUTION_POSTGRES_IMAGE,
    schema_client_image: SCHEMA_CLIENT_IMAGE,
    parent_database_name: PARENT_DATABASE_NAME,
    package_binding: 'PASS',
    verifier_1_binding: 'PASS',
    verifier_2_binding: 'PASS',
    qcp_binding: 'PASS',
    closure_binding: 'PASS',
    legacy_qcp_check_current_admission: false,
    current_successor_qcp_registered: false,
    static_reconciliation_complete: true,
    qualification_execution_performed: false,
    database_access: false,
    provider_access: false,
    production_mutation: false,
    formal_v5_arm: false,
    a0: false,
    o00_o23: false
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  run();
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_reconciliation_v1',
    status: 'FAIL',
    blocker_count: 1,
    error: error && error.message ? error.message : String(error),
    static_reconciliation_complete: false,
    qualification_execution_performed: false,
    database_access: false,
    provider_access: false,
    production_mutation: false
  }, null, 2)}\n`);
  process.exitCode = 1;
}
