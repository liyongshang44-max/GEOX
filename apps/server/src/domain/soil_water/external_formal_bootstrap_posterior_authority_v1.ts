// apps/server/src/domain/soil_water/external_formal_bootstrap_posterior_authority_v1.ts
// Purpose: adapt the frozen CAP01 bootstrap posterior compatibility math into an honest External Formal posterior candidate with Amendment-05 100-mm operator provenance while proving numerical identity.
// Boundary: pure authority adaptation only; no Evidence selection, no posterior re-computation, no canonical persistence, no database, network, scheduler, wall clock, recommendation, action, or O00 execution.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import { ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1 } from "./root_zone_observation_operator_v1.js";
import type { RootZoneWaterPosteriorV1 } from "./root_zone_water_posterior_v1.js";

export const EXTERNAL_FORMAL_BOOTSTRAP_POSTERIOR_AUTHORITY_SCHEMA_V1 =
  "geox_mcft_cap09_external_formal_bootstrap_posterior_authority_v1" as const;

export type ExternalFormalBootstrapPosteriorCandidateV1 = Omit<
  RootZoneWaterPosteriorV1,
  "model_versions" | "posterior" | "limitations"
> & {
  model_versions: Omit<RootZoneWaterPosteriorV1["model_versions"], "observation_operator_id"> & {
    observation_operator_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1;
  };
  posterior: Omit<RootZoneWaterPosteriorV1["posterior"], "uncertainty"> & {
    uncertainty: Omit<RootZoneWaterPosteriorV1["posterior"]["uncertainty"], "uncertainty_sources"> & {
      uncertainty_sources: readonly string[];
    };
  };
  limitations: readonly string[];
  external_authority: {
    soil_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
    observation_operator_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1;
    measurement_depth_mm: 100;
    spatial_support: "NEAR_SITE_POINT_SUPPORT";
    root_zone_representativeness: "PARTIAL";
    direct_field_equivalence: false;
    direct_root_zone_equivalence: false;
    model_parameter_authority: "MODEL_PRIOR_FROM_CAP08";
    field_calibration_status: "NOT_FIELD_CALIBRATED";
  };
};

export type ExternalFormalBootstrapPosteriorAuthorityV1 = {
  schema_version: typeof EXTERNAL_FORMAL_BOOTSTRAP_POSTERIOR_AUTHORITY_SCHEMA_V1;
  authorized_soil_binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  selected_observation_ref: string;
  compatibility_numeric_digest: string;
  external_candidate_numeric_digest: string;
  numerical_identity_preserved: true;
  compatibility_source_canonical_persistence_authorized: false;
  posterior_candidate: ExternalFormalBootstrapPosteriorCandidateV1;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function numericBasisV1(value: RootZoneWaterPosteriorV1 | ExternalFormalBootstrapPosteriorCandidateV1): Record<string, unknown> {
  const cloned = structuredClone(value) as unknown as Record<string, unknown>;
  delete cloned.model_versions;
  delete cloned.limitations;
  delete cloned.external_authority;
  const posterior = cloned.posterior as Record<string, unknown> | undefined;
  const uncertainty = posterior?.uncertainty as Record<string, unknown> | undefined;
  if (uncertainty) delete uncertainty.uncertainty_sources;
  return cloned;
}

export function buildExternalFormalBootstrapPosteriorAuthorityV1(input: {
  compatibility_posterior: RootZoneWaterPosteriorV1;
  authorized_soil_binding_id: string;
  selected_observation_ref: string;
}): ExternalFormalBootstrapPosteriorAuthorityV1 {
  const bindingId = requiredStringV1(input.authorized_soil_binding_id, "EXTERNAL_FORMAL_BOOTSTRAP_SOIL_BINDING_REQUIRED");
  if (bindingId !== MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1) {
    throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_SOIL_BINDING_MISMATCH");
  }
  const selectedObservationRef = requiredStringV1(
    input.selected_observation_ref,
    "EXTERNAL_FORMAL_BOOTSTRAP_SELECTED_OBSERVATION_REF_REQUIRED",
  );
  if (input.compatibility_posterior.model_versions.observation_operator_id !== ROOT_ZONE_OBSERVATION_OPERATOR_ID_V1) {
    throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_COMPATIBILITY_OPERATOR_MISMATCH");
  }

  const posteriorCandidate: ExternalFormalBootstrapPosteriorCandidateV1 = {
    ...structuredClone(input.compatibility_posterior),
    model_versions: {
      ...structuredClone(input.compatibility_posterior.model_versions),
      observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
    },
    posterior: {
      ...structuredClone(input.compatibility_posterior.posterior),
      uncertainty: {
        ...structuredClone(input.compatibility_posterior.posterior.uncertainty),
        uncertainty_sources: [
          "weak configured prior",
          "sensor measurement uncertainty",
          "near-site point-to-root-zone representativeness uncertainty",
          "MODEL_PRIOR_FROM_CAP08 hydraulic configuration",
          "single-observation bootstrap limitation",
        ],
      },
    },
    limitations: [
      "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
      "MODEL_PRIOR_FROM_CAP08",
      "NOT_FIELD_CALIBRATED",
      "KBS_SOIL_MEASUREMENT_DEPTH_100MM",
      "NEAR_SITE_POINT_SUPPORT",
      "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
      "DIRECT_FIELD_EQUIVALENCE_FALSE",
      "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
      "SINGLE_OBSERVATION_BOOTSTRAP",
      "NO_SURFACE_STATE_INFERENCE",
    ],
    external_authority: {
      soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
      measurement_depth_mm: 100,
      spatial_support: "NEAR_SITE_POINT_SUPPORT",
      root_zone_representativeness: "PARTIAL",
      direct_field_equivalence: false,
      direct_root_zone_equivalence: false,
      model_parameter_authority: "MODEL_PRIOR_FROM_CAP08",
      field_calibration_status: "NOT_FIELD_CALIBRATED",
    },
  };

  const compatibilityNumericDigest = semanticHashV1(numericBasisV1(input.compatibility_posterior));
  const externalCandidateNumericDigest = semanticHashV1(numericBasisV1(posteriorCandidate));
  if (compatibilityNumericDigest !== externalCandidateNumericDigest) {
    throw new Error("EXTERNAL_FORMAL_BOOTSTRAP_NUMERICAL_IDENTITY_MISMATCH");
  }

  return {
    schema_version: EXTERNAL_FORMAL_BOOTSTRAP_POSTERIOR_AUTHORITY_SCHEMA_V1,
    authorized_soil_binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    selected_observation_ref: selectedObservationRef,
    compatibility_numeric_digest: compatibilityNumericDigest,
    external_candidate_numeric_digest: externalCandidateNumericDigest,
    numerical_identity_preserved: true,
    compatibility_source_canonical_persistence_authorized: false,
    posterior_candidate: posteriorCandidate,
  };
}
