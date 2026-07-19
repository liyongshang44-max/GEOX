#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = 'docs/digital_twin/mcft/cap_06';
const SLICE = 'MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1';
const BASE = 'f889db7d336661f85198f4b377bc07cc00da4dc0';
const NEXT = 'S11D_REPAIR_MERGED_MAIN_PROOF';
const ZERO = Object.freeze({
  canonical_fact_append_count: 0,
  canonical_fact_update_count: 0,
  canonical_fact_delete_count: 0,
  candidate_append_count: 0,
  evaluation_append_count: 0,
  projection_write_count: 0,
  model_activation_count: 0,
  active_config_switch_count: 0,
  runtime_parameter_change_count: 0,
  state_mutation_count: 0,
  checkpoint_mutation_count: 0,
  migration_count: 0,
});

const FILES = Object.freeze({
  closure: `${DIR}/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json`,
  frontier: `${DIR}/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json`,
  finalization: `${DIR}/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json`,
  reconciliation: `${DIR}/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json`,
  verification: `${DIR}/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json`,
  s11a: `${DIR}/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json`,
  s11c: `${DIR}/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json`,
  s11d: `${DIR}/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json`,
  manifest: `${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`,
  repair: `${DIR}/GEOX-MCFT-CAP-06-S11D-CLOSURE-REPAIR-STATUS.json`,
});

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function write(relativePath, value) {
  fs.writeFileSync(path.join(ROOT, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function claims() {
  const task = fs.readFileSync(path.join(ROOT, DIR, 'GEOX-MCFT-CAP-06-TASK.md'), 'utf8');
  const start = task.indexOf('# 45. Completion Claims Candidate');
  const end = task.indexOf('# 46. Closure lifecycle', start);
  const match = task.slice(start, end).match(/```text\s*\n([\s\S]*?MCFT_CAP_07_REMAINS_UNAUTHORIZED[\s\S]*?)```/);
  if (!match) throw new Error('TASKBOOK_COMPLETION_CLAIMS_MISSING');
  const values = match[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (values.length !== 48) throw new Error(`TASKBOOK_COMPLETION_CLAIM_COUNT_INVALID:${values.length}`);
  return values;
}

function suspendProjection(value, pendingClaims) {
  return {
    ...value,
    hard_acceptance_total_check_count: 255,
    hard_acceptance_pass_count: 253,
    hard_acceptance_fail_count: 2,
    hard_acceptance_not_applicable_count: 0,
    pending_completion_claim_count: 48,
    effective_completion_claim_count: 0,
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    runtime_source_authorized: false,
    completion_claim_activation_authorized: false,
    successor_capability_line_authorized: false,
    repair_classification: 'IMPLEMENTATION_DEFECT',
    repair_scope: 'S11D_FINAL_EFFECTIVENESS_RECONCILIATION_REPAIR',
    new_capability_slice: false,
    pending_completion_claims: pendingClaims,
    effective_completion_claims: [],
    runtime_delta: { ...ZERO },
  };
}

function main() {
  const pendingClaims = claims();
  const ledger = read(`${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`);
  if (ledger.total_check_count !== 255 || ledger.status_counts.PASS !== 253 || ledger.status_counts.FAIL !== 2) {
    throw new Error('ITEM_LEDGER_REPAIR_STATE_INVALID');
  }

  const closure = read(FILES.closure);
  write(FILES.closure, {
    ...closure,
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
    implementation_status: 'COMPLETE',
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    baseline_main_commit: BASE,
    repair_branch: 'agent/mcft-cap-06-s11d-closure-repair-candidate',
    repair_pr_number: null,
    repair_classification: 'IMPLEMENTATION_DEFECT',
    repair_scope: 'S11D_FINAL_EFFECTIVENESS_RECONCILIATION_REPAIR',
    new_capability_slice: false,
    task_order_changed: false,
    hard_acceptance: {
      ledger_ref: `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`,
      total_check_count: 255,
      pass_count: 253,
      fail_count: 2,
      not_applicable_count: 0,
      accumulated_evidence_status: 'REPAIR_CANDIDATE_POSTMERGE_PROOF_PENDING',
      failed_acceptance_ids: ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'],
    },
    pending_completion_claims: pendingClaims,
    effective_completion_claims: [],
    completion_claim_activation_condition: 'REPAIRED_ITEM_LEDGER_ALL_PASS_AND_S11D_REPAIR_MERGED_MAIN_PROOF_PASS',
    completion_claim_effective_delta: 0,
    completion_claim_suspension_delta: 48,
    runtime_source_authorized: false,
    successor_authorized: false,
    reconciliation_record_state: 'REPAIR_CANDIDATE_REQUIRES_MERGED_MAIN_PROOF',
    repair_postmerge_proof_required: true,
    final_postmerge_proof_required: true,
    final_postmerge_proof_writeback_forbidden: true,
    unknown_repair_merge_or_postmerge_evidence_recorded: false,
    runtime_delta: { ...ZERO },
    verified_preconditions: true,
  });

  const frontier = read(FILES.frontier);
  write(FILES.frontier, {
    ...frontier,
    status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
    execution_paused: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    next_repository_action_kind: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_PROOF',
    next_repository_action_is_capability_slice: false,
    new_prerequisite_inserted: false,
    implementation_state: {
      ...frontier.implementation_state,
      s11d_reconciliation_materialized: true,
      s11d_closure_repair_required: true,
      s11d_closure_repair_candidate_materialized: true,
      s11d_closure_repair_merged_main_proven: false,
    },
    terminal_state: {
      status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
      implementation_status: 'COMPLETE',
      closure_effective: false,
      capability_complete: false,
      pending_completion_claim_count: 48,
      effective_completion_claim_count: 0,
      runtime_source_authorized: false,
      successor_capability_line_id: 'MCFT-CAP-07',
      successor_authorized: false,
    },
    completed_action: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE_MATERIALIZATION',
    completed_action_is_new_prerequisite: false,
    completed_action_is_new_slice: false,
    runtime_delta: { ...ZERO },
    successor_capability_line_authorized: false,
  });

  const verification = read(FILES.verification);
  write(FILES.verification, {
    ...verification,
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
    implementation_status: 'COMPLETE',
    subject_predecessor_main_commit: BASE,
    current_slice: {
      slice_id: SLICE,
      status: 'IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
      implementation_started: true,
      candidate_implemented: true,
      terminal_state_materialized: false,
      effective_on_merge: false,
      merged_main_proof_required: true,
    },
    hard_acceptance: {
      ledger_ref: `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`,
      total_check_count: 255,
      category_count: 10,
      pass_count: 253,
      fail_count: 2,
      not_applicable_count: 0,
      status: 'REPAIR_CANDIDATE',
      failed_acceptance_ids: ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'],
    },
    completion_claims: {
      pending_count: 48,
      effective_count: 0,
      pending: pendingClaims,
      effective: [],
      activation_condition: 'REPAIRED_ITEM_LEDGER_ALL_PASS_AND_S11D_REPAIR_MERGED_MAIN_PROOF_PASS',
    },
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    runtime_source_authorized: false,
    successor_authorized: false,
    repair_postmerge_proof_required: true,
    final_postmerge_proof_required: true,
    final_postmerge_proof_writeback_forbidden: true,
    unknown_repair_merge_or_postmerge_evidence_recorded: false,
    verified_preconditions: true,
  });

  const finalization = read(FILES.finalization);
  write(FILES.finalization, {
    ...finalization,
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    status: 'CLOSURE_REPAIR_REQUIRED',
    implementation_status: 'COMPLETE',
    baseline_main_commit: BASE,
    effectiveness_preconditions_satisfied: false,
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    pending_completion_claims: pendingClaims,
    effective_completion_claims: { count: 0, values: [] },
    completion_claim_effective_delta: 0,
    completion_claim_suspension_delta: 48,
    runtime_source_authorized: false,
    successor_authorized: false,
    reconciliation_record_state: 'REPAIR_CANDIDATE_REQUIRES_MERGED_MAIN_PROOF',
    repair_postmerge_proof_required: true,
    unknown_repair_merge_or_postmerge_evidence_recorded: false,
    runtime_delta: { ...ZERO },
  });

  const reconciliation = read(FILES.reconciliation);
  write(FILES.reconciliation, {
    ...reconciliation,
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    record_state: 'REPAIR_CANDIDATE_REQUIRES_MERGED_MAIN_PROOF',
    status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
    implementation_status: 'COMPLETE',
    baseline_main_commit: BASE,
    branch: 'agent/mcft-cap-06-s11d-closure-repair-candidate',
    pr_number: null,
    capability_status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    pending_completion_claim_count: 48,
    effective_completion_claim_count: 0,
    pending_completion_claims: pendingClaims,
    effective_completion_claims: { count: 0, values: [] },
    runtime_source_authorized: false,
    successor_authorized: false,
    hard_acceptance: { total_check_count: 255, pass_count: 253, fail_count: 2, not_applicable_count: 0 },
    effectiveness_condition: 'REPAIRED_ITEM_LEDGER_ALL_PASS_AND_S11D_REPAIR_MERGED_MAIN_PROOF_PASS',
    effectiveness_preconditions_satisfied: false,
    terminal_state_effective_on_merge: false,
    repair_postmerge_probe_required: true,
    repair_postmerge_probe_disposition: 'CLOSE_WITHOUT_MERGE',
    postmerge_ssot_writeback_allowed: false,
    unknown_repair_merge_or_postmerge_evidence_recorded: false,
    completion_claim_effective_delta: 0,
    completion_claim_suspension_delta: 48,
    runtime_delta: { ...ZERO },
  });

  write(FILES.s11a, suspendProjection(read(FILES.s11a), pendingClaims));
  write(FILES.s11c, suspendProjection(read(FILES.s11c), pendingClaims));
  write(FILES.s11d, {
    ...suspendProjection(read(FILES.s11d), pendingClaims),
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    status: 'IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    implementation_status: 'COMPLETE',
    baseline_main_commit: BASE,
    repair_pr_number: null,
    repair_branch: 'agent/mcft-cap-06-s11d-closure-repair-candidate',
    hard_acceptance_total_check_count: 255,
    hard_acceptance_pass_count: 253,
    hard_acceptance_fail_count: 2,
    hard_acceptance_not_applicable_count: 0,
    s11d_closure_repair_required: true,
    s11d_closure_repair_candidate_implemented: true,
    s11d_closure_repair_merged_main_proven: false,
    terminal_state_materialized: false,
    terminal_state_effective_on_merge: false,
    repair_postmerge_proof_required: true,
    unknown_repair_merge_or_postmerge_evidence_recorded: false,
  });

  const manifest = read(FILES.manifest);
  write(FILES.manifest, {
    ...manifest,
    execution_control: {
      ...manifest.execution_control,
      execution_paused: false,
      active_delivery_slice_id: SLICE,
      new_prerequisite_inserted: false,
      completed_action: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE_MATERIALIZATION',
      completed_action_is_capability_prerequisite: false,
      completed_action_is_new_slice: false,
      next_action: NEXT,
      next_action_is_existing_taskbook_slice: true,
    },
    s11d: {
      ...manifest.s11d,
      authorized: true,
      implementation_started: true,
      reconciliation_materialized: true,
      closure_repair_required: true,
      closure_repair_candidate_materialized: true,
      closure_repair_merged_main_proven: false,
      terminal_state_effective_on_merge: false,
      repair_postmerge_proof_required: true,
      postmerge_writeback_forbidden: true,
    },
    terminal_state: {
      status: 'IMPLEMENTATION_COMPLETE_CLOSURE_REPAIR_REQUIRED',
      implementation_status: 'COMPLETE',
      closure_effective: false,
      capability_complete: false,
      pending_completion_claim_count: 48,
      effective_completion_claim_count: 0,
      active_delivery_slice_id: SLICE,
      next_repository_action: NEXT,
      runtime_source_authorized: false,
      successor_capability_line_authorized: false,
    },
    successor_capability_line_authorized: false,
  });

  write(FILES.repair, {
    schema_version: 'geox_mcft_cap_06_s11d_closure_repair_status_v1',
    capability_line_id: 'MCFT-CAP-06',
    delivery_slice_id: SLICE,
    taskbook_version: 'v0.4.0',
    lifecycle_stage: 'S11D_IMPLEMENTATION_DEFECT_REPAIR_CANDIDATE',
    status: 'REPAIR_CANDIDATE',
    repair_classification: 'IMPLEMENTATION_DEFECT',
    defect_ids: ['MCFT_CAP_06_DEFECT_REQUIRED_DELIVERABLE_PATHS', 'MCFT_CAP_06_DEFECT_HARD_ACCEPTANCE_ITEMIZATION'],
    baseline_main_commit: BASE,
    new_capability_slice: false,
    task_order_changed: false,
    new_prerequisite_inserted: false,
    required_deliverables_manifest_ref: `${DIR}/GEOX-MCFT-CAP-06-REQUIRED-DELIVERABLES-MANIFEST.json`,
    hard_acceptance_ledger_ref: `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`,
    hard_acceptance: {
      total_check_count: 255,
      pass_count: 253,
      fail_count: 2,
      not_applicable_count: 0,
      failed_acceptance_ids: ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'],
    },
    pending_completion_claim_count: 48,
    effective_completion_claim_count: 0,
    closure_effective: false,
    capability_complete: false,
    active_delivery_slice_id: SLICE,
    next_repository_action: NEXT,
    runtime_source_authorized: false,
    successor_capability_line_authorized: false,
    repair_postmerge_proof_required: true,
    final_repair_reconciliation_required: true,
    postmerge_ssot_writeback_allowed: false,
    runtime_delta: { ...ZERO },
  });

  process.stdout.write(`${JSON.stringify({ status: 'PASS', files: Object.values(FILES), pending_completion_claim_count: 48, hard_acceptance: ledger.status_counts }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
