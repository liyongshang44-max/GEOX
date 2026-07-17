// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.cjs
// Purpose: validate the independent predecessor graph/dual-time prerequisite from structured contracts and preflight evidence.
// Boundary: no source-sentence matching, runtime execution, database access, canonical write, S5 implementation, activation, or State/checkpoint authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_PREDECESSOR_GRAPH_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_PREDECESSOR_GRAPH_GOVERNANCE_RESULT.json');
const PRE = 'MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const REQUIRED_STAGES = [
  'TYPECHECK',
  'BUILD',
  'S1_NUMERICAL_BASELINE_REGRESSION',
  'V2_DOMAIN_GRAPH_CONFORMANCE',
  'V2_POSTGRESQL_EXACT_REF_CONFORMANCE',
  'S2_EXACT_MATH_COMPATIBILITY',
  'S3_PERSISTENCE_REGRESSION',
  'S4_DOMAIN_AND_FORMAL_COMPOSITION',
  'S4_STRUCTURED_GOVERNANCE_REGRESSION',
  'S5_ENTRY_EFFECTIVENESS_REGRESSION'
];
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s5-predecessor-graph-conformance.yml',
  'apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.ts',
  'apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-AUTHORITY-GRAPH-V2.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-GRAPH-CONFORMANCE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK-AMENDMENT-S5-PREDECESSOR-GRAPH-CONFORMANCE-V1.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_AUTHORIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY_EFFECTIVENESS.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_PREDECESSOR_GRAPH_CONFORMANCE.cjs',
  'scripts/runtime_acceptance/mcft_cap_06_s5_graph_conformant_fixture_v2.ts'
];
const PROTECTED_PATHS = [
  'apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts',
  'apps/server/src/domain/twin_runtime/forecast_canonical_authority_v1.ts',
  'apps/server/src/runtime/twin_runtime/a0_record_set_builder_v1.ts'
];

function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function baselineRef() {
  const explicit = String(process.env.MCFT_CAP_06_S5_GRAPH_BASELINE_REF || '').trim();
  if (explicit) {
    git(['cat-file', '-e', `${explicit}^{commit}`]);
    return explicit;
  }
  git(['cat-file', '-e', 'origin/main^{commit}']);
  return git(['merge-base', 'HEAD', 'origin/main']);
}

function main() {
  const baseline = baselineRef();
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  const messagesRaw = git(['log', '--format=%s', `${baseline}..HEAD`]);
  const messages = messagesRaw ? messagesRaw.split(/\r?\n/).filter(Boolean) : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.deepEqual(changed.filter((file) => PROTECTED_PATHS.includes(file)), []);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);
  assert.ok(commitCount > 0 && commitCount <= 6, 'S5_GRAPH_PREREQUISITE_LOGICAL_COMMIT_COUNT_INVALID');
  for (const message of messages) {
    assert.equal(/wip|fix ci|try again|debug|temporary/i.test(message), false, `S5_GRAPH_PREREQUISITE_COMMIT_MESSAGE_INVALID:${message}`);
  }

  const graphV1AtBaseline = git(['show', `${baseline}:docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json`]);
  const graphV1Current = fs.readFileSync(path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json'), 'utf8').trim();
  assert.equal(graphV1Current, graphV1AtBaseline.trim(), 'S5_ENTRY_AUTHORITY_GRAPH_V1_HISTORY_REWRITE_FORBIDDEN');

  const contract = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-GRAPH-CONFORMANCE.json');
  const graph = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-PREDECESSOR-AUTHORITY-GRAPH-V2.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const slices = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const input = json('acceptance-output/MCFT_CAP_06_S5_PREDECESSOR_GRAPH_PREFLIGHT_INPUT.json');

  assert.equal(contract.schema_version, 'geox_mcft_cap_06_s5_predecessor_graph_conformance_v1');
  assert.equal(contract.delivery_slice_id, PRE);
  assert.equal(contract.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(contract.s5_authorized, false);
  assert.equal(contract.s5_implementation_started, false);
  assert.equal(contract.runtime_delta_boundary.canonical_write_count, 0);
  assert.equal(contract.protected_predecessor_contract_delta['canonical_object_contracts_v1.ts'], 0);
  assert.equal(contract.treatment.case_count, 24);
  assert.equal(contract.treatment.calibration_case_count, 16);
  assert.equal(contract.treatment.holdout_case_count, 8);
  assert.equal(contract.treatment.delayed_availability_case_count, 24);
  assert.equal(contract.treatment.selected_parameter_value_under_exact_s2_math, '0.034000');
  assert.equal(contract.treatment.corrected_residual_set_hash, 'sha256:a60fa14542367388e35cf562c14dffafe977c048ce975b3dadcc405d9a9ff4c1');
  assert.equal(contract.treatment.corrected_case_input_set_hash, 'sha256:d882fc19a503172223070ff511e3648d02523a99a150f8845f3e86ed2685603f');

  assert.equal(graph.schema_version, 'geox_mcft_cap_06_s5_entry_authority_graph_v2');
  assert.equal(graph.status, 'FROZEN_CORRECTED_NONZERO_AVAILABILITY_LATENCY');
  assert.equal(graph.supersedes_graph_id, 'MCFT-CAP-06.S5-EXACT-FORECAST-OBSERVATION-AUTHORITY-GRAPH-V1');
  assert.equal(graph.repository_authority.exact_residual_root_and_graph_authority, 'PostgresResolvedForecastObservationCaseAssemblerV1.resolveExactResidualRefs');
  assert.equal(graph.repository_authority.alternative_s5_or_s6_graph_authority_allowed, false);
  assert.equal(graph.resolution_policy.mode, 'EXACT_REF_HASH_ONLY');
  assert.equal(graph.resolution_policy.transaction, 'ONE_REPEATABLE_READ_READ_ONLY_TRANSACTION');
  assert.equal(graph.resolution_policy.canonical_write_count, 0);
  assert.deepEqual(graph.frozen_display_paths, [
    ['residual', 'forecast', 'forecast_config', 'source_posterior', 'forecast_evidence_window'],
    ['residual', 'residual_config', 'assimilation', 'observation_posterior', 'observation_evidence_window', 'selected_observation']
  ]);
  assert.equal(graph.dual_time_invariants.includes('observation_evidence_window.as_of == selected_observation.available_to_runtime_at'), true);
  assert.equal(graph.dual_time_invariants.includes('assimilation.logical_time == selected_observation.available_to_runtime_at'), true);

  assert.equal(delivery.active_delivery_slice_id, PRE);
  assert.deepEqual(delivery.candidate_slices, [PRE]);
  assert.equal(delivery.blocked_slices.includes(S5), true);
  assert.equal(delivery.s5_predecessor_graph_conformance.candidate_implemented, true);
  assert.equal(delivery.s5_predecessor_graph_conformance.effective, false);
  assert.equal(delivery.s5.authorized, false);
  assert.equal(delivery.s5.implementation_started, false);
  assert.equal(delivery.s5.canonical_candidate_append_authorized, false);
  assert.equal(slices.active_delivery_slice_id, PRE);
  assert.equal(slices.s5_predecessor_graph_conformance_effective, false);
  assert.equal(slices.s5_authorized, false);
  assert.equal(reconciliation.current_state.active_delivery_slice_id, PRE);
  assert.equal(reconciliation.current_state.s5_authorized, false);

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s5_predecessor_graph_preflight_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.canonical_write_count, 0);
  assert.equal(input.candidate_append_count, 0);
  assert.equal(input.s5_implementation_started, false);
  for (const stageId of REQUIRED_STAGES) {
    const stage = input.stages.find((item) => item.stage_id === stageId);
    assert.ok(stage, `S5_GRAPH_PREFLIGHT_STAGE_MISSING:${stageId}`);
    assert.equal(stage.status, 'PASS', `S5_GRAPH_PREFLIGHT_STAGE_NOT_PASS:${stageId}`);
    assert.equal(stage.exit_code, 0, `S5_GRAPH_PREFLIGHT_STAGE_EXIT_NONZERO:${stageId}`);
  }

  const result = {
    schema_version: 'geox_mcft_cap_06_s5_predecessor_graph_governance_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    logical_commit_count: commitCount,
    protected_predecessor_path_delta_count: 0,
    historical_graph_v1_unchanged: true,
    authority_graph_v2_status: graph.status,
    exact_graph_case_count: 24,
    delayed_availability_case_count: 24,
    selected_parameter_value: '0.034000',
    canonical_write_count: 0,
    candidate_append_count: 0,
    evaluation_append_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    s5_authorized: false,
    s5_implementation_started: false
  };
  write(result);
  console.log(JSON.stringify(result));
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s5_predecessor_graph_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    canonical_write_count: 0,
    s5_authorized: false,
    s5_implementation_started: false
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
