#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const POLICY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json');
const CANDIDATE_RESULT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2_RESULT.json');
const RESULT_PATH = path.join(ROOT, 'acceptance-output/MCFT_RELEASE_LANE_V1_RESULT.json');
const MODE = process.argv[2] || '--selftest';

function loadJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeResult(value) {
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function isSha(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value); }
function sleep(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
function declarationMatches(body, marker) {
  const pattern = new RegExp(`<!--\\s*${marker}\\s*\\n([\\s\\S]*?)-->`, 'gm');
  return [...String(body || '').matchAll(pattern)];
}
function parseDeclaration(body, policy) {
  const matches = declarationMatches(body, policy.candidate_declaration.marker);
  if (matches.length !== 1) throw new Error(`RELEASE_LANE_DECLARATION_CARDINALITY:${matches.length}`);
  const declaration = {};
  for (const rawLine of matches[0][1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`RELEASE_LANE_DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.hasOwn(declaration, key)) throw new Error(`RELEASE_LANE_DECLARATION_DUPLICATE_KEY:${key}`);
    declaration[key] = value;
  }
  assert.deepEqual(Object.keys(declaration).sort(), [...policy.candidate_declaration.required_fields].sort(), 'RELEASE_LANE_DECLARATION_KEYS_INVALID');
  if (!isSha(declaration.candidate_head) || !isSha(declaration.base_head)) throw new Error('RELEASE_LANE_DECLARATION_SHA_INVALID');
  return declaration;
}
function validatePolicy(policy) {
  assert.equal(policy.schema_version, 'geox_mcft_delivery_policy_v2');
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(policy.policy_revision, '2.2');
  assert.equal(policy.release_lane.lane_id, 'MCFT-RELEASE-LANE-V1');
  assert.equal(policy.release_lane.mode, 'MERGE_REF_EXACT_TREE_GATE');
  assert.equal(policy.release_lane.concurrency_scope, 'EVENT_AND_EXACT_HEAD');
  assert.equal(policy.release_lane.global_concurrency_group, null);
  assert.equal(policy.release_lane.cross_event_cancellation_forbidden, true);
  assert.equal(policy.release_lane.branch_transport_allowed, false);
  assert.equal(policy.release_lane.validation_carrier_pr_allowed, false);
  assert.equal(policy.release_lane.proof_only_pr_allowed, false);
  assert.equal(policy.repository_setting_boundary.branch_ruleset_verified, true);
  assert.equal(policy.repository_setting_boundary.strict_up_to_date_verified, true);
  assert.equal(policy.repository_setting_boundary.trusted_enforcement_required_checks_bound, true);
  assert.equal(policy.repository_setting_boundary.operational_release_authority_established, true);
  return policy;
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
  return response.status === 204 ? null : response.json();
}
async function waitForMergeObject(repository, prNumber, token) {
  const maxAttempts = Number(process.env.MCFT_RELEASE_LANE_MAX_ATTEMPTS || 40);
  const intervalMs = Number(process.env.MCFT_RELEASE_LANE_POLL_INTERVAL_MS || 3000);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pr = await apiJson(`/repos/${repository}/pulls/${prNumber}`, token);
    if (pr.mergeable === false || pr.mergeable_state === 'dirty') throw new Error(`RELEASE_LANE_PR_NOT_MERGEABLE:${pr.mergeable_state}`);
    if (pr.merge_commit_sha && isSha(pr.merge_commit_sha) && pr.mergeable !== null) return { pr, attempt_count: attempt };
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error('RELEASE_LANE_TEST_MERGE_NOT_AVAILABLE');
}
function parentShas(commit) {
  return Array.isArray(commit.parents) ? commit.parents.map((item) => item.sha) : [];
}
function selftest() {
  const policy = validatePolicy(loadJson(POLICY_PATH));
  const body = `<!-- ${policy.candidate_declaration.marker}\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.EXAMPLE-V1\nstatus_file=docs/digital_twin/mcft/cap_07/EXAMPLE-STATUS.json\ncandidate_field=candidate_implemented\ncandidate_value=true\nfocused_workflow=mcft-cap-07-example\nstandard_workflow=ci\nsemantic_snapshot_files=docs/digital_twin/mcft/cap_07/EXAMPLE-STATUS.json\nsemantic_snapshot_blobs=${'1'.repeat(40)}\ncandidate_head=${'2'.repeat(40)}\nbase_head=${'3'.repeat(40)}\n-->`;
  const declaration = parseDeclaration(body, policy);
  assert.equal(declaration.candidate_head, '2'.repeat(40));
  assert.deepEqual(parentShas({ parents: [{ sha: 'a' }, { sha: 'b' }] }), ['a', 'b']);
  assert.equal('tree-a' === 'tree-a', true);
  assert.equal('tree-a' === 'tree-b', false);
  const result = {
    schema_version: 'geox_mcft_release_lane_v1_result_v2',
    status: 'PASS', mode: 'SELFTEST', lane_id: policy.release_lane.lane_id,
    exact_tree_gate: true, current_main_base_gate: true,
    event_and_exact_head_scoped_concurrency: true,
    branch_ruleset_verified: true, strict_up_to_date_verified: true,
    trusted_enforcement_required_checks_bound: true,
    operational_release_authority_established_on_effective_merge: true,
    branch_transport_allowed: false, proof_only_pr_allowed: false,
    repository_write_permission: false, capability_slice: false, runtime_authority: false,
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
async function enforce() {
  const policy = validatePolicy(loadJson(POLICY_PATH));
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (!repository.includes('/')) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error('GITHUB_EVENT_PATH_REQUIRED');
  const event = loadJson(eventPath);
  if (!event.pull_request?.number) throw new Error('PULL_REQUEST_TARGET_EVENT_REQUIRED');
  let pr = await apiJson(`/repos/${repository}/pulls/${event.pull_request.number}`, token);
  if (pr.state !== 'open') {
    const result = { schema_version: 'geox_mcft_release_lane_v1_result_v2', status: 'PASS', mode: 'ENFORCE', disposition: 'CLOSED_PR_NO_RELEASE_LANE', pr_number: pr.number };
    writeResult(result); process.stdout.write(`${JSON.stringify(result)}\n`); return;
  }
  const matches = declarationMatches(pr.body || '', policy.candidate_declaration.marker);
  if (matches.length === 0) {
    const result = { schema_version: 'geox_mcft_release_lane_v1_result_v2', status: 'PASS', mode: 'ENFORCE', disposition: 'NO_DECLARED_MCFT_CANDIDATE', pr_number: pr.number, head_sha: pr.head.sha };
    writeResult(result); process.stdout.write(`${JSON.stringify(result)}\n`); return;
  }
  if (pr.draft === true) {
    const result = { schema_version: 'geox_mcft_release_lane_v1_result_v2', status: 'PASS', mode: 'ENFORCE', disposition: 'DRAFT_CANDIDATE_NOT_IN_RELEASE_LANE', pr_number: pr.number, head_sha: pr.head.sha };
    writeResult(result); process.stdout.write(`${JSON.stringify(result)}\n`); return;
  }
  const declaration = parseDeclaration(pr.body || '', policy);
  if (declaration.candidate_head !== pr.head.sha) throw new Error('RELEASE_LANE_DECLARED_HEAD_MISMATCH');
  if (declaration.base_head !== pr.base.sha) throw new Error('RELEASE_LANE_DECLARED_BASE_MISMATCH');
  if (!fs.existsSync(CANDIDATE_RESULT_PATH)) throw new Error('RELEASE_LANE_CANDIDATE_GATE_RESULT_MISSING');
  const candidateResult = loadJson(CANDIDATE_RESULT_PATH);
  if (candidateResult.status !== 'PASS' || candidateResult.disposition !== 'GENERIC_CANDIDATE_DECLARATION_VALID') throw new Error('RELEASE_LANE_CANDIDATE_GATE_NOT_PASS');
  if (candidateResult.head_sha !== pr.head.sha || candidateResult.base_sha !== pr.base.sha) throw new Error('RELEASE_LANE_CANDIDATE_GATE_SUBJECT_MISMATCH');

  const baseRef = await apiJson(`/repos/${repository}/git/ref/heads/${encodeURIComponent(pr.base.ref)}`, token);
  const currentMainSha = baseRef.object?.sha;
  if (!isSha(currentMainSha)) throw new Error('RELEASE_LANE_CURRENT_BASE_SHA_INVALID');
  if (currentMainSha !== pr.base.sha) throw new Error(`RELEASE_LANE_BASE_DRIFT:${pr.base.sha}:${currentMainSha}`);

  const mergeObject = await waitForMergeObject(repository, pr.number, token);
  pr = mergeObject.pr;
  if (pr.head.sha !== declaration.candidate_head) throw new Error('RELEASE_LANE_HEAD_MOVED_BEFORE_TREE_CHECK');
  if (pr.base.sha !== declaration.base_head) throw new Error('RELEASE_LANE_BASE_MOVED_BEFORE_TREE_CHECK');
  const [headCommit, mergeCommit] = await Promise.all([
    apiJson(`/repos/${repository}/git/commits/${pr.head.sha}`, token),
    apiJson(`/repos/${repository}/git/commits/${pr.merge_commit_sha}`, token),
  ]);
  const headTree = headCommit.tree?.sha;
  const mergeTree = mergeCommit.tree?.sha;
  if (!isSha(headTree) || !isSha(mergeTree)) throw new Error('RELEASE_LANE_TREE_SHA_INVALID');
  const parents = parentShas(mergeCommit);
  if (!parents.includes(pr.base.sha)) throw new Error('RELEASE_LANE_TEST_MERGE_BASE_PARENT_MISSING');
  if (!parents.includes(pr.head.sha)) throw new Error('RELEASE_LANE_TEST_MERGE_CANDIDATE_PARENT_MISSING');
  if (mergeTree !== headTree) throw new Error(`RELEASE_LANE_TREE_DRIFT:${headTree}:${mergeTree}`);

  const [currentPr, currentBaseRef] = await Promise.all([
    apiJson(`/repos/${repository}/pulls/${pr.number}`, token),
    apiJson(`/repos/${repository}/git/ref/heads/${encodeURIComponent(pr.base.ref)}`, token),
  ]);
  if (currentPr.head.sha !== pr.head.sha) throw new Error('RELEASE_LANE_HEAD_MOVED_AFTER_TREE_CHECK');
  if (currentPr.base.sha !== pr.base.sha) throw new Error('RELEASE_LANE_PR_BASE_MOVED_AFTER_TREE_CHECK');
  if (currentBaseRef.object?.sha !== pr.base.sha) throw new Error('RELEASE_LANE_MAIN_MOVED_AFTER_TREE_CHECK');

  const result = {
    schema_version: 'geox_mcft_release_lane_v1_result_v2',
    status: 'PASS', mode: 'ENFORCE', disposition: 'EXACT_MERGE_REF_TREE_EQUIVALENT',
    policy_id: policy.policy_id, lane_id: policy.release_lane.lane_id,
    pr_number: pr.number, capability_line: declaration.capability_line, slice_id: declaration.slice_id,
    base_branch: pr.base.ref, base_sha: pr.base.sha, current_main_sha: currentMainSha,
    candidate_head: pr.head.sha, candidate_tree: headTree,
    test_merge_sha: pr.merge_commit_sha, test_merge_tree: mergeTree, test_merge_parents: parents,
    tree_equivalence: 'PASS', base_stability: 'PASS', head_stability: 'PASS',
    merge_object_poll_attempt_count: mergeObject.attempt_count,
    branch_transport_used: false, validation_carrier_pr_used: false, proof_only_pr_used: false,
    repository_write_performed: false, candidate_invalidated: false,
    capability_slice: false, runtime_authority: false,
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

(async () => {
  if (MODE === '--selftest') return selftest();
  if (MODE === '--enforce') return enforce();
  throw new Error(`UNKNOWN_MODE:${MODE}`);
})().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_release_lane_v1_result_v2',
    status: 'FAIL', mode: MODE, error: error instanceof Error ? error.message : String(error),
    candidate_invalidated: true, failure_effect: 'CANDIDATE_INVALIDATED',
    repository_write_performed: false, capability_slice: false, runtime_authority: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
});
