// scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs
// Purpose: verify the P8-00 Real Evidence Closed-Loop Planning gate.
// Boundary: checks planning and governance text only; it does not create runtime capability or mutate product surfaces.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING';
const NEXT_STEP = 'P8_01_REAL_EVIDENCE_SOURCE_CONTRACT';
const P7_COMPLETION_TAG = 'p7_twin_kernel_minimal_runtime_completion';
const CURRENT_DOC = 'docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs';
const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/', 'db/', 'migrations/', 'scripts/twin_kernel/', 'scripts/demo_seed/', 'scripts/runtime/'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function git(args) { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function tryGit(args) { try { return git(args); } catch { return ''; } }
function gitSucceeds(args) { try { childProcess.execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyEntry() {
  assert('p7_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P7_COMPLETION_TAG}`]), { P7_COMPLETION_TAG });
  assert('p7_completion_tag_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_COMPLETION_TAG, 'HEAD']), { P7_COMPLETION_TAG });
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
}

function verifyDoc() {
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('p8_scope_explicitly_opened', doc.includes('P8-00 opens P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo'), { CURRENT_DOC });

  const stage = section(doc, 'P8 stage definition');
  const scope = section(doc, 'Fixed replay scope');
  const evidenceShift = section(doc, 'P8 evidence source shift');
  const windowConcepts = section(doc, 'Window concepts frozen in P8-00');
  const initialWindows = section(doc, 'Initial window values');
  const readOnlyRules = section(doc, 'Read-only and no-write rules');
  const outOfScope = section(doc, 'P8 out of scope');
  const forbidden = section(doc, 'Forbidden directories in P8-00');
  const allowed = section(doc, 'Changed files allowed in P8-00');
  const acceptanceAssertions = section(doc, 'Acceptance assertions');
  const next = section(doc, 'Next step');

  assert('stage_definition_verified', stage.includes('completion_tag = p8_real_evidence_closed_loop_demo_completion') && stage.includes('stage_is_not_l4 = true'), { stage });
  assert('one_problem_only', scope.includes('problem = soil_moisture_state_estimation'), { scope });
  assert('one_project_only', scope.includes('project_id = P_DEFAULT'), { scope });
  assert('one_group_only', scope.includes('sensor_group_id = G_CAF'), { scope });
  assert('one_sensor_only', scope.includes('sensor_id = CAF009'), { scope });
  assert('one_metric_kind_only', scope.includes('metric_kind = soil_moisture'), { scope });
  assert('fixed_scope_line_count', scope.length === 6, { scope });
  assert('evidence_shift_verified', evidenceShift.includes('p8_must_read_real_raw_samples_or_source_index = true') && evidenceShift.includes('p8_no_longer_uses_fixture_as_only_evidence_source = true'), { evidenceShift });
  assert('window_concept_count', windowConcepts.length === 3, { windowConcepts });
  assert('initial_window_line_count', initialWindows.length === 8, { initialWindows });
  assert('read_only_rule_count', readOnlyRules.length === 14, { readOnlyRules });
  assert('read_only_db_rule_exists', readOnlyRules.includes('p8_database_access = read_only'), { readOnlyRules });
  assert('no_frontend_rule_exists', readOnlyRules.includes('p8_changes_frontend = false'), { readOnlyRules });
  assert('no_execution_rule_exists', readOnlyRules.includes('p8_creates_execution_object = false'), { readOnlyRules });
  assert('no_field_memory_rule_exists', readOnlyRules.includes('p8_writes_field_memory = false'), { readOnlyRules });
  assert('no_model_write_rule_exists', readOnlyRules.includes('p8_writes_model_state = false'), { readOnlyRules });
  assert('no_seed_rule_exists', readOnlyRules.includes('p8_changes_seed = false'), { readOnlyRules });
  assert('out_of_scope_count', outOfScope.length === 12, { outOfScope });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbidden.includes(prefix)), { forbidden });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('acceptance_assertion_count', acceptanceAssertions.length === 15, { acceptanceAssertions });
  assert('next_step_is_p8_01', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { fixed_scope_verified: true, window_concept_count: windowConcepts.length, read_only_rule_count: readOnlyRules.length, out_of_scope_count: outOfScope.length, acceptance_assertion_count: acceptanceAssertions.length };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  if (changedFiles.length === 0) return { changedFiles, changed_file_mode: 'main_integrated_replay' };
  for (const file of ALLOWED_CHANGED_FILES) assert(`p8_00_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`p8_00_no_forbidden_prefix:${file}`, !FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix)), { changedFiles });
  return { changedFiles, changed_file_mode: 'branch_diff_allows_later_p8_docs_and_acceptance' };
}

try {
  verifyEntry();
  const counts = verifyDoc();
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_completion_tag_verified: true, ...counts, changed_file_count: changed.changedFiles.length, changed_file_mode: changed.changed_file_mode, changed_files: changed.changedFiles, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
