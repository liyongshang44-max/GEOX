// scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs
// Purpose: verify the P4-00 Policy-Controlled ROI planning charter before any P4 runtime work.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P4_POLICY_CONTROLLED_ROI_PLANNING';
const CURRENT_DOC = 'docs/tasks/P4-Policy-Controlled-ROI-Planning.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs';
const P3_DOC = 'docs/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md';
const P3_SCRIPT = 'scripts/governance_acceptance/P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4.cjs';
const PHASE_LINE_DOC = 'docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md';
const P3_COMMIT = 'b905c1bd2fefd39867e8b51c8f8d094dd1e57542';
const P3_TAG = 'p3_operator_ux_completion_before_p4';
const NEXT_STEP = 'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION';

const ALLOWED_CHANGED_FILES = [
  CURRENT_DOC,
  CURRENT_SCRIPT,
];

const REQUIRED_FILES = [
  P3_DOC,
  P3_SCRIPT,
  PHASE_LINE_DOC,
  CURRENT_DOC,
  CURRENT_SCRIPT,
];

const FORBIDDEN_PREFIXES = [
  'apps/web/',
  'apps/server/',
  'apps/executor/',
  'packages/contracts/',
  'packages/',
  'db/',
  'migrations/',
  'scripts/demo_seed/',
  'scripts/runtime/',
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

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function git(args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return '';
  }
}

function changedFilesFromMain() {
  const output = tryGit(['diff', '--name-only', 'main...HEAD']);
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function refExists(ref) {
  try {
    childProcess.execFileSync('git', ['rev-parse', '--verify', ref], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function fencedSectionLines(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start < 0) return [];
  const open = text.indexOf('```text', start);
  if (open < 0) return [];
  const bodyStart = text.indexOf('\n', open) + 1;
  const close = text.indexOf('```', bodyStart);
  if (close < 0) return [];
  return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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

function assertionSummary() {
  const failed = assertions.filter((item) => item.passed !== true);
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

function verifyP3Completion() {
  const p3Doc = read(P3_DOC);
  const p3Script = read(P3_SCRIPT);
  const p3CommitReachable = tryGit(['merge-base', '--is-ancestor', P3_COMMIT, 'HEAD']) === '';
  const p3TagExists = refExists(`refs/tags/${P3_TAG}`) || refExists(`${P3_TAG}^{}`);

  assert('p3_completion_doc_verified', containsAll(p3Doc, [
    'P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4',
    'p3_completed_as_planning_only = true',
    'frontend_changed_by_p3_completion = false',
    'runtime_changed_by_p3_completion = false',
    'db_changed_by_p3_completion = false',
    'p4_entry_allowed_after_p3_completion = true',
    `recommended_completion_tag: ${P3_TAG}`,
    'next_stage: P4',
  ]), { file: P3_DOC });

  assert('p3_completion_script_verified', containsAll(p3Script, [
    'P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4',
    'next_stage: NEXT_STAGE',
    P3_TAG,
  ]), { file: P3_SCRIPT });

  assert('p3_completion_commit_reachable_from_head', p3CommitReachable, { commit: P3_COMMIT });
  assert('p3_completion_tag_exists_locally', p3TagExists, { tag: P3_TAG, note: 'Run git fetch --tags if this fails locally.' });
}

function verifyPhaseLine() {
  const phaseLineDoc = read(PHASE_LINE_DOC);

  assert('post_v1_phase_line_verified', containsAll(phaseLineDoc, [
    'P1 Production Hardening',
    'P2 Real Adapter Integration',
    'P3 Operator UX Refinement',
    'P4 Policy-Controlled ROI',
    'P5 Policy-Controlled Field Memory Governance',
    'P6 Execution System Integration',
    'P4 → P5 → P6',
  ]), { file: PHASE_LINE_DOC });

  assert('p4_policy_controlled_roi_baseline_verified', containsAll(phaseLineDoc, [
    'P4 — Policy-Controlled ROI',
    'P4 is not automatic ROI decisioning.',
    'ROI preview is not formal ROI.',
    'ROI dry-run is not a decision.',
    'ROI policy cannot advance decision_cycle_v1.',
    'Operator formalization action remains the only formal ROI path.',
  ]), { file: PHASE_LINE_DOC });
}

function verifyP4PlanningDocument() {
  const doc = read(CURRENT_DOC);
  const entryConditions = fencedSectionLines(doc, 'Entry conditions');
  const frozenPhaseLine = fencedSectionLines(doc, 'Frozen phase line');
  const scope = fencedSectionLines(doc, 'P4-00 scope');
  const nonGoals = fencedSectionLines(doc, 'P4-00 non-goals');
  const allowedFiles = fencedSectionLines(doc, 'Files allowed in P4-00');
  const forbiddenDirs = fencedSectionLines(doc, 'Directories forbidden in P4-00');
  const boundaryAssertions = fencedSectionLines(doc, 'Boundary assertions');
  const nextStep = fencedSectionLines(doc, 'Next step');

  assert('p4_document_identity_verified', containsAll(doc, [
    ACCEPTANCE,
    'Policy-Controlled ROI',
    'planning charter',
    'policy-controlled, traceable, evidence-backed object boundary',
    'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION',
  ]), { file: CURRENT_DOC });

  assert('entry_conditions_verified', containsAll(entryConditions.join('\n'), [
    P3_COMMIT,
    P3_TAG,
    'P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4',
    'p3_was_planning_only: true',
  ]), { entryConditions });

  assert('frozen_phase_line_verified', frozenPhaseLine.length === 3 && containsAll(frozenPhaseLine.join('\n'), [
    'P4 Policy-Controlled ROI',
    'P5 Policy-Controlled Field Memory Governance',
    'P6 Execution System Integration',
  ]), { frozenPhaseLine });

  assert('p4_scope_verified', containsAll(scope.join('\n'), [
    'Define P4 as Policy-Controlled ROI.',
    'Confirm P4 starts from ROI policy governance, not Operator UX runtime implementation.',
    'Confirm P4-00 is planning only.',
    'Confirm only governance documentation and governance acceptance are changed by this task.',
  ]), { scope });

  assert('p4_non_goals_verified', containsAll(nonGoals.join('\n'), [
    'No ROI calculation implementation.',
    'No ROI dashboard metric implementation.',
    'No operator frontend implementation.',
    'No runtime route implementation.',
    'No database schema or migration.',
    'No AO-ACT integration.',
    'No recommendation engine.',
    'No priority scoring.',
    'No profit prediction.',
  ]), { nonGoals });

  assert('p4_allowed_files_verified', allowedFiles.length === ALLOWED_CHANGED_FILES.length && ALLOWED_CHANGED_FILES.every((file) => allowedFiles.includes(file)), { allowedFiles, expected: ALLOWED_CHANGED_FILES });
  assert('p4_forbidden_dirs_verified', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs, expected: FORBIDDEN_PREFIXES });

  assert('p4_boundary_assertions_verified', containsAll(boundaryAssertions.join('\n'), [
    'p4_00_is_planning_only = true',
    'p4_00_changes_frontend = false',
    'p4_00_changes_runtime = false',
    'p4_00_changes_db = false',
    'p4_00_creates_recommendation = false',
    'p4_00_creates_priority = false',
    'p4_00_creates_profit_prediction = false',
    'p4_00_creates_ao_act_task = false',
    'p4_00_writes_field_memory = false',
    'p4_00_extends_to_p7_or_later = false',
  ]), { boundaryAssertions });

  assert('next_step_verified', nextStep.length === 1 && nextStep[0] === NEXT_STEP, { nextStep, expected: NEXT_STEP });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const changedSet = new Set(changedFiles);

  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles, allowed: ALLOWED_CHANGED_FILES });
  for (const file of ALLOWED_CHANGED_FILES) {
    assert(`allowed_changed_file_present:${file}`, changedSet.has(file), { file, changedFiles });
  }
  for (const file of changedFiles) {
    assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { file, allowed: ALLOWED_CHANGED_FILES });
  }

  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/contracts/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_scheduler_or_adapter_changed_by_this_task', changedFiles.every((file) => !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.includes('ao_act') && !file.includes('receipt')), { changedFiles });
}

function main() {
  verifyRequiredFiles();
  verifyP3Completion();
  verifyPhaseLine();
  verifyP4PlanningDocument();
  verifyChangedFiles();

  const changedFiles = changedFilesFromMain();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p3_completion_verified: true,
    p3_completion_commit: P3_COMMIT,
    p3_completion_tag: P3_TAG,
    p4_phase_line_verified: true,
    p4_00_planning_only: true,
    allowed_changed_file_count: ALLOWED_CHANGED_FILES.length,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    no_frontend_changed_by_this_task: true,
    no_runtime_changed_by_this_task: true,
    no_db_changed_by_this_task: true,
    no_execution_changed_by_this_task: true,
    ...assertionSummary(),
    next_step: NEXT_STEP,
  }, null, 2));
}

try {
  main();
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
