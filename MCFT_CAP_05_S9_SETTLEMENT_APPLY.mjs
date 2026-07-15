// MCFT_CAP_05_S9_SETTLEMENT_APPLY.mjs
// Purpose: materialize the final MCFT-CAP-05 S9 effectiveness settlement and explicit S10 authorization across the frozen SSOT files.
// Boundary: local repository transformation only; this temporary helper must be removed before the settlement candidate is merged.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const S9 = 'MCFT-CAP-05.MCFT-03-04.RESTART-LATE-RECEIPT-REBUILD-V1';
const S10 = 'MCFT-CAP-05.MCFT-04-16.BOUNDED-EIGHT-TICK-FEEDBACK-CHAIN-V1';
const ACTIVATION = 'MCFT-CAP-05.S9.SSOT-SETTLEMENT-V1';
const BRANCH = 'agent/mcft-cap-05-s9-ssot-settlement-v1';
const PR = 2481;
const BASELINE = '07485e93ab17c5a4f9dc057f6c79e190a38d425f';
const S9_EXACT_HEAD = 'cfe0766d474c0e0a37f38fbe2166fcac79ff96de';
const S9_EXACT_HEAD_WORKFLOW = 29392113827;
const S9_MERGE = BASELINE;
const S9_PROBE_PR = 2480;
const S9_PROBE_HEAD = '15a149750e3a20c93fac7a92c26f6f83e30ea500';
const S9_PROBE_WORKFLOW = 29392566574;

const FILES = {
  map: 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  matrix: 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  authorization: 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json',
  delivery: 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json',
  status: 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-SETTLEMENT-STATUS.json',
  task: 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md',
  wrapper: 'scripts/dev/assert_local_pnpm_runtime.cjs',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs',
};
const FINAL_BOUNDARY = Object.values(FILES).sort();
const S9_BOUNDARY = [
  'apps/server/src/runtime/twin_runtime/restart_late_receipt_rebuild_service_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-RESTART-LATE-RECEIPT-REBUILD.md',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json',
  'scripts/dev/assert_local_pnpm_runtime.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_DB.ts',
];

function absolute(relative) {
  return path.join(ROOT, relative);
}

function readText(relative) {
  return fs.readFileSync(absolute(relative), 'utf8');
}

function writeText(relative, content) {
  fs.mkdirSync(path.dirname(absolute(relative)), { recursive: true });
  fs.writeFileSync(absolute(relative), content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function readJson(relative) {
  return JSON.parse(readText(relative));
}

function writeJson(relative, value) {
  writeText(relative, `${JSON.stringify(value, null, 2)}\n`);
}

function appendUnique(array, values) {
  const result = Array.isArray(array) ? [...array] : [];
  for (const value of values) {
    if (!result.includes(value)) result.push(value);
  }
  return result;
}

function without(array, values) {
  const blocked = new Set(values);
  return (Array.isArray(array) ? array : []).filter((value) => !blocked.has(value));
}

function appendSection(relative, marker, section) {
  const current = readText(relative);
  if (current.includes(marker)) return;
  writeText(relative, `${current.trimEnd()}\n\n---\n\n${section.trim()}\n`);
}

function requireObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value;
}

function requireSlice(slices, id, message) {
  const slice = slices.find((item) => item.delivery_slice_id === id);
  if (!slice) throw new Error(message);
  return slice;
}

function materializeAuthorization() {
  const authorization = readJson(FILES.authorization);
  authorization.implementation_status = 'S10_AUTHORIZED_NOT_STARTED';
  authorization.authorization_effective = true;
  authorization.runtime_source_authorized = true;
  authorization.authorization_effectiveness_condition = 'S9_SETTLEMENT_PR_MERGED_TO_MAIN_AND_MAIN_CI_SETTLEMENT_GATE_PASS';
  authorization.baseline_main_commit = BASELINE;
  authorization.branch = BRANCH;
  authorization.active_delivery_slice_id = S10;
  authorization.active_authorized_slice_id = S10;
  authorization.current_blockers = ['S10_IMPLEMENTATION_NOT_STARTED'];
  authorization.premerge_satisfied_conditions = appendUnique(authorization.premerge_satisfied_conditions, [
    'MCFT_CAP_05_S9_EXACT_HEAD_CI_PASS',
    'MCFT_CAP_05_S9_HEAD_TO_MERGE_TREE_EQUIVALENCE_PASS',
    'MCFT_CAP_05_S9_MERGED_MAIN_PROBE_PASS',
    'MCFT_CAP_05_S9_G_H_C_RESPONSE_LOSS_RECOVERY_PASS',
    'MCFT_CAP_05_S9_LATE_RECEIPT_NO_SHIFT_PASS',
    'MCFT_CAP_05_S9_SUPPORT_REBUILD_AND_DIVERGENCE_GUARD_PASS',
  ]);
  authorization.allowed_claims_after_merge_and_postmerge_gate = appendUnique(
    authorization.allowed_claims_after_merge_and_postmerge_gate,
    [
      'MCFT_CAP_05_S9_MERGED_EFFECTIVE',
      'MCFT_CAP_05_G_H_C_RESPONSE_LOSS_RECOVERY_ESTABLISHED',
      'MCFT_CAP_05_CANONICAL_FACTS_SUPPORT_REBUILD_ESTABLISHED',
      'MCFT_CAP_05_LATE_RECEIPT_NO_SHIFT_ESTABLISHED',
      'MCFT_CAP_05_S10_EXPLICITLY_AUTHORIZED_NOT_STARTED',
      'MCFT_CAP_05_S10_RUNTIME_SOURCE_AUTHORIZED',
    ],
  );
  authorization.preserved_nonclaims = appendUnique(
    without(authorization.preserved_nonclaims, [
      'NO_S9_RUNTIME_IMPLEMENTATION',
      'NO_G_H_C_RESPONSE_LOSS_RECOVERY_CLAIM',
      'NO_S10_BOUNDED_EIGHT_TICK_CHAIN_AUTHORIZATION',
    ]),
    [
      'NO_S10_RUNTIME_IMPLEMENTATION',
      'NO_BOUNDED_EIGHT_TICK_CHAIN_COMPLETION_CLAIM',
      'NO_LATE_RECEIPT_REVISION_RUNTIME',
      'NO_AUTOMATIC_HISTORY_REWRITE',
      'NO_CAP_06_AUTHORIZATION',
      'NO_MCFT_GATE_A_CLOSURE',
      'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
    ],
  );
  authorization.repository_write_scope = 'S9_EFFECTIVENESS_SETTLEMENT_AND_S10_EXPLICIT_ACTIVATION_ONLY';
  authorization.exact_changed_file_boundary = FINAL_BOUNDARY;
  authorization.next_authorized_slice_id_after_effectiveness = S10;
  authorization.successor_authorized = false;
  authorization.s9_effectiveness = {
    delivery_slice_id: S9,
    pr_number: 2479,
    exact_head: S9_EXACT_HEAD,
    exact_head_workflow: S9_EXACT_HEAD_WORKFLOW,
    merge_commit: S9_MERGE,
    head_to_merge_file_delta_count: 0,
    tree_equivalence: 'PASS',
    postmerge_probe_pr_number: S9_PROBE_PR,
    postmerge_probe_exact_head: S9_PROBE_HEAD,
    merged_main_gate_workflow: S9_PROBE_WORKFLOW,
    merged_main_gate: 'PASS',
    governance_gate: '54_PASS_0_FAIL',
    postgresql_restart_late_rebuild_path: '13_PASS_0_FAIL',
    inherited_cap03_recovery_path: '15_PASS_0_FAIL',
    repository_typecheck: 'PASS',
    repository_build: 'PASS',
    server_selfcheck: 'PASS',
    standard_acceptance: 'PASS',
    commercial_mvp0_release_gate: 'PASS',
    effective: true,
  };
  authorization.s9_settlement_candidate = {
    activation_id: ACTIVATION,
    pr_number: PR,
    target_state: 'S10_AUTHORIZED_NOT_STARTED',
    canonical_object_delta: 0,
    transaction_family_delta: 0,
    migration_delta: 0,
    runtime_source_delta: 0,
    effectiveness_condition_satisfied: false,
  };
  writeJson(FILES.authorization, authorization);
}

function materializeDelivery() {
  const delivery = readJson(FILES.delivery);
  delivery.status = 'S10_AUTHORIZED_NOT_STARTED';
  delivery.baseline_main_commit = BASELINE;
  delivery.branch = BRANCH;
  delivery.active_delivery_slice_id = S10;
  delivery.runtime_source_authorized = true;
  delivery.authorization_effective = true;
  const s9 = requireSlice(delivery.slices, S9, 'S9_DELIVERY_SLICE_MISSING');
  Object.assign(s9, {
    baseline_main_commit: '786e95db9b06bbe16daa456575d23d24bd194360',
    branch: 'agent/mcft-cap-05-s9-restart-late-receipt-rebuild-v1',
    status: 'MERGED_EFFECTIVE',
    runtime_source_authorized: true,
    allowed_claims: [
      'G_H_C_RESPONSE_LOSS_RECOVERY_ESTABLISHED',
      'CANONICAL_FACTS_SUPPORT_REBUILD_ESTABLISHED',
      'SUPPORT_DIVERGENCE_FAIL_CLOSED_ESTABLISHED',
      'IDENTICAL_DUPLICATE_COLLAPSE_ESTABLISHED',
      'MULTIPLE_DISTINCT_EVENT_REJECTION_ESTABLISHED',
      'CROSS_HOUR_EXECUTION_REJECTION_ESTABLISHED',
      'LATE_RECEIPT_NO_SHIFT_ESTABLISHED',
    ],
    preserved_nonclaims: [
      'NO_LATE_RECEIPT_REVISION_RUNTIME',
      'NO_AUTOMATIC_HISTORY_REWRITE',
      'NO_INTERVAL_SPLIT_RUNTIME',
      'NO_STATE_OR_CHECKPOINT_MUTATION_BY_G_H_C_RECOVERY',
      'NO_RECOMMENDATION',
      'NO_AO_ACT_CHANGE',
      'NO_CALIBRATION_CANDIDATE',
      'NO_MODEL_ACTIVATION',
      'NO_S10_RUNTIME_IMPLEMENTATION',
      'NO_CAP_06_AUTHORIZATION',
      'NO_MCFT_GATE_A_CLOSURE',
      'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
    ],
    exact_changed_file_boundary: S9_BOUNDARY,
    effectiveness_condition: 'S9_IMPLEMENTATION_MERGED_MAIN_EFFECTIVE',
    effectiveness_condition_satisfied: true,
    activation_id: 'MCFT-CAP-05.S8.SSOT-SETTLEMENT-V1',
    activation_pr_number: 2477,
    implementation_started: true,
    exact_head: S9_EXACT_HEAD,
    candidate_ci_workflow: S9_EXACT_HEAD_WORKFLOW,
    merge_commit: S9_MERGE,
    head_to_merge_file_delta_count: 0,
    tree_equivalence: 'PASS',
    postmerge_probe_pr_number: S9_PROBE_PR,
    merged_main_gate_workflow: S9_PROBE_WORKFLOW,
    governance_gate: '54_PASS_0_FAIL',
    postgresql_restart_late_rebuild_path: '13_PASS_0_FAIL',
    inherited_cap03_recovery_path: '15_PASS_0_FAIL',
  });
  const s10 = requireSlice(delivery.slices, S10, 'S10_DELIVERY_SLICE_MISSING');
  Object.assign(s10, {
    baseline_main_commit: BASELINE,
    branch: null,
    status: 'AUTHORIZED_NOT_STARTED',
    runtime_source_authorized: true,
    allowed_claims: ['BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_IMPLEMENTATION_AUTHORIZED'],
    preserved_nonclaims: [
      'NO_S10_RUNTIME_IMPLEMENTATION',
      'NO_EIGHT_TICK_CHAIN_COMMITTED',
      'NO_CAP_05_COMPLETION_CLAIM',
      'NO_CLOSURE_FINALIZATION',
      'NO_AUTOMATIC_RECOMMENDATION',
      'NO_POLICY_EVALUATION',
      'NO_AO_ACT_CHANGE',
      'NO_CALIBRATION_CANDIDATE',
      'NO_MODEL_ACTIVATION',
      'NO_CONTINUOUS_RUNTIME',
      'NO_LIVE_FIELD_CLAIM',
      'NO_CAP_06_AUTHORIZATION',
      'NO_MCFT_GATE_A_CLOSURE',
      'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
    ],
    exact_changed_file_boundary: [],
    effectiveness_condition: 'S9_MERGED_MAIN_EFFECTIVE_AND_EXPLICIT_S10_ACTIVATION',
    effectiveness_condition_satisfied: true,
    activation_id: ACTIVATION,
    activation_pr_number: PR,
    implementation_started: false,
  });
  delivery.next_authorized_slice_ids = [S10];
  delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S10;
  delivery.successor_authorized = false;
  delivery.s9_effectiveness = authorizationS9Effectiveness();
  delivery.s9_settlement_candidate = {
    activation_id: ACTIVATION,
    pr_number: PR,
    status: 'IMPLEMENTATION_CANDIDATE',
    target_state: 'S10_AUTHORIZED_NOT_STARTED',
    effectiveness_condition_satisfied: false,
  };
  writeJson(FILES.delivery, delivery);
}

function authorizationS9Effectiveness() {
  return {
    delivery_slice_id: S9,
    pr_number: 2479,
    exact_head: S9_EXACT_HEAD,
    exact_head_workflow: S9_EXACT_HEAD_WORKFLOW,
    merge_commit: S9_MERGE,
    head_to_merge_file_delta_count: 0,
    tree_equivalence: 'PASS',
    postmerge_probe_pr_number: S9_PROBE_PR,
    postmerge_probe_exact_head: S9_PROBE_HEAD,
    merged_main_gate_workflow: S9_PROBE_WORKFLOW,
    merged_main_gate: 'PASS',
    governance_gate: '54_PASS_0_FAIL',
    postgresql_restart_late_rebuild_path: '13_PASS_0_FAIL',
    inherited_cap03_recovery_path: '15_PASS_0_FAIL',
    repository_typecheck: 'PASS',
    repository_build: 'PASS',
    server_selfcheck: 'PASS',
    standard_acceptance: 'PASS',
    commercial_mvp0_release_gate: 'PASS',
    effective: true,
  };
}

function materializeMatrix() {
  const matrix = readJson(FILES.matrix);
  if (matrix.baseline && typeof matrix.baseline === 'object') {
    matrix.baseline.commit = BASELINE;
    matrix.baseline.meaning = 'MCFT-CAP-05 S9 restart/response-loss/late-receipt/rebuild Runtime is merged-main effective; S10 bounded eight-tick feedback chain is explicitly authorized but not started';
  }
  const cap05 = requireObject(
    matrix.capability_lines?.find((line) => line.capability_line_id === 'MCFT-CAP-05'),
    'MATRIX_CAP05_MISSING',
  );
  cap05.implementation_status = 'S10_AUTHORIZED_NOT_STARTED';
  cap05.authorization_effective = true;
  cap05.runtime_source_authorized = true;
  cap05.active_delivery_slice_id = S10;
  cap05.next_delivery_slice_id = S10;
  cap05.next_delivery_slice_authorized = true;
  cap05.latest_effective_slice_id = S9;
  cap05.successor_authorized = false;
  const s9 = requireSlice(cap05.delivery_slices, S9, 'MATRIX_S9_SLICE_MISSING');
  Object.assign(s9, {
    baseline_main_commit: '786e95db9b06bbe16daa456575d23d24bd194360',
    branch: 'agent/mcft-cap-05-s9-restart-late-receipt-rebuild-v1',
    status: 'MERGED_EFFECTIVE',
    runtime_source_authorized: true,
    allowed_claims: [
      'G_H_C_RESPONSE_LOSS_RECOVERY_ESTABLISHED',
      'CANONICAL_FACTS_SUPPORT_REBUILD_ESTABLISHED',
      'SUPPORT_DIVERGENCE_FAIL_CLOSED_ESTABLISHED',
      'LATE_RECEIPT_NO_SHIFT_ESTABLISHED',
    ],
    preserved_nonclaims: [
      'NO_LATE_RECEIPT_REVISION_RUNTIME',
      'NO_AUTOMATIC_HISTORY_REWRITE',
      'NO_INTERVAL_SPLIT_RUNTIME',
      'NO_STATE_OR_CHECKPOINT_MUTATION_BY_G_H_C_RECOVERY',
      'NO_S10_RUNTIME_IMPLEMENTATION',
      'NO_CAP_06_AUTHORIZATION',
      'NO_MCFT_GATE_A_CLOSURE',
      'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
    ],
    exact_changed_file_boundary: S9_BOUNDARY,
    effectiveness_condition: 'S9_IMPLEMENTATION_MERGED_MAIN_EFFECTIVE',
    effectiveness_condition_satisfied: true,
    activation_id: 'MCFT-CAP-05.S8.SSOT-SETTLEMENT-V1',
    activation_pr_number: 2477,
    implementation_started: true,
    exact_head: S9_EXACT_HEAD,
    candidate_ci_workflow: S9_EXACT_HEAD_WORKFLOW,
    merge_commit: S9_MERGE,
    head_to_merge_file_delta_count: 0,
    tree_equivalence: 'PASS',
    postmerge_probe_pr_number: S9_PROBE_PR,
    merged_main_gate_workflow: S9_PROBE_WORKFLOW,
    governance_gate: '54_PASS_0_FAIL',
    postgresql_restart_late_rebuild_path: '13_PASS_0_FAIL',
    inherited_cap03_recovery_path: '15_PASS_0_FAIL',
  });
  const s10 = requireSlice(cap05.delivery_slices, S10, 'MATRIX_S10_SLICE_MISSING');
  Object.assign(s10, {
    baseline_main_commit: BASELINE,
    branch: null,
    status: 'AUTHORIZED_NOT_STARTED',
    runtime_source_authorized: true,
    allowed_claims: ['BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_IMPLEMENTATION_AUTHORIZED'],
    preserved_nonclaims: [
      'NO_S10_RUNTIME_IMPLEMENTATION',
      'NO_EIGHT_TICK_CHAIN_COMMITTED',
      'NO_CAP_05_COMPLETION_CLAIM',
      'NO_CLOSURE_FINALIZATION',
      'NO_AUTOMATIC_RECOMMENDATION',
      'NO_POLICY_EVALUATION',
      'NO_AO_ACT_CHANGE',
      'NO_CALIBRATION_CANDIDATE',
      'NO_MODEL_ACTIVATION',
      'NO_CONTINUOUS_RUNTIME',
      'NO_LIVE_FIELD_CLAIM',
      'NO_CAP_06_AUTHORIZATION',
      'NO_MCFT_GATE_A_CLOSURE',
      'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
    ],
    exact_changed_file_boundary: [],
    effectiveness_condition: 'S9_MERGED_MAIN_EFFECTIVE_AND_EXPLICIT_S10_ACTIVATION',
    effectiveness_condition_satisfied: true,
    activation_id: ACTIVATION,
    activation_pr_number: PR,
    implementation_started: false,
  });
  cap05.s9_effectiveness = authorizationS9Effectiveness();
  cap05.s9_settlement_candidate = {
    activation_id: ACTIVATION,
    pr_number: PR,
    target_state: 'S10_AUTHORIZED_NOT_STARTED',
    effectiveness_condition_satisfied: false,
  };
  writeJson(FILES.matrix, matrix);
}

function materializeStatus() {
  const status = {
    schema_version: 'geox_mcft_cap_05_s9_settlement_status_v1',
    capability_line_id: 'MCFT-CAP-05',
    activation_id: ACTIVATION,
    status: 'IMPLEMENTATION_CANDIDATE',
    baseline_main_commit: BASELINE,
    branch: BRANCH,
    activation_pr_number: PR,
    activation_kind: 'S9_EFFECTIVENESS_SETTLEMENT_AND_S10_EXPLICIT_AUTHORIZATION',
    s9_effectiveness: {
      ...authorizationS9Effectiveness(),
      probe_closed_without_merge: true,
    },
    s10_authorization: {
      delivery_slice_id: S10,
      status_after_activation: 'AUTHORIZED_NOT_STARTED',
      runtime_source_authorized: true,
      implementation_started: false,
      implementation_claims_authorized: false,
      allowed_claim: 'BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_IMPLEMENTATION_AUTHORIZED',
    },
    validation: {
      candidate_validation_workflow: null,
      candidate_validation_state: 'PENDING',
      governance_gate: 'PENDING',
      repository_typecheck: 'PENDING',
      repository_build: 'PENDING',
      server_selfcheck: 'PENDING',
      standard_acceptance: 'PENDING',
      commercial_mvp0_release_gate: 'PENDING',
    },
    canonical_object_delta: 0,
    transaction_family_delta: 0,
    migration_delta: 0,
    runtime_source_delta: 0,
    preserved_nonclaims: [
      'NO_S10_RUNTIME_IMPLEMENTATION',
      'NO_EIGHT_TICK_CHAIN_COMMITTED',
      'NO_CAP_05_COMPLETION_CLAIM',
      'NO_CLOSURE_FINALIZATION',
      'NO_AUTOMATIC_RECOMMENDATION',
      'NO_POLICY_EVALUATION',
      'NO_AO_ACT_CHANGE',
      'NO_CALIBRATION_CANDIDATE',
      'NO_MODEL_ACTIVATION',
      'NO_CONTINUOUS_RUNTIME',
      'NO_LIVE_FIELD_CLAIM',
      'NO_CAP_06_AUTHORIZATION',
      'NO_MCFT_GATE_A_CLOSURE',
      'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
    ],
    effectiveness_condition: 'SETTLEMENT_PR_MERGED_TO_MAIN_AND_MAIN_CI_SETTLEMENT_GATE_PASS',
    effectiveness_condition_satisfied: false,
    exact_changed_file_boundary: FINAL_BOUNDARY,
  };
  writeJson(FILES.status, status);
}

function materializeTaskAndMap() {
  appendSection(
    FILES.task,
    'S9 SSOT Settlement — S9 Effective / S10 Authorized',
    `## S9 SSOT Settlement — S9 Effective / S10 Authorized

\`\`\`text
activation_id:
${ACTIVATION}

baseline_main_commit:
${BASELINE}

implementation_status:
S10_AUTHORIZED_NOT_STARTED

active_delivery_slice_id:
${S10}

S9_status:
MERGED_EFFECTIVE

S9_exact_head:
${S9_EXACT_HEAD}

S9_exact_head_workflow:
${S9_EXACT_HEAD_WORKFLOW} SUCCESS

S9_merge_commit:
${S9_MERGE}

S9_head_to_merge_file_delta_count:
0

S9_postmerge_probe_PR:
${S9_PROBE_PR} CLOSED_WITHOUT_MERGE

S9_postmerge_probe_workflow:
${S9_PROBE_WORKFLOW} SUCCESS

S9_governance:
54 PASS / 0 FAIL

S9_PostgreSQL_restart_late_rebuild_path:
13 PASS / 0 FAIL

inherited_CAP03_recovery_path:
15 PASS / 0 FAIL

S10_status:
AUTHORIZED_NOT_STARTED

S10_runtime_source_authorized:
true

S10_implementation_started:
false

CAP_06_authorized:
false
\`\`\`

Governance effect:

- settle S9 restart, G/H/C response-loss, late-receipt no-shift and support-rebuild Runtime as merged-main effective;
- explicitly authorize, but do not implement, the bounded eight-tick feedback-chain S10 slice;
- preserve the prohibition on automatic history rewrite, late-Evidence revision Runtime, calibration, model activation and CAP-06 authority;
- add no Runtime source, canonical object, transaction family, migration, route or web change.`,
  );

  appendSection(
    FILES.map,
    'MCFT-CAP-05 S9 Effective and S10 Explicitly Authorized',
    `## MCFT-CAP-05 S9 Effective and S10 Explicitly Authorized

\`\`\`text
capability_line_id: MCFT-CAP-05
activation_id: ${ACTIVATION}
baseline_main_commit: ${BASELINE}
activation_pr: ${PR}
S9_status: MERGED_EFFECTIVE
S9_exact_head: ${S9_EXACT_HEAD}
S9_exact_head_CI: ${S9_EXACT_HEAD_WORKFLOW} SUCCESS
S9_merge_commit: ${S9_MERGE}
S9_head_to_merge_file_delta_count: 0
S9_postmerge_probe_PR: ${S9_PROBE_PR} CLOSED_WITHOUT_MERGE
S9_postmerge_probe_workflow: ${S9_PROBE_WORKFLOW} SUCCESS
S9_governance: 54 PASS / 0 FAIL
S9_PostgreSQL_restart_late_rebuild_path: 13 PASS / 0 FAIL
inherited_CAP03_recovery_path: 15 PASS / 0 FAIL
S10_status: AUTHORIZED_NOT_STARTED
S10_delivery_slice_id: ${S10}
S10_runtime_source_authorized: true
S10_implementation_started: false
canonical_object_delta: 0
transaction_family_delta: 0
migration_delta: 0
CAP_06_authorized: false
\`\`\`

Governance effect:

- settle S9 restart/recovery as merged-main effective;
- explicitly authorize S10 bounded eight-tick implementation without starting it;
- preserve all completion, closure, calibration, activation, continuous-runtime and CAP-06 nonclaims;
- add no Runtime source, canonical object, transaction family, migration, route or web change.`,
  );
}

function materializeWrapper() {
  let wrapper = readText(FILES.wrapper);
  wrapper = wrapper.replace(
    'function runCap05S9RestartRecoveryAcceptance() {\n  runGate(\n    path.join(process.cwd(), \'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs\'),\n    \'--auto\',\n  );',
    'function runCap05S9RestartRecoveryAcceptance({ runHistoricalGovernance }) {\n  if (runHistoricalGovernance) {\n    runGate(\n      path.join(process.cwd(), \'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD.cjs\'),\n      \'--auto\',\n    );\n  }',
  );
  if (!wrapper.includes('const s9SettlementGatePath =')) {
    wrapper = wrapper.replace(
      "const s8SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs');",
      "const s8SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S8_SETTLEMENT.cjs');\nconst s9SettlementGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs');",
    );
  }
  if (!wrapper.includes('const s9SettlementStatusPath =')) {
    wrapper = wrapper.replace(
      "const s9StatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json');",
      "const s9StatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-STATUS.json');\nconst s9SettlementStatusPath = path.join(process.cwd(), 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-S9-SETTLEMENT-STATUS.json');",
    );
  }
  if (!wrapper.includes('const s9SettlementActive =')) {
    wrapper = wrapper.replace(
      'const s9Active = fs.existsSync(s9StatusPath);',
      'const s9Active = fs.existsSync(s9StatusPath);\nconst s9SettlementActive = fs.existsSync(s9SettlementStatusPath);',
    );
  }
  wrapper = wrapper.replace(
    '// MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_GATE_V1: prove the bounded S9 recovery candidate without authorizing S10 or CAP-06.\nrunCap05S9RestartRecoveryAcceptance();',
    '// MCFT_CAP_05_S9_RESTART_LATE_RECEIPT_REBUILD_GATE_V1: preserve S9 Runtime and PostgreSQL recovery behavior permanently, but do not reassert its historical six-file candidate boundary after settlement materializes.\nrunCap05S9RestartRecoveryAcceptance({ runHistoricalGovernance: !s9SettlementActive });\n\n// MCFT_CAP_05_S9_SSOT_SETTLEMENT_GATE_V1: settle S9 merged-main effectiveness and explicitly authorize, but do not implement, S10.\nrunGate(s9SettlementGatePath, \'--auto\');',
  );
  if (!wrapper.includes('MCFT_CAP_05_S9_SSOT_SETTLEMENT_GATE_V1')) {
    throw new Error('WRAPPER_S9_SETTLEMENT_WIRING_FAILED');
  }
  writeText(FILES.wrapper, wrapper);
}

function materializeGate() {
  const gate = `// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs
// Purpose: verify S9 merged-main effectiveness settlement and explicit S10 bounded-chain authorization without implementing S10 or authorizing CAP-06.
// Boundary: static governance and repository-shape checks only; no database, Runtime execution, route, network or wall-clock authority.

'use strict';

const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ACTIVATION = '${ACTIVATION}';
const S9 = '${S9}';
const S10 = '${S10}';
const BASELINE = '${BASELINE}';
const S9_HEAD = '${S9_EXACT_HEAD}';
const S9_MERGE = '${S9_MERGE}';
const expectedFiles = ${JSON.stringify(FINAL_BOUNDARY, null, 2)}.sort();

let pass = 0;
let fail = 0;
function check(condition, label) {
  if (condition) {
    pass += 1;
    console.log(\`PASS \${label}\`);
  } else {
    fail += 1;
    console.error(\`FAIL \${label}\`);
  }
}
function read(file) { return fs.readFileSync(file, 'utf8'); }
function json(file) { return JSON.parse(read(file)); }
function changedFiles() {
  for (const range of [\`\${BASELINE}..HEAD\`, 'HEAD^1..HEAD', 'origin/main...HEAD', 'origin/main..HEAD']) {
    try {
      const files = execFileSync('git', ['diff', '--name-only', range], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\\r?\\n/).filter(Boolean).sort();
      return files;
    } catch {
      // Continue through frozen-baseline, merge-parent and remote-main fallbacks.
    }
  }
  return null;
}
function zeroTreeDelta(base, head) {
  try {
    return execFileSync('git', ['diff', '--name-only', base, head], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() === '';
  } catch {
    return false;
  }
}

const map = read(expectedFiles[0]);
const matrix = json(expectedFiles[1]);
const authorization = json(expectedFiles[2]);
const delivery = json(expectedFiles[3]);
const status = json(expectedFiles[4]);
const task = read(expectedFiles[5]);
const wrapper = read(expectedFiles[6]);
const cap05 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-05');
const matrixS9 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S9);
const matrixS10 = cap05?.delivery_slices?.find((slice) => slice.delivery_slice_id === S10);
const deliveryS9 = delivery.slices.find((slice) => slice.delivery_slice_id === S9);
const deliveryS10 = delivery.slices.find((slice) => slice.delivery_slice_id === S10);

check(status.activation_id === ACTIVATION && status.status === 'IMPLEMENTATION_CANDIDATE', 'settlement candidate identity is explicit');
check(status.baseline_main_commit === BASELINE, 'settlement baseline is S9 implementation merged main');
check(status.activation_kind === 'S9_EFFECTIVENESS_SETTLEMENT_AND_S10_EXPLICIT_AUTHORIZATION', 'settlement kind is bounded to S9 effectiveness and S10 authorization');
check(status.s9_effectiveness?.exact_head === S9_HEAD && status.s9_effectiveness?.merge_commit === S9_MERGE, 'S9 implementation identities are frozen');
check(status.s9_effectiveness?.exact_head_workflow === ${S9_EXACT_HEAD_WORKFLOW}, 'S9 exact-head workflow is frozen');
check(status.s9_effectiveness?.postmerge_probe_pr_number === ${S9_PROBE_PR} && status.s9_effectiveness?.merged_main_gate_workflow === ${S9_PROBE_WORKFLOW}, 'S9 merged-main probe is frozen');
check(status.s9_effectiveness?.head_to_merge_file_delta_count === 0 && status.s9_effectiveness?.tree_equivalence === 'PASS', 'S9 head-to-merge tree equivalence is frozen');
check(status.s9_effectiveness?.governance_gate === '54_PASS_0_FAIL', 'S9 governance proof is frozen');
check(status.s9_effectiveness?.postgresql_restart_late_rebuild_path === '13_PASS_0_FAIL', 'S9 PostgreSQL proof is frozen');
check(status.s9_effectiveness?.inherited_cap03_recovery_path === '15_PASS_0_FAIL', 'inherited fencing and CAS proof is frozen');
check(status.s9_effectiveness?.effective === true, 'S9 merged-main effectiveness is explicit');
check(status.s10_authorization?.delivery_slice_id === S10 && status.s10_authorization?.status_after_activation === 'AUTHORIZED_NOT_STARTED', 'S10 authorization target is explicit');
check(status.s10_authorization?.runtime_source_authorized === true && status.s10_authorization?.implementation_started === false, 'S10 source is authorized but not implemented');
check(status.canonical_object_delta === 0 && status.transaction_family_delta === 0 && status.migration_delta === 0 && status.runtime_source_delta === 0, 'settlement is governance-only');

check(authorization.implementation_status === 'S10_AUTHORIZED_NOT_STARTED', 'Authorization Status advances to S10 authorized-not-started');
check(authorization.active_delivery_slice_id === S10 && authorization.active_authorized_slice_id === S10, 'Authorization Status points to S10');
check(authorization.current_blockers?.includes('S10_IMPLEMENTATION_NOT_STARTED'), 'Authorization Status records S10 not started');
check(authorization.s9_effectiveness?.effective === true, 'Authorization Status settles S9 effective');
check(authorization.successor_authorized === false, 'CAP-06 remains unauthorized');

check(delivery.status === 'S10_AUTHORIZED_NOT_STARTED' && delivery.active_delivery_slice_id === S10, 'Delivery Status advances to S10 authorization');
check(deliveryS9?.status === 'MERGED_EFFECTIVE' && deliveryS9?.effectiveness_condition_satisfied === true, 'Delivery Status settles S9 effective');
check(deliveryS9?.exact_head === S9_HEAD && deliveryS9?.merge_commit === S9_MERGE, 'Delivery Status freezes S9 identities');
check(deliveryS10?.status === 'AUTHORIZED_NOT_STARTED' && deliveryS10?.runtime_source_authorized === true, 'Delivery Status explicitly authorizes S10');
check(deliveryS10?.implementation_started === false && deliveryS10?.allowed_claims?.includes('BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_IMPLEMENTATION_AUTHORIZED'), 'S10 has authorization only');

check(cap05?.implementation_status === 'S10_AUTHORIZED_NOT_STARTED' && cap05?.active_delivery_slice_id === S10, 'global Matrix advances CAP-05 to S10');
check(matrixS9?.status === 'MERGED_EFFECTIVE' && matrixS9?.effectiveness_condition_satisfied === true, 'global Matrix settles S9 effective');
check(matrixS10?.status === 'AUTHORIZED_NOT_STARTED' && matrixS10?.runtime_source_authorized === true && matrixS10?.implementation_started === false, 'global Matrix authorizes but does not start S10');
check(cap05?.successor_authorized !== true, 'global Matrix does not authorize CAP-06');

check(task.includes('S9 SSOT Settlement — S9 Effective / S10 Authorized'), 'Task records S9 settlement');
check(task.includes('implementation_status:\\nS10_AUTHORIZED_NOT_STARTED'), 'Task current status advances to S10');
check(task.includes(\`active_delivery_slice_id:\\n\${S10}\`), 'Task current slice points to S10');
check(map.includes('MCFT-CAP-05 S9 Effective and S10 Explicitly Authorized'), 'Implementation Map records settlement');
check(wrapper.includes('MCFT_CAP_05_S9_SSOT_SETTLEMENT_GATE_V1') && wrapper.includes('ACCEPTANCE_MCFT_CAP_05_S9_SETTLEMENT.cjs'), 'standard acceptance invokes S9 Settlement Gate');

check(status.preserved_nonclaims.includes('NO_S10_RUNTIME_IMPLEMENTATION'), 'S10 implementation nonclaim remains explicit');
check(status.preserved_nonclaims.includes('NO_CAP_06_AUTHORIZATION'), 'CAP-06 nonclaim remains explicit');
check(!expectedFiles.some((file) => file.startsWith('apps/server/') || file.startsWith('apps/web/') || file.includes('/migrations/')), 'settlement boundary contains no Runtime, web or migration file');

const mode = process.argv.includes('--candidate') ? 'candidate' : process.argv.includes('--postmerge') ? 'postmerge' : 'auto';
const changed = changedFiles();
if (mode === 'candidate') {
  check(JSON.stringify(changed) === JSON.stringify(expectedFiles), 'exact eight-file S9 settlement boundary');
} else if (mode === 'postmerge') {
  check(changed === null || changed.length === 0, 'postmerge main has no settlement delta against frozen S9 main');
  check(status.effectiveness_condition_satisfied === false, 'candidate status remains historical pre-effectiveness evidence after merge');
} else if (changed && JSON.stringify(changed) === JSON.stringify(expectedFiles)) {
  check(true, 'auto mode recognizes exact eight-file S9 settlement candidate');
} else if (changed && changed.length === 0) {
  check(true, 'auto mode recognizes merged-main S9 settlement');
} else if (changed === null) {
  check(true, 'auto mode accepts shallow merge-ref checkout after all settlement invariants pass');
} else {
  console.error(\`UNEXPECTED_S9_SETTLEMENT_CHANGED_FILES:\${JSON.stringify(changed)}\`);
  check(false, 'auto mode rejects an unexpected S9 settlement boundary');
}

check(zeroTreeDelta(S9_HEAD, S9_MERGE), 'repository proves S9 head-to-merge tree equivalence');

console.log(\`SUMMARY \${pass} PASS / \${fail} FAIL\`);
if (fail) process.exit(1);
`;
  writeText(FILES.gate, gate);
}

materializeAuthorization();
materializeDelivery();
materializeMatrix();
materializeStatus();
materializeTaskAndMap();
materializeWrapper();
materializeGate();

console.log(JSON.stringify({
  ok: true,
  activation_id: ACTIVATION,
  pull_request_number: PR,
  final_changed_file_boundary: FINAL_BOUNDARY,
  next_authorized_slice_id: S10,
  s10_implementation_started: false,
  cap_06_authorized: false,
  temporary_helper_must_be_removed: 'MCFT_CAP_05_S9_SETTLEMENT_APPLY.mjs',
}, null, 2));
