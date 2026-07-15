// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_RUNTIME_CONFORMANCE_REMEDIATION.cjs
// Purpose: enforce the append-only CAP-05 post-closure Runtime conformance remediation authority, non-canonical Config and Replay execution metadata separation, proven candidate PostgreSQL regression, temporary-proof cleanup, and successor block pending merged-main effectiveness.
// Boundary: repository and child-process acceptance only; no database mutation, canonical Twin write, active binding, Model Activation, calibration, route, scheduler, CAP-06 Runtime authority, merge-effectiveness claim, or predecessor-eligibility restoration.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = (relative) => JSON.parse(readText(relative));
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));

const CONTRACT = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-POST-CLOSURE-RUNTIME-CONFORMANCE-REMEDIATION.md';
const STATUS = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-POST-CLOSURE-RUNTIME-CONFORMANCE-STATUS.json';
const CLOSURE = 'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json';
const VIEW = 'apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts';
const RESOLVER = 'apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts';
const TICK = 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts';
const STATE_BUILDER = 'apps/server/src/runtime/twin_runtime/forecast_scenario_state_source_builder_v1.ts';
const RECORD_BUILDER = 'apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts';
const PENDING = 'apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts';
const RECEIPT = 'apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts';
const PORTS = 'apps/server/src/runtime/twin_runtime/ports.ts';
const REPLAY_SOURCE = 'apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts';
const EVIDENCE_WINDOW = 'apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.ts';
const OBSERVATION_SELECTOR_V1 = 'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.ts';
const OBSERVATION_SELECTOR_V2 = 'apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts';
const RUNNER = 'apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts';
const EXECUTION_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_EXECUTION_CONFIG_RESOLUTION.ts';
const REPLAY_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_REPLAY_BINDING_EXECUTION_METADATA.ts';
const POSTGRESQL_ACCEPTANCE = 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts';
const OBSOLETE_FAKE_ENVELOPE = 'apps/server/src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.ts';
const TEMPORARY_PROOF_FILES = [
  '.github/workflows/mcft-cap-05-apply-source-patch.yml',
  '.github/workflows/mcft-cap-05-execution-config-resolution.yml',
  '.github/workflows/mcft-cap-05-postgresql-runner-regression.yml',
  '.github/workflows/mcft-cap-05-postgresql-runner-regression-v2.yml',
  '.github/workflows/mcft-cap-05-replay-metadata-separation-proof.yml',
  'scripts/remediation/APPLY_MCFT_CAP_05_BUILDER_SEAM_AND_POSTGRESQL_REGRESSION.py',
  'scripts/remediation/APPLY_MCFT_CAP_05_FORMAL_REPLAY_BINDING_AUTHORITY.py',
  'scripts/remediation/APPLY_MCFT_CAP_05_OUTCOME_OBSERVATION_REPLAY_VIEW.py',
  'scripts/remediation/APPLY_MCFT_CAP_05_TERMINAL_CHAIN_VALIDATORS.py',
  'scripts/remediation/APPLY_MCFT_CAP_05_REPLAY_EXECUTION_METADATA_SEPARATION.py',
  'scripts/remediation/APPLY_MCFT_CAP_05_REPLAY_METADATA_ACCEPTANCE_AUTHORIZED_BINDING.py',
];

let pass = 0;
const ok = (label) => {
  pass += 1;
  process.stdout.write(`PASS ${label}\n`);
};

for (const relative of [
  CONTRACT,
  STATUS,
  CLOSURE,
  VIEW,
  RESOLVER,
  TICK,
  STATE_BUILDER,
  RECORD_BUILDER,
  PENDING,
  RECEIPT,
  PORTS,
  REPLAY_SOURCE,
  EVIDENCE_WINDOW,
  OBSERVATION_SELECTOR_V1,
  OBSERVATION_SELECTOR_V2,
  RUNNER,
  EXECUTION_ACCEPTANCE,
  REPLAY_ACCEPTANCE,
  POSTGRESQL_ACCEPTANCE,
]) {
  assert.equal(exists(relative), true, `REQUIRED_FILE_MISSING:${relative}`);
}
assert.equal(exists(OBSOLETE_FAKE_ENVELOPE), false, 'FAKE_CANONICAL_ENVELOPE_ADAPTER_MUST_BE_ABSENT');
for (const relative of TEMPORARY_PROOF_FILES) {
  assert.equal(exists(relative), false, `TEMPORARY_PROOF_FILE_MUST_BE_ABSENT:${relative}`);
}
ok('required permanent authority, implementation and acceptance files exist; obsolete and temporary proof files are absent');

const closure = readJson(CLOSURE);
assert.equal(closure.capability_line_id, 'MCFT-CAP-05');
assert.equal(closure.status, 'COMPLETE');
assert.equal(closure.capability_complete, true);
assert.equal(closure.closure_effective, true);
ok('historical CAP-05 closure facts remain complete and are not rewritten');

const status = readJson(STATUS);
assert.equal(status.authority_id, 'MCFT-CAP-05.POST-CLOSURE-RUNTIME-CONFORMANCE-REMEDIATION-V1');
assert.equal(status.defect_id, 'MCFT-CAP-05-CONFORMANCE-DEFECT-01');
assert.equal(status.defect_owner, 'MCFT-CAP-05');
assert.equal(status.historical_completion_status, 'COMPLETE');
assert.equal(status.historical_closure_rewrite, false);
assert.equal(status.post_closure_conformance_status, 'REMEDIATION_PROVEN_ON_CANDIDATE_BRANCH_AWAITING_MERGED_MAIN_EFFECTIVENESS');
assert.deepEqual(status.affected_claims, [
  'BOUNDED_EIGHT_TICK_FEEDBACK_CHAIN_ESTABLISHED',
  'FORMAL_POSTGRESQL_RUNNER_TERMINAL_CHAIN_REPRODUCIBLE',
]);
ok('post-closure defect authority is append-only, owned by CAP-05 and candidate-proven');

assert.equal(status.canonical_cap05_config_mutation, false);
assert.equal(status.replacement_canonical_cap04_config_created, false);
assert.equal(status.derived_execution_view_canonical, false);
assert.equal(status.derived_execution_view_persisted, false);
assert.equal(status.cap04_validator_relaxed, false);
assert.equal(status.dynamics_math_changed, false);
assert.equal(status.forecast_math_changed, false);
assert.equal(status.scenario_math_changed, false);
ok('canonical Config, validators and mathematical kernels remain frozen');

assert.equal(status.execution_view_acceptance.candidate_result, 'PASS');
assert.equal(status.execution_view_acceptance.assertion_count, 10);
const replayProof = status.replay_binding_execution_metadata_acceptance;
assert.equal(replayProof.candidate_result, 'PASS');
assert.equal(replayProof.assertion_count, 8);
assert.equal(replayProof.proof_workflow_run, 29438990685);
assert.equal(replayProof.proof_source_commit, '8b386850b0370f27d1756ab10571eec452933ad6');
assert.equal(replayProof.execution_metadata_field, 'execution_metadata');
assert.equal(replayProof.execution_metadata_policy_id, 'SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1');
assert.equal(replayProof.source_record_identity_mutation, false);
assert.equal(replayProof.source_binding_authority_mutation, false);
assert.equal(replayProof.canonical_replay_conversion_rule_mutation, false);
assert.equal(replayProof.canonical_a0_evidence_projection_mutation, false);
assert.equal(replayProof.active_lineage_identity_mutation, false);
assert.equal(replayProof.cap03_inherited_recovery_regression, 'PASS');
ok('execution-view and canonical-safe Replay execution-metadata candidate acceptances are locked');

const formal = status.formal_postgresql_runner_regression;
assert.equal(formal.status, 'PASS_CANDIDATE_BRANCH');
assert.equal(formal.proof_workflow_run, 29438990685);
assert.equal(formal.proof_source_commit, '8b386850b0370f27d1756ab10571eec452933ad6');
assert.equal(formal.candidate_pull_request, 2501);
for (const field of [
  'checkpoint_72_to_80',
  'eight_runtime_configs',
  'eight_posterior_states',
  'eight_completed_forecasts',
  'eight_scenario_sets',
  'one_canonical_residual',
  'restart_recovery',
  'failure_before_a_commit',
  'failure_between_a_and_b',
  'completed_chain_zero_write_replay',
  'canonical_config_ref_hash_persistence',
]) {
  assert.equal(formal[field], 'PASS', `FORMAL_POSTGRESQL_PROOF_NOT_PASS:${field}`);
}
assert.equal(formal.first_committed_sequence, 73);
assert.equal(formal.final_committed_sequence, 80);
assert.equal(formal.final_next_logical_tick_time, '2026-06-04T10:00:00.000Z');
assert.equal(formal.forecast_point_count, 576);
assert.equal(formal.scenario_point_count, 1728);
assert.equal(formal.causal_effect_claimed, false);
assert.equal(formal.forecast_assimilation_equivalence_claimed, false);
assert.equal(formal.automatic_history_rewrite, false);
ok('formal PostgreSQL 72-to-80 candidate proof and nonclaims are locked');

assert.equal(status.candidate_proof_cleanup.temporary_write_enabled_workflow_retained, false);
assert.equal(status.candidate_proof_cleanup.temporary_proof_workflows_retained, false);
assert.equal(status.candidate_proof_cleanup.temporary_patch_generators_retained, false);
ok('temporary proof infrastructure is not part of the remediation deliverable');

assert.equal(status.successor_capability_line_id, 'MCFT-CAP-06');
assert.equal(status.successor_predecessor_eligibility, 'BLOCKED');
assert.equal(status.cap_06_s0_status, 'BLOCKED_AWAITING_REMEDIATION_MERGED_MAIN_EFFECTIVENESS');
assert.equal(status.cap_06_s0_resume_authorized, false);
assert.equal(status.cap_06_runtime_authority, false);
assert.equal(status.cap_06_migration_authority, false);
ok('CAP-06 S0 remains blocked and receives no Runtime or migration authority before merged-main effectiveness');

const view = readText(VIEW);
assert.match(view, /export type ResolvedCap04ExecutionConfigV1 = \{/);
assert.match(view, /source_config_ref: string;/);
assert.match(view, /source_config_hash: string;/);
assert.match(view, /payload: Cap04RuntimeConfigPayloadV1;/);
assert.match(view, /DIRECT_CAP04_RUNTIME_CONFIG_V1/);
assert.match(view, /CAP05_INHERITED_CAP04_EXECUTION_VIEW_V1/);
const resolvedType = view.slice(
  view.indexOf('export type ResolvedCap04ExecutionConfigV1'),
  view.indexOf('export type Cap04ExecutionConfigResolverPortV1'),
);
assert.doesNotMatch(resolvedType, /\bobject_id\b/);
assert.doesNotMatch(resolvedType, /\bdeterminism_hash\b/);
assert.doesNotMatch(resolvedType, /\bobject_type\b/);
assert.doesNotMatch(resolvedType, /\bidempotency_key\b/);
ok('resolved execution view is structurally non-canonical');

const resolver = readText(RESOLVER);
assert.match(resolver, /validateCanonicalObjectV1\(canonicalConfig\)/);
assert.match(resolver, /validateCap05RuntimeConfigPayloadV1\(payload\)/);
assert.match(resolver, /validateCap04RuntimeConfigPayloadV1\(executionPayload\)/);
assert.match(resolver, /source_config_ref: canonicalConfig\.object_id/);
assert.match(resolver, /source_config_hash: canonicalConfig\.determinism_hash/);
assert.match(resolver, /payload: executionPayload/);
assert.doesNotMatch(resolver, /object_id:\s*canonicalConfig\.object_id/);
assert.doesNotMatch(resolver, /determinism_hash:\s*canonicalConfig\.determinism_hash/);
ok('CAP-05 resolver validates the canonical source and returns only source pins plus execution payload');

const tick = readText(TICK);
assert.match(tick, /assertCanonicalConfigEnvelopeV1/);
assert.match(tick, /executionConfigResolver\.resolveExecutionConfig\(runtimeConfig\)/);
assert.match(tick, /runtime_config: runtimeConfig/);
assert.match(tick, /execution_config_payload: config/);
assert.match(tick, /runtime_config: \{ ref: runtimeConfig\.object_id, hash: runtimeConfig\.determinism_hash \}/);
const stateBuilder = readText(STATE_BUILDER);
const recordBuilder = readText(RECORD_BUILDER);
assert.match(stateBuilder, /execution_config_payload\?: Cap04RuntimeConfigPayloadV1/);
assert.match(recordBuilder, /execution_config_payload\?: Cap04RuntimeConfigPayloadV1/);
ok('single-tick and builder seams separate canonical envelope pins from execution payload');

const pending = readText(PENDING);
assert.match(pending, /executionConfigResolver\.resolveExecutionConfig\(runtimeConfig\)/);
assert.match(pending, /ref: runtimeConfig\.object_id/);
assert.match(pending, /hash: runtimeConfig\.determinism_hash/);
const receipt = readText(RECEIPT);
assert.match(receipt, /new Cap05InheritedCap04ExecutionConfigResolverV1\(\)/);
const runner = readText(RUNNER);
assert.match(runner, /new Cap05InheritedCap04ExecutionConfigResolverV1\(\)/);
assert.match(runner, /runtimeRepository/);
ok('receipt, pending-B and formal runner wiring use the separated resolver seam');

const ports = readText(PORTS);
assert.match(ports, /export type ReplayEvidenceExecutionMetadataV1 = \{/);
assert.match(ports, /execution_metadata\?: ReplayEvidenceExecutionMetadataV1;/);
const replaySource = readText(REPLAY_SOURCE);
assert.match(replaySource, /SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1/);
assert.match(replaySource, /execution_metadata: resolveConversionRuleExecutionMetadataV1\(binding\)/);
assert.match(replaySource, /conversion_rule: structuredClone\(binding\.conversion_rule\)/);
assert.match(replaySource, /CONVERSION_RULE_VERSION_BINDING_VERSION_MISMATCH/);
assert.match(replaySource, /sourceRecordHashV1\(record\)/);
assert.doesNotMatch(replaySource, /conversionRule\.version\s*=/);
const evidenceWindow = readText(EVIDENCE_WINDOW);
assert.match(evidenceWindow, /execution_metadata: _executionMetadata/);
assert.match(evidenceWindow, /canonicalReplayRecordForPersistenceV1\(usableSoil\[0\]\)/);
for (const selectorPath of [OBSERVATION_SELECTOR_V1, OBSERVATION_SELECTOR_V2]) {
  const selector = readText(selectorPath);
  assert.match(selector, /record\.execution_metadata/);
  assert.match(selector, /SOURCE_BINDING_CONVERSION_RULE_VERSION_FROM_BINDING_VERSION_V1/);
  assert.match(selector, /CONVERSION_RULE_EXECUTION_VERSION_MISMATCH/);
}
ok('Replay execution metadata is separate, fail-closed and excluded from canonical A0 identity inputs');

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
for (const [script, expectedSummary] of [
  [EXECUTION_ACCEPTANCE, 'SUMMARY 10 PASS / 0 FAIL'],
  [REPLAY_ACCEPTANCE, 'SUMMARY 8 PASS / 0 FAIL'],
]) {
  const result = spawnSync(command, ['-w', 'exec', 'tsx', script], {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `RUNTIME_ACCEPTANCE_FAILED:${script}`);
  assert.match(result.stdout, new RegExp(expectedSummary.replaceAll('/', '\\/')));
}
ok('permanent non-database remediation acceptances pass');

assert.equal(pass, 13);
process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
