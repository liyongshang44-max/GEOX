#!/usr/bin/env node
// scripts/demo_seed/SEED_OPERATOR_TWIN_H31_H45_DEMO_CLOSURE_V1.cjs
'use strict';

// Purpose: seed the Operator Twin H31-H45 demo closure rows directly.
// Boundary: this seed excludes ROI, Field Memory, operation_state, reports, and customer delivery rows.
// H51.3 boundary: projection rows are schema-contract checked before any INSERT.

const { Pool } = require('pg');

const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FIELD_ID = 'field_c8_demo';
const ZONE_ID = 'zone_c8_root_zone_001';
const SEASON_ID = 'season_2026_c8_corn';
const PRE_STATE_ID = 'wstate_c8_irrigation_001';
const OPERATION_ID = 'op_plan_c8_irrigation_formal_001';
const TRANSITION_ID = 'plan_transition_c8_irrigation_ready_001';
const TASK_ID = 'act_c8_irrigation_formal_001';
const RECEIPT_ID = 'receipt_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const AS_EXECUTED_ID = 'as_executed_c8_irrigation_formal_001';
const PRE_WATER_STATE_ID = 'wstate_c8_irrigation_pre_001';
const POST_WATER_STATE_ID = 'wstate_c8_irrigation_post_response_001';
const POST_SENSING_WINDOW_ID = 'sw_c8_soil_moisture_post_irrigation_001';
const WATER_RESPONSE_ID = 'wrv_c8_irrigation_formal_001';
const PRE_STATE_ID = 'wstate_c8_irrigation_pre_001';
const POST_STATE_ID = 'wstate_c8_irrigation_post_response_001';
const POST_WINDOW_ID = 'sw_c8_soil_moisture_post_irrigation_001';
const EVIDENCE_ID = 'ev_c8_irrigation_water_delivery_001';
const SOURCE = 'scripts/demo_seed/operator_twin_h31_h45_demo_closure_v1';

const INDEX_TABLES = Object.freeze([
  'soil_moisture_sensing_window_index_v1',
  'water_state_estimate_index_v1',
  'water_response_verification_index_v1',
]);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function prefix(tenant) {
  return `full_review_seed_${tenant}`;
}

function json(value) {
  return JSON.stringify(value);
}

function factId(tenant, suffix) {
  return `${prefix(tenant)}_${suffix}`;
}

function fact(tenant, suffix, type, payload, occurredAt) {
  return {
    fact_id: factId(tenant, suffix),
    occurred_at: occurredAt,
    source: SOURCE,
    record_json: json({
      type,
      payload: {
        tenant_id: tenant,
        project_id: PROJECT_ID,
        group_id: GROUP_ID,
        field_id: FIELD_ID,
        ...payload,
      },
    }),
  };
}

function identifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) throw new Error('UNSAFE_SQL_IDENTIFIER');
  return value;
}

async function tableExists(client, table) {
  const r = await client.query('SELECT to_regclass($1)::text AS name', [`public.${table}`]);
  return Boolean(r.rows[0]?.name);
}

async function loadTableSchema(client, table) {
  const r = await client.query(
    "SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
    [table],
  );

  const columns = new Set();
  const requiredColumns = new Set();

  for (const row of r.rows) {
    const column = String(row.column_name);
    columns.add(column);
    if (row.is_nullable === 'NO' && row.column_default == null) requiredColumns.add(column);
  }

  return { columns, requiredColumns };
}

function hasOwn(row, key) {
  return Object.prototype.hasOwnProperty.call(row, key);
}

function preflightSeedRow(table, schema, row) {
  const missing = [...schema.requiredColumns].filter((column) => !hasOwn(row, column) || row[column] === undefined || row[column] === null);

  if (!missing.length) return;

  const error = new Error(`SEED_ROW_MISSING_REQUIRED_COLUMNS table=${table} missing=${missing.join(',')}`);
  error.code = 'SEED_ROW_MISSING_REQUIRED_COLUMNS';
  error.table = table;
  error.missing = missing;
  throw error;
}

async function preflightIndexRows(client, indexes) {
  for (const table of INDEX_TABLES) {
    if (!(await tableExists(client, table))) continue;

    const schema = await loadTableSchema(client, table);
    const rows = indexes[table] || [];

    for (const row of rows) preflightSeedRow(table, schema, row);
  }
}

async function insertFacts(client, rows) {
  for (const row of rows) {
    await client.query(
      'INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb) ON CONFLICT (fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json',
      [row.fact_id, row.occurred_at, row.source, row.record_json],
    );
  }
}

function deleteKeysFor(table, columns, row) {
  const candidates = {
    soil_moisture_sensing_window_index_v1: ['tenant_id', 'window_id'],
    water_state_estimate_index_v1: ['estimate_id'],
    water_response_verification_index_v1: ['verification_id'],
  }[table] || [];

  return candidates.filter((key) => columns.has(key) && row[key] !== undefined && row[key] !== null);
}

async function deleteExistingRow(client, table, schema, row) {
  const keys = deleteKeysFor(table, schema.columns, row);
  if (!keys.length) return;

  await client.query(
    `DELETE FROM ${identifier(table)} WHERE ${keys.map((key, index) => `${identifier(key)}=$${index + 1}`).join(' AND ')}`,
    keys.map((key) => row[key]),
  );
}

async function insertRows(client, table, rows) {
  if (!(await tableExists(client, table))) return;

  const schema = await loadTableSchema(client, table);

  for (const row of rows) {
    preflightSeedRow(table, schema, row);
    await deleteExistingRow(client, table, schema, row);

    const keys = Object.keys(row).filter((key) => schema.columns.has(key));
    if (!keys.length) continue;

    const values = keys.map((key) => row[key]);
    await client.query(
      `INSERT INTO ${identifier(table)} (${keys.map(identifier).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
      values,
    );
  }
}

function demoClosureIds(tenant) {
  return {
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    zone_id: ZONE_ID,
    season_id: SEASON_ID,
    pre_state_id: PRE_WATER_STATE_ID,
    post_state_id: POST_WATER_STATE_ID,
    sensing_window_id: POST_SENSING_WINDOW_ID,
    as_executed_id: AS_EXECUTED_ID,
    verification_id: WATER_RESPONSE_ID,
    operation_plan_id: OPERATION_ID,
    task_id: TASK_ID,
    receipt_id: RECEIPT_ID,
    acceptance_id: ACCEPTANCE_ID,
  };
}

function buildWaterStateIndexRow(params) {
  return {
    tenant_id: params.tenant_id,
    project_id: params.project_id,
    group_id: params.group_id,
    field_id: params.field_id,
    season_id: params.season_id,
    estimate_id: params.estimate_id,
    state: params.state,
    root_zone_soil_moisture_percent: params.root_zone_soil_moisture_percent,
    target_min_soil_moisture_percent: 22,
    target_max_soil_moisture_percent: 28,
    net_irrigation_mm: params.net_irrigation_mm,
    gross_irrigation_requirement_mm: params.gross_irrigation_requirement_mm,
    source_sensing_window_id: params.source_sensing_window_id,
    source_sensing_window_fact_id: params.source_sensing_window_fact_id,
    input_refs_json: json(params.input_refs || {}),
    evidence_refs_json: json(params.evidence_refs || []),
    calculation_inputs_json: json(params.calculation_inputs || {}),
    derivation_json: json(params.derivation || {}),
    quality_json: json(params.quality || { status: 'PASS' }),
    confidence_json: json(params.confidence || { level: 'HIGH', score: 0.95 }),
    source_fact_id: params.source_fact_id,
    created_at: params.created_at,
    updated_at: params.updated_at,
  };
}

function closureRows(tenant) {
  const nowMs = Date.now();
  const executedEndMs = nowMs - 900000;
  const postEndMs = executedEndMs + 180000;
  const occurredAt = iso(postEndMs);
  const preObservedAt = iso(executedEndMs - 600000);

  const ids = demoClosureIds(tenant);
  const common = {
    tenant_id: ids.tenant_id,
    project_id: ids.project_id,
    group_id: ids.group_id,
    field_id: ids.field_id,
    season_id: ids.season_id,
  };

  const postWindowFactId = factId(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001');
  const preWaterStateFactId = factId(tenant, 'water_state_estimate_c8_pre_001');
  const postWaterStateFactId = factId(tenant, 'water_state_estimate_c8_post_response_001');
  const asExecutedFactId = factId(tenant, 'as_executed_c8_irrigation_formal_001');
  const waterResponseFactId = factId(tenant, 'water_response_verification_c8_001');
  const acceptanceResultFactId = factId(tenant, 'acceptance_result_c8_irrigation_formal_001');

  const postWindowPayload = {
    ...common,
    window_id: ids.sensing_window_id,
    device_id: 'dev_soil_c8_001',
    metric: 'soil_moisture_percent',
    metric_role: 'post_irrigation_response',
    window_start: iso(executedEndMs + 60000),
    window_end: occurredAt,
    expected_interval_ms: 60000,
    expected_points: 3,
    actual_points: 3,
    min_total_samples_required: 3,
    min_samples_per_required_metric: 1,
    coverage_ratio: 1,
    min_coverage_ratio: 0.8,
    max_gap_ms: 60000,
    max_allowed_gap_ms: 120000,
    gap_count: 0,
    quality_status: 'PASS',
    confidence: { level: 'HIGH', score: 0.95 },
    summary: {
      last_value: 24.8,
      mean_value: 24.7,
      root_zone_soil_moisture_percent: 24.8,
    },
    evidence_refs: ['telemetry_soil_after_001', ids.receipt_id, ids.acceptance_id],
  };

  const postWindowIndex = {
    tenant_id: ids.tenant_id,
    project_id: ids.project_id,
    group_id: ids.group_id,
    field_id: ids.field_id,
    window_id: ids.sensing_window_id,
    device_id: 'dev_soil_c8_001',
    metric: 'soil_moisture_percent',
    window_start: postWindowPayload.window_start,
    window_end: postWindowPayload.window_end,
    expected_interval_ms: 60000,
    expected_points: 3,
    actual_points: 3,
    min_total_samples_required: 3,
    min_samples_per_required_metric: 1,
    coverage_ratio: 1,
    min_coverage_ratio: 0.8,
    max_gap_ms: 60000,
    max_allowed_gap_ms: 120000,
    gap_count: 0,
    quality_status: 'PASS',
    confidence_json: json({ level: 'HIGH', score: 0.95 }),
    summary_json: json(postWindowPayload.summary),
    config_snapshot_json: json({ source: SOURCE, expected_interval_ms: 60000, min_coverage_ratio: 0.8 }),
    evidence_refs_json: json(postWindowPayload.evidence_refs),
    source_fact_ids_json: json([postWindowFactId]),
    source_observation_ids_json: json(['telemetry_soil_after_001']),
    source_fact_id: postWindowFactId,
    created_at: occurredAt,
    updated_at: occurredAt,
  };

  const preWaterStateIndex = buildWaterStateIndexRow({
    ...common,
    estimate_id: ids.pre_state_id,
    state: 'MODERATE_DEFICIT',
    root_zone_soil_moisture_percent: 18.4,
    net_irrigation_mm: 22,
    gross_irrigation_requirement_mm: 22,
    source_sensing_window_id: null,
    source_sensing_window_fact_id: null,
    input_refs: { source: 'demo_pre_irrigation_state' },
    evidence_refs: ['telemetry_soil_before_001'],
    calculation_inputs: { before_soil_moisture: 18.4, target_min_soil_moisture_percent: 22 },
    derivation: { source: SOURCE, mode: 'demo_pre_irrigation_state' },
    quality: { status: 'PASS' },
    confidence: { level: 'HIGH', score: 0.94 },
    source_fact_id: preWaterStateFactId,
    created_at: preObservedAt,
    updated_at: preObservedAt,
  });

  const postWaterStateIndex = buildWaterStateIndexRow({
    ...common,
    estimate_id: ids.post_state_id,
    state: 'NORMAL',
    root_zone_soil_moisture_percent: 24.8,
    net_irrigation_mm: 22,
    gross_irrigation_requirement_mm: 22,
    source_sensing_window_id: ids.sensing_window_id,
    source_sensing_window_fact_id: postWindowFactId,
    input_refs: { sensing_window_id: ids.sensing_window_id },
    evidence_refs: [ids.sensing_window_id],
    calculation_inputs: { before_soil_moisture: 18.4, after_soil_moisture: 24.8 },
    derivation: { source: SOURCE, mode: 'demo_post_irrigation_response' },
    quality: { status: 'PASS' },
    confidence: { level: 'HIGH', score: 0.95 },
    source_fact_id: postWaterStateFactId,
    created_at: occurredAt,
    updated_at: occurredAt,
  });

  const asExecutedPayload = {
    ...common,
    as_executed_id: ids.as_executed_id,
    record_id: ids.as_executed_id,
    operation_id: ids.operation_plan_id,
    operation_plan_id: ids.operation_plan_id,
    act_task_id: ids.task_id,
    task_id: ids.task_id,
    receipt_id: ids.receipt_id,
    action_type: 'IRRIGATION',
    status: 'CONFIRMED',
    planned_amount_mm: 22,
    executed_amount_mm: 21.6,
    unit: 'mm',
    completed_at: iso(executedEndMs),
    executed_at: iso(executedEndMs),
    metrics: {
      before_soil_moisture: 18.4,
      after_soil_moisture: 24.8,
      soil_moisture_delta: 6.4,
    },
    evidence_refs: [ids.receipt_id, 'ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'],
  };

  const responsePayload = {
    ...common,
    zone_id: ids.zone_id,
    verification_id: ids.verification_id,
    operation_id: ids.operation_plan_id,
    operation_plan_id: ids.operation_plan_id,
    act_task_id: ids.task_id,
    task_id: ids.task_id,
    receipt_id: ids.receipt_id,
    as_executed_id: ids.as_executed_id,
    acceptance_id: ids.acceptance_id,
    acceptance_result_fact_id: acceptanceResultFactId,
    pre_state_id: ids.pre_state_id,
    post_state_id: ids.post_state_id,
    status: 'RESPONSE_OBSERVED',
    verification_status: 'RESPONSE_OBSERVED',
    response_verdict: 'RESPONSE_OBSERVED',
    before_value: 18.4,
    after_value: 24.8,
    delta_value: 6.4,
    before_soil_moisture: 18.4,
    after_soil_moisture: 24.8,
    soil_moisture_delta: 6.4,
    available_water_fraction_delta: 0.064,
    weighted_matric_potential_kpa_delta: null,
    class_transition: 'MODERATE_DEFICIT_TO_NORMAL',
    observed_at: occurredAt,
    computed_at: occurredAt,
    field_memory_candidate: false,
    roi_candidate: false,
    write_ready: false,
    evidence_refs: [ids.sensing_window_id, ids.receipt_id, ids.as_executed_id, ids.acceptance_id],
  };

  const waterResponseIndex = {
    tenant_id: ids.tenant_id,
    project_id: ids.project_id,
    group_id: ids.group_id,
    field_id: ids.field_id,
    zone_id: ids.zone_id,
    verification_id: ids.verification_id,
    acceptance_id: ids.acceptance_id,
    acceptance_result_fact_id: acceptanceResultFactId,
    as_executed_id: ids.as_executed_id,
    task_id: ids.task_id,
    receipt_id: ids.receipt_id,
    operation_plan_id: ids.operation_plan_id,
    pre_state_id: ids.pre_state_id,
    post_state_id: ids.post_state_id,
    response_verdict: 'RESPONSE_OBSERVED',
    available_water_fraction_delta: 0.064,
    weighted_matric_potential_kpa_delta: null,
    class_transition: 'MODERATE_DEFICIT_TO_NORMAL',
    blocking_reasons_json: json([]),
    evidence_refs_json: json(responsePayload.evidence_refs),
    source_fact_id: waterResponseFactId,
    created_at: occurredAt,
    updated_at: occurredAt,
  };

  return {
    ids,
    facts: [
      fact(tenant, 'soil_moisture_sensing_window_c8_post_irrigation_001', 'soil_moisture_sensing_window_v1', postWindowPayload, occurredAt),
      fact(tenant, 'water_state_estimate_c8_pre_001', 'water_state_estimate_v1', preWaterStateIndex, preObservedAt),
      fact(tenant, 'water_state_estimate_c8_post_response_001', 'water_state_estimate_v1', postWaterStateIndex, occurredAt),
      fact(tenant, 'as_executed_c8_irrigation_formal_001', 'as_executed_record_v1', asExecutedPayload, occurredAt),
      fact(tenant, 'water_response_verification_c8_001', 'water_response_verification_v1', responsePayload, occurredAt),
    ],
    indexes: {
      soil_moisture_sensing_window_index_v1: [postWindowIndex],
      water_state_estimate_index_v1: [preWaterStateIndex, postWaterStateIndex],
      water_response_verification_index_v1: [waterResponseIndex],
    },
  };
}

async function main() {
  const tenant = arg('--tenant', 'tenantA');
  const dryRun = hasFlag('--dry-run');
  const rows = closureRows(tenant);

  const summary = {
    ok: true,
    seed: 'operator_twin_h31_h45_demo_closure_v1',
    contract_pass: 'H51.3_DEMO_SEED_SCHEMA_CONTRACT_PASS',
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    zone_id: ZONE_ID,
    season_id: SEASON_ID,
    pre_state_id: PRE_WATER_STATE_ID,
    post_state_id: POST_WATER_STATE_ID,
    sensing_window_id: POST_SENSING_WINDOW_ID,
    as_executed_id: AS_EXECUTED_ID,
    verification_id: WATER_RESPONSE_ID,
    base_seed: 'skipped_by_default',
    generated_facts: rows.facts.map((row) => JSON.parse(row.record_json).type),
    written_index_tables: Object.keys(rows.indexes),
    preflight_error_code: 'SEED_ROW_MISSING_REQUIRED_COLUMNS',
    not_written: [
      'roi_ledger_v1',
      'field_memory_v1',
      'operation_state_v1',
      'customer_delivery',
      'projectReportV1',
      'field_report',
    ],
  };

  if (dryRun) return console.log(JSON.stringify(summary, null, 2));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await preflightIndexRows(client, rows.indexes);
    await insertFacts(client, rows.facts);
    await insertRows(client, 'soil_moisture_sensing_window_index_v1', rows.indexes.soil_moisture_sensing_window_index_v1);
    await insertRows(client, 'water_state_estimate_index_v1', rows.indexes.water_state_estimate_index_v1);
    await insertRows(client, 'water_response_verification_index_v1', rows.indexes.water_response_verification_index_v1);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
