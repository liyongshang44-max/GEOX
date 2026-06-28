// scripts/governance_acceptance/TK4_CALIBRATION_REPLAY_AND_FORECAST_ERROR_V1_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TK4_CALIBRATION_REPLAY_AND_FORECAST_ERROR_V1_ACCEPTANCE';
const ROOT = process.cwd();

const REQUIRED_FILES = {
  task: 'docs/tasks/TK4-Calibration-Replay-and-Forecast-Error-v1.md',
  snapshotMigration: 'apps/server/db/migrations/2026_06_28_field_state_snapshot_v1.sql',
  forecastMigration: 'apps/server/db/migrations/2026_06_28_forecast_run_v1.sql',
  scenarioMigration: 'apps/server/db/migrations/2026_06_28_scenario_set_v1.sql',
  calibrationMigration: 'apps/server/db/migrations/2026_06_28_calibration_replay_and_forecast_error_v1.sql',
  snapshotBuilder: 'apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts',
  forecastBuilder: 'apps/server/src/domain/twin_kernel/forecast_run_v1.ts',
  scenarioBuilder: 'apps/server/src/domain/twin_kernel/scenario_set_v1.ts',
  calibrationBuilder: 'apps/server/src/domain/twin_kernel/calibration_replay_v1.ts',
  route: 'apps/server/src/routes/v1/twin_kernel.ts',
  module: 'apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts',
  domainRegistry: 'apps/server/src/modules/domain/registerDomainModules.ts',
};

const REQUIRED_CALIBRATION_MIGRATION_TOKENS = [
  'CREATE TABLE IF NOT EXISTS calibration_replay_v1',
  'CREATE TABLE IF NOT EXISTS forecast_error_v1',
  'calibration_replay_id text PRIMARY KEY',
  'forecast_error_id text PRIMARY KEY',
  'forecast_run_id text NOT NULL REFERENCES forecast_run_v1(forecast_run_id)',
  'scenario_set_id text NOT NULL REFERENCES scenario_set_v1(scenario_set_id)',
  'predicted_json jsonb NOT NULL',
  'observed_json jsonb NOT NULL',
  'error_summary_json jsonb NOT NULL',
  'reason_candidates_json jsonb NOT NULL',
  'error_metric text NOT NULL',
  'error_value numeric',
  'error_direction text NOT NULL',
  'determinism_hash text NOT NULL',
];

const REQUIRED_CALIBRATION_BUILDER_TOKENS = [
  'export function buildCalibrationReplayAndForecastErrorV1',
  'CalibrationReplayV1',
  'ForecastErrorV1',
  'CALIBRATION_REPLAY_READY',
  'CALIBRATION_REPLAY_BLOCKED',
  'FORECAST_SCENARIO_LINK_MISMATCH',
  'POST_SOIL_MOISTURE_OBSERVATION_MISSING',
  'post_soil_moisture_percent_absolute_error',
  'OVER_ESTIMATED_RESPONSE',
  'UNDER_ESTIMATED_RESPONSE',
  'reason_candidates_json',
  'learning candidates',
  'createHash',
];

const REQUIRED_ROUTE_TOKENS = [
  '/api/v1/twin-kernel/calibration-replays',
  '/api/v1/twin-kernel/calibration-replays/:calibration_replay_id',
  '/api/v1/twin-kernel/forecast-errors/:forecast_error_id',
  'SCENARIO_SET_ID_REQUIRED',
  'SCENARIO_SET_NOT_FOUND',
  'FORECAST_RUN_NOT_FOUND',
  'buildCalibrationReplayAndForecastErrorV1',
  'INSERT INTO calibration_replay_v1',
  'INSERT INTO forecast_error_v1',
  'downstream_write_ready: false',
];

const FORMAL_OBJECTS_MUST_BE_PRESENT = [
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
];

const DOWNSTREAM_OBJECTS_MUST_BE_MISSING = [
  'field_learning_candidate_v1',
  'decision_cycle_v1',
];

const FORBIDDEN_WRITE_PATTERNS = [
  /INSERT\s+INTO\s+(public\.)?field_learning_candidate_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?decision_cycle_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?field_memory/i,
  /INSERT\s+INTO\s+(public\.)?roi/i,
  /INSERT\s+INTO\s+(public\.)?decision_recommendation_index_v1\b/i,
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
  const calibrationMigration = requireTokens(REQUIRED_FILES.calibrationMigration, REQUIRED_CALIBRATION_MIGRATION_TOKENS);
  const calibrationBuilder = requireTokens(REQUIRED_FILES.calibrationBuilder, REQUIRED_CALIBRATION_BUILDER_TOKENS);
  const route = requireTokens(REQUIRED_FILES.route, REQUIRED_ROUTE_TOKENS);
  const module = requireTokens(REQUIRED_FILES.module, ['registerTwinKernelModule', 'registerTwinKernelV1Routes']);
  const domainRegistry = requireTokens(REQUIRED_FILES.domainRegistry, ['registerTwinKernelModule(app, pool)', '../twin_kernel/registerTwinKernelModule.js']);
  const files = SCAN_DIRS.flatMap(walk).filter((file) => !file.endsWith('TK4_CALIBRATION_REPLAY_AND_FORECAST_ERROR_V1_ACCEPTANCE.cjs'));
  const present = FORMAL_OBJECTS_MUST_BE_PRESENT.map((objectName) => assertFormalPersistencePresent(objectName, files));
  const missing = DOWNSTREAM_OBJECTS_MUST_BE_MISSING.map((objectName) => assertFormalPersistenceMissing(objectName, files));
  assertNoForbiddenWrites([REQUIRED_FILES.route, REQUIRED_FILES.calibrationBuilder, REQUIRED_FILES.calibrationMigration]);
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    original_task_line: 'TK0 -> TK1 -> TK2 -> TK3 -> TK4 -> TK5 -> TK6',
    current_stage: 'TK4_CALIBRATION_REPLAY_AND_FORECAST_ERROR_V1',
    field_state_snapshot_v1_present: true,
    forecast_run_v1_present: true,
    scenario_set_v1_present: true,
    calibration_replay_v1_present: true,
    forecast_error_v1_present: true,
    formal_objects: present,
    field_learning_candidate_v1_missing: true,
    decision_cycle_v1_missing: true,
    downstream_kernel_objects_missing: missing,
    calibration_migration: calibrationMigration,
    calibration_builder: calibrationBuilder,
    route,
    module,
    domain_registry: domainRegistry,
    no_forbidden_writes: true,
    next_step: 'TK5_FIELD_LEARNING_CANDIDATE_V1_TO_FORMAL_FIELD_MEMORY',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
