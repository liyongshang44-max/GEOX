// .cap04-p0-materialize/materialize_full_cap04_p0.cjs
// Purpose: install the complete handed-off MCFT-CAP-04 v0.5 task and reconcile the governance-only P0 artifacts.
// This file is removed by the materializer workflow before the candidate commit is pushed.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = process.cwd();
const BASELINE = 'eca0d053045db59982ad20a6e0421f72ae16f804';
const BRANCH = 'agent/mcft-cap-04-p0-ssot-v1';
const P0 = 'MCFT-CAP-04.P0.CAP-03-GLOBAL-SSOT-RECONCILIATION-V1';
const S0 = 'MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const TASK_SHA256 = 'ea63e92a64b760b84c49428b1d3a245ce5cd94bb08daa9c6b971a53861b90a63';

const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';
const TASK_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-TASK.md';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-P0-STATUS.json';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_P0_PREDECESSOR_SSOT.cjs';
const MAIN_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-MAIN-VERIFICATION.json';
const R4_VERIFICATION_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-FINAL-VERIFICATION.json';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const FILES = [MAP_PATH, MATRIX_PATH, TASK_PATH, STATUS_PATH, GATE_PATH].sort();

const absolute = (relativePath) => path.join(ROOT, relativePath);
const readText = (relativePath) => fs.readFileSync(absolute(relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const writeText = (relativePath, value) => {
  fs.mkdirSync(path.dirname(absolute(relativePath)), { recursive: true });
  fs.writeFileSync(absolute(relativePath), value, 'utf8');
};
const writeJson = (relativePath, value) => writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);

const mainVerification = readJson(MAIN_VERIFICATION_PATH);
const r4Verification = readJson(R4_VERIFICATION_PATH);
const delivery = readJson(DELIVERY_PATH);

if (mainVerification.status !== 'VERIFIED_ON_MAIN' ||
    mainVerification.verified_on_main !== true ||
    mainVerification.closure_effective !== true ||
    mainVerification.capability_complete !== true ||
    mainVerification.effective_completion_claims?.length !== 15) {
  throw new Error('CAP_03_MAIN_VERIFICATION_NOT_EFFECTIVE');
}
if (r4Verification.status !== 'VERIFIED_ON_MAIN' ||
    r4Verification.verified_on_main !== true ||
    r4Verification.effectiveness_condition_satisfied !== true ||
    r4Verification.task_conformance?.remaining_nonconformant_count !== 0 ||
    r4Verification.task_conformance?.remaining_unadjudicated_contract_deviation_count !== 0) {
  throw new Error('CAP_03_R4_FINAL_VERIFICATION_NOT_EFFECTIVE');
}
if (delivery.status !== 'CAPABILITY_COMPLETE' || delivery.active_delivery_slice_id !== null) {
  throw new Error('CAP_03_DELIVERY_SSOT_NOT_TERMINAL');
}

const chunkPaths = [
  '.cap04-p0-materialize/task_v05_gz_00',
  '.cap04-p0-materialize/task_v05_gz_01',
  '.cap04-p0-materialize/task_v05_gz_02',
];
const encoded = chunkPaths.map(readText).join('').replace(/\s+/g, '');
const taskBuffer = zlib.gunzipSync(Buffer.from(encoded, 'base64'));
const task = taskBuffer.toString('utf8');
const taskHash = crypto.createHash('sha256').update(taskBuffer).digest('hex');
if (taskHash !== TASK_SHA256) throw new Error(`TASK_SHA256_MISMATCH:${taskHash}`);
if (taskBuffer.byteLength !== 77603) throw new Error(`TASK_BYTE_LENGTH_MISMATCH:${taskBuffer.byteLength}`);
if (task.split(/\r?\n/).length !== 3724) throw new Error('TASK_LINE_COUNT_MISMATCH');
writeText(TASK_PATH, task);

const matrix = readJson(MATRIX_PATH);
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
if (!cap03) throw new Error('CAP_03_MATRIX_ENTRY_MISSING');
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
});

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
  contributing_owner_work_package_ids: [
    'MCFT-02', 'MCFT-03', 'MCFT-04', 'MCFT-05',
    'MCFT-06', 'MCFT-07', 'MCFT-08', 'MCFT-10',
  ],
  excluded_owner_work_package_ids: [
    'MCFT-11', 'MCFT-12', 'MCFT-13', 'MCFT-14',
    'MCFT-15', 'MCFT-16', 'MCFT-17', 'MCFT-18',
  ],
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
    'NO_MCFT_CAP_04_AUTHORIZATION',
    'NO_MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZATION',
    'NO_SUCCESSFUL_FORECAST_CREATED_BY_CAP_04',
    'NO_72_HOUR_FORECAST_CREATED_BY_CAP_04',
    'NO_SCENARIO_CREATED_BY_CAP_04',
    'NO_FORECAST_RESIDUAL',
    'NO_RECOMMENDATION',
    'NO_POLICY_EVALUATION',
    'NO_DECISION',
    'NO_AO_ACT',
    'NO_CONTINUOUS_RUNTIME',
    'NO_CONTINUOUS_SCHEDULER',
    'NO_LIVE_FIELD_CLAIM',
    'NO_MCFT_GATE_A_CLOSURE',
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

let implementationMap = readText(MAP_PATH);
const start = implementationMap.indexOf('## 5. MCFT-CAP-04');
const end = implementationMap.indexOf('## 6. CAP-04', start);
if (start < 0 || end < 0) throw new Error('IMPLEMENTATION_MAP_CAP_04_SECTION_NOT_FOUND');
const section = `## 5. MCFT-CAP-04 provisional state after P0

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

P0 is governance-only. It reconciles the global CAP-03 terminal state and records the complete v0.5 task authority. It does not authorize S0 and does not authorize Runtime source changes.

P0 exact boundary:

\`\`\`text
${FILES.join('\n')}
\`\`\`

Runtime source remains forbidden until both conditions are true:

\`\`\`text
1. P0 PR merged to main and merged-main P0 Gate PASS
2. S0 authorization/predecessor-lock PR merged to main and merged-main Authorization Gate PASS
\`\`\`

Only after S0 effectiveness may the first CAP-04 Runtime delivery slice set:

\`\`\`text
design_status: DESIGN_FROZEN
implementation_status: READY_FOR_IMPLEMENTATION
runtime_source_authorized: true
\`\`\`

Complete task authority:

\`\`\`text
${TASK_PATH}
\`\`\`

`;
implementationMap = `${implementationMap.slice(0, start)}${section}${implementationMap.slice(end)}`;
writeText(MAP_PATH, implementationMap);

const status = {
  schema_version: 'geox_mcft_cap_04_p0_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-P0-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  display_alias: 'MCFT-4',
  canonical_name: '72-Hour Forecast and Three Scenarios',
  runtime_mode: 'REPLAY',
  target_completion_level: 'Level A — Deterministic Replay Twin',
  delivery_slice_id: P0,
  slice_kind: 'GOVERNANCE_ONLY',
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'P0_RECONCILIATION_CANDIDATE',
  design_status: 'FINAL_FROZEN_CANDIDATE_V0_5',
  implementation_status: 'NOT_AUTHORIZED',
  runtime_source_authorized: false,
  cap_04_authorized: false,
  cap_04_active_delivery_slice_id: null,
  task_ref: TASK_PATH,
  task_sha256: TASK_SHA256,
  task_utf8_bytes: 77603,
  task_line_count: 3723,
  predecessor_capability_line_id: 'MCFT-CAP-03',
  predecessor_authority: {
    main_verification_ref: MAIN_VERIFICATION_PATH,
    r4_final_verification_ref: R4_VERIFICATION_PATH,
    capability_status: 'COMPLETE',
    verified_on_main: true,
    closure_effective: true,
    effective_completion_claim_count: 15,
    active_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
    r4_verification_status: 'VERIFIED_ON_MAIN',
    r4_verified_main_commit: 'cda1016542300bbc477a1c72023401aaaad954bc',
    latest_repository_main_commit: BASELINE,
  },
  persisted_runtime_handoff_expectation: {
    global_state_count: 49,
    global_continuation_state_count: 48,
    checkpoint_sequence: 48,
    latest_logical_time: '2026-06-03T01:00:00.000Z',
    next_tick_logical_time: '2026-06-03T02:00:00.000Z',
    latest_successful_forecast_ref: null,
  },
  allowed_claims: [
    'MCFT_CAP_03_GLOBAL_SSOT_RECONCILED_FOR_CAP_04_PREPARATION',
    'MCFT_CAP_03_R4_FINAL_VERIFICATION_EFFECTIVE',
    'MCFT_CAP_04_COMPLETE_TASK_V0_5_RECORDED',
    'MCFT_CAP_04_P0_GOVERNANCE_CANDIDATE_RECORDED',
  ],
  preserved_nonclaims: cap04.preserved_nonclaims,
  exact_changed_file_boundary: FILES,
  effectiveness_condition: 'P0_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_P0_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S0,
  next_delivery_slice_authorized: false,
  successor_capability_line_id: 'MCFT-CAP-05',
  successor_authorized: false,
};
writeJson(STATUS_PATH, status);

console.log(`materialized complete CAP-04 v0.5 task ${taskHash}`);
console.log(`reconciled P0 governance artifacts with exact ${FILES.length}-file final boundary`);
