// scripts/mcft/GENERATE_MCFT_CAP_05_FEEDBACK_DATASET.cjs
// Purpose: deterministically materialize the MCFT-CAP-05 controlled Human Decision / approval / plan / dispatch / execution / outcome Replay Evidence dataset.
// Boundary: generator only; no canonical Twin object, database, network, wall-clock, Runtime, Recommendation, AO-ACT, calibration, or model-activation write.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_LOCK = path.join(ROOT, 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'fixtures/mcft/water_state/feedback_v1');
const DEFAULT_NEGATIVE = path.join(ROOT, 'fixtures/mcft/water_state/negative/MCFT_CAP_05_NEGATIVE_FIXTURES.json');
const DATASET_ID = 'mcft_cap05_feedback_replay_v1';
const SOURCE_ID = 'mcft_cap05_controlled_feedback_source_v1';
const INGRESS_ADAPTER_ID = 'canonical_replay_evidence_ingress_v1';

function canonical(value) {
  if (value === undefined) throw new Error('UNDEFINED_FORBIDDEN');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new Error(`UNSUPPORTED_TYPE:${typeof value}`);
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function recordHash(record) {
  const semantic = { ...record };
  delete semantic.source_record_hash;
  delete semantic.materialized_file_location;
  return sha256(canonical(semantic));
}

function deterministicId(recordType, roleTime, payload) {
  return `mcft05_src_${sha256(canonical({ dataset_id: DATASET_ID, record_type: recordType, role_time: roleTime, payload })).slice(7, 31)}`;
}

function buildRecord({ scope, recordType, bindingId, epistemicClass, lifecycleClass, roleTime, quality = { status: 'PASS' }, limitations = [], payload }) {
  const availableToRuntimeAt = roleTime.available_to_runtime_at;
  if (typeof availableToRuntimeAt !== 'string' || !Number.isFinite(Date.parse(availableToRuntimeAt))) throw new Error(`AVAILABLE_TO_RUNTIME_REQUIRED:${recordType}`);
  if (typeof roleTime.ingested_at !== 'string' || !Number.isFinite(Date.parse(roleTime.ingested_at))) throw new Error(`INGESTED_AT_REQUIRED:${recordType}`);
  const sourceRecordId = deterministicId(recordType, roleTime, payload);
  const evidenceIdentityKey = `${DATASET_ID}:${recordType}:${sourceRecordId}`;
  const record = {
    dataset_id: DATASET_ID,
    source_record_id: sourceRecordId,
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: 'CONTROLLED_REPLAY_DATASET',
    origin_source_id: SOURCE_ID,
    source_version: '1',
    ingress_adapter_id: INGRESS_ADAPTER_ID,
    ingress_adapter_version: 1,
    epistemic_class: epistemicClass,
    action_lifecycle_class: lifecycleClass,
    ...scope,
    role_time: roleTime,
    available_to_runtime_at: availableToRuntimeAt,
    evidence_identity_key: evidenceIdentityKey,
    idempotency_key: sha256(evidenceIdentityKey),
    quality,
    limitations: [...limitations, 'controlled synthetic Replay Evidence', 'not live-field evidence'],
    source_payload: payload,
    canonical_payload: payload,
  };
  record.source_record_hash = recordHash(record);
  return record;
}

function evidenceRef(record) {
  return { ref: record.source_record_id, hash: record.source_record_hash };
}

function writeJsonl(file, records) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${records.map((record) => canonical(record)).join('\n')}\n`;
  fs.writeFileSync(file, text, 'utf8');
  return { path: path.basename(file), bytes: Buffer.byteLength(text), sha256: sha256(text), record_count: records.length };
}

function generate(options = {}) {
  const lockPath = options.lockPath || DEFAULT_LOCK;
  const outputDirectory = options.outputDirectory || DEFAULT_OUTPUT;
  const negativePath = options.negativePath || DEFAULT_NEGATIVE;
  const lock = readJson(lockPath);
  if (lock.status !== 'COMPLETE' || lock.expected_checkpoint?.checkpoint_sequence !== 72) throw new Error('CAP05_S0_PREDECESSOR_LOCK_REQUIRED');
  const scope = lock.expected_scope;
  const predecessor = lock.canonical_identity;
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  const optionSemantic = {
    scenario_set_ref: predecessor.latest_scenario_set_ref,
    scenario_set_hash: predecessor.latest_scenario_set_hash,
    option_id: 'IRRIGATE_NOW_15MM',
    assumed_irrigation_mm: 15,
  };
  const selectedOptionHash = sha256(canonical(optionSemantic));
  const selectedOptionRef = `geox-semantic-member://twin_scenario_set_v1/${predecessor.latest_scenario_set_ref}/options/by-option-id/IRRIGATE_NOW_15MM`;

  const decisionRequest = buildRecord({
    scope,
    recordType: 'controlled_human_decision_request_v1',
    bindingId: 'mcft_cap05_human_decision_request_replay_v1',
    epistemicClass: 'ASSERTED',
    lifecycleClass: 'DECISION_REQUEST',
    roleTime: { requested_at: '2026-06-04T01:05:00.000Z', ingested_at: '2026-06-04T01:05:00.000Z', available_to_runtime_at: '2026-06-04T01:05:00.000Z' },
    payload: {
      actor_class: 'HUMAN',
      actor_ref: 'human_operator_mcft_cap05_v1',
      decision_cycle_key: 'mcft_cap05_cycle_2026-06-04T02:00:00.000Z',
      scenario_set_ref: predecessor.latest_scenario_set_ref,
      scenario_set_hash: predecessor.latest_scenario_set_hash,
      selected_option_ref: selectedOptionRef,
      selected_option_hash: selectedOptionHash,
      selected_option_id: 'IRRIGATE_NOW_15MM',
      requested_disposition: 'SELECT_OPTION',
    },
  });

  const approvalAssertion = buildRecord({
    scope,
    recordType: 'approval_assertion_evidence_v1',
    bindingId: 'mcft_cap05_approval_assertion_replay_v1',
    epistemicClass: 'ASSERTED',
    lifecycleClass: 'APPROVAL_ASSERTION',
    roleTime: { asserted_at: '2026-06-04T01:10:00.000Z', approved_at: '2026-06-04T01:10:00.000Z', ingested_at: '2026-06-04T01:10:00.000Z', available_to_runtime_at: '2026-06-04T01:10:00.000Z' },
    payload: {
      decision_request_ref: evidenceRef(decisionRequest).ref,
      decision_request_hash: evidenceRef(decisionRequest).hash,
      selected_option_ref: selectedOptionRef,
      selected_option_hash: selectedOptionHash,
      approval_status: 'APPROVED',
      approval_semantics: 'EXTERNAL_OR_HUMAN_EVIDENCE_ASSERTION',
      approver_class: 'HUMAN',
      approver_ref: 'human_approver_mcft_cap05_v1',
      geox_approval_request_created: false,
      geox_approval_authority_exercised: false,
    },
  });

  const approvedPlan = buildRecord({
    scope,
    recordType: 'approved_irrigation_plan_snapshot_v1',
    bindingId: 'mcft_cap05_approved_plan_replay_v1',
    epistemicClass: 'ASSERTED',
    lifecycleClass: 'APPROVED_PLAN',
    roleTime: { created_at: '2026-06-04T01:11:00.000Z', approved_at: '2026-06-04T01:12:00.000Z', ingested_at: '2026-06-04T01:12:00.000Z', plan_effective_from: '2026-06-04T01:20:00.000Z', plan_effective_to: '2026-06-04T02:00:00.000Z', available_to_runtime_at: '2026-06-04T01:12:00.000Z' },
    payload: {
      approval_assertion_ref: evidenceRef(approvalAssertion).ref,
      approval_assertion_hash: evidenceRef(approvalAssertion).hash,
      decision_request_ref: evidenceRef(decisionRequest).ref,
      decision_request_hash: evidenceRef(decisionRequest).hash,
      selected_option_ref: selectedOptionRef,
      selected_option_hash: selectedOptionHash,
      scenario_amount_mm: 15,
      approved_amount_mm: 14,
      amount_difference_mm: -1,
      amount_difference_reason_codes: ['WATER_AVAILABILITY_LIMIT'],
      target_scope: scope,
      plan_status: 'APPROVED',
      active_for_decision: true,
    },
  });

  const dispatch = buildRecord({
    scope,
    recordType: 'external_dispatch_evidence_v1',
    bindingId: 'mcft_cap05_external_dispatch_replay_v1',
    epistemicClass: 'ASSERTED',
    lifecycleClass: 'DISPATCH_CONTEXT',
    roleTime: { dispatched_at: '2026-06-04T01:15:00.000Z', ingested_at: '2026-06-04T01:15:00.000Z', available_to_runtime_at: '2026-06-04T01:15:00.000Z' },
    payload: {
      approved_plan_ref: evidenceRef(approvedPlan).ref,
      approved_plan_hash: evidenceRef(approvedPlan).hash,
      dispatch_disposition: 'EXTERNALLY_RECORDED',
      dispatcher_class: 'EXTERNAL_SYSTEM',
      dispatcher_ref: 'external_dispatch_fixture_v1',
      geox_dispatch_created: false,
    },
  });

  const receipt = buildRecord({
    scope,
    recordType: 'irrigation_execution_receipt_evidence_v1',
    bindingId: 'mcft_cap05_irrigation_receipt_replay_v1',
    epistemicClass: 'OBSERVED',
    lifecycleClass: 'EXECUTION_RECEIPT',
    roleTime: { execution_start: '2026-06-04T01:20:00.000Z', execution_end: '2026-06-04T01:50:00.000Z', ingested_at: '2026-06-04T01:55:00.000Z', available_to_runtime_at: '2026-06-04T01:55:00.000Z' },
    payload: {
      event_id: 'mcft_cap05_irrigation_event_001',
      approved_plan_ref: evidenceRef(approvedPlan).ref,
      approved_plan_hash: evidenceRef(approvedPlan).hash,
      external_dispatch_ref: evidenceRef(dispatch).ref,
      external_dispatch_hash: evidenceRef(dispatch).hash,
      execution_status: 'PARTIALLY_EXECUTED',
      validation_status: 'PASSED',
      actual_amount_mm: 13.6,
      spatial_coverage_fraction: 0.91,
      target_scope_equivalent_irrigation_mm: 12.376,
      unit: 'mm',
      target_scope: scope,
      eligible_for_state_input: true,
      source_quality: 'PASS',
    },
  });

  const observation = buildRecord({
    scope,
    recordType: 'soil_moisture_observation_v1',
    bindingId: 'soil_obs_c8_20cm_v1',
    epistemicClass: 'OBSERVED',
    lifecycleClass: 'NOT_APPLICABLE',
    roleTime: { observed_at: '2026-06-04T03:00:00.000Z', ingested_at: '2026-06-04T03:00:00.000Z', available_to_runtime_at: '2026-06-04T03:00:00.000Z' },
    payload: { value: 0.224, unit: 'fraction', nominal_depth_mm: 200, spatial_support: 'POINT', representativeness: 'PARTIAL_ROOT_ZONE' },
  });

  const rainfall = buildRecord({
    scope,
    recordType: 'observed_rainfall_v1',
    bindingId: 'rainfall_obs_c8_v1',
    epistemicClass: 'OBSERVED',
    lifecycleClass: 'NOT_APPLICABLE',
    roleTime: { interval_start: '2026-06-04T02:00:00.000Z', interval_end: '2026-06-04T03:00:00.000Z', ingested_at: '2026-06-04T03:00:00.000Z', available_to_runtime_at: '2026-06-04T03:00:00.000Z' },
    payload: { value: 0, unit: 'mm' },
  });

  const et0 = buildRecord({
    scope,
    recordType: 'historical_et0_estimate_v1',
    bindingId: 'et0_historical_estimate_c8_v1',
    epistemicClass: 'ESTIMATED',
    lifecycleClass: 'NOT_APPLICABLE',
    roleTime: { interval_start: '2026-06-04T02:00:00.000Z', interval_end: '2026-06-04T03:00:00.000Z', ingested_at: '2026-06-04T03:00:00.000Z', available_to_runtime_at: '2026-06-04T03:00:00.000Z' },
    payload: { value: 0.11, unit: 'mm_per_hour', calculation_method: 'CONTROLLED_SYNTHETIC_ET0_PATTERN_V1', method_version: 1, input_weather_refs: [] },
  });

  const byFile = [
    ['decision_requests.jsonl', [decisionRequest]],
    ['approval_assertions.jsonl', [approvalAssertion]],
    ['approved_plans.jsonl', [approvedPlan]],
    ['external_dispatch.jsonl', [dispatch]],
    ['execution_receipts.jsonl', [receipt]],
    ['soil_observations.jsonl', [observation]],
    ['rainfall_context.jsonl', [rainfall]],
    ['et0_context.jsonl', [et0]],
  ];
  const files = byFile.map(([name, records]) => writeJsonl(path.join(outputDirectory, name), records));
  const records = byFile.flatMap(([, values]) => values);

  const negativeCases = [
    ['LATE_AFTER_LOGICAL_TIME_CUTOFF', receipt.source_record_id, { role_time: { available_to_runtime_at: '2026-06-04T02:00:00.001Z' } }],
    ['LATE_AFTER_EVIDENCE_WINDOW_FREEZE', receipt.source_record_id, { role_time: { available_to_runtime_at: '2026-06-04T02:00:00.000Z' }, frozen_window_contains: false }],
    ['CROSS_HOUR_EXECUTION', receipt.source_record_id, { role_time: { execution_start: '2026-06-04T01:50:00.000Z', execution_end: '2026-06-04T02:10:00.000Z' } }],
    ['MULTIPLE_EVENT', receipt.source_record_id, { additional_event_id: 'mcft_cap05_irrigation_event_002' }],
    ['CONFLICTING_DUPLICATE', receipt.source_record_id, { canonical_payload: { actual_amount_mm: 13.7 } }],
    ['WRONG_SCOPE', receipt.source_record_id, { zone_id: 'zone_wrong' }],
    ['WRONG_BINDING', receipt.source_record_id, { binding_id: 'wrong_binding' }],
    ['WRONG_UNIT', receipt.source_record_id, { canonical_payload: { unit: 'litre' } }],
    ['WRONG_STATUS', receipt.source_record_id, { canonical_payload: { execution_status: 'PLANNED' } }],
    ['MISSING_APPROVAL_ASSERTION', approvedPlan.source_record_id, { canonical_payload: { approval_assertion_ref: null } }],
    ['PLAN_ASSERTION_MISMATCH', approvedPlan.source_record_id, { canonical_payload: { approval_assertion_hash: 'sha256:forged' } }],
    ['EVIDENCE_IDENTITY_CONFLICT', approvalAssertion.source_record_id, { source_record_hash: 'sha256:forged' }],
  ].map(([caseId, baseSourceRecordId, mutation]) => ({ case_id: caseId, base_source_record_id: baseSourceRecordId, expected_result: 'REJECT', mutation }));

  fs.mkdirSync(path.dirname(negativePath), { recursive: true });
  const negativeSemantic = { schema_version: 'geox_mcft_cap_05_negative_fixtures_v1', dataset_id: DATASET_ID, cases: negativeCases };
  fs.writeFileSync(negativePath, `${canonical({ ...negativeSemantic, determinism_hash: sha256(canonical(negativeSemantic)) })}\n`, 'utf8');

  const roleCounts = Object.fromEntries(records.map((record) => record.record_type).sort().map((role) => [role, records.filter((record) => record.record_type === role).length]));
  const manifestSemantic = {
    schema_version: 'geox_mcft_cap_05_feedback_dataset_manifest_v1',
    dataset_id: DATASET_ID,
    dataset_truth_class: 'CONTROLLED_REPLAY_EVIDENCE',
    predecessor_lock_ref: path.relative(ROOT, lockPath).replaceAll('\\', '/'),
    coverage_start: '2026-06-04T01:05:00.000Z',
    coverage_end_inclusive: '2026-06-04T03:00:00.000Z',
    target_state_tick: '2026-06-04T02:00:00.000Z',
    target_outcome_observation_time: '2026-06-04T03:00:00.000Z',
    top_level_evidence_record_count: records.length,
    role_counts: roleCounts,
    file_count: files.length,
    files,
    negative_fixture_count: negativeCases.length,
    source_record_hashes: records.map((record) => record.source_record_hash).sort(),
    standard_values: { scenario_amount_mm: 15, approved_amount_mm: 14, actual_amount_mm: 13.6, spatial_coverage_fraction: 0.91, target_scope_equivalent_irrigation_mm: 12.376 },
    nonclaims: ['NO_CANONICAL_DECISION_OBJECT', 'NO_CANONICAL_ACTION_FEEDBACK_OBJECT', 'NO_CANONICAL_FORECAST_RESIDUAL_OBJECT', 'NO_RUNTIME_STATE_WRITE'],
  };
  const manifest = { ...manifestSemantic, whole_dataset_semantic_hash: sha256(canonical(manifestSemantic)) };
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${canonical(manifest)}\n`, 'utf8');
  return manifest;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--output') options.outputDirectory = path.resolve(argv[++i]);
    else if (argv[i] === '--lock') options.lockPath = path.resolve(argv[++i]);
    else if (argv[i] === '--negative') options.negativePath = path.resolve(argv[++i]);
    else throw new Error(`UNKNOWN_ARGUMENT:${argv[i]}`);
  }
  return options;
}

if (require.main === module) {
  const manifest = generate(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ ok: true, dataset_id: manifest.dataset_id, records: manifest.top_level_evidence_record_count, files: manifest.file_count, negatives: manifest.negative_fixture_count, hash: manifest.whole_dataset_semantic_hash })}\n`);
}

module.exports = { canonical, generate, recordHash, sha256 };
