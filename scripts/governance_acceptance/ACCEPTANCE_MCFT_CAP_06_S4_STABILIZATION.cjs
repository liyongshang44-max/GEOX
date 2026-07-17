// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs
// Purpose: validate immutable S4 implementation evidence and the current structured delivery frontier.
// Boundary: structured JSON and immutable git/file boundaries only; no source-sentence matching, runtime execution, database access, canonical write, or S5 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'e9fa7fcf382ff64c3a60d30ef83ca6dd216585a4';
const IMPLEMENTATION_MERGE_COMMIT = 'd2a71aaa5a80a708476d1abaceeef266fe955659';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5_ENTRY = 'MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const EXPECTED_IMPLEMENTATION_FILES = [
  '.github/workflows/mcft-cap-06-s4-focused-validation.yml',
  'apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts',
  'apps/server/src/domain/twin_runtime/resolved_forecast_observation_case_v1.ts',
  'apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.ts',
  'apps/server/src/persistence/calibration/postgres_resolved_forecast_observation_case_assembler_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.ts',
  'docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-EFFECTIVE-RUNTIME-BASELINE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_DOMAIN.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_FORMAL_COMPOSITION_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S4_STABILIZATION.cjs'
];

function json(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function changedFilesThrough(ref) {
  git(['cat-file', '-e', `${ref}^{commit}`]);
  const output = git(['diff', '--name-only', `${BASELINE}...${ref}`]);
  return output ? output.split(/\r?\n/).filter(Boolean).sort() : [];
}

function main() {
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');
  const cap05Baseline = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-EFFECTIVE-RUNTIME-BASELINE.json');
  const s4Effective = status.s4_effective === true;
  const implementationRef = s4Effective ? status.effectiveness_evidence.merge_commit : 'HEAD';
  const changed = changedFilesThrough(implementationRef);

  assert.deepEqual(changed, [...EXPECTED_IMPLEMENTATION_FILES].sort());
  assert.equal(changed.some((file) => file.startsWith('apps/server/db/migrations/')), false);
  assert.equal(changed.some((file) => file.startsWith('apps/web/')), false);
  assert.equal(changed.some((file) => /routes?|controller|openapi/i.test(file)), false);

  assert.equal(status.delivery_slice_id, S4);
  assert.equal(status.implementation.positive_cap04_execution_projection, true);
  assert.equal(status.implementation.resolved_forecast_observation_case_read_model, true);
  assert.equal(status.implementation.exact_ref_postgresql_graph_assembler, true);
  assert.equal(status.implementation.source_forecast_and_residual_runtime_configs_resolved_separately, true);
  assert.equal(status.implementation.observation_reconstructed_from_canonical_evidence_window, true);
  assert.equal(status.implementation.new_canonical_type_count, 0);
  assert.equal(status.implementation.migration_count, 0);

  assert.equal(cap05Baseline.historical_closure_commit, 'fd6c54e84ee4ede7bbb581b4fc55660251c2265f');
  assert.equal(cap05Baseline.latest_effective_amendment_commit, '0867439b17545bec5fd84e373e72d17881ab50ae');
  assert.equal(cap05Baseline.effective_runtime_baseline_commit, '0867439b17545bec5fd84e373e72d17881ab50ae');
  assert.equal(cap05Baseline.current_successor_eligibility, 'RESTORED');
  assert.equal(cap05Baseline.formal_runner_proof_workflow_run, 29441019824);
  assert.equal(cap05Baseline.historical_closure_rewrite, false);
  assert.equal(cap05Baseline.runtime_behavior_change, false);

  if (!s4Effective) {
    assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(status.s5_authorized, false);
    assert.equal(delivery.active_delivery_slice_id, S4);
    assert.deepEqual(delivery.candidate_slices, [S4]);
    assert.equal(delivery.blocked_slices.includes(S5), true);
    assert.equal(debt.s4_effective, false);
    assert.equal(debt.s5_authorized, false);
  } else {
    assert.equal(implementationRef, IMPLEMENTATION_MERGE_COMMIT);
    assert.equal(status.status, 'MERGED_EFFECTIVE');
    assert.equal(status.effectiveness_evidence.implementation_pr_number, 2536);
    assert.equal(status.effectiveness_evidence.exact_head, '3df36f40b94993941ba8845adcf66b7e189d4bc9');
    assert.equal(status.effectiveness_evidence.focused_validation_run, 29557910269);
    assert.equal(status.effectiveness_evidence.standard_ci_run, 29557910267);
    assert.equal(status.effectiveness_evidence.head_to_merge_file_delta_count, 0);
    assert.equal(status.effectiveness_evidence.head_to_merge_tree_equivalence, 'PASS');
    assert.equal(status.effectiveness_evidence.postmerge_workflow_run, 29558471514);
    assert.equal(status.s5_entry_authorized, true);
    assert.equal(status.s5_authorized, false);
    assert.equal(delivery.active_delivery_slice_id, S5_ENTRY);
    assert.deepEqual(delivery.authorized_not_started_slices, [S5_ENTRY]);
    assert.equal(delivery.blocked_slices.includes(S5), true);
    assert.equal(delivery.s4.effective, true);
    assert.equal(delivery.s5_entry.authorized, true);
    assert.equal(delivery.s5_entry.effective, false);
    assert.equal(delivery.s5.authorized, false);
    assert.equal(debt.status, 'S4_EFFECTIVE_TREATMENTS_S5_ENTRY_REQUIRED');
    assert.deepEqual(debt.open_structural_debt.map((item) => item.status), Array(4).fill('EFFECTIVE_TREATED'));
    assert.equal(debt.s4_effective, true);
    assert.equal(debt.s5_entry_authorized, true);
    assert.equal(debt.s5_authorized, false);
  }

  console.log(JSON.stringify({
    schema_version: 'geox_mcft_cap_06_s4_governance_result_v1',
    status: 'PASS',
    implementation_ref: implementationRef,
    implementation_file_count: changed.length,
    s4_effective: s4Effective,
    s5_entry_authorized: s4Effective,
    s5_authorized: false,
    canonical_write_count: 0
  }));
}

main();
