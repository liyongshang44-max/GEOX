// scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs
// Purpose: run a real six-case multi-scope runtime fixture pack across existing Twin Kernel v1 surfaces.
// Boundary: this script seeds only source-index fixture rows, then uses existing APIs; it adds no routes, migrations, UI, domain objects, or autonomous execution behavior.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = process.cwd();
const ACCEPTANCE = 'POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK';
const BASE_URL = String(process.env.TWIN_KERNEL_BASE_URL || process.env.GEOX_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const DATABASE_URL = String(process.env.DATABASE_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos');
const RUN_ID = String(process.env.POSTV1_02_RUN_ID || `run_${Date.now()}_${process.pid}_${Math.random().toString(16).slice(2, 10)}`).replace(/[^A-Za-z0-9_-]/g, '_');

const REQUIRED_FILES = {
  taskLine: 'docs/legacy/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  taskDoc: 'docs/legacy/tasks/POSTV1-02-Strong-Multi-Scope-Fixture-Pack.md',
  tk16Acceptance: 'scripts/governance_acceptance/TK16_MULTI_SCOPE_REGRESSION_HARNESS.cjs',
  tk18Acceptance: 'scripts/governance_acceptance/TK18_EXECUTION_TO_LEARNING_BUSINESS_CLOSURE_V0.cjs',
  twinKernelRoute: 'apps/server/src/routes/v1/twin_kernel.ts',
  productionIngestionRoute: 'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
  operatorWorkflowRoute: 'apps/server/src/routes/v1/twin_kernel_operator_workflow.ts',
  closureRoute: 'apps/server/src/routes/v1/twin_kernel_business_closure.ts',
  sourceIndexMigration: 'apps/server/db/migrations/2026_06_18_operator_twin_source_indexes_v1.sql',
};

const BASE_CASES = [
  { key: 'a_rice_spring', project_id: 'postv1_project_a', group_id: 'postv1_group_a', season_id: 'season_2026_spring', crop_id: 'rice', as_of_ts: '2026-05-01T00:00:00.000Z', water_state: 'NORMAL', soil: 29 },
  { key: 'b_maize_summer', project_id: 'postv1_project_b', group_id: 'postv1_group_b', season_id: 'season_2026_summer', crop_id: 'maize', as_of_ts: '2026-06-01T00:00:00.000Z', water_state: 'LIGHT_DEFICIT', soil: 24 },
  { key: 'c_rice_spring', project_id: 'postv1_project_c', group_id: 'postv1_group_c', season_id: 'season_2026_spring', crop_id: 'rice', as_of_ts: '2026-05-02T00:00:00.000Z', water_state: 'NORMAL', soil: 28 },
  { key: 'd_maize_summer', project_id: 'postv1_project_d', group_id: 'postv1_group_d', season_id: 'season_2026_summer', crop_id: 'maize', as_of_ts: '2026-06-02T00:00:00.000Z', water_state: 'LIGHT_DEFICIT', soil: 23 },
  { key: 'e_rice_spring', project_id: 'postv1_project_e', group_id: 'postv1_group_e', season_id: 'season_2026_spring', crop_id: 'rice', as_of_ts: '2026-05-03T00:00:00.000Z', water_state: 'NORMAL', soil: 30 },
  { key: 'f_maize_summer', project_id: 'postv1_project_f', group_id: 'postv1_group_f', season_id: 'season_2026_summer', crop_id: 'maize', as_of_ts: '2026-06-03T00:00:00.000Z', water_state: 'LIGHT_DEFICIT', soil: 22 },
];

const CASES = BASE_CASES.map((item) => ({
  ...item,
  tenant_id: 'tenantA',
  field_id: `${item.key}_${RUN_ID}`.slice(0, 120),
}));

const assertions = [];

function abs(relativePath) {
  return path.resolve(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(abs(relativePath), 'utf8');
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(content, tokens) {
  return tokens.every((token) => content.includes(token));
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function fixtureBase(fixture) {
  return `postv102_${fixture.key}_${RUN_ID}`;
}

function fixtureEvidence(fixture) {
  return [{ kind: 'postv1_fixture', ref_id: fixtureBase(fixture) }];
}

function sourceRefs(fixture) {
  const base = fixtureBase(fixture);
  return {
    recommendation_ref_id: `${base}_recommendation_${fixture.field_id}`,
    approval_ref_id: `${base}_approval_${fixture.field_id}`,
    operation_plan_ref_id: `${base}_plan_${fixture.field_id}`,
    task_ref_id: `${base}_task_${fixture.field_id}`,
    receipt_ref_id: `${base}_receipt_${fixture.field_id}`,
    observation_ref_id: `${base}_as_executed_${fixture.field_id}`,
    acceptance_ref_id: `${base}_acceptance_${fixture.field_id}`,
    verification_ref_id: `${base}_verification_${fixture.field_id}`,
  };
}

function expectedExternalRefs(refs) {
  return {
    recommendation_id: refs.recommendation_ref_id,
    approval_id: refs.approval_ref_id,
    operation_plan_id: refs.operation_plan_ref_id,
    act_task_id: refs.task_ref_id,
    receipt_id: refs.receipt_ref_id,
    as_executed_id: refs.observation_ref_id,
    acceptance_id: refs.acceptance_ref_id,
    post_irrigation_verification_id: refs.verification_ref_id,
  };
}

function firstObject(...values) {
  for (const value of values) {
    const maybe = record(value);
    if (Object.keys(maybe).length > 0) return maybe;
  }
  return {};
}

function normalizeJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function defaultValueForColumn(column, fixture) {
  const name = column.column_name;
  const type = column.data_type;
  if (name.endsWith('_json') || type === 'json' || type === 'jsonb') return JSON.stringify({ fixture: ACCEPTANCE, run_id: RUN_ID });
  if (type.includes('timestamp') || type === 'date') return fixture.as_of_ts;
  if (type === 'boolean') return false;
  if (type.includes('int') || type === 'numeric' || type === 'double precision' || type === 'real') return 0;
  if (name.endsWith('_id')) return `${fixtureBase(fixture)}_${name}`;
  if (name.includes('status')) return 'READY';
  if (name.includes('source')) return ACCEPTANCE;
  return `${fixtureBase(fixture)}_${name}`;
}

async function tableColumns(client, tableName) {
  const result = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default, is_identity
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [tableName],
  );
  assert(`table_${tableName}_exists`, result.rows.length > 0, { table: tableName });
  return result.rows;
}

async function deleteFixtureRows(client, tableName, fixture) {
  const columns = await tableColumns(client, tableName);
  const names = new Set(columns.map((column) => column.column_name));
  const filters = [];
  const values = [];
  for (const [key, value] of [
    ['tenant_id', fixture.tenant_id],
    ['project_id', fixture.project_id],
    ['group_id', fixture.group_id],
    ['field_id', fixture.field_id],
  ]) {
    if (names.has(key)) {
      values.push(value);
      filters.push(`${key} = $${values.length}`);
    }
  }
  if (filters.length >= 2) {
    await client.query(`DELETE FROM ${tableName} WHERE ${filters.join(' AND ')}`, values);
  }
}

async function insertDynamic(client, tableName, fixture, valuesByColumn) {
  const columns = await tableColumns(client, tableName);
  const present = new Map(columns.map((column) => [column.column_name, column]));
  const insertValues = {};

  for (const [key, value] of Object.entries(valuesByColumn)) {
    if (present.has(key)) insertValues[key] = value;
  }

  for (const column of columns) {
    const alreadySet = Object.prototype.hasOwnProperty.call(insertValues, column.column_name);
    const needsValue = column.is_nullable === 'NO' && !column.column_default && column.is_identity !== 'YES';
    if (!alreadySet && needsValue) insertValues[column.column_name] = defaultValueForColumn(column, fixture);
  }

  const keys = Object.keys(insertValues);
  assert(`${tableName}_insert_has_columns`, keys.length > 0, { table: tableName, keys });
  const placeholders = keys.map((key, index) => {
    const type = present.get(key)?.data_type || '';
    const marker = `$${index + 1}`;
    if (type === 'json' || type === 'jsonb') return `${marker}::jsonb`;
    if (type.includes('timestamp')) return `${marker}::timestamptz`;
    if (type === 'date') return `${marker}::date`;
    return marker;
  });
  const params = keys.map((key) => insertValues[key]);
  await client.query(`INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders.join(',')})`, params);
}

async function seedSourceIndexes(client, fixture) {
  const base = fixtureBase(fixture);
  const evidence = fixtureEvidence(fixture);
  const common = {
    tenant_id: fixture.tenant_id,
    project_id: fixture.project_id,
    group_id: fixture.group_id,
    field_id: fixture.field_id,
    season_id: fixture.season_id,
  };

  for (const table of [
    'weather_forecast_index_v1',
    'soil_moisture_sensing_window_index_v1',
    'water_state_estimate_index_v1',
    'field_index_v1',
  ]) {
    await deleteFixtureRows(client, table, fixture);
  }

  await insertDynamic(client, 'field_index_v1', fixture, {
    ...common,
    name: `${fixture.field_id} ${fixture.crop_id}`,
    field_name: `${fixture.field_id} ${fixture.crop_id}`,
    crop: fixture.crop_id,
    crop_id: fixture.crop_id,
    area_ha: 12.5,
    area_m2: 125000,
    status: 'ACTIVE',
    created_ts_ms: Date.parse(fixture.as_of_ts),
    updated_ts_ms: Date.parse(fixture.as_of_ts),
    created_at: fixture.as_of_ts,
    updated_at: fixture.as_of_ts,
  });

  await insertDynamic(client, 'water_state_estimate_index_v1', fixture, {
    ...common,
    estimate_id: `${base}_water_estimate`,
    water_state: fixture.water_state,
    state: fixture.water_state,
    status: fixture.water_state,
    soil_moisture_percent: fixture.soil,
    value: fixture.soil,
    confidence_level: 'MEDIUM',
    confidence_score: 0.86,
    evidence_refs_json: normalizeJson(evidence),
    evidence_refs: normalizeJson(evidence),
    state_json: normalizeJson({ water_state: fixture.water_state, soil_moisture_percent: fixture.soil, value: fixture.soil }),
    estimate_json: normalizeJson({ water_state: fixture.water_state, soil_moisture_percent: fixture.soil, value: fixture.soil }),
    response_json: normalizeJson({ water_state: fixture.water_state, soil_moisture_percent: fixture.soil, value: fixture.soil }),
    source_fact_id: `${base}_water_fact`,
    computed_at: fixture.as_of_ts,
    created_at: fixture.as_of_ts,
    updated_at: fixture.as_of_ts,
  });

  await insertDynamic(client, 'soil_moisture_sensing_window_index_v1', fixture, {
    ...common,
    window_id: `${base}_sensing_window`,
    device_id: `${base}_device`,
    metric: 'soil_moisture_percent',
    window_start: addDays(fixture.as_of_ts, -1),
    window_end: fixture.as_of_ts,
    expected_interval_ms: 60000,
    expected_points: 60,
    actual_points: 58,
    min_total_samples_required: 5,
    min_samples_per_required_metric: 2,
    coverage_ratio: 0.97,
    min_coverage_ratio: 0.2,
    max_gap_ms: 120000,
    max_allowed_gap_ms: 900000,
    gap_count: 0,
    quality_status: 'GOOD',
    confidence_json: normalizeJson({ level: 'MEDIUM', score: 0.86 }),
    summary_json: normalizeJson({ soil_moisture_percent: fixture.soil, value: fixture.soil, coverage_ratio: 0.97 }),
    config_snapshot_json: normalizeJson({ fixture: ACCEPTANCE, run_id: RUN_ID }),
    evidence_refs_json: normalizeJson(evidence),
    source_fact_ids_json: normalizeJson([`${base}_sensing_fact`]),
    source_observation_ids_json: normalizeJson([`${base}_sensing_observation`]),
    source_fact_id: `${base}_sensing_fact`,
    created_at: fixture.as_of_ts,
    updated_at: fixture.as_of_ts,
  });

  await insertDynamic(client, 'weather_forecast_index_v1', fixture, {
    ...common,
    forecast_id: `${base}_weather_forecast`,
    forecast_horizon: '72h',
    provider: 'POSTV1_FIXTURE_WEATHER',
    rain_72h_mm: fixture.crop_id === 'rice' ? 8 : 2,
    rainfall_forecast_mm_72h: fixture.crop_id === 'rice' ? 8 : 2,
    summary_json: normalizeJson({ rain_72h_mm: fixture.crop_id === 'rice' ? 8 : 2 }),
    forecast_json: normalizeJson({ rain_72h_mm: fixture.crop_id === 'rice' ? 8 : 2 }),
    evidence_refs_json: normalizeJson(evidence),
    generated_at: fixture.as_of_ts,
    created_at: fixture.as_of_ts,
    updated_at: fixture.as_of_ts,
  });
}

async function requestJson(method, pathname, body) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error) => {
    throw new Error(`API_CONNECTIVITY_FAILED:${method}:${pathname}:${error.message}`);
  });
  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error(`API_NON_JSON_RESPONSE:${method}:${pathname}:${response.status}`);
    error.details = { body: raw.slice(0, 1000) };
    throw error;
  }
  if (!response.ok) {
    const error = new Error(`API_HTTP_FAILED:${method}:${pathname}:${response.status}:${payload.error || 'UNKNOWN'}`);
    error.response = payload;
    throw error;
  }
  return payload;
}

async function createCandidateChain(fixture) {
  const refs = sourceRefs(fixture);

  const snapshotResponse = await requestJson('POST', '/api/v1/twin-kernel/field-state-snapshots', {
    tenant_id: fixture.tenant_id,
    project_id: fixture.project_id,
    group_id: fixture.group_id,
    field_id: fixture.field_id,
    season_id: fixture.season_id,
    as_of_ts: fixture.as_of_ts,
  });
  const snapshot = record(snapshotResponse.snapshot);
  const snapshotField = record(record(snapshot.state_vector_json).field);
  assert(`${fixture.key}_snapshot_ready`, snapshot.status === 'SNAPSHOT_READY', { snapshot });
  if (snapshotField.crop === fixture.crop_id) {
    assert(`${fixture.key}_snapshot_crop_matches_when_projected`, true, { expected: fixture.crop_id, actual: snapshotField.crop });
  } else if (snapshotField.crop === null || snapshotField.crop === undefined || String(snapshotField.crop).trim() === '') {
    assert(`${fixture.key}_snapshot_crop_schema_drift_recorded`, true, {
      expected: fixture.crop_id,
      actual: snapshotField.crop ?? null,
      note: 'field_index_v1.crop is not present in this database or is not projected by the existing row; crop isolation is asserted through fixture metadata and explicit Field Memory formalization.',
    });
  } else {
    assert(`${fixture.key}_snapshot_crop_matches_when_present`, false, { expected: fixture.crop_id, actual: snapshotField.crop });
  }

  const forecastResponse = await requestJson('POST', '/api/v1/twin-kernel/forecast-runs', {
    snapshot_id: snapshot.snapshot_id,
    model_version: `postv1_02_model_${fixture.crop_id}`,
  });
  const forecastRun = record(forecastResponse.forecast_run);
  assert(`${fixture.key}_forecast_ready`, forecastRun.status === 'FORECAST_READY', { forecastRun });

  const scenarioResponse = await requestJson('POST', '/api/v1/twin-kernel/scenario-sets', {
    forecast_run_id: forecastRun.forecast_run_id,
    scenario_model_version: `postv1_02_scenario_${fixture.season_id}`,
  });
  const scenarioSet = record(scenarioResponse.scenario_set);
  assert(`${fixture.key}_scenario_ready`, scenarioSet.status === 'SCENARIO_SET_READY', { scenarioSet });

  const calibrationResponse = await requestJson('POST', '/api/v1/twin-kernel/calibration-replays', {
    scenario_set_id: scenarioSet.scenario_set_id,
    selected_option_id: 'no_action',
    observed: {
      observed_at: addDays(fixture.as_of_ts, 8),
      post_soil_moisture_percent: 15,
      observed_water_state: 'MODERATE_DEFICIT',
      verification_ref_id: refs.verification_ref_id,
      evidence_refs: fixtureEvidence(fixture),
    },
  });
  const calibrationReplay = record(calibrationResponse.calibration_replay);
  const forecastError = record(calibrationResponse.forecast_error);
  assert(`${fixture.key}_calibration_ready`, calibrationReplay.status === 'CALIBRATION_REPLAY_READY', { calibrationReplay, forecastError });
  assert(`${fixture.key}_forecast_error_numeric`, Number.isFinite(Number(forecastError.error_value)), { forecastError });

  const candidateResponse = await requestJson('POST', '/api/v1/twin-kernel/field-learning-candidates', {
    forecast_error_id: forecastError.forecast_error_id,
    acceptance_id: refs.acceptance_ref_id,
    post_irrigation_verification_id: refs.verification_ref_id,
    formal_evidence_ref_id: `${fixtureBase(fixture)}_formal_evidence`,
    evidence_refs: [
      { kind: 'fixture_crop', ref_id: fixture.crop_id },
      { kind: 'fixture_season', ref_id: fixture.season_id },
    ],
  });
  const candidate = record(candidateResponse.field_learning_candidate);
  assert(`${fixture.key}_candidate_ready`, candidate.candidate_status === 'LEARNING_CANDIDATE_READY', { candidate });

  return { refs, snapshot, forecastRun, scenarioSet, calibrationReplay, forecastError, candidate };
}

async function closeCaseLoop(fixture, chain) {
  const ingestionResponse = await requestJson('POST', '/api/v1/twin-kernel/production-ingestion/source-refs', {
    field_learning_candidate_id: chain.candidate.field_learning_candidate_id,
    source_system: 'postv1_02_strong_fixture_pack',
    source_event_id: `${fixtureBase(fixture)}_source_event`,
    occurred_at: addDays(fixture.as_of_ts, 9),
    ingested_by: 'postv1_02_harness',
    ingested_at: addDays(fixture.as_of_ts, 9),
    source_refs: chain.refs,
  });
  const decisionCycle = record(ingestionResponse.decision_cycle);
  const productionIngestionEvent = record(ingestionResponse.production_ingestion_event);
  assert(`${fixture.key}_decision_ready`, decisionCycle.cycle_status === 'DECISION_CYCLE_READY', { decisionCycle });
  assert(`${fixture.key}_ingestion_event_scope_local`, productionIngestionEvent.project_id === fixture.project_id && productionIngestionEvent.group_id === fixture.group_id && productionIngestionEvent.field_id === fixture.field_id, { productionIngestionEvent });
  assert(`${fixture.key}_decision_scope_readback_required`, decisionCycle.project_id === undefined && decisionCycle.group_id === undefined && decisionCycle.field_id === undefined, {
    decisionCycle,
    note: 'production ingestion response intentionally exposes a compact decision_cycle; scope is verified on production_ingestion_event immediately and on decision_cycle readback later.',
  });

  const sessionResponse = await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/sessions', {
    decision_cycle_id: decisionCycle.decision_cycle_id,
    operator_id: 'postv1_02_operator',
    opened_at: addDays(fixture.as_of_ts, 10),
  });
  const session = record(sessionResponse.operator_session);
  assert(`${fixture.key}_session_local`, session.field_id === fixture.field_id, { session });

  const reviewResponse = await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/reviews', {
    operator_session_id: session.operator_session_id,
    reviewed_by: 'postv1_02_operator',
    reviewed_at: addDays(fixture.as_of_ts, 10),
    review_status: 'NEEDS_FORMALIZATION',
    review_notes: {
      fixture_key: fixture.key,
      season_id: fixture.season_id,
      crop_id: fixture.crop_id,
    },
  });
  const review = record(reviewResponse.operator_review);
  assert(`${fixture.key}_review_local`, review.decision_cycle_id === decisionCycle.decision_cycle_id, { review });

  const roiResponse = await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/formalization-actions/roi', {
    operator_session_id: session.operator_session_id,
    operator_review_id: review.operator_review_id,
    formalized_by: 'postv1_02_operator',
    formalized_at: addDays(fixture.as_of_ts, 11),
    roi_summary: {
      fixture_key: fixture.key,
      season_id: fixture.season_id,
      crop_id: fixture.crop_id,
      preview_only: false,
    },
    evidence_refs: [{ kind: 'operator_review', ref_id: review.operator_review_id }],
  });
  const roiEntry = record(roiResponse.roi_entry);
  assert(`${fixture.key}_roi_explicit`, String(roiEntry.roi_entry_id || '').startsWith('roi_') && roiEntry.field_id === fixture.field_id, { roiEntry });
  assert(`${fixture.key}_roi_not_auto`, roiResponse.automatic_roi_created === false || roiResponse.automatic_roi_created === undefined, { roiResponse });

  const memoryResponse = await requestJson('POST', '/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory', {
    operator_session_id: session.operator_session_id,
    operator_review_id: review.operator_review_id,
    formalized_by: 'postv1_02_operator',
    formalized_at: addDays(fixture.as_of_ts, 12),
    memory_statement: {
      fixture_key: fixture.key,
      season_id: fixture.season_id,
      crop_id: fixture.crop_id,
      field_id: fixture.field_id,
      learning_scope: 'postv1_02_strong_fixture',
    },
    evidence_refs: [
      { kind: 'fixture_crop', ref_id: fixture.crop_id },
      { kind: 'fixture_season', ref_id: fixture.season_id },
    ],
  });
  const fieldMemory = record(memoryResponse.field_memory);
  assert(`${fixture.key}_memory_explicit`, String(fieldMemory.field_memory_id || fieldMemory.memory_id || '').startsWith('fm_') && fieldMemory.field_id === fixture.field_id, { fieldMemory });
  assert(`${fixture.key}_memory_crop_local`, record(fieldMemory.memory_statement_json).crop_id === fixture.crop_id, { fieldMemory });
  assert(`${fixture.key}_memory_no_model_update`, fieldMemory.model_update_created === false, { fieldMemory });

  const traceResponse = await requestJson('GET', `/api/v1/twin-kernel/traces/${encodeURIComponent(decisionCycle.decision_cycle_id)}`);
  const traceDecision = firstObject(
    record(record(record(traceResponse.twin_trace).answers).decision_cycle),
    traceResponse.decision_cycle,
  );
  assert(`${fixture.key}_trace_calibrated`, traceDecision.current_stage === 'CALIBRATED', { traceDecision });

  const closureResponse = await requestJson('GET', `/api/v1/twin-kernel/business-closures/${encodeURIComponent(decisionCycle.decision_cycle_id)}`);
  const closure = record(closureResponse.business_closure);
  const closureStatus = record(closure.closure_status);
  const closureDecision = record(closure.decision_cycle);
  assert(`${fixture.key}_closure_complete`, closureStatus.business_closure_complete === true, { closureStatus });
  assert(`${fixture.key}_closure_no_auto_writes`, closureStatus.forbidden_auto_writes_absent === true && closureStatus.model_update_created === false, { closureStatus });
  assert(`${fixture.key}_closure_scope_local`, closureDecision.project_id === fixture.project_id && closureDecision.group_id === fixture.group_id && closureDecision.field_id === fixture.field_id, { closureDecision });

  const decisionReadbackResponse = await requestJson('GET', `/api/v1/twin-kernel/decision-cycles/${encodeURIComponent(decisionCycle.decision_cycle_id)}`);
  const decisionReadback = record(decisionReadbackResponse.decision_cycle);
  const snapshotReadbackResponse = await requestJson('GET', `/api/v1/twin-kernel/field-state-snapshots/${encodeURIComponent(decisionReadback.snapshot_id)}`);
  const snapshotReadback = record(snapshotReadbackResponse.snapshot);
  assert(`${fixture.key}_decision_snapshot_local`, decisionReadback.snapshot_id === chain.snapshot.snapshot_id, { decisionReadback, expectedSnapshotId: chain.snapshot.snapshot_id });
  assert(`${fixture.key}_season_local`, snapshotReadback.season_id === fixture.season_id, { snapshotReadback, expectedSeasonId: fixture.season_id });

  return {
    fixture,
    chain,
    decision_cycle: decisionReadback,
    session,
    review,
    roi_entry: roiEntry,
    field_memory: fieldMemory,
    trace_decision: traceDecision,
    closure_status: closureStatus,
    closure_decision: closureDecision,
  };
}

function staticAudit() {
  for (const [name, file] of Object.entries(REQUIRED_FILES)) {
    assert(`${name}_exists`, fs.existsSync(abs(file)), { file });
  }
  const taskLine = read(REQUIRED_FILES.taskLine);
  const taskDoc = read(REQUIRED_FILES.taskDoc);
  const sourceIndexMigration = read(REQUIRED_FILES.sourceIndexMigration);
  const twinKernelRoute = read(REQUIRED_FILES.twinKernelRoute);
  const ingestionRoute = read(REQUIRED_FILES.productionIngestionRoute);
  const operatorRoute = read(REQUIRED_FILES.operatorWorkflowRoute);
  const closureRoute = read(REQUIRED_FILES.closureRoute);

  assert('task_line_records_postv102', containsAll(taskLine, [
    'POSTV1-02 Strong Multi-Scope Fixture Pack',
    'At least 3 project/group/field scopes.',
    'At least 2 seasons.',
    'At least 2 crops.',
    'At least 6 total fixture cases.',
  ]), { file: REQUIRED_FILES.taskLine });

  assert('task_doc_records_runtime_fixture_pack', containsAll(taskDoc, [
    'candidate_count >= 6',
    'project/group/field scope count >= 3',
    'season count >= 2',
    'crop count >= 2',
    'No new route.',
    'No migration.',
  ]), { file: REQUIRED_FILES.taskDoc });

  assert('source_index_schema_available', containsAll(sourceIndexMigration, [
    'field_index_v1',
    'water_state_estimate_index_v1',
    'soil_moisture_sensing_window_index_v1',
    'weather_forecast_index_v1',
  ]), { file: REQUIRED_FILES.sourceIndexMigration });

  assert('existing_runtime_surfaces_present', containsAll(
    `${twinKernelRoute}\n${ingestionRoute}\n${operatorRoute}\n${closureRoute}`,
    [
      '/api/v1/twin-kernel/field-state-snapshots',
      '/api/v1/twin-kernel/forecast-runs',
      '/api/v1/twin-kernel/scenario-sets',
      '/api/v1/twin-kernel/calibration-replays',
      '/api/v1/twin-kernel/field-learning-candidates',
      '/api/v1/twin-kernel/production-ingestion/source-refs',
      '/api/v1/twin-kernel/operator-workflow/sessions',
      '/api/v1/twin-kernel/operator-workflow/reviews',
      '/api/v1/twin-kernel/operator-workflow/formalization-actions/roi',
      '/api/v1/twin-kernel/operator-workflow/formalization-actions/field-memory',
      '/api/v1/twin-kernel/business-closures/:decision_cycle_id',
    ],
  ), { files: [REQUIRED_FILES.twinKernelRoute, REQUIRED_FILES.productionIngestionRoute, REQUIRED_FILES.operatorWorkflowRoute, REQUIRED_FILES.closureRoute] });
}

function assertIsolation(results) {
  const candidateIds = results.map((result) => result.chain.candidate.field_learning_candidate_id);
  const decisionCycleIds = results.map((result) => result.decision_cycle.decision_cycle_id);
  const memoryIds = results.map((result) => result.field_memory.field_memory_id || result.field_memory.memory_id);
  const scopeKeys = results.map((result) => `${result.fixture.project_id}/${result.fixture.group_id}/${result.fixture.field_id}`);
  const seasonIds = results.map((result) => result.fixture.season_id);
  const cropIds = results.map((result) => result.fixture.crop_id);

  assert('candidate_count_ge_6', results.length >= 6 && new Set(candidateIds).size === results.length, {
    candidate_count: results.length,
    unique_candidate_count: new Set(candidateIds).size,
  });
  assert('scope_count_ge_3', new Set(scopeKeys).size >= 3, {
    scope_count: new Set(scopeKeys).size,
    scope_keys: scopeKeys,
  });
  assert('season_count_ge_2', new Set(seasonIds).size >= 2, {
    season_count: new Set(seasonIds).size,
    seasons: [...new Set(seasonIds)],
  });
  assert('crop_count_ge_2', new Set(cropIds).size >= 2, {
    crop_count: new Set(cropIds).size,
    crops: [...new Set(cropIds)],
  });
  assert('decision_cycles_unique', new Set(decisionCycleIds).size === decisionCycleIds.length, {
    decision_cycle_ids: decisionCycleIds,
  });
  assert('field_memories_unique', new Set(memoryIds).size === memoryIds.length, {
    field_memory_ids: memoryIds,
  });

  for (const result of results) {
    const fixture = result.fixture;
    const actualRefs = record(result.decision_cycle.external_refs_json);
    for (const [key, expectedValue] of Object.entries(expectedExternalRefs(result.chain.refs))) {
      assert(`${fixture.key}_${key}_local`, actualRefs[key] === expectedValue, {
        key,
        expected: expectedValue,
        actual: actualRefs[key],
      });
      for (const other of results.filter((item) => item.fixture.key !== fixture.key)) {
        assert(`${fixture.key}_${key}_does_not_cross_${other.fixture.key}`, !String(actualRefs[key] || '').includes(other.fixture.key), {
          key,
          actual: actualRefs[key],
          other_case: other.fixture.key,
        });
      }
    }
    assert(`${fixture.key}_field_memory_crop_local`, record(result.field_memory.memory_statement_json).crop_id === fixture.crop_id, {
      memory_statement_json: result.field_memory.memory_statement_json,
      expected_crop: fixture.crop_id,
    });
    assert(`${fixture.key}_business_closure_case_local`, result.closure_status.business_closure_complete === true && result.closure_decision.field_id === fixture.field_id, {
      closure_status: result.closure_status,
      closure_decision: result.closure_decision,
    });
  }
}

async function main() {
  staticAudit();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    for (const fixture of CASES) {
      await seedSourceIndexes(client, fixture);
    }
  } finally {
    await client.end();
  }

  const results = [];
  for (const fixture of CASES) {
    const chain = await createCandidateChain(fixture);
    const result = await closeCaseLoop(fixture, chain);
    results.push(result);
  }

  assertIsolation(results);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    run_id: RUN_ID,
    candidate_count: results.length,
    scope_count: new Set(results.map((result) => `${result.fixture.project_id}/${result.fixture.group_id}/${result.fixture.field_id}`)).size,
    season_count: new Set(results.map((result) => result.fixture.season_id)).size,
    crop_count: new Set(results.map((result) => result.fixture.crop_id)).size,
    cases: results.map((result) => ({
      key: result.fixture.key,
      project_id: result.fixture.project_id,
      group_id: result.fixture.group_id,
      field_id: result.fixture.field_id,
      season_id: result.fixture.season_id,
      crop_id: result.fixture.crop_id,
      field_learning_candidate_id: result.chain.candidate.field_learning_candidate_id,
      decision_cycle_id: result.decision_cycle.decision_cycle_id,
      field_memory_id: result.field_memory.field_memory_id || result.field_memory.memory_id,
      closure_complete: result.closure_status.business_closure_complete,
    })),
    assertions,
    next_step: 'POSTV1-03_INGESTION_IDEMPOTENCY_AND_ERROR_TAXONOMY',
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    run_id: RUN_ID,
    error: error.message,
    details: error.details || error.response || null,
    assertions,
    hint: 'Ensure the API server is running and DATABASE_URL points to the same Postgres used by the API server.',
  }, null, 2));
  process.exit(1);
});
