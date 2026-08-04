#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_S0_AUTHORIZATION_RESULT.json');
const BASE = 'dce309c7ea1045fc7a35e973fed09e1a0ab5f39c';

const WORKFLOW = '.github/workflows/mcft-cap-09-s0-authorization.yml';
const CURRENT = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-BOUNDARY-V1.json';
const RECORD = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-AUTHORIZATION-CANDIDATE-V1.json';
const STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S0_AUTHORIZATION.cjs';
const TASKBOOK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const SCOPE = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json';
const PREDECESSOR = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PREDECESSOR-LOCK-V1.json';
const REGISTRY = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';

const EXPECTED_FILES = [WORKFLOW, CURRENT, BOUNDARY, RECORD, STATUS, VALIDATOR].sort();
const FROZEN_BLOBS = {
  [TASKBOOK]: 'fc0a1fd6de55b5ca8a5b94b552553270de5c6938',
  [SCOPE]: '82320c234c663af95aaec76df213d14b3aef048e',
  [PREDECESSOR]: '07612cc0fc4ebb3615bcb961fd4219505cc8349e',
  [REGISTRY]: 'e066ad7e6ec57f8dae9d0c2a41a492434deec4e0',
};

const EXPECTED_REGISTERED_STATUS_PATHS = [CURRENT, STATUS].sort();
const EXPECTED_DEFERRED_STATUS_PATHS = [
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S4-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S5-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-DELIVERY-STATUS-V1.json',
].sort();

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readText(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function readJson(file) {
  return JSON.parse(readText(file));
}
function requireCondition(value, code) {
  if (!value) throw new Error(code);
}
function equal(actual, expected, code) {
  try {
    assert.deepEqual(actual, expected);
  } catch {
    throw new Error(`${code}:${JSON.stringify(actual)}`);
  }
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
async function githubApi(apiPath) {
  const token = process.env.GITHUB_TOKEN;
  requireCondition(token, 'GITHUB_TOKEN_REQUIRED');
  requireCondition(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-cap09-s0-authorization-v1',
    },
  });
  const body = await response.text();
  requireCondition(response.ok, `GITHUB_API_${response.status}:${apiPath}:${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
}
function parseDeclaration(body) {
  const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...String(body || '').matchAll(new RegExp(`<!--\\s*${escaped}\\s*\\n([\\s\\S]*?)-->`, 'gm'))];
  requireCondition(matches.length === 1, `DECLARATION_CARDINALITY:${matches.length}`);
  const declaration = {};
  for (const rawLine of matches[0][1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    requireCondition(separator > 0, `DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    requireCondition(!Object.hasOwn(declaration, key), `DECLARATION_DUPLICATE:${key}`);
    declaration[key] = value;
  }
  return declaration;
}

function validateStatic() {
  const base = process.env.MCFT_BASE_SHA;
  const eventName = process.env.MCFT_EVENT_NAME || 'unknown';
  const head = git('rev-parse', 'HEAD');
  requireCondition(base === BASE, `BASE_SHA_MISMATCH:${base}`);

  const changedFiles = git('diff', '--name-only', `${base}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  equal(changedFiles, EXPECTED_FILES, 'CHANGED_FILES_MISMATCH');

  for (const file of changedFiles) {
    requireCondition(!/^(apps|packages|migrations)\//.test(file), `RUNTIME_PATH_FORBIDDEN:${file}`);
    requireCondition(!readText(file).includes('MCFT_CANDIDATE_DECLARATION_V2'), `DECLARATION_IN_REPOSITORY:${file}`);
  }
  if (eventName === 'pull_request') {
    requireCondition(Number(git('rev-list', '--count', `${base}..HEAD`)) === 1, 'CANDIDATE_COMMIT_COUNT_NOT_ONE');
  }

  for (const [file, expectedBlob] of Object.entries(FROZEN_BLOBS)) {
    requireCondition(git('rev-parse', `HEAD:${file}`) === expectedBlob, `FROZEN_BLOB_MISMATCH:${file}`);
  }

  const current = readJson(CURRENT);
  const delivery = readJson(STATUS);
  const record = readJson(RECORD);
  const boundary = readJson(BOUNDARY);
  const registry = readJson(REGISTRY);

  requireCondition(current.record_status === 'S0_AUTHORIZATION_CANDIDATE', 'CURRENT_RECORD_STATUS_INVALID');
  requireCondition(current.status === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'CURRENT_STATUS_INVALID');
  requireCondition(current.candidate_base_main_sha === BASE, 'CURRENT_BASE_INVALID');
  requireCondition(current.trusted_registry_effective_merge_sha === 'd229cbff7d6d974a2dfdbebd4cc93ec1670a052d', 'CURRENT_REGISTRY_MERGE_INVALID');
  requireCondition(current.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'CURRENT_BINDING_MODE_INVALID');
  requireCondition(current.candidate_head_embedded === false && !Object.hasOwn(current, 'candidate_head_sha'), 'CURRENT_SELF_REFERENCE_FORBIDDEN');
  requireCondition(current.effectiveness_condition === 'PRESENT_ON_PROTECTED_MAIN_AND_EXACT_SHA_R2_ATTESTATION_PASS', 'CURRENT_EFFECTIVENESS_CONDITION_INVALID');
  requireCondition(current.effective_status_when_attested === 'IN_PROGRESS', 'CURRENT_EFFECTIVE_STATUS_INVALID');
  requireCondition(current.effective_next_slice_when_attested === 'S1', 'CURRENT_NEXT_SLICE_INVALID');
  requireCondition(current.s1_candidate_declaration_authorized_when_attested === true, 'S1_DECLARATION_GATE_INVALID');
  requireCondition(current.s1_authorized_scope_when_attested === 'ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY', 'S1_SCOPE_INVALID');

  for (const key of [
    'implementation_authorized',
    'runtime_source_authorized',
    'live_ingestion_authorized',
    'background_scheduler_authorized',
    'canonical_write_authorized',
    'public_http_writer_authorized',
    'candidate_declaration_authorized',
    'model_activation_authorized',
    'controlled_action_authorized',
  ]) requireCondition(current[key] === false, `CURRENT_AUTHORITY_MUST_REMAIN_FALSE:${key}`);

  for (const key of [
    'runtime_source_authorized_when_attested',
    'live_ingestion_authorized_when_attested',
    'background_scheduler_authorized_when_attested',
    'canonical_write_authorized_when_attested',
    'public_http_writer_authorized_when_attested',
    'model_activation_authorized_when_attested',
    'controlled_action_authorized_when_attested',
  ]) requireCondition(current[key] === false, `EFFECTIVE_AUTHORITY_MUST_REMAIN_FALSE:${key}`);

  requireCondition(delivery.record_status === 'S0_AUTHORIZATION_CANDIDATE', 'DELIVERY_RECORD_STATUS_INVALID');
  requireCondition(delivery.status === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'DELIVERY_STATUS_INVALID');
  requireCondition(delivery.s0_candidate_implemented === true, 'S0_CANDIDATE_SIGNAL_MISSING');
  requireCondition(delivery.candidate_declaration_present === true, 'DECLARATION_SIGNAL_MISSING');
  requireCondition(delivery.externally_effective === false, 'PREMERGE_EFFECTIVENESS_FORBIDDEN');
  requireCondition(delivery.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'DELIVERY_BINDING_MODE_INVALID');
  requireCondition(delivery.candidate_head_embedded === false && !Object.hasOwn(delivery, 'candidate_head_sha'), 'DELIVERY_SELF_REFERENCE_FORBIDDEN');
  for (const key of [
    'runtime_source_delta',
    'migration_delta',
    'canonical_runtime_data_delta',
    'database_acl_delta',
    'registry_delta',
    'taskbook_delta',
    'navigation_ssot_delta',
  ]) requireCondition(delivery[key] === 0, `DELIVERY_DELTA_NONZERO:${key}`);

  requireCondition(record.record_status === 'S0_AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'CANDIDATE_RECORD_STATUS_INVALID');
  requireCondition(record.base_main_sha === BASE, 'CANDIDATE_RECORD_BASE_INVALID');
  requireCondition(record.candidate_transition_performed === true, 'CANDIDATE_TRANSITION_SIGNAL_MISSING');
  requireCondition(record.external_effectiveness === false, 'CANDIDATE_EXTERNAL_EFFECTIVENESS_FORBIDDEN');
  requireCondition(record.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'RECORD_BINDING_MODE_INVALID');
  requireCondition(record.candidate_head_embedded === false && !Object.hasOwn(record, 'candidate_head_sha'), 'RECORD_SELF_REFERENCE_FORBIDDEN');
  requireCondition(record.trusted_registry_merge_sha === 'd229cbff7d6d974a2dfdbebd4cc93ec1670a052d', 'RECORD_REGISTRY_MERGE_INVALID');
  requireCondition(record.complete_registry_successor_lifecycle_merge_sha === 'd5e31c20c356816294b6a902b27ed8dcbe79c42d', 'SUCCESSOR_LIFECYCLE_MERGE_INVALID');
  requireCondition(record.complete_trigger_control_plane_merge_sha === '3968031dbffbcf547c46e1cb038b97974bd7a937', 'TRIGGER_CONTROL_PLANE_MERGE_INVALID');
  requireCondition(record.existing_status_paths_correction_merge_sha === 'd229cbff7d6d974a2dfdbebd4cc93ec1670a052d', 'STATUS_PATH_CORRECTION_MERGE_INVALID');
  requireCondition(record.taskbook_blob_sha === FROZEN_BLOBS[TASKBOOK], 'TASKBOOK_BLOB_INVALID');
  requireCondition(record.scope_contract_blob_sha === FROZEN_BLOBS[SCOPE], 'SCOPE_BLOB_INVALID');
  requireCondition(record.predecessor_lock_blob_sha === FROZEN_BLOBS[PREDECESSOR], 'PREDECESSOR_BLOB_INVALID');
  requireCondition(record.trusted_registry_blob_sha === FROZEN_BLOBS[REGISTRY], 'REGISTRY_BLOB_INVALID');
  for (const key of [
    'runtime_source_delta',
    'migration_delta',
    'registry_delta',
    'taskbook_delta',
    'canonical_runtime_data_delta',
    'database_acl_delta',
    'navigation_ssot_delta',
  ]) requireCondition(record[key] === 0, `RECORD_DELTA_NONZERO:${key}`);

  requireCondition(boundary.base_main_sha === BASE, 'BOUNDARY_BASE_INVALID');
  requireCondition(boundary.changed_file_count === 6, 'BOUNDARY_FILE_COUNT_INVALID');
  equal(boundary.changed_files, EXPECTED_FILES, 'BOUNDARY_FILES_INVALID');
  requireCondition(boundary.candidate_transition === true, 'BOUNDARY_CANDIDATE_TRANSITION_INVALID');
  requireCondition(boundary.external_effectiveness === false, 'BOUNDARY_EXTERNAL_EFFECTIVENESS_FORBIDDEN');
  requireCondition(boundary.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'BOUNDARY_BINDING_MODE_INVALID');
  requireCondition(boundary.candidate_head_embedded === false && !Object.hasOwn(boundary, 'candidate_head_sha'), 'BOUNDARY_SELF_REFERENCE_FORBIDDEN');

  const entries = registry.capabilities.filter((value) => value.capability_line === 'MCFT-CAP-09');
  requireCondition(entries.length === 1, `REGISTRY_ENTRY_CARDINALITY:${entries.length}`);
  const entry = entries[0];
  requireCondition(entry.candidate_declaration_enabled === true && entry.current_candidate_authority === false, 'REGISTRY_GATE_INVALID');
  equal([...entry.authoritative_candidate_status_paths].sort(), EXPECTED_REGISTERED_STATUS_PATHS, 'REGISTRY_REGISTERED_PATHS_INVALID');
  equal([...entry.deferred_status_paths].sort(), EXPECTED_DEFERRED_STATUS_PATHS, 'REGISTRY_DEFERRED_PATHS_INVALID');
  requireCondition(entry.registration_mode === 'APPEND_STATUS_PATH_WHEN_FILE_EXISTS_ON_PROTECTED_MAIN', 'REGISTRY_APPEND_MODE_INVALID');
  requireCondition(entry.deferred_transition_registration_required === true, 'REGISTRY_DEFERRED_TRANSITION_GATE_INVALID');
  requireCondition(entry.candidate_transition_fields.length === 1, 'REGISTRY_TRANSITION_CARDINALITY_INVALID');
  const transition = entry.candidate_transition_fields[0];
  requireCondition(transition.status_file === CURRENT, 'REGISTRY_TRANSITION_STATUS_PATH_INVALID');
  requireCondition(transition.field_path === 'status', 'REGISTRY_TRANSITION_FIELD_INVALID');
  equal(transition.allowed_candidate_values, ['AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'], 'REGISTRY_TRANSITION_VALUE_INVALID');
  requireCondition(transition.focused_workflow === 'mcft-cap-09-s0-authorization', 'REGISTRY_FOCUSED_WORKFLOW_INVALID');
  requireCondition(transition.standard_workflow === 'ci', 'REGISTRY_STANDARD_WORKFLOW_INVALID');
  requireCondition(transition.predecessor_effective_evidence_required === true, 'REGISTRY_PREDECESSOR_GATE_INVALID');

  return { head, base, eventName, changedFiles };
}

async function validateDeclaration(context) {
  if (context.eventName !== 'pull_request') {
    return { mode: 'DELEGATED_TO_CANDIDATE_INTEGRITY_FOR_MERGE_GROUP' };
  }

  const prNumber = Number(process.env.MCFT_PR_NUMBER);
  requireCondition(Number.isInteger(prNumber) && prNumber > 0, 'PR_NUMBER_INVALID');
  const pullRequest = await githubApi(`/pulls/${prNumber}`);
  requireCondition(pullRequest.head.sha === context.head, 'PR_HEAD_SHA_MISMATCH');
  requireCondition(pullRequest.base.sha === context.base, 'PR_BASE_SHA_MISMATCH');

  const declaration = parseDeclaration(pullRequest.body);
  const requiredKeys = [
    'capability_line',
    'slice_id',
    'status_file',
    'candidate_field',
    'candidate_value',
    'focused_workflow',
    'standard_workflow',
    'semantic_snapshot_files',
    'semantic_snapshot_blobs',
    'candidate_head',
    'base_head',
  ].sort();
  equal(Object.keys(declaration).sort(), requiredKeys, 'DECLARATION_KEYS_INVALID');

  requireCondition(declaration.capability_line === 'MCFT-CAP-09', 'DECLARATION_CAPABILITY_INVALID');
  requireCondition(declaration.slice_id === 'MCFT-CAP-09.S0', 'DECLARATION_SLICE_INVALID');
  requireCondition(declaration.status_file === CURRENT, 'DECLARATION_STATUS_FILE_INVALID');
  requireCondition(declaration.candidate_field === 'status', 'DECLARATION_FIELD_INVALID');
  requireCondition(declaration.candidate_value === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'DECLARATION_VALUE_INVALID');
  requireCondition(declaration.focused_workflow === 'mcft-cap-09-s0-authorization', 'DECLARATION_FOCUSED_WORKFLOW_INVALID');
  requireCondition(declaration.standard_workflow === 'ci', 'DECLARATION_STANDARD_WORKFLOW_INVALID');
  requireCondition(declaration.candidate_head === context.head, 'DECLARATION_HEAD_INVALID');
  requireCondition(declaration.base_head === context.base, 'DECLARATION_BASE_INVALID');

  const files = declaration.semantic_snapshot_files.split(',').map((value) => value.trim()).filter(Boolean);
  const blobs = declaration.semantic_snapshot_blobs.split(',').map((value) => value.trim()).filter(Boolean);
  equal(files, EXPECTED_FILES, 'DECLARATION_FILES_INVALID');
  requireCondition(blobs.length === files.length, 'DECLARATION_BLOB_COUNT_INVALID');
  const actualBlobs = files.map((file) => git('rev-parse', `HEAD:${file}`));
  equal(blobs, actualBlobs, 'DECLARATION_BLOBS_INVALID');

  return {
    mode: 'PR_BODY_VALIDATED',
    pr_number: prNumber,
    semantic_snapshot_count: files.length,
    semantic_snapshot_blobs: actualBlobs,
  };
}

(async () => {
  let context = null;
  try {
    context = validateStatic();
    const declaration = await validateDeclaration(context);
    const result = {
      status: 'PASS',
      change_class: 'MCFT_CAP_09_S0_AUTHORIZATION_CANDIDATE',
      base_sha: context.base,
      candidate_head_sha: context.head,
      changed_files: context.changedFiles,
      candidate_head_binding_mode: 'PR_DECLARATION_V2_AND_GITHUB_EVENT',
      candidate_head_embedded_in_candidate_blob: false,
      declaration,
      registry_rule_trusted_from_base: true,
      candidate_transition: true,
      external_effectiveness: false,
      implementation_authorized: false,
      runtime_source_delta: 0,
      canonical_runtime_data_delta: 0,
      database_acl_delta: 0,
      first_legal_next_action: 'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION',
    };
    writeResult(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const result = {
      status: 'FAIL',
      base_sha: context?.base || process.env.MCFT_BASE_SHA || null,
      candidate_head_sha: context?.head || null,
      error: String(error?.message || error),
    };
    writeResult(result);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  }
})();
