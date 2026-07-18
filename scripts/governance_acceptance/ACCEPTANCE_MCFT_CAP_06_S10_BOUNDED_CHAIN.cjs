// Purpose: enforce the MCFT-CAP-06 S10 bounded-chain, namespaced controlled-stage continuity, canonical-delta, zero-write replay, repository-history assessment and track-separation contract.
// Boundary: governance verification only; no Runtime execution, canonical/projection write, migration, activation, route, Web, scheduler, successor authorization or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output');
const RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_GOVERNANCE_RESULT.json');
const INPUT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_GOVERNANCE_INPUT.json');
const DB_RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S10_BOUNDED_CHAIN_DB_RESULT.json');
const REPOSITORY_RESULT_PATH = path.join(OUTPUT_DIR, 'MCFT_CAP_06_S0_V2_RESULT.json');
const DEFAULT_BASE = 'd77eb3ac05e56b82aa1f65e8859a0ebe3d9bbcae';
const S10 = 'MCFT-CAP-06.MCFT-04-12-16.BOUNDED-CALIBRATION-SHADOW-CLOSURE-V1';
const S11A = 'MCFT-CAP-06.CLOSURE-CANDIDATE-V1';
const CONTROLLED_STORAGE_MODE = 'TWO_NAMESPACED_ISOLATED_POSTGRESQL_STAGES';
const EXPECTED_FILES = [
  '.github/workflows/mcft-cap-06-s10-bounded-chain.yml',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-AUTHORITY-GRAPH.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-IMPLEMENTATION-CONTRACT.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S10_BOUNDED_CHAIN_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S10_BOUNDED_CHAIN.cjs',
];
const FORBIDDEN_PREFIXES = [
  'apps/server/src/',
  'apps/server/scripts/',
  'apps/server/db/migrations/',
  'apps/web/',
  'docker/',
  'fixtures/',
];

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}
function write(result) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
function scopeKey(scope) {
  return ['tenant_id', 'project_id', 'group_id', 'field_id', 'season_id', 'zone_id']
    .map((key) => String(scope?.[key] || ''))
    .join('|');
}

function main() {
  const baseline = String(process.env.MCFT_CAP_06_S10_BOUNDED_CHAIN_BASE_REF || DEFAULT_BASE).trim();
  git(['cat-file', '-e', `${baseline}^{commit}`]);
  const changedRaw = git(['diff', '--name-only', `${baseline}...HEAD`]);
  const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(changed, [...EXPECTED_FILES].sort(), 'S10_CHANGED_FILE_BOUNDARY_INVALID');
  assert.equal(changed.some((file) => FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix))), false, 'S10_FORBIDDEN_PRODUCT_OR_MIGRATION_FILE_CHANGED');
  assert.equal(changed.some((file) => /route|controller|openapi|scheduler/i.test(file)), false, 'S10_FORBIDDEN_SURFACE_CHANGED');

  const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const database = JSON.parse(fs.readFileSync(DB_RESULT_PATH, 'utf8'));
  const repository = JSON.parse(fs.readFileSync(REPOSITORY_RESULT_PATH, 'utf8'));
  const authority = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-AUTHORITY-GRAPH.json');
  const contract = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-IMPLEMENTATION-CONTRACT.json');
  const status = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S10-BOUNDED-CHAIN-STATUS.json');
  const predecessor = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json');
  const frontier = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
  const s1 = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S1-RESIDUAL-WINDOWS-STATUS.json');
  const pMinus1 = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json');

  assert.equal(input.schema_version, 'geox_mcft_cap_06_s10_bounded_chain_governance_input_v1');
  assert.equal(input.status, 'READY_FOR_GOVERNANCE');
  assert.equal(input.exact_head, git(['rev-parse', 'HEAD']));
  assert.equal(input.taskbook_version, 'v0.4.0');
  assert.equal(input.production_database_used, false);
  assert.equal(Array.isArray(input.stages), true);
  assert.equal(input.stages.length, 4);
  assert.equal(input.stages.every((stage) => stage.status === 'PASS'), true);

  assert.equal(predecessor.status, 'MERGED_EFFECTIVE');
  assert.equal(predecessor.s9_effective, true);
  assert.equal(predecessor.s10_authorized, true);
  assert.equal(predecessor.s10_implementation_started, false);
  assert.equal(frontier.active_delivery_slice_id, S10);
  assert.equal(frontier.next_repository_action, 'IMPLEMENT_S10_BOUNDED_CALIBRATION_SHADOW_CLOSURE');
  assert.equal(frontier.implementation_state.s10_authorized, true);
  assert.equal(frontier.implementation_state.s10_implementation_started, false);

  assert.equal(s1.s1_effective, true);
  assert.equal(s1.canonical_residual_count, 24);
  assert.equal(pMinus1.status, 'MERGED_EFFECTIVE');
  assert.equal(pMinus1.outcome, 'REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED');

  assert.equal(authority.delivery_slice_id, S10);
  assert.equal(authority.predecessor.status, 'MERGED_EFFECTIVE');
  assert.equal(authority.predecessor.effectiveness_writeback_merge, DEFAULT_BASE);
  assert.equal(authority.controlled_track.storage_mode, CONTROLLED_STORAGE_MODE);
  assert.equal(authority.controlled_track.stage_count, 2);
  assert.equal(authority.controlled_track.taskbook_storage_authority, 'ISOLATED_OR_NAMESPACED_ACCEPTANCE_STORAGE');
  assert.equal(authority.controlled_track.stage_1.role, 'S1_TO_S8_GOVERNANCE_DATA_CHAIN');
  assert.equal(authority.controlled_track.stage_2.role, 'S9_RUNTIME_NON_CONSUMPTION_CHAIN');
  assert.equal(authority.controlled_track.cross_stage_continuity.six_dimensional_scope_must_match, true);
  assert.equal(authority.controlled_track.cross_stage_continuity.candidate_ref_hash_must_match, true);
  assert.equal(authority.controlled_track.cross_stage_continuity.evaluation_ref_hash_must_match, true);
  assert.equal(authority.controlled_track.cross_stage_continuity.source_graph_object_ids_may_not_be_coalesced_across_hash_divergence, true);
  assert.equal(authority.controlled_track.cross_stage_continuity.single_canonical_store_coalescing_forbidden, true);
  assert.equal(authority.controlled_track.actual_residual_count_r, 24);
  assert.equal(authority.controlled_track.conditional_governance_config_count_c, 0);
  assert.equal(authority.controlled_track.expected_cap06_canonical_delta, 36);
  assert.equal(authority.repository_history_track.qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(authority.repository_history_track.s10_assessment_status, 'INSUFFICIENT_REPOSITORY_HISTORY_FOR_CALIBRATION_ASSESSMENT');
  assert.equal(authority.track_separation.controlled_internal_namespace_count, 2);
  assert.equal(authority.track_separation.repository_history_database_distinct, true);
  assert.equal(authority.track_separation.controlled_and_repository_scope_overlap_allowed, false);
  assert.equal(authority.track_separation.controlled_and_repository_canonical_ref_overlap_allowed, false);
  assert.equal(authority.successor.slice_id, S11A);
  assert.equal(authority.successor.authorized, false);
  assert.equal(authority.new_prerequisite_inserted, false);
  assert.equal(authority.new_slice_inserted, false);

  assert.equal(contract.delivery_slice_id, S10);
  assert.equal(contract.implementation_class, 'ACCEPTANCE_COMPOSITION_ONLY');
  assert.equal(contract.new_runtime_semantics, false);
  assert.equal(contract.new_calibration_math, false);
  assert.equal(contract.new_shadow_math, false);
  assert.equal(contract.new_scenario_math, false);
  assert.equal(contract.new_persistence_transaction, false);
  assert.equal(contract.new_migration, false);
  assert.deepEqual([...contract.exact_changed_file_boundary].sort(), [...EXPECTED_FILES].sort());
  assert.equal(contract.controlled_track_contract.storage_mode, CONTROLLED_STORAGE_MODE);
  assert.equal(contract.controlled_track_contract.stage_count, 2);
  assert.equal(contract.controlled_track_contract.stage_1_and_stage_2_six_dimensional_scope_equal, true);
  assert.equal(contract.controlled_track_contract.stage_1_and_stage_2_candidate_ref_hash_equal, true);
  assert.equal(contract.controlled_track_contract.stage_1_and_stage_2_evaluation_ref_hash_equal, true);
  assert.equal(contract.controlled_track_contract.divergent_source_graph_identity_coalescing_forbidden, true);
  assert.equal(contract.controlled_track_contract.actual_r, 24);
  assert.equal(contract.controlled_track_contract.actual_c, 0);
  assert.equal(contract.controlled_track_contract.expected_delta, 36);
  assert.equal(contract.controlled_track_contract.completed_chain_rerun.combined_canonical_delta, 0);
  assert.equal(contract.controlled_track_contract.completed_chain_rerun.combined_semantic_projection_divergence_count, 0);
  assert.equal(contract.repository_history_contract.expected_source_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(contract.repository_history_contract.expected_assessment_status, 'INSUFFICIENT_REPOSITORY_HISTORY_FOR_CALIBRATION_ASSESSMENT');
  assert.equal(contract.track_separation_contract.controlled_internal_namespace_count, 2);
  assert.equal(contract.track_separation_contract.repository_history_database_distinct, true);
  assert.equal(contract.track_separation_contract.controlled_and_repository_six_dimensional_scopes_distinct, true);
  assert.equal(contract.track_separation_contract.controlled_and_repository_residual_ref_intersection_count, 0);
  assert.equal(contract.successor_authorized, false);

  assert.equal(database.schema_version, 'geox_mcft_cap_06_s10_bounded_chain_db_result_v1');
  assert.equal(database.status, 'PASS');
  assert.equal(database.controlled_stage_database_count, 2);
  assert.equal(database.controlled_storage_mode, CONTROLLED_STORAGE_MODE);
  assert.equal(database.controlled_stage_scope_match, true);
  assert.equal(database.candidate_evaluation_identity_continuity, true);
  assert.equal(database.actual_r, 24);
  assert.equal(database.actual_c, 0);
  assert.equal(database.canonical_delta_formula, 'R_PLUS_C_PLUS_12');
  assert.equal(database.expected_cap06_canonical_delta, 36);
  assert.equal(database.actual_cap06_canonical_delta, 36);
  assert.equal(database.candidate_ref, 'twin_calibration_candidate_5649b9ab80b5545cf6007387');
  assert.equal(database.evaluation_ref, 'twin_shadow_evaluation_8cae1f6732420a4999deffc0');
  assert.equal(database.candidate_parameter_value, '0.034000');
  assert.equal(database.effective_runtime_parameter_value, '0.030000');
  assert.equal(database.completed_replay_candidate_append_count, 0);
  assert.equal(database.completed_replay_evaluation_append_count, 0);
  assert.equal(database.completed_replay_tick_status, 'EXISTING_IDEMPOTENT_SUCCESS');
  assert.equal(database.completed_replay_evidence_load_count, 0);
  assert.equal(database.completed_replay_additional_fact_count, 0);
  assert.equal(database.completed_replay_facts_hash_changed, false);
  assert.equal(database.completed_replay_projection_hash_changed, false);
  assert.equal(database.completed_replay_projection_divergence_count, 0);
  assert.equal(database.s8_completed_replay_additional_fact_count, 0);
  assert.equal(database.s8_completed_replay_projection_divergence_count, 0);
  assert.equal(database.s9_completed_replay_additional_fact_count, 0);
  assert.equal(database.s9_completed_replay_projection_divergence_count, 0);
  assert.equal(database.candidate_consumed, false);
  assert.equal(database.evaluation_consumed, false);
  assert.equal(database.model_activation_count, 0);
  assert.equal(database.active_config_snapshot_changed, false);
  assert.equal(database.production_database_used, false);
  assert.equal(database.migration_count, 0);

  assert.equal(repository.qualification.dataset_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(repository.qualification.canonical_residual_count, 1);
  assert.equal(repository.qualification.eligible_matched_pair_count, 1);
  assert.equal(input.repository_source_qualification_status, 'INSUFFICIENT_MATCHED_PAIRS');
  assert.equal(input.repository_assessment_status, 'INSUFFICIENT_REPOSITORY_HISTORY_FOR_CALIBRATION_ASSESSMENT');
  assert.equal(input.repository_canonical_residual_count, 1);
  assert.equal(input.repository_eligible_matched_pair_count, 1);
  assert.equal(input.both_track_scopes_distinct, true);
  assert.equal(input.both_track_databases_distinct, true);
  assert.equal(input.residual_ref_intersection_count, 0);
  assert.notEqual(scopeKey(input.controlled_scope), scopeKey(input.repository_scope));
  const repositoryRefs = new Set(input.repository_residual_refs);
  assert.equal(input.controlled_residual_refs.some((ref) => repositoryRefs.has(ref)), false);

  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s10_authorized, true);
  assert.equal(status.s10_implementation_started, true);
  assert.equal(status.s10_candidate_implemented, true);
  assert.equal(status.s10_implementation_merged, false);
  assert.equal(status.s10_merged_main_proven, false);
  assert.equal(status.s10_effective, false);
  assert.equal(status.controlled_track.storage_mode, CONTROLLED_STORAGE_MODE);
  assert.equal(status.controlled_track.stage_count, 2);
  assert.equal(status.controlled_track.stage_scope_match_required, true);
  assert.equal(status.controlled_track.candidate_evaluation_identity_continuity_required, true);
  assert.equal(status.controlled_track.divergent_source_graph_identity_coalescing_forbidden, true);
  assert.equal(status.controlled_track.actual_r, 24);
  assert.equal(status.controlled_track.actual_c, 0);
  assert.equal(status.controlled_track.expected_cap06_canonical_delta, 36);
  assert.equal(status.controlled_internal_continuity_proven, false);
  assert.equal(status.repository_history_track.assessment_status, 'INSUFFICIENT_REPOSITORY_HISTORY_FOR_CALIBRATION_ASSESSMENT');
  assert.equal(status.both_track_separation_proven, false);
  assert.equal(status.s11a_authorized, false);
  assert.equal(status.s11a_implementation_started, false);
  assert.equal(status.new_prerequisite_inserted, false);
  assert.equal(status.new_slice_inserted, false);
  assert.equal(status.successor_capability_line_authorized, false);

  const result = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_governance_result_v1',
    status: 'PASS',
    baseline,
    exact_head: input.exact_head,
    changed_files: changed,
    changed_file_count: changed.length,
    taskbook_version: status.taskbook_version,
    controlled_stage_database_count: database.controlled_stage_database_count,
    controlled_storage_mode: database.controlled_storage_mode,
    controlled_stage_scope_match: database.controlled_stage_scope_match,
    candidate_evaluation_identity_continuity: database.candidate_evaluation_identity_continuity,
    actual_r: database.actual_r,
    actual_c: database.actual_c,
    actual_cap06_canonical_delta: database.actual_cap06_canonical_delta,
    completed_replay_additional_fact_count: database.completed_replay_additional_fact_count,
    completed_replay_projection_divergence_count: database.completed_replay_projection_divergence_count,
    repository_assessment_status: input.repository_assessment_status,
    residual_ref_intersection_count: input.residual_ref_intersection_count,
    s10_candidate_implemented: status.s10_candidate_implemented,
    s10_effective: status.s10_effective,
    s11a_authorized: status.s11a_authorized,
    new_prerequisite_inserted: status.new_prerequisite_inserted,
    new_slice_inserted: status.new_slice_inserted,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  const failure = {
    schema_version: 'geox_mcft_cap_06_s10_bounded_chain_governance_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    s10_effective: false,
    s11a_authorized: false,
    new_prerequisite_inserted: false,
    new_slice_inserted: false,
  };
  write(failure);
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
}
