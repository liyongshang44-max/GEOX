// scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs
// Purpose: verify the P4-03 ROI read model/output contract before any read-model implementation work.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT';
const PREVIOUS_ACCEPTANCE = 'P4_02_ROI_POLICY_GATE_CONTRACT';
const CURRENT_DOC = 'docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs';
const P4_02_DOC = 'docs/tasks/P4-02-ROI-Policy-Gate-Contract.md';
const P4_02_SCRIPT = 'scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs';
const P4_02_COMMIT = 'b8341272a990494ebba483ff644bb3837b89ec34';
const NEXT_STEP = 'P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX';

const ALLOWED_CHANGED_FILES = [
  CURRENT_DOC,
  CURRENT_SCRIPT,
];

const REQUIRED_FILES = [
  P4_02_DOC,
  P4_02_SCRIPT,
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

const EXPECTED_POLICY_RESULT_PASSTHROUGH = [
  'PASS',
  'BLOCK',
  'NOT_EVALUATED',
  'UNKNOWN',
];

const EXPECTED_ROI_OUTPUT_FIELDS = [
  'roi_output_contract_version',
  'roi_view_id',
  'scope_ref',
  'policy_evaluation_ref',
  'policy_gate_result',
  'display_state',
  'display_reason_codes',
  'passed_gates',
  'blocked_gates',
  'fail_codes',
  'source_ref_record_refs',
  'evidence_refs',
  'trace_refs',
  'provenance_ref',
  'operator_visible_boundary_result',
  'read_only',
];

const EXPECTED_DISPLAY_STATES = [
  'ROI_VISIBLE_POLICY_PASSED',
  'ROI_BLOCKED_POLICY_FAILED',
  'ROI_BLOCKED_NOT_EVALUATED',
  'ROI_BLOCKED_UNKNOWN',
  'ROI_BLOCKED_SOURCE_BOUNDARY',
];

const EXPECTED_DISPLAY_RULES = [
  'PASS => display_state ROI_VISIBLE_POLICY_PASSED; may show read-only ROI payload only if all value source refs remain allowed',
  'BLOCK => display_state ROI_BLOCKED_POLICY_FAILED; must preserve fail_codes; must not show ROI value payload as valid',
  'NOT_EVALUATED => display_state ROI_BLOCKED_NOT_EVALUATED; must not show ROI value payload',
  'UNKNOWN => display_state ROI_BLOCKED_UNKNOWN; must not show ROI value payload',
  'SOURCE_REF_KIND_NOT_ALLOWED => display_state ROI_BLOCKED_SOURCE_BOUNDARY; must preserve fail_code',
  'FORBIDDEN_SOURCE_REF_KIND_PRESENT => display_state ROI_BLOCKED_SOURCE_BOUNDARY; must preserve fail_code',
  'blocked_semantic_fail_code => display_state ROI_BLOCKED_POLICY_FAILED; must not convert blocked output into recommendation',
];

const EXPECTED_READ_ONLY_PROJECTION_RULES = [
  'projection_is_read_only = true',
  'projection_may_materialize_only_from_policy_output_contract = true',
  'projection_must_not_query_unbounded_sources = true',
  'projection_must_not_write_roi_entry = true',
  'projection_must_not_write_field_memory = true',
  'projection_must_not_create_receipt = true',
  'projection_must_not_create_ao_act_task = true',
  'projection_must_not_advance_decision_cycle = true',
];

const EXPECTED_VALUE_DISCLOSURE_RULES = [
  'roi_value_may_be_present_only_when_policy_gate_result_PASS = true',
  'roi_value_must_reference_source_ref_record_refs = true',
  'roi_value_must_not_include_hidden_profit_assumption = true',
  'roi_value_must_not_include_priority_score = true',
  'roi_value_must_not_include_success_prediction = true',
  'roi_value_must_not_include_recommendation = true',
  'roi_value_must_not_include_prescription = true',
  'roi_value_must_be_read_only = true',
];

const EXPECTED_BLOCKED_OUTPUT_SEMANTICS = [
  'recommendation',
  'priority_score',
  'success_prediction',
  'profit_prediction',
  'hidden_profit_assumption',
  'prescription',
  'execution_trigger',
  'ao_act_task_payload',
  'receipt_payload',
  'field_memory_payload',
  'operator_action_instruction',
  'automatic_formalization_marker',
  'evidence_rewrite_payload',
  'trace_rewrite_payload',
  'unbounded_source_summary',
];

const EXPECTED_SIDE_EFFECT_DENIALS = [
  'roi_output_cannot_trigger_ao_act_task = true',
  'roi_output_cannot_create_receipt = true',
  'roi_output_cannot_write_field_memory = true',
  'roi_output_cannot_write_roi_entry = true',
  'roi_output_cannot_advance_decision_cycle = true',
  'roi_output_cannot_update_source_refs = true',
  'roi_output_cannot_update_trace_refs = true',
  'roi_output_cannot_update_evidence_refs = true',
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

function verifyP402Entry() {
  const p402Doc = read(P4_02_DOC);
  const p402Script = read(P4_02_SCRIPT);
  const p402CommitReachable = gitSucceeds(['merge-base', '--is-ancestor', P4_02_COMMIT, 'HEAD']);

  assert('p4_02_doc_verified', containsAll(p402Doc, [
    PREVIOUS_ACCEPTANCE,
    'P4-02 freezes the policy gate contract for Policy-Controlled ROI.',
    'roi_policy_gate_must_fail_closed = true',
    'required_policy_gate_count = 16',
    'fail_code_count = 16',
    'policy_result_vocabulary_count = 4',
    'next_step = P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT',
  ]), { file: P4_02_DOC });

  assert('p4_02_script_verified', containsAll(p402Script, [
    PREVIOUS_ACCEPTANCE,
    'P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT',
    'EXPECTED_REQUIRED_POLICY_GATES',
    'EXPECTED_FAIL_CODES',
    'EXPECTED_POLICY_RESULT_VOCABULARY',
    'no_frontend_changed_by_this_task',
    'no_runtime_changed_by_this_task',
    'no_db_changed_by_this_task',
  ]), { file: P4_02_SCRIPT });

  assert('p4_02_commit_reachable_from_head', p402CommitReachable, { commit: P4_02_COMMIT });
}

function verifyP403Document() {
  const doc = read(CURRENT_DOC);
  const entryConditions = fencedSectionLines(doc, 'Entry conditions');
  const outputPrinciple = fencedSectionLines(doc, 'Output contract principle');
  const policyResultPassthrough = fencedSectionLines(doc, 'Policy result passthrough');
  const roiOutputFields = fencedSectionLines(doc, 'ROI output fields');
  const displayStates = fencedSectionLines(doc, 'Display state vocabulary');
  const displayRules = fencedSectionLines(doc, 'Display rules');
  const readOnlyProjectionRules = fencedSectionLines(doc, 'Read-only projection boundary');
  const valueDisclosureRules = fencedSectionLines(doc, 'ROI value disclosure rules');
  const blockedOutputSemantics = fencedSectionLines(doc, 'Blocked output semantics');
  const sideEffectDenials = fencedSectionLines(doc, 'Side-effect denial');
  const handoff = fencedSectionLines(doc, 'P4-04 handoff');
  const allowedChangedFiles = fencedSectionLines(doc, 'Changed files allowed in P4-03');
  const forbiddenDirs = fencedSectionLines(doc, 'Directories forbidden in P4-03');
  const boundaryAssertions = fencedSectionLines(doc, 'Boundary assertions');
  const nextStep = fencedSectionLines(doc, 'Next step');

  assert('p4_03_document_identity_verified', containsAll(doc, [
    ACCEPTANCE,
    'P4-03 freezes the read model and output contract for Policy-Controlled ROI.',
    'blocked-display behavior',
    NEXT_STEP,
  ]), { file: CURRENT_DOC });

  assert('entry_conditions_verified', containsAll(entryConditions.join('\n'), [
    PREVIOUS_ACCEPTANCE,
    P4_02_DOC,
    P4_02_SCRIPT,
    P4_02_COMMIT,
    'p4_02_status: accepted_on_main',
  ]), { entryConditions });

  assert('output_contract_principle_verified', containsAll(outputPrinciple.join('\n'), [
    'roi_output_must_be_read_only = true',
    'roi_output_must_preserve_policy_gate_result = true',
    'roi_output_must_preserve_fail_codes = true',
    'roi_output_must_preserve_source_ref_record_refs = true',
    'roi_output_must_not_create_runtime_side_effect = true',
    'roi_output_must_not_become_recommendation = true',
  ]), { outputPrinciple });

  assert('policy_result_passthrough_verified', policyResultPassthrough.length === EXPECTED_POLICY_RESULT_PASSTHROUGH.length && EXPECTED_POLICY_RESULT_PASSTHROUGH.every((item) => policyResultPassthrough.includes(item)), { policyResultPassthrough, expected: EXPECTED_POLICY_RESULT_PASSTHROUGH });
  assert('roi_output_fields_verified', roiOutputFields.length === EXPECTED_ROI_OUTPUT_FIELDS.length && EXPECTED_ROI_OUTPUT_FIELDS.every((item) => roiOutputFields.includes(item)), { roiOutputFields, expected: EXPECTED_ROI_OUTPUT_FIELDS });
  assert('display_states_verified', displayStates.length === EXPECTED_DISPLAY_STATES.length && EXPECTED_DISPLAY_STATES.every((item) => displayStates.includes(item)), { displayStates, expected: EXPECTED_DISPLAY_STATES });
  assert('display_rules_verified', displayRules.length === EXPECTED_DISPLAY_RULES.length && EXPECTED_DISPLAY_RULES.every((item) => displayRules.includes(item)), { displayRules, expected: EXPECTED_DISPLAY_RULES });
  assert('read_only_projection_rules_verified', readOnlyProjectionRules.length === EXPECTED_READ_ONLY_PROJECTION_RULES.length && EXPECTED_READ_ONLY_PROJECTION_RULES.every((item) => readOnlyProjectionRules.includes(item)), { readOnlyProjectionRules, expected: EXPECTED_READ_ONLY_PROJECTION_RULES });
  assert('value_disclosure_rules_verified', valueDisclosureRules.length === EXPECTED_VALUE_DISCLOSURE_RULES.length && EXPECTED_VALUE_DISCLOSURE_RULES.every((item) => valueDisclosureRules.includes(item)), { valueDisclosureRules, expected: EXPECTED_VALUE_DISCLOSURE_RULES });
  assert('blocked_output_semantics_verified', blockedOutputSemantics.length === EXPECTED_BLOCKED_OUTPUT_SEMANTICS.length && EXPECTED_BLOCKED_OUTPUT_SEMANTICS.every((item) => blockedOutputSemantics.includes(item)), { blockedOutputSemantics, expected: EXPECTED_BLOCKED_OUTPUT_SEMANTICS });
  assert('side_effect_denials_verified', sideEffectDenials.length === EXPECTED_SIDE_EFFECT_DENIALS.length && EXPECTED_SIDE_EFFECT_DENIALS.every((item) => sideEffectDenials.includes(item)), { sideEffectDenials, expected: EXPECTED_SIDE_EFFECT_DENIALS });

  assert('p4_04_handoff_verified', containsAll(handoff.join('\n'), [
    `next_gate: ${NEXT_STEP}`,
    'p4_04_must_cover_forbidden_output_semantics = true',
    'p4_04_must_cover_display_rule_violations = true',
    'p4_04_must_cover_read_only_projection_violations = true',
    'p4_04_must_cover_value_disclosure_violations = true',
    'p4_04_must_cover_side_effect_denial_violations = true',
    'p4_04_must_preserve_no_recommendation_boundary = true',
    'p4_04_must_preserve_no_execution_trigger_boundary = true',
  ]), { handoff });

  assert('allowed_changed_files_documented', allowedChangedFiles.length === ALLOWED_CHANGED_FILES.length && ALLOWED_CHANGED_FILES.every((item) => allowedChangedFiles.includes(item)), { allowedChangedFiles, expected: ALLOWED_CHANGED_FILES });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((item) => forbiddenDirs.includes(item)), { forbiddenDirs, expected: FORBIDDEN_PREFIXES });

  assert('boundary_assertions_verified', containsAll(boundaryAssertions.join('\n'), [
    'p4_03_is_governance_only = true',
    'p4_03_changes_frontend = false',
    'p4_03_changes_runtime = false',
    'p4_03_changes_db = false',
    'p4_03_creates_roi_calculation = false',
    'p4_03_creates_roi_read_model_implementation = false',
    'p4_03_creates_recommendation = false',
    'p4_03_creates_priority_score = false',
    'p4_03_creates_profit_prediction = false',
    'p4_03_creates_ao_act_task = false',
    'p4_03_writes_field_memory = false',
    'p4_03_extends_to_p7_or_later = false',
  ]), { boundaryAssertions });

  assert('next_step_verified', nextStep.length === 1 && nextStep[0] === NEXT_STEP, { nextStep, expected: NEXT_STEP });

  return {
    policy_result_passthrough_count: policyResultPassthrough.length,
    roi_output_field_count: roiOutputFields.length,
    display_state_count: displayStates.length,
    display_rule_count: displayRules.length,
    read_only_projection_rule_count: readOnlyProjectionRules.length,
    value_disclosure_rule_count: valueDisclosureRules.length,
    blocked_output_semantic_count: blockedOutputSemantics.length,
    side_effect_denial_count: sideEffectDenials.length,
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
  verifyP402Entry();
  const counts = verifyP403Document();
  verifyChangedFiles();

  const changedFiles = changedFilesFromMain();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p4_02_verified: true,
    p4_02_commit: P4_02_COMMIT,
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
