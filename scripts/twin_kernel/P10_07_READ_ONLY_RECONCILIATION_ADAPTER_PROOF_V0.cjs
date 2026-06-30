// scripts/twin_kernel/P10_07_READ_ONLY_RECONCILIATION_ADAPTER_PROOF_V0.cjs
// Purpose: create a non-persisted candidate Twin object bundle from committed P10 fixtures.
// Boundary: local read-only proof; no DB, fact, model, Field Memory, AO-ACT, dispatch, receipt, server, frontend, or persisted object write.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
}

function collectForbiddenKeys(value, forbiddenFields, prefix = '') {
  const hits = [];
  if (!value || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...collectForbiddenKeys(item, forbiddenFields, `${prefix}[${index}]`)));
    return hits;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (forbiddenFields.includes(key)) hits.push(childPath);
    hits.push(...collectForbiddenKeys(child, forbiddenFields, childPath));
  }
  return hits;
}

function buildPayload(kind, artifact) {
  if (kind === 'real_evidence_window_v0') return { source_indexes_json: artifact.source_indexes_json, evidence_refs: artifact.evidence_refs, window: artifact.window };
  if (kind === 'real_soil_moisture_state_estimate_v1') return { state_vector_json: artifact.state_vector_json, confidence_json: artifact.confidence_json, evidence_refs: artifact.evidence_refs };
  if (kind === 'real_soil_moisture_prediction_run_v1') return { forecast_points_json: artifact.forecast_points_json, uncertainty_json: artifact.uncertainty_json, input_refs_json: artifact.input_refs_json };
  if (kind === 'real_actual_observation_window_v0') return { observed_payload: artifact.observed_payload, evidence_refs: artifact.evidence_refs, actual_window_refs: artifact.actual_window_refs };
  if (kind === 'real_backtest_error_report_v1') return { error_summary_json: artifact.error_summary_json, prediction_refs: artifact.prediction_refs, actual_refs: artifact.actual_refs };
  if (kind === 'real_calibration_report_v1') return { learning_candidate_json: artifact.learning_candidate_json, calibration_candidate_json: artifact.calibration_candidate_json, model_version_refs: artifact.model_version_refs };
  if (kind === 'product_replay_demo_report_v0') return { trace_steps_json: artifact.trace_steps_json, explanation_metadata: artifact.explanation_metadata, evidence_refs: artifact.evidence_refs };
  throw new Error('UNSUPPORTED_ARTIFACT_KIND:' + kind);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--run-p8-replay')) throw new Error('MANUAL_MODE_NOT_PART_OF_P10_MANDATORY_ACCEPTANCE');
  if (args.includes('--input-from-p8-stdout')) throw new Error('P8_STDOUT_INPUT_REQUIRES_EXTERNAL_MANUAL_FILE_AND_IS_NOT_DEFAULT_MODE');

  const sourceData = readJson('docs/twin_kernel/SOURCE_DATA_CONTRACT_V0.json');
  const schema = readJson('docs/twin_kernel/CANDIDATE_TWIN_OBJECT_ENVELOPE_SCHEMA_V0.json');
  const mapping = readJson('docs/twin_kernel/ARTIFACT_TO_CANDIDATE_FIELD_MAPPING_V0.json');
  const forced = schema.required_forced_fields;
  const candidates = mapping.mapping_records.map((record, index) => {
    const artifact = readJson(record.source_fixture_path);
    const candidate = {
      schema_version: forced.schema_version,
      candidate_id: 'cand_p10_' + String(index + 1).padStart(2, '0') + '_' + record.source_artifact_kind,
      source_line_id: forced.source_line_id,
      target_line_id: forced.target_line_id,
      candidate_target_object_type: record.candidate_target_object_type,
      target_object_type_authority: forced.target_object_type_authority,
      persisted_target_object_ref: null,
      persistence_status: forced.persistence_status,
      write_allowed: false,
      execution_authority: forced.execution_authority,
      model_update_allowed: false,
      field_memory_write_allowed: false,
      ao_act_task_allowed: false,
      dashboard_authority: false,
      source_artifact_kind: record.source_artifact_kind,
      provenance: { source_fixture_path: record.source_fixture_path, data_availability_class: artifact.data_availability_class || 'committed_fixture' },
      model_version_refs: artifact.model_version_refs || [],
      explanation_metadata: artifact.explanation_metadata || {},
      evidence_refs: artifact.evidence_refs || [],
      candidate_payload: buildPayload(record.source_artifact_kind, artifact)
    };
    const hits = collectForbiddenKeys(candidate, schema.forbidden_fields);
    if (hits.length > 0) throw new Error('FORBIDDEN_FIELD_PRESENT:' + hits.join(','));
    return candidate;
  });

  console.log(JSON.stringify({
    schema_version: 'candidate_twin_object_bundle_v0',
    bundle_id: 'bundle_p10_non_persisted_candidate_adapter_proof_v0',
    case_id: sourceData.case_source_contract.case_id,
    source_line_id: sourceData.case_source_contract.source_line_id,
    target_line_id: 'server_persisted_twin_kernel',
    adapter_class: 'offline_reconciliation_adapter',
    fixture_mode: 'committed_fixture',
    raw_samples_required: false,
    p8_replay_invoked: false,
    candidate_count: candidates.length,
    candidates,
    persistence_status: 'not_persisted',
    write_count: 0,
    db_write_count: 0,
    fact_write_count: 0,
    field_memory_write_count: 0,
    model_update_count: 0,
    ao_act_task_count: 0,
    blocked_operations: ['db_write', 'fact_write', 'field_memory_write', 'model_update', 'ao_act_task', 'dispatch', 'receipt', 'persisted_twin_object_creation']
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
