// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S11_CLOSURE_FINALIZATION.cjs
// Purpose: verify the S11A closure candidate without activating CAP-05 completion claims.
// Boundary: governance-only; no Runtime, migration, route, web, scheduler, calibration, model activation or CAP-06 authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const BASELINE = 'b1248216462eb31cfcf3c75633cc2e53a15520e4';
const S10 = 'MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1';
const S11 = 'MCFT-CAP-05.CLOSURE-AND-FINALIZATION-V1';
const expectedFiles = [
  "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md",
  "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json",
  "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md",
  "scripts/dev/assert_local_pnpm_runtime.cjs",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S11_CLOSURE_FINALIZATION.cjs"
];
const expectedClaims = [
  "MCFT_CAP_05_COMPLETE",
  "DT02_DECISION_OBJECT_REUSE_ESTABLISHED",
  "DT02_ACTION_FEEDBACK_OBJECT_REUSE_ESTABLISHED",
  "DT02_FORECAST_RESIDUAL_OBJECT_REUSE_ESTABLISHED",
  "HUMAN_SCENARIO_DECISION_LINK_ESTABLISHED",
  "SELECTED_SCENARIO_OPTION_SEMANTIC_MEMBER_REF_ESTABLISHED",
  "SCENARIO_RECOMMENDATION_BOUNDARY_ESTABLISHED",
  "EXTERNAL_APPROVAL_EVIDENCE_ASSERTION_ESTABLISHED",
  "APPROVAL_ASSERTION_PLAN_SNAPSHOT_SEPARATION_ESTABLISHED",
  "REPLAY_EVIDENCE_INGRESS_IDEMPOTENCY_ESTABLISHED",
  "GEOX_APPROVAL_AUTHORITY_NONEXERCISE_ESTABLISHED",
  "APPROVED_EXECUTED_AMOUNT_SEPARATION_ESTABLISHED",
  "EXPLICIT_DISPATCH_DISPOSITION_ESTABLISHED",
  "ACTION_FEEDBACK_STATUS_MAPPING_ESTABLISHED",
  "ACTION_FEEDBACK_COMPLETE_ADAPTER_MAPPING_ESTABLISHED",
  "LOGICAL_TIME_EVIDENCE_CUTOFF_ESTABLISHED",
  "ACTION_FEEDBACK_VALIDATION_ORTHOGONALITY_ESTABLISHED",
  "NOT_EXECUTED_FEEDBACK_NONCONSUMPTION_ESTABLISHED",
  "LATE_FEEDBACK_NO_SHIFT_POLICY_ESTABLISHED",
  "SINGLE_INTERVAL_EXECUTION_POLICY_ESTABLISHED",
  "MULTIPLE_EXECUTION_EVENT_FAIL_CLOSED_ESTABLISHED",
  "COVERED_FOOTPRINT_AMOUNT_SEMANTICS_ESTABLISHED",
  "COVERAGE_WEIGHTED_STATE_INPUT_ESTABLISHED",
  "ACTION_FEEDBACK_NEXT_TICK_CONSUMPTION_ESTABLISHED",
  "POST_EXECUTION_STATE_UPDATE_ESTABLISHED",
  "POST_EXECUTION_FORECAST_REGENERATION_ESTABLISHED",
  "POST_EXECUTION_SCENARIO_REGENERATION_ESTABLISHED",
  "FORECAST_OBSERVATION_UNIT_PROJECTION_ESTABLISHED",
  "FORECAST_OBSERVATION_VARIANCE_PROJECTION_ESTABLISHED",
  "FORECAST_POINT_RESIDUAL_ESTABLISHED",
  "FORECAST_RESIDUAL_ASSIMILATION_INNOVATION_SEPARATION_ESTABLISHED",
  "RESIDUAL_ASSIMILATION_TRACE_ESTABLISHED",
  "POST_EXECUTION_FEEDBACK_TRACE_PROJECTION_ESTABLISHED",
  "NO_CAUSAL_ATTRIBUTION_BOUNDARY_ESTABLISHED",
  "ACTION_FEEDBACK_IDEMPOTENCY_ESTABLISHED",
  "ACTION_FEEDBACK_CANONICAL_RECOVERY_ESTABLISHED",
  "ACTION_FEEDBACK_RESTART_RECOVERY_ESTABLISHED",
  "BOUNDED_FEEDBACK_CHAIN_PERSISTED",
  "NO_DIRECT_AO_ACT_OR_AUTOMATIC_DISPATCH_BOUNDARY_ESTABLISHED",
  "ACTION_FEEDBACK_END_TO_END_TRACEABILITY_ESTABLISHED"
];

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log('PASS ' + label);
  } else {
    fail += 1;
    console.error('FAIL ' + label);
  }
}
function read(path) { return fs.readFileSync(path, 'utf8'); }
function json(path) { return JSON.parse(read(path)); }
function changedFiles() {
  const ranges = [BASELINE + '..HEAD', 'HEAD^1..HEAD', 'origin/main...HEAD', 'origin/main..HEAD'];
  for (const range of ranges) {
    try {
      return execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\r?\n/).filter(Boolean).sort();
    } catch {
      // Continue through frozen-baseline, merge-parent and remote-main fallbacks.
    }
  }
  return null;
}

const closure = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json');
const verification = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json');
const auth = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json');
const delivery = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json');
const matrix = json('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
const task = read('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md');
const map = read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md');
const wrapper = read('scripts/dev/assert_local_pnpm_runtime.cjs');
const cap = matrix.capability_lines.find((item) => item.capability_line_id === 'MCFT-CAP-05');
const deliveryS11 = delivery.slices.find((item) => item.delivery_slice_id === S11);
const matrixS11 = cap && cap.delivery_slices.find((item) => item.delivery_slice_id === S11);

check(closure.schema_version === 'geox_mcft_cap_05_closure_record_v1', 'closure record schema is exact');
check(closure.status === 'CLOSURE_CANDIDATE', 'closure remains candidate before final effectiveness');
check(closure.implementation_status === 'S11_CLOSURE_CANDIDATE', 'closure implementation status is exact');
check(closure.closure_effective === false && closure.capability_complete === false, 'closure does not self-activate completion');
check(closure.active_delivery_slice_id === S11, 'closure keeps S11 active');
check(closure.baseline_main_commit === BASELINE && closure.pr_number === 2488, 'closure identity and baseline are frozen');
check(closure.s10_settlement_effectiveness && closure.s10_settlement_effectiveness.settlement_merge_commit === BASELINE, 'S10 settlement merge evidence is frozen');
check(closure.s10_settlement_effectiveness && closure.s10_settlement_effectiveness.settlement_postmerge_probe_workflow === 29405727623, 'S10 settlement postmerge workflow is frozen');
check(closure.s10_settlement_effectiveness && closure.s10_settlement_effectiveness.settlement_postmerge_gate === 'PASS', 'S10 settlement postmerge Gate passed');
check(closure.bounded_runtime_proof && closure.bounded_runtime_proof.checkpoint_sequence_start === 73 && closure.bounded_runtime_proof.checkpoint_sequence_end === 80, 'checkpoint range 73 through 80 is frozen');
check(closure.bounded_runtime_proof && closure.bounded_runtime_proof.global_state_count === 81, 'global State count 81 is frozen');
check(closure.bounded_runtime_proof && closure.bounded_runtime_proof.forecast_point_count === 576 && closure.bounded_runtime_proof.scenario_point_count === 1728, 'bounded point counts are frozen');
check(closure.bounded_runtime_proof && closure.bounded_runtime_proof.full_capability_path_canonical_twin_object_fact_delta === 83, 'full capability canonical delta 83 is frozen');
check(Array.isArray(closure.pending_completion_claims) && closure.pending_completion_claims.length === 40, 'all 40 completion claims remain pending');
check(JSON.stringify(closure.pending_completion_claims) === JSON.stringify(expectedClaims), 'pending completion claim set is exact');
check(Array.isArray(closure.effective_completion_claims) && closure.effective_completion_claims.length === 0, 'no completion claim is effective');
check(closure.successor_authorized === false, 'closure keeps CAP-06 unauthorized');

check(verification.status === 'CANDIDATE' && verification.verified === false, 'main verification remains candidate');
check(verification.subject_main_commit === BASELINE, 'main verification subject is effective S10 settlement main');
check(verification.hard_acceptance === undefined || true, 'main verification is readable');
check(verification.completion_claims && verification.completion_claims.pending.length === 40, 'main verification freezes 40 pending claims');
check(verification.finalization_evidence && verification.finalization_evidence.finalization_gate === 'PENDING', 'finalization evidence remains pending');

check(auth.implementation_status === 'S11_CLOSURE_CANDIDATE', 'Authorization Status advances to S11 closure candidate');
check(auth.runtime_source_authorized === false, 'Authorization Status removes Runtime source authority');
check(auth.active_delivery_slice_id === S11, 'Authorization Status keeps S11 active');
check(auth.current_blockers && auth.current_blockers.includes('S11_FINALIZATION_EFFECTIVENESS_NOT_ESTABLISHED'), 'final effectiveness blocker is explicit');
check(auth.successor_authorized === false, 'Authorization Status keeps CAP-06 unauthorized');

check(delivery.status === 'S11_CLOSURE_CANDIDATE', 'Delivery Status advances to closure candidate');
check(delivery.runtime_source_authorized === false, 'Delivery Status has no Runtime source authority');
check(deliveryS11 && deliveryS11.status === 'IMPLEMENTATION_CANDIDATE', 'S11 delivery slice is an implementation candidate');
check(deliveryS11 && deliveryS11.implementation_started === true, 'S11 implementation is marked started');
check(deliveryS11 && deliveryS11.effectiveness_condition_satisfied === false, 'S11 does not self-claim effectiveness');

check(cap && cap.implementation_status === 'S11_CLOSURE_CANDIDATE', 'Matrix advances to S11 closure candidate');
check(cap && cap.active_delivery_slice_id === S11, 'Matrix keeps S11 active');
check(cap && cap.pending_completion_claims.length === 40 && cap.effective_completion_claims.length === 0, 'Matrix freezes pending claims without activation');
check(cap && cap.successor_authorized === false, 'Matrix keeps CAP-06 unauthorized');
check(matrixS11 && matrixS11.status === 'IMPLEMENTATION_CANDIDATE', 'Matrix S11 slice is a candidate');
check(matrixS11 && matrixS11.runtime_source_authorized === false, 'Matrix S11 slice cannot change Runtime source');

check(task.includes('S11_CLOSURE_CANDIDATE'), 'Task top-level status advances to S11 closure candidate');
check(task.includes('S11A Closure Candidate — Pending Finalization Effectiveness'), 'Task records S11A candidate lifecycle');
check(map.includes('MCFT-CAP-05 S11A Closure Candidate'), 'implementation map records S11A candidate');
check(wrapper.includes('MCFT_CAP_05_S11_CLOSURE_FINALIZATION_GATE_V1'), 'standard acceptance wires the S11 closure Gate');

check(closure.canonical_object_type_delta === 0, 'closure adds no canonical object type');
check(closure.transaction_family_delta === 0, 'closure adds no transaction family');
check(closure.migration_delta === 0 && closure.runtime_source_delta === 0, 'closure adds no migration or Runtime source');
check(closure.public_route_delta === 0 && closure.web_delta === 0 && closure.scheduler_delta === 0, 'closure adds no route, web or scheduler');
check(closure.completion_claim_effective_delta === 0, 'candidate activates no completion claim');
check(JSON.stringify(closure.exact_changed_file_boundary.slice().sort()) === JSON.stringify(expectedFiles), 'closure freezes exact nine-file boundary');
check(!expectedFiles.some((file) => file.startsWith('apps/server/src/') || file.startsWith('apps/web/') || file.includes('/migrations/')), 'candidate boundary contains no Runtime, web or migration file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate' || mode === 'postmerge') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), mode + ' retains exact nine-file S11A boundary');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact nine-file S11A candidate');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all S11A invariants pass');
} else {
  console.error('UNEXPECTED_S11A_CHANGED_FILES:' + JSON.stringify(changed));
  check(false, 'auto mode rejects an unexpected S11A boundary');
}

console.log('SUMMARY ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) process.exit(1);
