// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY.cjs
// Purpose: validate S5 entry exclusively from machine-readable contracts and structured preflight evidence.
// Boundary: no source-sentence matching, no runtime execution, no database access, no canonical write, no S5 implementation authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_ENTRY_PREFLIGHT_INPUT.json');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S5_ENTRY_GOVERNANCE_RESULT.json');
const CONTRACT_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json');
const GRAPH_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json');
const REQUIRED_STAGES = [
  'TYPECHECK',
  'BUILD',
  'DOMAIN_ACCEPTANCE',
  'POSTGRESQL_EXACT_REF_ACCEPTANCE',
  'FORMAL_COMPOSITION',
  'S2_COMPATIBILITY',
  'S3_REGRESSION'
];
const EXPECTED_CORRECTIVE_FILES = [
  '.github/workflows/mcft-cap-06-s4-effectiveness-s5-authorization.yml',
  '.github/workflows/mcft-cap-06-s5-entry-controls.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK-AMENDMENT-S5-ENTRY-CONTROLS-V1.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_AUTHORIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY.cjs',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_ENTRY_PREFLIGHT.cjs'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeResult(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function baselineRef() {
  const explicit = String(process.env.MCFT_CAP_06_S5_BASELINE_REF || '').trim();
  if (explicit) {
    git(['cat-file', '-e', `${explicit}^{commit}`]);
    return explicit;
  }
  git(['cat-file', '-e', 'origin/main^{commit}']);
  return git(['merge-base', 'HEAD', 'origin/main']);
}

function main() {
  const contract = readJson(CONTRACT_PATH);
  const graph = readJson(GRAPH_PATH);
  const input = readJson(INPUT_PATH);
  const baseline = baselineRef();
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  const commitCount = Number(git(['rev-list', '--count', `${baseline}..HEAD`]));
  const messagesRaw = git(['log', '--format=%s', `${baseline}..HEAD`]);
  const messages = messagesRaw ? messagesRaw.split(/\r?\n/).filter(Boolean) : [];

  assert.deepEqual(changed, [...EXPECTED_CORRECTIVE_FILES].sort());
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);

  assert.equal(contract.schema_version, 'geox_mcft_cap_06_s5_entry_prerequisite_v1');
  assert.equal(contract.status, 'AUTHORIZED_NOT_STARTED');
  assert.equal(contract.s5_authorized, false);
  assert.equal(contract.runtime_source_authorized, false);
  assert.equal(contract.canonical_write_authorized, false);
  assert.equal(contract.governance_evidence_policy.structured_json_only, true);
  assert.equal(contract.governance_evidence_policy.source_sentence_matching_allowed, false);
  assert.equal(contract.governance_evidence_policy.stdout_pass_marker_as_authority_allowed, false);
  assert.deepEqual(contract.required_preflight.required_stages, [...REQUIRED_STAGES, 'STRUCTURED_GOVERNANCE_GATE']);

  assert.equal(graph.schema_version, 'geox_mcft_cap_06_s5_entry_authority_graph_v1');
  assert.equal(graph.status, 'FROZEN');
  assert.equal(graph.resolution_policy.mode, 'EXACT_REF_HASH_ONLY');
  assert.equal(graph.resolution_policy.transaction, 'ONE_REPEATABLE_READ_READ_ONLY_TRANSACTION');
  assert.equal(graph.resolution_policy.canonical_write_count, 0);
  assert.equal(graph.repository_authority.alternative_s5_or_s6_graph_authority_allowed, false);
  assert.deepEqual(graph.frozen_display_paths, [
    ['residual', 'forecast', 'forecast_config', 'source_posterior', 'forecast_evidence_window'],
    ['residual', 'residual_config', 'assimilation', 'observation_posterior', 'observation_evidence_window', 'selected_observation']
  ]);

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s5_entry_preflight_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.canonical_write_count, 0);
  assert.equal(input.model_activation_count, 0);
  assert.equal(input.active_config_switch_count, 0);
  assert.equal(input.state_mutation_count, 0);
  assert.equal(input.checkpoint_mutation_count, 0);
  for (const stageId of REQUIRED_STAGES) {
    const stage = input.stages.find((item) => item.stage_id === stageId);
    assert.ok(stage, `S5_ENTRY_STAGE_MISSING:${stageId}`);
    assert.equal(stage.status, 'PASS', `S5_ENTRY_STAGE_NOT_PASS:${stageId}`);
    assert.equal(stage.exit_code, 0, `S5_ENTRY_STAGE_EXIT_NONZERO:${stageId}`);
  }

  const protectedPaths = contract.protected_predecessor_contract_policy.protected_paths;
  const protectedDelta = changed.filter((file) => protectedPaths.includes(file));
  assert.deepEqual(protectedDelta, [], 'S5_PREDECESSOR_CONTRACT_CHANGE_REQUIRES_SEPARATE_PR');

  const historyPolicy = contract.draft_history_policy;
  assert.ok(commitCount <= historyPolicy.maximum_logical_commits, 'S5_ENTRY_COMMIT_HISTORY_NOT_CLEAN');
  for (const message of messages) {
    for (const forbidden of historyPolicy.forbidden_commit_message_patterns) {
      assert.equal(message.toLowerCase().includes(forbidden.toLowerCase()), false, `S5_ENTRY_FORBIDDEN_COMMIT_MESSAGE:${message}`);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap_06_s5_entry_governance_result_v1',
    status: 'PASS',
    exact_head: git(['rev-parse', 'HEAD']),
    baseline_ref: baseline,
    changed_file_count: changed.length,
    authority_graph_status: graph.status,
    structured_evidence_only: true,
    protected_predecessor_path_delta_count: protectedDelta.length,
    logical_commit_count: commitCount,
    maximum_logical_commits: historyPolicy.maximum_logical_commits,
    canonical_write_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    s5_authorized: false
  };
  writeResult(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s5_entry_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    canonical_write_count: 0,
    model_activation_count: 0,
    active_config_switch_count: 0,
    state_mutation_count: 0,
    checkpoint_mutation_count: 0,
    s5_authorized: false
  };
  writeResult(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
