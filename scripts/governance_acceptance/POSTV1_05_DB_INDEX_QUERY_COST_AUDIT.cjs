// scripts/governance_acceptance/POSTV1_05_DB_INDEX_QUERY_COST_AUDIT.cjs
// Purpose: audit Twin Kernel productionization DB index inventory and basic EXPLAIN readouts.
// Boundary: applies the POSTV1-05 index-only migration, then performs catalog and EXPLAIN checks only.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = process.cwd();
const ACCEPTANCE = 'POSTV1_05_DB_INDEX_QUERY_COST_AUDIT';
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';

const FILES = {
  taskLine: 'docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  taskDoc: 'docs/tasks/POSTV1-05-DB-Index-Query-Cost-Audit.md',
  migration: 'apps/server/db/migrations/2026_06_29_postv1_05_query_cost_audit_indexes.sql',
  twinKernelRoute: 'apps/server/src/routes/v1/twin_kernel.ts',
  traceRoute: 'apps/server/src/routes/v1/twin_kernel_trace.ts',
  operatorRoute: 'apps/server/src/routes/v1/twin_kernel_operator_workflow.ts',
  productionRoute: 'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
  businessRoute: 'apps/server/src/routes/v1/twin_kernel_business_closure.ts',
};

const REQUIRED_INDEXES = [
  'field_state_snapshot_v1_pkey',
  'forecast_run_v1_pkey',
  'scenario_set_v1_pkey',
  'calibration_replay_v1_pkey',
  'forecast_error_v1_pkey',
  'field_learning_candidate_v1_pkey',
  'field_learning_candidate_v1_error_idx',
  'field_learning_candidate_v1_replay_idx',
  'decision_cycle_v1_pkey',
  'decision_cycle_v1_learning_candidate_idx',
  'decision_cycle_v1_forecast_error_idx',
  'decision_cycle_v1_scope_idx',
  'decision_cycle_v1_operator_queue_idx',
  'production_ingestion_event_v0_pkey',
  'production_ingestion_event_v0_source_system_source_event_id_key',
  'production_ingestion_event_v0_candidate_idx',
  'production_ingestion_event_v0_decision_cycle_idx',
  'operator_session_v0_pkey',
  'operator_session_v0_decision_cycle_idx',
  'operator_decision_review_v0_pkey',
  'operator_decision_review_v0_session_idx',
  'operator_decision_review_v0_decision_cycle_idx',
  'operator_formalization_action_v0_pkey',
  'operator_formalization_action_v0_session_idx',
  'operator_formalization_action_v0_review_idx',
  'operator_formalization_action_v0_decision_cycle_idx',
  'roi_entry_v1_pkey',
  'roi_entry_v1_decision_cycle_id_idx',
  'field_memory_v1_pkey',
  'field_memory_v1_id_idx',
  'field_memory_v1_decision_cycle_id_idx',
  'field_memory_v1_candidate_id_idx',
];

const REQUIRED_TABLES = [
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
  'production_ingestion_event_v0',
  'operator_session_v0',
  'operator_decision_review_v0',
  'operator_formalization_action_v0',
  'roi_entry_v1',
  'field_memory_v1',
];

const assertions = [];
const explainPlans = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
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

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function assertionSummary() {
  const failed = assertions.filter((item) => item.passed !== true);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function staticAudit() {
  for (const [name, file] of Object.entries(FILES)) assert(`${name}_exists`, fs.existsSync(abs(file)), { file });
  const taskLine = read(FILES.taskLine);
  const taskDoc = read(FILES.taskDoc);
  const migration = read(FILES.migration);
  const operatorRoute = read(FILES.operatorRoute);
  const productionRoute = read(FILES.productionRoute);
  const traceRoute = read(FILES.traceRoute);
  const businessRoute = read(FILES.businessRoute);
  assert('task_line_records_postv105', containsAll(taskLine, ['POSTV1-05 — DB Index / Query Cost Audit', 'production_ingestion_event_v0 lookup path', 'operator decision queue lookup path', 'basic EXPLAIN readout acceptance']), { file: FILES.taskLine });
  assert('task_doc_records_boundary', containsAll(taskDoc, ['decision_cycle_v1_operator_queue_idx', 'basic EXPLAIN JSON readout', 'No route change.', 'No schema expansion beyond one index.']), { file: FILES.taskDoc });
  assert('migration_records_single_partial_index', containsAll(migration, ['CREATE INDEX IF NOT EXISTS decision_cycle_v1_operator_queue_idx', 'ON decision_cycle_v1 (created_at DESC)', "cycle_status = 'DECISION_CYCLE_READY'", "external_refs_json->>'acceptance_id'", "external_refs_json->>'roi_entry_id'", "external_refs_json->>'field_memory_id'"]), { file: FILES.migration });
  assert('operator_queue_route_query_present', containsAll(operatorRoute, ["external_refs_json->>'acceptance_id' IS NOT NULL", "external_refs_json->>'roi_entry_id'", "external_refs_json->>'field_memory_id'", 'ORDER BY created_at DESC', 'LIMIT $1']), { file: FILES.operatorRoute });
  assert('production_route_query_present', containsAll(productionRoute, ['source_system', 'source_event_id', 'decision_cycle_id', 'production_ingestion_event_v0']), { file: FILES.productionRoute });
  assert('trace_route_query_present', containsAll(traceRoute, ['readDecisionCycleRow', 'readSnapshotRow', 'readForecastRunRow', 'readScenarioSetRow', 'readCalibrationReplayRow', 'readForecastErrorRow', 'readFieldLearningCandidateRow']), { file: FILES.traceRoute });
  assert('business_closure_route_query_present', containsAll(businessRoute, ['production_ingestion_event_v0 WHERE decision_cycle_id', 'operator_session_v0 WHERE decision_cycle_id', 'operator_decision_review_v0 WHERE decision_cycle_id', 'operator_formalization_action_v0 WHERE decision_cycle_id']), { file: FILES.businessRoute });
}

async function indexMap(client) {
  const result = await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname");
  return new Map(result.rows.map((row) => [row.indexname, row]));
}

async function tableExists(client, tableName) {
  const result = await client.query('SELECT to_regclass($1) AS oid', [`public.${tableName}`]);
  return Boolean(result.rows[0] && result.rows[0].oid);
}

function collectPlanText(node, acc = []) {
  const current = record(node);
  for (const key of ['Node Type', 'Index Name', 'Relation Name', 'Filter', 'Index Cond', 'Recheck Cond', 'Sort Key']) {
    if (current[key] !== undefined) acc.push(String(Array.isArray(current[key]) ? current[key].join(',') : current[key]));
  }
  for (const child of Array.isArray(current.Plans) ? current.Plans : []) collectPlanText(child, acc);
  return acc;
}

async function explain(client, name, sql, values, expectedText) {
  await client.query('SET LOCAL enable_seqscan = off');
  const result = await client.query(`EXPLAIN (FORMAT JSON, COSTS TRUE) ${sql}`, values);
  const plan = result.rows[0]['QUERY PLAN'][0].Plan;
  const planText = collectPlanText(plan).join(' | ');
  const totalCost = Number(plan['Total Cost']);
  const item = { name, node_type: plan['Node Type'], total_cost: totalCost, expected_index: expectedText, index_visible: planText.includes(expectedText), plan_text: planText };
  explainPlans.push(item);
  assert(`${name}_cost_readable`, Number.isFinite(totalCost) && totalCost >= 0, item);
  assert(`${name}_expected_index_visible`, item.index_visible === true, item);
}

async function dbAudit() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(read(FILES.migration));
    for (const table of REQUIRED_TABLES) assert(`${table}_exists`, await tableExists(client, table), { table });
    const indexes = await indexMap(client);
    for (const indexName of REQUIRED_INDEXES) assert(`${indexName}_exists`, indexes.has(indexName), { indexName });
    const queueIndexDef = String(record(indexes.get('decision_cycle_v1_operator_queue_idx')).indexdef || '');
    assert('operator_queue_index_is_partial', queueIndexDef.includes('WHERE') && queueIndexDef.includes('cycle_status') && queueIndexDef.includes('acceptance_id') && queueIndexDef.includes('roi_entry_id') && queueIndexDef.includes('field_memory_id'), { queueIndexDef });

    const referenceResult = await client.query('SELECT decision_cycle_id,field_learning_candidate_id FROM decision_cycle_v1 ORDER BY created_at DESC LIMIT 1');
    const reference = referenceResult.rows[0];
    assert('reference_decision_cycle_available', !!reference && String(reference.decision_cycle_id || '').startsWith('dc_'), { reference });

    await client.query('BEGIN');
    try {
      await explain(client, 'production_source_event_lookup', 'SELECT * FROM production_ingestion_event_v0 WHERE source_system=$1 AND source_event_id=$2 LIMIT 1', ['postv105_missing_source', 'postv105_missing_event'], 'production_ingestion_event_v0_source_system_source_event_id_key');
      await explain(client, 'production_decision_cycle_readback', 'SELECT * FROM production_ingestion_event_v0 WHERE decision_cycle_id=$1 ORDER BY created_at DESC', [reference.decision_cycle_id], 'production_ingestion_event_v0_decision_cycle_idx');
      await explain(client, 'operator_decision_queue_lookup', "SELECT * FROM decision_cycle_v1 WHERE cycle_status='DECISION_CYCLE_READY' AND external_refs_json->>'acceptance_id' IS NOT NULL AND ((external_refs_json->>'roi_entry_id') IS NULL OR (external_refs_json->>'field_memory_id') IS NULL) ORDER BY created_at DESC LIMIT 25", [], 'decision_cycle_v1_operator_queue_idx');
      await explain(client, 'trace_decision_cycle_lookup', 'SELECT * FROM decision_cycle_v1 WHERE decision_cycle_id=$1 LIMIT 1', [reference.decision_cycle_id], 'decision_cycle_v1_pkey');
      await explain(client, 'trace_field_learning_candidate_lookup', 'SELECT * FROM field_learning_candidate_v1 WHERE field_learning_candidate_id=$1 LIMIT 1', [reference.field_learning_candidate_id], 'field_learning_candidate_v1_pkey');
      await explain(client, 'business_closure_sessions_lookup', 'SELECT * FROM operator_session_v0 WHERE decision_cycle_id=$1 ORDER BY created_at DESC', [reference.decision_cycle_id], 'operator_session_v0_decision_cycle_idx');
      await explain(client, 'business_closure_reviews_lookup', 'SELECT * FROM operator_decision_review_v0 WHERE decision_cycle_id=$1 ORDER BY created_at DESC', [reference.decision_cycle_id], 'operator_decision_review_v0_decision_cycle_idx');
      await explain(client, 'business_closure_actions_lookup', 'SELECT * FROM operator_formalization_action_v0 WHERE decision_cycle_id=$1 ORDER BY created_at DESC', [reference.decision_cycle_id], 'operator_formalization_action_v0_decision_cycle_idx');
      await client.query('ROLLBACK');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    }
    return { reference_decision_cycle_id: reference.decision_cycle_id, required_index_count: REQUIRED_INDEXES.length, observed_index_count: indexes.size };
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  staticAudit();
  const db = await dbAudit();
  const operatorQueueIndexVerified = explainPlans.some((plan) => plan.name === 'operator_decision_queue_lookup' && plan.index_visible === true);
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    database_url_source: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'default_local_compose_5433',
    ...db,
    explain_plan_count: explainPlans.length,
    operator_queue_index_verified: operatorQueueIndexVerified,
    explain_plan_summary: explainPlans.map((plan) => ({ name: plan.name, node_type: plan.node_type, total_cost: plan.total_cost, expected_index: plan.expected_index, index_visible: plan.index_visible })),
    ...assertionSummary(),
    next_step: 'POSTV1-06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE',
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    database_url_source: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'default_local_compose_5433',
    error: error.message,
    details: error.details || null,
    explain_plans: explainPlans,
    assertions,
    hint: 'Ensure geox-postgres is reachable on 127.0.0.1:5433, or set DATABASE_URL to the active PostgreSQL connection string.',
  }, null, 2));
  process.exit(1);
});
