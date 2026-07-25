#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '41073db21c550bbed160295ca5ef76d0a04f2f91';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S5_PRE_CANDIDATE_GOVERNANCE_RESULT.json');
const P = {
  registry: 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CHANGED-FILE-BOUNDARY-V1.json',
  status: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
  contract: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CONTRACT-V1.json',
  predecessor: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json',
  review: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-REVIEW-POLICY-V1.json',
  workflows: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json',
  waiver: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json',
  taskbook: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  historical: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK-v0.3.5-HISTORICAL-FULL.md',
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
  assert.equal(base, BASE, 'S5_GOVERNANCE_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S5_GOVERNANCE_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S5_GOVERNANCE_DIFF_CHECK_FAILED');

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
  assert.deepEqual(changed, [...boundary.changed_files].sort(), 'S5_GOVERNANCE_CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.equal(changed.length, 9, 'S5_GOVERNANCE_CHANGED_FILE_COUNT');
  assert.equal(boundary.base_sha, base);
  assert.equal(boundary.changed_file_count, 9);
  for (const field of ['runtime_source_file_count','runtime_acceptance_file_count','database_migration_file_count','route_file_count','web_file_count']) {
    assert.equal(boundary[field], 0, `S5_GOVERNANCE_${field.toUpperCase()}_NONZERO`);
  }
  assert.equal(boundary.candidate_declaration_present, false);
  assert.equal(boundary.s5_candidate_implemented, false);
  assert.equal(boundary.implementation_authorized, false);
  const forbidden = changed.filter((file) =>
    file.startsWith('apps/server/') || file.startsWith('apps/web/') || file.startsWith('docker/')
    || file.includes('migration') || file.includes('scheduler') || file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'S5_GOVERNANCE_RUNTIME_OR_PRODUCT_SOURCE_FORBIDDEN');

  assert.equal(git('rev-parse', `HEAD:${P.taskbook}`), 'a24114ff629560345b3bd3cda6b4024b9f3d61e4');
  assert.equal(git('rev-parse', `HEAD:${P.historical}`), 'ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6');
  assert.equal(git('rev-parse', `HEAD:${P.taskbook}`), git('rev-parse', `${base}:${P.taskbook}`));

  assert.equal(contract.schema_version, 'geox_mcft_cap08_s5_contract_v1');
  assert.equal(contract.record_status, 'FROZEN_PRE_CANDIDATE_MACHINE_CONTRACT');
  assert.equal(contract.semantic_digest, digest(contract), 'S5_CONTRACT_SEMANTIC_DIGEST_MISMATCH');
  assert.equal(contract.phase_engine_contract_digest, 'sha256:41428596e893112483a8695ccd7bc28dc19dee35c2c3bf29e78395a86133d466');
  assert.deepEqual(contract.required_phase_order, ['resolve','E','H','A','B','G','C','barrier']);
  assert.equal(contract.residual_contract.residual_count, 24);
  assert.equal(contract.residual_contract.r01_commit_tick, 'T16');
  assert.equal(contract.residual_contract.r01_order_position, 1);
  assert.equal(contract.dataset_split.calibration_case_count, 16);
  assert.equal(contract.dataset_split.holdout_case_count, 8);
  assert.equal(new Set(contract.dataset_split.calibration_case_ids).size, 16);
  assert.equal(new Set(contract.dataset_split.holdout_case_ids).size, 8);
  assert.equal(contract.dataset_split.calibration_case_ids.some((id) => contract.dataset_split.holdout_case_ids.includes(id)), false);
  assert.equal(contract.candidate_oracle.base_value, '0.030000');
  assert.equal(contract.candidate_oracle.expected_candidate_value, '0.034000');
  assert.equal(contract.candidate_oracle.grid_point_count, 21);
  assert.equal(contract.shadow_contract.paired_holdout_case_count, 8);
  assert.equal(contract.shadow_contract.candidate_active_during_shadow, false);
  assert.equal(contract.shadow_contract.future_leakage_count, 0);
  assert.equal(contract.shadow_contract.active_runtime_config_switch_count, 0);
  assert.equal(contract.shadow_contract.model_activation_count, 0);
  assert.deepEqual(contract.cardinality_oracle, {residual:24,calibration:16,holdout:8,candidate:1,shadow:1,model_activation:0});
  assert.equal(contract.persistence_policy.database_migration_delta, 0);
  assert.equal(contract.persistence_policy.production_runtime_source_authorized, false);
  assert.equal(contract.implementation_authorized, false);
  assert.equal(contract.candidate_declaration_authorized, false);
  assert.equal(contract.s5_effective, false);
  assert.equal(contract.s6_authorized, false);

  assert.equal(status.record_status, 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED');
  assert.equal(status.s5_candidate_implemented, false);
  assert.equal(status.delivery_state, 'SEEDED_NOT_AUTHORIZED');
  assert.equal(status.implementation_authorized, false);
  assert.equal(status.bounded_canonical_transaction_authorized, false);
  assert.equal(status.independent_review_required, false);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_performed, false);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.technical_gate_relaxation, false);
  assert.equal(status.residual_count_expected, 24);
  assert.equal(status.calibration_case_count_expected, 16);
  assert.equal(status.holdout_case_count_expected, 8);
  assert.equal(status.calibration_candidate_count_expected, 1);
  assert.equal(status.shadow_evaluation_count_expected, 1);
  assert.equal(status.model_activation_count_expected, 0);
  assert.equal(status.active_runtime_config_switch_count_expected, 0);
  assert.equal(status.s5_effective, false);
  assert.equal(status.s6_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);

  assert.equal(predecessor.record_status, 'PRE_REGISTERED_AWAITING_S4_EXACT_SHA_EFFECTIVENESS');
  assert.equal(predecessor.required_effective_status, 'S4_LATE_EVIDENCE_APPEND_FORWARD_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.required_effective_next_slice, 'S5');
  assert.equal(predecessor.required_artifact_readback, true);
  assert.equal(predecessor.source_merge_subject_sha, null);
  assert.equal(predecessor.predecessor_effectiveness_satisfied, false);
  assert.equal(predecessor.implementation_entry_authorized, false);

  assert.equal(waiver.policy_id, 'MCFT-CAP-08-S3-S5-INTERIM-OWNER-REVIEW-WAIVER-V1');
  assert.deepEqual(waiver.interim_slice_scope, ['MCFT-CAP-08.S3','MCFT-CAP-08.S4','MCFT-CAP-08.S5']);
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
  assert.equal(workflows.candidate_workflow.runs_exact_24_residual_proof, true);
  assert.equal(workflows.candidate_workflow.runs_21_point_grid_search, true);
  assert.equal(workflows.exact_sha_workflow.present_in_governance_pr, false);
  assert.equal(workflows.exact_sha_workflow.retention_level, 'R1');

  const baseRegistry = JSON.parse(git('show', `${base}:${P.registry}`));
  const topCurrent = structuredClone(registry);
  const topBase = structuredClone(baseRegistry);
  delete topCurrent.authority_set_revision;
  delete topCurrent.authority_set_change_id;
  delete topCurrent.capabilities;
  delete topBase.capabilities;
  assert.deepEqual(topCurrent, topBase, 'S5_REGISTRY_TOP_LEVEL_COMPATIBILITY_DRIFT');
  for (const line of ['MCFT-CAP-06','MCFT-CAP-07']) {
    assert.deepEqual(registry.capabilities.find((entry) => entry.capability_line === line),
      baseRegistry.capabilities.find((entry) => entry.capability_line === line),
      `S5_REGISTRY_PREDECESSOR_CAPABILITY_DRIFT:${line}`);
  }
  const currentCap08 = structuredClone(registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08'));
  const baseCap08 = baseRegistry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
  currentCap08.authoritative_candidate_status_paths =
    currentCap08.authoritative_candidate_status_paths.filter((item) => item !== P.status);
  currentCap08.candidate_transition_fields =
    currentCap08.candidate_transition_fields.filter((entry) => !(entry.status_file === P.status && entry.field_path === 's5_candidate_implemented'));
  assert.deepEqual(currentCap08, baseCap08, 'S5_REGISTRY_CAP08_NON_S5_DRIFT');
  assert.equal(registry.registry_revision, '1.1');
  assert.equal(registry.authority_set_revision, '1.3');
  assert.equal(registry.authority_set_change_id, 'MCFT-CAP-08.S5-PRE-CANDIDATE-REGISTRATION');
  const cap08 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
  assert.equal(cap08.authoritative_candidate_status_paths.includes(P.status), true);
  const rules = cap08.candidate_transition_fields.filter((entry) =>
    entry.status_file === P.status && entry.field_path === 's5_candidate_implemented');
  assert.equal(rules.length, 1, 'S5_REGISTRY_RULE_CARDINALITY');
  assert.deepEqual(rules[0].allowed_candidate_values, [true]);
  assert.equal(rules[0].focused_workflow, 'mcft-cap-08-s5-residual-calibration-shadow');
  assert.equal(rules[0].standard_workflow, 'ci');
  assert.equal(rules[0].predecessor_effective_evidence_required, true);

  const source = changed.map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
  const declaration = ['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
  assert.equal(source.includes(declaration), false, 'S5_GOVERNANCE_CANDIDATE_DECLARATION_FORBIDDEN');
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.model_activation_authorized, false);

  const result = {
    schema_version: 'geox_mcft_cap08_s5_pre_candidate_governance_result_v1',
    status: 'PASS', base_sha: base, subject_sha: git('rev-parse','HEAD'),
    changed_file_count: changed.length, registry_revision: registry.registry_revision,
    authority_set_revision: registry.authority_set_revision,
    contract_semantic_digest: contract.semantic_digest,
    s5_candidate_implemented: false, runtime_source_delta: 0,
    candidate_declaration_present: false, s6_authorized: false, mcft_cap_09_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {schema_version:'geox_mcft_cap08_s5_pre_candidate_governance_result_v1',
    status:'FAIL', error:error instanceof Error ? error.message : String(error)};
  write(result);
  throw error;
}
