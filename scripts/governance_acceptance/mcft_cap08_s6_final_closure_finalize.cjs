#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FINAL_CLOSURE_RESULT.json');
const stage = String(process.env.MCFT_ARTIFACT_STAGE || 'DEVELOPMENT_PREFLIGHT');
if (!['DEVELOPMENT_PREFLIGHT', 'FORMAL_CANDIDATE', 'EXACT_MERGE_SHA'].includes(stage)) {
  throw new Error(`MCFT_CAP08_S6_ARTIFACT_STAGE_INVALID:${stage}`);
}

function readRun(id) {
  const direct = path.join(ROOT, `acceptance-output/MCFT_CAP_08_S6_${id}_FORMAL_RUN_RESULT.json`);
  const nested = path.join(ROOT, `acceptance-output/${id}/MCFT_CAP_08_S6_${id}_FORMAL_RUN_RESULT.json`);
  const file = fs.existsSync(direct) ? direct : nested;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function hash(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const a = readRun('RUN_A');
  const b = readRun('RUN_B');
  for (const [name, run] of [['RUN_A', a], ['RUN_B', b]]) {
    assert.equal(run.status, 'PASS', `${name}_STATUS`);
    assert.equal(run.run_instance_id, name, `${name}_INSTANCE`);
    assert.equal(run.final_formal_run, true, `${name}_FINAL_FORMAL`);
    assert.equal(run.slice_acceptance_object_reuse, false, `${name}_SLICE_REUSE`);
    assert.equal(run.fresh_process_recovery, true, `${name}_FRESH_PROCESS`);
    assert.equal(run.pointer_rebuild_equality, true, `${name}_POINTER_REBUILD`);
    assert.equal(run.projection_rebuild_equality, true, `${name}_PROJECTION_REBUILD`);
    assert.equal(run.product_read_write_delta, 0, `${name}_READ_WRITE_DELTA`);
    assert.equal(run.cap07_get_surface_count, 10, `${name}_GET_SURFACE_COUNT`);
    assert.equal(run.model_activation_count, 0, `${name}_ACTIVATION_COUNT`);
    assert.equal(run.active_runtime_config_switch_count, 0, `${name}_CONFIG_SWITCH_COUNT`);
    assert.equal(run.production_runtime_source_authorized, false, `${name}_PRODUCTION_SOURCE`);
    assert.equal(run.mcft_cap_09_authorized, false, `${name}_CAP09`);
    assert.equal(run.forecast_point_count, 1728, `${name}_FORECAST_POINTS`);
    assert.equal(run.scenario_option_count, 72, `${name}_SCENARIO_OPTIONS`);
    assert.equal(run.scenario_point_count, 5184, `${name}_SCENARIO_POINTS`);
    assert.equal(run.fvo_count, 24, `${name}_FVO_COUNT`);
    assert.equal(run.calibration_case_count, 16, `${name}_CALIBRATION_COUNT`);
    assert.equal(run.objective_case_count, 15, `${name}_OBJECTIVE_COUNT`);
    assert.equal(run.diagnostic_only_case_count, 1, `${name}_DIAGNOSTIC_COUNT`);
    assert.equal(run.holdout_case_count, 8, `${name}_HOLDOUT_COUNT`);
    assert.equal(run.candidate_parameter_value, '0.034000', `${name}_CANDIDATE_VALUE`);
    assert.deepEqual(run.counts, {
      lineage: 1,
      ticks: 25,
      states: 25,
      forecasts: 25,
      scenarios: 24,
      decisions: 1,
      feedback: 1,
      residuals: 24,
      candidates: 1,
      shadows: 1,
      activations: 0,
    }, `${name}_CARDINALITY`);
    assert.equal(run.hard_acceptance_ledger.length, 24, `${name}_HA_COUNT`);
    assert.equal(run.hard_acceptance_pass_count, 23, `${name}_HA_PASS_COUNT`);
    assert.equal(run.hard_acceptance_pending_exact_merge_count, 1, `${name}_HA_PENDING_COUNT`);
    assert.equal(run.hard_acceptance_ledger[23].item_id, 'HA-24', `${name}_HA24_ID`);
    assert.equal(run.hard_acceptance_ledger[23].status, 'PENDING_EXACT_MERGE_R2', `${name}_HA24_STATUS`);
  }

  assert.equal(a.formal_run_id, b.formal_run_id, 'FORMAL_RUN_ID_MISMATCH');
  assert.notEqual(a.run_instance_id, b.run_instance_id, 'RUN_INSTANCE_ID_MUST_DIFFER');
  assert.equal(a.s6_contract_semantic_digest, b.s6_contract_semantic_digest, 'CONTRACT_DIGEST_MISMATCH');
  assert.equal(a.semantic_chain_digest, b.semantic_chain_digest, 'SEMANTIC_CHAIN_DIGEST_MISMATCH');
  assert.equal(a.operational_invariant_digest, b.operational_invariant_digest, 'OPERATIONAL_INVARIANT_DIGEST_MISMATCH');
  assert.equal(a.closure_digest, b.closure_digest, 'CLOSURE_DIGEST_MISMATCH');
  assert.equal(a.candidate_ref, b.candidate_ref, 'CANDIDATE_REF_MISMATCH');
  assert.equal(a.candidate_hash, b.candidate_hash, 'CANDIDATE_HASH_MISMATCH');
  assert.equal(a.shadow_ref, b.shadow_ref, 'SHADOW_REF_MISMATCH');
  assert.equal(a.shadow_hash, b.shadow_hash, 'SHADOW_HASH_MISMATCH');
  assert.deepEqual(a.hard_acceptance_ledger, b.hard_acceptance_ledger, 'HARD_ACCEPTANCE_LEDGER_MISMATCH');

  const semanticArtifact = {
    schema_version: 'geox_mcft_cap08_s6_final_closure_result_v1',
    status: 'PASS',
    artifact_stage: stage,
    formal_run_id: a.formal_run_id,
    run_instance_ids: ['RUN_A', 'RUN_B'],
    independent_fresh_database_run_count: 2,
    s6_contract_semantic_digest: a.s6_contract_semantic_digest,
    semantic_chain_digest: a.semantic_chain_digest,
    operational_invariant_digest: a.operational_invariant_digest,
    closure_digest: a.closure_digest,
    three_digest_equalities: true,
    hard_acceptance_ledger: a.hard_acceptance_ledger,
    hard_acceptance_item_count: 24,
    technical_hard_acceptance_pass_count: 23,
    exact_merge_r2_pending_count: 1,
    counts: a.counts,
    forecast_point_count: 1728,
    scenario_option_count: 72,
    scenario_point_count: 5184,
    fvo_count: 24,
    calibration_case_count: 16,
    objective_case_count: 15,
    diagnostic_only_case_count: 1,
    holdout_case_count: 8,
    candidate_parameter_value: '0.034000',
    candidate_ref: a.candidate_ref,
    candidate_hash: a.candidate_hash,
    shadow_ref: a.shadow_ref,
    shadow_hash: a.shadow_hash,
    model_activation_count: 0,
    active_runtime_config_switch_count: 0,
    cap07_get_surface_count: 10,
    product_read_write_delta: 0,
    fresh_process_recovery: true,
    pointer_rebuild_equality: true,
    projection_rebuild_equality: true,
    slice_acceptance_object_reuse: false,
    exact_head_independent_approval_required: true,
    exact_merge_tree_equality_required: true,
    r2_retention_days_required: 730,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false,
    production_runtime_source_authorized: false,
  };
  const result = {
    ...semanticArtifact,
    semantic_artifact_digest: hash(semanticArtifact),
    development_preflight_complete: stage === 'DEVELOPMENT_PREFLIGHT',
    formal_candidate_technical_gate_complete: stage === 'FORMAL_CANDIDATE',
    exact_merge_technical_replay_complete: stage === 'EXACT_MERGE_SHA',
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s6_final_closure_result_v1',
    status: 'FAIL',
    artifact_stage: stage,
    error: error instanceof Error ? error.stack || error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
