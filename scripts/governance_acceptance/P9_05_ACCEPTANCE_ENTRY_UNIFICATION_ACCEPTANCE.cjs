// scripts/governance_acceptance/P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE.cjs
// Purpose: verify P9-05 acceptance entrypoint unification without executing runtime or replay algorithms.
// Boundary: read-only file-system governance verification plus list-only runner inspection; no runtime, DB, fact, Field Memory, model, AO-ACT, dispatch, receipt, or frontend surface is changed.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE';

const ENTRYPOINTS = 'docs/twin_kernel/ACCEPTANCE_ENTRYPOINTS_V0.json';
const RUNNER = 'scripts/acceptance/run_acceptance.cjs';
const TASK_DOC = 'docs/tasks/P9-05-Acceptance-Entry-Unification.md';
const TWIN_README = 'docs/twin_kernel/README.md';
const SCRIPTS_README = 'scripts/twin_kernel/README.md';

const EXPECTED_ENTRYPOINTS = [
  ['P9-00', 'P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL', 'scripts/governance_acceptance/P9_00_TWIN_KERNEL_FREEZE_INDEX_BACKFILL_ACCEPTANCE.cjs'],
  ['P9-01', 'P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT', 'scripts/governance_acceptance/P9_01_TWIN_KERNEL_LINE_AUTHORITY_CONTRACT_ACCEPTANCE.cjs'],
  ['P9-02', 'P9_02_REPLAY_REGISTRY_V0', 'scripts/governance_acceptance/P9_02_REPLAY_REGISTRY_V0_ACCEPTANCE.cjs'],
  ['P9-03', 'P9_03_REPLAY_CASE_MANIFEST_V0', 'scripts/governance_acceptance/P9_03_REPLAY_CASE_MANIFEST_V0_ACCEPTANCE.cjs'],
  ['P9-04', 'P9_04_MODEL_VERSION_MANIFEST_V0', 'scripts/governance_acceptance/P9_04_MODEL_VERSION_MANIFEST_V0_ACCEPTANCE.cjs'],
  ['P9-05', 'P9_05_ACCEPTANCE_ENTRY_UNIFICATION', 'scripts/governance_acceptance/P9_05_ACCEPTANCE_ENTRY_UNIFICATION_ACCEPTANCE.cjs'],
];

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function containsAllArray(values, tokens) {
  return tokens.every((token) => Array.isArray(values) && values.includes(token));
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function verifyRequiredFiles() {
  for (const file of [ENTRYPOINTS, RUNNER, TASK_DOC, TWIN_README, SCRIPTS_README]) {
    assert('required_file_exists:' + file, exists(file), { file });
  }

  for (const [, , script] of EXPECTED_ENTRYPOINTS) {
    assert('required_entrypoint_script_exists:' + script, exists(script), { script });
  }
}

function verifyManifest(manifest) {
  assert('entrypoints_schema_version_is_v0', manifest.schema_version === 'acceptance_entrypoints_v0', { schema_version: manifest.schema_version });
  assert('entrypoints_manifest_id_is_expected', manifest.manifest_id === 'twin_kernel_acceptance_entrypoints_v0', { manifest_id: manifest.manifest_id });
  assert('entrypoints_runner_is_expected', manifest.unified_runner && manifest.unified_runner.path === RUNNER && manifest.unified_runner.suite_id === 'p9-twin-kernel', { unified_runner: manifest.unified_runner });
  assert('entrypoints_default_suite_preserved', manifest.unified_runner && manifest.unified_runner.default_suite_preserved === 'legacy', { unified_runner: manifest.unified_runner });
  assert('entrypoint_count_is_expected', Array.isArray(manifest.entrypoints) && manifest.entrypoints.length === EXPECTED_ENTRYPOINTS.length, { count: manifest.entrypoints && manifest.entrypoints.length });

  for (const [taskId, entryId, script] of EXPECTED_ENTRYPOINTS) {
    const entry = manifest.entrypoints.find((item) => item.task_id === taskId);
    assert('entrypoint_present:' + taskId, Boolean(entry), { taskId });
    assert('entrypoint_identity_matches:' + taskId, entry.entry_id === entryId && entry.script === script && entry.command === `node ${script}`, { entry, entryId, script });
    assert('entrypoint_script_exists:' + taskId, exists(entry.script), { script: entry.script });
    assert('entrypoint_expected_ok_true:' + taskId, entry.expected_ok === true, { expected_ok: entry.expected_ok });
  }

  assert('entrypoints_declares_hard_boundaries', containsAllArray(manifest.boundaries, [
    'acceptance_entrypoint_change_only',
    'no_runtime_code_change',
    'no_server_route_change',
    'no_frontend_change',
    'no_database_migration',
    'no_replay_algorithm_change',
    'no_model_update',
    'no_field_memory_write',
    'no_db_write',
    'no_fact_write',
    'no_ao_act_task',
    'no_persisted_twin_object_creation',
  ]), { boundaries: manifest.boundaries });
}

function verifyRunnerSource() {
  const runner = read(RUNNER);

  assert('runner_declares_suite_map', containsAll(runner, [
    'STEP_DEFINITIONS_BY_SUITE',
    'legacy',
    "'p9-twin-kernel'",
    'parseArgs',
    'selectSuite',
    'Default suite: legacy',
  ]), {});

  for (const [, entryId, script] of EXPECTED_ENTRYPOINTS) {
    assert('runner_contains_entrypoint:' + entryId, containsAll(runner, [entryId, `node ${script}`]), { entryId, script });
  }
}

function verifyListCommand() {
  const result = spawnSync(process.execPath, [RUNNER, '--suite', 'p9-twin-kernel', '--list'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert('list_command_exits_zero', result.status === 0, { status: result.status, stderr: result.stderr });

  const output = String(result.stdout || '');
  for (const [, entryId, script] of EXPECTED_ENTRYPOINTS) {
    assert('list_command_contains_entrypoint:' + entryId, containsAll(output, [entryId, `node ${script}`]), { output });
  }
}

function verifyDocs() {
  const taskDoc = read(TASK_DOC);
  const twinReadme = read(TWIN_README);
  const scriptsReadme = read(SCRIPTS_README);

  assert('task_doc_declares_p9_05_scope', containsAll(taskDoc, [
    'P9-05 Acceptance Entry Unification',
    ENTRYPOINTS,
    'node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel',
    'default_suite_preserved = legacy',
    'P9-06 Replay Artifact Mapping Contract v0',
  ]), {});

  assert('twin_readme_links_p9_05_entrypoints', containsAll(twinReadme, [
    'P9-05 Acceptance Entry Unification',
    ENTRYPOINTS,
    'node scripts/acceptance/run_acceptance.cjs --suite p9-twin-kernel',
    'default_suite_preserved = legacy',
    'P9-06 Replay Artifact Mapping Contract v0',
  ]), {});

  assert('scripts_readme_links_p9_05_entrypoints', containsAll(scriptsReadme, [
    'P9-05 Acceptance Entry Unification',
    ENTRYPOINTS,
    'p9-twin-kernel',
    'default_suite_preserved = legacy',
  ]), {});
}

try {
  verifyRequiredFiles();

  const manifest = readJson(ENTRYPOINTS);
  verifyManifest(manifest);
  verifyRunnerSource();
  verifyListCommand();
  verifyDocs();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    acceptance_entrypoints_manifest_present: true,
    unified_runner_supports_p9_suite: true,
    entrypoint_count: manifest.entrypoints.length,
    list_command_contains_all_entrypoints: true,
    default_suite_preserved: 'legacy',
    runtime_surface_changed: false,
    next_step: 'P9-06 Replay Artifact Mapping Contract v0',
    ...summary(),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
