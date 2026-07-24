#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'c5dd204dd3a3682ae553aebdc04e4caa2eb153d3';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S4_PRE_CANDIDATE_GOVERNANCE_RESULT.json');
const P = {
  registry: 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-CHANGED-FILE-BOUNDARY-V1.json',
  status: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-DELIVERY-STATUS-V1.json',
  contract: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-CONTRACT-V1.json',
  predecessor: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-PREDECESSOR-CONSUMPTION-V1.json',
  review: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-REVIEW-POLICY-V1.json',
  workflows: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S4-WORKFLOW-DECLARATION-V1.json',
  waiver: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json',
  taskbook: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  historical: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK-v0.3.5-HISTORICAL-FULL.md',
  math: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-MATH-V1.json',
  vectors: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json',
  reference: 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_LATE_CORRECTION_MATH.ts',
};

function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function digest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy), 'utf8').digest('hex')}`;
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'S4_GOVERNANCE_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S4_GOVERNANCE_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S4_GOVERNANCE_DIFF_CHECK_FAILED');

  const registry = readJson(P.registry);
  const boundary = readJson(P.boundary);
  const status = readJson(P.status);
  const contract = readJson(P.contract);
  const predecessor = readJson(P.predecessor);
  const review = readJson(P.review);
  const workflows = readJson(P.workflows);
  const waiver = readJson(P.waiver);

  const changedRaw = git('diff', '--name-only', `${base}...HEAD`);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...boundary.changed_files].sort(), 'S4_GOVERNANCE_CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.equal(changed.length, 9, 'S4_GOVERNANCE_CHANGED_FILE_COUNT');
  assert.equal(boundary.base_sha, base);
  assert.equal(boundary.changed_file_count, changed.length);
  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.runtime_acceptance_file_count, 0);
  assert.equal(boundary.database_migration_file_count, 0);
  assert.equal(boundary.route_file_count, 0);
  assert.equal(boundary.web_file_count, 0);
  assert.equal(boundary.candidate_declaration_present, false);
  assert.equal(boundary.s4_candidate_implemented, false);
  assert.equal(boundary.implementation_authorized, false);

  const forbidden = changed.filter((file) =>
    file.startsWith('apps/server/')
    || file.startsWith('apps/web/')
    || file.startsWith('docker/')
    || file.includes('migration')
    || file.includes('scheduler')
    || file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'S4_GOVERNANCE_RUNTIME_OR_PRODUCT_SOURCE_FORBIDDEN');

  assert.equal(git('rev-parse', `HEAD:${P.taskbook}`), 'a24114ff629560345b3bd3cda6b4024b9f3d61e4');
  assert.equal(git('rev-parse', `HEAD:${P.historical}`), 'ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6');
  assert.equal(git('rev-parse', `HEAD:${P.math}`), '60f9d0eedb7fe70399208fbd5d8ad7fde7800531');
  assert.equal(git('rev-parse', `HEAD:${P.vectors}`), 'd09538685077b52a138d05aba2956d3f90fb2b04');
  assert.equal(git('rev-parse', `HEAD:${P.reference}`), '542855190ede4a7bd3dd41e016a9ab718a378c91');
  assert.equal(git('rev-parse', `HEAD:${P.taskbook}`), git('rev-parse', `${base}:${P.taskbook}`));
  assert.equal(git('rev-parse', `HEAD:${P.vectors}`), git('rev-parse', `${base}:${P.vectors}`));

  assert.equal(contract.schema_version, 'geox_mcft_cap08_s4_contract_v1');
  assert.equal(contract.record_status, 'FROZEN_PRE_CANDIDATE_MACHINE_CONTRACT');
  assert.equal(contract.semantic_digest, digest(contract), 'S4_CONTRACT_SEMANTIC_DIGEST_MISMATCH');
  assert.equal(contract.phase_engine_contract_digest, 'sha256:41428596e893112483a8695ccd7bc28dc19dee35c2c3bf29e78395a86133d466');
  assert.deepEqual(contract.required_phase_order, ['resolve', 'E', 'H', 'A', 'B', 'G', 'C', 'barrier']);
  assert.equal(contract.scope.tick_id, 'T16');
  assert.equal(contract.scope.late_observation_id, 'FVO-01');
  assert.equal(contract.scope.ordinary_due_observation_id, 'FVO-16');
  assert.equal(contract.scope.lag_hours, 15);
  assert.deepEqual(contract.scope.residual_obligations, ['R-01', 'R-16']);
  assert.equal(contract.append_forward_contract.historical_rewrite, false);
  assert.equal(contract.append_forward_contract.historical_revision_created, false);
  assert.equal(contract.append_forward_contract.historical_state_hashes_unchanged, true);
  assert.equal(contract.append_forward_contract.historical_forecast_hashes_unchanged, true);
  assert.equal(contract.append_forward_contract.current_base_profile, 'DYNAMICS_ONLY_POSTERIOR_BEFORE_LATE_CORRECTION');
  assert.equal(contract.vector_authority.vector_count, 12);
  assert.equal(contract.vector_authority.expected_values_source, 'LATE_VECTORS_FILE_ONLY');
  assert.equal(new Set(contract.vector_authority.required_vector_ids).size, 12);
  assert.equal(contract.vector_authority.production_implementation_must_pass_all_vectors, true);
  assert.equal(contract.vector_authority.acceptance_may_not_define_second_expected_value_set, true);
  assert.equal(contract.recovery_contract.t17_must_consume_exact_corrected_t16_posterior, true);
  assert.equal(contract.persistence_policy.database_migration_delta, 0);
  assert.equal(contract.persistence_policy.canonical_object_type_delta, 0);
  assert.equal(contract.implementation_authorized, false);
  assert.equal(contract.candidate_declaration_authorized, false);
  assert.equal(contract.s4_effective, false);
  assert.equal(contract.s5_authorized, false);

  assert.equal(status.record_status, 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED');
  assert.equal(status.s4_candidate_implemented, false);
  assert.equal(status.delivery_state, 'SEEDED_NOT_AUTHORIZED');
  assert.equal(status.implementation_authorized, false);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.bounded_canonical_transaction_authorized, false);
  assert.equal(status.independent_review_required, false);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_performed, false);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.technical_gate_relaxation, false);
  assert.equal(status.late_append_forward_authorized, false);
  assert.equal(status.s4_effective, false);
  assert.equal(status.s5_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);

  assert.equal(predecessor.record_status, 'PRE_REGISTERED_AWAITING_S3_EXACT_SHA_EFFECTIVENESS');
  assert.equal(predecessor.required_effective_status, 'S3_DECISION_ACTION_FEEDBACK_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.required_effective_next_slice, 'S4');
  assert.equal(predecessor.required_artifact_readback, true);
  assert.equal(predecessor.source_merge_subject_sha, null);
  assert.equal(predecessor.predecessor_effectiveness_satisfied, false);
  assert.equal(predecessor.implementation_entry_authorized, false);

  assert.equal(waiver.policy_id, 'MCFT-CAP-08-S3-S5-INTERIM-OWNER-REVIEW-WAIVER-V1');
  assert.deepEqual(waiver.interim_slice_scope, ['MCFT-CAP-08.S3', 'MCFT-CAP-08.S4', 'MCFT-CAP-08.S5']);
  assert.equal(waiver.final_closure_slice, 'MCFT-CAP-08.S6');
  assert.equal(waiver.final_closure_review_policy.independent_review_required, true);

  assert.equal(review.record_status, 'INTERIM_OWNER_WAIVER_PRE_REGISTERED');
  assert.equal(review.independent_review_required, false);
  assert.equal(review.independent_review_satisfied, false);
  assert.equal(review.independent_review_performed, false);
  assert.equal(review.independent_review_waived, true);
  assert.equal(review.technical_gate_relaxation, false);
  assert.equal(review.final_closure_review.independent_review_required, true);
  assert.equal(review.final_closure_review.review_must_target_exact_s6_candidate_head, true);

  assert.equal(workflows.governance_workflow.candidate_declaration_expected, false);
  assert.equal(workflows.governance_workflow.runtime_database_execution, false);
  assert.equal(workflows.candidate_workflow.present_in_governance_pr, false);
  assert.equal(workflows.candidate_workflow.runs_all_twelve_shared_vectors, true);
  assert.equal(workflows.exact_sha_workflow.present_in_governance_pr, false);
  assert.equal(workflows.exact_sha_workflow.retention_level, 'R1');

  const baseRegistry = JSON.parse(git('show', `${base}:${P.registry}`));
  const topLevelCurrent = structuredClone(registry);
  const topLevelBase = structuredClone(baseRegistry);
  delete topLevelCurrent.registry_revision;
  delete topLevelBase.registry_revision;
  delete topLevelCurrent.capabilities;
  delete topLevelBase.capabilities;
  assert.deepEqual(topLevelCurrent, topLevelBase, 'S4_REGISTRY_TOP_LEVEL_DRIFT');

  for (const capabilityLine of ['MCFT-CAP-06', 'MCFT-CAP-07']) {
    assert.deepEqual(
      registry.capabilities.find((entry) => entry.capability_line === capabilityLine),
      baseRegistry.capabilities.find((entry) => entry.capability_line === capabilityLine),
      `S4_REGISTRY_PREDECESSOR_CAPABILITY_DRIFT:${capabilityLine}`
    );
  }

  const currentCap08ForComparison = structuredClone(
    registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08')
  );
  const baseCap08ForComparison = baseRegistry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
  currentCap08ForComparison.authoritative_candidate_status_paths =
    currentCap08ForComparison.authoritative_candidate_status_paths.filter((item) => item !== P.status);
  currentCap08ForComparison.candidate_transition_fields =
    currentCap08ForComparison.candidate_transition_fields.filter((entry) =>
      !(entry.status_file === P.status && entry.field_path === 's4_candidate_implemented'));
  assert.deepEqual(currentCap08ForComparison, baseCap08ForComparison, 'S4_REGISTRY_CAP08_NON_S4_DRIFT');

  assert.equal(registry.registry_revision, '1.2');
  const cap08 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
  assert.ok(cap08, 'S4_REGISTRY_CAP08_MISSING');
  assert.equal(cap08.authoritative_candidate_status_paths.includes(P.status), true);
  const rules = cap08.candidate_transition_fields.filter((entry) =>
    entry.status_file === P.status && entry.field_path === 's4_candidate_implemented');
  assert.equal(rules.length, 1, 'S4_REGISTRY_RULE_CARDINALITY');
  assert.deepEqual(rules[0].allowed_candidate_values, [true]);
  assert.equal(rules[0].focused_workflow, 'mcft-cap-08-s4-late-evidence-append-forward');
  assert.equal(rules[0].standard_workflow, 'ci');
  assert.equal(rules[0].predecessor_effective_evidence_required, true);

  const result = {
    schema_version: 'geox_mcft_cap08_s4_pre_candidate_governance_result_v1',
    status: 'PASS',
    base_sha: base,
    subject_sha: git('rev-parse', 'HEAD'),
    taskbook_blob_sha: contract.taskbook_blob_sha,
    contract_semantic_digest: contract.semantic_digest,
    late_math_blob_sha: contract.late_math_blob_sha,
    late_vectors_blob_sha: contract.late_vectors_blob_sha,
    shared_vector_count: contract.vector_authority.vector_count,
    changed_file_count: changed.length,
    registry_revision: registry.registry_revision,
    s4_status_seed_present: true,
    s4_registry_rule_present: true,
    predecessor_effectiveness_satisfied: false,
    candidate_signal_present: false,
    implementation_authorized: false,
    runtime_source_delta: 0,
    technical_gate_relaxation: false,
    independent_review_waived: true,
    final_s6_independent_review_required: true,
    s4_effective: false,
    s5_authorized: false,
    mcft_cap_09_authorized: false
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s4_pre_candidate_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error)
  });
  console.error(error);
  process.exitCode = 1;
}
