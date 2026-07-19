// Purpose: enforce live repository-wide MCFT delivery policy against the exact current candidate head.
// Boundary: delivery governance only; no Runtime, canonical, projection, migration, activation or capability authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_DELIVERY_POLICY_V1_RESULT.json');
const POLICY_PATH = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V1.json';
const RELEASE_PATH = 'docs/digital_twin/mcft/MCFT-RELEASE-LANE-V1.json';
const POLICY_WORKFLOW = '.github/workflows/mcft-delivery-policy-v1.yml';
const CANDIDATE_WORKFLOW = '.github/workflows/mcft-candidate-declaration-integrity.yml';
const RELEASE_WORKFLOW = '.github/workflows/mcft-release-lane-v1.yml';

function text(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(text(relative));
}

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function validatePolicyShape(policy) {
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V1');
  assert.equal(policy.policy_revision, '1.1.0');
  assert.equal(policy.record_status, 'ACTIVE_REPOSITORY_WIDE_POLICY');
  assert.equal(policy.scope, 'ALL_MCFT_CAPABILITY_LINES');
  assert.equal(policy.enforcement_mode, 'CURRENT_CANDIDATE_HEAD');
  assert.equal(policy.capability_slice, false);
  assert.equal(policy.runtime_authority, false);
  assert.equal(policy.historical_revision_validation.fixed_historical_checkout_in_live_gate_allowed, false);
  assert.equal(policy.enforcement.reject_live_gate_fixed_historical_checkout, true);
  assert.equal(policy.enforcement.reject_branch_transport_workflow, true);
  assert.equal(policy.enforcement.reject_proof_only_pr_workflow, true);
  assert.equal(policy.candidate_rule_extension.script_change_required_for_new_slice, false);
  assert.equal(policy.candidate_rule_extension.workflow_subscription_change_required_for_new_focused_workflow, false);
  assert.ok(Array.isArray(policy.candidate_declaration_integrity_rules));
  assert.ok(policy.candidate_declaration_integrity_rules.length >= 1);
  const requiredRuleFields = policy.candidate_declaration_contract.required_rule_fields;
  for (const rule of policy.candidate_declaration_integrity_rules) {
    for (const field of requiredRuleFields) assert.ok(Object.hasOwn(rule, field), `RULE_FIELD_MISSING:${rule.rule_id}:${field}`);
    assert.equal(rule.capability_slice, false);
    assert.equal(rule.runtime_authority, false);
    assert.ok(Array.isArray(rule.semantic_snapshot_files) && rule.semantic_snapshot_files.length > 0);
  }
}

function validateActiveWorkflows() {
  const policyWorkflow = text(POLICY_WORKFLOW);
  const candidateWorkflow = text(CANDIDATE_WORKFLOW);
  const releaseWorkflow = text(RELEASE_WORKFLOW);
  assert.doesNotMatch(policyWorkflow, /56fd50500a14cc8b5d3743306da85f9d0055abe0/);
  assert.doesNotMatch(policyWorkflow, /Resolve frozen revision validation ref/);
  assert.match(policyWorkflow, /Checkout exact current candidate head/);
  assert.match(policyWorkflow, /CURRENT_CANDIDATE_HEAD/);
  assert.doesNotMatch(candidateWorkflow, /workflow_run:/);
  assert.match(candidateWorkflow, /generic exact-head candidate declaration integrity/i);
  assert.match(releaseWorkflow, /merge_group:/);
  assert.match(releaseWorkflow, /group: mcft-release-lane-main/);
  assert.match(releaseWorkflow, /cancel-in-progress: false/);
}

function main() {
  const mode = process.argv[2] || '--validate-current-candidate';
  assert.equal(mode, '--validate-current-candidate');
  const policy = json(POLICY_PATH);
  const release = json(RELEASE_PATH);
  validatePolicyShape(policy);
  validateActiveWorkflows();
  assert.equal(release.release_lane_id, 'MCFT-RELEASE-LANE-V1');
  assert.equal(release.capability_slice, false);
  assert.equal(release.runtime_authority, false);
  assert.equal(release.serialization.merge_group_check_required, true);
  assert.equal(release.effectiveness_boundary.repository_side_implementation, 'ESTABLISHED');
  assert.equal(release.effectiveness_boundary.platform_required_check_enforcement, 'NOT_ESTABLISHED');

  const baseline = String(process.env.MCFT_DELIVERY_POLICY_BASE_REF || 'HEAD^').trim();
  const expectedHead = String(process.env.MCFT_DELIVERY_POLICY_HEAD_SHA || '').trim();
  const draft = String(process.env.MCFT_DELIVERY_POLICY_PR_DRAFT || 'false') === 'true';
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const actualHead = git(['rev-parse', 'HEAD']);
  if (expectedHead) assert.equal(actualHead, expectedHead, 'DELIVERY_POLICY_HEAD_MISMATCH');
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  const limit = draft ? policy.draft_pr_commit_limit : policy.ready_pr_commit_limit;
  assert.ok(commitCount <= limit, `DELIVERY_POLICY_COMMIT_LIMIT_EXCEEDED:${commitCount}:${limit}`);

  for (const file of changed) {
    const lower = file.toLowerCase();
    for (const token of policy.forbidden_transport_path_tokens) {
      assert.equal(lower.includes(token.toLowerCase()), false, `FORBIDDEN_TRANSPORT_PATH:${file}:${token}`);
    }
  }

  const messages = git(['log', '--format=%s', `${baseline}..HEAD`]).split(/\r?\n/).filter(Boolean);
  if (!draft) {
    for (const message of messages) {
      for (const source of policy.forbidden_ready_commit_message_patterns) {
        assert.equal(new RegExp(source, 'i').test(message), false, `READY_COMMIT_MESSAGE_INVALID:${message}:${source}`);
      }
    }
  }

  const result = {
    schema_version: 'geox_mcft_delivery_policy_v1_result_v2',
    status: 'PASS',
    policy_id: policy.policy_id,
    policy_revision: policy.policy_revision,
    enforcement_mode: policy.enforcement_mode,
    baseline,
    head_sha: actualHead,
    changed_files: changed,
    changed_file_count: changed.length,
    commit_count: commitCount,
    commit_limit: limit,
    pr_draft: draft,
    fixed_historical_checkout_used: false,
    branch_transport_workflow_allowed: false,
    proof_only_pr_workflow_allowed: false,
    generic_candidate_rule_count: policy.candidate_declaration_integrity_rules.length,
    release_lane_repository_implemented: true,
    release_lane_platform_enforcement_established: false,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_delivery_policy_v1_result_v2',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    enforcement_mode: 'CURRENT_CANDIDATE_HEAD',
    fixed_historical_checkout_used: false,
    capability_slice: false,
    runtime_authority: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
