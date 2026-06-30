// scripts/governance_acceptance/POSTV1_06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE.cjs
// Purpose: verify Docker startup and SQL migration-runner baseline diagnostics for POSTV1-06.
// Boundary: preflight/readback only; this script does not create domain rows, dispatch tasks, write receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = process.cwd();
const ACCEPTANCE = 'POSTV1_06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE';
const BASE_URL = String(process.env.GEOX_BASE_URL || process.env.TWIN_KERNEL_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://landos:landos_pwd@127.0.0.1:5433/landos';

const FILES = {
  taskLine: 'docs/legacy/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  taskDoc: 'docs/legacy/tasks/POSTV1-06-Docker-Startup-Migration-Runner-Baseline.md',
  compose: 'docker-compose.yml',
  dockerfile: 'docker/runtime.Dockerfile',
  serverBootstrap: 'apps/server/src/bootstrap/server.ts',
  migrationsRunner: 'apps/server/src/infra/migrations.ts',
};

const CRITICAL_TABLES = [
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

const CRITICAL_INDEXES = [
  'decision_cycle_v1_operator_queue_idx',
  'production_ingestion_event_v0_source_system_source_event_id_key',
  'operator_session_v0_decision_cycle_idx',
  'operator_decision_review_v0_decision_cycle_idx',
  'operator_formalization_action_v0_decision_cycle_idx',
];

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listSqlMigrations() {
  const dir = abs('apps/server/db/migrations');
  assert('migration_directory_exists', fs.existsSync(dir), { dir });
  return fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
}

function staticAudit() {
  for (const [name, file] of Object.entries(FILES)) assert(`${name}_exists`, fs.existsSync(abs(file)), { file });
  const taskLine = read(FILES.taskLine);
  const taskDoc = read(FILES.taskDoc);
  const compose = read(FILES.compose);
  const dockerfile = read(FILES.dockerfile);
  const bootstrap = read(FILES.serverBootstrap);
  const runner = read(FILES.migrationsRunner);
  assert('task_line_records_postv106', containsAll(taskLine, ['POSTV1-06 — Docker Startup / Migration Runner Baseline', 'server startup check', 'Postgres health dependency', 'migration application check', 'missing migration diagnostic', 'port mapping diagnostic', 'acceptance preflight output']), { file: FILES.taskLine });
  assert('task_doc_records_boundary', containsAll(taskDoc, ['No infrastructure migration to another platform.', 'No cloud deployment work.', 'No new runtime semantics.', 'p1_completed = true']), { file: FILES.taskDoc });
  assert('compose_records_service_names', containsAll(compose, ['postgres:', 'server:', 'executor:', 'container_name: geox-postgres', 'container_name: geox-server']), { file: FILES.compose });
  assert('compose_records_port_mappings_and_health_dependency', containsAll(compose, ['"5433:5432"', '"3001:3000"', 'condition: service_healthy']), { file: FILES.compose });
  assert('dockerfile_packages_runtime_sources', containsAll(dockerfile, ['COPY apps ./apps', 'COPY scripts ./scripts', 'COPY docs ./docs', 'FROM node:20-slim AS runtime']), { file: FILES.dockerfile });
  assert('server_startup_runs_and_logs_migrations', containsAll(bootstrap, ['runSqlMigrations(pool)', 'migrationSummary', 'sql_migrations_completed', 'startBackgroundWorkers(pool)', 'app.listen']), { file: FILES.serverBootstrap });
  assert('migration_runner_has_diagnostics', containsAll(runner, ['SqlMigrationRunSummary', 'checked_dirs', 'sql_file_count', 'applied_file_count', 'skipped_empty_file_count', 'migration_files', 'SQL_MIGRATIONS_DIRECTORY_NOT_FOUND']), { file: FILES.migrationsRunner });
}

async function serverHealthAudit() {
  const attempts = [];
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/fields`, { headers: { authorization: 'Bearer x' } });
      attempts.push({ attempt, status: response.status });
      if (response.status >= 200 && response.status < 500) {
        assert('server_health_reachable', true, { base_url: BASE_URL, status: response.status, attempts });
        return { status: response.status, attempts };
      }
    } catch (error) {
      attempts.push({ attempt, error: String(error && error.message ? error.message : error) });
    }
    await sleep(1000);
  }
  const wrapped = new Error('SERVER_HEALTH_FETCH_FAILED');
  wrapped.details = { base_url: BASE_URL, attempts };
  throw wrapped;
}

async function tableExists(client, tableName) {
  const result = await client.query('SELECT to_regclass($1) AS oid', [`public.${tableName}`]);
  return Boolean(result.rows[0] && result.rows[0].oid);
}

async function dbAudit() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query('SELECT 1');
    for (const table of CRITICAL_TABLES) assert(`${table}_exists`, await tableExists(client, table), { table });
    const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'");
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const index of CRITICAL_INDEXES) assert(`${index}_exists`, indexNames.has(index), { index });
    return { critical_table_count: CRITICAL_TABLES.length, critical_index_count: CRITICAL_INDEXES.length, observed_index_count: indexNames.size };
  } finally {
    await client.end().catch(() => {});
  }
}

function assertionSummary() {
  const failed = assertions.filter((item) => item.passed !== true);
  return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) };
}

async function main() {
  staticAudit();
  const migrationFiles = listSqlMigrations();
  assert('migration_sql_file_count_positive', migrationFiles.length > 0, { migration_sql_file_count: migrationFiles.length });
  assert('postv105_migration_present', migrationFiles.includes('2026_06_29_postv1_05_query_cost_audit_indexes.sql'), { migrationFiles });
  const server = await serverHealthAudit();
  const db = await dbAudit();
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    database_url_source: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'default_local_compose_5433',
    compose_services_verified: ['postgres', 'server', 'executor'],
    server_health_reachable: true,
    server_health_status: server.status,
    server_health_attempts: server.attempts,
    postgres_reachable: true,
    migration_sql_file_count: migrationFiles.length,
    critical_db_objects_verified: true,
    startup_migration_summary_observable: true,
    ...db,
    ...assertionSummary(),
    p1_completed: true,
    next_step: 'P1_COMPLETION_REVIEW_BEFORE_P2',
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    base_url: BASE_URL,
    database_url_source: process.env.DATABASE_URL ? 'DATABASE_URL' : process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'default_local_compose_5433',
    error: error.message,
    details: error.details || null,
    assertions,
    hint: 'Ensure geox-postgres/geox-server are started from docker compose and DATABASE_URL points to the active local Postgres.',
  }, null, 2));
  process.exit(1);
});
