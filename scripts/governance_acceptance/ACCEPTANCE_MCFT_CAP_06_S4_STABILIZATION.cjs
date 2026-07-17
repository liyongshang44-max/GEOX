// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs
// Purpose: fail closed unless MCFT-CAP-06 S4 preserves the positive execution projection, exact-ref read-only graph assembly, CAP-05 baseline precedence, four-layer composition proof, and all no-write/nonactivation boundaries.
// Boundary: static repository and machine-readable governance validation only; no database access, canonical append, projection mutation, calibration/shadow compute, Runtime authority, State, checkpoint, route, Web, scheduler, Model Activation, or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'e9fa7fcf382ff64c3a60d30ef83ca6dd216585a4';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s4-focused-validation.yml',
  'apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.ts',
  'apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.ts',
  'apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-EFFECTIVE-RUNTIME-BASELINE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs',
];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(read(relative));
}

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function changedFiles() {
  git(['cat-file', '-e', `${BASELINE}^{commit}`]);
  const output = git(['diff', '--name-only', `${BASELINE}...HEAD`]);
  return output ? output.split(/\r?\n/).filter(Boolean).sort() : [];
}

function assertNoPattern(text, pattern, code) {
  assert.equal(pattern.test(text), false, code);
}

function main() {
  const changed = changedFiles();
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);

  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');
  const cap05Baseline = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-EFFECTIVE-RUNTIME-BASELINE.json');

  assert.equal(status.delivery_slice_id, S4);
  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.authorization.s3_merged_effective, true);
  assert.equal(status.authorization.s4_authorized, true);
  assert.equal(status.authorization.s5_authorized, false);
  assert.equal(status.implementation.positive_cap04_execution_projection, true);
  assert.equal(status.implementation.subtractive_cap05_field_removal_replaced, true);
  assert.equal(status.implementation.resolved_forecast_observation_case_read_model, true);
  assert.equal(status.implementation.exact_ref_postgresql_graph_assembler, true);
  assert.equal(status.implementation.single_repeatable_read_snapshot_batch_resolution, true);
  assert.equal(status.implementation.new_canonical_type_count, 0);
  assert.equal(status.implementation.migration_count, 0);
  assert.equal(status.s4_effective, false);
  assert.equal(status.s5_authorized, false);

  assert.equal(delivery.active_delivery_slice_id, S4);
  assert.deepEqual(delivery.candidate_slices, [S4]);
  assert.deepEqual(delivery.authorized_not_started_slices, []);
  assert.equal(delivery.blocked_slices.includes(S5), true);
  assert.equal(delivery.s4.implementation_started, true);
  assert.equal(delivery.s4.candidate_implemented, true);
  assert.equal(delivery.s4.effective, false);

  assert.equal(debt.status, 'S4_CANDIDATE_TREATMENTS_NOT_EFFECTIVE');
  assert.deepEqual(
    debt.open_structural_debt.map((item) => item.status),
    Array(4).fill('CANDIDATE_TREATED_NOT_EFFECTIVE'),
  );
  assert.equal(debt.s4_effective, false);
  assert.equal(debt.s5_authorized, false);

  assert.equal(cap05Baseline.historical_closure_commit, 'fd6c54e84ee4ede7bbb581b4fc55660251c2265f');
  assert.equal(cap05Baseline.latest_effective_amendment_commit, '0867439b17545bec5fd84e373e72d17881ab50ae');
  assert.equal(cap05Baseline.effective_runtime_baseline_commit, '0867439b17545bec5fd84e373e72d17881ab50ae');
  assert.equal(cap05Baseline.current_successor_eligibility, 'RESTORED');
  assert.equal(cap05Baseline.formal_runner_proof_workflow_run, 29441019824);
  assert.equal(cap05Baseline.historical_closure_rewrite, false);
  assert.equal(cap05Baseline.runtime_behavior_change, false);

  const canonicalContracts = read('apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts');
  assert.match(canonicalContracts, /object\.payload\.status === "BLOCKED"/);
  assert.match(canonicalContracts, /object\.payload\.status === "COMPLETED"/);
  assert.match(canonicalContracts, /BLOCKED_FORECAST_ZERO_POINTS_REQUIRED/);
  assert.match(canonicalContracts, /COMPLETED_FORECAST_POINTS_REQUIRED/);
  assert.match(canonicalContracts, /COMPLETED_FORECAST_SCENARIO_ELIGIBLE_REQUIRED/);
  assert.match(canonicalContracts, /A0_REF_STATE_TRANSITION_MISMATCH/);
  assert.match(canonicalContracts, /A0_REF_TICK_FORECAST_MISMATCH/);
  assert.match(canonicalContracts, /A0_AGGREGATE_HASH_MISMATCH/);

  const resolver = read('apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts');
  assert.match(resolver, /projectCap05PayloadToCap04ExecutionPayloadV1/);
  assert.match(resolver, /satisfies Cap04RuntimeConfigPayloadV1/);
  assert.match(resolver, /validateCap05RuntimeConfigPayloadV1\(payload\)/);
  assert.match(resolver, /validateCap04RuntimeConfigPayloadV1\(projected\)/);
  assertNoPattern(resolver, /\.\.\.inherited/, 'S4_SUBTRACTIVE_INHERITED_SPREAD_FORBIDDEN');
  assertNoPattern(resolver, /const\s*\{[^}]*cap05_/s, 'S4_CAP05_SUBTRACTIVE_DESTRUCTURING_FORBIDDEN');

  const graph = read('apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.ts');
  assert.match(graph, /canonical_identity_assigned: false/);
  assert.match(graph, /assembleResolvedForecastObservationCaseV1/);
  assert.match(graph, /CAP06_GRAPH_FUTURE_LEAKAGE_DETECTED/);
  assert.match(graph, /source_forecast_evidence_window/);
  assert.match(graph, /observation_posterior/);
  assert.match(graph, /observation_evidence_window/);
  assert.match(graph, /residual_runtime_config/);
  assert.match(graph, /resolved_residual_execution_config/);
  assert.match(graph, /source_execution/);
  assert.match(graph, /residual_execution/);
  assertNoPattern(graph, /deriveSemanticObjectIdV1|computeMemberDeterminismHashV1/, 'S4_GRAPH_CANONICAL_IDENTITY_FORBIDDEN');

  const postgres = read('apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.ts');
  assert.match(postgres, /REPEATABLE READ READ ONLY/);
  assert.match(postgres, /resolveExactResidualGraphs/);
  assert.match(postgres, /record_json->'payload'->>'object_id'=\$1/);
  assert.match(postgres, /selectedObservationFromEvidenceWindowV1/);
  assert.match(postgres, /sourceRuntimeConfig/);
  assert.match(postgres, /residualRuntimeConfig/);
  assert.match(postgres, /resolvedExecutionConfig/);
  assert.match(postgres, /resolvedResidualExecutionConfig/);
  assertNoPattern(postgres, /record_json->'payload'->>'source_record_id'=\$1/, 'S4_RAW_OBSERVATION_SIDE_LOOKUP_FORBIDDEN');
  for (const token of [
    'listResiduals',
    'searchResiduals',
    'latestResiduals',
    'loadResidualsAfter',
    'queryByTimeRange',
    'queryByScopeRange',
  ]) assert.equal(postgres.includes(token), false, `S4_GRAPH_FORBIDDEN_SURFACE:${token}`);
  assertNoPattern(postgres, /(INSERT|UPDATE|DELETE)\s+(INTO|FROM)?\s*facts/i, 'S4_GRAPH_FACT_WRITE_FORBIDDEN');

  const exactRepository = read('apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.ts');
  assert.match(exactRepository, /resolveExactResidualGraphs/);
  assert.match(exactRepository, /caseSource\.case_index !== caseIndex/);
  assert.match(exactRepository, /record_json->'payload'->>'object_id'=ANY\(\$1::text\[\]\)/);

  const cap05Runner = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts');
  assert.match(cap05Runner, /MCFT_CAP_05_POST_CLOSURE_RETAIN_DATABASE/);
  assert.match(cap05Runner, /MCFT_CAP_05_POST_CLOSURE_RESULT_PATH/);
  assert.match(cap05Runner, /expires_at=acquired_at\+interval '1 microsecond'/);
  assertNoPattern(cap05Runner, /expires_at=transaction_timestamp\(\)-interval '1 second'/, 'S4_INVALID_LEASE_EXPIRY_FORBIDDEN');

  const domainAcceptance = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN.ts');
  assert.match(domainAcceptance, /unknown future CAP-05 policy fields cannot leak/);
  assert.match(domainAcceptance, /missing frozen CAP-04 execution fields fail closed/);
  assert.match(domainAcceptance, /MCFT_CAP_06_S4_DOMAIN:PASS/);

  const composition = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB.ts');
  assert.match(composition, /PostgresResolvedForecastObservationCaseAssemblerV1/);
  assert.match(composition, /formal CAP-05 Residual resolves/);
  assert.match(composition, /canonical observation Evidence Window identity divergence fails closed/);
  assert.match(composition, /leave canonical history unchanged/);
  assert.match(composition, /MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB:PASS/);

  const runner = read('scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs');
  assert.match(runner, /ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN\.ts/);
  assert.match(runner, /ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER\.ts/);
  assert.match(runner, /ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB\.ts/);
  assert.match(runner, /ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH\.ts/);
  assert.match(runner, /S2_RESULT_JSON:/);
  assert.match(runner, /MCFT_CAP_06_S4_STABILIZATION:PASS/);

  const runtimeAndAcceptanceSource = EXPECTED_FILES
    .filter((file) => file.startsWith('apps/server/src/') || file.startsWith('scripts/runtime_acceptance/'))
    .filter((file) => fs.existsSync(path.join(ROOT, file)))
    .map(read)
    .join('\n');
  for (const token of [
    'twin_model_activation_v1',
    'active_config_switch_performed: true',
    'model_parameter_change_applied: true',
  ]) {
    const occurrences = runtimeAndAcceptanceSource.split(token).length - 1;
    if (token === 'twin_model_activation_v1') {
      assert.ok(occurrences <= 3, 'S4_MODEL_ACTIVATION_RUNTIME_IMPLEMENTATION_FORBIDDEN');
    } else {
      assert.equal(occurrences, 0, `S4_FORBIDDEN_RUNTIME_TOKEN:${token}`);
    }
  }

  console.log(`PASS MCFT-CAP-06 S4 governance gate; changed_files=${changed.length}`);
}

main();
