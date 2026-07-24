#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const AUTHORITY_PATH = path.join(
  ROOT,
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-SEMANTIC-COMPLETION-AUTHORITY-V1.json',
);
const STATUS_PATH = path.join(
  ROOT,
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json',
);
const WORKFLOW_DECLARATION_PATH = path.join(
  ROOT,
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-WORKFLOW-DECLARATION-V1.json',
);
const ENFORCEMENT_WORKFLOW_PATH = path.join(
  ROOT,
  '.github/workflows/mcft-candidate-declaration-integrity-v2.yml',
);
const SELFTEST_WORKFLOW_PATH = path.join(
  ROOT,
  '.github/workflows/mcft-candidate-declaration-selftest-v2.yml',
);
const RESULT_PATH = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_08_S3_PREFLIGHT_HARDENING_RESULT.json',
);

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((output, key) => {
      output[key] = canonicalize(value[key]);
      return output;
    }, {});
}

function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  const text = JSON.stringify(canonicalize(copy));
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function hasOnEvent(text, eventName) {
  return new RegExp(`^  ${eventName}:\\s*$`, 'm').test(text);
}

function writeResult(value) {
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

try {
  const authority = loadJson(AUTHORITY_PATH);
  const status = loadJson(STATUS_PATH);
  const workflowDeclaration = loadJson(WORKFLOW_DECLARATION_PATH);
  const enforcementWorkflow = fs.readFileSync(ENFORCEMENT_WORKFLOW_PATH, 'utf8');
  const selftestWorkflow = fs.readFileSync(SELFTEST_WORKFLOW_PATH, 'utf8');

  assert.equal(
    authority.schema_version,
    'geox_mcft_cap08_s3_semantic_completion_authority_v1',
  );
  assert.equal(
    authority.record_status,
    'FROZEN_PRE_CANDIDATE_GOVERNANCE_STORAGE_CORRECTED',
  );
  assert.equal(
    authority.authority_profile_id,
    'MCFT-CAP-08.S3-SEMANTIC-COMPLETION-AUTHORITY-V1',
  );
  assert.equal(authority.semantic_digest, semanticDigest(authority));

  assert.deepEqual(authority.storage_contract, {
    table: 'twin_runtime_authority_snapshot_v1',
    authority_kind: 'REALITY_BINDING',
    authority_ref_namespace: 'cap08_s3_completion_tuple',
    semantic_profile_field: 'schema_version',
    semantic_profile_value: 'geox_mcft_cap08_s3_completion_tuple_v1',
    physical_constraint_compatible: true,
    database_migration_required: false,
    canonical_fact_write: false,
    projection_write: false,
    mutable_read_index_write: false,
    immutable_insert_only: true,
    conflicting_duplicate_effect: 'FAIL_CLOSED',
  });
  assert.equal(authority.completion_pair.generic_authority_kind, 'REALITY_BINDING');
  assert.equal(authority.completion_pair.semantic_authority_kind, 'REALITY_BINDING');
  assert.equal(
    authority.completion_pair.semantic_authority_profile_id,
    'MCFT-CAP-08.S3-SEMANTIC-COMPLETION-AUTHORITY-V1',
  );
  assert.equal(authority.completion_pair.authority_ref_collision_forbidden, true);
  assert.equal(authority.completion_pair.commit_requirement, 'ONE_DATABASE_TRANSACTION');
  assert.equal(authority.completion_pair.partial_pair_effect, 'FAIL_CLOSED_ZERO_WRITE');
  assert.equal(authority.completion_pair.normal_runner_repair_authorized, false);

  assert.equal(authority.stored_semantic_payload.tick_binding_count, 24);
  assert.equal(authority.stored_semantic_payload.tick_trace_digest_count, 24);
  assert.equal(authority.rebuild_contract.projection_only_truth_forbidden, true);
  assert.equal(authority.rebuild_contract.hard_coded_qualification_truth_forbidden, true);
  assert.deepEqual(authority.normal_already_complete_contract, {
    generic_authority_exact: true,
    semantic_authority_exact: true,
    stored_equals_rebuilt: true,
    write_delta: 0,
    lease_delta: 0,
    authority_snapshot_delta: 0,
    failure_effect: 'FAIL_CLOSED',
  });
  assert.deepEqual(
    authority.corruption_matrix.map((item) => item.case_id),
    ['S3-CR01', 'S3-CR02', 'S3-CR03', 'S3-CR04', 'S3-CR05', 'S3-CR06', 'S3-CR07', 'S3-CR08'],
  );
  assert.equal(authority.nonclaims.includes('NO_DATABASE_MIGRATION'), true);
  assert.equal(authority.nonclaims.includes('NO_BUSINESS_SCHEMA_CHANGE'), true);

  assert.equal(status.record_status, 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED');
  assert.equal(status.s3_candidate_implemented, false);
  assert.equal(status.implementation_authorized, false);
  assert.equal(
    status.semantic_completion_authority_ref,
    'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S3-SEMANTIC-COMPLETION-AUTHORITY-V1.json',
  );
  assert.equal(status.semantic_completion_authority_storage, 'twin_runtime_authority_snapshot_v1');
  assert.equal(status.semantic_completion_authority_kind, 'REALITY_BINDING');
  assert.equal(
    status.semantic_completion_authority_profile_id,
    'MCFT-CAP-08.S3-SEMANTIC-COMPLETION-AUTHORITY-V1',
  );
  assert.equal(status.semantic_completion_authority_ref_namespace, 'cap08_s3_completion_tuple');
  assert.equal(status.semantic_completion_authority_schema_migration_required, false);
  assert.equal(status.canonical_completion_tuple_fact_authorized, false);
  assert.equal(status.normal_completed_rerun_repair_authorized, false);
  assert.equal(status.database_migration_delta, 0);
  assert.equal(status.business_schema_delta, 0);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);

  assert.equal(
    workflowDeclaration.hardening_workflow.name,
    'mcft-cap-08-s3-preflight-hardening',
  );
  assert.equal(workflowDeclaration.hardening_workflow.candidate_declaration_expected, false);
  assert.equal(workflowDeclaration.hardening_workflow.runtime_source_delta, 0);
  assert.equal(workflowDeclaration.candidate_workflow.runs_exact_completed_rerun, true);
  assert.equal(
    workflowDeclaration.candidate_workflow.runs_completed_rerun_corruption_matrix,
    true,
  );
  assert.equal(workflowDeclaration.candidate_workflow.uses_atomic_completion_authority_pair, true);
  assert.equal(workflowDeclaration.candidate_workflow.canonical_completion_tuple_fact, false);
  assert.equal(
    workflowDeclaration.candidate_workflow.one_shot_preflight_required_before_declaration,
    true,
  );
  assert.equal(
    workflowDeclaration.candidate_integrity_workflows.shared_visible_workflow_identity,
    false,
  );

  assert.match(enforcementWorkflow, /^name: mcft-candidate-declaration-integrity-v2$/m);
  assert.equal(hasOnEvent(enforcementWorkflow, 'pull_request_target'), true);
  assert.equal(hasOnEvent(enforcementWorkflow, 'merge_group'), true);
  assert.equal(hasOnEvent(enforcementWorkflow, 'pull_request'), false);
  assert.match(enforcementWorkflow, /^  mcft-candidate-integrity-enforce-current-pr:$/m);
  assert.doesNotMatch(enforcementWorkflow, /^  mcft-candidate-integrity-pr-selftest:$/m);

  assert.match(selftestWorkflow, /^name: mcft-candidate-declaration-selftest-v2$/m);
  assert.equal(hasOnEvent(selftestWorkflow, 'pull_request'), true);
  assert.equal(hasOnEvent(selftestWorkflow, 'pull_request_target'), false);
  assert.match(selftestWorkflow, /^  mcft-candidate-integrity-pr-selftest:$/m);
  assert.doesNotMatch(selftestWorkflow, /^  mcft-candidate-integrity-enforce-current-pr:$/m);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_preflight_hardening_result_v1',
    status: 'PASS',
    semantic_completion_authority_digest: authority.semantic_digest,
    storage_table: authority.storage_contract.table,
    storage_authority_kind: authority.storage_contract.authority_kind,
    semantic_authority_profile_id: authority.authority_profile_id,
    physical_constraint_compatible: true,
    database_migration_required: false,
    canonical_completion_tuple_fact_authorized: false,
    atomic_completion_authority_pair_required: true,
    normal_completed_rerun_write_delta: 0,
    corruption_case_count: authority.corruption_matrix.length,
    candidate_signal_present: false,
    candidate_integrity_enforcement_workflow: 'mcft-candidate-declaration-integrity-v2',
    candidate_integrity_selftest_workflow: 'mcft-candidate-declaration-selftest-v2',
    shared_visible_workflow_identity: false,
    runtime_source_delta: 0,
    s3_effective: false,
    s4_authorized: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap08_s3_preflight_hardening_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
