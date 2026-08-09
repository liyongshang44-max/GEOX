// apps/server/src/domain/soil_water/external_formal_assimilation_authority_view_v1.ts
// Purpose: adapt one already-computed historical CAP03 compatibility posterior into an External Formal assimilation authority view with the exact Amendment-05 100-mm operator provenance while proving numerical identity.
// Boundary: pure authority adaptation only; no Evidence selection, no assimilation re-computation, no canonical persistence, no Runtime Config mutation, no database, network, scheduler, wall clock, recommendation, action, or O00 execution.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
} from "../twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import type { AssimilatedContinuationPosteriorV1 } from "./assimilated_continuation_posterior_v1.js";

export const EXTERNAL_FORMAL_ASSIMILATION_AUTHORITY_VIEW_SCHEMA_V1 =
  "geox_mcft_cap09_external_formal_assimilation_authority_view_v1" as const;
export const EXTERNAL_FORMAL_ASSIMILATION_COMPATIBILITY_POLICY_V1 =
  "CAP03_H1_NUMERICAL_COMPATIBILITY_WITH_EXTERNAL_OPERATOR_PROVENANCE_V1" as const;

export type ExternalFormalAssimilationPosteriorCandidateV1 = Omit<
  AssimilatedContinuationPosteriorV1,
  "observation_operator"
> & {
  observation_operator: {
    id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1;
    h: 1;
    direct_state_equivalence: false;
    measurement_depth_mm: 100;
    spatial_support: "NEAR_SITE_POINT_SUPPORT";
    root_zone_representativeness: "PARTIAL";
    direct_field_equivalence: false;
    direct_root_zone_equivalence: false;
  };
};

export type ExternalFormalAssimilationAuthorityViewV1 = {
  schema_version: typeof EXTERNAL_FORMAL_ASSIMILATION_AUTHORITY_VIEW_SCHEMA_V1;
  compatibility_policy_id: typeof EXTERNAL_FORMAL_ASSIMILATION_COMPATIBILITY_POLICY_V1;
  authorized_soil_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  source_compatibility_operator_id: typeof ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1;
  external_operator_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1;
  selected_observation_ref: string | null;
  compatibility_numeric_digest: string;
  external_candidate_numeric_digest: string;
  numerical_identity_preserved: true;
  canonical_persistence_authorized: false;
  model_parameter_authority: "MODEL_PRIOR_FROM_CAP08";
  field_calibration_status: "NOT_FIELD_CALIBRATED";
  posterior_candidate: ExternalFormalAssimilationPosteriorCandidateV1;
  limitations: readonly [
    "NEAR_SITE_POINT_SUPPORT",
    "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
    "DIRECT_FIELD_EQUIVALENCE_FALSE",
    "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
    "NONCANONICAL_COMPATIBILITY_MATH_SOURCE",
    "CANONICAL_PERSISTENCE_NOT_AUTHORIZED_IN_EA5B4A"
  ];
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function numericBasisV1(
  posterior: AssimilatedContinuationPosteriorV1 | ExternalFormalAssimilationPosteriorCandidateV1,
): Record<string, unknown> {
  const { observation_operator: _operator, ...numericAndDispositionBasis } = posterior;
  return structuredClone(numericAndDispositionBasis) as unknown as Record<string, unknown>;
}

export function buildExternalFormalAssimilationAuthorityViewV1(input: {
  compatibility_posterior: AssimilatedContinuationPosteriorV1;
  evidence_authority: {
    authorized_binding_id: string;
    selected_observation_ref: string | null;
  };
}): ExternalFormalAssimilationAuthorityViewV1 {
  const bindingId = requiredStringV1(
    input.evidence_authority.authorized_binding_id,
    "EXTERNAL_FORMAL_ASSIMILATION_SOIL_BINDING_REQUIRED",
  );
  if (bindingId !== MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1) {
    throw new Error("EXTERNAL_FORMAL_ASSIMILATION_SOIL_BINDING_MISMATCH");
  }
  if (
    input.compatibility_posterior.observation_operator.id
    !== ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1
  ) {
    throw new Error("EXTERNAL_FORMAL_ASSIMILATION_COMPATIBILITY_OPERATOR_MISMATCH");
  }
  if (
    input.compatibility_posterior.selected_observation_ref
    !== input.evidence_authority.selected_observation_ref
  ) {
    throw new Error("EXTERNAL_FORMAL_ASSIMILATION_SELECTED_OBSERVATION_MISMATCH");
  }

  const posteriorCandidate: ExternalFormalAssimilationPosteriorCandidateV1 = {
    ...structuredClone(input.compatibility_posterior),
    observation_operator: {
      id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
      h: 1,
      direct_state_equivalence: false,
      measurement_depth_mm: 100,
      spatial_support: "NEAR_SITE_POINT_SUPPORT",
      root_zone_representativeness: "PARTIAL",
      direct_field_equivalence: false,
      direct_root_zone_equivalence: false,
    },
  };
  const compatibilityNumericDigest = semanticHashV1(
    numericBasisV1(input.compatibility_posterior),
  );
  const externalCandidateNumericDigest = semanticHashV1(
    numericBasisV1(posteriorCandidate),
  );
  if (compatibilityNumericDigest !== externalCandidateNumericDigest) {
    throw new Error("EXTERNAL_FORMAL_ASSIMILATION_NUMERICAL_IDENTITY_MISMATCH");
  }

  return {
    schema_version: EXTERNAL_FORMAL_ASSIMILATION_AUTHORITY_VIEW_SCHEMA_V1,
    compatibility_policy_id: EXTERNAL_FORMAL_ASSIMILATION_COMPATIBILITY_POLICY_V1,
    authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    source_compatibility_operator_id:
      ASSIMILATED_CONTINUATION_OBSERVATION_OPERATOR_ID_V1,
    external_operator_id:
      MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
    selected_observation_ref: input.evidence_authority.selected_observation_ref,
    compatibility_numeric_digest: compatibilityNumericDigest,
    external_candidate_numeric_digest: externalCandidateNumericDigest,
    numerical_identity_preserved: true,
    canonical_persistence_authorized: false,
    model_parameter_authority: "MODEL_PRIOR_FROM_CAP08",
    field_calibration_status: "NOT_FIELD_CALIBRATED",
    posterior_candidate: posteriorCandidate,
    limitations: [
      "NEAR_SITE_POINT_SUPPORT",
      "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
      "DIRECT_FIELD_EQUIVALENCE_FALSE",
      "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
      "NONCANONICAL_COMPATIBILITY_MATH_SOURCE",
      "CANONICAL_PERSISTENCE_NOT_AUTHORIZED_IN_EA5B4A",
    ],
  };
}
