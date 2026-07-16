// scripts/remediation/MATERIALIZE_MCFT_CAP_06_S0_V2_CANDIDATE.cjs
// Purpose: materialize the formal MCFT-CAP-06 S0 v2 governance candidate from the exact PostgreSQL qualification result.
// Boundary: writes only an acceptance-output bundle for review; it does not mutate repository files, canonical facts, Runtime authority, or downstream Slice status.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S0_V2_RESULT.json');
const BUNDLE_LOG_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S0_V2_CANDIDATE_BUNDLE.log');
const BASELINE_MAIN = 'ca819ba51bdf3017dbefa96015f76bd3b66a647c';
const S0_ID = 'MCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1';
const S1_ID = 'MCFT-CAP-06.MCFT-01-03-11.CANONICAL-RESIDUAL-WINDOWS-V1';

const PATHS = Object.freeze({
  task: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md',
  map: 'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  matrix: 'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  delivery: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  authorization: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION.md',
  authorizationStatus: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-AUTHORIZATION-STATUS.json',
  predecessorLock: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-PREDECESSOR-LOCK.json',
  qualification: 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DATASET-QUALIFICATION.json',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_AUTHORIZATION.cjs',
  exactQualification: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_EXACT_QUALIFICATION.ts',
  ciWrapper: 'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S0_V2_HONEST_QUALIFICATION.cjs',
  acceptanceRunner: 'scripts/acceptance/run_acceptance.cjs',
});

const FINAL_CHANGED_FILES = Object.freeze(Object.values(PATHS).sort());

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Text(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function currentHead() {
  return cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function replaceExactly(source, before, after, code) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${code}_MATCH_COUNT:${count}`);
  return source.replace(before, after);
}

function buildAuthorizationMarkdown(result, sourceCommit, runId) {
  const q = result.qualification;
  const i = result.identity;
  return `<!-- ${PATHS.authorization} -->

# GEOX MCFT-CAP-06 Authorization

## S0 v2 Candidate — predecessor lock and structural dataset qualification

\`\`\`text
capability_line_id: MCFT-CAP-06
authorization_id: MCFT-CAP-06-AUTHORIZATION-V1
delivery_slice_id: ${S0_ID}
status: S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS
baseline_main_commit: ${BASELINE_MAIN}
candidate_materialization_source_commit: ${sourceCommit}
candidate_materialization_workflow_run: ${runId}

authorization_effective: false
runtime_source_authorized: false
migration_authorized: false
canonical_write_authorized: false
active_delivery_slice_id: null
\`\`\`

S0 v2 reproduced the completed CAP-05 terminal chain in isolated PostgreSQL and locked the actual canonical predecessor identity. It then traversed the canonical Forecast Residual graph using repository recursive canonical hashing, exact Forecast/point/posterior/Evidence Window/Observation/Config/forcing/operator/geometry/numeric authorities, and dual-time anti-leakage checks.

## Frozen qualification result

\`\`\`text
dataset_qualification_status: ${q.dataset_qualification_status}
canonical_residual_count: ${q.canonical_residual_count}
eligible_residual_count: ${q.eligible_residual_count}
excluded_case_count: ${q.excluded_case_count}
invalid_graph_case_count: ${q.invalid_graph_case_count}
availability_invalid_case_count: ${q.availability_invalid_case_count}
case_graph_validation_status: ${q.case_graph_validation_status}
availability_order_validation_status: ${q.availability_order_validation_status}
homogeneity_validation_status: ${q.homogeneity_validation_status}
\`\`\`

The current repository history contains one eligible canonical H1 Residual and is structurally valid, but contains fewer than the 24 matched cases required for calibration/holdout assessment. This does not block the separately isolated controlled positive mechanism track.

## Predecessor handoff

\`\`\`text
active_lineage_ref: ${i.active_lineage_ref}
lineage_id: ${i.lineage_id}
revision_id: ${i.revision_id}
latest_posterior_state_ref: ${i.latest_posterior_state_ref}
latest_checkpoint_ref: ${i.latest_checkpoint_ref}
latest_successful_forecast_ref: ${i.latest_successful_forecast_ref}
latest_scenario_set_ref: ${i.latest_scenario_set_ref}
state_bound_runtime_config_ref: ${i.state_bound_runtime_config_ref}
config_authority_mode: ${i.config_authority_mode}
active_binding_status: ${i.active_binding_status}
checkpoint_sequence: ${i.checkpoint_sequence}
reproduced_state_fact_count: ${i.reproduced_state_fact_count}
latest_logical_time: ${i.latest_logical_time}
next_tick_logical_time: ${i.next_tick_logical_time}
\`\`\`

The historical CAP-05 value 81 is preserved as the orchestrator canonical-object fact delta. It is not reused as a State fact count; the exact isolated PostgreSQL reproduction contains 33 canonical State facts.

## Effectiveness boundary

Before merge and merged-main effectiveness activation:

\`\`\`text
authorization_effective = false
runtime_source_authorized = false
active_delivery_slice_id = null
S1 = blocked
\`\`\`

After this candidate merges, exact-head CI passes, head-to-merge tree equivalence is proven, and the merged-main Authorization Gate passes, a separate append-only effectiveness writeback may set:

\`\`\`text
authorization_effective = true
runtime_source_authorized = true
active_delivery_slice_id = ${S1_ID}
only S1 authorized
\`\`\`

No Candidate, Shadow Evaluation, Model Activation, active-config switch, State mutation, checkpoint mutation, public route, Web path, scheduler, or MCFT-CAP-07 authority is granted by S0.
`;
}

function buildAuthorizationStatus(result, sourceCommit, runId) {
  return {
    schema_version: 'geox_mcft_cap_06_authorization_status_v2',
    capability_line_id: 'MCFT-CAP-06',
    authorization_id: 'MCFT-CAP-06-AUTHORIZATION-V1',
    delivery_slice_id: S0_ID,
    status: 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS',
    baseline_main_commit: BASELINE_MAIN,
    candidate_materialization_source_commit: sourceCommit,
    candidate_materialization_workflow_run: runId,
    authorization_effective: false,
    runtime_source_authorized: false,
    migration_authorized: false,
    canonical_write_authorized: false,
    active_delivery_slice_id: null,
    predecessor_eligibility: 'RESTORED',
    predecessor_lock_status: 'CANDIDATE_COMPLETE',
    dataset_qualification_status: result.qualification.dataset_qualification_status,
    case_graph_validation_status: result.qualification.case_graph_validation_status,
    next_authorized_slice_ids_before_effectiveness: [],
    next_authorized_slice_ids_after_effectiveness: [S1_ID],
    exact_changed_file_boundary: FINAL_CHANGED_FILES,
    effectiveness: {
      effective: false,
      condition: 'S0_EXACT_HEAD_CI_PASS_AND_S0_MERGED_AND_HEAD_TO_MERGE_TREE_EQUIVALENT_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
      implementation_pr_number: 2508,
      implementation_exact_head: null,
      implementation_exact_head_ci_run: null,
      merge_commit: null,
      head_to_merge_file_delta_count: null,
      head_to_merge_tree_equivalence: 'PENDING',
      postmerge_probe_pr_number: null,
      postmerge_workflow_run: null,
      postmerge_gate: 'PENDING',
    },
    preserved_nonclaims: [
      'NO_CAP_06_RUNTIME_SOURCE_AUTHORIZATION_BEFORE_EFFECTIVENESS',
      'NO_CAP_06_MIGRATION_AUTHORIZATION',
      'NO_CAP_06_CANONICAL_WRITE_AUTHORIZATION',
      'NO_RESIDUAL_CREATED_BY_S0',
      'NO_CALIBRATION_CANDIDATE',
      'NO_SHADOW_EVALUATION',
      'NO_MODEL_ACTIVATION',
      'NO_ACTIVE_CONFIG_SWITCH',
      'NO_AUTOMATIC_PARAMETER_UPDATE',
      'NO_STATE_MUTATION_BY_S0',
      'NO_CHECKPOINT_MUTATION_BY_S0',
      'NO_PUBLIC_ROUTE',
      'NO_WEB',
      'NO_SCHEDULER',
      'NO_SHADOW_ONLINE_CLAIM',
      'NO_FIELD_CALIBRATION_CLAIM',
      'NO_MCFT_CAP_07_AUTHORIZATION',
    ],
  };
}

function buildPredecessorLock(result, sourceCommit, runId) {
  const i = result.identity;
  return {
    schema_version: 'geox_mcft_cap_06_predecessor_lock_v2',
    capability_line_id: 'MCFT-CAP-06',
    predecessor_capability_line_id: 'MCFT-CAP-05',
    delivery_slice_id: S0_ID,
    status: 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS',
    baseline_main_commit: BASELINE_MAIN,
    candidate_materialization_source_commit: sourceCommit,
    candidate_materialization_workflow_run: runId,
    identity_extraction_source: 'ISOLATED_POSTGRESQL_CANONICAL_READ_PATH',
    canonical_identity: i,
    state_count_reconciliation: {
      reproduced_state_fact_count: i.reproduced_state_fact_count,
      historical_s10_declared_global_state_count: i.historical_s10_declared_global_state_count,
      historical_s10_orchestrator_canonical_object_fact_delta: i.historical_s10_orchestrator_canonical_object_fact_delta,
      disposition: i.state_count_reconciliation,
    },
    dataset_qualification_ref: PATHS.qualification,
    validated_relations: [
      'ACTIVE_LINEAGE_REF_RESOLVES_EXACTLY_ONE_CANONICAL_LINEAGE',
      'LINEAGE_AND_REVISION_CONSISTENT_ACROSS_TERMINAL_OBJECTS',
      'CHECKPOINT_LAST_POSTERIOR_STATE_REF_MATCHES_LATEST_STATE',
      'CHECKPOINT_FORECAST_RESULT_REF_MATCHES_LATEST_COMPLETED_FORECAST',
      'LATEST_FORECAST_EQUALS_LATEST_SUCCESSFUL_FORECAST',
      'LATEST_SCENARIO_SOURCE_FORECAST_REF_HASH_MATCHES_LATEST_SUCCESSFUL_FORECAST',
      'STATE_RUNTIME_CONFIG_REF_HASH_MATCHES_EXACT_CANONICAL_RUNTIME_CONFIG',
      'CONFIG_AUTHORITY_MODE_IS_EXPLICIT_REPLAY_PIN',
      'ACTIVE_BINDING_STATUS_NOT_ESTABLISHED_WITH_NULL_REFS',
      'CHECKPOINT_SEQUENCE_EQUALS_80',
      'REPRODUCED_STATE_FACT_COUNT_EQUALS_33',
      'HISTORICAL_81_PRESERVED_AS_ORCHESTRATOR_CANONICAL_OBJECT_DELTA',
      'LATEST_LOGICAL_TIME_EQUALS_2026_06_04T09_00_00Z',
      'NEXT_TICK_LOGICAL_TIME_EQUALS_2026_06_04T10_00_00Z',
    ],
    failure_policy: {
      canonical_value_mismatch: 'FAIL_CLOSED',
      missing_projection_or_canonical_object: 'FAIL_CLOSED',
      latest_and_successful_forecast_divergence: 'FAIL_CLOSED',
      scenario_forecast_binding_mismatch: 'FAIL_CLOSED',
      active_binding_substitution: 'FORBIDDEN',
      fixture_object_id_substitution: 'FORBIDDEN',
      predecessor_fact_mutation: 'FORBIDDEN',
      manual_alternate_start: 'FORBIDDEN',
    },
    effectiveness_condition: 'S0_PR_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  };
}

function buildQualification(result, sourceCommit, runId) {
  return {
    ...result.qualification,
    schema_version: 'geox_mcft_cap_06_dataset_qualification_v2',
    capability_line_id: 'MCFT-CAP-06',
    delivery_slice_id: S0_ID,
    status: 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS',
    baseline_main_commit: BASELINE_MAIN,
    candidate_materialization_source_commit: sourceCommit,
    candidate_materialization_workflow_run: runId,
    predecessor_lock_ref: PATHS.predecessorLock,
    qualification_effective: false,
    effectiveness_condition: 'S0_PR_MERGED_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
  };
}

function updateDelivery(result) {
  const delivery = readJson(PATHS.delivery);
  delivery.status = 'GOVERNANCE_AUTHORIZED';
  delivery.implementation_status = 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS';
  delivery.authorization_effective = false;
  delivery.runtime_source_authorized = false;
  delivery.active_delivery_slice_id = null;
  delivery.next_repository_action = 'MCFT-CAP-06.S0.MERGE-AND-MERGED-MAIN-AUTHORIZATION-GATE-V1';
  delivery.candidate_slices = [{
    delivery_slice_id: S0_ID,
    status: 'CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS',
    baseline_main_commit: BASELINE_MAIN,
    dataset_qualification_status: result.qualification.dataset_qualification_status,
    case_graph_validation_status: result.qualification.case_graph_validation_status,
    runtime_source_authorized: false,
    canonical_write_authorized: false,
    next_authorized_slice_after_effectiveness: S1_ID,
  }];
  delivery.authorized_not_started_slices = [];
  delivery.s0_qualification_authorized = true;
  delivery.s0_candidate_materialized = true;
  delivery.s0_effective = false;
  delivery.exact_s0_candidate_changed_file_boundary = FINAL_CHANGED_FILES;
  return stableJson(delivery);
}

function updateTask(result) {
  let task = readText(PATHS.task);
  task = replaceExactly(
    task,
    'implementation_status:\nP0_MERGED_EFFECTIVE_S0_AUTHORIZED_NOT_STARTED',
    'implementation_status:\nS0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS',
    'TASK_IMPLEMENTATION_STATUS',
  );
  task = replaceExactly(
    task,
    'first_permitted_repository_action:\nMCFT-CAP-06.GOV-AUTHORIZATION-PREDECESSOR-AND-DATASET-QUALIFICATION-V1',
    'first_permitted_repository_action:\nMCFT-CAP-06.S0.MERGE-AND-MERGED-MAIN-AUTHORIZATION-GATE-V1',
    'TASK_NEXT_ACTION',
  );
  task = replaceExactly(
    task,
    '本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1 与 P0 均已 merged-main effective；CAP-05 predecessor eligibility 已恢复，S0 qualification 已授权但尚未开始。CAP-06 Runtime source、migration、canonical write、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。',
    '本文件冻结 MCFT-CAP-06 的能力目标、边界和任务顺序。P-1 与 P0 均已 merged-main effective；CAP-05 predecessor eligibility 已恢复。S0 v2 已从 reconciled main 完成 exact PostgreSQL predecessor reconstruction 与 structural dataset qualification，并形成候选，等待 merge、tree equivalence 与 merged-main Authorization Gate。CAP-06 Runtime source、migration、canonical write、Model Activation、active-config switch、public route、Web、MCFT-CAP-07 与 Shadow-Online Runtime 仍未授权。',
    'TASK_STATUS_PARAGRAPH',
  );
  task = replaceExactly(
    task,
    'global State count:\n81',
    'historical S10 label, not authoritative State fact count:\n81\n\nexact S0 v2 reproduced State fact count:\n33',
    'TASK_STATE_COUNT_RECONCILIATION',
  );
  const marker = '# 44. S0 v2 Candidate Materialization';
  if (!task.includes(marker)) {
    task = `${task.trimEnd()}\n\n---\n\n${marker}\n\n\`\`\`text\nbaseline_main_commit: ${BASELINE_MAIN}\nstatus: S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS\ndataset_qualification_status: ${result.qualification.dataset_qualification_status}\ncanonical_residual_count: ${result.qualification.canonical_residual_count}\neligible_residual_count: ${result.qualification.eligible_residual_count}\ncase_graph_validation_status: ${result.qualification.case_graph_validation_status}\navailability_order_validation_status: ${result.qualification.availability_order_validation_status}\nhomogeneity_validation_status: ${result.qualification.homogeneity_validation_status}\ncheckpoint_sequence: ${result.identity.checkpoint_sequence}\nreproduced_state_fact_count: ${result.identity.reproduced_state_fact_count}\nconfig_authority_mode: ${result.identity.config_authority_mode}\nactive_binding_status: ${result.identity.active_binding_status}\nauthorization_effective: false\nruntime_source_authorized: false\nactive_delivery_slice_id: null\n\`\`\`\n\nS0 v2 confirms that the repository-history graph is valid and homogeneous but currently contains only one eligible H1 Residual, so the repository-history track is structurally insufficient for calibration assessment. The controlled positive mechanism track remains independently eligible only after S0 merged-main effectiveness activates S1.\n`;
  }
  return task;
}

function updateMap(result) {
  let map = readText(PATHS.map);
  const marker = '## MCFT-CAP-06 S0 v2 Candidate — Exact Predecessor and Dataset Qualification';
  if (!map.includes(marker)) {
    map = `${map.trimEnd()}\n\n---\n\n${marker}\n\n\`\`\`text\nbaseline_main_commit: ${BASELINE_MAIN}\ndelivery_slice_id: ${S0_ID}\nstatus: S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS\nauthorization_effective: false\nruntime_source_authorized: false\nactive_delivery_slice_id: null\npredecessor_eligibility: RESTORED\ndataset_qualification_status: ${result.qualification.dataset_qualification_status}\ncase_graph_validation_status: ${result.qualification.case_graph_validation_status}\ncanonical_residual_count: ${result.qualification.canonical_residual_count}\neligible_residual_count: ${result.qualification.eligible_residual_count}\nnext_slice_after_effectiveness: ${S1_ID}\n\`\`\`\n\nThe exact isolated PostgreSQL replay locks checkpoint 80, 33 reproduced State facts, the terminal State/Forecast/Scenario/Config graph, and an explicit replay pin with no active binding. S0 creates no canonical Runtime objects and grants no downstream Runtime authority before merged-main effectiveness.\n`;
  }
  return map;
}

function updateMatrix(result) {
  const matrix = readJson(PATHS.matrix);
  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  if (!Array.isArray(lines)) throw new Error('MATRIX_CAPABILITY_LINES_REQUIRED');
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  if (!line) throw new Error('MATRIX_CAP_06_LINE_REQUIRED');
  line.status = 'NOT_AUTHORIZED';
  line.authorization_id = 'MCFT-CAP-06-AUTHORIZATION-V1';
  line.authorization_status = 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS';
  line.authorization_effective = false;
  line.runtime_source_authorized = false;
  line.design_status = 'CONDITIONAL_FROZEN_AFTER_P_MINUS_1';
  line.implementation_status = 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS';
  line.predecessor_capability_line_id = 'MCFT-CAP-05';
  line.predecessor_eligibility = 'RESTORED';
  line.active_delivery_slice_id = null;
  line.next_delivery_slice_id = S0_ID;
  line.next_delivery_slice_authorized = false;
  line.dataset_qualification_status = result.qualification.dataset_qualification_status;
  line.case_graph_validation_status = result.qualification.case_graph_validation_status;
  line.candidate_runtime_implemented = false;
  line.shadow_evaluation_runtime_implemented = false;
  line.capability_complete = false;
  if (!Array.isArray(line.delivery_slices)) line.delivery_slices = [];
  line.delivery_slices = line.delivery_slices.filter((slice) => slice.delivery_slice_id !== S0_ID);
  line.delivery_slices.push({
    delivery_slice_id: S0_ID,
    slice_kind: 'GOVERNANCE_PREDECESSOR_QUALIFICATION_ONLY',
    status: 'CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS',
    baseline_main_commit: BASELINE_MAIN,
    runtime_source_authorized: false,
    canonical_write_authorized: false,
    dataset_qualification_status: result.qualification.dataset_qualification_status,
    case_graph_validation_status: result.qualification.case_graph_validation_status,
    exact_changed_file_boundary: FINAL_CHANGED_FILES,
    effectiveness_condition: 'S0_PR_MERGED_AND_HEAD_TO_MERGE_TREE_EQUIVALENT_AND_MERGED_MAIN_AUTHORIZATION_GATE_PASS',
    effectiveness_condition_satisfied: false,
  });
  return stableJson(matrix);
}

function buildGovernanceGate() {
  const boundaryLiteral = JSON.stringify(FINAL_CHANGED_FILES, null, 2);
  return `// ${PATHS.gate}
// Purpose: fail closed on the MCFT-CAP-06 S0 v2 candidate and merged-main effectiveness prerequisites.
// Boundary: governance/readback validation only; no Runtime, persistence, route, scheduler, Candidate, Evaluation, or activation write.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_MAIN = '${BASELINE_MAIN}';
const S0 = '${S0_ID}';
const S1 = '${S1_ID}';
const EXACT_CHANGED_FILES = Object.freeze(${boundaryLiteral});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function main() {
  const postmerge = process.argv.includes('--postmerge');
  const authorization = readJson('${PATHS.authorizationStatus}');
  const lock = readJson('${PATHS.predecessorLock}');
  const qualification = readJson('${PATHS.qualification}');
  const delivery = readJson('${PATHS.delivery}');
  const matrix = readJson('${PATHS.matrix}');
  const task = readText('${PATHS.task}');
  const map = readText('${PATHS.map}');

  assert.equal(authorization.capability_line_id, 'MCFT-CAP-06');
  assert.equal(authorization.delivery_slice_id, S0);
  assert.equal(authorization.baseline_main_commit, BASELINE_MAIN);
  assert.equal(authorization.status, 'S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS');
  assert.equal(authorization.authorization_effective, false);
  assert.equal(authorization.runtime_source_authorized, false);
  assert.equal(authorization.active_delivery_slice_id, null);
  assert.deepEqual([...authorization.exact_changed_file_boundary].sort(), [...EXACT_CHANGED_FILES].sort());

  assert.equal(lock.canonical_identity.checkpoint_sequence, 80);
  assert.equal(lock.canonical_identity.reproduced_state_fact_count, 33);
  assert.equal(lock.canonical_identity.config_authority_mode, 'EXPLICIT_REPLAY_PIN');
  assert.equal(lock.canonical_identity.active_binding_status, 'NOT_ESTABLISHED');
  assert.equal(lock.canonical_identity.active_binding_ref, null);
  assert.equal(lock.canonical_identity.active_binding_hash, null);

  assert.equal(qualification.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(qualification.canonical_residual_count, 1);
  assert.equal(qualification.eligible_residual_count, 1);
  assert.equal(qualification.excluded_case_count, 0);
  assert.equal(qualification.invalid_graph_case_count, 0);
  assert.equal(qualification.availability_invalid_case_count, 0);
  assert.equal(qualification.case_graph_validation_status, 'PASS');
  assert.equal(qualification.availability_order_validation_status, 'PASS');
  assert.equal(qualification.homogeneity_validation_status, 'PASS');
  assert.equal(qualification.qualification_effective, false);

  assert.equal(delivery.runtime_source_authorized, false);
  assert.equal(delivery.authorization_effective, false);
  assert.equal(delivery.active_delivery_slice_id, null);
  assert.equal(delivery.s0_candidate_materialized, true);
  assert.equal(delivery.s0_effective, false);
  assert.equal(delivery.candidate_slices.length, 1);
  assert.equal(delivery.candidate_slices[0].delivery_slice_id, S0);
  assert.equal(delivery.candidate_slices[0].next_authorized_slice_after_effectiveness, S1);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.authorization_effective, false);
  assert.equal(line.runtime_source_authorized, false);
  assert.equal(line.active_delivery_slice_id, null);
  assert.equal(line.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  assert.equal(line.capability_complete, false);

  assert.ok(task.includes('S0_CANDIDATE_PENDING_MERGED_MAIN_EFFECTIVENESS'));
  assert.ok(task.includes('exact S0 v2 reproduced State fact count:\n33'));
  assert.ok(map.includes('MCFT-CAP-06 S0 v2 Candidate'));

  for (const forbidden of [
    'twin_model_activation_v1 write implementation',
    'active_delivery_slice_id: ${S1_ID}',
  ]) {
    assert.equal(readText('${PATHS.authorization}').includes(forbidden), false, 'FORBIDDEN_PRE_EFFECTIVENESS_CLAIM:' + forbidden);
  }

  console.log('PASS MCFT-CAP-06 S0 v2 governance candidate');
  console.log('PASS repository history classification = INSUFFICIENT_MATCHED_PAIRS');
  console.log('PASS graph/availability/homogeneity validation');
  console.log('PASS Runtime/canonical-write/activation authority remains false');
  console.log(postmerge
    ? 'PASS merged-main candidate is eligible for separate effectiveness activation writeback'
    : 'PASS premerge candidate boundary');
}

main();
`;
}

function buildExactQualificationSource() {
  let source = readText(PATHS.exactQualification);
  const outcomeStart = source.indexOf('  assert.equal(qualification.dataset_qualification_status, "INSUFFICIENT_MATCHED_PAIRS"');
  const outcomeEndMarker = '  ok("exact canonical case graph reports one eligible Residual and INSUFFICIENT_MATCHED_PAIRS without conflating legal exclusions with graph failure");';
  if (outcomeStart < 0) throw new Error('EXACT_RUNNER_OUTCOME_START_REQUIRED');
  const outcomeEndStart = source.indexOf(outcomeEndMarker, outcomeStart);
  if (outcomeEndStart < 0) throw new Error('EXACT_RUNNER_OUTCOME_END_REQUIRED');
  const outcomeEnd = outcomeEndStart + outcomeEndMarker.length;
  const honestChecks = `  const allowedQualificationStatuses = new Set([\n    "READY_FOR_CALIBRATION_ASSESSMENT",\n    "INSUFFICIENT_MATCHED_PAIRS",\n    "CONFIG_OR_MODEL_HETEROGENEITY",\n    "AVAILABILITY_ORDER_INVALID",\n    "INVALID_CASE_GRAPH",\n  ]);\n  assert.ok(allowedQualificationStatuses.has(qualification.dataset_qualification_status), \`UNFROZEN_DATASET_QUALIFICATION_STATUS:\${qualification.dataset_qualification_status}\`);\n  assert.equal(qualification.case_graph_validation_status, qualification.invalid_graph_case_count === 0 ? "PASS" : "FAIL", "CASE_GRAPH_STATUS_COUNT_MISMATCH");\n  assert.equal(qualification.availability_order_validation_status, qualification.availability_invalid_case_count === 0 && splitValid ? "PASS" : "FAIL", "AVAILABILITY_STATUS_COUNT_MISMATCH");\n  assert.equal(qualification.homogeneity_validation_status, heterogeneity ? "FAIL" : "PASS", "HOMOGENEITY_STATUS_COUNT_MISMATCH");\n  assert.equal(qualification.canonical_residual_count, qualification.eligible_residual_count + qualification.excluded_case_count + qualification.invalid_graph_case_count + qualification.availability_invalid_case_count, "RESIDUAL_CLASSIFICATION_PARTITION_MISMATCH");\n  ok(\`exact canonical case graph qualification completed honestly with status \${qualification.dataset_qualification_status}\`);`;
  source = source.slice(0, outcomeStart) + honestChecks + source.slice(outcomeEnd);
  source = replaceExactly(
    source,
    '  run(process.platform === "win32" ? "git.exe" : "git", ["diff", "--check", BASELINE_MAIN]);',
    `  run(process.platform === "win32" ? "git.exe" : "git", ["diff", "--check", BASELINE_MAIN, "--", ...EXACT_CHANGED_FILES]);`,
    'EXACT_RUNNER_DIFF_CHECK',
  );
  for (const marker of [
    'CURRENT_REPOSITORY_HISTORY_EXPECTED_INSUFFICIENT',
    'CURRENT_REPOSITORY_HISTORY_GRAPH_MUST_PASS',
    'CURRENT_REPOSITORY_HISTORY_EXPECTS_NO_INVALID_GRAPH',
    'CAP05_TERMINAL_HISTORY_EXPECTS_ONE_CANONICAL_RESIDUAL',
  ]) {
    if (source.includes(marker)) throw new Error(`EXACT_RUNNER_OUTCOME_PRECONDITION_RETAINED:${marker}`);
  }
  return source;
}

function main() {
  if (!fs.existsSync(RESULT_PATH)) throw new Error('S0_V2_RESULT_REQUIRED');
  const result = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf8'));
  if (result.qualification.dataset_qualification_status !== 'INSUFFICIENT_MATCHED_PAIRS') {
    throw new Error(`UNEXPECTED_ACTUAL_QUALIFICATION:${result.qualification.dataset_qualification_status}`);
  }
  if (result.qualification.case_graph_validation_status !== 'PASS') throw new Error('S0_GRAPH_MUST_PASS_FOR_CURRENT_RESULT');
  if (result.qualification.invalid_graph_case_count !== 0) throw new Error('S0_INVALID_GRAPH_CASES_MUST_BE_ZERO');

  const sourceCommit = currentHead();
  const runId = Number(process.env.GITHUB_RUN_ID || 0) || null;
  const files = new Map();
  files.set(PATHS.authorization, buildAuthorizationMarkdown(result, sourceCommit, runId));
  files.set(PATHS.authorizationStatus, stableJson(buildAuthorizationStatus(result, sourceCommit, runId)));
  files.set(PATHS.predecessorLock, stableJson(buildPredecessorLock(result, sourceCommit, runId)));
  files.set(PATHS.qualification, stableJson(buildQualification(result, sourceCommit, runId)));
  files.set(PATHS.delivery, updateDelivery(result));
  files.set(PATHS.task, updateTask(result));
  files.set(PATHS.map, updateMap(result));
  files.set(PATHS.matrix, updateMatrix(result));
  files.set(PATHS.gate, buildGovernanceGate());
  files.set(PATHS.exactQualification, buildExactQualificationSource());
  files.set(PATHS.ciWrapper, readText(PATHS.ciWrapper));
  files.set(PATHS.acceptanceRunner, readText(PATHS.acceptanceRunner));

  const bundle = {
    schema_version: 'geox_mcft_cap_06_s0_v2_candidate_bundle_v1',
    capability_line_id: 'MCFT-CAP-06',
    delivery_slice_id: S0_ID,
    baseline_main_commit: BASELINE_MAIN,
    source_commit: sourceCommit,
    workflow_run: runId,
    qualification_status: result.qualification.dataset_qualification_status,
    exact_changed_file_boundary: FINAL_CHANGED_FILES,
    files: [...files.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([relativePath, content]) => ({
      path: relativePath,
      sha256: sha256Text(content),
      content_base64: Buffer.from(content, 'utf8').toString('base64'),
    })),
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(BUNDLE_LOG_PATH, `${JSON.stringify(bundle)}\n`, 'utf8');
  console.log(`PASS S0 v2 candidate bundle materialized with ${bundle.files.length} files`);
  console.log(`PASS actual qualification status ${bundle.qualification_status}`);
}

main();
