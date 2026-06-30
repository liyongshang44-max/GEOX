// scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs
// Purpose: verify post-P8 repository convergence handoff maps and non-mainline classification without changing runtime surfaces.
// Boundary: documentation/script-entry classification only; no server runtime, frontend, DB migration, or deletion is required.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE';
const REQUIRED_FILES = [
  'docs/tasks/POST-P8-00-Repository-Convergence-Planning.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
  'scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs'
];
const FORBIDDEN_RUNTIME_PREFIXES = [
  'apps/server/',
  'apps/web/',
  'apps/executor/',
  'apps/telemetry-ingest/',
  'apps/jobs/',
  'packages/',
  'docker/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/'
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

function tryGit(args) {
  try {
    return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function changedFilesFromMain() {
  const output = tryGit(['diff', '--name-only', 'main...HEAD']);
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort();
}

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
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
  for (const file of REQUIRED_FILES) {
    assert(`required_file_exists:${file}`, exists(file), { file });
  }
}

function verifyAuthorityStatus() {
  const handoff = read('docs/REPOSITORY_HANDOFF_MAP.md');
  const twin = read('docs/twin_kernel/README.md');
  const legacy = read('docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md');
  const scripts = read('scripts/README.md');
  const replayScripts = read('scripts/twin_kernel/README.md');

  assert('handoff_declares_derived_view', handoff.includes('Status: derived view') && handoff.includes('Authority source: docs/SSOT.md'), {});
  assert('twin_declares_domain_reference', twin.includes('Status: domain reference') && twin.includes('Authority source: docs/SSOT.md'), {});
  assert('legacy_declares_derived_view', legacy.includes('Status: derived view') && legacy.includes('Authority source: docs/SSOT.md'), {});
  assert('scripts_declares_derived_view', scripts.includes('Status: derived view') && scripts.includes('Authority source: docs/SSOT.md'), {});
  assert('replay_scripts_declares_derived_view', replayScripts.includes('Status: derived view') && replayScripts.includes('Domain reference: docs/twin_kernel/README.md'), {});
}

function verifyTwinLineage() {
  const twin = read('docs/twin_kernel/README.md');
  assert('server_persisted_twin_line_declared', twin.includes('line_id = server_persisted_twin_kernel') && twin.includes('apps/server/src/routes/v1/twin_kernel.ts'), {});
  assert('offline_replay_twin_line_declared', twin.includes('line_id = offline_real_evidence_replay_kernel') && twin.includes('scripts/twin_kernel/P8_*.cjs'), {});
  assert('reconciliation_rule_declared', twin.includes('No task may silently make P8 offline replay artifacts behave as persisted server Twin objects'), {});
}

function verifyHandoffMap() {
  const handoff = read('docs/REPOSITORY_HANDOFF_MAP.md');
  assert('handoff_map_present', handoff.includes('server_entry = apps/server/src/server.ts') && handoff.includes('offline_real_evidence_replay_entry'), {});
  assert('do_not_treat_old_files_as_entrypoints', handoff.includes('Do not treat these as default entrypoints') && handoff.includes('historical_task_docs'), {});
}

function verifyScriptGuides() {
  const scripts = read('scripts/README.md');
  const replayScripts = read('scripts/twin_kernel/README.md');
  assert('script_entry_guides_present', scripts.includes('Current script families') && replayScripts.includes('Current P8 replay entrypoint'), {});
  assert('deletion_audit_rule_present', scripts.includes('not_called_by_package_json') && replayScripts.includes('not_server_runtime'), {});
}

function verifyNonMainlineInventory() {
  const legacy = read('docs/legacy/POST_P8_NON_MAINLINE_CANDIDATES.md');
  assert('non_mainline_candidate_inventory_present', legacy.includes('candidate_for_archive') && legacy.includes('candidate_for_deletion'), {});
  assert('non_mainline_inventory_is_not_deletion_list', legacy.includes('It is not a deletion list') && legacy.includes('Do not delete in this convergence pass'), {});
}

function verifyNoCompetingSsot() {
  const changed = changedFilesFromMain();
  const competingNames = changed.filter((file) => /(^|\/)(SSOT[^/]*|SPRINT_INDEX|MIGRATION_INDEX|GOVERNANCE_INDEX|CHANGELOG)\.md$/i.test(file) && file !== 'docs/SSOT.md');
  assert('no_competing_ssot_created', competingNames.length === 0, { competingNames, changed });
  return changed;
}

function verifyNoRuntimeSurfaceChanged(changed) {
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('no_runtime_surface_changed', runtimeChanged.length === 0, { runtimeChanged, changed });
}

try {
  verifyRequiredFiles();
  verifyAuthorityStatus();
  verifyTwinLineage();
  verifyHandoffMap();
  verifyScriptGuides();
  verifyNonMainlineInventory();
  const changed = verifyNoCompetingSsot();
  verifyNoRuntimeSurfaceChanged(changed);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    handoff_map_present: true,
    twin_lineage_reference_present: true,
    script_entry_guides_present: true,
    non_mainline_candidate_inventory_present: true,
    no_competing_ssot_created: true,
    no_runtime_surface_changed: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT'
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
