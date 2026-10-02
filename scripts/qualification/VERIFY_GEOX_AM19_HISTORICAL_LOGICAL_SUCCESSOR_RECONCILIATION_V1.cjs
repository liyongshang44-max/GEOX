#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROFILE_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1.json';
const CONTRACT_REF = 'scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1.json';
const RUNNER_REF = 'scripts/qualification/RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_V1.cjs';
const VERIFIER_REF = 'scripts/qualification/VERIFY_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_V1.cjs';
const PREFLIGHT_REF = 'scripts/qualification/RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PREFLIGHT_V1.cjs';
const PROFILE_ID = 'MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1';
const CONTRACT_ID = 'MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1';
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

function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function run() {
  const root = process.cwd();
  const profile = readJson(root, PROFILE_REF);
  const contract = readJson(root, CONTRACT_REF);
  const descriptor = readJson(root, contract.historical_logical_epoch_descriptor_ref);
  const runner = fs.readFileSync(path.resolve(root, RUNNER_REF), 'utf8');
  const preflight = fs.readFileSync(path.resolve(root, PREFLIGHT_REF), 'utf8');

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
  assert.equal(contract.qualification_runner_ref, RUNNER_REF);

  assert.equal(profile.frozen_runtime_sha, RUNTIME_SHA);
  assert.equal(contract.frozen_runtime_sha, RUNTIME_SHA);
  assert.equal(profile.historical_logical_epoch.descriptor_ref, DESCRIPTOR_REF);
  assert.equal(contract.historical_logical_epoch_descriptor_ref, DESCRIPTOR_REF);
  assert.equal(profile.historical_logical_epoch.epoch_id, EPOCH_ID);
  assert.equal(contract.historical_logical_epoch_id, EPOCH_ID);
  assert.equal(descriptor.epoch_id, EPOCH_ID);
  assert.equal(profile.historical_logical_epoch.producer_subject_sha, PRODUCER_SHA);
  assert.equal(contract.historical_producer_subject_sha, PRODUCER_SHA);
  assert.equal(descriptor.historical_producer.producer_subject_sha, PRODUCER_SHA);
  assert.equal(profile.historical_logical_epoch.target_t, TARGET_T);
  assert.equal(contract.historical_target_t, TARGET_T);
  assert.equal(descriptor.logical_epoch.target_t, TARGET_T);
  assert.equal(profile.historical_logical_epoch.semantic_manifest_digest, SEMANTIC_DIGEST);
  assert.equal(descriptor.logical_epoch.semantic_manifest_digest, SEMANTIC_DIGEST);
  assert.equal(profile.historical_logical_epoch.retained_raw_object_count, 2);
  assert.equal(descriptor.retained_raw_objects.length, 2);
  assert.equal(profile.historical_logical_epoch.provider_refetch_authorized, false);

  assert.equal(profile.database.execution_plane, EXECUTION_PLANE);
  assert.equal(contract.database_execution_plane, EXECUTION_PLANE);
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
  assert.equal(profile.database.data_clone_forbidden, true);
  assert.equal(profile.database.remote_parent_mutation_authorized, false);
  assert.equal(profile.database.formal_database_mutation_authorized, false);
  assert.equal(profile.database.production_database_mutation_authorized, false);

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

  assert.match(runner, /MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1/);
  assert.match(runner, /MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1/);
  assert.match(runner, /VERIFY_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_RECONCILIATION_V1\.cjs/);
  assert.match(runner, /CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS/);
  assert.match(runner, /LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER/);
  assert.match(preflight, /MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1/);
  assert.match(preflight, /MCFT_CAP09_AM19_HISTORICAL_LOGICAL_SUCCESSOR_PROFILE_V1/);
  assert.match(preflight, /admitted_to_fresh_historical_successor_13_of_13/);

  const result = {
    schema_version: 'geox_mcft_cap09_am19_historical_logical_successor_reconciliation_v1',
    status: 'PASS',
    blocker_count: 0,
    profile_id: PROFILE_ID,
    contract_id: CONTRACT_ID,
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
    qualification_execution_performed: false,
    database_access: false,
    provider_access: false,
    production_mutation: false
  }, null, 2)}\n`);
  process.exitCode = 1;
}
