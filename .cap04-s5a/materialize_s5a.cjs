// .cap04-s5a/materialize_s5a.cjs
// Purpose: reconcile S4 merged-main effectiveness, freeze the explicitly authorized S5A activation, and materialize the bounded A1/A2 builder governance artifacts.
// This temporary file is deleted before the final candidate commit.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = 'f0fc64d487ba6ed34d0c77178fed45e707092a07';
const BRANCH = 'agent/mcft-cap-04-s5a-a1-a2-record-set-builders-v1';
const S4 = 'MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1';
const S5A = 'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1';
const S5B = 'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1';
const S4_STATUS = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json';
const S5A_STATUS = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json';
const CONTRACT = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-CONTRACT.json';
const NARRATIVE = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-V1.md';
const DELIVERY = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const FILES = [
  'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-RECORD-SET-BUILDERS-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S4-PURE-SCENARIO-MATH-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S5A_A1_A2_BUILDERS.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_a1_a2_record_set_fixture_v1.ts',
].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const s4Evidence = {
  pr_number: 2390,
  exact_head_commit: '02faa691cfa83624e28664fee7b3fbf0ed7dfd36',
  exact_head_ci_run: 29226139264,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2391,
  postmerge_workflow_run: 29226613070,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};
const allowedClaims = [
  'CAP04_A1_COMPLETED_FORECAST_EIGHT_MEMBER_BUILDER_IMPLEMENTED',
  'CAP04_A2_BLOCKED_FORECAST_EIGHT_MEMBER_BUILDER_IMPLEMENTED',
  'CAP04_A1_A2_STATUS_VARIANT_SEPARATION_IMPLEMENTED',
  'CAP04_A1_A2_CROSS_REFERENCE_GRAPH_VALIDATION_IMPLEMENTED',
  'CAP04_CROSS_VARIANT_TERMINAL_UNIQUENESS_IDENTITY_IMPLEMENTED',
  'CAP04_A1_A2_OPERATION_AND_IDEMPOTENCY_IDENTITY_IMPLEMENTED',
  'CAP04_A1_A2_MEMBER_AND_AGGREGATE_HASH_CONSTRUCTION_IMPLEMENTED',
  'CAP04_A1_A2_24_TICK_BUILDER_FIXTURE_IMPLEMENTED',
];
const nonclaims = [
  'NO_DATABASE_ACCESS',
  'NO_A1_A2_B_PERSISTENCE',
  'NO_B_SCENARIO_SET_BUILDER',
  'NO_CANONICAL_OBJECT_APPEND',
  'NO_TERMINAL_UNIQUENESS_QUERY',
  'NO_RECOVERY_TRANSACTION',
  'NO_MIGRATION',
  'NO_PROJECTION',
  'NO_ROUTE',
  'NO_WEB',
  'NO_SCHEDULER',
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

const s4 = readJson(S4_STATUS);
s4.status = 'MERGED_EFFECTIVE';
s4.implementation_status = 'MERGED_EFFECTIVE';
s4.effectiveness_condition_satisfied = true;
s4.merge_evidence = s4Evidence;
s4.candidate_validation = {
  ...(s4.candidate_validation || {}),
  recursive_typecheck: 'PASS',
  positive_scenario_math_acceptance: 'PASS',
  negative_scenario_math_acceptance: 'PASS',
  governance_final_gate: 'PASS',
  repository_exact_head_ci: 'PASS',
  repository_exact_head_ci_run: 29226139264,
  postmerge_governance_gate: 'PASS',
  postmerge_workflow_run: 29226613070,
  temporary_workflow_removed: true,
};
writeJson(S4_STATUS, s4);

const contract = {
  schema_version: 'geox_mcft_cap_04_a1_a2_record_set_builders_contract_v1',
  contract_id: 'MCFT_CAP_04_A1_A2_RECORD_SET_BUILDERS_V1',
  delivery_slice_id: S5A,
  transaction_family: 'A_STATE_TICK_COMMIT',
  member_object_types: [
    'twin_evidence_window_v1',
    'twin_state_transition_v1',
    'twin_assimilation_update_v1',
    'twin_state_estimate_v1',
    'twin_forecast_run_v1',
    'twin_runtime_tick_v1',
    'twin_runtime_checkpoint_v1',
    'twin_runtime_health_v1',
  ],
  a1: {
    operation_variant: 'A1_COMPLETED',
    record_set_contract_id: 'MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1',
    forecast_status: 'COMPLETED',
    tick_status: 'COMPLETED',
    forecast_point_count: 72,
    scenario_eligible: true,
    member_count: 8,
  },
  a2: {
    operation_variant: 'A2_BLOCKED_FORECAST',
    record_set_contract_id: 'MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1',
    forecast_status: 'BLOCKED',
    tick_status: 'COMPLETED_WITH_LIMITATIONS',
    forecast_point_count: 0,
    scenario_eligible: false,
    stop_after_blocked_forecast: true,
    member_count: 8,
  },
  shared_terminal_tick_uniqueness: true,
  distinct_operation_identity: true,
  tick_recovery_root_direct_refs: [
    'evidence_window_ref',
    'state_transition_ref',
    'assimilation_update_ref',
    'posterior_state_ref',
    'forecast_result_ref',
    'checkpoint_ref',
  ],
  tick_health_ref_forbidden: true,
  database_access: false,
  persistence: false,
  canonical_append: false,
};
writeJson(CONTRACT, contract);

const s5a = {
  schema_version: 'geox_mcft_cap_04_s5a_a1_a2_builders_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  delivery_slice_id: S5A,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'IMPLEMENTATION_CANDIDATE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IMPLEMENTED_PENDING_MERGE',
  activation_fields_status: 'FROZEN',
  explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_effectiveness: s4Evidence,
  contracts: {
    contract_id: contract.contract_id,
    a1_operation_variant: contract.a1.operation_variant,
    a2_operation_variant: contract.a2.operation_variant,
    a1_member_count: 8,
    a2_member_count: 8,
    shared_terminal_tick_uniqueness: true,
    database_access: false,
    persistence: false,
  },
  allowed_claims: allowedClaims,
  preserved_nonclaims: nonclaims,
  exact_changed_file_boundary: FILES,
  candidate_validation: {
    materializer_workflow_run: Number(process.env.GITHUB_RUN_ID || 0),
    recursive_typecheck: 'PASS_REQUIRED',
    positive_a1_a2_builder_acceptance: 'PASS_REQUIRED',
    negative_a1_a2_builder_acceptance: 'PASS_REQUIRED',
    governance_final_gate: 'PASS_REQUIRED',
    repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
    temporary_workflow_removed: true,
    temporary_diagnostic_evidence_removed: true,
  },
  effectiveness_condition: 'S5A_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5A_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S5B,
  next_delivery_slice_authorized: false,
};
writeJson(S5A_STATUS, s5a);

const narrative = `<!-- ${NARRATIVE} -->

# GEOX MCFT-CAP-04 S5A — A1/A2 Record-Set Builders V1

## Identity

\`\`\`text
baseline merged main: ${BASELINE}
branch: ${BRANCH}
delivery slice: ${S5A}
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
\`\`\`

## Established boundary

S5A provides pure deterministic constructors for the two CAP-04 terminal State-tick variants. A1 emits one completed 72-point Forecast and a completed Tick. A2 emits one zero-point blocked Forecast, a completed-with-limitations Tick, a stop-after-blocked marker, and preserves the previous successful Forecast pointer.

Both variants contain exactly eight canonical candidate envelopes: Evidence Window, Transition, Assimilation Update, posterior State, Forecast, Tick, Checkpoint and Health. All CAP-04 object identifiers are re-derived from the operation identity, source references are rewired to the new graph, every member hash is recomputed, the aggregate hash is constructed, and the existing CAP-04 validator must accept the complete graph.

A1 and A2 share the same terminal uniqueness identity for scope + lineage + revision + logical time, while their operation key, record-set identity and idempotency identity remain distinct. Tick is the recovery root with six direct references; Health remains recoverable only by reverse lookup and \`health_ref\` is forbidden on Tick.

## Preserved nonclaims

This slice performs no database access, canonical append, terminal uniqueness query, A1/A2/B persistence, B Scenario Set construction, recovery transaction, migration, projection, route, web or scheduler work. Those remain reserved for S5B or later slices.
`;
fs.writeFileSync(abs(NARRATIVE), narrative, 'utf8');

const delivery = readJson(DELIVERY);
delivery.status = 'S5A_IMPLEMENTATION_CANDIDATE';
delivery.baseline_main_commit = BASELINE;
delivery.branch = BRANCH;
delivery.active_delivery_slice_id = S5A;
delivery.runtime_source_authorized = true;
delivery.authorization_effective = true;
delivery.s4_effectiveness = s4Evidence;
delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S5B;
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S4) Object.assign(slice, {
    status: 'MERGED_EFFECTIVE',
    exact_head_commit: s4Evidence.exact_head_commit,
    exact_head_ci_run: s4Evidence.exact_head_ci_run,
    merge_commit: BASELINE,
    postmerge_probe_pr_number: 2391,
    postmerge_workflow_run: 29226613070,
    postmerge_gate: 'PASS',
    effectiveness_condition_satisfied: true,
  });
  if (slice.delivery_slice_id === S5A) Object.assign(slice, {
    baseline_main_commit: BASELINE,
    branch: BRANCH,
    status: 'IMPLEMENTATION_CANDIDATE',
    activation_fields_status: 'FROZEN',
    explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
    runtime_source_authorized: true,
    allowed_claims: allowedClaims,
    preserved_nonclaims: nonclaims,
    exact_changed_file_boundary: FILES,
    effectiveness_condition: 'S5A_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5A_GATE_PASS',
    effectiveness_condition_satisfied: false,
  });
  if (slice.delivery_slice_id === S5B) Object.assign(slice, {
    baseline_main_commit: null,
    branch: null,
    status: 'BLOCKED',
    activation_fields_status: 'TO_BE_FROZEN_AT_SLICE_ACTIVATION',
    runtime_source_authorized: false,
  });
}
writeJson(DELIVERY, delivery);

const authorization = readJson(AUTH);
Object.assign(authorization, {
  status: 'AUTHORIZATION_EFFECTIVE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  active_delivery_slice_id: S5A,
  repository_write_scope: 'S5A_A1_A2_BUILDERS_ONLY',
  exact_changed_file_boundary: FILES,
  next_authorized_slice_id_after_effectiveness: S5B,
  current_blockers: ['MCFT_CAP_04_S5A_PR_MERGED', 'MCFT_CAP_04_S5A_MERGED_MAIN_GATE_PASS'],
  preserved_nonclaims: nonclaims,
  s4_effectiveness: s4Evidence,
  satisfied_conditions: [
    'MCFT_CAP_04_S0_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S1_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S2_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S3_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S4_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S5A',
    'MCFT_CAP_04_S5A_EXPLICIT_OWNER_ACTIVATION',
  ],
});
writeJson(AUTH, authorization);

const matrix = readJson(MATRIX);
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-04 S4 merged-main effective; bounded S5A A1/A2 builder candidate active',
};
matrix.latest_governance_update = S5A;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, {
  status: 'IN_PROGRESS',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  latest_effective_slice_id: S4,
  latest_effective_slice_merge_commit: BASELINE,
  latest_effective_slice_postmerge_workflow_run: 29226613070,
  active_delivery_slice_id: S5A,
  next_delivery_slice_id: S5B,
  next_delivery_slice_authorized: false,
  s5a_status_ref: S5A_STATUS,
});
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S4) Object.assign(slice, {
    status: 'MERGED_EFFECTIVE', merge_commit: BASELINE, postmerge_workflow_run: 29226613070,
    postmerge_gate: 'PASS', effectiveness_condition_satisfied: true,
  });
  if (slice.delivery_slice_id === S5A) Object.assign(slice, {
    baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE',
    activation_fields_status: 'FROZEN', runtime_source_authorized: true,
    exact_changed_file_boundary: FILES,
    effectiveness_condition: 'S5A_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5A_GATE_PASS',
    effectiveness_condition_satisfied: false,
  });
  if (slice.delivery_slice_id === S5B) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false });
}
writeJson(MATRIX, matrix);

const markerStart = '<!-- MCFT-CAP-04-S5A-A1-A2-BUILDERS-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S5A-A1-A2-BUILDERS-END -->';
let map = fs.readFileSync(abs(MAP), 'utf8');
const oldStart = map.indexOf(markerStart);
const oldEnd = map.indexOf(markerEnd);
if (oldStart >= 0 && oldEnd >= oldStart) map = map.slice(0, oldStart) + map.slice(oldEnd + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S5A A1/A2 record-set-builder candidate

\`\`\`text
baseline merged main: ${BASELINE}
S4 status: MERGED_EFFECTIVE
S4 postmerge workflow: 29226613070
active delivery slice: ${S5A}
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: ${S5B}
next delivery slice authorized: false
\`\`\`

Established in this bounded slice:

\`\`\`text
pure A1 completed-Forecast eight-member builder
pure A2 blocked-Forecast eight-member builder
strict status/variant separation
complete eight-member cross-reference validation
shared cross-variant terminal uniqueness identity
distinct operation and idempotency identities
member and aggregate deterministic hashes
Tick six-reference recovery root with no health_ref
24-tick controlled builder fixture
\`\`\`

Database access, persistence, uniqueness queries, recovery transactions, migrations, projections, routes and schedulers remain outside S5A.

${markerEnd}
`;
fs.writeFileSync(abs(MAP), `${map}\n\n${section}`, 'utf8');

console.log(`materialized CAP-04 S5A governance for ${FILES.length} final files`);
