// scripts/governance_acceptance/TK5_FIELD_LEARNING_CANDIDATE_V1_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE = 'TK5_FIELD_LEARNING_CANDIDATE_V1_ACCEPTANCE';
const ROOT = process.cwd();

const REQUIRED_FILES = {
  task: 'docs/tasks/TK5-Field-Learning-Candidate-v1.md',
  h58: 'docs/legacy/tasks/H58-Field-Memory-Governance-Boundary.md',
  snapshotMigration: 'apps/server/db/migrations/2026_06_28_field_state_snapshot_v1.sql',
  forecastMigration: 'apps/server/db/migrations/2026_06_28_forecast_run_v1.sql',
  scenarioMigration: 'apps/server/db/migrations/2026_06_28_scenario_set_v1.sql',
  calibrationMigration: 'apps/server/db/migrations/2026_06_28_tk4_calibration_replay_and_forecast_error_v1.sql',
  learningCandidateMigration: 'apps/server/db/migrations/2026_06_28_tk5_field_learning_candidate_v1.sql',
  learningCandidateBuilder: 'apps/server/src/domain/twin_kernel/field_learning_candidate_v1.ts',
  route: 'apps/server/src/routes/v1/twin_kernel.ts',
  module: 'apps/server/src/modules/twin_kernel/registerTwinKernelModule.ts',
  domainRegistry: 'apps/server/src/modules/domain/registerDomainModules.ts',
};

const REQUIRED_H58_TOKENS = [
  'POST /api/v1/field-memory/from-acceptance',
  'FORMAL_FIELD_MEMORY',
  'FORMAL_ACCEPTED',
  'customer_visible_memory = true',
  'learning_eligible = true',
  'ROI rows alone are not formal learning',
  'H58 stops at Field Memory governance',
];

const REQUIRED_LEARNING_MIGRATION_TOKENS = [
  'CREATE TABLE IF NOT EXISTS field_learning_candidate_v1',
  'field_learning_candidate_id text PRIMARY KEY',
  'calibration_replay_id text NOT NULL REFERENCES calibration_replay_v1(calibration_replay_id)',
  'forecast_error_id text NOT NULL REFERENCES forecast_error_v1(forecast_error_id)',
  'candidate_status text NOT NULL',
  'learning_scope text NOT NULL',
  'learning_statement_json jsonb NOT NULL',
  'supporting_evidence_refs_json jsonb NOT NULL',
  'counter_evidence_refs_json jsonb NOT NULL',
  'confidence_json jsonb NOT NULL',
  'formal_gate_refs_json jsonb NOT NULL',
  'h58_gate_status_json jsonb NOT NULL',
  'determinism_hash text NOT NULL',
];

const REQUIRED_LEARNING_BUILDER_TOKENS = [
  'export function buildFieldLearningCandidateV1',
  'FieldLearningCandidateV1',
  'LEARNING_CANDIDATE_READY',
  'LEARNING_CANDIDATE_BLOCKED',
  'FIELD_WATER_RESPONSE_CANDIDATE',
  'forecast_error_v1',
  'formal_field_memory_write_created: false',
  'h58_bypass_allowed: false',
  'requires_acceptance_pass: true',
  'requires_formal_acceptance: true',
  'requires_chain_validation_passed: true',
  'H58_FORMAL_GATE_REFS_INCOMPLETE',
  'createHash',
];

const REQUIRED_ROUTE_TOKENS = [
  '/api/v1/twin-kernel/field-learning-candidates',
  '/api/v1/twin-kernel/field-learning-candidates/:field_learning_candidate_id',
  'FORECAST_ERROR_ID_REQUIRED',
  'FORECAST_ERROR_NOT_FOUND',
  'CALIBRATION_REPLAY_NOT_FOUND',
  'buildFieldLearningCandidateV1',
  'INSERT INTO field_learning_candidate_v1',
  'formal_field_memory_write_created: false',
  'downstream_write_ready: false',
];

const FORMAL_OBJECTS_MUST_BE_PRESENT = [
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
];

const DOWNSTREAM_OBJECTS_MUST_BE_MISSING = [
  'decision_cycle_v1',
];

const FORBIDDEN_WRITE_PATTERNS = [
  /INSERT\s+INTO\s+(public\.)?decision_cycle_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?field_memory/i,
  /INSERT\s+INTO\s+(public\.)?roi/i,
  /INSERT\s+INTO\s+(public\.)?decision_recommendation_index_v1\b/i,
  /INSERT\s+INTO\s+(public\.)?ao_act/i,
  /INSERT\s+INTO\s+(public\.)?action/i,
  /learning_eligible\s*[:=]\s*true/i,
  /customer_visible_memory\s*[:=]\s*true/i,
];

const MUTATION_FORBIDDEN_PATTERNS = [
  /UPDATE\s+(public\.)?forecast_run_v1\b/i,
  /UPDATE\s+(public\.)?scenario_set_v1\b/i,
  /UPDATE\s+(public\.)?calibration_replay_v1\b/i,
  /UPDATE\s+(public\.)?forecast_error_v1\b/i,
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
  const h58 = requireTokens(REQUIRED_FILES.h58, REQUIRED_H58_TOKENS);
  const learningMigration = requireTokens(REQUIRED_FILES.learningCandidateMigration, REQUIRED_LEARNING_MIGRATION_TOKENS);
  const learningBuilder = requireTokens(REQUIRED_FILES.learningCandidateBuilder, REQUIRED_LEARNING_BUILDER_TOKENS);
  const route = requireTokens(REQUIRED_FILES.route, REQUIRED_ROUTE_TOKENS);
  const module = requireTokens(REQUIRED_FILES.module, ['registerTwinKernelModule', 'registerTwinKernelV1Routes']);
  const domainRegistry = requireTokens(REQUIRED_FILES.domainRegistry, ['registerTwinKernelModule(app, pool)', '../twin_kernel/registerTwinKernelModule.js']);
  const files = SCAN_DIRS.flatMap(walk).filter((file) => !file.endsWith('TK5_FIELD_LEARNING_CANDIDATE_V1_ACCEPTANCE.cjs'));
  const present = FORMAL_OBJECTS_MUST_BE_PRESENT.map((objectName) => assertFormalPersistencePresent(objectName, files));
  const missing = DOWNSTREAM_OBJECTS_MUST_BE_MISSING.map((objectName) => assertFormalPersistenceMissing(objectName, files));
  const tk5Files = [REQUIRED_FILES.route, REQUIRED_FILES.learningCandidateBuilder, REQUIRED_FILES.learningCandidateMigration];
  assertNoForbiddenPatterns(tk5Files, FORBIDDEN_WRITE_PATTERNS, 'FORBIDDEN_DOWNSTREAM_WRITE_PATH');
  assertNoForbiddenPatterns(tk5Files, MUTATION_FORBIDDEN_PATTERNS, 'FORBIDDEN_PRIOR_OBJECT_MUTATION');
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    original_task_line: 'TK0 -> TK1 -> TK2 -> TK3 -> TK4 -> TK5 -> TK6',
    current_stage: 'TK5_FIELD_LEARNING_CANDIDATE_V1_TO_FORMAL_FIELD_MEMORY',
    field_state_snapshot_v1_present: true,
    forecast_run_v1_present: true,
    scenario_set_v1_present: true,
    calibration_replay_v1_present: true,
    forecast_error_v1_present: true,
    field_learning_candidate_v1_present: true,
    formal_objects: present,
    formal_field_memory_write_missing: true,
    h58_formal_gate_preserved: true,
    decision_cycle_v1_missing: true,
    downstream_kernel_objects_missing: missing,
    h58,
    learning_migration: learningMigration,
    learning_builder: learningBuilder,
    route,
    module,
    domain_registry: domainRegistry,
    no_forbidden_writes: true,
    no_prior_object_mutations: true,
    next_step: 'TK6_DECISION_CYCLE_V1_HUMAN_IN_THE_LOOP',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
