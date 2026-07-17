// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_ENTRY.cjs
// Purpose: prove S4 effectiveness and insert the S5 entry prerequisite while keeping S5 blocked.
// Boundary: structured JSON and git file boundaries only; no source-sentence matching, runtime execution, canonical write, or S5 implementation.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'd2a71aaa5a80a708476d1abaceeef266fe955659';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5_ENTRY = 'MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s4-effectiveness-s5-entry.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK-AMENDMENT-S5-ENTRY-CONTROLS-V1.md',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_EFFECTIVENESS_S5_ENTRY.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S5_ENTRY.cjs',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_ENTRY_PREFLIGHT.cjs'
];

function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function main() {
  git(['cat-file', '-e', `${BASELINE}^{commit}`]);
  const output = git(['diff', '--name-only', `${BASELINE}...HEAD`]);
  const changed = output ? output.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort());
  assert.equal(changed.some((file) => file.startsWith('apps/server/src/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);

  const effectiveness = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-EFFECTIVENESS.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const reconciliation = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const legacyDelivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');
  const graph = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-AUTHORITY-GRAPH.json');
  const entry = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S5-ENTRY-PREREQUISITE.json');

  assert.equal(effectiveness.delivery_slice_id, S4);
  assert.equal(effectiveness.status, 'MERGED_EFFECTIVE');
  assert.equal(effectiveness.effective, true);
  assert.equal(effectiveness.implementation_pr_number, 2536);
  assert.equal(effectiveness.implementation_exact_head, '3df36f40b94993941ba8845adcf66b7e189d4bc9');
  assert.equal(effectiveness.implementation_standard_ci_run, 29557910267);
  assert.equal(effectiveness.implementation_merge_commit, BASELINE);
  assert.equal(effectiveness.head_to_merge_file_delta_count, 0);
  assert.equal(effectiveness.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(effectiveness.postmerge_probe_pr_number, 2537);
  assert.equal(effectiveness.postmerge_workflow_run, 29558471514);
  assert.equal(effectiveness.postmerge_gate, 'PASS');
  assert.equal(effectiveness.active_delivery_slice_id, S5_ENTRY);
  assert.deepEqual(effectiveness.authorized_not_started_slice_ids, [S5_ENTRY]);
  assert.equal(effectiveness.s5_entry_authorized, true);
  assert.equal(effectiveness.s5_authorized, false);

  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.s4_effective, true);
  assert.equal(status.s5_entry_authorized, true);
  assert.equal(status.s5_authorized, false);

  assert.equal(delivery.active_delivery_slice_id, S5_ENTRY);
  assert.deepEqual(delivery.authorized_not_started_slices, [S5_ENTRY]);
  assert.equal(delivery.blocked_slices.includes(S5), true);
  assert.equal(delivery.s4.effective, true);
  assert.equal(delivery.s5_entry.authorized, true);
  assert.equal(delivery.s5_entry.effective, false);
  assert.equal(delivery.s5.authorized, false);
  assert.equal(delivery.s5.canonical_candidate_append_authorized, false);

  assert.equal(reconciliation.current_state.active_delivery_slice_id, S5_ENTRY);
  assert.equal(reconciliation.current_state.s5_entry_authorized, true);
  assert.equal(reconciliation.current_state.s5_authorized, false);
  assert.equal(legacyDelivery.active_delivery_slice_id, S5_ENTRY);
  assert.deepEqual(legacyDelivery.authorized_not_started_slices, [S5_ENTRY]);
  assert.equal(legacyDelivery.blocked_slices.includes(S5), true);
  assert.equal(legacyDelivery.s5_entry_authorized, true);
  assert.equal(legacyDelivery.s5_authorized, false);

  assert.equal(debt.status, 'S4_EFFECTIVE_TREATMENTS_S5_ENTRY_REQUIRED');
  assert.deepEqual(debt.open_structural_debt.map((item) => item.status), Array(4).fill('EFFECTIVE_TREATED'));
  assert.equal(debt.s4_effective, true);
  assert.equal(debt.s5_entry_authorized, true);
  assert.equal(debt.s5_authorized, false);

  assert.equal(graph.schema_version, 'geox_mcft_cap_06_s5_entry_authority_graph_v1');
  assert.equal(graph.status, 'FROZEN');
  assert.equal(graph.resolution_policy.mode, 'EXACT_REF_HASH_ONLY');
  assert.equal(graph.resolution_policy.canonical_write_count, 0);
  assert.equal(graph.single_runtime_authority.alternative_s5_or_s6_graph_authority_allowed, false);

  assert.equal(entry.delivery_slice_id, S5_ENTRY);
  assert.equal(entry.status, 'AUTHORIZED_NOT_STARTED');
  assert.equal(entry.s5_authorized, false);
  assert.equal(entry.required_preflight.single_command, 'node scripts/runtime_acceptance/RUN_MCFT_CAP_06_S5_ENTRY_PREFLIGHT.cjs');
  assert.equal(entry.governance_evidence_policy.structured_json_only, true);
  assert.equal(entry.governance_evidence_policy.source_sentence_matching_allowed, false);
  assert.equal(entry.protected_predecessor_contract_policy.change_in_s5_candidate_allowed, false);
  assert.equal(entry.draft_history_policy.maximum_logical_commits, 6);

  console.log(JSON.stringify({
    schema_version: 'geox_mcft_cap_06_s4_effectiveness_s5_entry_result_v1',
    status: 'PASS',
    changed_file_count: changed.length,
    s4_effective: true,
    s5_entry_authorized: true,
    s5_authorized: false,
    canonical_write_count: 0
  }));
}

main();
