// scripts/governance_acceptance/TK2_FORECAST_RUN_V1_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TK2_FORECAST_RUN_V1_ACCEPTANCE';
const ROOT = process.cwd();

const REQUIRED_FILES = {
  task: 'docs/tasks/TK2-Forecast-Run-v1.md',
  snapshotMigration: 'apps/server/db/migrations/2026_06_28_field_state_snapshot_v1.sql',
  forecastMigration: 'apps/server/db/migrations/2026_06_28_forecast_run_v1.sql',
  snapshotBuilder: 'apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts',
  forecastBuilder: 'apps/server/src/domain/twin_kernel/forecast_run_v1.ts',
  route: 'apps/server/src/routes/v1/twin_kernel.ts',
  module: 'apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts',
  domainRegistry: 'apps/server/src/modules/domain/registerDomainModules.ts',
};

const REQUIRED_FORECAST_MIGRATION_TOKENS = [
  'CREATE TABLE IF NOT EXISTS forecast_run_v1',
  'forecast_run_id text PRIMARY KEY',
  'snapshot_id text NOT NULL REFERENCES field_state_snapshot_v1(snapshot_id)',
  'horizon_days integer NOT NULL CHECK (horizon_days = 7)',
  'model_version text NOT NULL',
  'input_refs_json jsonb NOT NULL',
  'forecast_points_json jsonb NOT NULL',
  'risk_timeline_json jsonb NOT NULL',
  'uncertainty_json jsonb NOT NULL',
  'assumptions_json jsonb NOT NULL',
  'blocking_reasons_json jsonb NOT NULL',
  'determinism_hash text NOT NULL',
];

const REQUIRED_FORECAST_BUILDER_TOKENS = [
  'export function buildForecastRunV1',
  'ForecastRunV1',
  'field_state_snapshot_v1',
  'HORIZON_DAYS = 7',
  'FORECAST_READY',
  'FORECAST_BLOCKED',
  'SNAPSHOT_NOT_READY',
  'risk_timeline_json',
  'forecast_points_json',
  'uncertainty_json',
  'no_action_baseline: false',
  'no_irrigation_option_generated: true',
  'determinism_hash',
  'createHash',
];

const REQUIRED_ROUTE_TOKENS = [
  '/api/v1/twin-kernel/forecast-runs',
  '/api/v1/twin-kernel/forecast-runs/:forecast_run_id',
  'SNAPSHOT_ID_REQUIRED',
  'FIELD_STATE_SNAPSHOT_NOT_FOUND',
  'buildForecastRunV1',
  'INSERT INTO forecast_run_v1',
  'ON CONFLICT (forecast_run_id) DO NOTHING',
  'downstream_write_ready: false',
];

const DOWNSTREAM_OBJECTS_MUST_BE_MISSING = [
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
];

const FORBIDDEN_WRITE_PATTERNS = [
  /INSERT\s+INTO\s+(public\.)?scenario_set_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?decision_recommendation_index_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?roi/i,
  /INSERT\s+INTO\s+(public\.)?field_memory/i,
  /INSERT\s+INTO\s+(public\.)?calibration_replay_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?forecast_error_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?field_learning_candidate_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?decision_cycle_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?ao_act/i,
  /INSERT\s+INTO\s+(public\.)?action/i,
];

const SCAN_DIRS = ['apps/server/src', 'apps/server/db/migrations', 'db/contracts', 'scripts'];

function abs(file) {
  return path.resolve(ROOT, file);
}

function fail(error, details) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details: details || {} }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, details) {
  if (!condition) fail(error, details);
}

function read(file) {
  assertOk(fs.existsSync(abs(file)), 'FILE_MISSING', { file });
  return fs.readFileSync(abs(file), 'utf8');
}

function requireTokens(file, tokens) {
  const text = read(file);
  const missing = tokens.filter((token) => !text.includes(token));
  assertOk(missing.length === 0, 'TOKEN_MISSING', { file, missing });
  return { file, token_count: tokens.length };
}

function walk(dir) {
  if (!fs.existsSync(abs(dir))) return [];
  const out = [];
  for (const name of fs.readdirSync(abs(dir))) {
    if (['.git', 'node_modules', 'dist', 'build', 'coverage', '.turbo'].includes(name)) continue;
    const rel = path.join(dir, name).replace(/\\/g, '/');
    const stat = fs.statSync(abs(rel));
    if (stat.isDirectory()) out.push(...walk(rel));
    if (stat.isFile() && /\.(ts|tsx|js|cjs|mjs|sql|md|json)$/.test(rel)) out.push(rel);
  }
  return out;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertFormalPersistencePresent(objectName, files) {
  const name = escapeRegex(objectName);
  const createPattern = new RegExp('CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?(public\\.)?' + name + '\\b', 'i');
  const insertPattern = new RegExp('INSERT\\s+INTO\\s+(public\\.)?' + name + '\\b', 'i');
  const createHits = [];
  const insertHits = [];
  for (const file of files) {
    const text = read(file);
    if (createPattern.test(text)) createHits.push(file);
    if (insertPattern.test(text)) insertHits.push(file);
  }
  assertOk(createHits.length >= 1, 'FORMAL_TABLE_MISSING', { objectName });
  assertOk(insertHits.length >= 1, 'FORMAL_WRITE_PATH_MISSING', { objectName });
  return { object_name: objectName, create_hits: createHits, insert_hits: insertHits };
}

function assertFormalPersistenceMissing(objectName, files) {
  const name = escapeRegex(objectName);
  const patterns = [
    new RegExp('CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?(public\\.)?' + name + '\\b', 'i'),
    new RegExp('INSERT\\s+INTO\\s+(public\\.)?' + name + '\\b', 'i'),
    new RegExp('UPDATE\\s+(public\\.)?' + name + '\\b', 'i'),
  ];
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const pattern of patterns) {
      if (pattern.test(text)) hits.push(file);
    }
  }
  assertOk(hits.length === 0, 'UNEXPECTED_DOWNSTREAM_KERNEL_OBJECT_IMPLEMENTED', { objectName, hits });
  return { object_name: objectName, formal_persistence_present: false };
}

function assertNoForbiddenWrites(files) {
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const pattern of FORBIDDEN_WRITE_PATTERNS) {
      if (pattern.test(text)) hits.push({ file, pattern: String(pattern) });
    }
  }
  assertOk(hits.length === 0, 'FORBIDDEN_DOWNSTREAM_WRITE_PATH', { hits });
}

function main() {
  for (const file of Object.values(REQUIRED_FILES)) assertOk(fs.existsSync(abs(file)), 'FILE_MISSING', { file });
  const forecastMigration = requireTokens(REQUIRED_FILES.forecastMigration, REQUIRED_FORECAST_MIGRATION_TOKENS);
  const forecastBuilder = requireTokens(REQUIRED_FILES.forecastBuilder, REQUIRED_FORECAST_BUILDER_TOKENS);
  const route = requireTokens(REQUIRED_FILES.route, REQUIRED_ROUTE_TOKENS);
  const module = requireTokens(REQUIRED_FILES.module, ['registerTwinKernelModule', 'registerTwinKernelV1Routes']);
  const domainRegistry = requireTokens(REQUIRED_FILES.domainRegistry, ['registerTwinKernelModule(app, pool)', '../twin_kernel/registerTwinKernelModule.js']);
  const files = SCAN_DIRS.flatMap(walk).filter((file) => !file.endsWith('TK2_FORECAST_RUN_V1_ACCEPTANCE.cjs'));
  const snapshot = assertFormalPersistencePresent('field_state_snapshot_v1', files);
  const forecast = assertFormalPersistencePresent('forecast_run_v1', files);
  const missing = DOWNSTREAM_OBJECTS_MUST_BE_MISSING.map((objectName) => assertFormalPersistenceMissing(objectName, files));
  assertNoForbiddenWrites([REQUIRED_FILES.route, REQUIRED_FILES.forecastBuilder, REQUIRED_FILES.forecastMigration]);
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    field_state_snapshot_v1_present: true,
    field_state_snapshot_v1: snapshot,
    forecast_run_v1_present: true,
    forecast_run_v1: forecast,
    forecast_migration: forecastMigration,
    forecast_builder: forecastBuilder,
    route,
    module,
    domain_registry: domainRegistry,
    no_forbidden_writes: true,
    scenario_set_v1_missing: true,
    downstream_kernel_objects_missing: missing,
    next_step: 'TK3_SCENARIO_SET_V1',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
