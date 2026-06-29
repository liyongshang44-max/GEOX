// scripts/governance_acceptance/P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX.cjs
// Purpose: verify the P4-04 ROI negative boundary matrix before P4 completion review.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX';
const PREVIOUS_ACCEPTANCE = 'P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT';
const CURRENT_DOC = 'docs/tasks/P4-04-ROI-Negative-Boundary-Matrix.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX.cjs';
const P4_03_DOC = 'docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md';
const P4_03_SCRIPT = 'scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs';
const P4_03_COMMIT = 'c6077ab5c9505cdacb07c823397a3d5584a3d328';
const NEXT_STEP = 'P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5';
const SUGGESTED_COMPLETION_TAG = 'p4_policy_controlled_roi_completion_before_p5';

const ALLOWED_CHANGED_FILES = [
  CURRENT_DOC,
  CURRENT_SCRIPT,
];

const REQUIRED_FILES = [
  P4_03_DOC,
  P4_03_SCRIPT,
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

const EXPECTED_NEGATIVE_BOUNDARIES = [
  'no_recommendation',
  'no_prescription',
  'no_priority_score',
  'no_hidden_profit_prediction',
  'no_success_prediction',
  'no_execution_trigger',
  'no_ao_act_task_creation',
  'no_receipt_creation',
  'no_field_memory_write',
  'no_roi_entry_write',
  'no_decision_cycle_advance',
  'no_evidence_rewrite',
  'no_trace_rewrite',
  'no_source_ref_update',
  'no_unbounded_source_dependency',
  'no_operator_gate_bypass',
  'no_frontend_state_as_source',
  'no_dashboard_metric_as_source',
];

const EXPECTED_NEGATIVE_VECTORS = [
  'source_ref_violation => BLOCK',
  'policy_gate_violation => BLOCK',
  'output_display_violation => BLOCK',
  'value_disclosure_violation => BLOCK',
  'read_only_projection_violation => BLOCK',
  'side_effect_violation => BLOCK',
  'evidence_integrity_violation => BLOCK',
  'trace_integrity_violation => BLOCK',
  'scope_boundary_violation => BLOCK',
  'operator_gate_violation => BLOCK',
  'semantic_leakage_violation => BLOCK',
  'deferred_phase_violation => BLOCK',
];

const EXPECTED_BLOCKED_OUTPUT_PAYLOADS = [
  'recommendation_payload',
  'prescription_payload',
  'priority_score_payload',
  'profit_prediction_payload',
  'success_prediction_payload',
  'execution_trigger_payload',
  'ao_act_task_payload',
  'receipt_payload',
  'field_memory_payload',
  'roi_entry_write_payload',
  'decision_cycle_advance_payload',
  'evidence_rewrite_payload',
  'trace_rewrite_payload',
  'source_ref_update_payload',
  'unbounded_source_summary_payload',
];

const EXPECTED_INTEGRITY_DENIAL_RULES = [
  'evidence_refs_are_pointer_or_read_refs_only = true',
  'trace_refs_are_pointer_or_read_refs_only = true',
  'provenance_refs_are_pointer_or_read_refs_only = true',
  'source_ref_records_are_read_refs_only = true',
  'operator_visible_boundary_is_read_ref_only = true',
  'blocked_result_must_preserve_original_refs = true',
  'blocked_result_must_not_synthesize_refs = true',
  'blocked_result_must_not_delete_refs = true',
];

const EXPECTED_SIDE_EFFECT_DENIALS = [
  'cannot_create_ao_act_task = true',
  'cannot_create_receipt = true',
  'cannot_write_field_memory = true',
  'cannot_write_roi_entry = true',
  'cannot_advance_decision_cycle = true',
  'cannot_update_source_refs = true',
  'cannot_update_trace_refs = true',
  'cannot_update_evidence_refs = true',
];

const EXPECTED_BLOCK_RESULT_CONTRACT = [
  'block_result_required = true',
  'block_result_must_include_boundary_name = true',
  'block_result_must_include_vector = true',
  'block_result_must_include_fail_code_or_reason = true',
  'block_result_must_include_source_ref_record_refs_when_available = true',
  'block_result_must_include_evidence_refs_when_available = true',
  'block_result_must_include_trace_refs_when_available = true',
  'block_result_must_include_provenance_ref_when_available = true',
  'block_result_must_be_read_only = true',
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

function gitSucceeds(args) {
  try {
    childProcess.execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function changedFilesFromMain() {
  const output = tryGit(['diff', '--name-only', 'main...HEAD']);
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
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

function verifyP403Entry() {
  const p403Doc = read(P4_03_DOC);
  const p403Script = read(P4_03_SCRIPT);
  const p403CommitReachable = gitSucceeds(['merge-base', '--is-ancestor', P4_03_COMMIT, 'HEAD']);

  assert('p4_03_doc_verified', containsAll(p403Doc, [
    PREVIOUS_ACCEPTANCE,
    'P4-03 freezes the read model and output contract for Policy-Controlled ROI.',
    'ROI_BLOCKED_POLICY_FAILED',
    'projection_is_read_only = true',
    'blocked_output_semantic_count = 15',
    'side_effect_denial_count = 8',
    'next_step = P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX',
  ]), { file: P4_03_DOC });

  assert('p4_03_script_verified', containsAll(p403Script, [
    PREVIOUS_ACCEPTANCE,
    'P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX',
    'EXPECTED_DISPLAY_RULES',
    'EXPECTED_BLOCKED_OUTPUT_SEMANTICS',
    'EXPECTED_SIDE_EFFECT_DENIALS',
    'no_frontend_changed_by_this_task',
    'no_runtime_changed_by_this_task',
    'no_db_changed_by_this_task',
  ]), { file: P4_03_SCRIPT });

  assert('p4_03_commit_reachable_from_head', p403CommitReachable, { commit: P4_03_COMMIT });
}

function verifyP404Document() {
  const doc = read(CURRENT_DOC);
  const entryConditions = fencedSectionLines(doc, 'Entry conditions');
  const negativePrinciple = fencedSectionLines(doc, 'Negative boundary principle');
  const negativeBoundaries = fencedSectionLines(doc, 'Required negative boundaries');
  const negativeVectors = fencedSectionLines(doc, 'Negative boundary vectors');
  const negativeRows = fencedSectionLines(doc, 'Negative matrix rows');
  const blockedOutputPayloads = fencedSectionLines(doc, 'Blocked output payloads');
  const integrityDenials = fencedSectionLines(doc, 'Integrity denial rules');
  const sideEffectDenials = fencedSectionLines(doc, 'Side-effect denial rules');
  const blockResultContract = fencedSectionLines(doc, 'Block result contract');
  const handoff = fencedSectionLines(doc, 'P4-05 handoff');
  const allowedChangedFiles = fencedSectionLines(doc, 'Changed files allowed in P4-04');
  const forbiddenDirs = fencedSectionLines(doc, 'Directories forbidden in P4-04');
  const boundaryAssertions = fencedSectionLines(doc, 'Boundary assertions');
  const nextStep = fencedSectionLines(doc, 'Next step');

  assert('p4_04_document_identity_verified', containsAll(doc, [
    ACCEPTANCE,
    'P4-04 freezes the negative boundary matrix for Policy-Controlled ROI.',
    'prohibited ROI path',
    NEXT_STEP,
    SUGGESTED_COMPLETION_TAG,
  ]), { file: CURRENT_DOC });

  assert('entry_conditions_verified', containsAll(entryConditions.join('\n'), [
    PREVIOUS_ACCEPTANCE,
    P4_03_DOC,
    P4_03_SCRIPT,
    P4_03_COMMIT,
    'p4_03_status: accepted_on_main',
  ]), { entryConditions });

  assert('negative_boundary_principle_verified', containsAll(negativePrinciple.join('\n'), [
    'negative_boundary_must_fail_closed = true',
    'negative_boundary_must_block_before_display = true',
    'negative_boundary_must_preserve_fail_codes = true',
    'negative_boundary_must_not_create_runtime_side_effect = true',
    'negative_boundary_must_not_downgrade_to_recommendation = true',
    'negative_boundary_must_not_advance_to_P5_or_P6 = true',
  ]), { negativePrinciple });

  assert('negative_boundaries_verified', negativeBoundaries.length === EXPECTED_NEGATIVE_BOUNDARIES.length && EXPECTED_NEGATIVE_BOUNDARIES.every((item) => negativeBoundaries.includes(item)), { negativeBoundaries, expected: EXPECTED_NEGATIVE_BOUNDARIES });
  assert('negative_vectors_verified', negativeVectors.length === EXPECTED_NEGATIVE_VECTORS.length && EXPECTED_NEGATIVE_VECTORS.every((item) => negativeVectors.includes(item)), { negativeVectors, expected: EXPECTED_NEGATIVE_VECTORS });
  assert('negative_matrix_rows_verified', negativeRows.length === EXPECTED_NEGATIVE_BOUNDARIES.length && EXPECTED_NEGATIVE_BOUNDARIES.every((boundary) => negativeRows.some((row) => row.startsWith(`${boundary} => `) && row.includes('result BLOCK'))), { negativeRows, expected: EXPECTED_NEGATIVE_BOUNDARIES });
  assert('blocked_output_payloads_verified', blockedOutputPayloads.length === EXPECTED_BLOCKED_OUTPUT_PAYLOADS.length && EXPECTED_BLOCKED_OUTPUT_PAYLOADS.every((item) => blockedOutputPayloads.includes(item)), { blockedOutputPayloads, expected: EXPECTED_BLOCKED_OUTPUT_PAYLOADS });
  assert('integrity_denial_rules_verified', integrityDenials.length === EXPECTED_INTEGRITY_DENIAL_RULES.length && EXPECTED_INTEGRITY_DENIAL_RULES.every((item) => integrityDenials.includes(item)), { integrityDenials, expected: EXPECTED_INTEGRITY_DENIAL_RULES });
  assert('side_effect_denial_rules_verified', sideEffectDenials.length === EXPECTED_SIDE_EFFECT_DENIALS.length && EXPECTED_SIDE_EFFECT_DENIALS.every((item) => sideEffectDenials.includes(item)), { sideEffectDenials, expected: EXPECTED_SIDE_EFFECT_DENIALS });
  assert('block_result_contract_verified', blockResultContract.length === EXPECTED_BLOCK_RESULT_CONTRACT.length && EXPECTED_BLOCK_RESULT_CONTRACT.every((item) => blockResultContract.includes(item)), { blockResultContract, expected: EXPECTED_BLOCK_RESULT_CONTRACT });

  assert('p4_05_handoff_verified', containsAll(handoff.join('\n'), [
    `next_gate: ${NEXT_STEP}`,
    'p4_05_must_verify_p4_00 = true',
    'p4_05_must_verify_p4_01 = true',
    'p4_05_must_verify_p4_02 = true',
    'p4_05_must_verify_p4_03 = true',
    'p4_05_must_verify_p4_04 = true',
    'p4_05_must_freeze_completion_boundary = true',
    'p4_05_must_authorize_P5_entry_only_after_completion = true',
    `suggested_completion_tag: ${SUGGESTED_COMPLETION_TAG}`,
  ]), { handoff });

  assert('allowed_changed_files_documented', allowedChangedFiles.length === ALLOWED_CHANGED_FILES.length && ALLOWED_CHANGED_FILES.every((item) => allowedChangedFiles.includes(item)), { allowedChangedFiles, expected: ALLOWED_CHANGED_FILES });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((item) => forbiddenDirs.includes(item)), { forbiddenDirs, expected: FORBIDDEN_PREFIXES });

  assert('boundary_assertions_verified', containsAll(boundaryAssertions.join('\n'), [
    'p4_04_is_governance_only = true',
    'p4_04_changes_frontend = false',
    'p4_04_changes_runtime = false',
    'p4_04_changes_db = false',
    'p4_04_creates_roi_calculation = false',
    'p4_04_creates_roi_read_model_implementation = false',
    'p4_04_creates_recommendation = false',
    'p4_04_creates_priority_score = false',
    'p4_04_creates_profit_prediction = false',
    'p4_04_creates_ao_act_task = false',
    'p4_04_writes_field_memory = false',
    'p4_04_extends_to_p7_or_later = false',
  ]), { boundaryAssertions });

  assert('next_step_verified', nextStep.length === 1 && nextStep[0] === NEXT_STEP, { nextStep, expected: NEXT_STEP });

  return {
    negative_boundary_count: negativeBoundaries.length,
    negative_vector_count: negativeVectors.length,
    negative_matrix_row_count: negativeRows.length,
    blocked_output_payload_count: blockedOutputPayloads.length,
    integrity_denial_rule_count: integrityDenials.length,
    side_effect_denial_rule_count: sideEffectDenials.length,
    block_result_contract_field_count: blockResultContract.length,
  };
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
  verifyP403Entry();
  const counts = verifyP404Document();
  verifyChangedFiles();

  const changedFiles = changedFilesFromMain();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p4_03_verified: true,
    p4_03_commit: P4_03_COMMIT,
    ...counts,
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
