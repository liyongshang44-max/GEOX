// .cap04-s2/materialize_s2.cjs
// Purpose: reconcile S1 merged-main effectiveness, freeze the explicitly authorized S2 activation, and materialize the bounded Future Forcing candidate governance artifacts.
// This temporary file is deleted before the final candidate commit.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = '13f8bf3231cb41c809d235096ca7cfda9e201944';
const BRANCH = 'agent/mcft-cap-04-s2-future-forcing-window-v1';
const S1 = 'MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1';
const S2 = 'MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1';
const S3 = 'MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1';
const STATUS_S1_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json';
const STATUS_S2_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-CONTRACT.json';
const NARRATIVE_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-WINDOW-V1.md';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const FILES = [
  'apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.ts',
  'apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-WINDOW-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S2_FUTURE_FORCING.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_future_forcing_fixture_v1.ts',
].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const ensureParent = (file) => fs.mkdirSync(path.dirname(abs(file)), { recursive: true });

const s1Evidence = {
  pr_number: 2384,
  exact_head_commit: '7347909b1d922dfd85f56a9967ffa5905778cb6c',
  exact_head_ci_run: 29222549931,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2385,
  postmerge_workflow_run: 29222992520,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};

const allowedClaims = [
  'CAP04_JOINT_MATCHING_FORCING_CYCLE_SELECTOR_IMPLEMENTED',
  'CAP04_FORCING_CYCLE_KEY_DERIVATION_AND_EQUALITY_IMPLEMENTED',
  'CAP04_EXACT_72_POINT_FORCING_DTO_IMPLEMENTED',
  'CAP04_NO_FUTURE_LEAKAGE_IMPLEMENTED',
  'CAP04_FORCING_DUPLICATE_AND_CONFLICT_RULES_IMPLEMENTED',
  'CAP04_FORCING_WINDOW_HASH_IMPLEMENTED',
  'CAP04_24_TICK_95_HOUR_FORCING_FIXTURE_IMPLEMENTED',
];

const preservedNonclaims = [
  'NO_FORECAST_EQUATIONS',
  'NO_SCENARIO_EQUATIONS',
  'NO_SUCCESSFUL_FORECAST_CREATED_BY_S2',
  'NO_SCENARIO_CREATED_BY_S2',
  'NO_A1_A2_B_PERSISTENCE',
  'NO_MIGRATION',
  'NO_PROJECTION',
  'NO_ROUTE',
  'NO_SCHEDULER',
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

const s1Status = readJson(STATUS_S1_PATH);
s1Status.status = 'MERGED_EFFECTIVE';
s1Status.implementation_status = 'MERGED_EFFECTIVE';
s1Status.effectiveness_condition_satisfied = true;
s1Status.merge_evidence = s1Evidence;
s1Status.candidate_validation = {
  ...(s1Status.candidate_validation || {}),
  recursive_typecheck: 'PASS',
  positive_contract_acceptance: '9_PASS_0_FAIL',
  negative_contract_acceptance: '14_PASS_0_FAIL',
  isolated_postgresql_d_transaction_acceptance: '6_PASS_0_FAIL',
  governance_final_gate: '79_PASS_0_FAIL',
  repository_exact_head_ci: 'PASS',
  repository_exact_head_ci_run: 29222549931,
  postmerge_governance_gate: 'PASS',
  postmerge_workflow_run: 29222992520,
  temporary_workflow_removed: true,
};
writeJson(STATUS_S1_PATH, s1Status);

const contract = {
  schema_version: 'geox_mcft_cap_04_future_forcing_contract_v1',
  contract_id: 'MCFT_CAP_04_FUTURE_FORCING_WINDOW_V1',
  delivery_slice_id: S2,
  pair_policy_id: 'JOINT_MATCHING_FORCING_CYCLE_V1',
  forcing_policy_id: 'EXACT_72_HOUR_ASSUMPTION_WINDOW_V1',
  fallback_policy_id: 'NO_CROSS_SNAPSHOT_STITCHING_V1',
  freshness_policy_id: 'LATEST_AVAILABLE_COMPLETE_PAIR_AT_T_V1',
  selection_policy_id: 'FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE',
  point_count: 72,
  step_hours: 1,
  valid_interval: '(T,T+72H]',
  forcing_cycle_key_fields: ['scope','issued_at','available_to_runtime_at','valid_from','valid_to'],
  pair_order: ['available_to_runtime_at_desc','issued_at_desc','weather_source_record_id_asc','et0_source_record_id_asc'],
  snapshot_identity_authority: {
    snapshot_ref: 'Evidence.source_record_id',
    snapshot_hash: 'Evidence.source_record_hash',
  },
  duplicate_policy: {
    identical_semantic_identity_same_payload: 'COLLAPSE_DETERMINISTICALLY',
    identical_semantic_identity_different_payload: 'CONFLICTING_FORCING_SNAPSHOT',
    multiple_noncollapsible_same_kind_in_cycle: 'CONFLICTING_FORCING_CYCLE',
  },
  incomplete_pair_outcome: 'A2_BLOCKED_FORECAST_ELIGIBLE_REASON_NO_COMPLETE_MATCHING_FORCING_CYCLE',
  no_future_leakage: true,
  forbidden_inputs_after_t: ['observed_rainfall','ingested_actual_et0','soil_observation','weather_forecast_revision','execution_receipt','actual_outcome'],
  forcing_window_hash_basis: 'COMPLETE_72_POINT_CANONICAL_FORCING_DTO',
  standard_fixture: {
    first_logical_time: '2026-06-03T02:00:00.000Z',
    last_logical_time: '2026-06-04T01:00:00.000Z',
    tick_count: 24,
    target_union_start: '2026-06-03T03:00:00.000Z',
    target_union_end: '2026-06-07T01:00:00.000Z',
    target_union_hour_count: 95,
  },
};
ensureParent(CONTRACT_PATH);
writeJson(CONTRACT_PATH, contract);

const s2Status = {
  schema_version: 'geox_mcft_cap_04_s2_future_forcing_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  delivery_slice_id: S2,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'IMPLEMENTATION_CANDIDATE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IMPLEMENTED_PENDING_MERGE',
  activation_fields_status: 'FROZEN',
  explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_effectiveness: s1Evidence,
  contracts: {
    contract_id: contract.contract_id,
    pair_policy_id: contract.pair_policy_id,
    forcing_policy_id: contract.forcing_policy_id,
    fallback_policy_id: contract.fallback_policy_id,
    freshness_policy_id: contract.freshness_policy_id,
    selection_policy_id: contract.selection_policy_id,
    forcing_point_count: 72,
    standard_tick_count: 24,
    target_union_hour_count: 95,
    conflict_snapshot_code: 'CONFLICTING_FORCING_SNAPSHOT',
    conflict_cycle_code: 'CONFLICTING_FORCING_CYCLE',
    blocked_reason_code: 'NO_COMPLETE_MATCHING_FORCING_CYCLE',
  },
  allowed_claims: allowedClaims,
  preserved_nonclaims: preservedNonclaims,
  exact_changed_file_boundary: FILES,
  candidate_validation: {
    materializer_workflow_run: Number(process.env.GITHUB_RUN_ID || 0),
    recursive_typecheck: 'PASS_REQUIRED',
    positive_future_forcing_acceptance: 'PASS_REQUIRED',
    negative_future_forcing_acceptance: 'PASS_REQUIRED',
    governance_final_gate: 'PASS_REQUIRED',
    repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
    temporary_workflow_removed: true,
  },
  effectiveness_condition: 'S2_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S2_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S3,
  next_delivery_slice_authorized: false,
};
writeJson(STATUS_S2_PATH, s2Status);

const narrative = `<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FUTURE-FORCING-WINDOW-V1.md -->

# GEOX MCFT-CAP-04 S2 — Future Forcing Window V1

## Identity

\`\`\`text
baseline merged main: ${BASELINE}
branch: ${BRANCH}
delivery slice: ${S2}
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
\`\`\`

## Established boundary

S2 deterministically forms weather/ET0 pairs only when both canonical Evidence snapshots share the same forcing-cycle basis: exact scope, issued time, Runtime availability time, valid-from and valid-to. Pair selection occurs after identical-duplicate collapse and orders complete pairs by availability descending, issue time descending, then weather and ET0 source-record identifiers ascending.

Each selected pair produces exactly 72 hourly forcing points covering \`(T,T+72H]\`. The complete point array determines \`forcing_window_hash\`. Snapshot references and hashes are the canonical Evidence \`source_record_id\` and \`source_record_hash\` values.

## No-future-leakage

At logical time T, snapshots issued or available after T are ineligible. Observed rainfall, actual ET0, soil observations, forecast revisions, execution receipts and outcome data after T are outside the selector authority. S2 never stitches weather and ET0 across cycles or across incomplete snapshots.

## Failure semantics

An absent complete pair produces the explicit blocked reason \`NO_COMPLETE_MATCHING_FORCING_CYCLE\`. Conflicting duplicate payloads raise \`CONFLICTING_FORCING_SNAPSHOT\`; multiple non-collapsible same-kind snapshots in one cycle raise \`CONFLICTING_FORCING_CYCLE\`. Conflicts are malformed input and do not create A1/A2 canonical records.

## Standard fixture

The 24 logical ticks from \`2026-06-03T02:00:00.000Z\` through \`2026-06-04T01:00:00.000Z\` each select an independent complete pair. Their Forecast target union contains exactly 95 hours, from \`2026-06-03T03:00:00.000Z\` through \`2026-06-07T01:00:00.000Z\`.

## Preserved nonclaims

S2 does not implement Forecast equations, Scenario equations, A1/A2/B persistence, migration, projection, route, scheduler, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
`;
fs.writeFileSync(abs(NARRATIVE_PATH), narrative, 'utf8');

const delivery = readJson(DELIVERY_PATH);
delivery.status = 'S2_IMPLEMENTATION_CANDIDATE';
delivery.baseline_main_commit = BASELINE;
delivery.branch = BRANCH;
delivery.active_delivery_slice_id = S2;
delivery.runtime_source_authorized = true;
delivery.authorization_effective = true;
delivery.s1_effectiveness = s1Evidence;
delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S3;
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S1) {
    Object.assign(slice, {
      status: 'MERGED_EFFECTIVE',
      exact_head_commit: s1Evidence.exact_head_commit,
      exact_head_ci_run: s1Evidence.exact_head_ci_run,
      merge_commit: s1Evidence.merge_commit,
      postmerge_probe_pr_number: s1Evidence.postmerge_probe_pr_number,
      postmerge_workflow_run: s1Evidence.postmerge_workflow_run,
      postmerge_gate: 'PASS',
      effectiveness_condition_satisfied: true,
    });
  }
  if (slice.delivery_slice_id === S2) {
    Object.assign(slice, {
      baseline_main_commit: BASELINE,
      branch: BRANCH,
      status: 'IMPLEMENTATION_CANDIDATE',
      activation_fields_status: 'FROZEN',
      explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
      runtime_source_authorized: true,
      allowed_claims: allowedClaims,
      preserved_nonclaims: preservedNonclaims,
      exact_changed_file_boundary: FILES,
      effectiveness_condition: 'S2_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S2_GATE_PASS',
      effectiveness_condition_satisfied: false,
    });
  }
  if (slice.delivery_slice_id === S3) {
    slice.status = 'BLOCKED';
    slice.runtime_source_authorized = false;
    slice.baseline_main_commit = null;
    slice.branch = null;
  }
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
  active_delivery_slice_id: S2,
  repository_write_scope: 'S2_FUTURE_FORCING_ONLY',
  exact_changed_file_boundary: FILES,
  next_authorized_slice_id_after_effectiveness: S3,
  current_blockers: ['MCFT_CAP_04_S2_PR_MERGED','MCFT_CAP_04_S2_MERGED_MAIN_GATE_PASS'],
  preserved_nonclaims: preservedNonclaims,
  satisfied_conditions: [
    'MCFT_CAP_04_S0_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S1_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_PREDECESSOR_CANONICAL_IDENTITY_LOCK_COMPLETE',
    'MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S2',
    'MCFT_CAP_04_S2_EXPLICIT_OWNER_ACTIVATION',
  ],
  s1_effectiveness: s1Evidence,
});
writeJson(AUTH_PATH, authorization);

const matrix = readJson(MATRIX_PATH);
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-04 S1 merged-main effective; bounded S2 Future Forcing implementation candidate active',
};
matrix.latest_governance_update = S2;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, {
  status: 'IN_PROGRESS',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  latest_effective_slice_id: S1,
  latest_effective_slice_merge_commit: BASELINE,
  latest_effective_slice_postmerge_workflow_run: 29222992520,
  active_delivery_slice_id: S2,
  next_delivery_slice_id: S3,
  next_delivery_slice_authorized: false,
  s2_status_ref: STATUS_S2_PATH,
});
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S1) Object.assign(slice, { status: 'MERGED_EFFECTIVE', merge_commit: BASELINE, postmerge_workflow_run: 29222992520, postmerge_gate: 'PASS', effectiveness_condition_satisfied: true });
  if (slice.delivery_slice_id === S2) Object.assign(slice, { baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE', activation_fields_status: 'FROZEN', runtime_source_authorized: true, exact_changed_file_boundary: FILES, effectiveness_condition: 'S2_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S2_GATE_PASS', effectiveness_condition_satisfied: false });
  if (slice.delivery_slice_id === S3) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false });
}
writeJson(MATRIX_PATH, matrix);

const markerStart = '<!-- MCFT-CAP-04-S2-FUTURE-FORCING-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S2-FUTURE-FORCING-END -->';
let map = fs.readFileSync(abs(MAP_PATH), 'utf8');
const oldStart = map.indexOf(markerStart);
const oldEnd = map.indexOf(markerEnd);
if (oldStart >= 0 && oldEnd >= oldStart) map = map.slice(0, oldStart) + map.slice(oldEnd + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S2 Future Forcing implementation candidate

\`\`\`text
baseline merged main: ${BASELINE}
S1 status: MERGED_EFFECTIVE
S1 postmerge workflow: 29222992520
active delivery slice: ${S2}
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: ${S3}
next delivery slice authorized: false
\`\`\`

Established in this bounded slice:

\`\`\`text
joint weather/ET0 matching forcing-cycle selector
forcing_cycle_key equality and deterministic ordering
exact 72-point ForecastForcingWindowV1 DTO
no-future-leakage at logical time T
identical duplicate collapse
CONFLICTING_FORCING_SNAPSHOT rejection
CONFLICTING_FORCING_CYCLE rejection
forcing_window_hash over complete 72-point DTO
24-tick / 95-hour controlled Replay fixture
\`\`\`

Forecast equations, Scenario equations, persistence, migration, projection, route and scheduler remain outside S2.

${markerEnd}
`;
fs.writeFileSync(abs(MAP_PATH), `${map}\n\n${section}`, 'utf8');

console.log(`materialized CAP-04 S2 governance for ${FILES.length} final files`);
