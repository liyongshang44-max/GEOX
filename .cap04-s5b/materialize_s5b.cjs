// .cap04-s5b/materialize_s5b.cjs
// Purpose: reconcile S5A merged-main effectiveness and materialize the bounded S5B persistence/uniqueness/recovery candidate governance artifacts.
// This temporary file is deleted before the final candidate commit.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = '2c6a0834488f367eb927430a15c9590c1bf348a3';
const BRANCH = 'agent/mcft-cap-04-s5b-persistence-uniqueness-recovery-v1';
const S5A = 'MCFT-CAP-04.MCFT-02-07-08-09.A1-A2-RECORD-SET-BUILDERS-V1';
const S5B = 'MCFT-CAP-04.MCFT-03-09-10.A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1';
const S6 = 'MCFT-CAP-04.MCFT-04-05-06-07-08-09-10.SINGLE-TICK-FORECAST-SCENARIO-INTEGRATION-V1';
const MIGRATION = 'apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql';
const STATUS_S5A = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5A-A1-A2-BUILDERS-STATUS.json';
const STATUS_S5B = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS.json';
const PERSISTENCE_MATRIX = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PERSISTENCE-MATRIX.json';
const FAILURE_CONTRACT = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FAILURE-RECOVERY-CONTRACT.md';
const NARRATIVE = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-A1-A2-B-PERSISTENCE-UNIQUENESS-RECOVERY-V1.md';
const DELIVERY = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const FILES = [
  MIGRATION,
  'apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts',
  'apps/server/src/projections/twin_runtime/forecast_scenario_projection_rebuilder_v1.ts',
  'apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts',
  'apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts',
  MAP,
  MATRIX,
  NARRATIVE,
  AUTH,
  DELIVERY,
  FAILURE_CONTRACT,
  PERSISTENCE_MATRIX,
  STATUS_S5A,
  STATUS_S5B,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S5B_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_SET_BUILDER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_SCENARIO_SET_BUILDER_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_persistence_fixture_v1.ts',
].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const s5aEvidence = {
  pr_number: 2392,
  exact_head_commit: 'd8c9feefcf891147692bbcfb223813129578b825',
  exact_head_ci_run: 29227610603,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2393,
  postmerge_workflow_run: 29228386162,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};

const claims = [
  'CAP04_A1_ATOMIC_PERSISTENCE_IMPLEMENTED',
  'CAP04_A2_ATOMIC_PERSISTENCE_IMPLEMENTED',
  'CAP04_B_SCENARIO_SET_BUILDER_AND_ATOMIC_PERSISTENCE_IMPLEMENTED',
  'CAP04_CROSS_VARIANT_TERMINAL_TICK_UNIQUENESS_IMPLEMENTED',
  'CAP04_SCENARIO_SET_CANONICAL_UNIQUENESS_IMPLEMENTED',
  'CAP04_A1_A2_B_IDEMPOTENT_RESPONSE_LOSS_RECOVERY_IMPLEMENTED',
  'CAP04_CANONICAL_A_AND_B_READBACK_IMPLEMENTED',
  'CAP04_PENDING_SCENARIO_RECOVERY_DETECTION_IMPLEMENTED',
  'CAP04_FORECAST_SCENARIO_REBUILDABLE_PROJECTIONS_IMPLEMENTED',
  'CAP04_FAULT_INJECTION_TRANSACTION_ROLLBACK_IMPLEMENTED',
  'CAP04_SINGLE_ADDITIVE_MIGRATION_IMPLEMENTED',
];

const nonclaims = [
  'NO_ROUTE',
  'NO_WEB',
  'NO_SCHEDULER',
  'NO_SINGLE_TICK_ORCHESTRATION',
  'NO_TWENTY_FOUR_TICK_RANGE_EXECUTION',
  'NO_RESTART_BACKFILL_CLOSURE',
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

const s5a = readJson(STATUS_S5A);
Object.assign(s5a, {
  status: 'MERGED_EFFECTIVE',
  implementation_status: 'MERGED_EFFECTIVE',
  effectiveness_condition_satisfied: true,
  merge_evidence: s5aEvidence,
  next_delivery_slice_authorized: true,
});
s5a.candidate_validation = {
  ...(s5a.candidate_validation || {}),
  recursive_typecheck: 'PASS',
  positive_a1_a2_builder_acceptance: 'PASS',
  negative_a1_a2_builder_acceptance: 'PASS',
  governance_final_gate: 'PASS',
  repository_exact_head_ci: 'PASS',
  repository_exact_head_ci_run: 29227610603,
  postmerge_governance_gate: 'PASS',
  postmerge_workflow_run: 29228386162,
  temporary_workflow_removed: true,
  temporary_diagnostic_evidence_removed: true,
};
writeJson(STATUS_S5A, s5a);

const persistenceMatrix = {
  schema_version: 'geox_mcft_cap_04_persistence_matrix_v1',
  delivery_slice_id: S5B,
  canonical_store: {
    authority: 'public.facts',
    append_only: true,
    second_canonical_store_forbidden: true,
  },
  additive_migration: { count: 1, path: MIGRATION },
  transactions: {
    A1: { atomic: true, canonical_fact_count: 8, identity_kind: 'A1_RECORD_SET' },
    A2: { atomic: true, canonical_fact_count: 8, identity_kind: 'A2_RECORD_SET' },
    B: { atomic: true, canonical_fact_count: 1, identity_kind: 'B_SCENARIO_SET' },
  },
  guards: {
    cross_variant_terminal_tick_uniqueness: 'twin_terminal_tick_uniqueness_v1',
    scenario_set_canonical_uniqueness: 'twin_scenario_set_uniqueness_v1',
    idempotency: 'twin_object_idempotency_index_v1',
    lease_and_fencing: 'twin_runtime_lease_v1',
  },
  projections: {
    authoritative_projection_family: 'twin_runtime_forecast_scenario_v1',
    rebuildable: true,
    canonical_truth: false,
    tables: [
      'twin_forecast_run_projection_v1',
      'twin_forecast_point_projection_v1',
      'twin_scenario_set_projection_v1',
      'twin_scenario_point_projection_v1',
      'twin_scenario_latest_index_v1',
    ],
    legacy_root_zone_irrigation_scenario_set_index_v1: 'COMPATIBILITY_ONLY_NOT_WRITE_AUTHORITY',
  },
  recovery: {
    a_record_set_root: 'twin_runtime_tick_v1 plus idempotency member map',
    pending_scenario_detection: 'latest successful Forecast without Scenario uniqueness row',
    projection_rebuild_source: 'append-only canonical facts plus idempotency guards',
  },
};
writeJson(PERSISTENCE_MATRIX, persistenceMatrix);

const s5b = {
  schema_version: 'geox_mcft_cap_04_s5b_persistence_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-S5B-PERSISTENCE-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  delivery_slice_id: S5B,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'IMPLEMENTATION_CANDIDATE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IMPLEMENTED_PENDING_MERGE',
  activation_fields_status: 'FROZEN',
  explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_effectiveness: s5aEvidence,
  contracts: {
    additive_migration_count: 1,
    additive_migration_path: MIGRATION,
    canonical_store_authority: 'public.facts',
    second_canonical_store_forbidden: true,
    a1_member_count: 8,
    a2_member_count: 8,
    b_member_count: 1,
    forecast_point_projection_count_on_a1: 72,
    forecast_point_projection_count_on_a2: 0,
    scenario_point_projection_count_on_b: 216,
    cross_variant_terminal_uniqueness_guard: 'twin_terminal_tick_uniqueness_v1',
    scenario_uniqueness_guard: 'twin_scenario_set_uniqueness_v1',
  },
  allowed_claims: claims,
  preserved_nonclaims: nonclaims,
  exact_changed_file_boundary: FILES,
  candidate_validation: {
    diagnostic_workflow_run: 29230993059,
    recursive_typecheck: 'PASS',
    positive_scenario_set_builder_acceptance: 'PASS_REQUIRED',
    negative_scenario_set_builder_acceptance: 'PASS_REQUIRED',
    isolated_postgresql_persistence_acceptance: 'PASS',
    governance_final_gate: 'PASS_REQUIRED',
    repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
    temporary_workflow_removed: true,
    temporary_diagnostic_evidence_removed: true,
  },
  effectiveness_condition: 'S5B_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5B_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S6,
  next_delivery_slice_authorized: false,
};
writeJson(STATUS_S5B, s5b);

const failureContract = `<!-- ${FAILURE_CONTRACT} -->

# GEOX MCFT-CAP-04 Failure and Recovery Contract

## Transaction boundary

A1 and A2 each append exactly eight canonical facts in one fenced PostgreSQL transaction. B appends exactly one canonical Scenario Set fact in a separate fenced transaction. Any injected failure before commit rolls back canonical facts, uniqueness guards, pointer updates, idempotency rows and projections together.

## Uniqueness

A1 and A2 share one terminal tick uniqueness authority over scope, lineage, revision and logical time. A second variant for the same terminal tick fails closed. B uniqueness is bound to source Forecast ref/hash plus lineage and revision. A second non-idempotent Scenario Set for that source Forecast fails closed.

## Response-loss recovery

A repeated A1/A2/B request with the same idempotency key, record identity and aggregate hash returns the canonical readback without duplicate writes. A conflicting semantic payload under the same idempotency key fails with IDENTITY/IDEMPOTENCY conflict.

## Pending Scenario barrier

A successful Forecast becomes pending when it is the latest successful Forecast and no Scenario uniqueness row exists. B commit clears this condition. A blocked Forecast never becomes Scenario-eligible.

## Projection recovery

Forecast and Scenario projections are rebuildable from append-only facts and guard identity metadata. Projection rows are not canonical truth. Divergence or deletion requires explicit rebuild; silent repair is forbidden.

## Preserved boundary

This contract does not implement tick orchestration, range execution, restart/backfill closure, routes, web, scheduler, recommendation, decision, AO-ACT, model activation or continuous/live Runtime claims.
`;
fs.writeFileSync(abs(FAILURE_CONTRACT), failureContract, 'utf8');

const narrative = `<!-- ${NARRATIVE} -->

# GEOX MCFT-CAP-04 S5B — A1/A2/B Persistence, Uniqueness and Recovery V1

\`\`\`text
baseline merged main: ${BASELINE}
branch: ${BRANCH}
delivery slice: ${S5B}
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
\`\`\`

S5B extends the existing D transaction family. Canonical history remains exclusively in \`public.facts\`. Exactly one additive migration introduces the CAP-04 idempotency kinds, cross-variant terminal uniqueness, Scenario canonical uniqueness and rebuildable Forecast/Scenario projections.

A1 and A2 atomically persist eight-member record sets. Both variants compete for one terminal tick identity; exactly one may commit. B atomically persists one Scenario Set bound to the latest successful source Forecast. Idempotent retries reconstruct the canonical result instead of appending duplicates.

The Runtime can detect an A1-success/B-missing recovery barrier, read back A and B identities, and explicitly rebuild Forecast/Scenario projections from append-only facts. Fault injection proves rollback before commit.

S6 single-tick orchestration remains blocked and unauthorized.
`;
fs.writeFileSync(abs(NARRATIVE), narrative, 'utf8');

const delivery = readJson(DELIVERY);
Object.assign(delivery, {
  status: 'S5B_IMPLEMENTATION_CANDIDATE',
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  active_delivery_slice_id: S5B,
  runtime_source_authorized: true,
  authorization_effective: true,
  s5a_effectiveness: s5aEvidence,
  next_authorized_slice_id_after_merge_and_postmerge_gate: S6,
});
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S5A) Object.assign(slice, {
    status: 'MERGED_EFFECTIVE',
    effectiveness_condition_satisfied: true,
    exact_head_commit: s5aEvidence.exact_head_commit,
    exact_head_ci_run: s5aEvidence.exact_head_ci_run,
    merge_commit: s5aEvidence.merge_commit,
    postmerge_probe_pr_number: s5aEvidence.postmerge_probe_pr_number,
    postmerge_workflow_run: s5aEvidence.postmerge_workflow_run,
    postmerge_gate: 'PASS',
  });
  if (slice.delivery_slice_id === S5B) Object.assign(slice, {
    baseline_main_commit: BASELINE,
    branch: BRANCH,
    status: 'IMPLEMENTATION_CANDIDATE',
    activation_fields_status: 'FROZEN',
    explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
    runtime_source_authorized: true,
    allowed_claims: claims,
    preserved_nonclaims: nonclaims,
    exact_changed_file_boundary: FILES,
    effectiveness_condition: 'S5B_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5B_GATE_PASS',
    effectiveness_condition_satisfied: false,
  });
  if (slice.delivery_slice_id === S6) Object.assign(slice, {
    baseline_main_commit: null,
    branch: null,
    status: 'BLOCKED',
    activation_fields_status: 'TO_BE_FROZEN_AT_SLICE_ACTIVATION',
    runtime_source_authorized: false,
  });
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
  active_delivery_slice_id: S5B,
  repository_write_scope: 'S5B_PERSISTENCE_UNIQUENESS_RECOVERY_ONLY',
  exact_changed_file_boundary: FILES,
  next_authorized_slice_id_after_effectiveness: S6,
  current_blockers: ['MCFT_CAP_04_S5B_PR_MERGED','MCFT_CAP_04_S5B_MERGED_MAIN_GATE_PASS'],
  preserved_nonclaims: nonclaims,
  s5a_effectiveness: s5aEvidence,
  satisfied_conditions: [
    'MCFT_CAP_04_S0_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S1_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S2_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S3_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S4_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S5A_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S5B',
    'MCFT_CAP_04_S5B_EXPLICIT_OWNER_ACTIVATION',
  ],
});
writeJson(AUTH, auth);

const matrix = readJson(MATRIX);
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-04 S5A merged-main effective; bounded S5B persistence candidate active',
};
matrix.latest_governance_update = S5B;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, {
  status: 'IN_PROGRESS',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  latest_effective_slice_id: S5A,
  latest_effective_slice_merge_commit: BASELINE,
  latest_effective_slice_postmerge_workflow_run: 29228386162,
  active_delivery_slice_id: S5B,
  next_delivery_slice_id: S6,
  next_delivery_slice_authorized: false,
  s5b_status_ref: STATUS_S5B,
  persistence_matrix_ref: PERSISTENCE_MATRIX,
  failure_recovery_contract_ref: FAILURE_CONTRACT,
});
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S5A) Object.assign(slice, {
    status: 'MERGED_EFFECTIVE', merge_commit: BASELINE, postmerge_workflow_run: 29228386162,
    postmerge_gate: 'PASS', effectiveness_condition_satisfied: true,
  });
  if (slice.delivery_slice_id === S5B) Object.assign(slice, {
    baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE',
    activation_fields_status: 'FROZEN', runtime_source_authorized: true,
    exact_changed_file_boundary: FILES,
    effectiveness_condition: 'S5B_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S5B_GATE_PASS',
    effectiveness_condition_satisfied: false,
  });
  if (slice.delivery_slice_id === S6) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false });
}
writeJson(MATRIX, matrix);

const markerStart = '<!-- MCFT-CAP-04-S5B-PERSISTENCE-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S5B-PERSISTENCE-END -->';
let map = fs.readFileSync(abs(MAP), 'utf8');
const start = map.indexOf(markerStart);
const end = map.indexOf(markerEnd);
if (start >= 0 && end >= start) map = map.slice(0, start) + map.slice(end + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S5B persistence candidate

\`\`\`text
baseline merged main: ${BASELINE}
S5A status: MERGED_EFFECTIVE
S5A postmerge workflow: 29228386162
active delivery slice: ${S5B}
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: ${S6}
next delivery slice authorized: false
canonical store: public.facts
additive migrations in S5B: 1
\`\`\`

Established in this bounded slice: A1/A2/B atomic persistence, cross-variant terminal uniqueness, Scenario canonical uniqueness, idempotent readback, pending Scenario recovery detection, Forecast/Scenario projections, explicit projection rebuild and fault-injection rollback.

No route, web, scheduler or tick orchestration is introduced.

${markerEnd}
`;
fs.writeFileSync(abs(MAP), `${map}\n\n${section}`, 'utf8');

console.log(`materialized CAP-04 S5B governance for ${FILES.length} final files`);
