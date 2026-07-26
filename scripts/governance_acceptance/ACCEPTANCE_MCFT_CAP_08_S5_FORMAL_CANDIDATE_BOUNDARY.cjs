#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '1a6ff1b3c2b9974f859fe473b09a49a5c8fdb678';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY_RESULT.json');
const EXPECTED = [
  '.github/workflows/mcft-cap-08-s5-pre-candidate-governance.yml',
  '.github/workflows/mcft-cap-08-s5-residual-calibration-shadow.yml',
  '.github/workflows/mcft-cap-08-s5-exact-sha-attestation.yml',
  'apps/server/src/domain/calibration/cap08_s5_case_builder_v1.ts',
  'apps/server/src/domain/calibration/cap08_s5_envelope_profiles_v1.ts',
  'apps/server/src/domain/calibration/cap08_s5_objective_grid_search_v1.ts',
  'apps/server/src/domain/twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.ts',
  'apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts',
  'apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_replay_prediction_adapter_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY.cjs',
  'scripts/governance_acceptance/mcft_cap08_s5_artifact_finalize.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s5_v2_formal_acceptance_support_v1.ts',
];
const P = {
  taskbook: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  contract: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CONTRACT-V1.json',
  registry: 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  s6: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
  frontier: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json',
  status: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
  predecessor: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json',
  implementation: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json',
  workflows: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json',
};
const git = (...args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const bool = (object, field, expected) => assert.equal(object[field], expected, `S5_FORMAL_${field.toUpperCase()}`);
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'S5_FORMAL_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S5_FORMAL_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S5_FORMAL_DIFF_CHECK');

  const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...EXPECTED].sort(), 'S5_FORMAL_CHANGED_FILE_BOUNDARY');
  assert.equal(changed.length, 21, 'S5_FORMAL_CHANGED_FILE_COUNT');
  assert.equal(git('rev-parse', `HEAD:${P.taskbook}`), 'a24114ff629560345b3bd3cda6b4024b9f3d61e4');
  assert.equal(git('rev-parse', `HEAD:${P.contract}`), 'ff682f21692859c8121c89611cec561ff491cfb8');
  for (const frozen of [P.registry, P.s6, P.frontier]) {
    assert.equal(git('rev-parse', `HEAD:${frozen}`), git('rev-parse', `${base}:${frozen}`), `S5_FORMAL_FROZEN_FILE:${frozen}`);
  }
  assert.equal(changed.some((file) => file.includes('migration') || file.startsWith('apps/web/') || file.includes('/routes/') || file.includes('scheduler')), false, 'S5_FORMAL_PRODUCT_BOUNDARY');

  const boundary = read(P.boundary);
  const status = read(P.status);
  const predecessor = read(P.predecessor);
  const implementation = read(P.implementation);
  const workflows = read(P.workflows);

  assert.deepEqual(boundary.changed_files, EXPECTED, 'S5_FORMAL_BOUNDARY_FILE_LIST');
  assert.equal(boundary.base_sha, base);
  assert.equal(boundary.changed_file_count, 21);
  assert.equal(boundary.runtime_source_file_count, 9);
  assert.equal(boundary.runtime_acceptance_file_count, 2);
  assert.equal(boundary.database_migration_file_count, 0);
  bool(boundary, 'candidate_declaration_required', true);
  bool(boundary, 's5_candidate_implemented', true);
  bool(boundary, 's5_effective', false);
  bool(boundary, 's6_authorized', false);

  assert.equal(status.record_status, 'FORMAL_S5_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  for (const [field, expected] of Object.entries({
    s5_candidate_implemented: true,
    implementation_authorized: true,
    runtime_source_authorized: true,
    bounded_canonical_transaction_authorized: true,
    independent_review_required: false,
    independent_review_satisfied: false,
    independent_review_performed: false,
    independent_review_waived: true,
    technical_gate_relaxation: false,
    final_s6_independent_review_required: true,
    residual_calibration_shadow_authorized: true,
    production_runtime_source_authorized: false,
    s5_effective: false,
    s6_authorized: false,
    mcft_cap_09_authorized: false,
  })) bool(status, field, expected);
  assert.deepEqual({
    residual: status.residual_count_expected,
    calibration: status.calibration_case_count_expected,
    objective: status.objective_case_count_expected,
    diagnostic: status.diagnostic_only_case_count_expected,
    holdout: status.holdout_case_count_expected,
    candidate: status.calibration_candidate_count_expected,
    shadow: status.shadow_evaluation_count_expected,
    activation: status.model_activation_count_expected,
    config_switch: status.active_runtime_config_switch_count_expected,
  }, { residual: 24, calibration: 16, objective: 15, diagnostic: 1, holdout: 8, candidate: 1, shadow: 1, activation: 0, config_switch: 0 });

  assert.equal(predecessor.record_status, 'REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVENESS_CONSUMED');
  assert.equal(predecessor.source_merge_subject_sha, 'b94d299851744f589d3c3a6e35111a22c17c79d0');
  assert.equal(String(predecessor.source_exact_sha_workflow_run_id), '30193754069');
  assert.equal(String(predecessor.source_artifact_id), '8629453895');
  assert.equal(predecessor.source_artifact_digest, 'sha256:14441ad429a875ef5ab713cb3972a37d77f04dcdc9d14c5d810926eeb4e2fed8');
  assert.equal(predecessor.source_semantic_artifact_digest, 'sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55');
  assert.equal(predecessor.source_database_semantic_digest, 'sha256:fd19dd2638b8844adfb18f9f78bcc19bf4bcbf010485300667136aad05a53636');
  for (const field of ['source_artifact_readback_verified', 'source_locked_version_delete_denied', 'predecessor_effectiveness_satisfied', 'implementation_entry_authorized', 'formal_candidate_authorized']) bool(predecessor, field, true);

  assert.equal(implementation.record_status, 'FORMAL_S5_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(implementation.base_sha, base);
  assert.equal(implementation.preflight_provenance.head_sha, '62c77da3634997f32f1f5840a813344c1f7ff483');
  assert.equal(String(implementation.preflight_provenance.workflow_run_id), '30196732745');
  assert.equal(String(implementation.preflight_provenance.artifact_id), '8630347607');
  assert.equal(implementation.preflight_provenance.artifact_digest, 'sha256:0053af2d577d9a99eba454ee9648f00a5e012a33f16058cf044ac1b1f21c909d');
  assert.equal(String(implementation.preflight_provenance.standard_ci_run_id), '30196732749');
  assert.equal(implementation.preflight_provenance.tree_sha, 'a3604fa43c7caf9dcd52668f8c8ca448a290d366');
  assert.equal(implementation.preflight_provenance.prior_evidence_is_not_candidate_proof, true);
  assert.deepEqual({
    residual: implementation.formal_oracle.residual_count,
    calibration: implementation.formal_oracle.calibration_case_count,
    objective: implementation.formal_oracle.objective_case_count,
    diagnostic: implementation.formal_oracle.diagnostic_only_case_count,
    holdout: implementation.formal_oracle.holdout_case_count,
    grid: implementation.formal_oracle.grid_point_count,
    selected: implementation.formal_oracle.candidate_parameter_value,
    sensitive: implementation.formal_oracle.sensitive_case_count,
  }, { residual: 24, calibration: 16, objective: 15, diagnostic: 1, holdout: 8, grid: 21, selected: '0.034000', sensitive: 7 });
  assert.deepEqual(implementation.formal_oracle.diagnostic_only_observation_refs, ['FVO-10']);
  assert.deepEqual(implementation.formal_oracle.sensitive_wetness_regimes, ['HIGH_EXCESS', 'MID_EXCESS']);
  assert.equal(implementation.formal_oracle.candidate_ref, 'twin_calibration_candidate_17643469dcc3562b0b99f4d2');
  assert.equal(implementation.formal_oracle.candidate_hash, 'sha256:56b12214f5c41310f38ce97b8256651aa76ffcd3b0621a1f79b56bbcad42b86a');
  assert.equal(implementation.formal_oracle.shadow_ref, 'twin_shadow_evaluation_7cd3b55e0633267e790e05c5');
  assert.equal(implementation.formal_oracle.shadow_hash, 'sha256:faf7fd5f6856ea008db3e960e82712040feb76d82d4ab2912365805d7ac3cbbd');
  assert.equal(implementation.persistence_oracle.model_activation_count, 0);
  assert.equal(implementation.persistence_oracle.active_runtime_config_switch_count, 0);
  bool(implementation, 'production_runtime_source_authorized', false);
  bool(implementation, 's5_effective', false);
  bool(implementation, 's6_authorized', false);

  assert.equal(workflows.record_status, 'FORMAL_CANDIDATE_WORKFLOWS_PRESENT_NOT_EFFECTIVE');
  bool(workflows.governance_workflow, 'formal_candidate_delegation_present', true);
  bool(workflows.candidate_workflow, 'present_in_formal_candidate', true);
  bool(workflows.candidate_workflow, 'candidate_declaration_required', true);
  bool(workflows.candidate_workflow, 'runs_15_objective_1_diagnostic_proof', true);
  bool(workflows.exact_sha_workflow, 'present_in_formal_candidate', true);
  assert.equal(workflows.exact_sha_workflow.status_context, 'mcft-cap-08/s5-exact-sha-attestation');
  assert.deepEqual(workflows.required_pull_request_workflows, ['mcft-cap-08-s5-residual-calibration-shadow', 'ci']);

  const source = changed.map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
  for (const token of ['runCap08S5ObjectiveGridSearchV1', 'validateCap08S5V2PrequalificationEvidenceV1', 'diagnostic_only_observation_refs: ["FVO-10"]', 'model_activation_count: 0', 'active_runtime_config_switch_count: 0']) {
    assert.equal(source.includes(token), true, `S5_FORMAL_TOKEN:${token}`);
  }

  const result = {
    schema_version: 'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',
    status: 'PASS',
    base_sha: base,
    subject_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changed.length,
    changed_files: changed,
    predecessor_subject_sha: predecessor.source_merge_subject_sha,
    candidate_parameter_value: implementation.formal_oracle.candidate_parameter_value,
    candidate_ref: implementation.formal_oracle.candidate_ref,
    shadow_ref: implementation.formal_oracle.shadow_ref,
    owner_review_waived: true,
    s5_effective: false,
    s6_authorized: false,
    production_runtime_source_authorized: false,
    mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
