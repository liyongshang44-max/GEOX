// Purpose: bind MCFT-CAP-08.S5 execution to the externally effective replay-dataset v2 prequalification authority.
// Boundary: pure exact-value validation only; no repository, database, Runtime, Candidate, Shadow, activation, route, scheduler, filesystem, environment or network authority.

export const CAP08_S5_V2_PREQUALIFICATION_POLICY_ID_V1 =
  "MCFT_CAP_08_S5_BUSINESS_OUTCOME_OBJECTIVE_ELIGIBILITY_V1" as const;
export const CAP08_S5_V2_OBJECTIVE_INELIGIBLE_OBSERVATION_REFS_V1 = ["FVO-10"] as const;
export const CAP08_S5_V2_REQUIRED_EFFECTIVE_STATUS_V1 =
  "REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVE" as const;
export const CAP08_S5_V2_REQUIRED_STATUS_CONTEXT_V1 =
  "mcft-cap-08/s5-replay-dataset-v2-prequalification" as const;
export const CAP08_S5_V2_REQUIRED_SUBJECT_SHA_V1 =
  "b94d299851744f589d3c3a6e35111a22c17c79d0" as const;
export const CAP08_S5_V2_REQUIRED_WORKFLOW_RUN_ID_V1 = "30193754069" as const;
export const CAP08_S5_V2_REQUIRED_ARTIFACT_ID_V1 = "8629453895" as const;
export const CAP08_S5_V2_REQUIRED_ARTIFACT_DIGEST_V1 =
  "sha256:14441ad429a875ef5ab713cb3972a37d77f04dcdc9d14c5d810926eeb4e2fed8" as const;
export const CAP08_S5_V2_REQUIRED_SEMANTIC_ARTIFACT_DIGEST_V1 =
  "sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55" as const;
export const CAP08_S5_V2_REQUIRED_DATABASE_SEMANTIC_DIGEST_V1 =
  "sha256:fd19dd2638b8844adfb18f9f78bcc19bf4bcbf010485300667136aad05a53636" as const;

export type Cap08S5V2PrequalificationEvidenceV1 = {
  effective_status: typeof CAP08_S5_V2_REQUIRED_EFFECTIVE_STATUS_V1;
  status_context: typeof CAP08_S5_V2_REQUIRED_STATUS_CONTEXT_V1;
  subject_sha: typeof CAP08_S5_V2_REQUIRED_SUBJECT_SHA_V1;
  workflow_run_id: typeof CAP08_S5_V2_REQUIRED_WORKFLOW_RUN_ID_V1;
  artifact_id: typeof CAP08_S5_V2_REQUIRED_ARTIFACT_ID_V1;
  artifact_digest: typeof CAP08_S5_V2_REQUIRED_ARTIFACT_DIGEST_V1;
  semantic_artifact_digest: typeof CAP08_S5_V2_REQUIRED_SEMANTIC_ARTIFACT_DIGEST_V1;
  database_semantic_digest: typeof CAP08_S5_V2_REQUIRED_DATABASE_SEMANTIC_DIGEST_V1;
  retention_level: "R1";
  readback_verified: true;
  locked_version_delete_denied: true;
  residual_count: 24;
  calibration_case_count: 16;
  holdout_case_count: 8;
  objective_case_count: 15;
  diagnostic_only_case_count: 1;
  selected_parameter_value: "0.034000";
  selected_parameter_delta: "0.004000";
  sensitive_case_count: 7;
  sensitive_wetness_regimes: readonly ["HIGH_EXCESS", "MID_EXCESS"];
  candidate_append_count: 0;
  shadow_append_count: 0;
  s5_formal_candidate_authorized: true;
  s6_implementation_authorized: false;
};

export function validateCap08S5V2PrequalificationEvidenceV1(
  value: Cap08S5V2PrequalificationEvidenceV1,
): Cap08S5V2PrequalificationEvidenceV1 {
  if (value.effective_status !== CAP08_S5_V2_REQUIRED_EFFECTIVE_STATUS_V1
    || value.status_context !== CAP08_S5_V2_REQUIRED_STATUS_CONTEXT_V1
    || value.subject_sha !== CAP08_S5_V2_REQUIRED_SUBJECT_SHA_V1
    || value.workflow_run_id !== CAP08_S5_V2_REQUIRED_WORKFLOW_RUN_ID_V1
    || value.artifact_id !== CAP08_S5_V2_REQUIRED_ARTIFACT_ID_V1
    || value.artifact_digest !== CAP08_S5_V2_REQUIRED_ARTIFACT_DIGEST_V1
    || value.semantic_artifact_digest !== CAP08_S5_V2_REQUIRED_SEMANTIC_ARTIFACT_DIGEST_V1
    || value.database_semantic_digest !== CAP08_S5_V2_REQUIRED_DATABASE_SEMANTIC_DIGEST_V1
    || value.retention_level !== "R1"
    || value.readback_verified !== true
    || value.locked_version_delete_denied !== true
    || value.residual_count !== 24
    || value.calibration_case_count !== 16
    || value.holdout_case_count !== 8
    || value.objective_case_count !== 15
    || value.diagnostic_only_case_count !== 1
    || value.selected_parameter_value !== "0.034000"
    || value.selected_parameter_delta !== "0.004000"
    || value.sensitive_case_count !== 7
    || JSON.stringify(value.sensitive_wetness_regimes) !== JSON.stringify(["HIGH_EXCESS", "MID_EXCESS"])
    || value.candidate_append_count !== 0
    || value.shadow_append_count !== 0
    || value.s5_formal_candidate_authorized !== true
    || value.s6_implementation_authorized !== false) {
    throw new Error("CAP08_S5_V2_PREQUALIFICATION_EFFECTIVENESS_REQUIRED");
  }
  return structuredClone(value);
}
