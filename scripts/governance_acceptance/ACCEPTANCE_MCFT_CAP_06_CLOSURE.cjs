// Purpose: validate the MCFT-CAP-06 S11A Closure Candidate against the frozen taskbook Hard Acceptance ledger and completion-claim set.
// Boundary: governance verification only; no Runtime execution, canonical/projection write, migration, activation, route, Web, scheduler, S11B/C/D implementation, effective completion claim or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S11A_CLOSURE_RESULT.json');
const DEFAULT_BASE = 'b13a0057a8c9e93f3f4fcf8194b84149f1d2b1b5';
const S11A = 'MCFT-CAP-06.CLOSURE-CANDIDATE-V1';
const S11B = 'MCFT-CAP-06.CLOSURE-MERGED-MAIN-FINALIZATION-GATE-V1';
const EXPECTED_CANDIDATE_REF = 'twin_calibration_candidate_5649b9ab80b5545cf6007387';
const EXPECTED_EVALUATION_REF = 'twin_shadow_evaluation_8cae1f6732420a4999deffc0';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s10-bounded-chain-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s11a-closure-candidate.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-A.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-B.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-C.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-D.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-E.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-F.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-G.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-H.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-I.json',
  'docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-J.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_CLOSURE.cjs',
];
const CATEGORY_META = Object.freeze({
  A: ['ARCHITECTURE_AND_PREDECESSOR', 25],
  B: ['AUTHORIZATION_LIFECYCLE', 19],
  C: ['PREDECESSOR_LOCK_AND_STRUCTURAL_QUALIFICATION', 25],
  D: ['CONTROLLED_TRACK_ISOLATION_AND_RESIDUAL_WINDOWS', 28],
  E: ['CASE_AUTHORITY_AND_NUMERIC_POLICY_SEPARATION', 28],
  F: ['NUMERIC_SENSITIVITY_AND_SEARCH_MATH', 25],
  G: ['CANDIDATE_CONTRACT_AND_RECOVERY', 36],
  H: ['SHADOW_COMPUTE_EVALUATION_AND_RECOVERY', 33],
  I: ['RUNTIME_AUTHORITY_AND_POST_EVALUATION_TICK', 17],
  J: ['BOUNDED_CHAIN_AND_CLOSURE', 19],
});
const ZERO_KEYS = [
  'canonical_fact_append_count', 'canonical_fact_update_count', 'canonical_fact_delete_count',
  'candidate_append_count', 'evaluation_append_count', 'projection_write_count',
  'model_activation_count', 'active_config_switch_count', 'runtime_parameter_change_count',
  'state_mutation_count', 'checkpoint_mutation_count', 'migration_count',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/', 'apps/server/scripts/', 'apps/server/db/migrations/',
  'apps/web/', 'fixtures/', 'docker/', 'scripts/runtime_acceptance/',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function text(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
function json(relativePath) {
  return JSON.parse(text(relativePath));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function sliceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `TASKBOOK_SECTION_START_MISSING:${startMarker}`);
  assert.notEqual(end, -1, `TASKBOOK_SECTION_END_MISSING:${endMarker}`);
  return source.slice(start, end);
}
function nonEmptyLines(block) {
  return block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
function parseHardAcceptance(taskbook) {
  const source = sliceSection(taskbook, '# 43. Hard Acceptance evidence ledger', '# 44. Required negative tests');
  const categories = new Map();
  const regex = /##\s+([A-J])\.\s+([^\n]+)[\s\S]*?```text\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(source)) !== null) categories.set(match[1], nonEmptyLines(match[3]));
  assert.equal(categories.size, 10, 'TASKBOOK_HARD_CATEGORY_COUNT_INVALID');
  return categories;
}
function parseCompletionClaims(taskbook) {
  const source = sliceSection(taskbook, '# 45. Completion Claims Candidate', '# 46. Closure lifecycle');
  const match = source.match(/```text\s*\n([\s\S]*?MCFT_CAP_07_REMAINS_UNAUTHORIZED[\s\S]*?)```/);
  assert.ok(match, 'TASKBOOK_COMPLETION_CLAIM_BLOCK_MISSING');
  return nonEmptyLines(match[1]);
}
function assertZeroDelta(delta, label) {
  assert.ok(delta && typeof delta === 'object', `${label}_RUNTIME_DELTA_MISSING`);
  for (const key of ZERO_KEYS) assert.equal(delta[key], 0, `${label}_${key.toUpperCase()}_NONZERO`);
}
function assertPath(relativePath, code) {
  assert.equal(fs.existsSync(path.join(ROOT, relativePath)), true, `${code}:${relativePath}`);
}
function assertBoundary(value, code) {
  assert.deepEqual([...value].sort(), [...EXPECTED_FILES].sort(), code);
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S11A_BASE_REF || DEFAULT_BASE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const exactHead = git(['rev-parse', 'HEAD']);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'S11A_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S11A_PRODUCT_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S11A_FORBIDDEN_SURFACE_CHANGED');

  const taskbook = text('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');
  const taskbookHard = parseHardAcceptance(taskbook);
  const taskbookClaims = parseCompletionClaims(taskbook);
  assert.equal(taskbookClaims.length, 48, 'TASKBOOK_COMPLETION_CLAIM_COUNT_INVALID');

  const ledger = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json');
  const closure = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json');
  const verification = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json');
  const frontier = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const manifest = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
  const pMinus1 = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json');
  const p0 = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P0-STATUS.json');
  const s10 = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-EFFECTIVENESS.json');
  const frozenS10EffectivenessWorkflow = text('.github/workflows/mcft-cap-06-s10-bounded-chain-effectiveness.yml');

  assert.equal(ledger.status, 'CANDIDATE');
  assert.equal(ledger.taskbook_version, 'v0.4.0');
  assert.equal(ledger.total_check_count, 255);
  assert.deepEqual(ledger.status_counts, { PASS: 255, FAIL: 0, NOT_APPLICABLE: 0 });
  assert.equal(ledger.category_count, 10);
  assert.equal(ledger.category_records.length, 10);
  assert.equal(ledger.completion_claims_effective, false);
  assert.equal(ledger.verified, false);

  const allowedCanonicalRefs = new Set([EXPECTED_CANDIDATE_REF, EXPECTED_EVALUATION_REF]);
  let ledgerTotal = 0;
  for (const [letter, [category, count]] of Object.entries(CATEGORY_META)) {
    const recordPath = `docs/digital_twin/mcft/cap_06/hard_acceptance/MCFT-CAP-06-HARD-${letter}.json`;
    assert.equal(ledger.category_records.includes(recordPath), true, `LEDGER_CATEGORY_REF_MISSING:${letter}`);
    const record = json(recordPath);
    const taskbookAssertions = taskbookHard.get(letter);
    assert.ok(taskbookAssertions, `TASKBOOK_CATEGORY_MISSING:${letter}`);
    assert.equal(record.acceptance_id, `MCFT_CAP_06_HARD_CATEGORY_${letter}`);
    assert.equal(record.category, category);
    assert.equal(record.status, 'PASS');
    assert.equal(record.assertion_count, count);
    assert.equal(record.assertions.length, count);
    assert.equal(taskbookAssertions.length, count, `TASKBOOK_CATEGORY_COUNT_INVALID:${letter}`);
    assert.deepEqual(record.assertions, taskbookAssertions, `LEDGER_ASSERTIONS_NOT_EXACT_TASKBOOK:${letter}`);
    assert.equal(ledger.category_counts[category], count, `LEDGER_MANIFEST_COUNT_INVALID:${letter}`);
    assert.equal(Array.isArray(record.evidence_refs) && record.evidence_refs.length > 0, true, `LEDGER_EVIDENCE_REFS_REQUIRED:${letter}`);
    assert.equal(Array.isArray(record.workflow_refs) && record.workflow_refs.length > 0, true, `LEDGER_WORKFLOW_REFS_REQUIRED:${letter}`);
    assert.equal(Array.isArray(record.canonical_refs), true, `LEDGER_CANONICAL_REFS_INVALID:${letter}`);
    assert.equal(Array.isArray(record.notes) && record.notes.length > 0, true, `LEDGER_NOTES_REQUIRED:${letter}`);
    for (const ref of record.evidence_refs) assertPath(ref, `LEDGER_EVIDENCE_REF_MISSING:${letter}`);
    for (const ref of record.workflow_refs) assertPath(ref, `LEDGER_WORKFLOW_REF_MISSING:${letter}`);
    for (const ref of record.canonical_refs) assert.equal(allowedCanonicalRefs.has(ref), true, `LEDGER_CANONICAL_REF_NOT_FROZEN:${letter}:${ref}`);
    ledgerTotal += count;
  }
  assert.equal(ledgerTotal, 255, 'LEDGER_ACCUMULATED_TOTAL_INVALID');

  assert.equal(pMinus1.status, 'MERGED_EFFECTIVE');
  assert.equal(pMinus1.outcome, 'REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED');
  assert.equal(pMinus1.object_adjudication.twin_calibration_candidate_v1, 'REUSE_WITHOUT_AMENDMENT');
  assert.equal(pMinus1.object_adjudication.twin_shadow_evaluation_v1, 'REUSE_WITHOUT_AMENDMENT');
  assert.equal(pMinus1.object_adjudication.twin_model_activation_v1, 'EXPLICITLY_EXCLUDED');
  assert.equal(p0.status, 'MERGED_EFFECTIVE');
  assert.equal(p0.cap_05_terminal_reconciliation.status, 'COMPLETE');
  assert.equal(p0.cap_05_terminal_reconciliation.closure_effective, true);
  assert.equal(p0.cap_05_terminal_reconciliation.capability_complete, true);

  assert.equal(s10.status, 'MERGED_EFFECTIVE');
  assert.equal(s10.effectiveness_transition.s10_effective, true);
  assert.equal(s10.effectiveness_transition.s11a_authorized, true);
  assert.equal(s10.controlled_acceptance.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES');
  assert.equal(s10.controlled_acceptance.actual_r, 24);
  assert.equal(s10.controlled_acceptance.actual_c, 0);
  assert.equal(s10.controlled_acceptance.actual_cap06_canonical_delta, 36);
  assert.equal(s10.controlled_acceptance.candidate_parameter_value, '0.034000');
  assert.equal(s10.controlled_acceptance.effective_runtime_parameter_value, '0.030000');
  assert.equal(s10.controlled_acceptance.completed_replay_additional_fact_count, 0);
  assert.equal(s10.controlled_acceptance.completed_replay_projection_divergence_count, 0);
  assert.equal(s10.controlled_acceptance.completed_replay_evidence_load_count, 0);
  assert.equal(s10.controlled_acceptance.candidate_consumed, false);
  assert.equal(s10.controlled_acceptance.evaluation_consumed, false);
  assert.equal(s10.controlled_acceptance.model_activation_count, 0);
  assert.equal(s10.controlled_acceptance.active_config_snapshot_changed, false);
  assertZeroDelta(s10.runtime_delta, 'S10_EFFECTIVENESS');

  assert.equal(frozenS10EffectivenessWorkflow.includes('b13a0057a8c9e93f3f4fcf8194b84149f1d2b1b5'), true, 'S10_EFFECTIVENESS_FROZEN_REF_REQUIRED');
  assert.equal(frozenS10EffectivenessWorkflow.includes('dc44a9e7e248e02237ee67a054d6fdd0259a1f3f'), true, 'S10_EFFECTIVENESS_FROZEN_BASE_REQUIRED');
  assert.equal(frozenS10EffectivenessWorkflow.includes('s10_effective'), true, 'S10_EFFECTIVENESS_FREEZE_CONDITION_REQUIRED');

  assert.equal(closure.status, 'CLOSURE_CANDIDATE');
  assert.equal(closure.closure_effective, false);
  assert.equal(closure.capability_complete, false);
  assert.equal(closure.active_delivery_slice_id, S11A);
  assert.equal(closure.baseline_main_commit, DEFAULT_BASE);
  assert.equal(closure.closure_candidate_pr_number, 2585);
  assert.equal(closure.hard_acceptance.total_check_count, 255);
  assert.equal(closure.hard_acceptance.pass_count, 255);
  assert.equal(closure.hard_acceptance.fail_count, 0);
  assert.equal(closure.hard_acceptance.not_applicable_count, 0);
  assert.deepEqual(closure.pending_completion_claims, taskbookClaims, 'CLOSURE_PENDING_CLAIMS_NOT_EXACT_TASKBOOK');
  assert.equal(closure.pending_completion_claims.length, 48);
  assert.deepEqual(closure.effective_completion_claims, []);
  assert.equal(closure.finalization_evidence.s11a_exact_head_commit, null);
  assert.equal(closure.finalization_evidence.s11a_merge_commit, null);
  assert.equal(closure.finalization_evidence.s11a_head_to_merge_tree_equivalence, 'PENDING');
  assert.equal(closure.finalization_evidence.s11b_finalization_gate, 'PENDING');
  assert.equal(closure.runtime_source_authorized, false);
  assert.equal(closure.successor_authorized, false);
  assert.equal(closure.completion_claim_effective_delta, 0);
  assertBoundary(closure.exact_changed_file_boundary, 'CLOSURE_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(closure.verified, false);

  assert.equal(verification.status, 'CANDIDATE');
  assert.equal(verification.subject_main_commit, DEFAULT_BASE);
  assert.equal(verification.closure_candidate_pr_number, 2585);
  assert.deepEqual(verification.effective_predecessor_slices, ['P-1', 'P0', 'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
  assert.equal(verification.current_slice.slice_id, S11A);
  assert.equal(verification.current_slice.implementation_merged, false);
  assert.equal(verification.current_slice.merged_main_proven, false);
  assert.equal(verification.current_slice.closure_effective, false);
  assert.equal(verification.current_slice.capability_complete, false);
  assert.equal(verification.hard_acceptance.total_check_count, 255);
  assert.equal(verification.completion_claims.pending_count, 48);
  assert.equal(verification.completion_claims.effective_count, 0);
  assert.deepEqual(verification.completion_claims.effective, []);
  assert.equal(verification.finalization_evidence.s11b_finalization_gate, 'PENDING');
  assert.equal(verification.runtime_source_authorized, false);
  assert.equal(verification.successor_authorized, false);
  assertBoundary(verification.exact_changed_file_boundary, 'MAIN_VERIFICATION_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(verification.verified, false);

  assert.equal(status.status, 'CLOSURE_CANDIDATE');
  assert.equal(status.closure_candidate_pr_number, 2585);
  assert.equal(status.hard_acceptance_total_check_count, 255);
  assert.equal(status.pending_completion_claim_count, 48);
  assert.equal(status.effective_completion_claim_count, 0);
  assert.equal(status.closure_effective, false);
  assert.equal(status.capability_complete, false);
  assert.equal(status.active_delivery_slice_id, S11A);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.s11a_candidate_implemented, true);
  assert.equal(status.s11a_implementation_merged, false);
  assert.equal(status.s11a_merged_main_proven, false);
  assert.equal(status.s11b_authorized, false);
  assert.equal(status.s11c_authorized, false);
  assert.equal(status.s11d_authorized, false);
  assert.equal(status.completion_claim_activation_authorized, false);
  assert.equal(status.successor_capability_line_authorized, false);
  assertZeroDelta(status.runtime_delta, 'S11A_STATUS');

  assert.equal(frontier.status, 'S11A_CLOSURE_CANDIDATE_NOT_MERGED');
  assert.equal(frontier.active_delivery_slice_id, S11A);
  assert.equal(frontier.next_repository_action, 'VALIDATE_AND_MERGE_S11A_CLOSURE_CANDIDATE');
  assert.equal(frontier.implementation_state.s10_effective, true);
  assert.equal(frontier.implementation_state.s11a_candidate_implemented, true);
  assert.equal(frontier.implementation_state.s11a_implementation_merged, false);
  assert.equal(frontier.implementation_state.s11b_authorized, false);
  assert.equal(frontier.implementation_state.s11c_authorized, false);
  assert.equal(frontier.implementation_state.s11d_authorized, false);
  assert.equal(frontier.s11a_candidate.closure_candidate_pr_number, 2585);
  assert.equal(frontier.s11a_candidate.hard_acceptance_total_check_count, 255);
  assert.equal(frontier.s11a_candidate.pending_completion_claim_count, 48);
  assert.equal(frontier.s11a_candidate.effective_completion_claim_count, 0);
  assert.equal(frontier.s11a_candidate.closure_effective, false);
  assert.equal(frontier.s11a_candidate.capability_complete, false);
  assert.equal(frontier.s11a_candidate.runtime_source_authorized, false);
  assert.equal(frontier.completed_action_is_new_prerequisite, false);
  assert.equal(frontier.completed_action_is_new_slice, false);
  assertZeroDelta(frontier.runtime_delta, 'CURRENT_FRONTIER');
  assert.equal(frontier.successor_capability_line_authorized, false);

  assert.equal(manifest.effective_taskbook_version, 'v0.4.0');
  assert.equal(manifest.execution_control.active_delivery_slice_id, S11A);
  assert.equal(manifest.execution_control.completed_action, 'S11A_CLOSURE_CANDIDATE_MATERIALIZATION');
  assert.equal(manifest.execution_control.next_action, 'VALIDATE_AND_MERGE_S11A_CLOSURE_CANDIDATE');
  assert.equal(manifest.s10_effective, true);
  assert.equal(manifest.s11a.authorized, true);
  assert.equal(manifest.s11a.candidate_implemented, true);
  assert.equal(manifest.s11a.implementation_merged, false);
  assert.equal(manifest.s11a.merged_main_proven, false);
  assert.equal(manifest.s11a.closure_candidate_pr_number, 2585);
  assert.equal(manifest.s11a.hard_acceptance_total_check_count, 255);
  assert.equal(manifest.s11a.pending_completion_claim_count, 48);
  assert.equal(manifest.s11a.effective_completion_claim_count, 0);
  assert.equal(manifest.s11a.closure_effective, false);
  assert.equal(manifest.s11a.capability_complete, false);
  assert.equal(manifest.s11b_authorized, false);
  assert.equal(manifest.s11c_authorized, false);
  assert.equal(manifest.s11d_authorized, false);
  assert.equal(manifest.successor_capability_line_authorized, false);
  assert.equal(manifest.normative_slice_graph.includes(S11A), true);
  assert.equal(manifest.normative_slice_graph.includes(S11B), true);

  const result = {
    schema_version: 'geox_mcft_cap_06_s11a_closure_result_v1',
    status: 'PASS',
    baseline,
    exact_head: exactHead,
    changed_files: changed,
    changed_file_count: changed.length,
    taskbook_version: manifest.effective_taskbook_version,
    hard_acceptance_category_count: ledger.category_count,
    hard_acceptance_total_check_count: ledgerTotal,
    hard_acceptance_pass_count: ledger.status_counts.PASS,
    hard_acceptance_fail_count: ledger.status_counts.FAIL,
    hard_acceptance_not_applicable_count: ledger.status_counts.NOT_APPLICABLE,
    pending_completion_claim_count: closure.pending_completion_claims.length,
    effective_completion_claim_count: closure.effective_completion_claims.length,
    closure_status: closure.status,
    closure_effective: closure.closure_effective,
    capability_complete: closure.capability_complete,
    active_delivery_slice_id: frontier.active_delivery_slice_id,
    s11b_authorized: status.s11b_authorized,
    s11c_authorized: status.s11c_authorized,
    s11d_authorized: status.s11d_authorized,
    runtime_source_authorized: status.runtime_source_authorized,
    successor_capability_line_authorized: status.successor_capability_line_authorized,
    runtime_delta: status.runtime_delta,
    new_prerequisite_inserted: status.new_prerequisite_inserted,
    new_slice_inserted: status.new_slice_inserted,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  const failure = {
    schema_version: 'geox_mcft_cap_06_s11a_closure_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    closure_effective: false,
    capability_complete: false,
    s11b_authorized: false,
    s11c_authorized: false,
    s11d_authorized: false,
    successor_capability_line_authorized: false,
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
