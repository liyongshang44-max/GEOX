// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_P_MINUS_1_ADJUDICATION.cjs
// Purpose: validate the governance-only MCFT-CAP-06 P-1 adjudication against the frozen DT-02 object, envelope, amendment, and transaction authorities.
// Boundary: read-only filesystem validation; no Runtime source, database, migration, canonical write, network, clock-derived identity, or repository mutation.

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.env.GEOX_REPO_ROOT
  ? path.resolve(process.env.GEOX_REPO_ROOT)
  : path.resolve(__dirname, "../..");

const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const taskPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md";
const adjudicationPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-ADJUDICATION.md";
const statusPath = "docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json";
const objectSetPath = "docs/digital_twin/GEOX-DT-02-CANONICAL-OBJECT-SET.json";
const transactionMatrixPath = "docs/digital_twin/GEOX-DT-02-ATOMIC-TRANSACTION-MATRIX.json";
const amendmentPath = "docs/digital_twin/GEOX-DT-02-ARCHITECTURE-AMENDMENT-01.md";
const residualServicePath = "apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.ts";
const forecastBuilderPath = "apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.ts";
const feedbackMigrationPath = "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql";

const task = readText(taskPath);
const adjudication = readText(adjudicationPath);
const status = readJson(statusPath);
const objectSet = readJson(objectSetPath);
const transactionMatrix = readJson(transactionMatrixPath);
const amendment = readText(amendmentPath);
const residualService = readText(residualServicePath);
const forecastBuilder = readText(forecastBuilderPath);
const feedbackMigration = readText(feedbackMigrationPath);

const results = [];

const check = (acceptanceId, condition, evidence) => {
  results.push({ acceptance_id: acceptanceId, status: condition ? "PASS" : "FAIL", evidence });
};

const findObject = (objectType) => objectSet.objects.find((entry) => entry.object_type === objectType);
const findTransaction = (transactionId) => transactionMatrix.transactions.find((entry) => entry.id === transactionId);

const candidate = findObject("twin_calibration_candidate_v1");
const evaluation = findObject("twin_shadow_evaluation_v1");
const activation = findObject("twin_model_activation_v1");
const dTransaction = findTransaction("D_MODEL_GOVERNANCE_STEP_COMMIT");
const nonLineage = objectSet.envelope_contracts.non_lineage_context_envelope;
const baseEnvelope = objectSet.envelope_contracts.base_object_envelope;

check("P1_TASK_STATUS", task.includes("CONDITIONAL_FROZEN_PENDING_P_MINUS_1") && task.includes("P_MINUS_1_READY"), taskPath);
check("P1_FIRST_ACTION", task.includes("MCFT-CAP-06.P-1.DT02-CALIBRATION-SHADOW-ADJUDICATION-V1"), taskPath);
check("P1_OUTCOME_B", status.outcome === "REUSE_WITHOUT_AMENDMENT_CONFIG_OBJECT_NOT_REQUIRED", statusPath);
check("P1_NO_AMENDMENT", status.architecture_amendment_required === false && status.p_minus_1a_required === false, statusPath);
check("P1_NO_RUNTIME_AUTHORITY", status.runtime_source_authorized === false && status.canonical_write_authorized === false, statusPath);

check(
  "P1_CANDIDATE_OBJECT_REUSE",
  candidate
    && candidate.record_class === "CANONICAL_MODEL_GOVERNANCE_HISTORY"
    && candidate.lineage_member === false
    && candidate.envelope_profile === "NON_LINEAGE_CONTEXT"
    && candidate.transaction_families.includes("D_MODEL_GOVERNANCE_STEP_COMMIT")
    && candidate.required_refs.includes("residual_refs")
    && candidate.required_refs.includes("base_config_ref"),
  objectSetPath,
);

check(
  "P1_EVALUATION_OBJECT_REUSE",
  evaluation
    && evaluation.record_class === "CANONICAL_MODEL_GOVERNANCE_HISTORY"
    && evaluation.lineage_member === false
    && evaluation.envelope_profile === "NON_LINEAGE_CONTEXT"
    && evaluation.transaction_families.includes("D_MODEL_GOVERNANCE_STEP_COMMIT")
    && evaluation.required_refs.includes("candidate_ref")
    && evaluation.required_refs.includes("evaluation_dataset_refs"),
  objectSetPath,
);

check(
  "P1_NON_LINEAGE_CONTEXT_FIELDS",
  nonLineage
    && nonLineage.optional_fields.includes("context_lineage_ref")
    && nonLineage.optional_fields.includes("context_revision_ref")
    && amendment.includes("optional context_lineage_ref and context_revision_ref may be used"),
  `${objectSetPath}; ${amendmentPath}`,
);

check(
  "P1_BASE_CONFIG_NON_NULL_PROFILE",
  baseEnvelope.nullable_by_contract.includes("runtime_config_ref")
    && candidate.required_refs.includes("base_config_ref")
    && status.config_adjudication.base_config_ref_nullable === false,
  `${objectSetPath}; ${statusPath}`,
);

check(
  "P1_D_TRANSACTION_REUSE",
  dTransaction
    && dTransaction.status === "FROZEN"
    && dTransaction.operation_rule === "exactly one listed object type per governance transition"
    && dTransaction.canonical_appends.includes("twin_calibration_candidate_v1")
    && dTransaction.canonical_appends.includes("twin_shadow_evaluation_v1")
    && dTransaction.projection_writes.includes("active config index CAS only for activation"),
  transactionMatrixPath,
);

check(
  "P1_MODEL_ACTIVATION_EXCLUDED",
  activation
    && activation.transaction_families.includes("D_MODEL_GOVERNANCE_STEP_COMMIT")
    && status.object_adjudication.twin_model_activation_v1 === "EXPLICITLY_EXCLUDED"
    && status.model_activation_authorized === false,
  `${objectSetPath}; ${statusPath}`,
);

check(
  "P1_CONTEXT_IDENTITY_COMPATIBILITY",
  residualService.includes("context_lineage_ref: requiredStringV1(observation.state.lineage_id")
    && residualService.includes("context_revision_ref: requiredStringV1(observation.state.revision_id")
    && status.context_adjudication.context_lineage_identity_kind === "SEMANTIC_LINEAGE_ID"
    && status.context_adjudication.context_revision_identity_kind === "SEMANTIC_REVISION_ID",
  `${residualServicePath}; ${statusPath}`,
);

check(
  "P1_FORECAST_EVIDENCE_CUTOFF_GRAPH",
  forecastBuilder.includes("payload.evidence_window_ref = ids.twin_evidence_window_v1")
    && forecastBuilder.includes("source_posterior_ref: state.object_id")
    && status.forecast_evidence_cutoff_graph.status === "RESOLVABLE_WITHOUT_AMENDMENT",
  `${forecastBuilderPath}; ${statusPath}`,
);

check(
  "P1_EVIDENCE_REF_MAPPING",
  status.envelope_mapping.residual_refs_are_evidence_refs === false
    && adjudication.includes("Canonical Residual objects are sources, not Evidence"),
  `${adjudicationPath}; ${statusPath}`,
);

check(
  "P1_CONFIG_OBJECT_NOT_REQUIRED",
  status.config_adjudication.calibration_governance_config_object_required === false
    && status.config_adjudication.conditional_s4_execution === "OMITTED",
  statusPath,
);

check(
  "P1_EXACTLY_ONE_ADDITIVE_MIGRATION",
  status.persistence_adjudication.s3_migration_count === 1
    && feedbackMigration.includes("twin_object_idempotency_index_v1_identity_kind_check")
    && !feedbackMigration.includes("D_CALIBRATION_CANDIDATE")
    && !feedbackMigration.includes("D_SHADOW_EVALUATION"),
  `${feedbackMigrationPath}; ${statusPath}`,
);

check(
  "P1_FAILED_ATTEMPT_MODE_A",
  status.failed_attempt_persistence.mode === "MODE_A_NO_PERSISTENT_ATTEMPT_OBJECT"
    && status.failed_attempt_persistence.failed_d_canonical_append_delta === 0
    && status.failed_attempt_persistence.operational_f_append_delta === 0,
  statusPath,
);

check(
  "P1_CANDIDATE_EVALUATION_ONE_TO_MANY",
  status.candidate_to_evaluation_cardinality.cardinality === "ONE_TO_ZERO_OR_MANY"
    && status.candidate_to_evaluation_cardinality.candidate_ref_alone_unique === false,
  statusPath,
);

check(
  "P1_P37_P44_REFERENCE_ONLY",
  status.historical_assets.p37_p44 === "REFERENCE_ONLY_NO_CANONICAL_AUTHORITY",
  statusPath,
);

check(
  "P1_P0_NOT_SELF_AUTHORIZED",
  status.effectiveness.effective === false
    && status.effectiveness.p0_authorized_before_effectiveness === false
    && status.effectiveness.condition === "P_MINUS_1_PR_MERGED_AND_MERGED_MAIN_P_MINUS_1_GATE_PASS",
  statusPath,
);

const failures = results.filter((result) => result.status === "FAIL");

for (const result of results) {
  process.stdout.write(`${result.status} ${result.acceptance_id} ${result.evidence}\n`);
}

process.stdout.write(`TOTAL ${results.length} PASS ${results.length - failures.length} FAIL ${failures.length}\n`);

if (failures.length > 0) {
  process.exitCode = 1;
}
