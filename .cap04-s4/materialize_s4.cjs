// .cap04-s4/materialize_s4.cjs
// Purpose: reconcile S3 merged-main effectiveness, freeze the authorized S4 activation, and materialize bounded pure three-Scenario math governance artifacts.
// This temporary file is deleted before the final candidate commit.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = '4a1c9fde05594c97fb949e062df77375a1a27365';
const BRANCH = 'agent/mcft-cap-04-s4-pure-three-scenario-math-v1';
const S3 = 'MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1';
const S4 = 'MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1';
const S5 = 'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1';
const S3_STATUS = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json';
const S4_STATUS = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json';
const CONTRACT = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-MATH-CONTRACT.json';
const NARRATIVE = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-THREE-SCENARIO-MATH-V1.md';
const DELIVERY = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const FILES = [
  'apps/server/src/domain/twin_runtime/pure_three_scenario_math_v1.ts',
  'apps/server/src/domain/twin_runtime/scenario_math_contracts_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-THREE-SCENARIO-MATH-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SCENARIO-MATH-CONTRACT.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S4_PURE_SCENARIO_MATH.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_SCENARIO_MATH_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_scenario_math_fixture_v1.ts',
].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const s3Evidence = {
  pr_number: 2388,
  exact_head_commit: '083a47c50130b84dbc5aad18faf5f115b437112d',
  exact_head_ci_run: 29225068719,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2389,
  postmerge_workflow_run: 29225560206,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};

const allowedClaims = [
  'CAP04_PURE_THREE_OPTION_SCENARIO_MATH_IMPLEMENTED',
  'CAP04_NO_ACTION_EXACT_FORECAST_COPY_IMPLEMENTED',
  'CAP04_IMMEDIATE_15MM_AND_25MM_IRRIGATION_ADAPTERS_IMPLEMENTED',
  'CAP04_SCENARIO_FIXED_POINT_MASS_BALANCE_IMPLEMENTED',
  'CAP04_SCENARIO_ZERO_IRRIGATION_VARIANCE_IMPLEMENTED',
  'CAP04_STRICT_AWF_STRESS_CONTRACT_IMPLEMENTED',
  'CAP04_DIFFERENCE_FROM_NO_ACTION_IMPLEMENTED',
  'CAP04_SCENARIO_TRAJECTORY_OPTION_AND_MATH_HASHES_IMPLEMENTED',
  'CAP04_24_TICK_95_HOUR_SCENARIO_MATH_FIXTURE_IMPLEMENTED',
];
const nonclaims = [
  'NO_CANONICAL_SCENARIO_OBJECT_APPEND',
  'NO_A1_A2_B_PERSISTENCE',
  'NO_RECORD_SET_BUILDERS',
  'NO_MIGRATION',
  'NO_PROJECTION',
  'NO_ROUTE',
  'NO_SCHEDULER',
  'NO_CALIBRATED_STRESS_PROBABILITY',
  'NO_EXECUTION_COMPLIANCE_PROBABILITY',
  'NO_EXECUTION_EVIDENCE',
  'NO_FORECAST_RESIDUAL',
  'NO_RECOMMENDATION',
  'NO_POLICY_EVALUATION',
  'NO_DECISION',
  'NO_AO_ACT',
  'NO_MODEL_ACTIVATION',
  'NO_CONTINUOUS_RUNTIME',
  'NO_LIVE_FIELD_CLAIM',
  'NO_MCFT_GATE_A_CLOSURE',
  'NO_MINIMUM_COMPLETE_FIELD_TWIN_CLAIM',
];

const s3 = readJson(S3_STATUS);
s3.status = 'MERGED_EFFECTIVE';
s3.implementation_status = 'MERGED_EFFECTIVE';
s3.effectiveness_condition_satisfied = true;
s3.merge_evidence = s3Evidence;
s3.candidate_validation = {
  ...(s3.candidate_validation || {}),
  recursive_typecheck: 'PASS',
  positive_forecast_math_acceptance: 'PASS',
  negative_forecast_math_acceptance: 'PASS',
  governance_final_gate: '77_PASS_0_FAIL',
  repository_exact_head_ci: 'PASS',
  repository_exact_head_ci_run: 29225068719,
  postmerge_governance_gate: 'PASS',
  postmerge_workflow_run: 29225560206,
  temporary_workflow_removed: true,
};
writeJson(S3_STATUS, s3);

const contract = {
  schema_version: 'geox_mcft_cap_04_scenario_math_contract_v1',
  contract_id: 'MCFT_CAP_04_PURE_THREE_SCENARIO_MATH_V1',
  delivery_slice_id: S4,
  scenario_policy_id: 'THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1',
  option_order: ['NO_ACTION','IRRIGATE_NOW_15MM','IRRIGATE_NOW_25MM'],
  trajectory_point_count_per_option: 72,
  no_action_mode: 'EXACT_SOURCE_FORECAST_POINTS_DEEP_COPY',
  irrigation_options_mm: ['15.000000','25.000000'],
  application_horizon: 1,
  application_interval: '(T,T+PT1H]',
  epistemic_status: 'ASSUMED',
  execution_status: 'NOT_EXECUTED',
  application_efficiency_policy_id: 'CONTROLLED_SCENARIO_APPLICATION_EFFICIENCY_V1',
  application_efficiency_fraction: '1.000000',
  scenario_assumed_irrigation_variance_mm2: '0.000000',
  stress_threshold_policy_id: 'CONTROLLED_AWF_STRESS_THRESHOLD_V1',
  stress_threshold: '0.350000',
  stress_comparator: 'STRICT_LESS_THAN',
  forcing_reselection_forbidden: true,
  fake_execution_authority_forbidden: true,
  difference_from_no_action_fields: ['final_storage_delta_mm','minimum_awf_delta','stress_hour_count_delta','total_irrigation_delta_mm','total_drainage_delta_mm','total_overflow_delta_mm'],
  standard_fixture: {
    tick_count: 24,
    option_count_per_tick: 3,
    target_union_hour_count: 95,
    target_union_start: '2026-06-03T03:00:00.000Z',
    target_union_end: '2026-06-07T01:00:00.000Z',
  },
};
writeJson(CONTRACT, contract);

const s4 = {
  schema_version: 'geox_mcft_cap_04_s4_pure_scenario_math_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  delivery_slice_id: S4,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'IMPLEMENTATION_CANDIDATE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IMPLEMENTED_PENDING_MERGE',
  activation_fields_status: 'FROZEN',
  explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_effectiveness: s3Evidence,
  contracts: {
    contract_id: contract.contract_id,
    scenario_policy_id: contract.scenario_policy_id,
    option_order: contract.option_order,
    option_count: 3,
    trajectory_point_count_per_option: 72,
    application_efficiency_fraction: '1.000000',
    stress_threshold: '0.350000',
    standard_tick_count: 24,
    target_union_hour_count: 95,
  },
  allowed_claims: allowedClaims,
  preserved_nonclaims: nonclaims,
  exact_changed_file_boundary: FILES,
  candidate_validation: {
    materializer_workflow_run: Number(process.env.GITHUB_RUN_ID || 0),
    recursive_typecheck: 'PASS_REQUIRED',
    positive_scenario_math_acceptance: 'PASS_REQUIRED',
    negative_scenario_math_acceptance: 'PASS_REQUIRED',
    governance_final_gate: 'PASS_REQUIRED',
    repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
    temporary_workflow_removed: true,
  },
  effectiveness_condition: 'S4_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S4_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S5,
  next_delivery_slice_authorized: false,
};
writeJson(S4_STATUS, s4);

const narrative = `<!-- ${NARRATIVE} -->

# GEOX MCFT-CAP-04 S4 — Pure Three-Scenario Math V1

## Identity

\`\`\`text
baseline merged main: ${BASELINE}
branch: ${BRANCH}
delivery slice: ${S4}
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
\`\`\`

## Established boundary

S4 consumes one completed source Forecast, its already-frozen forcing trace, and one pinned Runtime Config. It emits exactly three pure mathematical options in this order: \`NO_ACTION\`, \`IRRIGATE_NOW_15MM\`, \`IRRIGATE_NOW_25MM\`.

\`NO_ACTION.trajectory_points\` is an exact deep copy of source Forecast points. The irrigation options inject deterministic assumed irrigation only at horizon 1. Effective irrigation equals requested irrigation multiplied by the Runtime Config efficiency value \`1.000000\`.

Scenario irrigation is \`ASSUMED\` and \`NOT_EXECUTED\`. It has zero modeled irrigation variance. Execution compliance, equipment and application-efficiency uncertainty are not modeled. The Runtime never creates or consumes receipt, as-executed or execution Evidence objects in this slice.

Stress is true only when available-water fraction is strictly less than \`0.350000\`. Equality is no-stress. Difference fields are option metric minus exact \`NO_ACTION\` metric.

## Preserved nonclaims

S4 does not append canonical Scenario objects, build A1/A2 record sets, persist A1/A2/B, add migrations, projections, routes or schedulers, or claim recommendation, decision, execution, calibration, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
`;
fs.writeFileSync(abs(NARRATIVE), narrative, 'utf8');

const delivery = readJson(DELIVERY);
delivery.status = 'S4_IMPLEMENTATION_CANDIDATE';
delivery.baseline_main_commit = BASELINE;
delivery.branch = BRANCH;
delivery.active_delivery_slice_id = S4;
delivery.runtime_source_authorized = true;
delivery.authorization_effective = true;
delivery.s3_effectiveness = s3Evidence;
delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S5;
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S3) Object.assign(slice, { status: 'MERGED_EFFECTIVE', exact_head_commit: s3Evidence.exact_head_commit, exact_head_ci_run: s3Evidence.exact_head_ci_run, merge_commit: BASELINE, postmerge_probe_pr_number: 2389, postmerge_workflow_run: 29225560206, postmerge_gate: 'PASS', effectiveness_condition_satisfied: true });
  if (slice.delivery_slice_id === S4) Object.assign(slice, { baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE', activation_fields_status: 'FROZEN', explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION', runtime_source_authorized: true, allowed_claims: allowedClaims, preserved_nonclaims: nonclaims, exact_changed_file_boundary: FILES, effectiveness_condition: 'S4_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S4_GATE_PASS', effectiveness_condition_satisfied: false });
  if (slice.delivery_slice_id === S5) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false, baseline_main_commit: null, branch: null });
}
writeJson(DELIVERY, delivery);

const auth = readJson(AUTH);
Object.assign(auth, {
  status: 'AUTHORIZATION_EFFECTIVE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  active_delivery_slice_id: S4,
  repository_write_scope: 'S4_PURE_SCENARIO_MATH_ONLY',
  exact_changed_file_boundary: FILES,
  next_authorized_slice_id_after_effectiveness: S5,
  current_blockers: ['MCFT_CAP_04_S4_PR_MERGED','MCFT_CAP_04_S4_MERGED_MAIN_GATE_PASS'],
  preserved_nonclaims: nonclaims,
  s3_effectiveness: s3Evidence,
});
writeJson(AUTH, auth);

const matrix = readJson(MATRIX);
matrix.baseline = { branch: 'main', commit: BASELINE, meaning: 'MCFT-CAP-04 S3 merged-main effective; bounded S4 pure Scenario math candidate active' };
matrix.latest_governance_update = S4;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, { status: 'IN_PROGRESS', design_status: 'DESIGN_FROZEN', implementation_status: 'IN_PROGRESS', authorization_effective: true, runtime_source_authorized: true, latest_effective_slice_id: S3, latest_effective_slice_merge_commit: BASELINE, latest_effective_slice_postmerge_workflow_run: 29225560206, active_delivery_slice_id: S4, next_delivery_slice_id: S5, next_delivery_slice_authorized: false, s4_status_ref: S4_STATUS });
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S3) Object.assign(slice, { status: 'MERGED_EFFECTIVE', merge_commit: BASELINE, postmerge_workflow_run: 29225560206, postmerge_gate: 'PASS', effectiveness_condition_satisfied: true });
  if (slice.delivery_slice_id === S4) Object.assign(slice, { baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE', activation_fields_status: 'FROZEN', runtime_source_authorized: true, exact_changed_file_boundary: FILES, effectiveness_condition: 'S4_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S4_GATE_PASS', effectiveness_condition_satisfied: false });
  if (slice.delivery_slice_id === S5) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false });
}
writeJson(MATRIX, matrix);

const markerStart = '<!-- MCFT-CAP-04-S4-PURE-SCENARIO-MATH-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S4-PURE-SCENARIO-MATH-END -->';
let map = fs.readFileSync(abs(MAP), 'utf8');
const start = map.indexOf(markerStart);
const end = map.indexOf(markerEnd);
if (start >= 0 && end >= start) map = map.slice(0, start) + map.slice(end + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S4 pure three-Scenario math candidate

\`\`\`text
baseline merged main: ${BASELINE}
S3 status: MERGED_EFFECTIVE
S3 postmerge workflow: 29225560206
active delivery slice: ${S4}
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: ${S5}
next delivery slice authorized: false
\`\`\`

Established: exact NO_ACTION Forecast copy; immediate 15/25 mm assumed irrigation; deterministic efficiency, stress, deltas and hashes; 24-tick/95-hour pure Scenario fixture. Canonical append, record-set builders and persistence remain outside S4.

${markerEnd}
`;
fs.writeFileSync(abs(MAP), `${map}\n\n${section}`, 'utf8');

console.log(`materialized CAP-04 S4 governance for ${FILES.length} final files`);
