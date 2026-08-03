#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '5c0670ca6e2868c97d421628e72ce8d4bdefc58a';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FVO17_FORECAST_BINDING_CORRECTION_RESULT.json');
const P = {
  workflow: '.github/workflows/mcft-cap-08-s6-run-a-fvo17-forecast-binding-correction.yml',
  productChain: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  settlement: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-FAILURE-SETTLEMENT-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTION-BOUNDARY-V1.json',
  authority: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  validator: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FVO17_FORECAST_BINDING_CORRECTION_V1.cjs',
  closureReader: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs',
  finalEvidence: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/final_evidence_source_v1.cjs',
  receiptManifest: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/receipt_manifest_v1.cjs',
  resolver: 'apps/server/src/runtime/twin_runtime/cap08_t17_authority_bound_forecast_resolver_v1.ts',
  s5Contract: 'apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts',
  formalWorkflow: '.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml',
};
const CHANGED = [P.workflow, P.productChain, P.settlement, P.boundary, P.authority, P.validator].sort();
const OLD_BINDING = '    forecast:observationSourceForecast,';
const NEW_BINDING = '    forecast:residualForecast,';

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function text(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function json(file) {
  return JSON.parse(text(file));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function semantic(value) {
  const clone = structuredClone(value);
  delete clone.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(clone)).digest('hex')}`;
}
function save(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE);
  assert.equal(git('merge-base', base, 'HEAD'), base);
  assert.equal(git('rev-list', '--count', `${base}..HEAD`), '1');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '');
  assert.deepEqual(
    git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
  );

  const prior = git('show', `${BASE}:${P.productChain}`);
  const current = text(P.productChain).replace(/\r\n/g, '\n').replace(/\n$/, '');
  assert.equal(git('rev-parse', `${BASE}:${P.productChain}`), 'fe3472b1ac2e0f6e91800172315060d7a4456b0b');
  assert.equal(git('rev-parse', `HEAD:${P.productChain}`), 'de12666d4d5bebeac9b57f07d663a0f0f2dc4de1');
  assert.equal(count(prior, OLD_BINDING), 1);
  assert.equal(count(prior, NEW_BINDING), 0);
  assert.equal(count(current, OLD_BINDING), 0);
  assert.equal(count(current, NEW_BINDING), 1);
  assert.equal(prior.replace(OLD_BINDING, NEW_BINDING), current);
  assert.match(current, /const residualForecast=order===17\?s4\.corrected_set\.forecast:observationSourceForecast;/);
  assert.match(current, /forecast_ref:residualForecast\.object_id,/);
  assert.match(current, /forecast_hash:residualForecast\.determinism_hash,/);

  assert.equal(git('rev-parse', `HEAD:${P.closureReader}`), 'cdee98e8b7bbd4a1d5ba45361978d5803873b610');
  assert.equal(git('rev-parse', `HEAD:${P.finalEvidence}`), '3f2108991f64f63fb17606a75a491620f6fd8a27');
  assert.equal(git('rev-parse', `HEAD:${P.receiptManifest}`), '68ef6934bab0243b29c3ae90b22d4e5603f1c4fb');
  assert.equal(git('rev-parse', `HEAD:${P.resolver}`), '7e8c1a41cf20f03aa258a2b3dc0f10d4dca201f8');
  assert.equal(git('rev-parse', `HEAD:${P.s5Contract}`), 'b40f64ab0cb974cd041c9373086263052dc849fe');
  assert.equal(git('rev-parse', `HEAD:${P.formalWorkflow}`), '2371b3797999f61f55c58551b85c59279eb2f0a2');

  const authority = json(P.authority);
  const settlement = json(P.settlement);
  const boundary = json(P.boundary);
  for (const value of [authority, settlement, boundary]) {
    assert.equal(value.semantic_digest, semantic(value));
  }
  assert.equal(authority.record_status, 'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_FVO17_FORECAST_BINDING_FAILURE');
  assert.equal(authority.authority_consumed, true);
  assert.equal(authority.single_use_contract.dispatch_count_consumed, 1);
  assert.equal(authority.single_use_contract.rerun_authorized, false);
  assert.equal(authority.single_run_database_execution_authorized, false);
  assert.equal(authority.workflow_dispatch_execution_authorized, false);
  assert.equal(authority.consumption_evidence.github_workflow_run_id, 30781414909);
  assert.equal(authority.consumption_evidence.authority_artifact_id, 8843772926);
  assert.equal(authority.consumption_evidence.failed_run_artifact_id, 8843789897);
  assert.equal(authority.consumption_evidence.database_dropped, true);
  assert.equal(authority.failure_classification.code, 'FVO17_FORECAST_AUTHORITY_BINDING_DIVERGENCE');
  assert.equal(authority.failure_classification.canonical_semantic_hash_equal, false);
  assert.equal(authority.failure_classification.closure_reader_defect, false);
  assert.equal(authority.failure_classification.formal_port_bundle_product_chain_defect, true);
  assert.equal(authority.replacement_authority_issued, false);
  assert.equal(authority.sequence_contract.run_b_remains_blocked, true);

  assert.equal(settlement.record_status, 'RUN_A_FVO17_FORECAST_BINDING_FAILURE_SETTLED');
  assert.equal(settlement.failed_dispatch.workflow_run_id, 30781414909);
  assert.equal(settlement.root_cause.canonical_ref, 'FVO-17');
  assert.equal(settlement.root_cause.canonical_hash_equal, false);
  assert.equal(settlement.root_cause.t17_tick_evidence_forecast_binding, 'CORRECTED_T16_FORECAST');
  assert.equal(settlement.root_cause.s5_observation_rebuild_forecast_binding, 'BASE_T16_FORECAST');
  assert.equal(settlement.root_cause.s5_residual_forecast_binding, 'CORRECTED_T16_FORECAST');
  assert.equal(settlement.correction.order_17_observation_and_residual_share_corrected_forecast, true);
  assert.equal(settlement.correction.other_23_orders_preserve_ordinary_forecast_binding, true);
  assert.equal(settlement.correction.closure_reader_changed, false);
  assert.equal(settlement.next_legal_action_after_merge, 'ISSUE_NEW_NON_EFFECTIVE_RUN_A_AUTHORITY_CANDIDATE');

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 6);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.correction.canonical_ref, 'FVO-17');
  assert.equal(boundary.correction.order_17_observation_binding, 'CORRECTED_T16_FORECAST');
  assert.equal(boundary.correction.order_17_residual_binding, 'CORRECTED_T16_FORECAST');
  assert.equal(boundary.correction.other_order_binding_preserved, true);
  assert.equal(boundary.replacement_authority_present, false);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_performed, false);

  const workflow = text(P.workflow);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /postgres:16|psql|DATABASE_URL|workflow_entrypoint_v1\.ts/i);
  assert.doesNotMatch(CHANGED.join('\n'), /AUTHORITY-CANDIDATE|AUTHORITY-EFFECTIVENESS/);
  assert.doesNotMatch(CHANGED.join('\n'), /single-run-database-execution\.yml/);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_fvo17_forecast_binding_correction_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: 6,
    failed_workflow_run_id: 30781414909,
    consumed_operational_identity: 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-009',
    terminal_error: 'CLOSURE_REF_DUPLICATE:FVO-17',
    prior_product_chain_blob_sha: 'fe3472b1ac2e0f6e91800172315060d7a4456b0b',
    corrected_product_chain_blob_sha: 'de12666d4d5bebeac9b57f07d663a0f0f2dc4de1',
    order_17_observation_forecast_binding: 'CORRECTED_T16_FORECAST',
    order_17_residual_forecast_binding: 'CORRECTED_T16_FORECAST',
    other_23_order_bindings_preserved: true,
    closure_reader_changed: false,
    product_runtime_changed: false,
    migration_changed: false,
    formal_database_workflow_changed: false,
    replacement_authority_present: false,
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    run_b_dispatch_authorized: false,
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_fvo17_forecast_binding_correction_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
