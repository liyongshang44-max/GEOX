#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_MERGE_GROUP_RELEASE_LANE_V1_RESULT.json');
const POLICY = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json');
const REGISTRY = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');

function git(args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function write(value) { fs.mkdirSync(path.dirname(RESULT), { recursive: true }); fs.writeFileSync(RESULT, `${JSON.stringify(value, null, 2)}\n`); }
function isSha(value) { return /^[0-9a-f]{40}$/.test(String(value)); }

try {
  const eventName = String(process.env.GITHUB_EVENT_NAME || '').trim();
  const ref = String(process.env.GITHUB_REF || '').trim();
  const expectedSha = String(process.env.GITHUB_SHA || '').trim();
  assert.equal(eventName, 'merge_group', 'MERGE_GROUP_EVENT_REQUIRED');
  assert.equal(ref.includes('gh-readonly-queue/main/'), true, 'MERGE_GROUP_TARGET_NOT_MAIN');
  assert.equal(isSha(expectedSha), true, 'MERGE_GROUP_GITHUB_SHA_INVALID');
  const head = git(['rev-parse', 'HEAD']);
  assert.equal(head, expectedSha, 'MERGE_GROUP_CHECKOUT_NOT_EXACT_GITHUB_SHA');
  const parents = git(['rev-list', '--parents', '-n', '1', 'HEAD']).split(/\s+/).slice(1);
  assert.ok(parents.length >= 1, 'MERGE_GROUP_HEAD_HAS_NO_PARENT');
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  assert.equal(policy.release_lane.required_triggers.includes('merge_group'), true, 'POLICY_MERGE_GROUP_TRIGGER_NOT_REQUIRED');
  assert.equal(policy.repository_setting_boundary.branch_ruleset_verified, false, 'REPOSITORY_RULESET_MUST_NOT_BE_FALSELY_CLAIMED_VERIFIED');
  assert.equal(registry.default_behavior, 'FAIL_CLOSED');
  const changed = git(['diff', '--name-only', `${parents[0]}..HEAD`]).split(/\r?\n/).filter(Boolean);
  const result = {
    schema_version: 'geox_mcft_merge_group_release_lane_v1_result_v1',
    status: 'PASS',
    subject_commit: head,
    subject_ref: ref,
    parent_count: parents.length,
    parent_commits: parents,
    parent_changed_file_count: changed.length,
    exact_sha_checkout: true,
    target_branch: 'main',
    policy_integrity: 'PASS',
    registry_integrity: 'PASS',
    repository_write_performed: false,
    operational_release_authority_claimed: false
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const result = { schema_version: 'geox_mcft_merge_group_release_lane_v1_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result); console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
}
