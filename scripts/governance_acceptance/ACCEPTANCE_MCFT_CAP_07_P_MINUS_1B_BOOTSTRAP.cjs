#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_P_MINUS_1B_BOOTSTRAP_RESULT.json');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const json = (relative) => JSON.parse(read(relative));
const exists = (relative) => fs.existsSync(path.join(ROOT, relative));
const write = (value) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

try {
  const policyPath = 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json';
  const registryPath = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
  const signalPath = 'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
  const detectorPath = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2.cjs';
  const enforcementWorkflowPath = '.github/workflows/mcft-candidate-declaration-integrity-v2.yml';
  const selftestWorkflowPath = '.github/workflows/mcft-candidate-declaration-selftest-v2.yml';
  const cap07StatusPath = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json';

  for (const item of [
    policyPath,
    registryPath,
    signalPath,
    detectorPath,
    enforcementWorkflowPath,
    selftestWorkflowPath,
  ]) {
    assert.equal(exists(item), true, `P1B_REQUIRED_FILE_MISSING:${item}`);
  }

  const policy = json(policyPath);
  const registry = json(registryPath);
  const signal = json(signalPath);
  const detector = read(detectorPath);
  const enforcementWorkflow = read(enforcementWorkflowPath);
  const selftestWorkflow = read(selftestWorkflowPath);

  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(policy.workflow_security.pull_request_target_executes_default_branch_policy_only, true);
  assert.equal(registry.registry_id, 'MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1');
  assert.equal(registry.registry_revision, '1.1');
  assert.equal(registry.delivery_candidate_signal_contract_ref, signalPath);
  assert.equal(signal.contract_id, 'MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1');
  assert.equal(signal.string_matching_mode, 'EXACT_ENUM_ONLY');
  assert.equal(signal.boolean_matching_mode, 'EXACT_FIELD_NAME_OR_EXPLICIT_SLICE_PATTERN_AND_TRUE_ONLY');
  assert.equal(signal.pr_modified_registry_trusted_for_same_pr, false);
  assert.equal(signal.domain_term_non_signals.includes('Calibration Candidate'), true);
  assert.equal(signal.domain_term_non_signals.includes('twin_calibration_candidate_projection_v1'), true);
  assert.equal(signal.explicit_candidate_status_values.includes('AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'), true);

  const cap06 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-06');
  const cap07 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-07');
  assert.ok(cap06, 'P1B_CAP06_REGISTRY_ENTRY_MISSING');
  assert.ok(cap07, 'P1B_CAP07_REGISTRY_ENTRY_MISSING');
  assert.equal(cap06.candidate_declaration_enabled, false);
  assert.equal(cap07.candidate_declaration_enabled, true);
  assert.equal(cap07.current_candidate_authority, false);
  assert.equal(cap07.implementation_authorized, false);
  assert.equal(cap07.runtime_source_authorized, false);
  assert.equal(cap07.canonical_write_authorized, false);
  assert.equal(cap07.authoritative_candidate_status_paths.includes(cap07StatusPath), true);
  const s0Rule = cap07.candidate_transition_fields.find((entry) => entry.status_file === cap07StatusPath && entry.field_path === 'status');
  assert.ok(s0Rule, 'P1B_CAP07_S0_STATUS_RULE_MISSING');
  assert.equal(s0Rule.allowed_candidate_values.includes('AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE'), true);

  assert.equal(detector.includes('collectExplicitDeliveryCandidateSignals'), true);
  assert.equal(detector.includes('REGISTRY_DRIVEN_EXPLICIT_SIGNAL_CONTRACT'), true);
  assert.equal(detector.includes('/candidate/i.test(current)'), false, 'P1B_BROAD_DOMAIN_STRING_HEURISTIC_FORBIDDEN');
  assert.equal(detector.includes('CANDIDATE_STATUS_FALLBACK'), false, 'P1B_INLINE_FALLBACK_STATUS_SET_FORBIDDEN');
  assert.equal(detector.includes('CANDIDATE_DECLARATION_DISABLED'), true);

  assert.match(enforcementWorkflow, /^name:\s+mcft-candidate-declaration-integrity-v2$/m);
  assert.match(enforcementWorkflow, /^  pull_request_target:\s*$/m);
  assert.doesNotMatch(enforcementWorkflow, /^  pull_request:\s*$/m);
  assert.match(enforcementWorkflow, /name:\s+Checkout trusted default-branch policy/);
  assert.match(enforcementWorkflow, /ref:\s+\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}/);

  assert.match(selftestWorkflow, /^name:\s+mcft-candidate-declaration-selftest-v2$/m);
  assert.match(selftestWorkflow, /^  pull_request:\s*$/m);
  assert.doesNotMatch(selftestWorkflow, /^  pull_request_target:\s*$/m);
  assert.equal(selftestWorkflow.includes(`- '${signalPath}'`), true, 'P1B_SIGNAL_CONTRACT_PUSH_TRIGGER_MISSING');

  for (const workflow of [enforcementWorkflow, selftestWorkflow]) {
    assert.equal(/contents:\s*write/.test(workflow), false);
    assert.equal(workflow.includes('persist-credentials: false'), true);
  }

  const selftest = spawnSync(process.execPath, [path.join(ROOT, detectorPath), '--selftest'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (selftest.status !== 0) throw new Error(`P1B_DETECTOR_SELFTEST_FAILED:${selftest.stderr || selftest.stdout}`);
  const detectorResult = json('acceptance-output/MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2_RESULT.json');
  assert.equal(detectorResult.status, 'PASS');
  assert.equal(detectorResult.explicit_delivery_signal_only, true);
  assert.equal(detectorResult.domain_candidate_term_separation_verified, true);
  assert.equal(detectorResult.array_traversal_verified, true);
  assert.equal(detectorResult.cap07_minimal_registry_bootstrap_verified, true);
  assert.equal(detectorResult.cap06_candidate_declaration_disabled, true);
  assert.equal(detectorResult.pr_modified_registry_trusted_for_same_pr, false);

  const result = {
    schema_version: 'geox_mcft_cap_07_p_minus_1b_bootstrap_result_v1',
    status: 'PASS',
    detector_domain_delivery_separation: 'PASS',
    explicit_status_detection: 'PASS',
    explicit_boolean_detection: 'PASS',
    nested_array_detection: 'PASS',
    unregistered_delivery_signal_fail_closed_preserved: true,
    trusted_default_branch_registry: 'PASS',
    candidate_integrity_workflow_identity_split: true,
    pr_modified_registry_trusted_for_same_pr: false,
    cap07_minimal_registry_bootstrap: 'PASS',
    cap07_implementation_authorized: false,
    runtime_authority_delta: 0,
    canonical_write_authority_delta: 0,
    capability_slice: false,
  };
  write(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_07_p_minus_1b_bootstrap_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}
