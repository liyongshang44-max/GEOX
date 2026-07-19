#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = 'docs/digital_twin/mcft/cap_06';
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S11D_REPAIRED_FINAL_CANDIDATE_V2_RESULT.json');
const BASELINE = 'f889db7d336661f85198f4b377bc07cc00da4dc0';
const RESOLVED = `${DIR}/GEOX-MCFT-CAP-06-RESOLVED-TASK-MANIFEST-V2.json`;
const LEDGER = `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`;
const CONDITION = 'EXACT_MERGE_SHA_ATTESTATION_PASS';
const ATTESTATION_WORKFLOW = '.github/workflows/mcft-cap-06-s11d-repair-merged-main-attestation.yml';
const ATTESTATION_GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11D_REPAIR_MERGED_MAIN_ATTESTATION.cjs';
const PENDING_IDS = ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'];
const ZERO_KEYS = [
  'canonical_fact_append_count', 'canonical_fact_update_count', 'canonical_fact_delete_count',
  'candidate_append_count', 'evaluation_append_count', 'projection_write_count',
  'model_activation_count', 'active_config_switch_count', 'runtime_parameter_change_count',
  'state_mutation_count', 'checkpoint_mutation_count', 'migration_count',
];
const REQUIRED_ITEM_FIELDS = [
  'acceptance_id', 'category', 'assertion', 'lifecycle_phase', 'status', 'predicate',
  'evidence_refs', 'workflow_refs', 'subject_commit', 'canonical_refs', 'notes',
];
const HISTORICAL_WORKFLOWS = [
  '.github/workflows/mcft-cap-06-s3-focused-validation.yml',
  '.github/workflows/mcft-cap-06-s3-effectiveness-s4-insertion.yml',
  '.github/workflows/mcft-cap-06-s4-focused-validation.yml',
  '.github/workflows/mcft-cap-06-s4-effectiveness-s5-authorization.yml',
  '.github/workflows/mcft-cap-06-s5-entry-controls.yml',
  '.github/workflows/mcft-cap-06-s5-predecessor-graph-conformance.yml',
  '.github/workflows/mcft-cap-06-s5-candidate.yml',
  '.github/workflows/mcft-cap-06-s5-candidate-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s6-paired-shadow.yml',
  '.github/workflows/mcft-cap-06-s6-paired-shadow-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation.yml',
  '.github/workflows/mcft-cap-06-s7-shadow-evaluation-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild.yml',
  '.github/workflows/mcft-cap-06-s8-restart-readback-rebuild-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s9-non-consumption.yml',
  '.github/workflows/mcft-cap-06-s9-non-consumption-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s10-bounded-chain.yml',
  '.github/workflows/mcft-cap-06-s10-bounded-chain-effectiveness.yml',
  '.github/workflows/mcft-cap-06-taskbook-v0-4-effectiveness.yml',
  '.github/workflows/mcft-cap-06-s11a-closure-candidate.yml',
  '.github/workflows/mcft-cap-06-s11c-capability-completion-effectiveness-activation.yml',
  '.github/workflows/mcft-cap-06-s11d-final-effectiveness-reconciliation.yml',
];
const LEGACY_FRONTIERS = [
  `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json`,
  `${DIR}/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json`,
];
const CURRENT_PROJECTIONS = [
  `${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`,
  `${DIR}/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`,
  `${DIR}/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json`,
  `${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`,
  `${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`,
  `${DIR}/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json`,
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/', 'apps/server/scripts/', 'apps/server/db/migrations/',
  'apps/web/', 'fixtures/', 'docker/',
];

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function text(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }
function json(relativePath) { return JSON.parse(text(relativePath)); }
function exists(relativePath) { return fs.existsSync(path.join(ROOT, relativePath)); }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function sorted(values) { return [...values].sort(); }
function write(value) {
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function assertZero(delta, label) {
  assert.ok(delta && typeof delta === 'object', `${label}_RUNTIME_DELTA_MISSING`);
  for (const key of ZERO_KEYS) assert.equal(delta[key], 0, `${label}_${key.toUpperCase()}_NONZERO`);
}
function assertAttestationContract(value, label) {
  assert.equal(value.proof_only_pr_required, false, `${label}_PROOF_ONLY_PR_REQUIRED`);
  assert.equal(value.repair_merge_sha_attestation_required, true, `${label}_MERGE_SHA_ATTESTATION_NOT_REQUIRED`);
  assert.equal(value.repair_merge_sha_attestation_workflow_ref, ATTESTATION_WORKFLOW, `${label}_ATTESTATION_WORKFLOW_INVALID`);
  assert.equal(value.postmerge_ssot_writeback_allowed, false, `${label}_POSTMERGE_WRITEBACK_ALLOWED`);
  assert.equal(value.closure_effectiveness_condition, CONDITION, `${label}_EFFECTIVENESS_CONDITION_INVALID`);
}
function assertHistoricalWorkflow(relativePath) {
  const workflow = text(relativePath);
  assert.equal(
    workflow.includes('# Historical MCFT-CAP-06 workflow: automatic triggers frozen after final repair.'),
    true,
    `HISTORICAL_WORKFLOW_MARKER_MISSING:${relativePath}`,
  );
  assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:\s*$/m, `HISTORICAL_WORKFLOW_NOT_MANUAL_ONLY:${relativePath}`);
  assert.equal(/^\s*(pull_request|push|merge_group):/m.test(workflow), false, `HISTORICAL_WORKFLOW_AUTOMATIC_TRIGGER_REMAINS:${relativePath}`);
}

function main() {
  git(['cat-file', '-e', `${BASELINE}^{commit}`]);
  const exactHead = git(['rev-parse', 'HEAD']);
  const changedRaw = git(['diff', '--name-only', `${BASELINE}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'PRODUCT_RUNTIME_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'FORBIDDEN_RUNTIME_SURFACE_CHANGED');

  const entry = text(`${DIR}/GEOX-MCFT-CAP-06-TASK.md`);
  assert.equal(entry.includes(`resolved_manifest_ref: ${RESOLVED}`), true, 'TASK_ENTRY_RESOLVED_MANIFEST_REF_MISSING');
  assert.equal(entry.includes('# 43. Hard Acceptance evidence ledger'), false, 'TASK_ENTRY_CONTAINS_HISTORICAL_BODY');
  assert.equal(exists(`${DIR}/GEOX-MCFT-CAP-06-TASK-v0.3.1.md`), true, 'HISTORICAL_TASKBOOK_MISSING');

  const resolved = json(RESOLVED);
  assert.equal(resolved.schema_version, 'geox_mcft_cap_06_resolved_task_manifest_v2');
  assert.equal(resolved.record_status, 'EFFECTIVE_RESOLVED_AUTHORITY');
  assert.equal(resolved.resolution_policy.direct_historical_task_parsing_forbidden, true);
  assert.equal(resolved.resolution_policy.closure_gates_must_consume_resolved_manifest, true);
  assert.equal(resolved.resolved_slice_graph.length, 17);
  for (const slice of resolved.resolved_slice_graph) {
    for (const key of ['inputs','outputs','canonical_writes','consumer','successor_probe','authority_graph_refs','entry_conditions','exit_conditions','nonclaims']) {
      assert.equal(Object.hasOwn(slice, key), true, `RESOLVED_SLICE_FIELD_MISSING:${slice.short_id}:${key}`);
    }
  }
  assert.equal(resolved.completion_claims.claim_ids.length, 48);
  assert.equal(resolved.completion_claims.pending_count, 0);
  assert.equal(resolved.completion_claims.effective_count, 48);
  assert.equal(resolved.completion_claims.activation_condition, CONDITION);
  assert.equal(resolved.capability_result_boundary.repository_history_calibration_capability, 'NOT_ESTABLISHED');
  assert.equal(resolved.capability_result_boundary.production_runtime_capability, 'NOT_ESTABLISHED');
  assert.equal(resolved.s10_composition_boundary.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES');
  assert.equal(resolved.s10_composition_boundary.controlled_stage_database_count, 2);
  assert.equal(resolved.closure_delivery_policy.proof_only_pr_required, false);
  assert.equal(resolved.closure_delivery_policy.exact_merge_sha_attestation_required, true);
  assert.deepEqual(resolved.closure_delivery_policy.attestation_triggers, ['merge_group', 'push:main']);
  assert.equal(resolved.closure_delivery_policy.attestation_workflow_ref, ATTESTATION_WORKFLOW);
  assert.equal(resolved.closure_delivery_policy.attestation_gate_ref, ATTESTATION_GATE);
  assert.equal(resolved.closure_delivery_policy.postmerge_ssot_writeback_allowed, false);

  const taskbook = json(`${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`);
  assert.equal(taskbook.schema_version, 'geox_mcft_cap_06_taskbook_manifest_v2');
  assert.equal(taskbook.resolved_manifest_ref, RESOLVED);
  assert.equal(taskbook.direct_legacy_task_parsing_forbidden, true);
  assert.equal(taskbook.closure_gates_must_consume_resolved_manifest, true);
  assert.equal(taskbook.execution_control.active_delivery_slice_id, null);
  assert.equal(taskbook.execution_control.next_action, null);
  assert.equal(taskbook.terminal_state.closure_effective, true);
  assert.equal(taskbook.terminal_state.capability_complete, true);
  assert.equal(taskbook.terminal_state.effectiveness_condition, CONDITION);
  assert.equal(taskbook.successor_capability_line_authorized, false);

  for (const legacyPath of LEGACY_FRONTIERS) {
    const legacy = json(legacyPath);
    assert.equal(legacy.record_status, 'HISTORICAL_SUPERSEDED_FOR_CURRENT_FRONTIER', `LEGACY_RECORD_STATUS_INVALID:${legacyPath}`);
    assert.equal(legacy.historical_snapshot, true, `LEGACY_HISTORICAL_FLAG_INVALID:${legacyPath}`);
    assert.equal(legacy.current_frontier_authority, false, `LEGACY_AUTHORITY_FLAG_INVALID:${legacyPath}`);
    assert.equal(legacy.superseded_by, `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`, `LEGACY_SUPERSEDED_BY_INVALID:${legacyPath}`);
  }

  const deliverables = json(`${DIR}/GEOX-MCFT-CAP-06-REQUIRED-DELIVERABLES-MANIFEST.json`);
  assert.equal(deliverables.required_deliverable_count, 13);
  assert.equal(deliverables.runtime_acceptance_count, 12);
  assert.equal(deliverables.governance_acceptance_count, 1);
  for (const deliverable of deliverables.deliverables) {
    assert.equal(exists(deliverable.required_path), true, `REQUIRED_DELIVERABLE_MISSING:${deliverable.required_path}`);
    assert.equal(exists(deliverable.implementation_authority), true, `DELIVERABLE_AUTHORITY_MISSING:${deliverable.implementation_authority}`);
    assert.equal(deliverable.mode, 'COMPATIBILITY_WRAPPER');
    assert.equal(deliverable.exit_code_propagation, true);
    assert.equal(deliverable.independent_pass_logic, false);
  }

  const ledger = json(LEDGER);
  assert.equal(ledger.schema_version, 'geox_mcft_cap_06_hard_acceptance_item_ledger_v3');
  assert.equal(ledger.status, 'FINAL_CANDIDATE_AWAITING_EXACT_MERGE_SHA_ATTESTATION');
  assert.equal(ledger.item_shape_inheritance, 'FORBIDDEN');
  assert.equal(ledger.each_item_self_contained, true);
  assert.deepEqual(ledger.status_domain, ['PASS', 'FAIL', 'PENDING', 'NOT_APPLICABLE']);
  assert.deepEqual(ledger.status_counts, { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  assert.deepEqual(ledger.effective_status_counts_on_attestation, { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 });
  assert.equal(ledger.completion_claims_effective, true);
  assert.equal(ledger.completion_claims_effective_condition, CONDITION);
  assert.equal(ledger.verified, false);
  assert.equal(ledger.attestation_contract.attestation_workflow_ref, ATTESTATION_WORKFLOW);
  assert.equal(ledger.attestation_contract.postmerge_ssot_writeback_allowed, false);

  const ids = new Set();
  const counts = { PASS: 0, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 };
  const pendingIds = [];
  for (const recordPath of ledger.category_records) {
    const raw = text(recordPath);
    assert.equal(ledger.category_record_digests[recordPath], sha256(raw), `LEDGER_CATEGORY_DIGEST_INVALID:${recordPath}`);
    const record = JSON.parse(raw);
    for (const item of record.items) {
      assert.equal(ids.has(item.acceptance_id), false, `LEDGER_ITEM_ID_DUPLICATE:${item.acceptance_id}`);
      ids.add(item.acceptance_id);
      for (const field of REQUIRED_ITEM_FIELDS) assert.equal(Object.hasOwn(item, field), true, `LEDGER_ITEM_FIELD_MISSING:${item.acceptance_id}:${field}`);
      assert.equal(item.predicate.statement, item.assertion, `LEDGER_ITEM_PREDICATE_MISMATCH:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.evidence_refs) && item.evidence_refs.length > 0, true, `LEDGER_ITEM_EVIDENCE_MISSING:${item.acceptance_id}`);
      assert.equal(Array.isArray(item.workflow_refs) && item.workflow_refs.length > 0, true, `LEDGER_ITEM_WORKFLOW_MISSING:${item.acceptance_id}`);
      if (item.status === 'PENDING') {
        assert.equal(item.predicate.type, 'MERGE_SHA_ATTESTATION');
        assert.equal(item.predicate.resolution_authority, ATTESTATION_GATE);
        assert.equal(item.subject_commit, null);
        pendingIds.push(item.acceptance_id);
      } else {
        assert.equal(item.status, 'PASS', `LEDGER_ITEM_NOT_PASS_OR_PENDING:${item.acceptance_id}`);
        assert.equal(item.predicate.type, 'EVIDENCE_BOUND_ASSERTION');
      }
      counts[item.status] += 1;
    }
  }
  assert.equal(ids.size, 255);
  assert.deepEqual(counts, ledger.status_counts);
  assert.deepEqual(sorted(pendingIds), sorted(PENDING_IDS));

  const claims = resolved.completion_claims.claim_ids;
  for (const projectionPath of CURRENT_PROJECTIONS) {
    const value = json(projectionPath);
    const label = path.basename(projectionPath).replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    assert.equal(value.resolved_task_manifest_ref, RESOLVED, `${label}_RESOLVED_MANIFEST_REF_INVALID`);
    assert.equal(value.closure_effective, true, `${label}_CLOSURE_EFFECTIVE_INVALID`);
    assert.equal(value.capability_complete, true, `${label}_CAPABILITY_COMPLETE_INVALID`);
    assert.equal(value.active_delivery_slice_id, null, `${label}_ACTIVE_SLICE_NOT_NULL`);
    assert.equal(value.next_repository_action, null, `${label}_NEXT_ACTION_NOT_NULL`);
    assert.equal(value.runtime_source_authorized, false, `${label}_RUNTIME_AUTHORITY_INVALID`);
    assertAttestationContract(value, label);
    assert.equal(value.s10_composition_boundary.storage_mode, 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES', `${label}_S10_BOUNDARY_INVALID`);
    assertZero(value.runtime_delta, label);
  }

  const closure = json(`${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`);
  assert.equal(closure.status, 'COMPLETE');
  assert.deepEqual(closure.pending_completion_claims, []);
  assert.deepEqual(closure.effective_completion_claims, claims);
  assert.deepEqual(closure.hard_acceptance_effective_projection.committed_status_counts, { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  assert.deepEqual(closure.hard_acceptance_effective_projection.effective_status_counts_on_attestation, { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 });

  const frontier = json(`${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`);
  assert.equal(frontier.status, 'MCFT_CAP_06_COMPLETE');
  assert.equal(frontier.active_delivery_slice_id, null);
  assert.equal(frontier.next_repository_action, null);
  assert.equal(frontier.runtime_source_authorized, false);
  assert.equal(frontier.successor_capability_line_authorized, false);
  assert.equal(frontier.terminal_state.closure_effective, true);
  assert.equal(frontier.terminal_state.capability_complete, true);
  assert.equal(frontier.terminal_state.effectiveness_condition, CONDITION);
  assertZero(frontier.runtime_delta, 'FRONTIER');

  const quality = json(`${DIR}/GEOX-MCFT-CAP-06-QUALITY-BOUNDARY.json`);
  assert.equal(quality.technical_capability, 'COMPLETE');
  assert.equal(quality.repository_history_calibration_capability, 'NOT_ESTABLISHED');
  assert.equal(quality.production_runtime_capability, 'NOT_ESTABLISHED');
  assert.equal(quality.s10_interpretation, 'TWO_STAGE_CONTROLLED_END_TO_END_COMPOSITION_PROOF');
  assert.equal(quality.proof_only_pr_required, false);
  assert.equal(quality.exact_merge_sha_attestation_required, true);
  assert.equal(quality.successor_capability_line_authorized, false);

  for (const workflowPath of HISTORICAL_WORKFLOWS) assertHistoricalWorkflow(workflowPath);
  const attestationWorkflow = text(ATTESTATION_WORKFLOW);
  assert.match(attestationWorkflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.equal(attestationWorkflow.includes('persist-credentials: false'), true);
  assert.equal(attestationWorkflow.includes('push:'), true);
  assert.equal(attestationWorkflow.includes('merge_group:'), true);
  assert.equal(/contents:\s*write/.test(attestationWorkflow), false);
  assert.equal(exists(ATTESTATION_GATE), true, 'ATTESTATION_GATE_MISSING');

  const result = {
    schema_version: 'geox_mcft_cap_06_s11d_repaired_final_candidate_v2_result_v1',
    status: 'PASS',
    baseline: BASELINE,
    exact_head: exactHead,
    changed_file_count: changed.length,
    changed_files: changed,
    resolved_task_manifest_ref: RESOLVED,
    resolved_slice_count: 17,
    required_deliverable_count: 13,
    committed_hard_acceptance_status_counts: ledger.status_counts,
    effective_hard_acceptance_status_counts_on_attestation: ledger.effective_status_counts_on_attestation,
    pending_acceptance_ids: PENDING_IDS,
    pending_completion_claim_count: 0,
    effective_completion_claim_count: 48,
    closure_effective: true,
    capability_complete: true,
    closure_effectiveness_condition: CONDITION,
    active_delivery_slice_id: null,
    next_repository_action: null,
    proof_only_pr_required: false,
    exact_merge_sha_attestation_required: true,
    historical_workflow_count: HISTORICAL_WORKFLOWS.length,
    historical_workflows_manual_only: true,
    runtime_source_authorized: false,
    successor_capability_line_authorized: false,
    s10_composition_boundary: resolved.s10_composition_boundary,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s11d_repaired_final_candidate_v2_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
