// scripts/governance_acceptance/TK0_TWIN_KERNEL_PREFLIGHT_AUDIT.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TK0_TWIN_KERNEL_PREFLIGHT_AUDIT';
const ROOT = process.cwd();

const SOURCE_INDEXES = [
  'field_index_v1',
  'water_state_estimate_index_v1',
  'soil_moisture_sensing_window_index_v1',
  'weather_forecast_index_v1',
  'irrigation_scenario_set_index_v1',
  'decision_recommendation_index_v1',
];

const ROUTE_TOKENS = [
  '/api/v1/operator/twin',
  '/api/v1/operator/twin/source-indexes',
  '/api/v1/operator/twin/fields/:field_id',
  '/api/v1/operator/twin/fields/:field_id/forecast',
  '/api/v1/operator/twin/fields/:field_id/scenarios',
  '/api/v1/operator/twin/fields/:field_id/calibration',
  '/api/v1/operator/twin/fields/:field_id/post-irrigation',
  '/api/v1/operator/twin/fields/:field_id/evidence',
  'LONG_RANGE_FORECAST_RUN_NOT_AVAILABLE',
  'NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE',
  'CANDIDATE',
  'human_approval_required',
  'task_created: false',
  'dispatch_created: false',
];

const MISSING_KERNEL_OBJECTS = [
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
];

const SCAN_DIRS = [
  'apps/server/src',
  'apps/server/db/migrations',
  'db/contracts',
  'scripts',
];

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

function productionFiles() {
  return SCAN_DIRS.flatMap(walk).filter((file) => !file.endsWith('TK0_TWIN_KERNEL_PREFLIGHT_AUDIT.cjs'));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertMissingPersistence(objectName, files) {
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
      if (pattern.test(text)) hits.push({ file, objectName });
    }
  }
  assertOk(hits.length === 0, 'UNEXPECTED_TWIN_KERNEL_OBJECT_IMPLEMENTED', { objectName, hits });
  return { object_name: objectName, formal_persistence_present: false };
}

function main() {
  const sourceIndexDoc = requireTokens('docs/db/GEOX_OPERATOR_TWIN_SOURCE_INDEX_DDL_CONTRACT_V1.md', SOURCE_INDEXES);
  const sourceIndexSql = requireTokens('apps/server/db/migrations/2026_06_18_operator_twin_source_indexes_v1.sql', SOURCE_INDEXES);
  const operatorTwinRoute = requireTokens('apps/server/src/routes/v1/operator_twin.ts', ROUTE_TOKENS.concat(SOURCE_INDEXES));

  const waterResponse = requireTokens('docs/legacy/tasks/H56-Water-Response-Verification-Boundary.md', [
    'water_response_verification_index_v1',
    'acceptance_result_v1',
    'as_executed_record_v1',
    'root_zone_soil_water_state_index_v1',
  ]);

  const waterResponseSql = requireTokens('apps/server/db/migrations/2026_06_22_water_response_verification_v1.sql', [
    'CREATE TABLE IF NOT EXISTS public.water_response_verification_index_v1',
    'pre_state_id text NOT NULL',
    'post_state_id text NOT NULL',
    'response_verdict text NOT NULL',
  ]);

  const roi = requireTokens('docs/legacy/tasks/H57-ROI-Governance-Boundary.md', [
    'POST /api/v1/roi-ledger/from-as-executed',
    'POST /api/v1/roi-ledger/formalize-from-acceptance',
    'customer_visible_value = false',
    'customer_visible_value = true',
  ]);

  const fieldMemory = requireTokens('docs/legacy/tasks/H58-Field-Memory-Governance-Boundary.md', [
    'POST /api/v1/field-memory/from-acceptance',
    'verdict = PASS',
    'learning_eligible = true',
    'new learning algorithms',
  ]);

  const actionBoundary = requireTokens('docs/controlplane/ROUTE_DEPENDENCY_GUARD.md', [
    '/api/control/ao_act/task',
    '/api/control/ao_act/receipt',
    '/api/control/ao_act/index',
    '/api/v1/actions/*',
  ]);

  const rootZoneState = requireTokens('apps/server/db/migrations/2026_06_21_root_zone_soil_water_state_v1.sql', [
    'CREATE TABLE IF NOT EXISTS public.root_zone_soil_water_state_index_v1',
    'root_zone_available_water_fraction',
    'determinism_hash text NOT NULL',
  ]);

  const rootZoneScenario = requireTokens('apps/server/db/migrations/2026_06_21_root_zone_irrigation_scenario_set_v1.sql', [
    'CREATE TABLE IF NOT EXISTS public.root_zone_irrigation_scenario_set_index_v1',
    'source_forecast_id text NOT NULL',
    'options_json jsonb NOT NULL',
    'determinism_hash text NOT NULL',
  ]);

  const files = productionFiles();
  const missing = MISSING_KERNEL_OBJECTS.map((name) => assertMissingPersistence(name, files));

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    operator_twin_source_indexes_present: true,
    operator_twin_routes_present: true,
    water_response_boundary_present: true,
    roi_governance_boundary_present: true,
    field_memory_governance_boundary_present: true,
    action_execution_boundary_present: true,
    root_zone_support_boundary_present: true,
    twin_kernel_objects_missing: true,
    source_index_doc: sourceIndexDoc,
    source_index_sql: sourceIndexSql,
    operator_twin_route: operatorTwinRoute,
    water_response: waterResponse,
    water_response_sql: waterResponseSql,
    roi,
    field_memory: fieldMemory,
    action_boundary: actionBoundary,
    root_zone_state: rootZoneState,
    root_zone_scenario: rootZoneScenario,
    scanned_file_count: files.length,
    missing_kernel_objects: missing,
    next_step: 'TK1_FIELD_STATE_SNAPSHOT_V1',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
