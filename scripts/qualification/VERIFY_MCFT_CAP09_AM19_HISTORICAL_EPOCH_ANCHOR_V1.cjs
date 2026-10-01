#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CONTRACT_PATH = path.resolve('scripts/qualification/contracts/MCFT_CAP09_AM19_PERSISTENT_GRAPH_SUCCESSOR_V1.json');
const EVIDENCE_FILES = [
  'MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_PREFLIGHT_V1.json',
  'MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T_RESULT.json',
  'MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json',
  'MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_RESULT.json',
];
const HOUR_MS = 3_600_000;

function fail(code, detail) {
  throw new Error(detail === undefined ? code : `${code}:${detail}`);
}
function requireCondition(condition, code, detail) {
  if (!condition) fail(code, detail);
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}
function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
function canonicalHour(value, code) {
  const ms = Date.parse(value);
  requireCondition(Number.isFinite(ms) && new Date(ms).toISOString() === value && value.endsWith(':00:00.000Z'), code, value);
  return value;
}
function addHours(value, hours) {
  return new Date(Date.parse(value) + hours * HOUR_MS).toISOString();
}
function stageAtHours(hoursSincePlanting, variant) {
  requireCondition(Array.isArray(variant) && variant.length === 4 && variant.every((x) => Number.isFinite(x) && x > 0), 'AM19_SUCCESSOR_AUTHORITY_VARIANT_INVALID');
  const [initial, development, mid, late] = variant;
  if (hoursSincePlanting < 0) return 'PRE_PLANTING';
  if (hoursSincePlanting < initial * 24) return 'INITIAL';
  if (hoursSincePlanting < (initial + development) * 24) return 'DEVELOPMENT';
  if (hoursSincePlanting < (initial + development + mid) * 24) return 'MID';
  if (hoursSincePlanting < (initial + development + mid + late) * 24) return 'LATE';
  return 'POST_MODEL_SEASON';
}
function authorityProfile(authority, contract) {
  requireCondition(authority.schema_version === 'geox_mcft_cap09_s6_formal_crop_context_authority_v3', 'AM19_SUCCESSOR_AUTHORITY_SCHEMA_REQUIRED');
  requireCondition(authority.authority_id === contract.crop_authority_id, 'AM19_SUCCESSOR_AUTHORITY_ID_REQUIRED');
  const window = authority.planting_authority?.possible_event_window_utc;
  const plantingStart = Date.parse(window?.start_inclusive ?? '');
  const plantingEnd = Date.parse(window?.end_exclusive ?? '');
  requireCondition(Number.isFinite(plantingStart) && Number.isFinite(plantingEnd) && plantingStart < plantingEnd, 'AM19_SUCCESSOR_PLANTING_WINDOW_REQUIRED');
  const policy = authority.as_of_derivation_policy;
  requireCondition(policy?.backward_stability_hours === contract.historical_epoch.backward_stability_hours, 'AM19_SUCCESSOR_BACKWARD_GUARD_DRIFT');
  requireCondition(policy?.forward_transition_guard_hours === contract.historical_epoch.forward_transition_guard_hours, 'AM19_SUCCESSOR_FORWARD_GUARD_DRIFT');
  requireCondition(policy?.planting_time_uncertainty_must_be_carried === true && policy?.future_observations_authorized === false, 'AM19_SUCCESSOR_AUTHORITY_POLICY_DRIFT');
  const variants = authority.model_stage_prior?.variant_stage_lengths_days;
  requireCondition(Array.isArray(variants) && variants.length === 6, 'AM19_SUCCESSOR_EXACT_SIX_VARIANTS_REQUIRED');
  return { plantingStart, plantingEnd, backwardHours: policy.backward_stability_hours, forwardHours: policy.forward_transition_guard_hours, variants };
}
function evaluateLogicalTime(logicalTime, profile) {
  const target = Date.parse(canonicalHour(logicalTime, 'AM19_SUCCESSOR_LOGICAL_TIME_INVALID'));
  const ages = [
    (target - profile.plantingEnd) / HOUR_MS,
    (target - profile.plantingStart) / HOUR_MS,
    (target - profile.backwardHours * HOUR_MS - profile.plantingEnd) / HOUR_MS,
    (target + profile.forwardHours * HOUR_MS - profile.plantingStart) / HOUR_MS,
  ];
  const stages = new Set();
  for (const variant of profile.variants) for (const age of ages) stages.add(stageAtHours(age, variant));
  return [...stages].sort();
}
function verifyAuthorityEpoch(contract, authority) {
  const profile = authorityProfile(authority, contract);
  const contexts = [contract.historical_epoch.a0, ...Array.from({ length: 24 }, (_, i) => addHours(contract.historical_epoch.a0, i + 1))];
  requireCondition(contexts.length === contract.historical_epoch.required_context_count, 'AM19_SUCCESSOR_CONTEXT_COUNT_DRIFT');
  const evaluated = contexts.map((logicalTime) => ({ logical_time: logicalTime, stages: evaluateLogicalTime(logicalTime, profile) }));
  for (const row of evaluated) requireCondition(row.stages.length === 1 && row.stages[0] === contract.historical_epoch.required_stage_code, 'AM19_SUCCESSOR_HISTORICAL_EPOCH_NOT_AUTHORITY_V3_LEGAL', `${row.logical_time}:${row.stages.join(',')}`);
  requireCondition(addHours(contract.historical_epoch.a0, 1) === contract.historical_epoch.o00, 'AM19_SUCCESSOR_O00_DRIFT');
  requireCondition(addHours(contract.historical_epoch.a0, 24) === contract.historical_epoch.o23, 'AM19_SUCCESSOR_O23_DRIFT');
  return evaluated;
}
function zeroEffectCrop(p) {
  for (const key of ['provider_request_count','r2_request_count','database_read_count','database_write_count','qualification_subject_sentinel_write_count','runtime_write_count','scheduler_write_count']) {
    requireCondition(Number(p[key]) === 0, 'AM19_SUCCESSOR_HISTORICAL_CROP_NONZERO_EFFECT', key);
  }
  requireCondition(p.rehydration_started === false && p.formal_o00_started === false && p.mcft_cap09_completed === false, 'AM19_SUCCESSOR_HISTORICAL_CROP_PREMATURE_EFFECT');
}
function verifyEvidence(contract, dir) {
  for (const name of EVIDENCE_FILES) requireCondition(fs.existsSync(path.join(dir, name)), 'AM19_SUCCESSOR_HISTORICAL_EVIDENCE_FILE_REQUIRED', name);
  const crop = readJson(path.join(dir, EVIDENCE_FILES[0]));
  const free = readJson(path.join(dir, EVIDENCE_FILES[1]));
  const rehydration = readJson(path.join(dir, EVIDENCE_FILES[2]));
  const persistent = readJson(path.join(dir, EVIDENCE_FILES[3]));
  const h = contract.historical_epoch;
  requireCondition(crop.status === 'PASS' && crop.result === 'EXACT_A0_PLUS_O00_O23_CROP_WINDOW_VIABLE', 'AM19_SUCCESSOR_HISTORICAL_CROP_PASS_REQUIRED');
  requireCondition(crop.subject_sha === h.historical_qualification_subject_sha && crop.producer_subject_sha === h.historical_producer_subject_sha, 'AM19_SUCCESSOR_HISTORICAL_CROP_SUBJECT_DRIFT');
  requireCondition(crop.crop_authority_id === contract.crop_authority_id && crop.a0 === h.a0 && crop.o00 === h.o00 && crop.o23 === h.o23, 'AM19_SUCCESSOR_HISTORICAL_CROP_IDENTITY_DRIFT');
  requireCondition(crop.required_context_count === 25 && crop.passing_context_count === 25 && crop.failing_context_count === 0 && crop.first_failing_context === null, 'AM19_SUCCESSOR_HISTORICAL_CROP_25_OF_25_REQUIRED');
  requireCondition(Array.isArray(crop.all_contexts) && crop.all_contexts.length === 25 && crop.all_contexts.every((x) => x.status === 'PASS' && x.stage_code === 'MID' && JSON.stringify(x.conservative_stage_set) === '["MID"]'), 'AM19_SUCCESSOR_HISTORICAL_CROP_ALL_MID_REQUIRED');
  zeroEffectCrop(crop);

  requireCondition(free.status === 'PASS' && free.machine_statuses?.PERSISTENCE_FREE_24T === 'PASS', 'AM19_SUCCESSOR_HISTORICAL_PERSISTENCE_FREE_REQUIRED');
  requireCondition(free.canonical_tick_count === 24 && free.provider_wait_count === 0 && free.database_write_count === 0 && free.provider_request_count === 0 && free.formal_o00_started === false && free.formal_effect === false, 'AM19_SUCCESSOR_HISTORICAL_PERSISTENCE_FREE_BOUNDARY_DRIFT');

  requireCondition(rehydration.status === 'PASS' && rehydration.consumer_subject_sha === h.historical_qualification_subject_sha && rehydration.producer_subject_sha === h.historical_producer_subject_sha && rehydration.target_t === h.a0, 'AM19_SUCCESSOR_HISTORICAL_REHYDRATION_IDENTITY_REQUIRED');
  requireCondition(rehydration.semantic_manifest_match === true && rehydration.producer_bound_raw_reverification === true && rehydration.producer_dataset_identity_preserved === true && rehydration.producer_decoder_identity_preserved === true, 'AM19_SUCCESSOR_HISTORICAL_REHYDRATION_PROVENANCE_REQUIRED');
  requireCondition(rehydration.provider_refetch_count === 0 && rehydration.private_r2_put_count === 0 && rehydration.private_r2_delete_count === 0 && rehydration.formal_database_write_count === 0 && rehydration.formal_r2_prefix_write_count === 0 && rehydration.scheduler_write_count === 0 && rehydration.runtime_write_count === 0 && rehydration.formal_effect === false && rehydration.raw_values_emitted === false, 'AM19_SUCCESSOR_HISTORICAL_REHYDRATION_EFFECT_DRIFT');

  const statuses = contract.required_machine_statuses;
  requireCondition(persistent.status === 'PASS' && persistent.subject_sha === h.historical_qualification_subject_sha && persistent.qualified_subject_sha === h.historical_qualification_subject_sha && persistent.producer_subject_sha === h.historical_producer_subject_sha, 'AM19_SUCCESSOR_HISTORICAL_PERSISTENT_IDENTITY_REQUIRED');
  requireCondition(persistent.a0 === h.a0 && persistent.o00 === h.o00 && persistent.o23 === h.o23 && persistent.static_blocker_count === 0, 'AM19_SUCCESSOR_HISTORICAL_PERSISTENT_EPOCH_REQUIRED');
  for (const key of statuses) requireCondition(persistent.machine_statuses?.[key] === 'PASS', 'AM19_SUCCESSOR_HISTORICAL_MACHINE_STATUS_REQUIRED', key);
  for (const key of ['production_scheduler_reused','production_lease_fencing_reused','production_runner_reused','production_persistent_tick_service_reused','production_persistence_repositories_reused']) requireCondition(persistent[key] === true, 'AM19_SUCCESSOR_HISTORICAL_PRODUCTION_GRAPH_REUSE_REQUIRED', key);
  requireCondition(persistent.bootstrap_lease_real_expiry_required === true && persistent.lease_and_fencing_clock_substitution === false && persistent.accelerated_clock_scope === 'REPLACE_WAIT_UNTIL_NEXT_PT1H_BOUNDARY_ONLY', 'AM19_SUCCESSOR_HISTORICAL_CLOCK_BOUNDARY_DRIFT');
  requireCondition(persistent.final_actual_24h_still_required === true && persistent.final_actual_24h_substituted_by_this_run === false && persistent.future_formal_epoch_selected === false && persistent.formal_o00_started === false && persistent.mcft_cap09_completed === false && persistent.formal_database_write_count === 0 && persistent.raw_values_emitted === false, 'AM19_SUCCESSOR_HISTORICAL_PREMATURE_FORMAL_EFFECT');

  const files = EVIDENCE_FILES.map((name) => ({ name, sha256: sha256File(path.join(dir, name)) }));
  return { files, evidence_surface_digest: sha256Text(JSON.stringify(files)) };
}
function parseArgs(argv) {
  const out = { mode: argv[0] ?? '' };
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || !value) fail('AM19_SUCCESSOR_ARGUMENT_INVALID', key ?? '');
    out[key.slice(2)] = value;
  }
  return out;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  requireCondition(fs.existsSync(CONTRACT_PATH), 'AM19_SUCCESSOR_CONTRACT_REQUIRED');
  const contract = readJson(CONTRACT_PATH);
  requireCondition(contract.contract_id === 'MCFT_CAP09_AM19_PERSISTENT_GRAPH_SUCCESSOR_V1' && contract.contract_version === 1, 'AM19_SUCCESSOR_CONTRACT_ID_REQUIRED');
  requireCondition(contract.persistent_graph_qualification_not_formal_current_season_admission === true && contract.current_2026_crop_window_status === 'CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS', 'AM19_SUCCESSOR_SEPARATION_RULING_REQUIRED');
  requireCondition(git('rev-parse', `HEAD:${contract.crop_authority_ref}`) === contract.crop_authority_blob_sha, 'AM19_SUCCESSOR_CROP_AUTHORITY_BLOB_DRIFT');
  requireCondition(git('rev-parse', `HEAD:${contract.historical_runner_ref}`) === contract.historical_runner_blob_sha, 'AM19_SUCCESSOR_HISTORICAL_RUNNER_BLOB_DRIFT');
  const authority = readJson(path.resolve(contract.crop_authority_ref));
  const authorityEvaluation = verifyAuthorityEpoch(contract, authority);
  if (args.mode === 'selftest') {
    process.stdout.write(JSON.stringify({ status: 'PASS', contract_id: contract.contract_id, authority_v3_epoch_25_of_25: true, context_count: authorityEvaluation.length, database_access: false, provider_access: false, formal_effect: false }, null, 2) + '\n');
    return;
  }
  requireCondition(args.mode === 'verify', 'AM19_SUCCESSOR_MODE_REQUIRED');
  const evidenceDir = path.resolve(args['evidence-dir'] ?? '');
  requireCondition(fs.existsSync(evidenceDir) && fs.statSync(evidenceDir).isDirectory(), 'AM19_SUCCESSOR_HISTORICAL_EVIDENCE_DIR_REQUIRED', evidenceDir);
  const evidence = verifyEvidence(contract, evidenceDir);
  const output = {
    schema_version: 'geox_mcft_cap09_am19_historical_epoch_anchor_verification_v1',
    status: 'PASS',
    contract_id: contract.contract_id,
    crop_authority_id: contract.crop_authority_id,
    crop_authority_blob_sha: contract.crop_authority_blob_sha,
    historical_epoch: contract.historical_epoch,
    authority_v3_epoch_25_of_25: true,
    historical_success_anchor: contract.historical_success_anchor,
    evidence_files: evidence.files,
    evidence_surface_digest: evidence.evidence_surface_digest,
    current_2026_crop_window_reopened: false,
    current_or_future_formal_admission_authorized: false,
    provider_request_count: 0,
    database_access: false,
    runtime_mutation: false,
    production_mutation: false,
    qcp_semantics_mutated: false,
    legacy_am19_blocker_adjudicated: false,
  };
  if (args.out) fs.writeFileSync(path.resolve(args.out), JSON.stringify(output, null, 2) + '\n');
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main();
