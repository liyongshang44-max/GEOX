// Purpose: verify repository delivery-infrastructure migration evidence, including the MCFT-CAP-06 exact merge-SHA attestation.
// Boundary: read-only GitHub metadata/artifact inspection; no repository writeback, Runtime, canonical or capability authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_DELIVERY_INFRASTRUCTURE_V1_RESULT.json');
const STATUS_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-INFRASTRUCTURE-STATUS.json');
const WORKFLOW_NAME = 'mcft-cap-06-s11d-repair-merged-main-attestation';

function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

async function apiJson(apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-delivery-infrastructure-v1',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GITHUB_API_FAILED:${response.status}:${apiPath}:${body.slice(0, 500)}`);
  }
  return response.json();
}

async function verifyCap06Attestation() {
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const subject = String(process.env.MCFT_CAP_06_ATTESTATION_SUBJECT || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  if (!isSha(subject)) throw new Error('MCFT_CAP_06_ATTESTATION_SUBJECT_REQUIRED');
  const status = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
  assert.equal(status.p3_postmerge_proof_replacement.exact_merge_sha_subject, subject);
  assert.equal(status.p3_postmerge_proof_replacement.proof_only_pr_required, false);
  assert.equal(status.mcft_cap_07_authorized, false);
  const page = await apiJson(`/repos/${repository}/actions/runs?head_sha=${subject}&per_page=100`, token);
  const matches = (page.workflow_runs || [])
    .filter((run) => run.name === WORKFLOW_NAME && run.head_sha === subject && run.event === 'push')
    .sort((left, right) => Number(right.run_number) - Number(left.run_number));
  assert.ok(matches.length >= 1, 'CAP06_EXACT_MERGE_SHA_ATTESTATION_RUN_MISSING');
  const run = matches[0];
  assert.equal(run.status, 'completed', `CAP06_ATTESTATION_NOT_COMPLETED:${run.id}`);
  assert.equal(run.conclusion, 'success', `CAP06_ATTESTATION_NOT_PASS:${run.id}:${run.conclusion}`);
  const artifacts = await apiJson(`/repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`, token);
  const expectedArtifact = `mcft-cap-06-s11d-repair-attestation-${subject}`;
  const artifact = (artifacts.artifacts || []).find((item) => item.name === expectedArtifact && item.expired === false);
  assert.ok(artifact, `CAP06_ATTESTATION_ARTIFACT_MISSING:${expectedArtifact}`);
  const result = {
    schema_version: 'geox_mcft_delivery_infrastructure_v1_result',
    status: 'PASS',
    mode: 'VERIFY_CAP06_ATTESTATION',
    subject_commit: subject,
    workflow_name: run.name,
    workflow_run_id: run.id,
    workflow_event: run.event,
    workflow_conclusion: run.conclusion,
    artifact_id: artifact.id,
    artifact_name: artifact.name,
    proof_only_pr_required: false,
    repository_writeback_performed: false,
    postmerge_ssot_writeback_performed: false,
    capability_slice: false,
    runtime_authority: false,
    mcft_cap_07_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

async function main() {
  const mode = process.argv[2] || '--verify-cap06-attestation';
  if (mode === '--verify-cap06-attestation') return verifyCap06Attestation();
  throw new Error(`UNKNOWN_MODE:${mode}`);
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_delivery_infrastructure_v1_result',
    status: 'FAIL',
    mode: process.argv[2] || '--verify-cap06-attestation',
    error: error instanceof Error ? error.message : String(error),
    proof_only_pr_required: false,
    repository_writeback_performed: false,
    capability_slice: false,
    runtime_authority: false,
    mcft_cap_07_authorized: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
