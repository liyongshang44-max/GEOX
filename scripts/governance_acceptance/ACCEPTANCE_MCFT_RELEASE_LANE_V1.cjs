// Purpose: provide a serialized, exact-subject MCFT release lane for pull requests and merge groups.
// Boundary: repository delivery governance only; no Runtime, canonical, projection, migration, activation or capability authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_RELEASE_LANE_V1_RESULT.json');
const POLICY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-RELEASE-LANE-V1.json');

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function validatePolicy(policy) {
  assert.equal(policy.release_lane_id, 'MCFT-RELEASE-LANE-V1');
  assert.equal(policy.capability_slice, false);
  assert.equal(policy.runtime_authority, false);
  assert.equal(policy.serialization.concurrency_group, 'mcft-release-lane-main');
  assert.equal(policy.serialization.cancel_in_progress, false);
  assert.equal(policy.serialization.candidate_base_must_equal_current_main, true);
  assert.equal(policy.serialization.candidate_history_must_be_linear, true);
  assert.equal(policy.serialization.merge_group_check_required, true);
  assert.equal(policy.merge_group_contract.trigger, 'merge_group:checks_requested');
  assert.equal(policy.merge_group_contract.proof_only_pr_required, false);
  assert.equal(policy.postmerge_contract.proof_only_pr_required, false);
  assert.equal(policy.effectiveness_boundary.repository_side_implementation, 'ESTABLISHED');
  assert.equal(policy.effectiveness_boundary.platform_required_check_enforcement, 'NOT_ESTABLISHED');
}

async function apiJson(apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'geox-mcft-release-lane-v1',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GITHUB_API_FAILED:${response.status}:${apiPath}:${body.slice(0, 500)}`);
  }
  return response.json();
}

function baseResult(policy, mode) {
  return {
    schema_version: 'geox_mcft_release_lane_v1_result',
    status: 'PASS',
    mode,
    release_lane_id: policy.release_lane_id,
    proof_only_pr_required: false,
    branch_transport_allowed: false,
    repository_side_implementation: 'ESTABLISHED',
    platform_required_check_enforcement: 'NOT_ESTABLISHED',
    capability_slice: false,
    runtime_authority: false,
  };
}

function selftest(policy) {
  const workflow = fs.readFileSync(path.join(ROOT, policy.workflow_ref), 'utf8');
  assert.match(workflow, /merge_group:/);
  assert.match(workflow, /group: mcft-release-lane-main/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /Checkout exact release subject/);
  const result = {
    ...baseResult(policy, 'SELFTEST'),
    merge_group_supported: true,
    serialized_concurrency: true,
  };
  write(result);
  console.log(JSON.stringify(result));
}

async function pullRequest(policy) {
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const baseSha = String(process.env.MCFT_RELEASE_BASE_SHA || '').trim();
  const headSha = String(process.env.MCFT_RELEASE_HEAD_SHA || '').trim();
  const prNumber = Number(process.env.MCFT_RELEASE_PR_NUMBER || 0);
  const draft = String(process.env.MCFT_RELEASE_PR_DRAFT || 'false') === 'true';
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  if (!isSha(baseSha) || !isSha(headSha)) throw new Error('RELEASE_BASE_AND_HEAD_SHA_REQUIRED');
  if (!Number.isInteger(prNumber) || prNumber <= 0) throw new Error('RELEASE_PR_NUMBER_REQUIRED');
  const actualHead = git(['rev-parse', 'HEAD']);
  assert.equal(actualHead, headSha, 'RELEASE_HEAD_CHECKOUT_MISMATCH');
  git(['cat-file', '-e', `${baseSha}^{commit}`]);
  git(['merge-base', '--is-ancestor', baseSha, headSha]);
  const currentMain = await apiJson(`/repos/${repository}/git/ref/heads/main`, token);
  assert.equal(currentMain.object.sha, baseSha, `RELEASE_BASE_NOT_CURRENT_MAIN:${baseSha}:${currentMain.object.sha}`);
  const commitCount = Number(git(['rev-list', '--count', `${baseSha}..${headSha}`]));
  const commitLimit = draft ? 20 : policy.serialization.ready_candidate_commit_limit;
  assert.ok(commitCount <= commitLimit, `RELEASE_COMMIT_LIMIT_EXCEEDED:${commitCount}:${commitLimit}`);
  const merges = git(['rev-list', '--merges', `${baseSha}..${headSha}`]);
  assert.equal(merges, '', 'RELEASE_CANDIDATE_HISTORY_NOT_LINEAR');
  const candidateTree = git(['rev-parse', `${headSha}^{tree}`]);
  const changedRaw = git(['diff', '--name-only', `${baseSha}...${headSha}`]);
  const changedFiles = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  const result = {
    ...baseResult(policy, 'PULL_REQUEST'),
    pr_number: prNumber,
    pr_draft: draft,
    base_sha: baseSha,
    current_main_sha: currentMain.object.sha,
    head_sha: headSha,
    candidate_tree_sha: candidateTree,
    commit_count: commitCount,
    commit_limit: commitLimit,
    changed_files: changedFiles,
    changed_file_count: changedFiles.length,
    current_main_composition_verified: true,
    linear_candidate_history_verified: true,
  };
  write(result);
  console.log(JSON.stringify(result));
}

function mergeGroup(policy) {
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  const expectedHead = String(process.env.MCFT_RELEASE_HEAD_SHA || '').trim();
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  if (!isSha(expectedHead)) throw new Error('MERGE_GROUP_HEAD_SHA_REQUIRED');
  const event = loadJson(eventPath);
  const group = event.merge_group;
  if (!group) throw new Error('MERGE_GROUP_EVENT_REQUIRED');
  const subject = group.head_sha || expectedHead;
  assert.equal(subject, expectedHead, 'MERGE_GROUP_EVENT_HEAD_MISMATCH');
  assert.equal(git(['rev-parse', 'HEAD']), expectedHead, 'MERGE_GROUP_CHECKOUT_MISMATCH');
  const result = {
    ...baseResult(policy, 'MERGE_GROUP'),
    subject_commit: expectedHead,
    base_sha: group.base_sha || null,
    head_ref: group.head_ref || null,
    base_ref: group.base_ref || null,
    exact_merge_group_subject_verified: true,
    latest_main_composition_required: true,
  };
  write(result);
  console.log(JSON.stringify(result));
}

async function main() {
  const policy = loadJson(POLICY_PATH);
  validatePolicy(policy);
  const mode = process.argv[2] || '--selftest';
  if (mode === '--selftest') return selftest(policy);
  if (mode === '--pull-request') return pullRequest(policy);
  if (mode === '--merge-group') return mergeGroup(policy);
  throw new Error(`UNKNOWN_MODE:${mode}`);
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_release_lane_v1_result',
    status: 'FAIL',
    mode: process.argv[2] || '--selftest',
    error: error instanceof Error ? error.message : String(error),
    proof_only_pr_required: false,
    branch_transport_allowed: false,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
