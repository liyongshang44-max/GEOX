// scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs
// Purpose: verify the P4-01 ROI source boundary reconciliation before any ROI policy-gate runtime work.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION';
const PREVIOUS_ACCEPTANCE = 'P4_POLICY_CONTROLLED_ROI_PLANNING';
const CURRENT_DOC = 'docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs';
const P4_00_DOC = 'docs/tasks/P4-Policy-Controlled-ROI-Planning.md';
const P4_00_SCRIPT = 'scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs';
const P4_00_COMMIT = '7fb55a690cfff90ef81a9f62e45809552cd38cba';
const NEXT_STEP = 'P4_02_ROI_POLICY_GATE_CONTRACT';

const ALLOWED_CHANGED_FILES = [
  CURRENT_DOC,
  CURRENT_SCRIPT,
];

const REQUIRED_FILES = [
  P4_00_DOC,
  P4_00_SCRIPT,
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

const EXPECTED_ALLOWED_SOURCE_REF_KINDS = [
  'evidence_ref',
  'trace_ref',
  'provenance_ref',
  'source_schema_compatibility_ref',
  'system_derived_object_ref',
  'operator_explicit_input_ref',
  'operator_formalization_action_ref',
];

const EXPECTED_SYSTEM_DERIVED_OBJECT_REFS = [
  'field_state_snapshot_v1',
  'forecast_run_v1',
  'scenario_set_v1',
  'calibration_replay_v1',
  'forecast_error_v1',
  'field_learning_candidate_v1',
  'decision_cycle_v1',
  'production_ingestion_event_v0',
  'operator_session_v0',
  'operator_decision_review_v0',
  'operator_formalization_action_v0',
];

const EXPECTED_CONTEXT_ONLY_REFS = [
  'operator_gate_ref = context_only_not_value_source',
  'operator_review_ref = context_only_not_value_source',
  'existing_roi_entry_ref = context_only_not_recursive_roi_source',
  'business_closure_ref = context_only_not_value_source',
];

const EXPECTED_DEFERRED_REFS = [
  'field_memory_ref = deferred_to_P5_not_allowed_as_P4_ROI_source',
  'receipt_ref = deferred_to_P6_not_allowed_as_P4_ROI_source',
  'ao_act_task_ref = deferred_to_P6_not_allowed_as_P4_ROI_source',
  'execution_audit_ref = deferred_to_P6_not_allowed_as_P4_ROI_source',
];

const EXPECTED_FORBIDDEN_SOURCE_REF_KINDS = [
  'untraceable_manual_claim',
  'hidden_profit_assumption',
  'recommendation_ref',
  'priority_score_ref',
  'success_prediction_ref',
  'production_operation_claim_ref',
  'prescription_ref',
  'execution_trigger_ref',
  'ao_act_task_ref',
  'receipt_ref',
  'field_memory_ref',
  'dashboard_metric_ref',
  'frontend_state_ref',
  'free_text_summary_ref',
  'unverified_causal_explanation_ref',
  'model_update_ref',
  'autonomous_policy_promotion_ref',
];

const EXPECTED_FORBIDDEN_SEMANTICS = [
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

function verifyP400Entry() {
  const p400Doc = read(P4_00_DOC);
  const p400Script = read(P4_00_SCRIPT);
  const p400CommitReachable = gitSucceeds(['merge-base', '--is-ancestor', P4_00_COMMIT, 'HEAD']);

  assert('p4_00_doc_verified', containsAll(p400Doc, [
    PREVIOUS_ACCEPTANCE,
    'P4 Policy-Controlled ROI',
    'p4_00_is_planning_only = true',
    'p4_00_changes_frontend = false',
    'p4_00_changes_runtime = false',
    'p4_00_changes_db = false',
    'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION',
  ]), { file: P4_00_DOC });

  assert('p4_00_script_verified', containsAll(p400Script, [
    PREVIOUS_ACCEPTANCE,
    'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION',
    'no_frontend_changed_by_this_task',
    'no_runtime_changed_by_this_task',
    'no_db_changed_by_this_task',
  ]), { file: P4_00_SCRIPT });

  assert('p4_00_commit_reachable_from_head', p400CommitReachable, { commit: P4_00_COMMIT });
}

function verifyP401Document() {
  const doc = read(CURRENT_DOC);
  const entryConditions = fencedSectionLines(doc, 'Entry conditions');
  const sourcePrinciple = fencedSectionLines(doc, 'Source boundary principle');
  const allowedKinds = fencedSectionLines(doc, 'Allowed ROI source ref kinds');
  const allowedConditions = fencedSectionLines(doc, 'Allowed source ref conditions');
  const systemDerivedRefs = fencedSectionLines(doc, 'Allowed system-derived object refs');
  const contextOnlyRefs = fencedSectionLines(doc, 'Context-only refs');
  const deferredRefs = fencedSectionLines(doc, 'Deferred refs');
  const forbiddenKinds = fencedSectionLines(doc, 'Forbidden ROI source ref kinds');
  const forbiddenSemantics = fencedSectionLines(doc, 'Forbidden semantics');
  const sourceDecisionMatrix = fencedSectionLines(doc, 'Source decision matrix');
  const minimalContract = fencedSectionLines(doc, 'Minimal source ref record contract for later P4 tasks');
  const handoff = fencedSectionLines(doc, 'P4-02 handoff');
  const allowedChangedFiles = fencedSectionLines(doc, 'Changed files allowed in P4-01');
  const forbiddenDirs = fencedSectionLines(doc, 'Directories forbidden in P4-01');
  const boundaryAssertions = fencedSectionLines(doc, 'Boundary assertions');
  const nextStep = fencedSectionLines(doc, 'Next step');

  assert('p4_01_document_identity_verified', containsAll(doc, [
    ACCEPTANCE,
    'P4-01 freezes the source boundary for Policy-Controlled ROI.',
    'traceable, evidence-backed, and policy-controlled',
    NEXT_STEP,
  ]), { file: CURRENT_DOC });

  assert('entry_conditions_verified', containsAll(entryConditions.join('\n'), [
    PREVIOUS_ACCEPTANCE,
    P4_00_DOC,
    P4_00_SCRIPT,
    P4_00_COMMIT,
    'p4_00_status: accepted_on_main',
  ]), { entryConditions });

  assert('source_boundary_principle_verified', containsAll(sourcePrinciple.join('\n'), [
    'roi_source_must_be_traceable = true',
    'roi_source_must_be_evidence_backed = true',
    'roi_source_must_be_system_derived_or_explicitly_audited = true',
    'roi_source_must_preserve_provenance = true',
    'roi_source_must_not_rewrite_evidence = true',
    'roi_source_must_not_create_business_semantics = true',
  ]), { sourcePrinciple });

  assert('allowed_source_ref_kinds_verified', allowedKinds.length === EXPECTED_ALLOWED_SOURCE_REF_KINDS.length && EXPECTED_ALLOWED_SOURCE_REF_KINDS.every((item) => allowedKinds.includes(item)), { allowedKinds, expected: EXPECTED_ALLOWED_SOURCE_REF_KINDS });

  assert('allowed_source_ref_conditions_verified', containsAll(allowedConditions.join('\n'), [
    'evidence_ref requires immutable_or_pointer_based_source = true',
    'source_schema_compatibility_ref requires compatibility_result_present = true',
    'system_derived_object_ref requires upstream_trace_refs_present = true',
    'operator_explicit_input_ref requires no_hidden_assumption = true',
    'operator_formalization_action_ref requires read_only_reference = true',
  ]), { allowedConditions });

  assert('allowed_system_derived_object_refs_verified', systemDerivedRefs.length === EXPECTED_SYSTEM_DERIVED_OBJECT_REFS.length && EXPECTED_SYSTEM_DERIVED_OBJECT_REFS.every((item) => systemDerivedRefs.includes(item)), { systemDerivedRefs, expected: EXPECTED_SYSTEM_DERIVED_OBJECT_REFS });
  assert('context_only_refs_verified', contextOnlyRefs.length === EXPECTED_CONTEXT_ONLY_REFS.length && EXPECTED_CONTEXT_ONLY_REFS.every((item) => contextOnlyRefs.includes(item)), { contextOnlyRefs, expected: EXPECTED_CONTEXT_ONLY_REFS });
  assert('deferred_refs_verified', deferredRefs.length === EXPECTED_DEFERRED_REFS.length && EXPECTED_DEFERRED_REFS.every((item) => deferredRefs.includes(item)), { deferredRefs, expected: EXPECTED_DEFERRED_REFS });
  assert('forbidden_source_ref_kinds_verified', forbiddenKinds.length === EXPECTED_FORBIDDEN_SOURCE_REF_KINDS.length && EXPECTED_FORBIDDEN_SOURCE_REF_KINDS.every((item) => forbiddenKinds.includes(item)), { forbiddenKinds, expected: EXPECTED_FORBIDDEN_SOURCE_REF_KINDS });
  assert('forbidden_semantics_verified', forbiddenSemantics.length === EXPECTED_FORBIDDEN_SEMANTICS.length && EXPECTED_FORBIDDEN_SEMANTICS.every((item) => forbiddenSemantics.includes(item)), { forbiddenSemantics, expected: EXPECTED_FORBIDDEN_SEMANTICS });

  assert('source_decision_matrix_verified', containsAll(sourceDecisionMatrix.join('\n'), [
    'traceable_evidence_backed_system_derived_ref = allowed',
    'traceable_evidence_backed_explicit_operator_input_ref = allowed',
    'context_only_operator_workflow_ref = context_only',
    'field_memory_ref = blocked_until_P5',
    'receipt_ref = blocked_until_P6',
    'recommendation_ref = blocked',
    'priority_score_ref = blocked',
    'production_operation_claim_ref = blocked',
    'hidden_profit_assumption = blocked',
  ]), { sourceDecisionMatrix });

  assert('minimal_source_ref_record_contract_verified', containsAll(minimalContract.join('\n'), [
    'ref_kind',
    'ref_id',
    'object_type',
    'scope_ref',
    'source_schema_version_or_contract_ref',
    'evidence_refs',
    'trace_refs',
    'provenance_ref',
    'policy_boundary_result',
  ]), { minimalContract });

  assert('p4_02_handoff_verified', containsAll(handoff.join('\n'), [
    `next_gate: ${NEXT_STEP}`,
    'p4_02_must_block_untraceable_manual_claim = true',
    'p4_02_must_block_hidden_profit_assumption = true',
    'p4_02_must_block_recommendation_ref = true',
    'p4_02_must_block_priority_score_ref = true',
    'p4_02_must_block_success_prediction_ref = true',
    'p4_02_must_block_production_operation_claim_ref = true',
  ]), { handoff });

  assert('allowed_changed_files_documented', allowedChangedFiles.length === ALLOWED_CHANGED_FILES.length && ALLOWED_CHANGED_FILES.every((item) => allowedChangedFiles.includes(item)), { allowedChangedFiles, expected: ALLOWED_CHANGED_FILES });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((item) => forbiddenDirs.includes(item)), { forbiddenDirs, expected: FORBIDDEN_PREFIXES });

  assert('boundary_assertions_verified', containsAll(boundaryAssertions.join('\n'), [
    'p4_01_is_governance_only = true',
    'p4_01_changes_frontend = false',
    'p4_01_changes_runtime = false',
    'p4_01_changes_db = false',
    'p4_01_creates_roi_calculation = false',
    'p4_01_creates_recommendation = false',
    'p4_01_creates_priority_score = false',
    'p4_01_creates_profit_prediction = false',
    'p4_01_creates_ao_act_task = false',
    'p4_01_writes_field_memory = false',
    'p4_01_extends_to_p7_or_later = false',
  ]), { boundaryAssertions });

  assert('next_step_verified', nextStep.length === 1 && nextStep[0] === NEXT_STEP, { nextStep, expected: NEXT_STEP });

  return {
    allowed_source_ref_kind_count: allowedKinds.length,
    allowed_system_derived_object_ref_count: systemDerivedRefs.length,
    context_only_ref_count: contextOnlyRefs.length,
    deferred_ref_count: deferredRefs.length,
    forbidden_source_ref_kind_count: forbiddenKinds.length,
    forbidden_semantic_count: forbiddenSemantics.length,
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
  verifyP400Entry();
  const counts = verifyP401Document();
  verifyChangedFiles();

  const changedFiles = changedFilesFromMain();

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p4_00_verified: true,
    p4_00_commit: P4_00_COMMIT,
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
