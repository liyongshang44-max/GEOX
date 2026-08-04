#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const cp = require('node:child_process');

const SUBJECT = 'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const RUNS = Object.freeze({
  run_a: Object.freeze({
    run_id: 30845476698,
    run_attempt: 1,
    workflow_head_sha: '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1',
    artifact_id: 8868535301,
    artifact_digest: 'sha256:4d59d3aa0373bee0c9eb33ab78dd427eb324d4d259e0786aa9c4dea9effdaf2f',
  }),
  run_b: Object.freeze({
    run_id: 30877450717,
    run_attempt: 1,
    workflow_head_sha: 'a5039a07455e8b325db23880dd8e8c460fc6aa0d',
    artifact_id: 8880057024,
    artifact_digest: 'sha256:33e8b0333e1cd22bcd3002540ef5c12b72a8c545e58eb8ca185bf49edc6ae9cc',
  }),
});

const gitBlob = (file) => cp.execFileSync('git', ['rev-parse', `HEAD:${file}`], { encoding: 'utf8' }).trim();

function loadAuthority() {
  const authorityPath = String(process.env.MCFT_EXECUTION_AUTHORITY_PATH || '').trim();
  assert.ok(authorityPath, 'MCFT_EXECUTION_AUTHORITY_PATH_REQUIRED');
  const authority = JSON.parse(fs.readFileSync(path.resolve(authorityPath), 'utf8'));
  assert.equal(authority.schema_version, 'geox_mcft_cap08_s6_formal_cross_run_comparator_authority_v1');
  assert.equal(authority.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_AUTHORIZED');
  assert.equal(authority.exact_subject_sha, SUBJECT);
  assert.equal(authority.exact_subject_sha, process.env.MCFT_EXACT_SUBJECT_SHA);
  assert.equal(authority.comparator_execution_id, process.env.MCFT_COMPARATOR_EXECUTION_ID);
  for (const [key, spec] of Object.entries(RUNS)) {
    const input = authority.inputs?.[key];
    assert.ok(input, `AUTHORITY_INPUT_REQUIRED:${key}`);
    assert.equal(input.workflow_run_id, spec.run_id, `${key}_WORKFLOW_RUN_ID`);
    assert.equal(input.workflow_run_attempt, spec.run_attempt, `${key}_WORKFLOW_RUN_ATTEMPT`);
    assert.equal(input.artifact_id, spec.artifact_id, `${key}_ARTIFACT_ID`);
    assert.equal(input.artifact_digest, spec.artifact_digest, `${key}_ARTIFACT_DIGEST`);
  }
  return { authority, authorityPath };
}

function gate() {
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(Number(process.env.GITHUB_RUN_ATTEMPT), 1);
  const { authority, authorityPath } = loadAuthority();
  const expected = {
    authority_effective: true,
    comparator_execution_authorized: true,
    maximum_execution_count: 1,
    required_execution_attempt: 1,
    rerun_authorized: false,
    duplicate_execution_authorized: false,
    authority_reuse_authorized: false,
  };
  for (const [key, value] of Object.entries(expected)) assert.equal(authority[key], value, key);
  assert.ok(Date.parse(authority.expires_at) > Date.now(), 'FORMAL_COMPARATOR_AUTHORITY_EXPIRED');
  for (const frozen of [
    authority.execution_workflow,
    authority.execution_control,
    authority.implementation,
    {
      path: authority.implementation.normalization_path,
      blob_sha: authority.implementation.normalization_blob_sha,
    },
  ]) {
    assert.equal(gitBlob(frozen.path), frozen.blob_sha, frozen.path);
  }
  console.log(`MCFT_CAP08_FORMAL_COMPARATOR_AUTHORITY=${authorityPath}`);
  console.log(`MCFT_CAP08_FORMAL_RUN_A_BUNDLE_FILE=${authority.inputs.run_a.bundle_file}`);
  console.log(`MCFT_CAP08_FORMAL_RUN_B_BUNDLE_FILE=${authority.inputs.run_b.bundle_file}`);
}

function get(apiPath) {
  const token = process.env.GH_TOKEN;
  assert.ok(token, 'GH_TOKEN_REQUIRED');
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: 'api.github.com',
      path: `/repos/${process.env.GITHUB_REPOSITORY}${apiPath}`,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'mcft-cap08-formal-comparator',
      },
    }, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(JSON.parse(body));
        else reject(new Error(`HTTP_${response.statusCode}:${body}`));
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function verifyInput(key, spec, authorityInput, run, artifacts) {
  assert.equal(authorityInput.workflow_run_id, spec.run_id, `${key}_AUTHORITY_RUN_ID`);
  assert.equal(authorityInput.workflow_run_attempt, spec.run_attempt, `${key}_AUTHORITY_RUN_ATTEMPT`);
  assert.equal(authorityInput.artifact_id, spec.artifact_id, `${key}_AUTHORITY_ARTIFACT_ID`);
  assert.equal(authorityInput.artifact_digest, spec.artifact_digest, `${key}_AUTHORITY_ARTIFACT_DIGEST`);
  assert.equal(run.id, spec.run_id, `${key}_RUN_ID`);
  assert.equal(run.event, 'workflow_dispatch', `${key}_EVENT`);
  assert.equal(run.conclusion, 'success', `${key}_CONCLUSION`);
  assert.equal(run.run_attempt, spec.run_attempt, `${key}_RUN_ATTEMPT`);
  assert.equal(run.head_sha, spec.workflow_head_sha, `${key}_WORKFLOW_HEAD_SHA`);
  assert.notEqual(run.head_sha, SUBJECT, `${key}_WORKFLOW_HEAD_MUST_REMAIN_DISTINCT_FROM_EXECUTION_SUBJECT`);
  const artifact = artifacts.find((item) => item.id === spec.artifact_id);
  assert.ok(artifact, `${key}_ARTIFACT_REQUIRED`);
  assert.equal(artifact.digest, spec.artifact_digest, `${key}_ARTIFACT_DIGEST`);
  return {
    workflow_run_id: spec.run_id,
    workflow_run_attempt: spec.run_attempt,
    event: run.event,
    conclusion: run.conclusion,
    head_sha: run.head_sha,
    workflow_head_sha: run.head_sha,
    exact_subject_sha: SUBJECT,
    artifact_id: spec.artifact_id,
    artifact_digest: artifact.digest,
  };
}

async function audit() {
  const { authority } = loadAuthority();
  const output = {
    schema_version: 'geox_mcft_cap08_s6_formal_cross_run_comparator_input_audit_v2',
    status: 'PASS',
    provenance_identity_model: 'DISTINCT_WORKFLOW_HEAD_AND_EXECUTION_SUBJECT',
    exact_subject_sha: SUBJECT,
  };
  for (const [key, spec] of Object.entries(RUNS)) {
    const run = await get(`/actions/runs/${spec.run_id}`);
    const artifacts = (await get(`/actions/runs/${spec.run_id}/artifacts?per_page=100`)).artifacts || [];
    output[key] = verifyInput(key, spec, authority.inputs[key], run, artifacts);
  }
  const outputPath = String(process.env.MCFT_COMPARATOR_INPUT_AUDIT_OUTPUT || '').trim();
  assert.ok(outputPath, 'MCFT_COMPARATOR_INPUT_AUDIT_OUTPUT_REQUIRED');
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
}

function main() {
  const mode = process.argv[2];
  if (mode === 'gate') gate();
  else if (mode === 'audit') audit().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  else throw new Error('MODE_REQUIRED');
}

if (require.main === module) main();
module.exports = { SUBJECT, RUNS, loadAuthority, verifyInput, gate, audit, main };
