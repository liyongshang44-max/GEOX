'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const taskPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-TASK.md';
const deliveryPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-DELIVERY-SLICE-STATUS.json';
const amendmentPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md';
const statusPath = 'docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-C-SSOT-RECONCILIATION-STATUS.json';
const acceptancePath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_03_R4_C_SSOT_RECONCILIATION.cjs';

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function replaceOnce(relativePath, before, after) {
  const target = absolute(relativePath);
  const current = fs.readFileSync(target, 'utf8');
  const first = current.indexOf(before);
  if (first < 0) throw new Error(`R4_C_SOURCE_NOT_FOUND:${relativePath}`);
  if (current.indexOf(before, first + before.length) >= 0) {
    throw new Error(`R4_C_SOURCE_NOT_UNIQUE:${relativePath}`);
  }
  fs.writeFileSync(
    target,
    current.slice(0, first) + after + current.slice(first + before.length),
    'utf8',
  );
}

const amendmentRefBlock = `## 完整任务线 v1.2 最终冻结候选

> **Versioned contract amendment:**
> [GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md](./GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md)
> records the additive V2 semantic-conformance path established by R4 remediation.
> The v1.2 text remains historical authority and is not rewritten or reinterpreted.`;

replaceOnce(
  taskPath,
  '## 完整任务线 v1.2 最终冻结候选',
  amendmentRefBlock,
);

const amendment = `<!-- docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md -->
# MCFT-CAP-03 Versioned Contract Amendment 01

## Status

\`CANDIDATE_NOT_EFFECTIVE\`

This amendment becomes effective only after its pull request merges to \`main\`, exact-head CI passes, and merged-main tree equivalence is recorded.

## Authority and purpose

This amendment resolves the post-closure conformance findings recorded in issue #2368 without rewriting historical V1 contracts or canonical facts.

The frozen v1.2 task remains the historical semantic authority. The active forward Runtime path is the additive, versioned V2 path established after the confirmed S2 semantic-conformance defects.

## Version authority

| Concern | Historical authority | Active forward authority |
|---|---|---|
| Assimilation mathematical kernel | \`SCALAR_GAUSSIAN_ASSIMILATION_V1\` | unchanged |
| Record-set contract | \`MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1\` | \`MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2\` |
| Evidence Window contract | V1 | V2 |
| Observation selector | V1 | \`LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2\` |
| Historical canonical facts/readback | immutable | preserved through explicit version dispatch |

V2 is not an in-place upgrade of V1. It is an additive contract selected explicitly by the Runtime Config and validated through fail-closed version dispatch.

## Clarified hard semantics

1. \`evaluated_observation_refs\` is exactly \`[selected_observation_ref]\` when an observation is selected, otherwise \`[]\`.
2. Older usable, duplicate-suppressed, and rejected candidates remain in \`candidate_observations\`; they are not placed in \`evaluated_observation_refs\`.
3. Candidate exclusion is not a tick failure. A window containing only excluded candidates commits a legal \`NOT_APPLIED / NO_USABLE_OBSERVATION\` A2 tick.
4. Wrong scope, binding, quantity, canonical unit, physical bounds, FAIL quality, future, late, and stale records remain traceable rejected candidates when structurally well formed.
5. Malformed canonical observations and conflicting semantic duplicates fail closed.
6. Every single-tick request carries both Runtime Config ref and determinism hash.
7. Every range logical time carries an explicit Runtime Config ref/hash pair. Restart and bounded forward backfill inherit this requirement.
8. Idempotent replay validates the supplied Runtime Config ref/hash before returning existing success.

## Completion-claim interpretation

The frozen claim \`OBSERVATION_ASSIMILATION_V1_ESTABLISHED\` remains valid only as a claim about the established V1 Gaussian assimilation kernel and historical V1 compatibility. It does not claim that the active record-set or selector contract is V1.

The active contract identity is recorded separately as:

\`MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2\`.

## Preserved boundaries

This amendment does not authorize:

- Forecast residual or successful Forecast;
- Scenario, Recommendation, Policy Evaluation, Decision, or AO-ACT;
- Calibration Candidate, Shadow Evaluation, or Model Activation;
- late-Evidence revision or automatic recomputation;
- continuous scheduler, continuous Runtime, or live-field claim;
- MCFT-CAP-04.
`;
fs.writeFileSync(absolute(amendmentPath), amendment, 'utf8');

const delivery = JSON.parse(fs.readFileSync(absolute(deliveryPath), 'utf8'));
const effectiveClaims = Array.isArray(delivery.pending_completion_claims)
  ? [...delivery.pending_completion_claims]
  : Array.isArray(delivery.effective_completion_claims)
    ? [...delivery.effective_completion_claims]
    : [];
if (effectiveClaims.length !== 15) {
  throw new Error(`R4_C_EXPECTED_15_COMPLETION_CLAIMS:${effectiveClaims.length}`);
}
delivery.status = 'CAPABILITY_COMPLETE';
delivery.implementation_status = 'R4_C_SSOT_RECONCILIATION_CANDIDATE';
delivery.active_delivery_slice_id = null;
delivery.pending_completion_claims = [];
delivery.effective_completion_claims = effectiveClaims;
delivery.versioned_contract_authority = {
  amendment_ref: amendmentPath,
  amendment_status: 'CANDIDATE_NOT_EFFECTIVE',
  historical_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
  active_record_set_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
  active_evidence_window_contract_id: 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_EVIDENCE_WINDOW_V2',
  active_observation_selector_id: 'LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2',
  assimilation_method_id: 'SCALAR_GAUSSIAN_ASSIMILATION_V1',
  historical_v1_immutable: true,
  v1_v2_explicit_dispatch: true,
};
delivery.post_completion_remediation = {
  issue_number: 2368,
  r4_a_evidence_classification_status: 'MERGED_EFFECTIVE',
  r4_b_runtime_config_pin_status: 'MERGED_EFFECTIVE',
  r4_c_ssot_reconciliation_status: 'CANDIDATE_NOT_EFFECTIVE',
};
delivery.successor_capability_line_id = 'MCFT-CAP-04';
delivery.successor_authorized = false;
fs.writeFileSync(absolute(deliveryPath), `${JSON.stringify(delivery, null, 2)}\n`, 'utf8');

const status = {
  schema_version: 'geox_mcft_cap_03_r4_c_ssot_reconciliation_status_v1',
  capability_line_id: 'MCFT-CAP-03',
  remediation_issue_number: 2368,
  remediation_step_id: 'R4-C',
  delivery_slice_id: 'MCFT-CAP-03.R4-C.TASK-AMENDMENT-AND-SSOT-RECONCILIATION-V1',
  runtime_mode: 'REPLAY',
  target_completion_level: 'Level A',
  baseline_main_commit: 'f4b3c0d297d213660ed492029db49f9c5688fa91',
  predecessor_r4_a_status: 'MERGED_EFFECTIVE',
  predecessor_r4_b_status: 'MERGED_EFFECTIVE',
  branch: 'mcft-cap-03-r4-c-task-amendment-ssot-v1',
  status: 'CANDIDATE_VALIDATED_NOT_EFFECTIVE',
  reconciliation_scope: {
    task_amendment_reference: 'ESTABLISHED',
    versioned_v1_v2_authority: 'ESTABLISHED',
    active_delivery_slice_cleared: true,
    pending_completion_claims_cleared: true,
    effective_completion_claim_count: 15,
    successor_authorization_preserved_false: true,
  },
  exact_changed_file_boundary: [
    taskPath,
    amendmentPath,
    deliveryPath,
    statusPath,
    acceptancePath,
  ],
  candidate_validation: {
    governance_acceptance: 'REQUIRED',
    historical_r4_a_acceptance: 'REQUIRED',
    historical_r4_b_acceptance: 'REQUIRED',
  },
  effectiveness_condition:
    'R4_C_PR_MERGED_TO_MAIN_AND_EXACT_HEAD_CI_PASS_AND_MERGE_TREE_EQUIVALENCE_PASS',
  effectiveness_condition_satisfied: false,
  successor_step_id: 'R4-FINAL-VERIFICATION',
  successor_authorized: false,
  preserved_nonclaims: [
    'NO_SUCCESSFUL_FORECAST',
    'NO_FORECAST_RESIDUAL',
    'NO_SCENARIO',
    'NO_RECOMMENDATION',
    'NO_DECISION',
    'NO_AO_ACT',
    'NO_CALIBRATION_CANDIDATE',
    'NO_SHADOW_EVALUATION',
    'NO_MODEL_ACTIVATION',
    'NO_LATE_EVIDENCE_REVISION',
    'NO_CONTINUOUS_RUNTIME',
    'NO_LIVE_FIELD_CLAIM',
    'NO_MCFT_CAP_04_AUTHORIZATION',
  ],
};
fs.writeFileSync(absolute(statusPath), `${JSON.stringify(status, null, 2)}\n`, 'utf8');

const acceptance = `'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const json = (relativePath) => JSON.parse(read(relativePath));
let pass = 0;
const ok = (message) => { pass += 1; console.log('PASS ' + message); };

const taskPath = '${taskPath}';
const amendmentPath = '${amendmentPath}';
const deliveryPath = '${deliveryPath}';
const statusPath = '${statusPath}';

const task = read(taskPath);
assert.ok(task.includes('GEOX-MCFT-CAP-03-VERSIONED-CONTRACT-AMENDMENT-01.md'));
ok('task references the versioned contract amendment');

const amendment = read(amendmentPath);
for (const required of [
  'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V1',
  'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2',
  'evaluated_observation_refs',
  'NOT_APPLIED / NO_USABLE_OBSERVATION',
  'Runtime Config ref and determinism hash',
  'MCFT-CAP-04',
]) assert.ok(amendment.includes(required), required);
ok('amendment freezes V1 history, V2 active authority, corrected evidence semantics, config pins, and nonclaims');

const delivery = json(deliveryPath);
assert.equal(delivery.active_delivery_slice_id, null);
assert.deepEqual(delivery.pending_completion_claims, []);
assert.equal(delivery.effective_completion_claims.length, 15);
assert.equal(delivery.versioned_contract_authority.historical_v1_immutable, true);
assert.equal(delivery.versioned_contract_authority.v1_v2_explicit_dispatch, true);
assert.equal(delivery.versioned_contract_authority.active_record_set_contract_id, 'MCFT_CAP_03_ASSIMILATED_CONTINUATION_V2');
assert.equal(delivery.successor_authorized, false);
ok('Delivery SSOT is terminal, has fifteen effective claims, explicit V2 authority, and no successor authorization');

const r4a = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-A-EVIDENCE-CLASSIFICATION-STATUS.json');
const r4b = json('docs/digital_twin/mcft/cap_03/GEOX-MCFT-CAP-03-R4-B-RUNTIME-CONFIG-PIN-STATUS.json');
assert.equal(r4a.status, 'MERGED_EFFECTIVE');
assert.equal(r4a.effectiveness_condition_satisfied, true);
assert.equal(r4b.status, 'MERGED_EFFECTIVE');
assert.equal(r4b.effectiveness_condition_satisfied, true);
ok('R4-A and R4-B merged-main effectiveness are prerequisites');

const status = json(statusPath);
assert.equal(status.status, 'CANDIDATE_VALIDATED_NOT_EFFECTIVE');
assert.equal(status.reconciliation_scope.active_delivery_slice_cleared, true);
assert.equal(status.reconciliation_scope.effective_completion_claim_count, 15);
assert.equal(status.successor_authorized, false);
ok('R4-C candidate remains ineffective until merge while preserving MCFT-CAP-04 boundary');

console.log('MCFT-CAP-03 R4-C SSOT reconciliation: ' + pass + ' PASS, 0 FAIL');
`;
fs.writeFileSync(absolute(acceptancePath), acceptance, 'utf8');

console.log('MCFT-CAP-03 R4-C materialization complete');
