#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S2_EXACT_SHA_ATTESTATION_RESULT.json');
const REMEDIATION_MARKER = 'MCFT_CAP08_S2_EXACT_SHA_REMEDIATION_V1';
const CANDIDATE_MARKER = 'MCFT_CANDIDATE_DECLARATION_V2';
const STATUS_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json';
const ORIGINAL_CANDIDATE_PR = 2637;
const ORIGINAL_BASE_HEAD = 'e68e7d1f12025726aad2c1d9edccf82a82058ee9';
const ORIGINAL_CANDIDATE_HEAD = '88dba989203d93a994ed0a7e7002b0a106ed7d88';
const ORIGINAL_CANDIDATE_MERGE = '15d26d86ff955bab982871adf6e1bd8c75b07972';

function git(...args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function canonicalSha(value, label) {
  const raw = String(value || '').trim();
  if (!/^[0-9a-f]{40}$/i.test(raw)) throw new Error(`${label}_INVALID:${raw}`);
  return git('rev-parse', `${raw}^{commit}`);
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function parseMarker(body, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...String(body || '').matchAll(new RegExp(`<!--\\s*${escaped}\\s*\\n([\\s\\S]*?)-->`, 'gm'))];
  if (matches.length !== 1) throw new Error(`${marker}_CARDINALITY:${matches.length}`);
  const record = {};
  for (const raw of matches[0][1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.indexOf('=');
    if (at < 1) throw new Error(`${marker}_LINE_INVALID:${line}`);
    const key = line.slice(0, at).trim();
    if (Object.hasOwn(record, key)) throw new Error(`${marker}_DUPLICATE_KEY:${key}`);
    record[key] = line.slice(at + 1).trim();
  }
  return record;
}
async function api(apiPath) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-cap08-s2-exact-remediation-v1',
    },
  });
  if (!response.ok) throw new Error(`GITHUB_API:${response.status}:${apiPath}:${(await response.text()).slice(0, 300)}`);
  return response.json();
}
function snapshotArrays(declaration) {
  const paths = String(declaration.semantic_snapshot_files || '').split(',').map((value) => value.trim()).filter(Boolean);
  const blobs = String(declaration.semantic_snapshot_blobs || '').split(',').map((value) => value.trim()).filter(Boolean);
  assert.equal(paths.length, blobs.length, 'SEMANTIC_SNAPSHOT_CARDINALITY_MISMATCH');
  assert.ok(paths.length >= 4, 'SEMANTIC_SNAPSHOT_SET_TOO_SMALL');
  return { paths, blobs };
}
function verifySnapshots(commit, declaration, label) {
  const { paths, blobs } = snapshotArrays(declaration);
  for (let index = 0; index < paths.length; index += 1) {
    assert.equal(git('rev-parse', `${commit}:${paths[index]}`), blobs[index], `${label}_BLOB_MISMATCH:${paths[index]}`);
  }
  return { paths, blobs };
}
async function successfulRuns(repository, head, focusedWorkflow, standardWorkflow) {
  const page = await api(`/repos/${repository}/actions/runs?head_sha=${head}&event=pull_request&per_page=100`);
  const successful = (name) => (page.workflow_runs || [])
    .filter((run) => run.name === name && run.head_sha === head && run.conclusion === 'success')
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  const focused = successful(focusedWorkflow);
  const standard = successful(standardWorkflow);
  assert.ok(focused.length >= 1, `FOCUSED_WORKFLOW_SUCCESS_REQUIRED:${head}`);
  assert.ok(standard.length >= 1, `STANDARD_WORKFLOW_SUCCESS_REQUIRED:${head}`);
  return { focused: focused[0], standard: standard[0] };
}

async function main() {
  const subject = canonicalSha(process.env.MCFT_SUBJECT_SHA, 'MCFT_SUBJECT_SHA');
  assert.equal(git('rev-parse', 'HEAD'), subject, 'EXACT_SUBJECT_NOT_CHECKED_OUT');

  const parents = git('rev-list', '--parents', '-n', '1', subject).split(/\s+/);
  assert.equal(parents.length, 3, 'PROTECTED_TWO_PARENT_MERGE_REQUIRED');
  const baseHead = canonicalSha(parents[1], 'BASE_PARENT');
  const remediationHead = canonicalSha(parents[2], 'REMEDIATION_PARENT');
  assert.equal(baseHead, ORIGINAL_CANDIDATE_MERGE, 'REMEDIATION_BASE_NOT_ORIGINAL_CANDIDATE_MERGE');
  const remediationTree = git('rev-parse', `${remediationHead}^{tree}`);
  const mergeTree = git('rev-parse', `${subject}^{tree}`);
  assert.equal(remediationTree, mergeTree, 'REMEDIATION_MERGE_TREE_DELTA_NONZERO');

  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  if (!/^[^/]+\/[^/]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY_INVALID');

  const pullsPath = `/repos/${repository}/commits/${subject}/pulls`;
  assert.ok(pullsPath.endsWith('/pulls'), 'MERGED_PULLS_API_PATH_INVALID');
  const pulls = await api(pullsPath);
  const merged = pulls.filter((pull) => pull.merge_commit_sha === subject && pull.merged_at);
  assert.equal(merged.length, 1, 'EXACT_REMEDIATION_PR_CARDINALITY');
  const remediationPr = merged[0];
  assert.equal(canonicalSha(remediationPr.head.sha, 'REMEDIATION_PR_HEAD'), remediationHead, 'REMEDIATION_PR_HEAD_PARENT_MISMATCH');
  assert.equal(canonicalSha(remediationPr.base.sha, 'REMEDIATION_PR_BASE'), baseHead, 'REMEDIATION_PR_BASE_PARENT_MISMATCH');

  const remediation = parseMarker(remediationPr.body, REMEDIATION_MARKER);
  assert.equal(remediation.capability_line, 'MCFT-CAP-08');
  assert.equal(remediation.slice_id, 'MCFT-CAP-08.S2');
  assert.equal(remediation.remediation_type, 'EXACT_SHA_VERIFIER_LIFECYCLE_REPAIR');
  assert.equal(remediation.status_file, STATUS_PATH);
  assert.equal(Number(remediation.initial_candidate_pr), ORIGINAL_CANDIDATE_PR);
  assert.equal(canonicalSha(remediation.initial_candidate_head, 'INITIAL_CANDIDATE_HEAD'), ORIGINAL_CANDIDATE_HEAD);
  assert.equal(canonicalSha(remediation.initial_candidate_merge, 'INITIAL_CANDIDATE_MERGE'), ORIGINAL_CANDIDATE_MERGE);
  assert.equal(canonicalSha(remediation.remediation_head, 'DECLARED_REMEDIATION_HEAD'), remediationHead);
  assert.equal(canonicalSha(remediation.base_head, 'DECLARED_REMEDIATION_BASE'), baseHead);
  assert.equal(remediation.focused_workflow, 'mcft-cap-08-s2-forcing-state-forecast');
  assert.equal(remediation.standard_workflow, 'ci');
  const remediationSnapshots = verifySnapshots(remediationHead, remediation, 'REMEDIATION_SEMANTIC_SNAPSHOT');

  const originalPr = await api(`/repos/${repository}/pulls/${ORIGINAL_CANDIDATE_PR}`);
  assert.ok(originalPr.merged_at, 'ORIGINAL_CANDIDATE_PR_NOT_MERGED');
  assert.equal(canonicalSha(originalPr.merge_commit_sha, 'ORIGINAL_PR_MERGE'), ORIGINAL_CANDIDATE_MERGE);
  assert.equal(canonicalSha(originalPr.head.sha, 'ORIGINAL_PR_HEAD'), ORIGINAL_CANDIDATE_HEAD);
  assert.equal(canonicalSha(originalPr.base.sha, 'ORIGINAL_PR_BASE'), ORIGINAL_BASE_HEAD);

  const declaration = parseMarker(originalPr.body, CANDIDATE_MARKER);
  assert.equal(declaration.capability_line, 'MCFT-CAP-08');
  assert.equal(declaration.slice_id, 'MCFT-CAP-08.S2');
  assert.equal(declaration.status_file, STATUS_PATH);
  assert.equal(declaration.candidate_field, 's2_candidate_implemented');
  assert.equal(declaration.candidate_value, 'true');
  assert.equal(declaration.focused_workflow, 'mcft-cap-08-s2-forcing-state-forecast');
  assert.equal(declaration.standard_workflow, 'ci');
  assert.equal(canonicalSha(declaration.candidate_head, 'ORIGINAL_DECLARATION_HEAD'), ORIGINAL_CANDIDATE_HEAD);
  assert.equal(canonicalSha(declaration.base_head, 'ORIGINAL_DECLARATION_BASE'), ORIGINAL_BASE_HEAD);
  const originalSnapshots = verifySnapshots(ORIGINAL_CANDIDATE_HEAD, declaration, 'ORIGINAL_CANDIDATE_SEMANTIC_SNAPSHOT');

  const remediationRuns = await successfulRuns(repository, remediationHead, remediation.focused_workflow, remediation.standard_workflow);
  const originalRuns = await successfulRuns(repository, ORIGINAL_CANDIDATE_HEAD, declaration.focused_workflow, declaration.standard_workflow);

  const status = readJson(STATUS_PATH);
  assert.equal(status.s2_candidate_implemented, true);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.effectiveness_condition, 'PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS');
  assert.equal(status.effective_status_when_attested, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
  assert.equal(status.effective_next_slice_when_attested, 'S3');
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.s3_authorized, false);

  const result = {
    schema_version: 'geox_mcft_cap08_s2_exact_sha_attestation_result_v3',
    status: 'PASS',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S2',
    subject_sha: subject,
    subject_commit: subject,
    base_head_sha: baseHead,
    candidate_head_sha: remediationHead,
    candidate_tree_sha: remediationTree,
    merge_commit_sha: subject,
    merge_tree_sha: mergeTree,
    candidate_to_merge_tree_delta: 0,
    attested_tree_sha: mergeTree,
    remediation_pr_number: remediationPr.number,
    original_candidate: {
      pr_number: ORIGINAL_CANDIDATE_PR,
      base_head_sha: ORIGINAL_BASE_HEAD,
      candidate_head_sha: ORIGINAL_CANDIDATE_HEAD,
      merge_commit_sha: ORIGINAL_CANDIDATE_MERGE,
      focused_workflow_run_id: originalRuns.focused.id,
      standard_workflow_run_id: originalRuns.standard.id,
      semantic_snapshot_count: originalSnapshots.paths.length,
    },
    remediation: {
      focused_workflow_run_id: remediationRuns.focused.id,
      standard_workflow_run_id: remediationRuns.standard.id,
      semantic_snapshot_count: remediationSnapshots.paths.length,
    },
    effective_delivery_frontier_projection: {
      effective_status: 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE',
      effective_next_slice: 'S3',
    },
    effective_authority_projection: {
      formal_forcing_evidence_state_forecast_authorized: true,
      production_runtime_source_authorized: false,
      decision_action_feedback_authorized: false,
      late_append_forward_authorized: false,
      residual_calibration_shadow_authorized: false,
      model_activation_authorized: false,
      mcft_cap_09_authorized: false,
    },
  };
  write(result);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap08_s2_exact_sha_attestation_result_v3',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
});
