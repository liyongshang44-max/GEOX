#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const PROFILE_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-MAIN-RULESET-PROFILE-V1.json');
const TRUSTED_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-TRUSTED-ENFORCEMENT-OPERATIONAL-VERIFICATION-V1.json');
const RESULT_PATH = path.join(ROOT, 'acceptance-output/MCFT_MAIN_RULESET_READINESS_V1_RESULT.json');

const WORKFLOWS = {
  candidate: path.join(ROOT, '.github/workflows/mcft-candidate-declaration-integrity-v2.yml'),
  release: path.join(ROOT, '.github/workflows/mcft-release-lane-v1.yml'),
  delivery: path.join(ROOT, '.github/workflows/mcft-delivery-policy-v2.yml'),
  readiness: path.join(ROOT, '.github/workflows/mcft-main-ruleset-readiness-v1.yml'),
  ci: path.join(ROOT, '.github/workflows/ci.yml'),
};

const ENFORCEMENT_STATES = new Map([
  ['ADMIN_CONFIGURATION_PENDING', { configured: false, verified: false }],
  ['ACTIVE_OPERATIONAL_VERIFICATION_IN_PROGRESS', { configured: true, verified: false }],
  ['ACTIVE_OPERATIONALLY_VERIFIED', { configured: true, verified: true }],
]);

function read(filePath) { return fs.readFileSync(filePath, 'utf8'); }
function loadJson(filePath) { return JSON.parse(read(filePath)); }
function writeResult(value) {
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function pullRequestBlockHasFilter(source) {
  const match = source.match(/^on:\s*\n([\s\S]*?)(?=^[^\s]|\Z)/m);
  const onBlock = match ? match[1] : '';
  const pr = onBlock.match(/^  pull_request:\s*\n([\s\S]*?)(?=^  [a-zA-Z_]+:|\Z)/m);
  if (!pr) return false;
  return /^\s{4}(paths|paths-ignore|branches|branches-ignore):/m.test(pr[1]);
}
function jobIds(source) {
  const match = source.match(/^jobs:\s*\n([\s\S]*)$/m);
  if (!match) return [];
  return [...match[1].matchAll(/^  ([a-zA-Z0-9_-]+):\s*$/gm)].map((m) => m[1]);
}
function assertConfiguredProfile(profile) {
  assert.equal(profile.ruleset_name, 'main-strict-delivery-v1');
  assert.deepEqual(profile.allowed_merge_methods, ['merge']);
  assert.ok(profile.configuration_observation && typeof profile.configuration_observation === 'object');
  for (const field of [
    'ruleset_ui_created', 'ruleset_active', 'target_resolves_to_main', 'required_checks_bound',
    'strict_up_to_date_selected', 'bypass_list_empty', 'merge_only_selected',
  ]) assert.equal(profile.configuration_observation[field], true, `CONFIGURATION_OBSERVATION_NOT_TRUE:${field}`);
}

function main() {
  const profile = loadJson(PROFILE_PATH);
  const trusted = loadJson(TRUSTED_PATH);
  assert.equal(profile.profile_id, 'MCFT-MAIN-RULESET-PROFILE-V1');
  assert.equal(profile.target_branch, 'main');
  assert.equal(profile.enforcement_phase, 'STRICT_UP_TO_DATE_PHASE_1');
  assert.equal(profile.require_pull_request_before_merging, true);
  assert.equal(profile.require_status_checks_to_pass, true);
  assert.equal(profile.require_branches_to_be_up_to_date_before_merging, true);
  assert.equal(profile.require_merge_queue, false);
  assert.equal(profile.block_force_pushes, true);
  assert.equal(profile.block_deletions, true);
  assert.deepEqual(profile.allow_bypass_actors, []);
  assert.equal(profile.configuration_nonclaims.mcft_cap_07_authorized, false);

  const expectedState = ENFORCEMENT_STATES.get(profile.enforcement_status);
  assert.ok(expectedState, `RULESET_ENFORCEMENT_STATUS_INVALID:${profile.enforcement_status}`);
  const configured = profile.configuration_nonclaims.ruleset_currently_configured;
  const verified = profile.configuration_nonclaims.branch_protection_currently_verified;
  assert.equal(configured, expectedState.configured, 'RULESET_CONFIGURED_STATE_MISMATCH');
  assert.equal(verified, expectedState.verified, 'RULESET_VERIFIED_STATE_MISMATCH');
  if (configured) assertConfiguredProfile(profile);

  const immediate = profile.required_status_checks_immediate;
  const conditional = profile.required_status_checks_after_ui_subject_verification;
  const allRequired = [...immediate, ...conditional];
  assert.equal(allRequired.length, 8, 'RULESET_REQUIRED_CHECK_COUNT_INVALID');
  assert.equal(new Set(allRequired).size, allRequired.length, 'RULESET_REQUIRED_CHECK_NAMES_MUST_BE_UNIQUE');

  const sources = Object.fromEntries(Object.entries(WORKFLOWS).map(([key, value]) => [key, read(value)]));
  for (const key of ['candidate', 'release', 'delivery', 'readiness']) {
    assert.equal(pullRequestBlockHasFilter(sources[key]), false, `${key.toUpperCase()}_PULL_REQUEST_FILTER_FORBIDDEN`);
  }
  const expectedJobs = {
    candidate: ['mcft-candidate-integrity-pr-selftest', 'mcft-candidate-integrity-enforce-current-pr', 'mcft-candidate-integrity-merge-group'],
    release: ['mcft-release-lane-pr-selftest', 'mcft-release-lane-enforce-current-pr', 'mcft-release-lane-merge-group'],
    delivery: ['mcft-delivery-policy-v2-contract'],
    readiness: ['mcft-main-ruleset-readiness-v1'],
    ci: ['build-test', 'acceptance'],
  };
  const observed = [];
  for (const [key, expected] of Object.entries(expectedJobs)) {
    const jobs = jobIds(sources[key]);
    for (const id of expected) assert.ok(jobs.includes(id), `EXPECTED_JOB_MISSING:${key}:${id}`);
    observed.push(...jobs);
  }
  const selectedObserved = observed.filter((name) => allRequired.includes(name));
  assert.equal(new Set(selectedObserved).size, selectedObserved.length, 'SELECTED_REQUIRED_JOB_NAME_COLLISION');
  for (const check of allRequired) assert.ok(observed.includes(check), `REQUIRED_CHECK_NOT_EMITTED:${check}`);

  assert.match(sources.candidate, /pull_request_target:/);
  assert.match(sources.release, /pull_request_target:/);
  assert.doesNotMatch(sources.candidate, /permissions:\s*[\s\S]*contents:\s*write/);
  assert.doesNotMatch(sources.release, /permissions:\s*[\s\S]*contents:\s*write/);
  assert.match(sources.candidate, /group:\s*mcft-candidate-integrity-v2-\$\{\{ github\.event_name \}\}-/);
  assert.match(sources.release, /group:\s*mcft-release-lane-v1-\$\{\{ github\.event_name \}\}-/);

  assert.equal(profile.trusted_enforcement_verification_ref, 'docs/digital_twin/mcft/MCFT-TRUSTED-ENFORCEMENT-OPERATIONAL-VERIFICATION-V1.json');
  assert.equal(profile.trusted_enforcement_operational_verification.negative_fail_closed_verified, true);
  assert.equal(profile.trusted_enforcement_operational_verification.negative_merge_block_verified, true);
  assert.equal(profile.trusted_enforcement_operational_verification.positive_all_eight_required_checks_verified, true);
  assert.equal(profile.remaining_authority_boundary.trusted_enforcement_required_checks_bound, true);
  assert.equal(profile.remaining_authority_boundary.operational_release_authority_established, true);
  assert.equal(profile.remaining_authority_boundary.next_admin_action, null);

  assert.equal(trusted.record_status, 'FINAL_CANDIDATE_EFFECTIVE_WHEN_PRESENT_ON_MAIN');
  assert.equal(trusted.verification_pull_request, 2599);
  assert.equal(trusted.negative_phase.trusted_required_checks, 'BOTH_FAILING');
  assert.equal(trusted.negative_phase.merge_attempt_http_status, 405);
  assert.equal(trusted.positive_phase.required_checks, 'ALL_SUCCESS');
  assert.equal(trusted.observations.negative_probe_absent_from_final_tree, true);
  assert.equal(trusted.effective_projection_when_present_on_main.operational_release_authority_established, true);
  assert.equal(trusted.authority_boundary.mcft_cap_07_authorized, false);
  assert.equal(fs.existsSync(path.join(ROOT, 'docs/digital_twin/mcft/cap_06/MCFT-TRUSTED-ENFORCEMENT-NEGATIVE-PROBE.json')), false, 'NEGATIVE_PROBE_MUST_NOT_ENTER_FINAL_TREE');

  const result = {
    schema_version: 'geox_mcft_main_ruleset_readiness_v1_result_v3',
    status: 'PASS',
    profile_id: profile.profile_id,
    target_branch: profile.target_branch,
    enforcement_phase: profile.enforcement_phase,
    enforcement_status: profile.enforcement_status,
    required_check_count: allRequired.length,
    immediate_required_checks: immediate,
    conditional_required_checks: conditional,
    selected_required_check_name_collision_count: 0,
    pull_request_path_filter_count_on_required_workflows: 0,
    cross_event_concurrency_collision_count: 0,
    strict_up_to_date_required: true,
    merge_queue_required: false,
    ruleset_configuration_recorded_in_profile: configured,
    branch_protection_operationally_verified_in_profile: verified,
    trusted_enforcement_required_checks_bound: true,
    trusted_enforcement_fail_closed_verified: true,
    operational_release_authority_established_on_effective_merge: true,
    repository_write_performed: false,
    runtime_authority: false,
    mcft_cap_07_authorized: false,
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try { main(); } catch (error) {
  const result = {
    schema_version: 'geox_mcft_main_ruleset_readiness_v1_result_v3',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    repository_write_performed: false,
    runtime_authority: false,
    mcft_cap_07_authorized: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
