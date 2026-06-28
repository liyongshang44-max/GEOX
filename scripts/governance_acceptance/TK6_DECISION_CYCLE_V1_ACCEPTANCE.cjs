// scripts/governance_acceptance/TK6_DECISION_CYCLE_V1_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TK6_DECISION_CYCLE_V1_ACCEPTANCE';
const ROOT = process.cwd();

const REQUIRED_FILES = {
  task: 'docs/tasks/TK6-Decision-Cycle-v1.md',
  snapshotMigration: 'apps/server/db/migrations/2026_06_28_field_state_snapshot_v1.sql',
  forecastMigration: 'apps/server/db/migrations/2026_06_28_forecast_run_v1.sql',
  scenarioMigration: 'apps/server/db/migrations/2026_06_28_scenario_set_v1.sql',
  calibrationMigration: 'apps/server/db/migrations/2026_06_28_tk4_calibration_replay_and_forecast_error_v1.sql',
  learningCandidateMigration: 'apps/server/db/migrations/2026_06_28_tk5_field_learning_candidate_v1.sql',
  decisionCycleMigration: 'apps/server/db/migrations/2026_06_28_tk6_decision_cycle_v1.sql',
  decisionCycleBuilder: 'apps/server/src/domain/twin_kernel/decision_cycle_v1.ts',
  route: 'apps/server/src/routes/v1/twin_kernel.ts',
  module: 'apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts',
  domainRegistry: 'apps/server/src/modules/domain/registerDomainModules.ts',
};

const REQUIRED_DECISION_MIGRATION_TOKENS = [
  'CREATE TABLE IF NOT EXISTS decision_cycle_v1',
  'decision_cycle_id text PRIMARY KEY',
  'snapshot_id text NOT NULL REFERENCES field_state_snapshot_v1(snapshot_id)',
  'forecast_run_id text NOT NULL REFERENCES forecast_run_v1(forecast_run_id)',
  'scenario_set_id text NOT NULL REFERENCES scenario_set_v1(scenario_set_id)',
  'calibration_replay_id text NOT NULL REFERENCES calibration_replay_v1(calibration_replay_id)',
  'forecast_error_id text NOT NULL REFERENCES forecast_error_v1(forecast_error_id)',
  'field_learning_candidate_id text NOT NULL REFERENCES field_learning_candidate_v1(field_learning_candidate_id)',
  'cycle_status text NOT NULL',
  'current_stage text NOT NULL',
  'external_refs_json jsonb NOT NULL',
  'state_machine_json jsonb NOT NULL',
  'human_gate_json jsonb NOT NULL',
  'boundary_flags_json jsonb NOT NULL',
  'determinism_hash text NOT NULL',
];

const REQUIRED_DECISION_BUILDER_TOKENS = [
  'export function buildDecisionCycleV1',
  'DecisionCycleV1',
  'DECISION_CYCLE_READY',
  'DECISION_CYCLE_BLOCKED',
  'OBSERVED',
  'FORECASTED',
  'SCENARIO_COMPARED',
  'APPROVAL_REQUIRED',
  'RECEIPT_RECEIVED',
  'FORMAL_MEMORY_WRITTEN',
  'CALIBRATED',
  'forecast_to_task_autojump_allowed: false',
  'scenario_to_task_autojump_allowed: false',
  'recommendation_to_task_autojump_allowed: false',
  'human_approval_required_before_task: true',
  'automatic_task_created: false',
  'TASK_REF_WITHOUT_APPROVAL_REF',
  'createHash',
];

const REQUIRED_ROUTE_TOKENS = [
  '/api/v1/twin-kernel/decision-cycles',
  '/api/v1/twin-kernel/decision-cycles/:decision_cycle_id',
  'FIELD_LEARNING_CANDIDATE_ID_REQUIRED',
  'FIELD_LEARNING_CANDIDATE_NOT_FOUND',
  'buildDecisionCycleV1',
  'INSERT INTO decision_cycle_v1',
  'automatic_task_created: false',
  'downstream_write_ready: false',
];

const FORMAL_OBJECTS_MUST_BE_PRESENT = [
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
];

const FORBIDDEN_WRITE_PATTERNS = [
  /INSERT\s+INTO\s+(public\.)?field_memory/i,
  /INSERT\s+INTO\s+(public\.)?roi/i,
  /INSERT\s+INTO\s+(public\.)?decision_recommendation_index_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?ao_act/i,
  /INSERT\s+INTO\s+(public\.)?action/i,
  /INSERT\s+INTO\s+(public\.)?receipt/i,
  /INSERT\s+INTO\s+(public\.)?acceptance/i,
  /INSERT\s+INTO\s+(public\.)?operation_plan/i,
  /learning_eligible\s*[:=]\s*true/i,
  /customer_visible_memory\s*[:=]\s*true/i,
];

const MUTATION_FORBIDDEN_PATTERNS = [
  /UPDATE\s+(public\.)?field_state_snapshot_v1\b/i,
  /UPDATE\s+(public\.)?forecast_run_v1\b/i,
  /UPDATE\s+(public\.)?scenario_set_v1\b/i,
  /UPDATE\s+(public\.)?calibration_replay_v1\b/i,
  /UPDATE\s+(public\.)?forecast_error_v1\b/i,
  /UPDATE\s+(public\.)?field_learning_candidate_v1\b/i,
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

function assertNoForbiddenPatterns(files, patterns, errorName) {
  const hits = [];
  for (const file of files) {
    const text = read(file);
    for (const pattern of patterns) {
      if (pattern.test(text)) hits.push({ file, pattern: String(pattern) });
    }
  }
  assertOk(hits.length === 0, errorName, { hits });
}

function main() {
  for (const file of Object.values(REQUIRED_FILES)) assertOk(fs.existsSync(abs(file)), 'FILE_MISSING', { file });
  const decisionMigration = requireTokens(REQUIRED_FILES.decisionCycleMigration, REQUIRED_DECISION_MIGRATION_TOKENS);
  const decisionBuilder = requireTokens(REQUIRED_FILES.decisionCycleBuilder, REQUIRED_DECISION_BUILDER_TOKENS);
  const route = requireTokens(REQUIRED_FILES.route, REQUIRED_ROUTE_TOKENS);
  const module = requireTokens(REQUIRED_FILES.module, ['registerTwinKernelModule', 'registerTwinKernelV1Routes']);
  const domainRegistry = requireTokens(REQUIRED_FILES.domainRegistry, ['registerTwinKernelModule(app, pool)', '../twin_kernel/registerTwinKernelModule.js']);
  const files = SCAN_DIRS.flatMap(walk).filter((file) => !file.endsWith('TK6_DECISION_CYCLE_V1_ACCEPTANCE.cjs'));
  const present = FORMAL_OBJECTS_MUST_BE_PRESENT.map((objectName) => assertFormalPersistencePresent(objectName, files));
  const tk6Files = [REQUIRED_FILES.route, REQUIRED_FILES.decisionCycleBuilder, REQUIRED_FILES.decisionCycleMigration];
  assertNoForbiddenPatterns(tk6Files, FORBIDDEN_WRITE_PATTERNS, 'FORBIDDEN_DOWNSTREAM_WRITE_PATH');
  assertNoForbiddenPatterns(tk6Files, MUTATION_FORBIDDEN_PATTERNS, 'FORBIDDEN_PRIOR_OBJECT_MUTATION');
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    original_task_line: 'TK0 -> TK1 -> TK2 -> TK3 -> TK4 -> TK5 -> TK6',
    current_stage: 'TK6_DECISION_CYCLE_V1_HUMAN_IN_THE_LOOP',
    field_state_snapshot_v1_present: true,
    forecast_run_v1_present: true,
    scenario_set_v1_present: true,
    calibration_replay_v1_present: true,
    forecast_error_v1_present: true,
    field_learning_candidate_v1_present: true,
    decision_cycle_v1_present: true,
    formal_objects: present,
    human_gate_preserved: true,
    automatic_task_creation_missing: true,
    formal_field_memory_write_missing: true,
    roi_write_missing: true,
    no_forbidden_writes: true,
    no_prior_object_mutations: true,
    decision_migration: decisionMigration,
    decision_builder: decisionBuilder,
    route,
    module,
    domain_registry: domainRegistry,
    original_task_line_complete: true,
    next_step: 'TWIN_KERNEL_V1_COMPLETE_REVIEW',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
