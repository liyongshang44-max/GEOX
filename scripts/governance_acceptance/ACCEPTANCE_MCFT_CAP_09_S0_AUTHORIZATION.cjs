#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_S0_AUTHORIZATION_RESULT.json');
const BASE = 'f07a7d0da50189c0ce2567b71d71f5d662771235';
const DECLARATION_MARKER = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');

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
const EXPECTED_DEFERRED_STATUS_PATHS = [1, 2, 3, 4, 5, 6]
  .map((slice) => `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S${slice}-DELIVERY-STATUS-V1.json`)
  .sort();

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readText(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function readJson(file) {
  return JSON.parse(readText(file));
}
function must(value, code) {
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
  must(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN_REQUIRED');
  must(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-cap09-s0-authorization-v1',
    },
  });
  const body = await response.text();
  must(response.ok, `GITHUB_API_${response.status}:${apiPath}:${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
}
function parseDeclaration(body) {
  const open = `<!-- ${DECLARATION_MARKER}\n`;
  const text = String(body || '');
  const start = text.indexOf(open);
  must(start >= 0, 'DECLARATION_CARDINALITY:0');
  must(text.indexOf(open, start + open.length) < 0, 'DECLARATION_CARDINALITY:2');
  const end = text.indexOf('-->', start + open.length);
  must(end >= 0, 'DECLARATION_TERMINATOR_MISSING');
  const declaration = {};
  for (const rawLine of text.slice(start + open.length, end).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    must(separator > 0, `DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    must(!Object.hasOwn(declaration, key), `DECLARATION_DUPLICATE:${key}`);
    declaration[key] = value;
  }
  return declaration;
}
function assertFalse(record, keys, prefix) {
  for (const key of keys) must(record[key] === false, `${prefix}:${key}`);
}
function assertZero(record, keys, prefix) {
  for (const key of keys) must(record[key] === 0, `${prefix}:${key}`);
}

function validateStatic() {
  const base = process.env.MCFT_BASE_SHA;
  const eventName = process.env.MCFT_EVENT_NAME || 'unknown';
  const head = git('rev-parse', 'HEAD');
  must(base === BASE, `BASE_SHA_MISMATCH:${base}`);

  const changedFiles = git('diff', '--name-only', `${base}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  equal(changedFiles, EXPECTED_FILES, 'CHANGED_FILES_MISMATCH');
  for (const file of changedFiles) {
    must(!/^(apps|packages|migrations)\//.test(file), `RUNTIME_PATH_FORBIDDEN:${file}`);
    must(!readText(file).includes(DECLARATION_MARKER), `DECLARATION_IN_REPOSITORY:${file}`);
  }
  if (eventName === 'pull_request') {
    must(Number(git('rev-list', '--count', `${base}..HEAD`)) === 1, 'CANDIDATE_COMMIT_COUNT_NOT_ONE');
  }
  for (const [file, expectedBlob] of Object.entries(FROZEN_BLOBS)) {
    must(git('rev-parse', `HEAD:${file}`) === expectedBlob, `FROZEN_BLOB_MISMATCH:${file}`);
  }

  const current = readJson(CURRENT);
  const boundary = readJson(BOUNDARY);
  const record = readJson(RECORD);
  const delivery = readJson(STATUS);
  const registry = readJson(REGISTRY);

  must(current.record_status === 'S0_AUTHORIZATION_CANDIDATE', 'CURRENT_RECORD_STATUS_INVALID');
  must(current.status === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'CURRENT_STATUS_INVALID');
  must(current.candidate_base_main_sha === BASE, 'CURRENT_BASE_INVALID');
  must(current.trusted_registry_effective_merge_sha === 'd229cbff7d6d974a2dfdbebd4cc93ec1670a052d', 'CURRENT_REGISTRY_MERGE_INVALID');
  must(current.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'CURRENT_BINDING_MODE_INVALID');
  must(current.candidate_head_embedded === false && !Object.hasOwn(current, 'candidate_head_sha'), 'CURRENT_SELF_REFERENCE_FORBIDDEN');
  must(current.effectiveness_condition === 'PRESENT_ON_PROTECTED_MAIN_AND_EXACT_SHA_R2_ATTESTATION_PASS', 'CURRENT_EFFECTIVENESS_CONDITION_INVALID');
  must(current.effective_status_when_attested === 'IN_PROGRESS', 'CURRENT_EFFECTIVE_STATUS_INVALID');
  must(current.effective_next_slice_when_attested === 'S1', 'CURRENT_NEXT_SLICE_INVALID');
  must(current.s1_candidate_declaration_authorized_when_attested === true, 'S1_DECLARATION_GATE_INVALID');
  must(current.s1_authorized_scope_when_attested === 'ADAPTER_CONTRACTS_AND_CONFIGURATION_FREEZE_ONLY', 'S1_SCOPE_INVALID');
  assertFalse(current, [
    'implementation_authorized',
    'runtime_source_authorized',
    'live_ingestion_authorized',
    'background_scheduler_authorized',
    'canonical_write_authorized',
    'public_http_writer_authorized',
    'candidate_declaration_authorized',
    'model_activation_authorized',
    'controlled_action_authorized',
    'runtime_source_authorized_when_attested',
    'live_ingestion_authorized_when_attested',
    'background_scheduler_authorized_when_attested',
    'canonical_write_authorized_when_attested',
    'public_http_writer_authorized_when_attested',
    'model_activation_authorized_when_attested',
    'controlled_action_authorized_when_attested',
  ], 'CURRENT_AUTHORITY_MUST_REMAIN_FALSE');

  must(delivery.record_status === 'S0_AUTHORIZATION_CANDIDATE', 'DELIVERY_RECORD_STATUS_INVALID');
  must(delivery.status === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'DELIVERY_STATUS_INVALID');
  must(delivery.s0_candidate_implemented === true, 'S0_CANDIDATE_SIGNAL_MISSING');
  must(delivery.candidate_declaration_present === true, 'DECLARATION_SIGNAL_MISSING');
  must(delivery.externally_effective === false, 'PREMERGE_EFFECTIVENESS_FORBIDDEN');
  must(delivery.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'DELIVERY_BINDING_MODE_INVALID');
  must(delivery.candidate_head_embedded === false && !Object.hasOwn(delivery, 'candidate_head_sha'), 'DELIVERY_SELF_REFERENCE_FORBIDDEN');
  assertZero(delivery, [
    'runtime_source_delta',
    'migration_delta',
    'canonical_runtime_data_delta',
    'database_acl_delta',
    'registry_delta',
    'taskbook_delta',
    'navigation_ssot_delta',
  ], 'DELIVERY_DELTA_NONZERO');

  must(record.record_status === 'S0_AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'CANDIDATE_RECORD_STATUS_INVALID');
  must(record.base_main_sha === BASE, 'CANDIDATE_RECORD_BASE_INVALID');
  must(record.candidate_transition_performed === true, 'CANDIDATE_TRANSITION_SIGNAL_MISSING');
  must(record.external_effectiveness === false, 'CANDIDATE_EXTERNAL_EFFECTIVENESS_FORBIDDEN');
  must(record.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'RECORD_BINDING_MODE_INVALID');
  must(record.candidate_head_embedded === false && !Object.hasOwn(record, 'candidate_head_sha'), 'RECORD_SELF_REFERENCE_FORBIDDEN');
  must(record.trusted_registry_merge_sha === 'd229cbff7d6d974a2dfdbebd4cc93ec1670a052d', 'RECORD_REGISTRY_MERGE_INVALID');
  must(record.complete_registry_successor_lifecycle_merge_sha === 'd5e31c20c356816294b6a902b27ed8dcbe79c42d', 'SUCCESSOR_LIFECYCLE_MERGE_INVALID');
  must(record.complete_trigger_control_plane_merge_sha === '3968031dbffbcf547c46e1cb038b97974bd7a937', 'TRIGGER_CONTROL_PLANE_MERGE_INVALID');
  must(record.existing_status_paths_correction_merge_sha === 'd229cbff7d6d974a2dfdbebd4cc93ec1670a052d', 'STATUS_PATH_CORRECTION_MERGE_INVALID');
  must(record.taskbook_blob_sha === FROZEN_BLOBS[TASKBOOK], 'TASKBOOK_BLOB_INVALID');
  must(record.scope_contract_blob_sha === FROZEN_BLOBS[SCOPE], 'SCOPE_BLOB_INVALID');
  must(record.predecessor_lock_blob_sha === FROZEN_BLOBS[PREDECESSOR], 'PREDECESSOR_BLOB_INVALID');
  must(record.trusted_registry_blob_sha === FROZEN_BLOBS[REGISTRY], 'REGISTRY_BLOB_INVALID');
  assertZero(record, [
    'runtime_source_delta',
    'migration_delta',
    'registry_delta',
    'taskbook_delta',
    'canonical_runtime_data_delta',
    'database_acl_delta',
    'navigation_ssot_delta',
  ], 'RECORD_DELTA_NONZERO');

  must(boundary.base_main_sha === BASE, 'BOUNDARY_BASE_INVALID');
  must(boundary.changed_file_count === 6, 'BOUNDARY_FILE_COUNT_INVALID');
  equal(boundary.changed_files, EXPECTED_FILES, 'BOUNDARY_FILES_INVALID');
  must(boundary.candidate_transition === true, 'BOUNDARY_CANDIDATE_TRANSITION_INVALID');
  must(boundary.external_effectiveness === false, 'BOUNDARY_EXTERNAL_EFFECTIVENESS_FORBIDDEN');
  must(boundary.candidate_head_binding_mode === 'PR_DECLARATION_V2_AND_GITHUB_EVENT', 'BOUNDARY_BINDING_MODE_INVALID');
  must(boundary.candidate_head_embedded === false && !Object.hasOwn(boundary, 'candidate_head_sha'), 'BOUNDARY_SELF_REFERENCE_FORBIDDEN');

  const entries = registry.capabilities.filter((value) => value.capability_line === 'MCFT-CAP-09');
  must(entries.length === 1, `REGISTRY_ENTRY_CARDINALITY:${entries.length}`);
  const entry = entries[0];
  must(entry.candidate_declaration_enabled === true && entry.current_candidate_authority === false, 'REGISTRY_GATE_INVALID');
  equal([...entry.authoritative_candidate_status_paths].sort(), EXPECTED_REGISTERED_STATUS_PATHS, 'REGISTRY_REGISTERED_PATHS_INVALID');
  equal([...entry.deferred_status_paths].sort(), EXPECTED_DEFERRED_STATUS_PATHS, 'REGISTRY_DEFERRED_PATHS_INVALID');
  must(entry.registration_mode === 'APPEND_STATUS_PATH_WHEN_FILE_EXISTS_ON_PROTECTED_MAIN', 'REGISTRY_APPEND_MODE_INVALID');
  must(entry.deferred_transition_registration_required === true, 'REGISTRY_DEFERRED_TRANSITION_GATE_INVALID');
  must(entry.candidate_transition_fields.length === 1, 'REGISTRY_TRANSITION_CARDINALITY_INVALID');
  const transition = entry.candidate_transition_fields[0];
  must(transition.status_file === CURRENT, 'REGISTRY_TRANSITION_STATUS_PATH_INVALID');
  must(transition.field_path === 'status', 'REGISTRY_TRANSITION_FIELD_INVALID');
  equal(transition.allowed_candidate_values, ['AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'], 'REGISTRY_TRANSITION_VALUE_INVALID');
  must(transition.focused_workflow === 'mcft-cap-09-s0-authorization', 'REGISTRY_FOCUSED_WORKFLOW_INVALID');
  must(transition.standard_workflow === 'ci', 'REGISTRY_STANDARD_WORKFLOW_INVALID');
  must(transition.predecessor_effective_evidence_required === true, 'REGISTRY_PREDECESSOR_GATE_INVALID');

  return { head, base, eventName, changedFiles };
}

async function validateDeclaration(context) {
  if (context.eventName !== 'pull_request') {
    return { mode: 'DELEGATED_TO_CANDIDATE_INTEGRITY_FOR_MERGE_GROUP' };
  }

  const prNumber = Number(process.env.MCFT_PR_NUMBER);
  must(Number.isInteger(prNumber) && prNumber > 0, 'PR_NUMBER_INVALID');
  const pullRequest = await githubApi(`/pulls/${prNumber}`);
  must(pullRequest.head.sha === context.head, 'PR_HEAD_SHA_MISMATCH');
  must(pullRequest.base.sha === context.base, 'PR_BASE_SHA_MISMATCH');

  const declaration = parseDeclaration(pullRequest.body);
  equal(Object.keys(declaration).sort(), [
    'base_head',
    'candidate_field',
    'candidate_head',
    'candidate_value',
    'capability_line',
    'focused_workflow',
    'semantic_snapshot_blobs',
    'semantic_snapshot_files',
    'slice_id',
    'standard_workflow',
    'status_file',
  ], 'DECLARATION_KEYS_INVALID');
  must(declaration.capability_line === 'MCFT-CAP-09', 'DECLARATION_CAPABILITY_INVALID');
  must(declaration.slice_id === 'MCFT-CAP-09.S0', 'DECLARATION_SLICE_INVALID');
  must(declaration.status_file === CURRENT, 'DECLARATION_STATUS_FILE_INVALID');
  must(declaration.candidate_field === 'status', 'DECLARATION_FIELD_INVALID');
  must(declaration.candidate_value === 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE', 'DECLARATION_VALUE_INVALID');
  must(declaration.focused_workflow === 'mcft-cap-09-s0-authorization', 'DECLARATION_FOCUSED_WORKFLOW_INVALID');
  must(declaration.standard_workflow === 'ci', 'DECLARATION_STANDARD_WORKFLOW_INVALID');
  must(declaration.candidate_head === context.head, 'DECLARATION_HEAD_INVALID');
  must(declaration.base_head === context.base, 'DECLARATION_BASE_INVALID');

  const files = declaration.semantic_snapshot_files.split(',').map((value) => value.trim()).filter(Boolean);
  const blobs = declaration.semantic_snapshot_blobs.split(',').map((value) => value.trim()).filter(Boolean);
  equal(files, EXPECTED_FILES, 'DECLARATION_FILES_INVALID');
  must(blobs.length === files.length, 'DECLARATION_BLOB_COUNT_INVALID');
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
