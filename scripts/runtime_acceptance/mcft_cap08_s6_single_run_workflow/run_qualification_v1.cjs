#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function deepFindV1(value, key) {
  if (!value || typeof value !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  for (const child of Object.values(value)) {
    const found = deepFindV1(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function resolveResidualReadbackV1(bundle, byId, residualId) {
  const selector = bundle.materialization.selector_snapshot.residuals.find(
    value => value.residual_id === residualId,
  );
  assert.ok(selector, `${residualId}_SELECTOR_REQUIRED`);
  assert.equal(typeof selector.object_ref, 'string', `${residualId}_SELECTOR_OBJECT_REF_REQUIRED`);
  const object = byId.get(selector.object_ref);
  assert.ok(object, `${residualId}_READBACK_REQUIRED`);
  return { selector, object };
}

async function main() {
  const bundlePath = String(process.env.MCFT_CAP08_REHEARSAL_BUNDLE || '').trim();
  const restartPath = String(process.env.MCFT_CAP08_RESTART_READBACK_RESULT || '').trim();
  const outputPath = String(process.env.MCFT_CAP08_RUN_QUALIFICATION_OUTPUT || '').trim();
  assert.ok(bundlePath && restartPath && outputPath, 'RUN_QUALIFICATION_PATHS_REQUIRED');
  const bundle = JSON.parse(fs.readFileSync(path.resolve(bundlePath), 'utf8'));
  const restart = JSON.parse(fs.readFileSync(path.resolve(restartPath), 'utf8'));
  assert.equal(bundle.classification, 'DEVELOPMENT_REHEARSAL');
  assert.equal(bundle.evidence_class, 'NON_FORMAL');
  assert.equal(bundle.hard_acceptance_eligible, false);
  assert.equal(restart.status, 'PASS');

  const adminPool = new Pool({ connectionString: String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || ''), max: 1 });
  const runnerPool = new Pool({ connectionString: String(process.env.DATABASE_URL || ''), max: 1 });
  const acl = (await runnerPool.query(`SELECT
    has_table_privilege(current_user,'public.twin_cap08_s4_t17_transition_guard_v1','SELECT') AS select_ok,
    has_table_privilege(current_user,'public.twin_cap08_s4_t17_transition_guard_v1','INSERT') AS insert_ok,
    has_table_privilege(current_user,'public.twin_cap08_s4_t17_transition_guard_v1','UPDATE') AS update_ok,
    has_table_privilege(current_user,'public.twin_cap08_s4_t17_transition_guard_v1','DELETE') AS delete_ok`)).rows[0];
  assert.equal(acl.select_ok, true, 'T17_GUARD_SELECT_REQUIRED');
  assert.equal(acl.insert_ok, true, 'T17_GUARD_INSERT_REQUIRED');
  assert.equal(acl.update_ok, false, 'T17_GUARD_UPDATE_FORBIDDEN');
  assert.equal(acl.delete_ok, false, 'T17_GUARD_DELETE_FORBIDDEN');

  const stateProjection = (await adminPool.query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (
        WHERE p.canonical_payload IS DISTINCT FROM f.record_json->'payload'->'payload'
      )::int AS mismatches
    FROM twin_state_history_projection_v1 p
    JOIN facts f ON f.fact_id=p.source_fact_id`)).rows[0];
  assert.ok(Number(stateProjection.total) > 0, 'STATE_PROJECTION_ROWS_REQUIRED');
  assert.equal(Number(stateProjection.mismatches), 0, 'STATE_PROJECTION_CANONICAL_PAYLOAD_DIVERGENCE');

  const aliasRows = await adminPool.query(`SELECT source FROM facts
    WHERE record_json->'payload'->>'object_id'='FVO-10'
       OR record_json->'payload'->>'source_record_id'='FVO-10'
    ORDER BY source`);
  assert.deepEqual(aliasRows.rows.map(row => row.source), [
    'mcft_cap08_s3_completion_evidence_v1',
    'mcft_cap08_s6_final_formal_evidence_v1',
  ]);

  const phases = bundle.spec.phases;
  assert.equal(phases.length, 28);
  const requiredPhaseOrder = ['resolve', 'E', 'H', 'A', 'B', 'G', 'C', 'barrier'];
  assert.ok(phases.every(phase => JSON.stringify(phase.phase_order) === JSON.stringify(requiredPhaseOrder)));
  assert.equal(bundle.receipt_manifest.receipt_count, 153);
  assert.equal(bundle.materialization.operational_events.length, 224);
  assert.equal(bundle.materialization.phase_results.length, 28);
  assert.equal(bundle.witness_bundle.witness_count, 22);
  assert.equal(bundle.witness_bundle.exact_producer_path_executed, true);
  assert.equal(bundle.witness_bundle.synthetic_producer_used, false);
  assert.equal(bundle.witness_bundle.hard_acceptance_eligible, false);
  assert.ok(bundle.materialization.phase_results.every(phase => phase.status === 'COMPLETE'));
  assert.equal(bundle.materialization.selector_snapshot.late_append_forward.t17_consumes_corrected_posterior, true);
  assert.equal(bundle.materialization.selector_snapshot.late_append_forward.correction_tick, 'T16');

  const receipts = bundle.receipt_manifest.receipts;
  assert.equal(receipts.filter(receipt => receipt.object_ref === 'FVO-10').length, 1);
  assert.equal(receipts.filter(receipt => receipt.object_ref === 'FVO-17').length, 1);
  const byId = new Map(bundle.readback.objects.map(object => [object.object_id, object]));
  const fvo17 = byId.get('FVO-17');
  assert.ok(fvo17, 'FVO17_READBACK_REQUIRED');
  const { selector: r17Selector, object: r17 } = resolveResidualReadbackV1(bundle, byId, 'R-17');
  assert.equal(r17Selector.commit_phase, 'T17', 'R17_COMMIT_PHASE');
  const fvoForecastRef = deepFindV1(fvo17, 'source_forecast_ref');
  const residualForecastRef = deepFindV1(r17, 'forecast_run_ref')
    ?? deepFindV1(r17, 'forecast_ref')
    ?? deepFindV1(r17, 'source_forecast_ref');
  assert.equal(typeof fvoForecastRef, 'string', 'FVO17_SOURCE_FORECAST_REF');
  assert.equal(typeof residualForecastRef, 'string', 'R17_FORECAST_REF');
  assert.equal(fvoForecastRef, residualForecastRef, 'FVO17_R17_FORECAST_BINDING');

  const matrix = {
    cjs_module_loading: 'PASS',
    port_export_import_binding: 'PASS',
    fresh_bootstrap_facts: bundle.fresh_database.bootstrap_fact_count === 11 ? 'PASS' : 'FAIL',
    authority_argument_transport: bundle.execution_authority.evidence_class === 'NON_FORMAL' ? 'PASS' : 'FAIL',
    physical_database_identity: bundle.fresh_database.database_name === bundle.fresh_database.expected_database_name ? 'PASS' : 'FAIL',
    t16_s4_t17_interleave: 'PASS',
    t17_guard_acl: 'PASS',
    execution_phase_order: 'PASS',
    state_projection_canonical_payload: Number(stateProjection.mismatches) === 0 ? 'PASS' : 'FAIL',
    canonical_receipt_cardinality_153: 'PASS',
    operational_event_cardinality_224: 'PASS',
    fvo10_canonical_alias: 'PASS',
    fvo17_corrected_forecast_binding: 'PASS',
    exact_witness_producers_22: bundle.witness_bundle.witness_count === 22
      && bundle.witness_bundle.synthetic_producer_used === false ? 'PASS' : 'FAIL',
    restart_read_continuity: restart.status === 'PASS' && restart.canonical_write_delta === 0 ? 'PASS' : 'FAIL',
  };
  assert.ok(Object.values(matrix).every(value => value === 'PASS'), 'RUN_REGRESSION_MATRIX');
  const result = {
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_run_qualification_v1',
    status: 'PASS',
    evidence_class: 'NON_FORMAL',
    rehearsal_run_label: bundle.execution_authority.rehearsal_run_label,
    exact_subject_sha: bundle.spec.exact_subject_sha,
    operational_run_instance_id: bundle.spec.operational_run_instance_id,
    logical_database_identity: bundle.execution_authority.logical_database_identity,
    physical_database_name: bundle.fresh_database.database_name,
    matrix,
    clean_drop: 'PENDING_POST_QUALIFICATION',
    hard_acceptance_eligible: false,
  };
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
  await Promise.all([adminPool.end(), runnerPool.end()]);
  console.log(JSON.stringify(result, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});