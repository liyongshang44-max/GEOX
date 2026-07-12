// .cap04-p0-history/materialize_minimal_p0_history.cjs
// Purpose: preserve the existing capability history while reconciling only the CAP-03 terminal SSOT and CAP-04 P0 provisional boundary.
// This file removes itself through the workflow before the final candidate commit.

'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = 'eca0d053045db59982ad20a6e0421f72ae16f804';
const BRANCH = 'agent/mcft-cap-04-p0-ssot-v1';
const P0 = 'MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1';
const S0 = 'MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const TASK_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const MAIN_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const R4_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';
const FILES = [MAP_PATH, MATRIX_PATH, TASK_PATH, STATUS_PATH, GATE_PATH].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const gitShow = (file) => cp.execFileSync('git', ['show', `${BASELINE}:${file}`], { cwd: ROOT, encoding: 'utf8' });

const delivery = readJson(DELIVERY_PATH);
const mainVerification = readJson(MAIN_VERIFICATION_PATH);
const r4Verification = readJson(R4_VERIFICATION_PATH);
if (delivery.status !== 'CAPABILITY_COMPLETE' || delivery.active_delivery_slice_id !== null) throw new Error('CAP03_DELIVERY_NOT_TERMINAL');
if (mainVerification.status !== 'VERIFIED_ON_MAIN' || mainVerification.verified_on_main !== true || mainVerification.capability_complete !== true) throw new Error('CAP03_MAIN_NOT_EFFECTIVE');
if (r4Verification.status !== 'VERIFIED_ON_MAIN' || r4Verification.effectiveness_condition_satisfied !== true) throw new Error('CAP03_R4_NOT_EFFECTIVE');

const matrix = JSON.parse(gitShow(MATRIX_PATH));
matrix.schema_version = 'geox_mcft_vertical_capability_line_matrix_v6';
matrix.amendment_id = 'MCFT-VERTICAL-AMENDMENT-03';
matrix.status = 'COMPLETE';
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-03 R4 final verification effectiveness merged; MCFT-CAP-04 remains unauthorized',
};
matrix.latest_governance_update = P0;

const cap03 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-03');
if (!cap03) throw new Error('CAP03_MATRIX_ENTRY_MISSING');
Object.assign(cap03, {
  status: 'COMPLETE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'COMPLETE',
  authorization_status: 'MERGED_EFFECTIVE',
  authorization_effective: true,
  runtime_source_authorized: true,
  active_delivery_slice_id: null,
  pending_completion_claims: [],
  closure_effective: true,
  capability_complete: true,
  completion_claims: [...mainVerification.effective_completion_claims],
  preserved_nonclaims: [...mainVerification.preserved_nonclaims],
  successor_capability_line_id: 'MCFT-CAP-04',
  successor_authorized: false,
  latest_verified_main_commit: r4Verification.verified_main_commit,
  main_verification_ref: MAIN_VERIFICATION_PATH,
  r4_final_verification_ref: R4_VERIFICATION_PATH,
  post_completion_remediation_verification: {
    status: 'VERIFIED_ON_MAIN',
    audit_issue_number: 2368,
    verification_ref: R4_VERIFICATION_PATH,
    r4_a_status: 'MERGED_EFFECTIVE',
    r4_b_status: 'MERGED_EFFECTIVE',
    r4_c_status: 'MERGED_EFFECTIVE',
    task_conformance_status: 'VERIFIED_AFTER_R4_REMEDIATION',
    remaining_nonconformant_hard_acceptance_count: 0,
    remaining_unadjudicated_contract_deviation_count: 0,
    active_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
    verification_pr_number: 2375,
    verification_exact_head_commit: '71b4f7d2c0d6235939a0ae2969af17f08e264115',
    verification_exact_head_ci_run: 'CI_4801',
    verification_build_test: 'PASS',
    verification_acceptance: 'PASS',
    verification_merge_commit: 'cda1016542300bbc477a1c72023401aaaad954bc',
    head_merge_file_delta_count: 0,
    head_merge_tree_equivalence: 'PASS',
    effectiveness_condition_satisfied: true,
  },
  next_authorized_slice_ids: [],
  effectiveness_condition: 'CAP_03_R4_FINAL_VERIFICATION_EFFECTIVE_ON_MAIN',
  finalization: {
    status: 'VERIFIED_ON_MAIN',
    closure_effective: true,
    capability_complete: true,
    completion_claims_status: 'EFFECTIVE',
    verified_main_commit: r4Verification.verified_main_commit,
    effectiveness_condition_satisfied: true,
  },
});
delete cap03.next_authorized_slice_id_after_merge_and_postmerge_gate;

const authoritativeSlices = new Map((delivery.slices ?? []).map((slice) => [slice.delivery_slice_id, slice]));
for (const slice of cap03.delivery_slices ?? []) {
  const authoritative = authoritativeSlices.get(slice.delivery_slice_id);
  if (!authoritative) continue;
  Object.assign(slice, authoritative);
}

const p0Slice = {
  delivery_slice_id: P0,
  slice_kind: 'GOVERNANCE_ONLY',
  status: 'P0_RECONCILIATION_CANDIDATE',
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  runtime_source_authorized: false,
  exact_changed_file_boundary: FILES,
  effectiveness_condition: 'P0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_P0_GATE_PASS',
  effectiveness_condition_satisfied: false,
};
const s0Slice = {
  delivery_slice_id: S0,
  slice_kind: 'GOVERNANCE_ONLY',
  status: 'BLOCKED_PENDING_P0_EFFECTIVENESS',
  depends_on_delivery_slice_ids: [P0],
  baseline_main_commit: null,
  branch: null,
  runtime_source_authorized: false,
  effectiveness_condition: 'P0_EFFECTIVE_AND_S0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  effectiveness_condition_satisfied: false,
};
const cap04 = {
  capability_line_id: 'MCFT-CAP-04',
  display_alias: 'MCFT-4',
  name: '72-Hour Forecast and Three Scenarios',
  runtime_mode: 'REPLAY',
  target_completion_level: 'Level A — Deterministic Replay Twin',
  status: 'NOT_AUTHORIZED',
  design_status: 'FINAL_FROZEN_CANDIDATE_V0_5',
  implementation_status: 'NOT_AUTHORIZED',
  authorization_id: 'MCFT-CAP-04-AUTHORIZATION-V1',
  authorization_status: 'NOT_AUTHORIZED',
  authorization_effective: false,
  runtime_source_authorized: false,
  predecessor_capability_line_id: 'MCFT-CAP-03',
  primary_owner_work_package_id: 'MCFT-09',
  contributing_owner_work_package_ids: ['MCFT-02','MCFT-03','MCFT-04','MCFT-05','MCFT-06','MCFT-07','MCFT-08','MCFT-10'],
  excluded_owner_work_package_ids: ['MCFT-11','MCFT-12','MCFT-13','MCFT-14','MCFT-15','MCFT-16','MCFT-17','MCFT-18'],
  active_delivery_slice_id: null,
  next_delivery_slice_id: S0,
  next_delivery_slice_authorized: false,
  task_ref: TASK_PATH,
  p0_status_ref: STATUS_PATH,
  delivery_slices: [p0Slice, s0Slice],
  pending_completion_claims: [],
  effective_completion_claims: [],
  completion_claims: [],
  preserved_nonclaims: [
    'NO_MCFT_CAP_04_AUTHORIZATION','NO_MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZATION',
    'NO_SUCCESSFUL_FORECAST_CREATED_BY_CAP_04','NO_72_HOUR_FORECAST_CREATED_BY_CAP_04',
    'NO_SCENARIO_CREATED_BY_CAP_04','NO_FORECAST_RESIDUAL','NO_RECOMMENDATION',
    'NO_POLICY_EVALUATION','NO_DECISION','NO_AO_ACT','NO_CONTINUOUS_RUNTIME',
    'NO_CONTINUOUS_SCHEDULER','NO_LIVE_FIELD_CLAIM','NO_MCFT_GATE_A_CLOSURE',
    'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
  ],
  successor_capability_line_id: 'MCFT-CAP-05',
  successor_authorized: false,
};
const cap04Index = matrix.capability_lines.findIndex((line) => line.capability_line_id === 'MCFT-CAP-04');
if (cap04Index === -1) matrix.capability_lines.push(cap04);
else matrix.capability_lines[cap04Index] = cap04;

const rules = new Set(matrix.global_rules ?? []);
for (const rule of [
  'MCFT-CAP-03 completion does not authorize MCFT-CAP-04',
  'MCFT-CAP-04 P0 is governance-only and does not authorize S0 or Runtime source',
  'MCFT-CAP-04 Runtime implementation begins only after P0 effectiveness and S0 merged-main Authorization Gate PASS',
  'one active implementation slice, merge-before-next, and postmerge-verify-before-next',
  'parallel downstream PRs are forbidden',
]) rules.add(rule);
matrix.global_rules = [...rules];
writeJson(MATRIX_PATH, matrix);

let implementationMap = gitShow(MAP_PATH);
const staleStart = implementationMap.indexOf('## MCFT-CAP-03 Finalization candidate');
if (staleStart < 0) throw new Error('STALE_CAP03_FINALIZATION_SECTION_NOT_FOUND');
implementationMap = implementationMap.slice(0, staleStart).trimEnd();
const terminal = `

## MCFT-CAP-03 canonical completion after R4

\`\`\`text
capability: MCFT-CAP-03 — Observation Assimilation and State Innovation
status: COMPLETE
design_status: DESIGN_FROZEN
implementation_status: COMPLETE
authorization_effective: true
runtime_source_authorized: true
closure_effective: true
capability_complete: true
active_delivery_slice_id: null
pending_completion_claims: []
effective_completion_claims: 15
R4-A: MERGED_EFFECTIVE
R4-B: MERGED_EFFECTIVE
R4-C: MERGED_EFFECTIVE
R4 final verification merge: cda1016542300bbc477a1c72023401aaaad954bc
remaining hard nonconformance: 0
remaining unadjudicated contract deviation: 0
active record-set contract: MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2
global State count: 49
global continuation State count: 48
latest checkpoint sequence: 48
latest logical time: 2026-06-03T01:00:00.000Z
next tick: 2026-06-03T02:00:00.000Z
latest successful Forecast: null
successor: MCFT-CAP-04
successor authorized: false
\`\`\`

Detailed authority:

\`\`\`text
${MAIN_VERIFICATION_PATH}
${R4_VERIFICATION_PATH}
${DELIVERY_PATH}
\`\`\`

MCFT-CAP-03 is complete at Level A for Replay-mode observation assimilation and state innovation. This does not establish successful Forecast, Scenario, Recommendation, Policy Evaluation, Decision, AO-ACT, continuous Runtime, live-field operation, Gate A/B/C closure, or Minimum Complete Field Twin.

## MCFT-CAP-04 provisional state after P0

\`\`\`text
capability: MCFT-CAP-04 — 72-Hour Forecast and Three Scenarios
runtime mode: REPLAY
target level: Level A — Deterministic Replay Twin
status: NOT_AUTHORIZED
design_status: FINAL_FROZEN_CANDIDATE_V0_5
implementation_status: NOT_AUTHORIZED
runtime_source_authorized: false
authorization_effective: false
active_delivery_slice_id: null
P0 delivery candidate: ${P0}
next delivery slice: ${S0}
next delivery slice authorized: false
successor: MCFT-CAP-05
successor authorized: false
\`\`\`

P0 records the complete v0.5 task authority and reconciles predecessor SSOT only. It does not authorize S0 or any Runtime source change.

P0 exact boundary:

\`\`\`text
${FILES.join('\n')}
\`\`\`

Complete task authority:

\`\`\`text
${TASK_PATH}
\`\`\`

Runtime source remains forbidden until P0 is merged and passes its merged-main Gate, then S0 is separately merged and passes its merged-main Authorization Gate.
`;
fs.writeFileSync(abs(MAP_PATH), `${implementationMap}${terminal}\n`, 'utf8');

console.log('preserved baseline capability history and reconciled only CAP-03 terminal SSOT plus CAP-04 P0');
