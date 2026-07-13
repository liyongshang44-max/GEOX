// .cap04-s6/materialize_s6.cjs
// Purpose: reconcile S5B merged-main effectiveness and materialize the explicitly authorized S6 single-tick integration candidate.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = '63c8ba7b8dd314c1224ca8de2914b663b3551092';
const BRANCH = 'agent/mcft-cap-04-s6-single-tick-integration-v1';
const S5B = 'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1';
const S6 = 'MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1';
const S7 = 'MCFT-CAP-04.MCFT-04-07-09-10.TWENTY-FOUR-TICK-FORECAST-SCENARIO-RANGE-V1';
const STATUS_S5B_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json';
const STATUS_S6_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-CONTRACT.json';
const NARRATIVE_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-INTEGRATION-V1.md';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const FILES = [
  'apps/server/src/domain/twin_runtime/forecast_scenario_record_set_validator_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts',
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/ports.ts',
  'apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-INTEGRATION-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S6_SINGLE_TICK.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SINGLE_TICK_INTEGRATION_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_single_tick_fixture_v1.ts',
].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const s5bEvidence = {
  pr_number: 2394,
  exact_head_commit: 'f6e30f3e865ac92bc23158c1ac2c55907ce5200a',
  exact_head_ci_run: 29231823745,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2395,
  postmerge_workflow_run: 29232760223,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};

const allowedClaims = [
  'CAP04_SINGLE_EXPLICIT_REPLAY_TICK_ORCHESTRATION_IMPLEMENTED',
  'CAP04_CAP03_HANDOFF_TO_CAP04_A1_B_CHAIN_IMPLEMENTED',
  'CAP04_SUCCESSFUL_72H_FORECAST_A1_COMMIT_IMPLEMENTED',
  'CAP04_THREE_SCENARIO_B_COMMIT_IMPLEMENTED',
  'CAP04_COMPLETED_IDEMPOTENT_ZERO_RECOMPUTE_IMPLEMENTED',
  'CAP04_PENDING_SCENARIO_B_ONLY_RECOVERY_IMPLEMENTED',
  'CAP04_T_PLUS_ONE_HANDOFF_SUCCESS_FORECAST_POINTER_IMPLEMENTED',
  'CAP04_POSTGRESQL_SINGLE_TICK_INTEGRATION_ACCEPTANCE_IMPLEMENTED',
  'CAP04_CANONICAL_MEMBER_READ_CLASSIFICATION_IMPLEMENTED',
];
const preservedNonclaims = [
  'NO_TWENTY_FOUR_TICK_RANGE_EXECUTION',
  'NO_RESTART_BACKFILL_MODE',
  'NO_ROUTE',
  'NO_WEB',
  'NO_SCHEDULER',
  'NO_NEW_MIGRATION',
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

const s5bStatus = readJson(STATUS_S5B_PATH);
s5bStatus.status = 'MERGED_EFFECTIVE';
s5bStatus.implementation_status = 'MERGED_EFFECTIVE';
s5bStatus.effectiveness_condition_satisfied = true;
s5bStatus.merge_evidence = s5bEvidence;
s5bStatus.candidate_validation = {
  ...(s5bStatus.candidate_validation || {}),
  recursive_typecheck: 'PASS',
  positive_scenario_set_builder_acceptance: 'PASS',
  negative_scenario_set_builder_acceptance: 'PASS',
  isolated_postgresql_persistence_acceptance: 'PASS',
  governance_final_gate: 'PASS',
  repository_exact_head_ci: 'PASS',
  repository_exact_head_ci_run: 29231823745,
  postmerge_governance_gate: 'PASS',
  postmerge_workflow_run: 29232760223,
  temporary_workflow_removed: true,
  temporary_diagnostic_evidence_removed: true,
};
writeJson(STATUS_S5B_PATH, s5bStatus);

const contract = {
  schema_version: 'geox_mcft_cap_04_s6_single_tick_contract_v1',
  contract_id: 'MCFT_CAP_04_SINGLE_TICK_FORECAST_SCENARIO_INTEGRATION_V1',
  delivery_slice_id: S6,
  logical_tick_count: 1,
  success_path: [
    'PERSISTED_HANDOFF',
    'CURRENT_EVIDENCE',
    'DYNAMICS',
    'ASSIMILATION',
    'POSTERIOR_STATE',
    'FUTURE_FORCING',
    'FORECAST_72H',
    'A1_COMMIT',
    'THREE_SCENARIOS',
    'B_COMMIT',
    'CANONICAL_READBACK',
    'T_PLUS_ONE_HANDOFF',
  ],
  a_member_count: 8,
  forecast_point_count: 72,
  scenario_option_count: 3,
  scenario_point_count: 216,
  completed_idempotent_replay: 'ZERO_RECOMPUTE_ZERO_WRITE',
  pending_scenario_recovery: 'PRESERVE_A1_RECOMPUTE_AND_COMMIT_B_ONLY',
  runtime_config_pin_required_on_all_paths: true,
  future_forcing_binding_authority_required: true,
  canonical_readback_required: true,
  successful_forecast_pointer_required_in_t_plus_one_handoff: true,
  no_new_migration: true,
  excluded_modes: ['TWENTY_FOUR_TICK_RANGE','RESTART_BACKFILL','ROUTE','WEB','SCHEDULER'],
};
writeJson(CONTRACT_PATH, contract);

const s6Status = {
  schema_version: 'geox_mcft_cap_04_s6_single_tick_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-S6-SINGLE-TICK-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  delivery_slice_id: S6,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'IMPLEMENTATION_CANDIDATE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IMPLEMENTED_PENDING_MERGE',
  activation_fields_status: 'FROZEN',
  explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_effectiveness: s5bEvidence,
  contracts: {
    contract_id: contract.contract_id,
    logical_tick_count: 1,
    a_member_count: 8,
    forecast_point_count: 72,
    scenario_option_count: 3,
    scenario_point_count: 216,
    completed_idempotent_policy: contract.completed_idempotent_replay,
    pending_scenario_recovery_policy: contract.pending_scenario_recovery,
    next_handoff_time: 'T_PLUS_ONE_HOUR',
    no_new_migration: true,
  },
  allowed_claims: allowedClaims,
  preserved_nonclaims: preservedNonclaims,
  exact_changed_file_boundary: FILES,
  candidate_validation: {
    diagnostic_workflow_run: 29236363816,
    recursive_typecheck: 'PASS',
    positive_in_memory_single_tick_acceptance: 'PASS',
    negative_in_memory_single_tick_acceptance: 'PASS',
    isolated_postgresql_single_tick_acceptance: 'PASS',
    governance_final_gate: 'PASS_REQUIRED',
    repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
    temporary_workflow_removed: true,
    temporary_diagnostic_evidence_removed: true,
  },
  effectiveness_condition: 'S6_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S7,
  next_delivery_slice_authorized: false,
};
writeJson(STATUS_S6_PATH, s6Status);

const narrative = `<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S6-SINGLE-TICK-INTEGRATION-V1.md -->

# GEOX MCFT-CAP-04 S6 — Single-Tick Forecast/Scenario Integration V1

## Identity

\`\`\`text
baseline merged main: ${BASELINE}
branch: ${BRANCH}
delivery slice: ${S6}
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
\`\`\`

## Established chain

S6 executes exactly one caller-requested Replay logical tick. The service reads the persisted CAP-03 handoff, validates the pinned CAP-04 Runtime Config, loads current canonical Evidence, reuses the established hourly Dynamics and observation Assimilation mathematics, constructs CAP-04 State source members, selects one coherent 72-hour Future Forcing window, computes one successful 72-hour Forecast, atomically commits A1, computes exactly three Scenario options, atomically commits B, reads both canonical results back, and verifies the T+1 handoff.

## Recovery semantics

A completed A1+B replay returns the existing canonical result before Evidence, Runtime Config, lease, readback or write work. If A1 exists and B is absent, the service revalidates the requested Runtime Config, recomputes deterministic Forecast/Scenario semantics from canonical A1 State plus the same eligible forcing authority, and commits B only. The original terminal tick is never recommitted.

## PostgreSQL proof

The isolated PostgreSQL acceptance seeds a real CAP-03 sequence-48 handoff, compiles the next CAP-04 Runtime Config, runs the production next-tick, Runtime Config and A1/B repositories, verifies one successful A1+B chain, verifies zero duplicate facts on completed replay, injects a B failure after A1, detects the pending Scenario condition, and verifies B-only recovery.

## Preserved nonclaims

S6 does not implement the 24-tick CAP-04 range, restart/backfill, routes, web, scheduler, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
`;
fs.writeFileSync(abs(NARRATIVE_PATH), narrative, 'utf8');

const delivery = readJson(DELIVERY_PATH);
delivery.status = 'S6_IMPLEMENTATION_CANDIDATE';
delivery.baseline_main_commit = BASELINE;
delivery.branch = BRANCH;
delivery.active_delivery_slice_id = S6;
delivery.runtime_source_authorized = true;
delivery.authorization_effective = true;
delivery.s5b_effectiveness = s5bEvidence;
delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S7;
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S5B) Object.assign(slice, {
    status: 'MERGED_EFFECTIVE',
    exact_head_commit: s5bEvidence.exact_head_commit,
    exact_head_ci_run: s5bEvidence.exact_head_ci_run,
    merge_commit: s5bEvidence.merge_commit,
    postmerge_probe_pr_number: s5bEvidence.postmerge_probe_pr_number,
    postmerge_workflow_run: s5bEvidence.postmerge_workflow_run,
    postmerge_gate: 'PASS',
    effectiveness_condition_satisfied: true,
  });
  if (slice.delivery_slice_id === S6) Object.assign(slice, {
    baseline_main_commit: BASELINE,
    branch: BRANCH,
    status: 'IMPLEMENTATION_CANDIDATE',
    activation_fields_status: 'FROZEN',
    explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
    runtime_source_authorized: true,
    allowed_claims: allowedClaims,
    preserved_nonclaims: preservedNonclaims,
    exact_changed_file_boundary: FILES,
    effectiveness_condition: 'S6_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_GATE_PASS',
    effectiveness_condition_satisfied: false,
  });
  if (slice.delivery_slice_id === S7) Object.assign(slice, {
    baseline_main_commit: null,
    branch: null,
    status: 'BLOCKED',
    runtime_source_authorized: false,
  });
}
writeJson(DELIVERY_PATH, delivery);

const authorization = readJson(AUTH_PATH);
Object.assign(authorization, {
  status: 'AUTHORIZATION_EFFECTIVE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  active_delivery_slice_id: S6,
  repository_write_scope: 'S6_SINGLE_TICK_INTEGRATION_ONLY',
  exact_changed_file_boundary: FILES,
  next_authorized_slice_id_after_effectiveness: S7,
  current_blockers: ['MCFT_CAP_04_S6_PR_MERGED','MCFT_CAP_04_S6_MERGED_MAIN_GATE_PASS'],
  preserved_nonclaims: preservedNonclaims,
  s5b_effectiveness: s5bEvidence,
});
authorization.satisfied_conditions = [...new Set([...(authorization.satisfied_conditions || []),
  'MCFT_CAP_04_S5B_MERGED_MAIN_EFFECTIVE',
  'MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S6',
  'MCFT_CAP_04_S6_EXPLICIT_OWNER_ACTIVATION',
])];
writeJson(AUTH_PATH, authorization);

const matrix = readJson(MATRIX_PATH);
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-04 S5B merged-main effective; bounded S6 single-tick integration candidate active',
};
matrix.latest_governance_update = S6;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, {
  status: 'IN_PROGRESS',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  latest_effective_slice_id: S5B,
  latest_effective_slice_merge_commit: BASELINE,
  latest_effective_slice_postmerge_workflow_run: 29232760223,
  active_delivery_slice_id: S6,
  next_delivery_slice_id: S7,
  next_delivery_slice_authorized: false,
  s6_status_ref: STATUS_S6_PATH,
});
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S5B) Object.assign(slice, { status: 'MERGED_EFFECTIVE', merge_commit: BASELINE, postmerge_workflow_run: 29232760223, postmerge_gate: 'PASS', effectiveness_condition_satisfied: true });
  if (slice.delivery_slice_id === S6) Object.assign(slice, { baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE', activation_fields_status: 'FROZEN', runtime_source_authorized: true, exact_changed_file_boundary: FILES, effectiveness_condition: 'S6_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S6_GATE_PASS', effectiveness_condition_satisfied: false });
  if (slice.delivery_slice_id === S7) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false });
}
writeJson(MATRIX_PATH, matrix);

const markerStart = '<!-- MCFT-CAP-04-S6-SINGLE-TICK-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S6-SINGLE-TICK-END -->';
let map = fs.readFileSync(abs(MAP_PATH), 'utf8');
const oldStart = map.indexOf(markerStart);
const oldEnd = map.indexOf(markerEnd);
if (oldStart >= 0 && oldEnd >= oldStart) map = map.slice(0, oldStart) + map.slice(oldEnd + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S6 single-tick Forecast/Scenario integration candidate

\`\`\`text
baseline merged main: ${BASELINE}
S5B status: MERGED_EFFECTIVE
S5B postmerge workflow: 29232760223
active delivery slice: ${S6}
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: ${S7}
next delivery slice authorized: false
\`\`\`

Established in this bounded slice:

\`\`\`text
one explicit persisted-handoff Replay tick
current Evidence -> Dynamics -> Assimilation -> posterior State
matching Future Forcing -> successful 72h Forecast -> A1 commit
three Scenario options -> B commit
canonical A/B readback
completed-idempotent zero recomputation
pending-Scenario B-only recovery
T+1 handoff with successful Forecast pointer
real PostgreSQL integration acceptance
\`\`\`

The 24-tick range, restart/backfill, route, web and scheduler remain outside S6.

${markerEnd}
`;
fs.writeFileSync(abs(MAP_PATH), `${map}\n\n${section}`, 'utf8');

console.log(`materialized CAP-04 S6 governance for ${FILES.length} final files`);
