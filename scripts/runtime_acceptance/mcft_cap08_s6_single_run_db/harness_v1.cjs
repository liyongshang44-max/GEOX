'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSingleRunHarnessContractsV1 } = require('./contract_loader_v1.cjs');
const { buildSingleRunExecutionSpecV1 } = require('./execution_spec_v1.cjs');
const { invokeDirectMaterializerV1 } = require('./materializer_adapter_v1.cjs');
const { buildCanonicalReceiptManifestV1 } = require('./receipt_manifest_v1.cjs');
const { readExactReceiptObjectsV1 } = require('./closure_readback_adapter_v1.cjs');
const { executeRecoveryVectorsV1 } = require('./recovery_execution_adapter_v1.cjs');
const { executeCompleteCap07ReadbackV1 } = require('./cap07_readback_execution_adapter_v1.cjs');
const { buildFinalClosureDatabaseSourceV1 } = require('./database_source_adapter_v1.cjs');
const { producePerRunWitnessBundleV1 } = require('./witness_execution_adapter_v1.cjs');
const { validateHarnessPortsV1 } = require('./port_contract_v1.cjs');
const {
  DEVELOPMENT_MODE_V1,
  validateExactPathAuthorityV1,
} = require('../mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs');

function demoteDevelopmentSourceV1(source) {
  return {
    ...source,
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_closure_source_v1',
    classification: 'DEVELOPMENT_REHEARSAL_CLOSURE_SOURCE_V1',
    execution_class: 'DEVELOPMENT_REHEARSAL',
    evidence_class: 'NON_FORMAL',
    closure_manifest_generated_by_final_formal_run: false,
    hard_acceptance_source_eligible: false,
    provenance: {
      ...source.provenance,
      source_classification: 'DEVELOPMENT_REHEARSAL_CLOSURE_SOURCE_V1',
      evidence_class: 'NON_FORMAL',
      closure_manifest_generated_by_final_formal_run: false,
      hard_acceptance_source_eligible: false,
      formal_promotion_authorized: false,
    },
  };
}

function demoteDevelopmentWitnessBundleV1(bundle) {
  assert.equal(bundle.witness_count, 22);
  assert.equal(bundle.object_set_count, 22);
  assert.ok(bundle.witnesses.every(value => value.status === 'PASS'));
  return {
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_per_run_witness_bundle_v1',
    classification: 'DEVELOPMENT_REHEARSAL_NON_FORMAL_WITNESS_BUNDLE',
    evidence_class: 'NON_FORMAL',
    status: 'PASS',
    run_label: bundle.run_label,
    formal_run_id: bundle.formal_run_id,
    operational_run_instance_id: bundle.operational_run_instance_id,
    witness_count: bundle.witness_count,
    object_set_count: bundle.object_set_count,
    object_sets: bundle.object_sets,
    witness_evaluations: bundle.witnesses.map(value => ({
      proof_contract_id: value.proof_contract_id,
      producer_id: value.producer_id,
      expected: value.expected,
      observed: value.observed,
      evaluation_status: value.status,
      evaluation_witness_ref: value.witness_ref,
      hard_acceptance_eligible: false,
      evidence_class: 'NON_FORMAL',
    })),
    exact_producer_path_executed: true,
    synthetic_producer_used: false,
    hard_acceptance_eligible: false,
    formal_promotion_authorized: false,
  };
}

function writeWitnessEvaluationDiagnosticV1({ bundle, executionAuthority }) {
  assert.equal(bundle.witness_count, 22);
  assert.equal(bundle.object_set_count, 22);
  const rehearsalRunLabel = String(
    executionAuthority.rehearsal_run_label
      || executionAuthority.authorized_run_label
      || bundle.run_label
      || '',
  ).trim();
  assert.ok(rehearsalRunLabel, 'WITNESS_DIAGNOSTIC_RUN_LABEL_REQUIRED');
  const outputDir = rehearsalRunLabel.toLowerCase().replaceAll('_', '-');
  const outputPath = path.resolve(
    `acceptance-output/${outputDir}/WITNESS_EVALUATION_RESULT.json`,
  );
  const evaluations = bundle.witnesses.map(value => ({
    item_id: value.item_id,
    proof_contract_id: value.proof_contract_id,
    producer_id: value.producer_id,
    status: value.status,
    eligibility_reason: value.eligibility_reason,
    hard_acceptance_eligible: value.hard_acceptance_eligible,
    expected: value.expected,
    observed: value.observed,
    witness_ref: value.witness_ref,
  }));
  const semanticFailures = evaluations.filter(value => value.status !== 'PASS');
  const eligibilityFailures = evaluations.filter(
    value => value.hard_acceptance_eligible !== true,
  );
  const statusCounts = evaluations.reduce((counts, value) => {
    counts[value.status] = (counts[value.status] || 0) + 1;
    return counts;
  }, {});
  const result = {
    schema_version: 'geox_mcft_cap08_s6_per_run_witness_evaluation_diagnostic_v1',
    status: semanticFailures.length === 0 && eligibilityFailures.length === 0
      ? 'PASS'
      : 'FAIL',
    authority_class: executionAuthority.authority_class,
    evidence_class: executionAuthority.evidence_class,
    run_label: bundle.run_label,
    rehearsal_run_label: executionAuthority.rehearsal_run_label ?? null,
    formal_run_id: bundle.formal_run_id,
    operational_run_instance_id: bundle.operational_run_instance_id,
    witness_count: bundle.witness_count,
    object_set_count: bundle.object_set_count,
    status_counts: statusCounts,
    semantic_failure_count: semanticFailures.length,
    eligibility_failure_count: eligibilityFailures.length,
    semantic_failures: semanticFailures,
    eligibility_failures: eligibilityFailures,
    evaluations,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function executeSingleRunDatabaseHarnessV1({ input, ports, executionAuthority }) {
  validateHarnessPortsV1(ports);
  const authority = validateExactPathAuthorityV1(executionAuthority, input);
  const development = authority.execution_mode === DEVELOPMENT_MODE_V1;
  const contracts = loadSingleRunHarnessContractsV1();
  const unboundSpec = buildSingleRunExecutionSpecV1({ contracts, ...input });
  const freshDatabase = await ports.freshDatabase.assertFreshDisposable({ spec: unboundSpec });
  const materialized = await invokeDirectMaterializerV1(ports.materializer, unboundSpec, executionAuthority);
  const spec = materialized.bound_spec;
  const receiptManifest = buildCanonicalReceiptManifestV1(spec, materialized.result.canonical_receipts);
  const readback = await readExactReceiptObjectsV1(ports.closureReader, spec, receiptManifest);
  const recovery = await executeRecoveryVectorsV1(ports.recovery, spec, executionAuthority);
  const cap07 = await executeCompleteCap07ReadbackV1(ports.cap07Reader, spec, executionAuthority);
  assert.equal(cap07.product_read_write_delta, 0);
  const formalSource = buildFinalClosureDatabaseSourceV1({
    spec,
    receiptManifest,
    readback,
    operationalEvents: materialized.result.operational_events,
    databaseInstanceDigest: materialized.result.database_instance_digest,
    artifactRef: materialized.result.artifact_ref,
    artifactDigest: materialized.result.artifact_digest,
    selectorSnapshot: materialized.result.selector_snapshot,
    executionAuthority,
  });

  const formalWitnessEvaluation = producePerRunWitnessBundleV1({
    spec,
    source: formalSource,
    artifactRef: materialized.result.artifact_ref,
    artifactDigest: materialized.result.artifact_digest,
    synthetic: false,
  });
  const witnessDiagnostic = writeWitnessEvaluationDiagnosticV1({
    bundle: formalWitnessEvaluation,
    executionAuthority,
  });
  assert.equal(formalWitnessEvaluation.witness_count, 22);
  assert.deepEqual(
    witnessDiagnostic.semantic_failures,
    [],
    `PER_RUN_WITNESS_SEMANTIC_FAILURE:${JSON.stringify(witnessDiagnostic.semantic_failures)}`,
  );
  assert.deepEqual(
    witnessDiagnostic.eligibility_failures,
    [],
    `PER_RUN_WITNESS_ELIGIBILITY_FAILURE:${JSON.stringify(witnessDiagnostic.eligibility_failures)}`,
  );

  const source = development ? demoteDevelopmentSourceV1(formalSource) : formalSource;
  const witnesses = development
    ? demoteDevelopmentWitnessBundleV1(formalWitnessEvaluation)
    : formalWitnessEvaluation;

  const artifact = await ports.artifactWriter.writeBundle({
    execution_mode: authority.execution_mode,
    evidence_class: authority.evidence_class,
    execution_authority: {
      authority_class: executionAuthority.authority_class,
      evidence_class: executionAuthority.evidence_class,
      record_status: executionAuthority.record_status,
      rehearsal_run_label: executionAuthority.rehearsal_run_label ?? null,
      logical_database_identity: executionAuthority.logical_database_identity.identity_id,
    },
    fresh_database: freshDatabase,
    spec,
    materializer_plan: materialized.plan,
    materialization: materialized.result,
    receipt_manifest: receiptManifest,
    readback,
    recovery,
    cap07,
    source,
    witness_bundle: witnesses,
  });

  return {
    schema_version: 'geox_mcft_cap08_s6_single_run_database_harness_result_v3',
    status: 'PASS',
    execution_mode: authority.execution_mode,
    evidence_class: authority.evidence_class,
    exact_subject_sha: spec.exact_subject_sha,
    run_label: spec.run_label,
    rehearsal_run_label: executionAuthority.rehearsal_run_label ?? null,
    formal_run_id: spec.formal_run_id,
    operational_run_instance_id: spec.operational_run_instance_id,
    lineage_id: spec.lineage_id,
    revision_id: spec.revision_id,
    canonical_identity_binding: spec.canonical_identity_binding,
    logical_database_identity: executionAuthority.logical_database_identity.identity_id,
    physical_database_name: freshDatabase.database_name,
    bootstrap_fact_count: freshDatabase.bootstrap_fact_count,
    database_instance_digest: materialized.result.database_instance_digest,
    phase_count: materialized.result.phase_results.length,
    canonical_receipt_count: receiptManifest.receipt_count,
    operational_event_count: materialized.result.operational_events.length,
    recovery_vector_count: recovery.results.length,
    cap07_surface_count: cap07.surface_definition_count,
    cap07_request_variant_count: cap07.request_variant_count,
    per_run_witness_count: witnesses.witness_count,
    exact_witness_producer_path_executed: true,
    synthetic_witness_producer_used: false,
    artifact_ref: artifact.artifact_ref,
    artifact_digest: artifact.artifact_digest,
    artifact_transport_digest: artifact.transport_digest,
    hard_acceptance_eligible: !development,
    formal_evidence_eligible: !development,
  };
}

module.exports = {
  demoteDevelopmentSourceV1,
  demoteDevelopmentWitnessBundleV1,
  writeWitnessEvaluationDiagnosticV1,
  executeSingleRunDatabaseHarnessV1,
};
