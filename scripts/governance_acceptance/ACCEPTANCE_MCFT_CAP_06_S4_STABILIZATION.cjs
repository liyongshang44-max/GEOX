// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S4_STABILIZATION.cjs
// Purpose: validate immutable S4 implementation evidence and a monotonic structured successor frontier.
// Boundary: structured JSON and immutable git/file boundaries only; no Runtime execution, database access, canonical write, or downstream implementation authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_06_S4_GOVERNANCE_RESULT.json');
const BASELINE = 'e9fa7fcf382ff64c3a60d30ef83ca6dd216585a4';
const IMPLEMENTATION_MERGE_COMMIT = 'd2a71aaa5a80a708476d1abaceeef266fe955659';
const S5_GRAPH_ARCHIVE_MAIN_COMMIT = '437a6ccae5903494638d17c997a7017c6da057cf';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5_ENTRY = 'MCFT-CAP-06.S5-ENTRY.AUTHORITY-GRAPH-PREFLIGHT-AND-PR-HYGIENE-V1';
const S5_GRAPH = 'MCFT-CAP-06.S5-PREDECESSOR.GRAPH-AND-DUAL-TIME-CONFORMANCE-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const S6 = 'MCFT-CAP-06.MCFT-06-09-11-12.PAIRED-HISTORICAL-SHADOW-COMPUTE-V1';
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

function commitExists(ref) {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveHistoricalImplementationProof(ref) {
  if (commitExists(ref) && commitExists(BASELINE)) {
    const output = git(['diff', '--name-only', `${BASELINE}...${ref}`]);
    return {
      mode: 'EXACT_GIT_OBJECTS',
      changed_files: output ? output.split(/\r?\n/).filter(Boolean).sort() : [],
    };
  }

  assert.equal(process.env.MCFT_CAP_06_ALLOW_ARCHIVE_BASELINE_PROOF, '1',
    'S4_HISTORICAL_GIT_OBJECT_REQUIRED');
  assert.equal(process.env.MCFT_CAP_06_ARCHIVE_BASELINE_MAIN_COMMIT, S5_GRAPH_ARCHIVE_MAIN_COMMIT,
    'S4_ARCHIVE_MAIN_IDENTITY_MISMATCH');
  const archiveBaseline = String(process.env.MCFT_CAP_06_S5_GRAPH_BASELINE_REF || '').trim();
  assert.ok(archiveBaseline, 'S4_ARCHIVE_LOCAL_BASELINE_REF_REQUIRED');
  git(['cat-file', '-e', `${archiveBaseline}^{commit}`]);
  assert.equal(git(['merge-base', '--is-ancestor', archiveBaseline, 'HEAD']), '');
  const baselineMessage = git(['show', '-s', '--format=%B', archiveBaseline]);
  assert.ok(baselineMessage.includes(S5_GRAPH_ARCHIVE_MAIN_COMMIT),
    'S4_ARCHIVE_LOCAL_BASELINE_DOES_NOT_DECLARE_EXACT_MAIN');
  for (const relative of EXPECTED_IMPLEMENTATION_FILES) {
    assert.equal(fs.existsSync(path.join(ROOT, relative)), true, `S4_ARCHIVE_EXPECTED_FILE_MISSING:${relative}`);
  }
  return {
    mode: 'VERIFIED_EXACT_MAIN_ARCHIVE_WITH_STRUCTURED_IMMUTABLE_EVIDENCE',
    changed_files: [...EXPECTED_IMPLEMENTATION_FILES].sort(),
  };
}

function writeResult(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

function main() {
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S4-STATUS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const debt = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CAP05-STRUCTURAL-DEBT-REGISTER.json');
  const cap05Baseline = json('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-EFFECTIVE-RUNTIME-BASELINE.json');
  const implementationRef = status.s4_effective === true
    ? status.effectiveness_evidence.merge_commit
    : 'HEAD';
  const historicalProof = resolveHistoricalImplementationProof(implementationRef);
  const changed = historicalProof.changed_files;

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

  if (status.s4_effective !== true) {
    assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
    assert.equal(delivery.active_delivery_slice_id, S4);
    assert.deepEqual(delivery.candidate_slices, [S4]);
    assert.equal(delivery.blocked_slices.includes(S5), true);
    assert.equal(debt.s4_effective, false);
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
    assert.equal(delivery.s4.effective, true);
    assert.deepEqual(debt.open_structural_debt.map((item) => item.status), Array(4).fill('EFFECTIVE_TREATED'));

    if (delivery.s5_entry.effective === true) {
      assert.equal(delivery.s5_entry.authorized, true);
      assert.equal(delivery.s5_entry.implementation_started, true);
      assert.equal(debt.status, 'S4_EFFECTIVE_TREATMENTS_S5_ENTRY_EFFECTIVE_S5_AUTHORIZED');
      assert.equal(debt.s5_entry_effective, true);
      assert.equal(debt.s5_authorized, true);
      const graphPrerequisite = delivery.s5_predecessor_graph_conformance;
      if (graphPrerequisite && graphPrerequisite.effective !== true) {
        assert.equal(graphPrerequisite.delivery_slice_id, S5_GRAPH);
        assert.equal(delivery.active_delivery_slice_id, S5_GRAPH);
        assert.deepEqual(delivery.candidate_slices, [S5_GRAPH]);
        assert.equal(delivery.blocked_slices.includes(S5), true);
        assert.equal(delivery.s5.authorized, false);
        assert.equal(delivery.s5.implementation_started, false);
      } else if (delivery.s5.effective === true) {
        assert.equal(delivery.active_delivery_slice_id, S6);
        assert.deepEqual(delivery.authorized_not_started_slices, [S6]);
        assert.equal(delivery.blocked_slices.includes(S6), false);
        assert.equal(delivery.s5.authorized, true);
        assert.equal(delivery.s5.implementation_started, true);
        assert.equal(delivery.s5.candidate_implemented, true);
        assert.equal(delivery.s6.authorized, true);
        assert.equal(delivery.s6.implementation_started, false);
        assert.equal(delivery.s6.canonical_write_authorized, false);
        assert.equal(delivery.s6.projection_write_authorized, false);
        assert.equal(delivery.s6.shadow_evaluation_append_authorized, false);
      } else {
        assert.equal(delivery.active_delivery_slice_id, S5);
        assert.deepEqual(delivery.authorized_not_started_slices, [S5]);
        assert.equal(delivery.blocked_slices.includes(S5), false);
        assert.equal(delivery.s5.authorized, true);
        assert.equal(delivery.s5.implementation_started, false);
      }
    } else {
      assert.equal(delivery.active_delivery_slice_id, S5_ENTRY);
      assert.deepEqual(delivery.authorized_not_started_slices, [S5_ENTRY]);
      assert.equal(delivery.blocked_slices.includes(S5), true);
      assert.equal(delivery.s5_entry.authorized, true);
      assert.equal(delivery.s5.authorized, false);
      assert.equal(debt.status, 'S4_EFFECTIVE_TREATMENTS_S5_ENTRY_REQUIRED');
      assert.equal(debt.s5_authorized, false);
    }
  }

  const result = {
    schema_version: 'geox_mcft_cap_06_s4_governance_result_v1',
    status: 'PASS',
    implementation_ref: implementationRef,
    implementation_file_count: changed.length,
    historical_git_proof_mode: historicalProof.mode,
    s4_effective: status.s4_effective === true,
    s5_entry_effective: delivery.s5_entry?.effective === true,
    s5_graph_prerequisite_active: Boolean(delivery.s5_predecessor_graph_conformance && delivery.s5_predecessor_graph_conformance.effective !== true),
    s5_authorized: delivery.s5?.authorized === true,
    s5_effective: delivery.s5?.effective === true,
    s6_authorized: delivery.s6?.authorized === true,
    s6_implementation_started: delivery.s6?.implementation_started === true,
    canonical_write_count: 0
  };
  writeResult(result);
  console.log(JSON.stringify(result));
}

try {
  main();
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap_06_s4_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    canonical_write_count: 0
  };
  writeResult(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
}
