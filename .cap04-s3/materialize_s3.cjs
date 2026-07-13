// .cap04-s3/materialize_s3.cjs
// Purpose: reconcile S2 merged-main effectiveness, freeze the explicitly authorized S3 activation, and materialize the bounded pure Forecast math governance artifacts.
// This temporary file is deleted before the final candidate commit.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const BASELINE = '4a8dab632246b05266f1d869f6c9a0a5bcf37e76';
const BRANCH = 'agent/mcft-cap-04-s3-pure-72h-forecast-math-v1';
const S2 = 'MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1';
const S3 = 'MCFT-CAP-04.MCFT-06-09.PURE-72H-FORECAST-MATH-V1';
const S4 = 'MCFT-CAP-04.MCFT-06-10.PURE-THREE-SCENARIO-MATH-V1';
const STATUS_S2_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json';
const STATUS_S3_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json';
const CONTRACT_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-MATH-CONTRACT.json';
const NARRATIVE_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-72H-FORECAST-MATH-V1.md';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const FILES = [
  'apps/server/src/domain/twin_runtime/forecast_math_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-FORECAST-MATH-CONTRACT.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-72H-FORECAST-MATH-V1.md',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S2-FUTURE-FORCING-STATUS.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_04_S3_PURE_FORECAST_MATH.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_PURE_FORECAST_MATH_NEGATIVE.ts',
  'scripts/runtime_acceptance/mcft_cap_04_forecast_math_fixture_v1.ts',
].sort();

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const ensureParent = (file) => fs.mkdirSync(path.dirname(abs(file)), { recursive: true });

const s2Evidence = {
  pr_number: 2386,
  exact_head_commit: '4dae60d9412ec191cec3be0b730fab216474731f',
  exact_head_ci_run: 29223459646,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2387,
  postmerge_workflow_run: 29223899742,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};

const allowedClaims = [
  'CAP04_PURE_72H_FORECAST_MEAN_PROPAGATION_IMPLEMENTED',
  'CAP04_NO_NEW_IRRIGATION_FORECAST_ADAPTER_IMPLEMENTED',
  'CAP04_EXACT_FIXED_POINT_MASS_BALANCE_IMPLEMENTED',
  'CAP04_STORAGE_VARIANCE_CHAIN_IMPLEMENTED',
  'CAP04_UNCALIBRATED_NORMAL_95_INTERVAL_IMPLEMENTED',
  'CAP04_PHYSICAL_STORAGE_AND_INTERVAL_BOUNDS_IMPLEMENTED',
  'CAP04_FORECAST_POINT_TRAJECTORY_AND_MATH_HASHES_IMPLEMENTED',
  'CAP04_24_TICK_95_HOUR_FORECAST_MATH_FIXTURE_IMPLEMENTED',
];

const preservedNonclaims = [
  'NO_SCENARIO_EQUATIONS',
  'NO_SCENARIO_CREATED_BY_S3',
  'NO_CANONICAL_FORECAST_OBJECT_APPEND',
  'NO_A1_A2_B_PERSISTENCE',
  'NO_MIGRATION',
  'NO_PROJECTION',
  'NO_ROUTE',
  'NO_SCHEDULER',
  'NO_CALIBRATED_FORECAST_PROBABILITY',
  'NO_WEATHER_ENSEMBLE_DISTRIBUTION',
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

const s2Status = readJson(STATUS_S2_PATH);
s2Status.status = 'MERGED_EFFECTIVE';
s2Status.implementation_status = 'MERGED_EFFECTIVE';
s2Status.effectiveness_condition_satisfied = true;
s2Status.merge_evidence = s2Evidence;
s2Status.candidate_validation = {
  ...(s2Status.candidate_validation || {}),
  materializer_workflow_run: 29223393132,
  recursive_typecheck: 'PASS',
  positive_future_forcing_acceptance: 'PASS',
  negative_future_forcing_acceptance: 'PASS',
  governance_final_gate: 'PASS',
  repository_exact_head_ci: 'PASS',
  repository_exact_head_ci_run: 29223459646,
  postmerge_governance_gate: 'PASS',
  postmerge_workflow_run: 29223899742,
  temporary_workflow_removed: true,
};
writeJson(STATUS_S2_PATH, s2Status);

const contract = {
  schema_version: 'geox_mcft_cap_04_forecast_math_contract_v1',
  contract_id: 'MCFT_CAP_04_PURE_72H_FORECAST_MATH_V1',
  delivery_slice_id: S3,
  baseline_assumption: 'NO_NEW_IRRIGATION',
  forecast_method_id: 'ROOT_ZONE_WATER_BALANCE_72H_FIXED_POINT_V1',
  forecast_method_version: '1',
  uncertainty_method_id: 'ADDITIVE_STORAGE_VARIANCE_ZERO_COVARIANCE_V1',
  interval_method_id: 'NORMAL_95_PERCENT_Z_1_96_V1',
  interval_semantics: 'CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION',
  point_count: 72,
  step_hours: 1,
  valid_interval: '(T,T+72H]',
  mean_internal_scale: 6,
  variance_internal_scale: 12,
  published_decimal_places: 6,
  rounding_rule: 'DECIMAL_HALF_AWAY_FROM_ZERO_V1',
  mass_balance_error_required: '0.000000',
  source_variance_authority: 'SOURCE_POSTERIOR_COMPUTATION_BASIS_STORAGE_VARIANCE_MM2_DECIMAL',
  physical_bounds: {
    storage_lower_mm: '0.000000',
    storage_upper_authority: 'RUNTIME_CONFIG_SATURATION_STORAGE_MM',
    latent_variance_reduced_by_clipping: false,
  },
  hourly_variance_components: ['rainfall_variance_mm2','crop_et_variance_mm2','baseline_irrigation_variance_mm2','structural_variance_mm2'],
  baseline_irrigation_variance_mm2: '0.000000000000',
  deterministic_hashes: ['point_semantic_hash','trajectory_hash','forecast_math_hash'],
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

const s3Status = {
  schema_version: 'geox_mcft_cap_04_s3_pure_forecast_math_status_v1',
  status_identity: 'GEOX-MCFT-CAP-04-S3-PURE-FORECAST-MATH-STATUS-V1',
  capability_line_id: 'MCFT-CAP-04',
  delivery_slice_id: S3,
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  status: 'IMPLEMENTATION_CANDIDATE',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IMPLEMENTED_PENDING_MERGE',
  activation_fields_status: 'FROZEN',
  explicit_activation_authority: 'OWNER_EXPLICIT_AUTHORIZATION',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_effectiveness: s2Evidence,
  contracts: {
    contract_id: contract.contract_id,
    baseline_assumption: contract.baseline_assumption,
    forecast_method_id: contract.forecast_method_id,
    uncertainty_method_id: contract.uncertainty_method_id,
    interval_method_id: contract.interval_method_id,
    forecast_point_count: 72,
    standard_tick_count: 24,
    target_union_hour_count: 95,
    mean_internal_scale: 6,
    variance_internal_scale: 12,
  },
  allowed_claims: allowedClaims,
  preserved_nonclaims: preservedNonclaims,
  exact_changed_file_boundary: FILES,
  candidate_validation: {
    materializer_workflow_run: Number(process.env.GITHUB_RUN_ID || 0),
    recursive_typecheck: 'PASS_REQUIRED',
    positive_forecast_math_acceptance: 'PASS_REQUIRED',
    negative_forecast_math_acceptance: 'PASS_REQUIRED',
    governance_final_gate: 'PASS_REQUIRED',
    repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
    temporary_workflow_removed: true,
  },
  effectiveness_condition: 'S3_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S3_GATE_PASS',
  effectiveness_condition_satisfied: false,
  next_delivery_slice_id: S4,
  next_delivery_slice_authorized: false,
};
writeJson(STATUS_S3_PATH, s3Status);

const narrative = `<!-- docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-PURE-72H-FORECAST-MATH-V1.md -->

# GEOX MCFT-CAP-04 S3 — Pure 72-Hour Forecast Math V1

## Identity

\`\`\`text
baseline merged main: ${BASELINE}
branch: ${BRANCH}
delivery slice: ${S3}
status: IMPLEMENTATION_CANDIDATE
runtime source authorized: true
\`\`\`

## Established boundary

S3 accepts exactly one posterior computation basis, one explicitly pinned CAP-04 Runtime Config and one already-selected 72-point Future Forcing window. It does not select Evidence or mutate State.

The baseline is \`NO_NEW_IRRIGATION\`. Each hourly step applies the frozen root-zone water-balance rules with 10^-6 mm fixed-point amounts, exact zero mass-balance error, physical storage bounds, available-water fraction and depletion. The 72 points cover \`(T,T+72H]\` in strict order.

Storage variance begins from the source posterior \`computation_basis.storage_variance_mm2_decimal\` at 10^-12 mm² scale. Each hour adds rainfall, crop-ET and structural variance with zero covariance and zero baseline-irrigation variance. Physical or interval clipping never reduces latent variance.

The 95% interval uses \`NORMAL_95_PERCENT_Z_1_96_V1\` with semantics \`CONTROLLED_UNCALIBRATED_NORMAL_APPROXIMATION\`. It is not a calibrated probability claim.

Each point receives a semantic hash over its published point and full computation trace. The ordered point hashes determine \`trajectory_hash\`; the complete result determines \`forecast_math_hash\`.

## Standard fixture

The 24 logical ticks from \`2026-06-03T02:00:00.000Z\` through \`2026-06-04T01:00:00.000Z\` each execute an independent 72-hour pure Forecast trajectory. Their target union contains exactly 95 hours from \`2026-06-03T03:00:00.000Z\` through \`2026-06-07T01:00:00.000Z\`.

## Preserved nonclaims

S3 does not implement Scenario equations, canonical Forecast append, A1/A2/B persistence, migration, projection, route, scheduler, calibrated Forecast probability, recommendation, policy evaluation, decision, AO-ACT, model activation, continuous Runtime, live-field operation, Gate A closure or Minimum Complete Field Twin completion.
`;
fs.writeFileSync(abs(NARRATIVE_PATH), narrative, 'utf8');

const delivery = readJson(DELIVERY_PATH);
delivery.status = 'S3_IMPLEMENTATION_CANDIDATE';
delivery.baseline_main_commit = BASELINE;
delivery.branch = BRANCH;
delivery.active_delivery_slice_id = S3;
delivery.runtime_source_authorized = true;
delivery.authorization_effective = true;
delivery.s2_effectiveness = s2Evidence;
delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S4;
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S2) {
    Object.assign(slice, {
      status: 'MERGED_EFFECTIVE',
      exact_head_commit: s2Evidence.exact_head_commit,
      exact_head_ci_run: s2Evidence.exact_head_ci_run,
      merge_commit: s2Evidence.merge_commit,
      postmerge_probe_pr_number: s2Evidence.postmerge_probe_pr_number,
      postmerge_workflow_run: s2Evidence.postmerge_workflow_run,
      postmerge_gate: 'PASS',
      effectiveness_condition_satisfied: true,
    });
  }
  if (slice.delivery_slice_id === S3) {
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
      effectiveness_condition: 'S3_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S3_GATE_PASS',
      effectiveness_condition_satisfied: false,
    });
  }
  if (slice.delivery_slice_id === S4) {
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
  active_delivery_slice_id: S3,
  repository_write_scope: 'S3_PURE_FORECAST_MATH_ONLY',
  exact_changed_file_boundary: FILES,
  next_authorized_slice_id_after_effectiveness: S4,
  current_blockers: ['MCFT_CAP_04_S3_PR_MERGED','MCFT_CAP_04_S3_MERGED_MAIN_GATE_PASS'],
  preserved_nonclaims: preservedNonclaims,
  satisfied_conditions: [
    'MCFT_CAP_04_S0_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S1_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_S2_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S3',
    'MCFT_CAP_04_S3_EXPLICIT_OWNER_ACTIVATION',
  ],
  s2_effectiveness: s2Evidence,
});
writeJson(AUTH_PATH, authorization);

const matrix = readJson(MATRIX_PATH);
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-04 S2 merged-main effective; bounded S3 pure 72-hour Forecast math implementation candidate active',
};
matrix.latest_governance_update = S3;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, {
  status: 'IN_PROGRESS',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_effective: true,
  runtime_source_authorized: true,
  latest_effective_slice_id: S2,
  latest_effective_slice_merge_commit: BASELINE,
  latest_effective_slice_postmerge_workflow_run: 29223899742,
  active_delivery_slice_id: S3,
  next_delivery_slice_id: S4,
  next_delivery_slice_authorized: false,
  s3_status_ref: STATUS_S3_PATH,
});
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S2) Object.assign(slice, { status: 'MERGED_EFFECTIVE', merge_commit: BASELINE, postmerge_workflow_run: 29223899742, postmerge_gate: 'PASS', effectiveness_condition_satisfied: true });
  if (slice.delivery_slice_id === S3) Object.assign(slice, { baseline_main_commit: BASELINE, branch: BRANCH, status: 'IMPLEMENTATION_CANDIDATE', activation_fields_status: 'FROZEN', runtime_source_authorized: true, exact_changed_file_boundary: FILES, effectiveness_condition: 'S3_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S3_GATE_PASS', effectiveness_condition_satisfied: false });
  if (slice.delivery_slice_id === S4) Object.assign(slice, { status: 'BLOCKED', runtime_source_authorized: false });
}
writeJson(MATRIX_PATH, matrix);

const markerStart = '<!-- MCFT-CAP-04-S3-PURE-FORECAST-MATH-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S3-PURE-FORECAST-MATH-END -->';
let map = fs.readFileSync(abs(MAP_PATH), 'utf8');
const oldStart = map.indexOf(markerStart);
const oldEnd = map.indexOf(markerEnd);
if (oldStart >= 0 && oldEnd >= oldStart) map = map.slice(0, oldStart) + map.slice(oldEnd + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S3 pure 72-hour Forecast math implementation candidate

\`\`\`text
baseline merged main: ${BASELINE}
S2 status: MERGED_EFFECTIVE
S2 postmerge workflow: 29223899742
active delivery slice: ${S3}
status: IMPLEMENTATION_CANDIDATE
runtime_source_authorized: true
next delivery slice: ${S4}
next delivery slice authorized: false
\`\`\`

Established in this bounded slice:

\`\`\`text
NO_NEW_IRRIGATION pure Forecast adapter
72 hourly fixed-point mean propagation
exact zero mass-balance error
10^-12 storage variance chain
controlled uncalibrated 95% storage interval
physical storage and interval bounds
point semantic hash, trajectory hash and forecast math hash
24-tick / 95-hour controlled Replay Forecast-math fixture
\`\`\`

Scenario equations, canonical append, persistence, migration, projection, route and scheduler remain outside S3.

${markerEnd}
`;
fs.writeFileSync(abs(MAP_PATH), `${map}\n\n${section}`, 'utf8');

console.log(`materialized CAP-04 S3 governance for ${FILES.length} final files`);
