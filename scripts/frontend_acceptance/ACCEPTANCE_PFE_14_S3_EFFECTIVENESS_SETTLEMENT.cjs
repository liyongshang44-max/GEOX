'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const CURRENT = 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json';
const HANDOFF = 'docs/frontend-productization/PFE-14-S3-HANDOFF.json';
const BOUNDARY = 'docs/frontend-productization/PFE-14-S3-EFFECTIVENESS-SETTLEMENT-BOUNDARY.json';
const MCFT09 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-CURRENT-AUTHORITY-V1.json';
const OUTPUT = path.join(ROOT, 'acceptance-output/PFE_14_S3_EFFECTIVENESS_SETTLEMENT_RESULT.json');

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const check = (value, message) => { if (!value) throw new Error(message); };
const same = (actual, expected, message) => assert.deepEqual(actual, expected, message);
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));

function writeResult(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const current = json(CURRENT);
  const handoff = json(HANDOFF);
  const boundary = json(BOUNDARY);
  const mcft09 = json(MCFT09);

  const baseSha = process.env.PFE14_BASE_SHA || boundary.base_main_sha;
  check(/^[0-9a-f]{40}$/.test(baseSha), 'PFE14_S3_SETTLEMENT_BASE_SHA_INVALID');
  git('cat-file', '-e', `${baseSha}^{commit}`);

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`).split(/\r?\n/).filter(Boolean);
  same(sorted(changedFiles), sorted(boundary.expected_changed_files), 'PFE14_S3_SETTLEMENT_CHANGED_FILES_MISMATCH');
  check(changedFiles.length === boundary.expected_changed_file_count, 'PFE14_S3_SETTLEMENT_FILE_COUNT_MISMATCH');
  for (const file of changedFiles) {
    check(boundary.allowed_prefixes.some((prefix) => file.startsWith(prefix)), `PFE14_S3_SETTLEMENT_OUTSIDE_ALLOWLIST:${file}`);
    check(!boundary.forbidden_prefixes.some((prefix) => file.startsWith(prefix)), `PFE14_S3_SETTLEMENT_FORBIDDEN_PREFIX:${file}`);
    check(!boundary.forbidden_exact_files.includes(file), `PFE14_S3_SETTLEMENT_FORBIDDEN_FILE:${file}`);
  }

  check(current.slice_id === 'PFE-14.S4', 'PFE14_S3_SETTLEMENT_CURRENT_SLICE_MISMATCH');
  check(current.status === 'S4_BLOCKED_WAITING_MCFT09_SCHEDULER_AND_EVIDENCE_READ_CONTRACT', 'PFE14_S3_SETTLEMENT_STATUS_MISMATCH');
  check(current.base_main_sha === baseSha, 'PFE14_S3_SETTLEMENT_BASE_MISMATCH');
  check(current.s3_merge_sha === baseSha, 'PFE14_S3_SETTLEMENT_S3_MERGE_MISMATCH');
  for (const key of ['s0_effective', 's1_effective', 's2_effective', 's3_effective']) {
    check(current[key] === true, `PFE14_S3_SETTLEMENT_EFFECTIVENESS_MISSING:${key}`);
  }
  check(current.s4_dependency_recheck_authorized === true, 'PFE14_S4_DEPENDENCY_RECHECK_NOT_AUTHORIZED');
  for (const key of [
    's4_contract_mapping_authorized', 's4_page_source_authorized', 's4_route_source_authorized',
    's4_api_client_source_authorized', 's4_runtime_claim_authorized', 'shadow_online_label_authorized',
    'authoritative_runtime_context_authorized', 'scheduler_ui_authorized', 'evidence_freshness_ui_authorized',
    'backend_source_authorized', 'database_delta_authorized', 'package_delta_authorized', 'workflow_delta_authorized',
    'controlled_action_authorized', 'ao_act_authorized', 'dispatch_authorized', 'model_activation_authorized',
    'production_launch_authorized', 'commercial_launch_authorized', 'candidate_declaration_authorized', 's4_effective'
  ]) {
    check(current[key] === false, `PFE14_S4_AUTHORITY_MUST_REMAIN_FALSE:${key}`);
  }

  check(mcft09.capability_line_id === 'MCFT-CAP-09', 'PFE14_S4_MCFT09_AUTHORITY_MISSING');
  check(mcft09.status === 'PRE_CANDIDATE_GOVERNANCE_FOUNDATION', 'PFE14_S4_MCFT09_STATUS_DRIFT');
  check(mcft09.slice_id === 'MCFT-CAP-09.S0', 'PFE14_S4_MCFT09_SLICE_DRIFT');
  check(mcft09.implementation_authorized === false, 'PFE14_S4_MCFT09_IMPLEMENTATION_AUTHORIZED');
  check(mcft09.runtime_source_authorized === false, 'PFE14_S4_MCFT09_RUNTIME_SOURCE_AUTHORIZED');
  check(mcft09.background_scheduler_authorized === false, 'PFE14_S4_MCFT09_SCHEDULER_AUTHORIZED');
  check(mcft09.canonical_write_authorized === false, 'PFE14_S4_MCFT09_CANONICAL_WRITE_AUTHORIZED');

  check(current.dependency_snapshot.mcft09_status === mcft09.status, 'PFE14_S4_DEPENDENCY_STATUS_SNAPSHOT_MISMATCH');
  check(current.dependency_snapshot.mcft09_slice === mcft09.slice_id, 'PFE14_S4_DEPENDENCY_SLICE_SNAPSHOT_MISMATCH');
  check(current.dependency_snapshot.scheduler_read_contract_present === false, 'PFE14_S4_SCHEDULER_CONTRACT_FALSE_CLAIM');
  check(current.dependency_snapshot.evidence_availability_read_contract_present === false, 'PFE14_S4_EVIDENCE_CONTRACT_FALSE_CLAIM');
  check(current.first_legal_next_action === 'MCFT_CAP_09_PROVIDE_AUTHORIZED_SCHEDULER_AND_EVIDENCE_AVAILABILITY_READ_CONTRACT', 'PFE14_S4_NEXT_ACTION_MISMATCH');

  check(handoff.status === 'S0_THROUGH_S3_EFFECTIVE_S4_DEPENDENCY_BLOCKED', 'PFE14_S3_HANDOFF_STATUS_MISMATCH');
  check(handoff.completed_slices.length === 4, 'PFE14_S3_HANDOFF_COMPLETED_SLICE_COUNT_MISMATCH');
  same(handoff.completed_slices.map((item) => item.slice), ['PFE-14.S0', 'PFE-14.S1', 'PFE-14.S2', 'PFE-14.S3'], 'PFE14_S3_HANDOFF_SLICE_ORDER_MISMATCH');
  check(handoff.completed_slices[3].merge_sha === baseSha, 'PFE14_S3_HANDOFF_S3_MERGE_MISMATCH');
  check(handoff.frontend_facts.primary_navigation.length === 2, 'PFE14_S3_HANDOFF_NAV_COUNT_MISMATCH');
  check(handoff.frontend_facts.runtime_context_default_source === 'governed-static-nonclaim', 'PFE14_S3_HANDOFF_CONTEXT_SOURCE_MISMATCH');
  check(handoff.validation.s3_typecheck_build_frontend_audit_full_acceptance === 'PASS', 'PFE14_S3_HANDOFF_VALIDATION_MISSING');
  check(handoff.runtime_dependency.dependency_satisfied === false, 'PFE14_S4_HANDOFF_DEPENDENCY_FALSE_CLAIM');
  check(handoff.runtime_dependency.background_scheduler_authorized === false, 'PFE14_S4_HANDOFF_SCHEDULER_FALSE_CLAIM');
  check(handoff.forbidden_until_dependency.includes('display SHADOW_ONLINE as current mode'), 'PFE14_S4_SHADOW_FORBIDDEN_RULE_MISSING');
  check(handoff.forbidden_until_dependency.includes('compute freshness verdict in frontend'), 'PFE14_S4_FRESHNESS_INFERENCE_RULE_MISSING');

  check(boundary.s3_effective === true, 'PFE14_S3_SETTLEMENT_EFFECTIVE_FLAG_MISSING');
  check(boundary.s4_dependency_satisfied === false, 'PFE14_S4_DEPENDENCY_FALSE_CLAIM');
  check(boundary.s4_implementation_authorized === false, 'PFE14_S4_IMPLEMENTATION_FALSE_CLAIM');
  check(boundary.candidate_declaration === false, 'PFE14_S3_SETTLEMENT_CANDIDATE_DECLARATION');
  for (const [key, value] of Object.entries(boundary.delta_assertions)) {
    check(value === 0, `PFE14_S3_SETTLEMENT_NONZERO_DELTA:${key}`);
  }

  const result = {
    status: 'PASS',
    change_class: boundary.change_class,
    base_main_sha: baseSha,
    head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    changed_files: sorted(changedFiles),
    completed_slices: handoff.completed_slices.map((item) => item.slice),
    s3_effective: true,
    s4_dependency_satisfied: false,
    mcft09_status: mcft09.status,
    mcft09_background_scheduler_authorized: false,
    frontend_source_delta: 0,
    runtime_claim_delta: 0,
    completion_claim: boundary.completion_claim,
    first_legal_next_action: boundary.first_legal_next_action
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const result = { status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  writeResult(result);
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
}
