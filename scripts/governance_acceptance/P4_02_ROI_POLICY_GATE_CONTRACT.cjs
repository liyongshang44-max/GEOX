// scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs
// Purpose: verify the P4-02 ROI policy gate contract before any policy-gate runtime work.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P4_02_ROI_POLICY_GATE_CONTRACT';
const PREVIOUS_ACCEPTANCE = 'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION';
const CURRENT_DOC = 'docs/tasks/P4-02-ROI-Policy-Gate-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs';
const P4_01_DOC = 'docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md';
const P4_01_SCRIPT = 'scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs';
const P4_01_COMMIT = 'f6bdd572685403a87faa268a70cc86c027f348b2';
const NEXT_STEP = 'P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT';

const ALLOWED_CHANGED_FILES = [
  CURRENT_DOC,
  CURRENT_SCRIPT,
];

const REQUIRED_FILES = [
  P4_01_DOC,
  P4_01_SCRIPT,
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

const EXPECTED_REQUIRED_POLICY_GATES = [
  'provenance_required',
  'evidence_refs_required',
  'trace_refs_required',
  'source_schema_compatible',
  'allowed_source_ref_kind',
  'forbidden_source_ref_kind_blocked',
  'scope_preserved',
  'operator_visible_boundary_preserved',
  'no_recommendation_semantics',
  'no_execution_trigger',
  'no_priority_score',
  'no_profit_prediction',
  'no_prescription_semantics',
  'no_field_memory_write',
  'no_receipt_creation',
  'no_ao_act_task_creation',
];

const EXPECTED_FAIL_CODES = [
  'MISSING_PROVENANCE',
  'MISSING_EVIDENCE_REFS',
  'MISSING_TRACE_REFS',
  'SOURCE_SCHEMA_INCOMPATIBLE',
  'SOURCE_REF_KIND_NOT_ALLOWED',
  'FORBIDDEN_SOURCE_REF_KIND_PRESENT',
  'SCOPE_NOT_PRESERVED',
  'OPERATOR_VISIBLE_BOUNDARY_VIOLATED',
  'RECOMMENDATION_SEMANTICS_PRESENT',
  'EXECUTION_TRIGGER_PRESENT',
  'PRIORITY_SCORE_PRESENT',
  'PROFIT_PREDICTION_PRESENT',
  'PRESCRIPTION_SEMANTICS_PRESENT',
  'FIELD_MEMORY_WRITE_PRESENT',
  'RECEIPT_CREATION_PRESENT',
  'AO_ACT_TASK_CREATION_PRESENT',
];

const EXPECTED_AGGREGATION_RULES = [
  'all_required_gates_must_pass = true',
  'any_failed_gate_blocks_roi = true',
  'missing_gate_evaluation_blocks_roi = true',
  'unknown_gate_result_blocks_roi = true',
  'policy_gate_side_effect_blocks_roi = true',
];

const EXPECTED_POLICY_RESULT_VOCABULARY = [
  'PASS = all_required_gates_passed',
  'BLOCK = one_or_more_required_gates_failed',
  'NOT_EVALUATED = treated_as_BLOCK',
  'UNKNOWN = treated_as_BLOCK',
];

const EXPECTED_POLICY_INPUT_FIELDS = [
  'policy_gate_contract_version',
  'policy_evaluation_id',
  'policy_evaluated_at',
  'source_ref_records',
  'operator_visible_boundary_ref',
  'scope_ref',
  'policy_context_ref',
];

const EXPECTED_SOURCE_REF_RECORD_FIELDS = [
  'ref_kind',
  'ref_id',
  'object_type',
  'scope_ref',
  'occurred_at_or_created_at',
  'source_schema_version_or_contract_ref',
  'evidence_refs',
  'trace_refs',
  'provenance_ref',
  'derivation_role',
  'policy_boundary_result',
];

const EXPECTED_POLICY_OUTPUT_FIELDS = [
  'policy_gate_result',
  'passed_gates',
  'blocked_gates',
  'fail_codes',
  'source_ref_record_refs',
  'operator_visible_boundary_result',
  'evaluation_trace_ref',
  'policy_contract_version',
];

const EXPECTED_BLOCKED_SEMANTICS = [
  'recommendation',
  'priority_score',
  'success_prediction',
  'profit_prediction',
  'hidden_profit_assumption',
  'prescription',
  'execution_trigger',
  'automatic_formal_roi',
  'automatic_field_memory_write',
  'automatic_ao_act_task_creation',
  'automatic_receipt_creation',
  'evidence_rewrite',
  'trace_rewrite',
  'unbounded_source_dependency',
  'operator_gate_bypass',
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

function fencedSectionsAfterHeading(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start < 0) return [];
  const nextHeading = text.indexOf('\n## ', start + marker.length);
  const sectionEnd = nextHeading < 0 ? text.length : nextHeading;
  const sectionText = text.slice(start, sectionEnd);
  const blocks = [];
  let cursor = 0;
  while (cursor < sectionText.length) {
    const open = sectionText.indexOf('```text', cursor);
    if (open < 0) break;
    const bodyStart = sectionText.indexOf('\n', open) + 1;
    const close = sectionText.indexOf('```', bodyStart);
    if (close < 0) break;
    blocks.push(sectionText.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    cursor = close + 3;
  }
  return blocks;
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

function verifyP401Entry() {
  const p401Doc = read(P4_01_DOC);
  const p401Script = read(P4_01_SCRIPT);
  const p401CommitReachable = gitSucceeds(['merge-base', '--is-ancestor', P4_01_COMMIT, 'HEAD']);

  assert('p4_01_doc_verified', containsAll(p401Doc, [
    PREVIOUS_ACCEPTANCE,
    'P4-01 freezes the source boundary for Policy-Controlled ROI.',
    'allowed_source_ref_kind_count = 7',
    'forbidden_source_ref_kind_count = 17',
    'forbidden_semantic_count = 15',
    'next_step = P4_02_ROI_POLICY_GATE_CONTRACT',
  ]), { file: P4_01_DOC });

  assert('p4_01_script_verified', containsAll(p401Script, [
    PREVIOUS_ACCEPTANCE,
    'P4_02_ROI_POLICY_GATE_CONTRACT',
    'EXPECTED_ALLOWED_SOURCE_REF_KINDS',
    'EXPECTED_FORBIDDEN_SOURCE_REF_KINDS',
    'no_frontend_changed_by_this_task',
    'no_runtime_changed_by_this_task',
    'no_db_changed_by_this_task',
  ]), { file: P4_01_SCRIPT });

  assert('p4_01_commit_reachable_from_head', p401CommitReachable, { commit: P4_01_COMMIT });
}

function verifyP402Document() {
  const doc = read(CURRENT_DOC);
  const entryConditions = fencedSectionLines(doc, 'Entry conditions');
  const policyPrinciple = fencedSectionLines(doc, 'Policy gate principle');
  const requiredGates = fencedSectionLines(doc, 'Required ROI policy gates');
  const failCodes = fencedSectionLines(doc, 'Gate fail codes');
  const gateMatrix = fencedSectionLines(doc, 'Gate contract matrix');
  const aggregationRules = fencedSectionLines(doc, 'Fail-closed aggregation rules');
  const resultVocabulary = fencedSectionLines(doc, 'Policy result vocabulary');
  const inputSections = fencedSectionsAfterHeading(doc, 'Policy gate evaluation input contract');
  const inputContract = inputSections[0] || [];
  const sourceRefRecordContract = inputSections[1] || [];
  const outputContract = fencedSectionLines(doc, 'Policy gate output contract');
  const blockedSemantics = fencedSectionLines(doc, 'Blocked semantics');
  const handoff = fencedSectionLines(doc, 'P4-03 handoff');
  const allowedChangedFiles = fencedSectionLines(doc, 'Changed files allowed in P4-02');
  const forbiddenDirs = fencedSectionLines(doc, 'Directories forbidden in P4-02');
  const boundaryAssertions = fencedSectionLines(doc, 'Boundary assertions');
  const nextStep = fencedSectionLines(doc, 'Next step');

  assert('p4_02_document_identity_verified', containsAll(doc, [
    ACCEPTANCE,
    'P4-02 freezes the policy gate contract for Policy-Controlled ROI.',
    'fail-closed behavior',
    NEXT_STEP,
  ]), { file: CURRENT_DOC });

  assert('entry_conditions_verified', containsAll(entryConditions.join('\n'), [
    PREVIOUS_ACCEPTANCE,
    P4_01_DOC,
    P4_01_SCRIPT,
    P4_01_COMMIT,
    'p4_01_status: accepted_on_main',
  ]), { entryConditions });

  assert('policy_gate_principle_verified', containsAll(policyPrinciple.join('\n'), [
    'roi_policy_gate_must_fail_closed = true',
    'roi_policy_gate_must_be_traceable = true',
    'roi_policy_gate_must_be_evidence_backed = true',
    'roi_policy_gate_must_preserve_source_boundary = true',
    'roi_policy_gate_must_preserve_operator_visible_boundary = true',
    'roi_policy_gate_must_not_create_runtime_side_effect = true',
  ]), { policyPrinciple });

  assert('required_policy_gates_verified', requiredGates.length === EXPECTED_REQUIRED_POLICY_GATES.length && EXPECTED_REQUIRED_POLICY_GATES.every((item) => requiredGates.includes(item)), { requiredGates, expected: EXPECTED_REQUIRED_POLICY_GATES });
  assert('fail_codes_verified', failCodes.length === EXPECTED_FAIL_CODES.length && EXPECTED_FAIL_CODES.every((item) => failCodes.includes(item)), { failCodes, expected: EXPECTED_FAIL_CODES });

  for (const gate of EXPECTED_REQUIRED_POLICY_GATES) {
    assert(`gate_matrix_contains_gate:${gate}`, gateMatrix.some((line) => line.startsWith(`${gate} => `) && line.includes('fail_result BLOCK')), { gate, gateMatrix });
  }
  for (const code of EXPECTED_FAIL_CODES) {
    assert(`gate_matrix_contains_fail_code:${code}`, gateMatrix.some((line) => line.includes(`fail_code ${code}`)), { code, gateMatrix });
  }

  assert('aggregation_rules_verified', aggregationRules.length === EXPECTED_AGGREGATION_RULES.length && EXPECTED_AGGREGATION_RULES.every((item) => aggregationRules.includes(item)), { aggregationRules, expected: EXPECTED_AGGREGATION_RULES });
  assert('policy_result_vocabulary_verified', resultVocabulary.length === EXPECTED_POLICY_RESULT_VOCABULARY.length && EXPECTED_POLICY_RESULT_VOCABULARY.every((item) => resultVocabulary.includes(item)), { resultVocabulary, expected: EXPECTED_POLICY_RESULT_VOCABULARY });
  assert('policy_input_contract_verified', inputContract.length === EXPECTED_POLICY_INPUT_FIELDS.length && EXPECTED_POLICY_INPUT_FIELDS.every((item) => inputContract.includes(item)), { inputContract, expected: EXPECTED_POLICY_INPUT_FIELDS });
  assert('source_ref_record_contract_verified', sourceRefRecordContract.length === EXPECTED_SOURCE_REF_RECORD_FIELDS.length && EXPECTED_SOURCE_REF_RECORD_FIELDS.every((item) => sourceRefRecordContract.includes(item)), { sourceRefRecordContract, expected: EXPECTED_SOURCE_REF_RECORD_FIELDS });
  assert('policy_output_contract_verified', outputContract.length === EXPECTED_POLICY_OUTPUT_FIELDS.length && EXPECTED_POLICY_OUTPUT_FIELDS.every((item) => outputContract.includes(item)), { outputContract, expected: EXPECTED_POLICY_OUTPUT_FIELDS });
  assert('blocked_semantics_verified', blockedSemantics.length === EXPECTED_BLOCKED_SEMANTICS.length && EXPECTED_BLOCKED_SEMANTICS.every((item) => blockedSemantics.includes(item)), { blockedSemantics, expected: EXPECTED_BLOCKED_SEMANTICS });

  assert('p4_03_handoff_verified', containsAll(handoff.join('\n'), [
    `next_gate: ${NEXT_STEP}`,
    'p4_03_must_use_policy_gate_result_vocabulary = true',
    'p4_03_must_show_blocked_roi_as_blocked_not_recommendation = true',
    'p4_03_must_preserve_fail_codes = true',
    'p4_03_must_preserve_source_ref_record_refs = true',
    'p4_03_must_not_create_execution_trigger = true',
    'p4_03_must_not_create_field_memory_write = true',
    'p4_03_must_not_create_receipt = true',
    'p4_03_must_not_create_ao_act_task = true',
  ]), { handoff });

  assert('allowed_changed_files_documented', allowedChangedFiles.length === ALLOWED_CHANGED_FILES.length && ALLOWED_CHANGED_FILES.every((item) => allowedChangedFiles.includes(item)), { allowedChangedFiles, expected: ALLOWED_CHANGED_FILES });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((item) => forbiddenDirs.includes(item)), { forbiddenDirs, expected: FORBIDDEN_PREFIXES });

  assert('boundary_assertions_verified', containsAll(boundaryAssertions.join('\n'), [
    'p4_02_is_governance_only = true',
    'p4_02_changes_frontend = false',
    'p4_02_changes_runtime = false',
    'p4_02_changes_db = false',
    'p4_02_creates_roi_calculation = false',
    'p4_02_creates_recommendation = false',
    'p4_02_creates_priority_score = false',
    'p4_02_creates_profit_prediction = false',
    'p4_02_creates_ao_act_task = false',
    'p4_02_writes_field_memory = false',
    'p4_02_extends_to_p7_or_later = false',
  ]), { boundaryAssertions });

  assert('next_step_verified', nextStep.length === 1 && nextStep[0] === NEXT_STEP, { nextStep, expected: NEXT_STEP });

  return {
    required_policy_gate_count: requiredGates.length,
    fail_code_count: failCodes.length,
    aggregation_rule_count: aggregationRules.length,
    policy_result_vocabulary_count: resultVocabulary.length,
    policy_input_contract_field_count: inputContract.length,
    source_ref_record_contract_field_count: sourceRefRecordContract.length,
    policy_output_contract_field_count: outputContract.length,
    blocked_semantic_count: blockedSemantics.length,
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
  verifyP401Entry();
  const counts = verifyP402Document();
  verifyChangedFiles();

  const changedFiles = changedFilesFromMain();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p4_01_verified: true,
    p4_01_commit: P4_01_COMMIT,
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
