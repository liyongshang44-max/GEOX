// .cap04-s1/materialize_s1.cjs
// Purpose: reconcile S0 merged-main effectiveness and activate the bounded S1 implementation candidate.
// This temporary file is deleted before the final candidate commit.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const BASELINE = '870bcc621e8d0495ae5acbedd534068a18d402b9';
const BRANCH = 'agent/mcft-cap-04-s1-contracts-config-v1';
const S0 = 'MCFT-CAP-04.GOV-AUTHORIZATION-AND-PREDECESSOR-LOCK-V1';
const S1 = 'MCFT-CAP-04.MCFT-02-07-09-10.FORECAST-SCENARIO-CONTRACTS-CONFIG-V1';
const S2 = 'MCFT-CAP-04.MCFT-05-09.FUTURE-FORCING-WINDOW-V1';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-S1-CONTRACTS-CONFIG-STATUS.json';
const DELIVERY_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-DELIVERY-SLICE-STATUS.json';
const AUTH_PATH = 'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-AUTHORIZATION-STATUS.json';
const MATRIX_PATH = 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json';
const MAP_PATH = 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md';

const abs = (file) => path.join(ROOT, file);
const readJson = (file) => JSON.parse(fs.readFileSync(abs(file), 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const status = readJson(STATUS_PATH);
const files = [...status.exact_changed_file_boundary].sort();
status.candidate_validation = {
  materializer_workflow_run: Number(process.env.GITHUB_RUN_ID || 0),
  exact_changed_file_count: files.length,
  recursive_typecheck: 'PASS_REQUIRED',
  positive_contract_acceptance: 'PASS_REQUIRED',
  negative_contract_acceptance: 'PASS_REQUIRED',
  isolated_postgresql_d_transaction_acceptance: 'PASS_REQUIRED',
  governance_final_gate: 'PASS_REQUIRED',
  repository_exact_head_ci: 'PASS_REQUIRED_BEFORE_MERGE',
  temporary_workflow_removed: true,
};
writeJson(STATUS_PATH, status);

const delivery = readJson(DELIVERY_PATH);
delivery.status = 'S1_IMPLEMENTATION_CANDIDATE';
delivery.baseline_main_commit = BASELINE;
delivery.branch = BRANCH;
delivery.active_delivery_slice_id = S1;
delivery.runtime_source_authorized = true;
delivery.authorization_effective = true;
delivery.s0_effectiveness = {
  pr_number: 2381,
  exact_head_commit: '32fa69d0a36f1c66883d9058c7a203c39718ca05',
  exact_head_ci_run: 29206826879,
  merge_commit: BASELINE,
  postmerge_probe_pr_number: 2383,
  postmerge_workflow_run: 29207138083,
  postmerge_gate: 'PASS',
  effectiveness_condition_satisfied: true,
};
delivery.next_authorized_slice_id_after_merge_and_postmerge_gate = S2;
for (const slice of delivery.slices) {
  if (slice.delivery_slice_id === S0) {
    Object.assign(slice, {
      status: 'MERGED_EFFECTIVE',
      exact_head_commit: '32fa69d0a36f1c66883d9058c7a203c39718ca05',
      exact_head_ci_run: 29206826879,
      merge_commit: BASELINE,
      postmerge_probe_pr_number: 2383,
      postmerge_workflow_run: 29207138083,
      postmerge_gate: 'PASS',
      effectiveness_condition_satisfied: true,
    });
  }
  if (slice.delivery_slice_id === S1) {
    Object.assign(slice, {
      baseline_main_commit: BASELINE,
      branch: BRANCH,
      status: 'IMPLEMENTATION_CANDIDATE',
      activation_fields_status: 'FROZEN',
      runtime_source_authorized: true,
      allowed_claims: [...status.allowed_claims],
      preserved_nonclaims: [...status.preserved_nonclaims],
      exact_changed_file_boundary: files,
      effectiveness_condition: 'S1_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S1_GATE_PASS',
      effectiveness_condition_satisfied: false,
    });
  }
  if (slice.delivery_slice_id === S2) {
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
  authorization_effectiveness_condition: 'SATISFIED_ON_MAIN',
  baseline_main_commit: BASELINE,
  branch: BRANCH,
  active_delivery_slice_id: S1,
  repository_write_scope: 'S1_CONTRACTS_CONFIG_ONLY',
  exact_changed_file_boundary: files,
  next_authorized_slice_id_after_effectiveness: S2,
  current_blockers: [
    'MCFT_CAP_04_S1_PR_MERGED',
    'MCFT_CAP_04_S1_MERGED_MAIN_GATE_PASS',
  ],
  satisfied_conditions: [
    'MCFT_CAP_04_S0_MERGED_MAIN_EFFECTIVE',
    'MCFT_CAP_04_PREDECESSOR_CANONICAL_IDENTITY_LOCK_COMPLETE',
    'MCFT_CAP_04_RUNTIME_SOURCE_AUTHORIZED_FOR_S1',
  ],
});
authorization.s0_effectiveness = delivery.s0_effectiveness;
writeJson(AUTH_PATH, authorization);

const matrix = readJson(MATRIX_PATH);
matrix.baseline = {
  branch: 'main',
  commit: BASELINE,
  meaning: 'MCFT-CAP-04 S0 authorization effective; bounded S1 contracts/config implementation candidate active',
};
matrix.latest_governance_update = S1;
const cap04 = matrix.capability_lines.find((line) => line.capability_line_id === 'MCFT-CAP-04');
if (!cap04) throw new Error('CAP04_MATRIX_ENTRY_MISSING');
Object.assign(cap04, {
  status: 'IN_PROGRESS',
  design_status: 'DESIGN_FROZEN',
  implementation_status: 'IN_PROGRESS',
  authorization_status: 'MERGED_EFFECTIVE',
  authorization_effective: true,
  runtime_source_authorized: true,
  predecessor_main_commit: '30fdd839aa675656dd3dc9d1def57b06f63f86ec',
  authorization_merge_commit: BASELINE,
  authorization_postmerge_workflow_run: 29207138083,
  active_delivery_slice_id: S1,
  next_delivery_slice_id: S2,
  next_delivery_slice_authorized: false,
  s1_status_ref: STATUS_PATH,
});
for (const slice of cap04.delivery_slices || []) {
  if (slice.delivery_slice_id === S0) {
    Object.assign(slice, {
      status: 'MERGED_EFFECTIVE',
      merge_commit: BASELINE,
      postmerge_workflow_run: 29207138083,
      postmerge_gate: 'PASS',
      effectiveness_condition_satisfied: true,
    });
  }
  if (slice.delivery_slice_id === S1) {
    Object.assign(slice, {
      baseline_main_commit: BASELINE,
      branch: BRANCH,
      status: 'IMPLEMENTATION_CANDIDATE',
      activation_fields_status: 'FROZEN',
      runtime_source_authorized: true,
      exact_changed_file_boundary: files,
      effectiveness_condition: 'S1_PR_MERGED_TO_MAIN_AND_MERGED_MAIN_S1_GATE_PASS',
      effectiveness_condition_satisfied: false,
    });
  }
  if (slice.delivery_slice_id === S2) {
    slice.status = 'BLOCKED';
    slice.runtime_source_authorized = false;
  }
}
writeJson(MATRIX_PATH, matrix);

const markerStart = '<!-- MCFT-CAP-04-S1-CONTRACTS-CONFIG-START -->';
const markerEnd = '<!-- MCFT-CAP-04-S1-CONTRACTS-CONFIG-END -->';
let map = fs.readFileSync(abs(MAP_PATH), 'utf8');
const oldStart = map.indexOf(markerStart);
const oldEnd = map.indexOf(markerEnd);
if (oldStart >= 0 && oldEnd >= oldStart) map = map.slice(0, oldStart) + map.slice(oldEnd + markerEnd.length);
map = map.trimEnd();
const section = `${markerStart}

## MCFT-CAP-04 S1 contracts/config implementation candidate

\`\`\`text
baseline merged main: ${BASELINE}
S0 authorization: MERGED_EFFECTIVE
S0 postmerge workflow: 29207138083
active delivery slice: ${S1}
status: IMPLEMENTATION_CANDIDATE
design_status: DESIGN_FROZEN
implementation_status: IN_PROGRESS
authorization_effective: true
runtime_source_authorized: true
next delivery slice: ${S2}
next delivery slice authorized: false
\`\`\`

Established in this bounded slice:

\`\`\`text
A1: MCFT_CAP_04_COMPLETED_FORECAST_CONTINUATION_V1
A2: MCFT_CAP_04_BLOCKED_FORECAST_CONTINUATION_V1
B: MCFT_CAP_04_THREE_SCENARIO_SET_V1
Forecast points: exact horizons 1..72
Scenario options: NO_ACTION, IRRIGATE_NOW_15MM, IRRIGATE_NOW_25MM
Runtime Config purpose: FORECAST_AND_THREE_SCENARIO_CONTINUATION_RUNTIME_V1
Runtime Config chain: exactly 24 immutable D transactions
validator dispatch: explicit contract ID + config purpose only
\`\`\`

Future Forcing selection, Forecast math, Scenario math, A1/A2/B persistence, migration, projection, route and scheduler remain outside S1.

${markerEnd}
`;
fs.writeFileSync(abs(MAP_PATH), `${map}\n\n${section}`, 'utf8');
console.log(`materialized CAP-04 S1 governance for ${files.length} final files`);
