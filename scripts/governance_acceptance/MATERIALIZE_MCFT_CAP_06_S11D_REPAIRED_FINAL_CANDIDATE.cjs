#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = 'docs/digital_twin/mcft/cap_06';
const RESOLVED = `${DIR}/GEOX-MCFT-CAP-06-RESOLVED-TASK-MANIFEST-V2.json`;
const LEDGER = `${DIR}/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json`;
const WORKFLOW = '.github/workflows/mcft-cap-06-s11d-repair-merged-main-attestation.yml';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S11D_REPAIR_MERGED_MAIN_ATTESTATION.cjs';
const CONDITION = 'EXACT_MERGE_SHA_ATTESTATION_PASS';
const PENDING_IDS = ['MCFT_CAP_06_HARD_J_016', 'MCFT_CAP_06_HARD_J_017'];
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
  repair: `${DIR}/GEOX-MCFT-CAP-06-S11D-CLOSURE-REPAIR-STATUS.json`,
  manifest: `${DIR}/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json`,
  quality: `${DIR}/GEOX-MCFT-CAP-06-QUALITY-BOUNDARY.json`,
});

function absolute(relativePath) { return path.join(ROOT, relativePath); }
function read(relativePath) { return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8')); }
function write(relativePath, value) { fs.writeFileSync(absolute(relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }

function attestationContract() {
  return {
    effectiveness_condition: CONDITION,
    exact_merge_sha_attestation_required: true,
    attestation_workflow_ref: WORKFLOW,
    attestation_gate_ref: GATE,
    attestation_triggers: ['merge_group', 'push:main'],
    proof_only_pr_required: false,
    immutable_artifact_required: true,
    repository_write_permission: false,
    postmerge_ssot_writeback_allowed: false,
  };
}

function hardAcceptanceProjection() {
  return {
    ledger_ref: LEDGER,
    committed_status_counts: { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 },
    pending_acceptance_ids: PENDING_IDS,
    effective_status_counts_on_attestation: { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 },
    effective_condition: CONDITION,
  };
}

function baseProjection(value, claims) {
  const result = {
    ...value,
    resolved_task_manifest_ref: RESOLVED,
    lifecycle_stage: 'S11D_REPAIRED_FINAL_CANDIDATE',
    implementation_status: 'COMPLETE',
    closure_effective: true,
    capability_complete: true,
    active_delivery_slice_id: null,
    next_repository_action: null,
    runtime_source_authorized: false,
    successor_authorized: false,
    successor_capability_line_authorized: false,
    pending_completion_claim_count: 0,
    effective_completion_claim_count: 48,
    pending_completion_claims: [],
    effective_completion_claims: claims,
    hard_acceptance_total_check_count: 255,
    hard_acceptance_pass_count: 253,
    hard_acceptance_fail_count: 0,
    hard_acceptance_pending_count: 2,
    hard_acceptance_not_applicable_count: 0,
    hard_acceptance_effective_pass_count_on_attestation: 255,
    completion_claim_activation_authorized: true,
    completion_claim_effective_delta: 48,
    completion_claim_suspension_delta: 0,
    proof_only_pr_required: false,
    repair_postmerge_proof_required: false,
    repair_merge_sha_attestation_required: true,
    repair_merge_sha_attestation_mode: 'PUSH_OR_MERGE_GROUP_IMMUTABLE_CHECK_ARTIFACT',
    repair_merge_sha_attestation_workflow_ref: WORKFLOW,
    postmerge_ssot_writeback_allowed: false,
    closure_effectiveness_condition: CONDITION,
    attestation_contract: attestationContract(),
    hard_acceptance_effective_projection: hardAcceptanceProjection(),
    runtime_delta: { ...ZERO },
    s10_composition_boundary: {
      storage_mode: 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES',
      controlled_stage_database_count: 2,
      interpretation: 'TWO_STAGE_CONTROLLED_END_TO_END_COMPOSITION_PROOF',
      excluded_interpretation: 'ONE_CONTINUOUSLY_PERSISTED_SINGLE_DATABASE_CALIBRATION_RUNTIME_CHAIN',
    },
  };
  if (result.completion_claims && typeof result.completion_claims === 'object') {
    result.completion_claims = {
      ...result.completion_claims,
      pending_count: 0,
      effective_count: 48,
      pending: [],
      effective: claims,
      activation_condition: CONDITION,
    };
  }
  if (result.hard_acceptance && typeof result.hard_acceptance === 'object') {
    result.hard_acceptance = hardAcceptanceProjection();
  }
  if (result.terminal_state && typeof result.terminal_state === 'object') {
    result.terminal_state = {
      ...result.terminal_state,
      status: 'COMPLETE',
      implementation_status: 'COMPLETE',
      closure_effective: true,
      capability_complete: true,
      pending_completion_claim_count: 0,
      effective_completion_claim_count: 48,
      runtime_source_authorized: false,
      successor_authorized: false,
      effectiveness_condition: CONDITION,
    };
  }
  return result;
}

function main() {
  const resolved = read(RESOLVED);
  const claims = resolved.completion_claims.claim_ids;
  if (!Array.isArray(claims) || claims.length !== 48) throw new Error('RESOLVED_COMPLETION_CLAIMS_INVALID');
  const ledger = read(LEDGER);
  const expected = JSON.stringify({ PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 });
  if (JSON.stringify(ledger.status_counts) !== expected) throw new Error('COMMITTED_LEDGER_NOT_READY_FOR_FINAL_CANDIDATE');

  write(LEDGER, {
    ...ledger,
    lifecycle_stage: 'S11D_REPAIRED_FINAL_CANDIDATE',
    status: 'FINAL_CANDIDATE_AWAITING_EXACT_MERGE_SHA_ATTESTATION',
    completion_claims_effective: true,
    completion_claims_effective_condition: CONDITION,
    verified: false,
    effective_status_counts_on_attestation: { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 },
    attestation_contract: attestationContract(),
  });

  const closure = baseProjection(read(FILES.closure), claims);
  closure.status = 'COMPLETE';
  closure.reconciliation_record_state = 'FINAL_CANDIDATE_EFFECTIVE_ON_EXACT_MERGE_SHA_ATTESTATION';
  closure.final_postmerge_proof_required = false;
  closure.unknown_repair_merge_or_postmerge_evidence_recorded = false;
  write(FILES.closure, closure);

  const frontier = baseProjection(read(FILES.frontier), claims);
  frontier.status = 'MCFT_CAP_06_COMPLETE';
  frontier.execution_paused = false;
  frontier.next_repository_action_kind = null;
  frontier.next_repository_action_is_capability_slice = false;
  frontier.completed_action = 'S11D_REPAIRED_FINAL_CANDIDATE_MATERIALIZATION';
  frontier.completed_action_is_new_prerequisite = false;
  frontier.completed_action_is_new_slice = false;
  frontier.terminal_state = {
    status: 'COMPLETE',
    implementation_status: 'COMPLETE',
    closure_effective: true,
    capability_complete: true,
    pending_completion_claim_count: 0,
    effective_completion_claim_count: 48,
    runtime_source_authorized: false,
    successor_capability_line_id: 'MCFT-CAP-07',
    successor_authorized: false,
    effectiveness_condition: CONDITION,
  };
  write(FILES.frontier, frontier);

  const verification = baseProjection(read(FILES.verification), claims);
  verification.status = 'COMPLETE';
  verification.current_slice = {
    slice_id: 'MCFT-CAP-06.FINAL-EFFECTIVENESS-RECONCILIATION-V1',
    status: 'REPAIRED_FINAL_CANDIDATE',
    implementation_started: true,
    candidate_implemented: true,
    terminal_state_materialized: true,
    effective_on_merge: true,
    proof_only_pr_required: false,
    exact_merge_sha_attestation_required: true,
  };
  write(FILES.verification, verification);

  const finalization = baseProjection(read(FILES.finalization), claims);
  finalization.status = 'COMPLETE';
  finalization.effectiveness_preconditions_satisfied = true;
  finalization.reconciliation_record_state = 'FINAL_CANDIDATE_EFFECTIVE_ON_EXACT_MERGE_SHA_ATTESTATION';
  write(FILES.finalization, finalization);

  const reconciliation = baseProjection(read(FILES.reconciliation), claims);
  reconciliation.status = 'COMPLETE';
  reconciliation.record_state = 'FINAL_CANDIDATE_EFFECTIVE_ON_EXACT_MERGE_SHA_ATTESTATION';
  reconciliation.capability_status = 'COMPLETE';
  reconciliation.effectiveness_preconditions_satisfied = true;
  reconciliation.terminal_state_effective_on_merge = true;
  reconciliation.final_postmerge_probe_required = false;
  reconciliation.final_postmerge_probe_disposition = 'AUTOMATIC_EXACT_SHA_ATTESTATION_ARTIFACT';
  reconciliation.repair_postmerge_probe_required = false;
  reconciliation.repair_postmerge_probe_disposition = 'AUTOMATIC_EXACT_SHA_ATTESTATION_ARTIFACT';
  write(FILES.reconciliation, reconciliation);

  for (const key of ['s11a', 's11c', 's11d']) {
    const value = baseProjection(read(FILES[key]), claims);
    value.status = key === 's11d' ? 'REPAIRED_FINAL_CANDIDATE' : value.status;
    value.s11d_closure_repair_required = false;
    value.s11d_closure_repair_candidate_implemented = true;
    value.s11d_closure_repair_merged_main_proven = false;
    value.terminal_state_materialized = true;
    value.terminal_state_effective_on_merge = true;
    write(FILES[key], value);
  }

  const repair = baseProjection(read(FILES.repair), claims);
  repair.status = 'FINAL_CANDIDATE_AWAITING_EXACT_MERGE_SHA_ATTESTATION';
  repair.hard_acceptance = hardAcceptanceProjection();
  repair.repair_candidate_validated = true;
  repair.final_candidate_materialized = true;
  repair.merge_sha_attestation_passed = false;
  write(FILES.repair, repair);

  const manifest = read(FILES.manifest);
  manifest.execution_control = {
    ...manifest.execution_control,
    execution_paused: false,
    active_delivery_slice_id: null,
    completed_action: 'S11D_REPAIRED_FINAL_CANDIDATE_MATERIALIZATION',
    completed_action_is_capability_prerequisite: false,
    completed_action_is_new_slice: false,
    next_action: null,
    next_action_is_existing_taskbook_slice: false,
    effectiveness_condition: CONDITION,
  };
  manifest.s11d = {
    ...manifest.s11d,
    closure_repair_required: false,
    closure_repair_candidate_materialized: true,
    closure_repair_merged_main_proven: false,
    terminal_state_effective_on_merge: true,
    final_postmerge_proof_required: false,
    repair_postmerge_proof_required: false,
    proof_only_pr_required: false,
    exact_merge_sha_attestation_required: true,
    exact_merge_sha_attestation_workflow_ref: WORKFLOW,
    postmerge_writeback_forbidden: true,
  };
  manifest.terminal_state = {
    status: 'COMPLETE',
    implementation_status: 'COMPLETE',
    closure_effective: true,
    capability_complete: true,
    pending_completion_claim_count: 0,
    effective_completion_claim_count: 48,
    active_delivery_slice_id: null,
    next_repository_action: null,
    runtime_source_authorized: false,
    successor_capability_line_authorized: false,
    effectiveness_condition: CONDITION,
  };
  manifest.successor_capability_line_authorized = false;
  write(FILES.manifest, manifest);

  resolved.completion_claims = {
    ...resolved.completion_claims,
    effective_count: 48,
    pending_count: 0,
    activation_condition: CONDITION,
  };
  resolved.hard_acceptance = {
    ...resolved.hard_acceptance,
    committed_status_counts: { PASS: 253, FAIL: 0, PENDING: 2, NOT_APPLICABLE: 0 },
    effective_status_counts_on_attestation: { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 },
    effective_condition: CONDITION,
  };
  resolved.closure_delivery_policy = {
    ...resolved.closure_delivery_policy,
    proof_only_pr_required: false,
    exact_merge_sha_attestation_required: true,
    attestation_triggers: ['merge_group', 'push:main'],
    attestation_workflow_ref: WORKFLOW,
    attestation_gate_ref: GATE,
    immutable_artifact_required: true,
    postmerge_ssot_writeback_allowed: false,
  };
  write(RESOLVED, resolved);

  const quality = read(FILES.quality);
  quality.governance_record_quality = 'REPAIRED_FINAL_CANDIDATE_AWAITING_ATTESTATION';
  quality.delivery_process_quality = 'PROOF_ONLY_PR_REMOVED_FOR_THIS_CLOSURE_REPOSITORY_FOUNDATION_REPAIR_STILL_REQUIRED';
  quality.exact_merge_sha_attestation_required = true;
  quality.proof_only_pr_required = false;
  quality.successor_capability_line_authorized = false;
  write(FILES.quality, quality);

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    lifecycle_stage: 'S11D_REPAIRED_FINAL_CANDIDATE',
    committed_ledger_status_counts: ledger.status_counts,
    effective_status_counts_on_attestation: { PASS: 255, FAIL: 0, PENDING: 0, NOT_APPLICABLE: 0 },
    effective_completion_claim_count: 48,
    closure_effective: true,
    capability_complete: true,
    active_delivery_slice_id: null,
    proof_only_pr_required: false,
    exact_merge_sha_attestation_required: true,
  }, null, 2)}\n`);
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
}
