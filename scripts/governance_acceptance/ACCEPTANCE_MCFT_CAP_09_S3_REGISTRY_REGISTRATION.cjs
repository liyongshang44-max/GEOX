#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BASE = '94db796094e9d211cc8356ed18b227e08edd0ca3';
const BASE_REGISTRY_BLOB = 'd368a0d5a3b6189dd84ecb75a6643719cd37844e';
const TARGET_REGISTRY_BLOB = 'c9971967ba829d57fd78adc74f63513ded95981f';
const S2_SUBJECT = '126257e1a08d116089f5f28bd733e6abfd92f290';
const S2_RUN = 31041512709;
const S2_ARTIFACT = 8944755739;
const S2_DIGEST = 'sha256:fd122f4169e72d71211c80d1ced60e32bacbf3a305d46ca419f043a671d7f266';
const REGISTRY = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-DELIVERY-STATUS-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-BOUNDARY-V1.json';
const RECORD = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S3-REGISTRY-REGISTRATION-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-09-s3-registry-registration.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_S3_REGISTRY_REGISTRATION.cjs';
const FILES = [WORKFLOW, REGISTRY, STATUS, BOUNDARY, RECORD, VALIDATOR].sort();
const OUTPUT = 'acceptance-output/MCFT_CAP_09_S3_REGISTRY_REGISTRATION_RESULT.json';
const FROZEN = [
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-STAGE-1B-SCOPE-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S0-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S1-DELIVERY-STATUS-V1.json',
  'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S2-DELIVERY-STATUS-V1.json',
  'apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts',
];

const git = (...args) => cp.execFileSync('git', args, { encoding: 'utf8' }).trim();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const must = (value, code) => { if (!value) throw new Error(code); };
const same = (left, right, code) => {
  try { assert.deepEqual(left, right); } catch { throw new Error(code); }
};
const write = (value) => {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(value, null, 2) + '\n');
};
function artifact(name) {
  const root = path.resolve(process.env.MCFT_CAP09_S2_EFFECTIVE_ARTIFACT_DIR || 'acceptance-input/cap09-s2-effective');
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    if (!directory || !fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === name) return full;
    }
  }
  throw new Error(`ARTIFACT_MISSING:${name}`);
}
function falseAuthorities(value, prefix) {
  for (const key of [
    'implementation_authorized', 'runtime_source_authorized', 'live_ingestion_authorized',
    'background_scheduler_authorized', 'canonical_write_authorized', 'public_http_writer_authorized',
    'model_activation_authorized', 'controlled_action_authorized',
  ]) must(value[key] === false, `${prefix}:${key}`);
}
async function pullRequest(number) {
  must(process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY, 'GITHUB_ENV_REQUIRED');
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/pulls/${number}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'geox-cap09-s3-registry-registration',
    },
  });
  const body = await response.text();
  must(response.ok, `GITHUB_API_${response.status}:${body.slice(0, 300)}`);
  return JSON.parse(body);
}

(async () => {
  try {
    const base = process.env.MCFT_BASE_SHA;
    const head = git('rev-parse', 'HEAD');
    must(base === BASE, 'EXACT_S3_REGISTRATION_BASE_REQUIRED');
    must(git('rev-list', '--count', `${base}..HEAD`) === '1', 'ONE_COMMIT_REQUIRED');
    const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
    same(changed, FILES, 'EXACT_SIX_FILE_S3_REGISTRATION_BOUNDARY_REQUIRED');
    const diff = git('diff', '--unified=0', `${base}...HEAD`);
    const marker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
    must(!diff.includes(marker), 'CANDIDATE_DECLARATION_FORBIDDEN');
    must(git('rev-parse', `${base}:${REGISTRY}`) === BASE_REGISTRY_BLOB, 'BASE_REGISTRY_BLOB_REQUIRED');
    must(git('rev-parse', `HEAD:${REGISTRY}`) === TARGET_REGISTRY_BLOB, 'TARGET_REGISTRY_BLOB_REQUIRED');
    for (const file of FROZEN) must(git('diff', '--quiet', `${base}...HEAD`, '--', file) === '', `FROZEN_FILE_DRIFT:${file}`);
    must(!changed.some((file) => file.startsWith('apps/') || file.startsWith('packages/') || file.includes('/migrations/')), 'RUNTIME_OR_MIGRATION_FORBIDDEN');

    const attestation = JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S2_EXACT_SHA_ATTESTATION.json'), 'utf8'));
    const locator = JSON.parse(fs.readFileSync(artifact('MCFT_CAP_09_S2_ATTESTATION_RETENTION_LOCATOR.json'), 'utf8'));
    must(attestation.status === 'PASS' && attestation.subject_sha === S2_SUBJECT, 'S2_ATTESTATION_IDENTITY');
    must(attestation.semantic_artifact_digest === S2_DIGEST, 'S2_SEMANTIC_DIGEST');
    must(attestation.effective_authority?.s2_database_evidence_ingress_effective === true, 'S2_NOT_EFFECTIVE');
    must(attestation.effective_authority?.effective_next_slice === 'S3', 'S2_NEXT_SLICE');
    must(attestation.effective_authority?.s3_registry_registration_authorized === true, 'S3_REGISTRATION_NOT_AUTHORIZED');
    must(attestation.effective_authority?.s3_candidate_declaration_requires_registry_registration === true, 'S3_REGISTRATION_PRECONDITION');
    must(attestation.effective_authority?.s3_authorized_scope === 'PERSISTENT_SEQUENTIAL_SCHEDULER_ONLY', 'S3_SCOPE');
    falseAuthorities(attestation.effective_authority, 'S2_EFFECTIVE_AUTHORITY');
    must(locator.retention_level === 'R2' && locator.readback_verified === true && locator.locked_version_delete_denied === true, 'S2_R2_LOCATOR');
    must(Date.parse(locator.retain_until) >= Date.now() + 729 * 86400000, 'S2_R2_RETENTION_WINDOW');

    const before = JSON.parse(git('show', `${base}:${REGISTRY}`));
    const after = readJson(REGISTRY);
    must(after.authority_set_revision === '1.10' && after.authority_set_change_id === 'MCFT-CAP-09.S3-TRANSITION-REGISTRATION', 'REGISTRY_TARGET_REVISION');
    for (const id of ['MCFT-CAP-06', 'MCFT-CAP-07', 'MCFT-CAP-08']) {
      same(after.capabilities.find((entry) => entry.capability_line === id), before.capabilities.find((entry) => entry.capability_line === id), `PREDECESSOR_REGISTRY_DRIFT:${id}`);
    }
    const before09 = before.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-09');
    const after09 = after.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-09');
    must(before09 && after09, 'CAP09_REGISTRY_ENTRY');
    const s3Status = STATUS;
    same(after09.authoritative_candidate_status_paths, [...before09.authoritative_candidate_status_paths, s3Status], 'S3_STATUS_PATH_APPEND_ONLY');
    const s3Rule = {
      status_file: s3Status,
      field_path: 's3_candidate_implemented',
      allowed_candidate_values: [true],
      focused_workflow: 'mcft-cap-09-s3-persistent-sequential-scheduler',
      standard_workflow: 'ci',
      predecessor_effective_evidence_required: true,
    };
    same(after09.candidate_transition_fields, [...before09.candidate_transition_fields, s3Rule], 'S3_RULE_APPEND_ONLY');
    same(after09.deferred_status_paths, before09.deferred_status_paths.filter((value) => value !== s3Status), 'S3_DEFERRED_PATH_REMOVAL_ONLY');
    for (const key of Object.keys(before09)) {
      if (!['authoritative_candidate_status_paths', 'candidate_transition_fields', 'deferred_status_paths'].includes(key)) same(after09[key], before09[key], `CAP09_REGISTRY_FIELD_DRIFT:${key}`);
    }
    falseAuthorities(after09, 'REGISTRY_AUTHORITY');

    const status = readJson(STATUS);
    const boundary = readJson(BOUNDARY);
    const record = readJson(RECORD);
    must(status.s3_registry_registration_implemented === true && status.s3_candidate_implemented === false, 'S3_STATUS_NON_CANDIDATE');
    must(status.candidate_declaration_present === false && status.externally_effective === false, 'S3_STATUS_NON_EFFECTIVE');
    must(status.registry_rule_present === true && status.authorized_s3_scope === 'PERSISTENT_SEQUENTIAL_SCHEDULER_ONLY', 'S3_STATUS_SCOPE');
    must(status.s2_effective_subject_sha === S2_SUBJECT && status.s2_exact_sha_r2_run_id === S2_RUN && status.s2_exact_sha_artifact_id === S2_ARTIFACT && status.s2_semantic_artifact_digest === S2_DIGEST, 'S3_STATUS_S2_BINDING');
    falseAuthorities(status, 'S3_STATUS_AUTHORITY');
    must(boundary.base_main_sha === BASE && boundary.changed_file_count === 6, 'BOUNDARY_BASE_COUNT');
    same(boundary.changed_files.sort(), FILES, 'BOUNDARY_FILES');
    must(boundary.candidate_transition === false && boundary.candidate_declaration === false && boundary.registry_delta === 1 && boundary.runtime_source_delta === 0, 'BOUNDARY_DELTAS');
    must(record.base_registry_blob_sha === BASE_REGISTRY_BLOB && record.target_registry_blob_sha === TARGET_REGISTRY_BLOB, 'RECORD_REGISTRY_BLOBS');
    must(record.target_authority_set_revision === '1.10' && record.target_authority_set_change_id === 'MCFT-CAP-09.S3-TRANSITION-REGISTRATION', 'RECORD_TARGET');
    must(record.candidate_transition_performed === false && record.candidate_declaration_present === false && record.same_pr_registry_registration_cannot_authorize_candidate === true, 'RECORD_NON_CANDIDATE');
    falseAuthorities(record, 'S3_RECORD_AUTHORITY');

    if (process.env.MCFT_EVENT_NAME === 'pull_request') {
      const pr = await pullRequest(Number(process.env.MCFT_PR_NUMBER));
      must(pr.head.sha === head && pr.base.sha === base, 'PR_EXACT_SHA_BINDING');
      must(!String(pr.body || '').includes(`<!-- ${marker}`), 'PR_CANDIDATE_DECLARATION_FORBIDDEN');
    }

    const result = {
      schema_version: 'geox_mcft_cap09_s3_registry_registration_result_v1',
      status: 'PASS',
      base_sha: base,
      head_sha: head,
      changed_files: FILES,
      s2_effective_subject_sha: S2_SUBJECT,
      s2_exact_sha_r2_run_id: S2_RUN,
      s2_exact_sha_artifact_id: S2_ARTIFACT,
      s2_semantic_artifact_digest: S2_DIGEST,
      target_authority_set_revision: '1.10',
      target_registry_blob_sha: TARGET_REGISTRY_BLOB,
      s3_status_path_registered: true,
      s3_transition_rule_registered: true,
      candidate_transition: false,
      candidate_declaration_present: false,
      runtime_source_delta: 0,
      externally_effective: false,
      first_legal_next_action: 'MCFT_CAP_09_S3_PERSISTENT_SEQUENTIAL_SCHEDULER_CANDIDATE',
    };
    write(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const failure = { status: 'FAIL', error: String(error instanceof Error ? error.message : error) };
    write(failure);
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
})();
