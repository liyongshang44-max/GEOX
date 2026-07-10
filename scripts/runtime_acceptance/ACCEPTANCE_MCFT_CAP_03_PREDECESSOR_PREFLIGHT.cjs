// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_PREDECESSOR_PREFLIGHT.cjs
// Purpose: execute the completed MCFT-CAP-02 24-tick chain in isolated PostgreSQL, extract the canonical CAP-03 predecessor handoff, and finalize the governance-only S0 artifacts.
// Boundary: destructive isolated-database acceptance and governance artifact generation only; no CAP-03 Runtime source, assimilation, selector, migration, route, scheduler, web, tick, or CAP-04 authorization.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_MAIN = 'd1a3948d06e4c7896d513168d31ef52409c3e0f0';
const BRANCH = 'mcft-cap-03-gov-authorization-and-predecessor-lock-v1';
const S0 = 'MCFT-CAP-03.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const S1 = 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATION-CONTRACTS-CONFIG-V1';
const EXPECTED_LAST_LOGICAL_TIME = '2026-06-02T01:00:00.000Z';
const EXPECTED_NEXT_LOGICAL_TIME = '2026-06-02T02:00:00.000Z';
const EXPECTED_CHECKPOINT_SEQUENCE = 24;
const EXPECTED_SCOPE = Object.freeze({
  tenant_id: 'tenantA',
  project_id: 'projectA',
  group_id: 'groupA',
  field_id: 'field_c8_demo',
  season_id: 'season_2026_c8_corn',
  zone_id: 'zone_mcft_c8_water_001',
});

const TASK_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md';
const ALIGNMENT_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-S0-ALIGNMENT-REVIEW.md';
const ERRATUM_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-02-HANDOFF-ERRATUM-01.json';
const AUTHORIZATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION.md';
const AUTHORIZATION_STATUS_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-AUTHORIZATION-STATUS.json';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const LOCK_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-PREDECESSOR-LOCK.json';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const PREFLIGHT_PATH = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_PREDECESSOR_PREFLIGHT.cjs';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_AUTHORIZATION.cjs';
const CAP02_MAIN_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-MAIN-VERIFICATION.json';
const CAP02_CLOSURE_RECORD_PATH = 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-CLOSURE-RECORD.json';
const EVIDENCE_PATH = 'acceptance-output/MCFT_CAP_03_PREDECESSOR_IDENTITY.json';

const EXACT_CHANGED_FILES = Object.freeze([
  MAP_PATH,
  MATRIX_PATH,
  ERRATUM_PATH,
  AUTHORIZATION_PATH,
  AUTHORIZATION_STATUS_PATH,
  DELIVERY_PATH,
  LOCK_PATH,
  ALIGNMENT_PATH,
  TASK_PATH,
  GATE_PATH,
  PREFLIGHT_PATH,
].sort());

const COMPLETION_CLAIMS = Object.freeze([
  'MCFT_CAP_03_COMPLETE',
  'OBSERVATION_ASSIMILATION_V1_ESTABLISHED',
  'STATE_OBSERVATION_INNOVATION_RESIDUAL_ESTABLISHED',
  'DETERMINISTIC_OBSERVATION_SELECTION_ESTABLISHED',
  'PASS_OBSERVATION_ACCEPTANCE_ESTABLISHED',
  'LIMITED_OBSERVATION_DOWNWEIGHTING_ESTABLISHED',
  'OBSERVATION_CANDIDATE_EXCLUSION_ESTABLISHED',
  'INNOVATION_OUTLIER_REJECTION_ESTABLISHED',
  'POSTERIOR_STATE_CORRECTION_ESTABLISHED',
  'ASSIMILATION_UNCERTAINTY_UPDATE_ESTABLISHED',
  'OBSERVATION_DISPOSITION_TRACE_ESTABLISHED',
  'TWENTY_FOUR_OBSERVATION_AWARE_TICKS_PERSISTED',
  'ASSIMILATION_RESTART_BACKFILL_PROVEN',
  'ASSIMILATED_STATE_CANONICAL_UNIQUENESS_ESTABLISHED',
  'VERSIONED_ASSIMILATION_RECORD_SET_COMPATIBILITY_ESTABLISHED',
]);

const CLOSURE_PRESERVED_NONCLAIMS = Object.freeze([
  'NO_FORECAST_RESIDUAL',
  'NO_SUCCESSFUL_FORECAST',
  'NO_72_HOUR_FORECAST',
  'NO_SCENARIO',
  'NO_RECOMMENDATION',
  'NO_POLICY_EVALUATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_CALIBRATION_CANDIDATE',
  'NO_SHADOW_EVALUATION',
  'NO_MODEL_ACTIVATION',
  'NO_ACTIVE_MODEL_PARAMETER_CHANGE',
  'NO_CALIBRATED_CONFIDENCE_MODEL',
  'NO_MULTI_SENSOR_FUSION',
  'NO_DYNAMIC_ROOT_ZONE_GEOMETRY',
  'NO_LATE_EVIDENCE_REVISION',
  'NO_AUTOMATIC_RECOMPUTE_ON_LATE_EVIDENCE',
  'NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_CONTINUOUS_SCHEDULER',
  'NO_720_TICK_REPLAY_CLOSURE',
  'NO_LIVE_FIELD_CLAIM',
  'NO_FIELD_VALIDATED_OBSERVATION_OPERATOR',
  'NO_FIELD_CALIBRATED_ASSIMILATION_NOISE_MODEL',
  'NO_MCFT_GATE_A_CLOSURE',
  'NO_MCFT_GATE_B_CLOSURE',
  'NO_MCFT_GATE_C_CLOSURE',
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
]);

const PREAUTH_NONCLAIMS = Object.freeze([
  'NO_MCFT_CAP_03_RUNTIME_AUTHORIZATION',
  'NO_MCFT_CAP_03_COMPLETE_CLAIM',
  'NO_OBSERVATION_UPDATE_APPLIED',
  'NO_OBSERVATION_INNOVATION_COMPUTED',
  ...CLOSURE_PRESERVED_NONCLAIMS,
]);

const SLICE_DEFINITIONS = Object.freeze([
  {
    delivery_slice_id: S0,
    primary_owner_work_package_id: 'MCFT-07',
    contributing_owner_work_package_ids: ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-06', 'MCFT-08', 'MCFT-09'],
    depends_on_delivery_slice_ids: [],
  },
  {
    delivery_slice_id: S1,
    primary_owner_work_package_id: 'MCFT-02',
    contributing_owner_work_package_ids: ['MCFT-07', 'MCFT-08'],
    depends_on_delivery_slice_ids: [S0],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1',
    primary_owner_work_package_id: 'MCFT-07',
    contributing_owner_work_package_ids: ['MCFT-05'],
    depends_on_delivery_slice_ids: [S1],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1',
    primary_owner_work_package_id: 'MCFT-02',
    contributing_owner_work_package_ids: ['MCFT-07', 'MCFT-08'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.MCFT-05-07.OBSERVATION-SELECTION-AND-ASSIMILATION-MATH-V1'],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1',
    primary_owner_work_package_id: 'MCFT-03',
    contributing_owner_work_package_ids: ['MCFT-08'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.MCFT-02-07-08.ASSIMILATED-A2-RECORD-SET-BUILDER-V1'],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1',
    primary_owner_work_package_id: 'MCFT-04',
    contributing_owner_work_package_ids: ['MCFT-05', 'MCFT-06', 'MCFT-07', 'MCFT-08', 'MCFT-09'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.MCFT-03-08.ASSIMILATED-A2-PERSISTENCE-RECOVERY-V1'],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1',
    primary_owner_work_package_id: 'MCFT-04',
    contributing_owner_work_package_ids: ['MCFT-07', 'MCFT-08'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.MCFT-04-05-06-07-08-09.SINGLE-TICK-INTEGRATION-V1'],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1',
    primary_owner_work_package_id: 'MCFT-04',
    contributing_owner_work_package_ids: ['MCFT-03', 'MCFT-07', 'MCFT-08'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.MCFT-04-07-08.TWENTY-FOUR-OBSERVATION-AWARE-TICK-RANGE-V1'],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.CLOSURE-V1',
    primary_owner_work_package_id: 'MCFT-07',
    contributing_owner_work_package_ids: ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-06', 'MCFT-08', 'MCFT-09'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.MCFT-03-04-07-08.RESTART-BACKFILL-RECOVERY-V1'],
  },
  {
    delivery_slice_id: 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1',
    primary_owner_work_package_id: 'MCFT-07',
    contributing_owner_work_package_ids: ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-06', 'MCFT-08', 'MCFT-09'],
    depends_on_delivery_slice_ids: ['MCFT-CAP-03.CLOSURE-V1'],
  },
]);

let pass = 0;

function ok(message) {
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function fail(code, details = '') {
  throw new Error(details ? `${code}:${details}` : code);
}

function run(executable, args, options = {}) {
  const result = cp.spawnSync(executable, args, {
    cwd: options.cwd || ROOT,
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    shell: false,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${executable} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  return String(result.stdout || '');
}

function git(args) {
  return run(process.platform === 'win32' ? 'git.exe' : 'git', args).trim();
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relativePath, value) {
  const absolutePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${String(value).replace(/\r\n/g, '\n').trimEnd()}\n`, 'utf8');
}

function resolveDatabaseName(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('DATABASE_URL_INVALID');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!name) fail('DATABASE_NAME_REQUIRED');
  if (!/(mcft|cap.*03|acceptance|test)/i.test(name)) fail('ISOLATED_ACCEPTANCE_DATABASE_REQUIRED', name);
  return name;
}

function scopeValues() {
  return [
    EXPECTED_SCOPE.tenant_id,
    EXPECTED_SCOPE.project_id,
    EXPECTED_SCOPE.group_id,
    EXPECTED_SCOPE.field_id,
    EXPECTED_SCOPE.season_id,
    EXPECTED_SCOPE.zone_id,
  ];
}

function assertRepositoryBoundary() {
  assert.equal(git(['branch', '--show-current']), BRANCH, 'S0_BRANCH_REQUIRED');
  assert.equal(git(['rev-parse', 'refs/heads/main']), BASELINE_MAIN, 'LOCAL_MAIN_HEAD_MISMATCH');
  try {
    assert.equal(git(['rev-parse', 'refs/remotes/origin/main']), BASELINE_MAIN, 'ORIGIN_MAIN_HEAD_MISMATCH');
  } catch (error) {
    if (!String(error.message).includes('unknown revision') && !String(error.message).includes('ambiguous argument')) throw error;
  }
  run(process.platform === 'win32' ? 'git.exe' : 'git', ['merge-base', '--is-ancestor', BASELINE_MAIN, 'HEAD']);
  const changed = git(['diff', '--name-only', BASELINE_MAIN]).split(/\r?\n/).filter(Boolean);
  const forbidden = changed.filter((file) => !EXACT_CHANGED_FILES.includes(file));
  assert.deepEqual(forbidden, [], `S0_CHANGED_FILE_BOUNDARY_VIOLATION:${forbidden.join(',')}`);
  ok('branch, main baseline, ancestry, and governance-only boundary are exact');
}

function factEnvelope(recordJson) {
  const record = typeof recordJson === 'string' ? JSON.parse(recordJson) : recordJson;
  assert.ok(record && typeof record === 'object' && record.payload && typeof record.payload === 'object', 'CANONICAL_FACT_ENVELOPE_INVALID');
  return record.payload;
}

async function readCanonicalObject(pool, objectId, objectType) {
  const result = await pool.query(
    "SELECT record_json FROM facts WHERE record_json->'payload'->>'object_id'=$1 AND record_json->>'type'=$2",
    [objectId, objectType],
  );
  assert.equal(result.rows.length, 1, `CANONICAL_OBJECT_CARDINALITY:${objectType}:${objectId}`);
  const object = factEnvelope(result.rows[0].record_json);
  assert.equal(object.object_id, objectId, `CANONICAL_OBJECT_ID_MISMATCH:${objectType}`);
  assert.equal(object.object_type, objectType, `CANONICAL_OBJECT_TYPE_MISMATCH:${objectType}`);
  return object;
}

async function extractIdentity(pool) {
  const values = scopeValues();
  const active = await pool.query(
    'SELECT active_lineage_ref FROM twin_active_lineage_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    values,
  );
  const stateLatest = await pool.query(
    'SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    values,
  );
  const checkpointLatest = await pool.query(
    'SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    values,
  );
  const forecastLatest = await pool.query(
    'SELECT forecast_object_id,forecast_status FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    values,
  );
  const successfulLatest = await pool.query(
    'SELECT forecast_object_id FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6',
    values,
  );

  assert.equal(active.rows.length, 1, 'ACTIVE_LINEAGE_POINTER_CARDINALITY');
  assert.equal(stateLatest.rows.length, 1, 'STATE_POINTER_CARDINALITY');
  assert.equal(checkpointLatest.rows.length, 1, 'CHECKPOINT_POINTER_CARDINALITY');
  assert.equal(forecastLatest.rows.length, 1, 'FORECAST_POINTER_CARDINALITY');
  assert.equal(successfulLatest.rows.length, 0, 'SUCCESSFUL_FORECAST_POINTER_MUST_BE_ABSENT');

  const activeLineageRef = active.rows[0].active_lineage_ref;
  const latestStateRef = stateLatest.rows[0].state_object_id;
  const latestCheckpointRef = checkpointLatest.rows[0].checkpoint_object_id;
  const latestForecastRef = forecastLatest.rows[0].forecast_object_id;

  const lineage = await readCanonicalObject(pool, activeLineageRef, 'twin_runtime_lineage_v1');
  const state = await readCanonicalObject(pool, latestStateRef, 'twin_state_estimate_v1');
  const checkpoint = await readCanonicalObject(pool, latestCheckpointRef, 'twin_runtime_checkpoint_v1');
  const forecast = await readCanonicalObject(pool, latestForecastRef, 'twin_forecast_run_v1');
  const runtimeConfig = await readCanonicalObject(pool, state.runtime_config_ref, 'twin_runtime_config_v1');

  assert.equal(lineage.object_id, activeLineageRef, 'ACTIVE_LINEAGE_OBJECT_REF_MISMATCH');
  for (const object of [state, checkpoint, forecast]) {
    assert.equal(object.lineage_id, lineage.lineage_id, `${object.object_type}:LINEAGE_ID_MISMATCH`);
    assert.equal(object.revision_id, lineage.revision_id, `${object.object_type}:REVISION_ID_MISMATCH`);
    assert.equal(object.logical_time, EXPECTED_LAST_LOGICAL_TIME, `${object.object_type}:FINAL_LOGICAL_TIME_MISMATCH`);
  }
  assert.equal(checkpoint.payload.tick_sequence, EXPECTED_CHECKPOINT_SEQUENCE, 'CHECKPOINT_SEQUENCE_MISMATCH');
  assert.equal(checkpoint.payload.next_tick_logical_time, EXPECTED_NEXT_LOGICAL_TIME, 'CHECKPOINT_NEXT_TIME_MISMATCH');
  assert.equal(checkpoint.payload.last_posterior_state_ref, state.object_id, 'CHECKPOINT_STATE_REF_MISMATCH');
  assert.equal(checkpoint.payload.forecast_result_ref, forecast.object_id, 'CHECKPOINT_FORECAST_REF_MISMATCH');
  assert.equal(state.runtime_config_ref, runtimeConfig.object_id, 'STATE_RUNTIME_CONFIG_REF_MISMATCH');
  assert.equal(state.runtime_config_hash, runtimeConfig.determinism_hash, 'STATE_RUNTIME_CONFIG_HASH_MISMATCH');
  assert.equal(forecastLatest.rows[0].forecast_status, 'BLOCKED', 'FORECAST_PROJECTION_STATUS_MISMATCH');
  assert.equal(forecast.payload.status, 'BLOCKED', 'FORECAST_STATUS_MISMATCH');
  assert.ok(Array.isArray(forecast.payload.points) && forecast.payload.points.length === 0, 'FORECAST_POINTS_MUST_BE_EMPTY');

  ok('PostgreSQL canonical lineage, State, checkpoint, BLOCKED Forecast, and pinned Runtime Config are mutually consistent');

  return {
    schema_version: 'geox_mcft_cap_03_predecessor_identity_evidence_v1',
    extraction_source: 'ISOLATED_POSTGRESQL_CANONICAL_READ_PATH',
    baseline_main_commit: BASELINE_MAIN,
    scope: EXPECTED_SCOPE,
    active_lineage_ref: lineage.object_id,
    lineage_id: lineage.lineage_id,
    revision_id: lineage.revision_id,
    latest_state_ref: state.object_id,
    latest_state_hash: state.determinism_hash,
    latest_state_logical_time: state.logical_time,
    latest_checkpoint_ref: checkpoint.object_id,
    latest_checkpoint_hash: checkpoint.determinism_hash,
    latest_forecast_result_ref: forecast.object_id,
    latest_forecast_result_hash: forecast.determinism_hash,
    latest_forecast_status: forecast.payload.status,
    latest_successful_forecast_ref: null,
    runtime_config_ref: runtimeConfig.object_id,
    runtime_config_hash: runtimeConfig.determinism_hash,
    checkpoint_tick_sequence: checkpoint.payload.tick_sequence,
    checkpoint_next_tick_logical_time: checkpoint.payload.next_tick_logical_time,
    validated_relations: [
      'active_lineage_ref_equals_lineage_object_id',
      'lineage_id_consistent_across_lineage_state_checkpoint_forecast',
      'revision_id_consistent_across_lineage_state_checkpoint_forecast',
      'checkpoint_last_posterior_state_ref_equals_latest_state_ref',
      'checkpoint_forecast_result_ref_equals_latest_forecast_result_ref',
      'state_runtime_config_ref_hash_matches_persisted_runtime_config',
      'latest_successful_forecast_ref_is_null',
      'checkpoint_tick_sequence_equals_24',
      'checkpoint_next_tick_logical_time_equals_2026_06_02T02_00_00Z',
    ],
  };
}

function buildDownstreamSlice(definition) {
  const isFinalization = definition.delivery_slice_id === 'MCFT-CAP-03.CLOSURE-FINALIZATION-V1';
  return {
    ...definition,
    baseline_main_commit: null,
    branch: null,
    status: 'BLOCKED',
    activation_fields_status: 'TO_BE_FROZEN_AT_SLICE_ACTIVATION',
    allowed_claims: [],
    preserved_nonclaims: [...PREAUTH_NONCLAIMS],
    exact_changed_file_boundary: [],
    effectiveness_condition: isFinalization
      ? 'S8_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_FINALIZATION_GATE_PASS'
      : 'PREDECESSOR_SLICE_MERGED_AND_MERGED_MAIN_GATE_PASS_AND_EXPLICIT_SLICE_ACTIVATION',
  };
}

function updateGovernanceArtifacts(identity) {
  writeJson(EVIDENCE_PATH, identity);

  writeJson(LOCK_PATH, {
    schema_version: 'geox_mcft_cap_03_predecessor_lock_v2',
    capability_line_id: 'MCFT-CAP-03',
    predecessor_capability_line_id: 'MCFT-CAP-02',
    status: 'COMPLETE',
    baseline_main_commit: BASELINE_MAIN,
    predecessor_main_verification_ref: CAP02_MAIN_VERIFICATION_PATH,
    predecessor_closure_record_ref: CAP02_CLOSURE_RECORD_PATH,
    predecessor_handoff_erratum_ref: ERRATUM_PATH,
    identity_extraction_source: identity.extraction_source,
    identity_evidence_ref: EVIDENCE_PATH,
    expected_scope: EXPECTED_SCOPE,
    expected_checkpoint: {
      tick_sequence: EXPECTED_CHECKPOINT_SEQUENCE,
      last_continuation_logical_time: EXPECTED_LAST_LOGICAL_TIME,
      next_tick_logical_time: EXPECTED_NEXT_LOGICAL_TIME,
    },
    canonical_identity: {
      active_lineage_ref: identity.active_lineage_ref,
      lineage_id: identity.lineage_id,
      revision_id: identity.revision_id,
      latest_state_ref: identity.latest_state_ref,
      latest_state_hash: identity.latest_state_hash,
      latest_checkpoint_ref: identity.latest_checkpoint_ref,
      latest_checkpoint_hash: identity.latest_checkpoint_hash,
      latest_forecast_result_ref: identity.latest_forecast_result_ref,
      latest_forecast_result_hash: identity.latest_forecast_result_hash,
      latest_successful_forecast_ref: null,
      runtime_config_ref: identity.runtime_config_ref,
      runtime_config_hash: identity.runtime_config_hash,
    },
    validated_relations: [...identity.validated_relations],
    lock_claims: [
      'MCFT_CAP_02_MERGED_MAIN_COMPLETE_VERIFIED',
      'MCFT_CAP_03_PREDECESSOR_CANONICAL_IDENTITY_EXTRACTED_FROM_POSTGRESQL',
      'MCFT_CAP_03_PREDECESSOR_LINEAGE_REVISION_STATE_CHECKPOINT_FORECAST_CONFIG_LOCKED',
      'MCFT_CAP_03_PREDECESSOR_NEXT_LOGICAL_TICK_LOCKED',
    ],
    failure_policy: {
      canonical_value_mismatch: 'FAIL_CLOSED',
      missing_projection_or_canonical_object: 'FAIL_CLOSED',
      new_revision: 'FORBIDDEN',
      replay_01_00: 'FORBIDDEN',
      predecessor_fact_mutation: 'FORBIDDEN',
      manual_alternate_start: 'FORBIDDEN',
    },
    preserved_nonclaims: [...PREAUTH_NONCLAIMS],
    effectiveness_condition: 'POSTGRESQL_IDENTITY_EXTRACTED_AND_S0_PR_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  });

  writeJson(ERRATUM_PATH, {
    schema_version: 'geox_mcft_cap_02_handoff_erratum_v2',
    erratum_id: 'GEOX-MCFT-CAP-02-HANDOFF-ERRATUM-01',
    status: 'READY_FOR_MERGE_CANONICAL_CHECKPOINT_VERIFIED',
    predecessor_capability_line_id: 'MCFT-CAP-02',
    successor_capability_line_id: 'MCFT-CAP-03',
    baseline_main_commit: BASELINE_MAIN,
    superseded_field: {
      artifacts: [
        CAP02_MAIN_VERIFICATION_PATH,
        CAP02_CLOSURE_RECORD_PATH,
      ],
      field: 'successor.required_start_logical_time',
      historical_value: '2026-06-02T01:00:00.000Z',
    },
    canonical_authority: {
      source: 'PERSISTED_POSTGRESQL_CHECKPOINT_CANONICAL_READ_PATH',
      field: 'checkpoint.payload.next_tick_logical_time',
      expected_value: EXPECTED_NEXT_LOGICAL_TIME,
      observed_value: identity.checkpoint_next_tick_logical_time,
      checkpoint_tick_sequence: identity.checkpoint_tick_sequence,
      design_cross_check_ref: 'docs/digital_twin/mcft/cap_02/GEOX-MCFT-CAP-02-TWENTY-FOUR-TICK-RANGE-CONTRACT.json',
      postgresql_read_status: 'PASS',
      predecessor_lock_ref: LOCK_PATH,
    },
    mutation_policy: {
      predecessor_historical_artifact_rewrite: 'FORBIDDEN',
      additive_erratum_only: 'REQUIRED',
      predecessor_canonical_fact_mutation: 'FORBIDDEN',
      alternate_start_override: 'FORBIDDEN',
    },
    effectiveness_condition: 'S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
    nonclaims: [
      'NO_PREDECESSOR_HISTORY_REWRITE',
      'NO_MCFT_CAP_03_RUNTIME_AUTHORIZATION',
      'NO_OBSERVATION_UPDATE_APPLIED',
      'NO_OBSERVATION_INNOVATION_COMPUTED',
    ],
  });

  const s0Slice = {
    ...SLICE_DEFINITIONS[0],
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    status: 'READY_FOR_MERGE',
    runtime_source_authorized: false,
    allowed_claims: [
      'MCFT_CAP_02_COMPLETE_VERIFIED',
      'MCFT_CAP_02_HANDOFF_ERRATUM_RECORDED',
      'MCFT_CAP_03_PREDECESSOR_IDENTITY_LOCKED',
      'MCFT_CAP_03_DELIVERY_GRAPH_FROZEN',
      'MCFT_CAP_03_OWNER_BOUNDARY_FROZEN',
      'MCFT_CAP_03_TASK_V1_2_FINAL_FROZEN_CANDIDATE_RECORDED',
    ],
    preserved_nonclaims: [...PREAUTH_NONCLAIMS],
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    effectiveness_condition: 'S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  };

  const delivery = {
    schema_version: 'geox_mcft_cap_03_delivery_slice_status_v2',
    capability_line_id: 'MCFT-CAP-03',
    display_alias: 'MCFT-3',
    name: 'Observation Assimilation and State Innovation',
    runtime_mode: 'REPLAY',
    target_completion_level: 'Level A',
    baseline_main_commit: BASELINE_MAIN,
    status: 'AUTHORIZATION_READY_FOR_MERGE',
    design_status: 'FINAL_FROZEN_CANDIDATE_V1_2',
    implementation_status: 'NOT_AUTHORIZED',
    authorization_effective: false,
    runtime_source_authorized: false,
    active_delivery_slice_id: S0,
    merge_before_next: true,
    postmerge_verify_before_next: true,
    parallel_downstream_pr_forbidden: true,
    task_ref: TASK_PATH,
    predecessor_lock_ref: LOCK_PATH,
    predecessor_handoff_erratum_ref: ERRATUM_PATH,
    preserved_nonclaims: [...PREAUTH_NONCLAIMS],
    pending_completion_claims: [...COMPLETION_CLAIMS],
    slices: [
      s0Slice,
      ...SLICE_DEFINITIONS.slice(1).map(buildDownstreamSlice),
    ],
    next_authorized_slice_ids: [],
    next_authorized_slice_id_after_s0_effectiveness: S1,
    successor_capability_line_id: 'MCFT-CAP-04',
    successor_authorized: false,
    authorization_effectiveness_condition: 'S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  };
  writeJson(DELIVERY_PATH, delivery);

  writeJson(AUTHORIZATION_STATUS_PATH, {
    schema_version: 'geox_mcft_cap_03_authorization_status_v2',
    authorization_id: 'MCFT-CAP-03-AUTHORIZATION-V1',
    capability_line_id: 'MCFT-CAP-03',
    display_alias: 'MCFT-3',
    name: 'Observation Assimilation and State Innovation',
    runtime_mode: 'REPLAY',
    target_completion_level: 'Level A',
    status: 'READY_FOR_MERGE',
    design_status: 'FINAL_FROZEN_CANDIDATE_V1_2',
    implementation_status: 'NOT_AUTHORIZED',
    authorization_effective: false,
    authorization_effectiveness_condition: 'S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
    baseline_main_commit: BASELINE_MAIN,
    branch: BRANCH,
    active_delivery_slice_id: S0,
    task_ref: TASK_PATH,
    authorization_document_ref: AUTHORIZATION_PATH,
    predecessor: {
      capability_line_id: 'MCFT-CAP-02',
      status: 'COMPLETE',
      closure_effective: true,
      main_verification_ref: CAP02_MAIN_VERIFICATION_PATH,
      closure_record_ref: CAP02_CLOSURE_RECORD_PATH,
      handoff_erratum_ref: ERRATUM_PATH,
      predecessor_lock_ref: LOCK_PATH,
      postgresql_canonical_lock_status: 'COMPLETE',
      checkpoint_tick_sequence: identity.checkpoint_tick_sequence,
      next_tick_logical_time: identity.checkpoint_next_tick_logical_time,
    },
    primary_owner_work_package_id: 'MCFT-07',
    authorized_owner_work_package_ids: ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-06', 'MCFT-07', 'MCFT-08', 'MCFT-09'],
    excluded_owner_work_package_ids: ['MCFT-10', 'MCFT-11', 'MCFT-12', 'MCFT-13', 'MCFT-14', 'MCFT-15', 'MCFT-16', 'MCFT-17', 'MCFT-18'],
    current_blockers: [
      'MCFT_CAP_03_S0_PR_MERGED',
      'MCFT_CAP_03_S0_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
    ],
    premerge_satisfied_conditions: [
      'MCFT_CAP_02_COMPLETE_ON_CANONICAL_MAIN',
      'MCFT_CAP_03_TASK_V1_2_COMMITTED',
      'MCFT_CAP_02_HANDOFF_ERRATUM_RECORDED',
      'MCFT_CAP_03_PREDECESSOR_CANONICAL_IDENTITY_LOCK_COMPLETE',
      'MCFT_CAP_03_DELIVERY_GRAPH_FROZEN',
      'MCFT_CAP_03_OWNER_BOUNDARY_FROZEN',
      'MCFT_CAP_03_MATRIX_AND_IMPLEMENTATION_MAP_UPDATED',
      'MCFT_CAP_03_AUTHORIZATION_GATE_IMPLEMENTED',
      'MCFT_CAP_03_POSTGRESQL_PREFLIGHT_IMPLEMENTED',
    ],
    allowed_claims_after_merge_and_postmerge_gate: [
      'MCFT_CAP_03_AUTHORIZATION_V1_ESTABLISHED',
      'MCFT_CAP_03_DESIGN_FROZEN',
      'MCFT_CAP_03_READY_FOR_IMPLEMENTATION',
      'MCFT_CAP_03_DELIVERY_GRAPH_FROZEN',
      'MCFT_CAP_03_OWNER_BOUNDARY_FROZEN',
      'MCFT_CAP_03_PREDECESSOR_IDENTITY_LOCKED',
    ],
    preserved_nonclaims: [...PREAUTH_NONCLAIMS],
    runtime_source_authorized: false,
    repository_write_scope: 'S0_GOVERNANCE_ONLY',
    exact_changed_file_boundary: [...EXACT_CHANGED_FILES],
    next_authorized_slice_id_after_effectiveness: S1,
    successor_capability_line_id: 'MCFT-CAP-04',
    successor_authorized: false,
  });

  const matrix = readJson(MATRIX_PATH);
  matrix.schema_version = 'geox_mcft_vertical_capability_line_matrix_v5';
  matrix.latest_governance_update = 'MCFT-CAP-03-AUTHORIZATION-V1';
  matrix.capability_lines = (matrix.capability_lines || []).filter((line) => line.capability_line_id !== 'MCFT-CAP-03');
  matrix.capability_lines.push({
    capability_line_id: 'MCFT-CAP-03',
    display_alias: 'MCFT-3',
    name: 'Observation Assimilation and State Innovation',
    runtime_mode: 'REPLAY',
    target_completion_level: 'Level A',
    status: 'AUTHORIZATION_READY_FOR_MERGE',
    authorization_id: 'MCFT-CAP-03-AUTHORIZATION-V1',
    authorization_status: 'READY_FOR_MERGE',
    authorization_effective: false,
    runtime_source_authorized: false,
    design_status: 'FINAL_FROZEN_CANDIDATE_V1_2',
    implementation_status: 'NOT_AUTHORIZED',
    predecessor_capability_line_id: 'MCFT-CAP-02',
    predecessor_main_commit: BASELINE_MAIN,
    predecessor_lock_ref: LOCK_PATH,
    predecessor_handoff_erratum_ref: ERRATUM_PATH,
    active_delivery_slice_id: S0,
    authorized_owner_work_package_ids: ['MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05', 'MCFT-06', 'MCFT-07', 'MCFT-08', 'MCFT-09'],
    excluded_owner_work_package_ids: ['MCFT-10', 'MCFT-11', 'MCFT-12', 'MCFT-13', 'MCFT-14', 'MCFT-15', 'MCFT-16', 'MCFT-17', 'MCFT-18'],
    delivery_slices: delivery.slices,
    pending_completion_claims: [...COMPLETION_CLAIMS],
    preserved_nonclaims: [...PREAUTH_NONCLAIMS],
    next_authorized_slice_ids: [],
    next_authorized_slice_id_after_merge_and_postmerge_gate: S1,
    successor_capability_line_id: 'MCFT-CAP-04',
    successor_authorized: false,
    effectiveness_condition: 'S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  });
  matrix.global_rules = [...new Set([
    ...(matrix.global_rules || []),
    'MCFT-CAP-03 Runtime implementation begins only after S0 merges and the merged-main Authorization Gate passes',
    'MCFT-CAP-03 predecessor start time is authoritative only from the persisted checkpoint canonical read path',
    'MCFT-CAP-03 authorization does not authorize MCFT-CAP-04',
  ])];
  writeJson(MATRIX_PATH, matrix);

  const authorization = `<!-- ${AUTHORIZATION_PATH} -->
# GEOX MCFT-CAP-03 Authorization and Predecessor Lock

## Authority

\`\`\`text
authorization_id:
MCFT-CAP-03-AUTHORIZATION-V1

delivery_slice_id:
${S0}

baseline_main_commit:
${BASELINE_MAIN}

task:
${TASK_PATH}

authorization_status:
READY_FOR_MERGE

authorization_effective:
false

runtime_source_authorized:
false

effectiveness_condition:
S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS
\`\`\`

## Predecessor proof

MCFT-CAP-02 is COMPLETE on the baseline main commit. The isolated PostgreSQL canonical read path established:

\`\`\`text
active_lineage_ref:
${identity.active_lineage_ref}

lineage_id:
${identity.lineage_id}

revision_id:
${identity.revision_id}

latest_state_ref:
${identity.latest_state_ref}

latest_checkpoint_ref:
${identity.latest_checkpoint_ref}

latest_forecast_result_ref:
${identity.latest_forecast_result_ref}

latest_successful_forecast_ref:
null

runtime_config_ref:
${identity.runtime_config_ref}

checkpoint.tick_sequence:
${identity.checkpoint_tick_sequence}

checkpoint.next_tick_logical_time:
${identity.checkpoint_next_tick_logical_time}
\`\`\`

The historical successor start-time metadata is corrected only through the additive erratum. CAP-02 historical artifacts and canonical facts remain immutable.

## Delivery authority

Every edge is merge-before-next and postmerge-verify-before-next. Before S0 merge and the merged-main Authorization Gate:

\`\`\`text
design_status:
FINAL_FROZEN_CANDIDATE_V1_2

implementation_status:
NOT_AUTHORIZED

active_delivery_slice_id:
${S0}

next_authorized_slice_ids:
[]

MCFT-CAP-04:
NOT_AUTHORIZED
\`\`\`

After S0 merge and the merged-main Authorization Gate, only this slice becomes eligible for explicit activation:

\`\`\`text
${S1}
\`\`\`

## Exact changed-file boundary

${EXACT_CHANGED_FILES.map((file) => `- \`${file}\``).join('\n')}

No Runtime, domain, persistence transaction, adapter, projection schema, migration, route, web, scheduler, assimilation implementation, CAP-03 tick, or CAP-04 authorization is included.

## Preserved nonclaims

\`\`\`text
${PREAUTH_NONCLAIMS.join('\n')}
\`\`\`
`;
  writeText(AUTHORIZATION_PATH, authorization);

  const mapMarker = '## 14. MCFT-CAP-03 S0 authorization readiness';
  let implementationMap = fs.readFileSync(path.join(ROOT, MAP_PATH), 'utf8').replace(/\r\n/g, '\n');
  if (implementationMap.includes(mapMarker)) implementationMap = implementationMap.slice(0, implementationMap.indexOf(mapMarker)).trimEnd();
  implementationMap += `

${mapMarker}

\`\`\`text
capability:
MCFT-CAP-03 — Observation Assimilation and State Innovation

authorization:
READY_FOR_MERGE

authorization effective:
false

design status:
FINAL_FROZEN_CANDIDATE_V1_2

implementation status:
NOT_AUTHORIZED

baseline main:
${BASELINE_MAIN}

predecessor checkpoint sequence:
${identity.checkpoint_tick_sequence}

predecessor final logical time:
${EXPECTED_LAST_LOGICAL_TIME}

canonical next logical tick:
${identity.checkpoint_next_tick_logical_time}

predecessor lock:
${LOCK_PATH}

active delivery slice:
${S0}

next eligible slice after merge and merged-main Gate:
${S1}

MCFT-CAP-04 authorized:
false
\`\`\`

The S0 branch contains governance and PostgreSQL predecessor proof only. Runtime implementation remains forbidden until S0 merges and its merged-main Authorization Gate passes. Horizontal owner work packages remain partially established.
`;
  writeText(MAP_PATH, implementationMap);

  let alignment = fs.readFileSync(path.join(ROOT, ALIGNMENT_PATH), 'utf8').replace(/\r\n/g, '\n');
  alignment = alignment.replace(
    /## Current implementation state[\s\S]*$/,
    `## Current implementation state

\`\`\`text
three_way_alignment:
PASS

postgresql_predecessor_lock:
COMPLETE

checkpoint_tick_sequence:
${identity.checkpoint_tick_sequence}

checkpoint_next_tick_logical_time:
${identity.checkpoint_next_tick_logical_time}

S0_status:
READY_FOR_MERGE

design_status:
FINAL_FROZEN_CANDIDATE_V1_2

implementation_status:
NOT_AUTHORIZED

authorization_effective:
false

runtime_source_authorized:
false

MCFT-CAP-04:
NOT_AUTHORIZED
\`\`\`

The only remaining S0 blockers are PR merge and the merged-main Authorization Gate. No Runtime capability claim is active.`,
  );
  writeText(ALIGNMENT_PATH, alignment);
}

async function main() {
  if (process.env.MCFT_CAP_03_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE !== '1') {
    fail('SET_MCFT_CAP_03_PREFLIGHT_DESTRUCTIVE_ACCEPTANCE_1');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail('DATABASE_URL_REQUIRED');
  ok(`database name is explicitly isolated for acceptance: ${resolveDatabaseName(databaseUrl)}`);

  assertRepositoryBoundary();

  const task = fs.readFileSync(path.join(ROOT, TASK_PATH), 'utf8');
  assert.ok(task.includes('FINAL_FROZEN_CANDIDATE_V1_2'), 'TASK_V1_2_FINAL_CANDIDATE_REQUIRED');
  assert.ok(task.includes('S8_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_FINALIZATION_GATE_PASS'), 'TASK_S8_EFFECTIVENESS_REQUIRED');
  ok('exact CAP-03 v1.2 task artifact is present');

  const cap02Verification = readJson(CAP02_MAIN_VERIFICATION_PATH);
  const cap02Closure = readJson(CAP02_CLOSURE_RECORD_PATH);
  const matrixBefore = readJson(MATRIX_PATH);
  const cap02Line = matrixBefore.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-02');
  assert.equal(cap02Verification.verification_status, 'COMPLETE', 'CAP02_MAIN_VERIFICATION_COMPLETE_REQUIRED');
  assert.equal(cap02Closure.status, 'COMPLETE', 'CAP02_CLOSURE_COMPLETE_REQUIRED');
  assert.equal(cap02Closure.closure_effective, true, 'CAP02_CLOSURE_EFFECTIVE_REQUIRED');
  assert.equal(cap02Line?.status, 'COMPLETE', 'CAP02_MATRIX_COMPLETE_REQUIRED');
  assert.equal(cap02Line?.successor_authorized, false, 'CAP03_MUST_BE_UNAUTHORIZED_BEFORE_S0');
  ok('MCFT-CAP-02 completion and pre-authorization successor boundary are exact');

  const dbOutput = run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['-w', 'exec', 'tsx', 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_TWENTY_FOUR_TICK_RANGE_DB.ts'],
    {
      env: {
        DATABASE_URL: databaseUrl,
        MCFT_CAP_02_TWENTY_FOUR_TICK_DESTRUCTIVE_ACCEPTANCE: '1',
      },
    },
  );
  process.stdout.write(dbOutput);
  assert.ok(dbOutput.includes('MCFT-CAP-02 twenty-four-tick range DB: 8 PASS, 0 FAIL'), 'CAP02_24_TICK_DB_GATE_REQUIRED');
  ok('completed MCFT-CAP-02 24-tick predecessor chain is reproduced in isolated PostgreSQL');

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const identity = await extractIdentity(pool);
    updateGovernanceArtifacts(identity);
    ok('predecessor lock, erratum, authorization, delivery graph, matrix, map, and alignment review are finalized');
  } finally {
    await pool.end();
  }

  run(process.platform === 'win32' ? 'git.exe' : 'git', ['diff', '--check', BASELINE_MAIN]);
  ok('S0 working-tree diff check PASS');
  process.stdout.write(`MCFT-CAP-03 predecessor preflight: ${pass} PASS, 0 FAIL\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
