'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateRepoRelativeModulePathV1 } = require('./workflow_port_bundle_contract_v1.cjs');

const FORMAL_STATUS_V1 = 'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED';
const DEVELOPMENT_STATUS_V1 = 'DEVELOPMENT_REHEARSAL_DATABASE_EXECUTION_AUTHORIZED';
const FORMAL_MODE_V1 = 'FINAL_FORMAL';
const DEVELOPMENT_MODE_V1 = 'DEVELOPMENT_REHEARSAL';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function executionModeV1(authority) {
  if (authority?.record_status === FORMAL_STATUS_V1) return FORMAL_MODE_V1;
  if (authority?.record_status === DEVELOPMENT_STATUS_V1) return DEVELOPMENT_MODE_V1;
  throw new Error('EXECUTION_AUTHORITY_RECORD_STATUS');
}

function validateCommonV1(authority, input) {
  assert.ok(authority && typeof authority === 'object' && !Array.isArray(authority), 'EXECUTION_AUTHORITY_OBJECT_REQUIRED');
  assert.match(input.exactSubjectSha, /^[0-9a-f]{40}$/, 'EXECUTION_AUTHORITY_SUBJECT_FORMAT');
  assert.ok(['RUN_A', 'RUN_B'].includes(input.runLabel), 'RUN_LABEL');
  assert.match(input.operationalRunInstanceId, /^[A-Za-z0-9._:-]{8,128}$/, 'EXECUTION_AUTHORITY_INSTANCE_FORMAT');
  assert.equal(authority.exact_subject_sha, input.exactSubjectSha, 'EXECUTION_AUTHORITY_SUBJECT');
  assert.equal(authority.authorized_run_label, input.runLabel, 'EXECUTION_AUTHORITY_RUN_LABEL');
  assert.equal(authority.operational_run_instance_id, input.operationalRunInstanceId, 'EXECUTION_AUTHORITY_INSTANCE');
  assert.equal(authority.single_run_database_execution_authorized, true, 'SINGLE_RUN_DATABASE_EXECUTION_REQUIRED');
  assert.equal(authority.database_execution_workflow_authorized, true, 'DATABASE_EXECUTION_WORKFLOW_REQUIRED');
  assert.equal(authority.dual_run_ci_authorized, false, 'DUAL_RUN_FORMAL_AUTHORITY_FORBIDDEN');
  assert.equal(authority.cross_run_comparator_authorized, false, 'FORMAL_COMPARATOR_AUTHORITY_FORBIDDEN');
  assert.equal(authority.final_ledger_settlement_authorized, false, 'FORMAL_LEDGER_AUTHORITY_FORBIDDEN');
  assert.equal(authority.logical_database_identity?.identity_frozen, true, 'LOGICAL_DATABASE_IDENTITY_NOT_FROZEN');
  assert.equal(authority.logical_database_identity?.reusable, false, 'LOGICAL_DATABASE_IDENTITY_REUSABLE');
  const modulePath = validateRepoRelativeModulePathV1(authority.port_bundle_path);
  assert.match(authority.port_bundle_blob_sha, /^[0-9a-f]{40}$/, 'PORT_BUNDLE_BLOB_SHA');
  assert.match(authority.workflow_blob_sha, /^[0-9a-f]{40}$/, 'WORKFLOW_BLOB_SHA');
  assert.match(authority.expires_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'AUTHORITY_EXPIRY');
  assert.ok(Date.parse(authority.expires_at) > Date.now(), 'EXECUTION_AUTHORITY_EXPIRED');
  return modulePath;
}

function validateExactPathAuthorityV1(authority, input, expectedMode = null) {
  const modulePath = validateCommonV1(authority, input);
  const executionMode = executionModeV1(authority);
  if (expectedMode !== null) assert.equal(executionMode, expectedMode, 'EXECUTION_AUTHORITY_MODE');

  if (executionMode === FORMAL_MODE_V1) {
    assert.equal(authority.authority_class, 'FINAL_FORMAL_RUN_ONLY');
    assert.equal(authority.evidence_class, 'FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS');
    assert.equal(authority.workflow_dispatch_execution_authorized, true, 'FORMAL_WORKFLOW_DISPATCH_REQUIRED');
    assert.equal(authority.final_formal_run_execution_authorized, true);
    assert.equal(authority.hard_acceptance_eligible, true);
  } else {
    assert.equal(authority.authority_class, 'DEVELOPMENT_REHEARSAL');
    assert.equal(authority.workflow_dispatch_execution_authorized, false, 'FORMAL_WORKFLOW_DISPATCH_FORBIDDEN');
    assert.equal(authority.development_rehearsal_workflow_authorized, true);
    assert.equal(authority.development_double_run_authorized, true);
    assert.equal(authority.development_semantic_comparator_authorized, true);
    assert.equal(authority.evidence_class, 'NON_FORMAL');
    assert.ok(['RUN_DEV_A', 'RUN_DEV_B'].includes(authority.rehearsal_run_label), 'DEVELOPMENT_REHEARSAL_LABEL');
    assert.equal(authority.final_formal_run_execution_authorized, false, 'DEVELOPMENT_FORMAL_RUN_AUTHORITY_FORBIDDEN');
    assert.equal(authority.hard_acceptance_eligible, false, 'DEVELOPMENT_HARD_ACCEPTANCE_FORBIDDEN');
    assert.equal(authority.s6_candidate_evidence_eligible, false, 'DEVELOPMENT_S6_CANDIDATE_FORBIDDEN');
    assert.equal(authority.cross_run_comparison_eligible, false, 'DEVELOPMENT_FORMAL_COMPARATOR_ELIGIBILITY_FORBIDDEN');
    assert.equal(authority.ledger_settlement_eligible, false, 'DEVELOPMENT_LEDGER_ELIGIBILITY_FORBIDDEN');
  }

  return {
    authority,
    module_path: modulePath,
    authority_digest: digest(authority),
    execution_mode: executionMode,
    evidence_class: authority.evidence_class,
  };
}

function validateExecutionAuthorityV1(authority, input) {
  return validateExactPathAuthorityV1(authority, input, FORMAL_MODE_V1);
}

function validateDevelopmentRehearsalAuthorityV1(authority, input) {
  return validateExactPathAuthorityV1(authority, input, DEVELOPMENT_MODE_V1);
}

function gateFromEnvironmentV1({ root = path.resolve(__dirname, '../../..'), writeOutput = true } = {}) {
  const authorityPath = String(process.env.MCFT_CAP08_EXECUTION_AUTHORITY_PATH || '').trim();
  const exactSubjectSha = String(process.env.MCFT_CAP08_EXACT_SUBJECT_SHA || '').trim();
  const runLabel = String(process.env.MCFT_CAP08_RUN_LABEL || '').trim();
  const operationalRunInstanceId = String(process.env.MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID || '').trim();
  assert.match(authorityPath, /^docs\/digital_twin\/mcft\/cap_08\/[A-Za-z0-9_.-]+\.json$/, 'EXECUTION_AUTHORITY_PATH');
  const absolute = path.join(root, authorityPath);
  const authority = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  const result = validateExecutionAuthorityV1(authority, { exactSubjectSha, runLabel, operationalRunInstanceId });
  const normalizedPath = path.join(root, 'acceptance-output/MCFT_CAP_08_S6_NORMALIZED_EXECUTION_AUTHORITY.json');
  fs.mkdirSync(path.dirname(normalizedPath), { recursive: true });
  fs.writeFileSync(normalizedPath, `${JSON.stringify(result.authority, null, 2)}\n`);
  if (writeOutput && process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, [
      'authorized=true',
      `exact_subject_sha=${exactSubjectSha}`,
      `run_label=${runLabel}`,
      `operational_run_instance_id=${operationalRunInstanceId}`,
      `authority_path=${authorityPath}`,
      `authority_digest=${result.authority_digest}`,
      `port_bundle_path=${result.module_path}`,
      `port_bundle_blob_sha=${authority.port_bundle_blob_sha}`,
      `workflow_blob_sha=${authority.workflow_blob_sha}`,
    ].join('\n') + '\n');
  }
  return { ...result, normalized_path: normalizedPath };
}

if (require.main === module) {
  try {
    const result = gateFromEnvironmentV1();
    console.log(JSON.stringify({
      status: 'AUTHORIZED',
      authority_digest: result.authority_digest,
      module_path: result.module_path,
    }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  FORMAL_STATUS_V1,
  DEVELOPMENT_STATUS_V1,
  FORMAL_MODE_V1,
  DEVELOPMENT_MODE_V1,
  canonical,
  digest,
  executionModeV1,
  validateExactPathAuthorityV1,
  validateExecutionAuthorityV1,
  validateDevelopmentRehearsalAuthorityV1,
  gateFromEnvironmentV1,
};
