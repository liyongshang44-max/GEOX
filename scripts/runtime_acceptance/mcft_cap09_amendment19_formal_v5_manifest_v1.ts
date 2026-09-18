import {
  buildExternalFormalAmendment19WindowManifestV1,
  validateExternalFormalAmendment19WindowManifestV1,
  type ExternalFormalAmendment19WindowManifestV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
  type ExternalFormalPrewindowAuthorityBundleV5,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v5.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V4,
  materializeExternalFormalA18CropContextV4,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.js";
import type { ExternalFormalV3Am19WindowManifestV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import {
  MCFT_CAP09_AM19_FORMAL_DATABASE_V5,
  validateMcftCap09FormalV5ArmV1,
  type McftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_arm_contract_v1.js";

type JsonRecordV3 = Record<string, unknown>;

export type BuiltMcftCap09Am19FormalV5ManifestV1 = {
  arm: McftCap09FormalV5ArmV1;
  bundle: ExternalFormalPrewindowAuthorityBundleV5;
  manifest: ExternalFormalAmendment19WindowManifestV1 & ExternalFormalV3Am19WindowManifestV1;
  crop_authority: JsonRecordV3;
  configuration_matrix: JsonRecordV3;
  current_crop_authority: JsonRecordV3;
  biological_stage_architecture_effectiveness: JsonRecordV3;
};

function recordV3(value: unknown, code: string): JsonRecordV3 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as JsonRecordV3;
}
function textV3(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function integerV3(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(code);
  return value;
}
function digestV3(value: unknown, code: string): string {
  const text = textV3(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}
function materializationHashV3(
  materialized: ReturnType<typeof materializeExternalFormalA18CropContextV4>,
): string {
  return semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V4,
    context_ref: materialized.context_ref,
    context_identity_hash: materialized.context_identity_hash,
    current_crop_authority_evidence_digest:
      materialized.current_crop_authority_evidence_digest,
    materialized_context: materialized.context,
  });
}

function validateEffectiveCurrentCropV3(value: JsonRecordV3): {
  stage: "LATE";
  evidence_digest: string;
  stage_authority_as_of: string;
  stage_authority_valid_until: string;
  forward_stability_hours: number;
} {
  if (
    value.schema_version !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || value.status !== "PASS"
    || value.qualification_outcome !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
    || value.architecture_effective !== true
    || value.runtime_consumption_authorized !== true
  ) throw new Error("AM19_V5_CURRENT_CROP_AUTHORITY_EFFECTIVE_REQUIRED");
  if (value.crop_water_use_stage !== "LATE") throw new Error("AM19_V5_CURRENT_CROP_LATE_REQUIRED");
  const biological = recordV3(value.biological_stage, "AM19_V5_CURRENT_CROP_BIOLOGICAL_STAGE_REQUIRED");
  if (
    biological.epistemic_class !== "THERMAL_MODEL_DERIVED"
    || biological.resolved_biological_stage !== "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"
    || biological.observed_biological_stage_claimed !== false
  ) throw new Error("AM19_V5_CURRENT_CROP_BIOLOGICAL_STAGE_MISMATCH");
  const evidenceDigest = digestV3(value.evidence_digest, "AM19_V5_CURRENT_CROP_EVIDENCE_DIGEST_REQUIRED");
  const asOf = textV3(biological.authority_as_of, "AM19_V5_CURRENT_CROP_STAGE_AUTHORITY_AS_OF_REQUIRED");
  const validUntil = textV3(biological.authority_valid_until, "AM19_V5_CURRENT_CROP_STAGE_VALID_UNTIL_REQUIRED");
  for (const [time,code] of [[asOf,"AM19_V5_CURRENT_CROP_STAGE_AUTHORITY_AS_OF_INVALID"],[validUntil,"AM19_V5_CURRENT_CROP_STAGE_VALID_UNTIL_INVALID"]] as const) {
    if (!Number.isFinite(Date.parse(time)) || new Date(Date.parse(time)).toISOString() !== time) throw new Error(code);
  }
  const forwardHours = integerV3(biological.forward_stability_hours, "AM19_V5_CURRENT_CROP_FORWARD_STABILITY_HOURS_REQUIRED");
  if (forwardHours <= 0 || forwardHours > 48) throw new Error("AM19_V5_CURRENT_CROP_FORWARD_STABILITY_HOURS_INVALID");
  return { stage:"LATE", evidence_digest:evidenceDigest, stage_authority_as_of:asOf, stage_authority_valid_until:validUntil, forward_stability_hours:forwardHours };
}

function validateArchitectureEffectivenessV3(value: JsonRecordV3): void {
  if (
    value.schema_version !== "geox_dt02_biological_stage_authority_effectiveness_v1"
    || value.amendment_id !== "DT02-AMENDMENT-03"
    || value.status !== "EFFECTIVE"
    || value.effective !== true
  ) throw new Error("AM19_V5_STAGE_ARCHITECTURE_EFFECTIVENESS_REQUIRED");
}

export function buildMcftCap09Am19FormalV5ManifestV1(input: {
  arm: McftCap09FormalV5ArmV1;
  crop_authority: JsonRecordV3;
  configuration_matrix: JsonRecordV3;
  current_crop_authority: JsonRecordV3;
  current_crop_authority_sha256: string;
  biological_stage_architecture_effectiveness: JsonRecordV3;
  expected_subject_sha?: string;
}): BuiltMcftCap09Am19FormalV5ManifestV1 {
  validateMcftCap09FormalV5ArmV1(input.arm, input.expected_subject_sha);
  if (input.arm.formal_database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V5) {
    throw new Error("AM19_V5_FORMAL_DATABASE_REQUIRED");
  }
  if (digestV3(input.current_crop_authority_sha256, "AM19_V5_CURRENT_CROP_FILE_DIGEST_REQUIRED") !== input.arm.current_crop_authority_sha256) {
    throw new Error("AM19_V5_CURRENT_CROP_FILE_DIGEST_MISMATCH");
  }
  const current = validateEffectiveCurrentCropV3(input.current_crop_authority);
  validateArchitectureEffectivenessV3(input.biological_stage_architecture_effectiveness);
  if (
    current.evidence_digest !== input.arm.current_crop_authority_evidence_digest
    || current.stage_authority_as_of !== input.arm.stage_authority_as_of
    || current.stage_authority_valid_until !== input.arm.stage_authority_valid_until
  ) throw new Error("AM19_V5_CURRENT_CROP_ARM_BINDING_MISMATCH");

  const arm = input.arm;
  const bundle = buildExternalFormalPrewindowAuthorityBundleV5({
    epoch_id: arm.epoch_id,
    bootstrap_logical_time: arm.a0,
    created_at: arm.arm_evaluated_at,
    bootstrap_crop_stage_code: current.stage,
    hourly_crop_stage_codes: Array.from({ length: 24 }, () => current.stage),
    current_crop_authority_evidence_digest: current.evidence_digest,
    stage_authority_as_of: current.stage_authority_as_of,
    forward_stability_hours: current.forward_stability_hours,
    fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
    fresh_database_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
  });
  if (bundle.o00_logical_time !== arm.o00 || bundle.o23_logical_time !== arm.o23) {
    throw new Error("AM19_V5_FORMAL_MANIFEST_COMPILED_WINDOW_DRIFT");
  }

  const materializationPins = bundle.hourly_crop_pins.map((pin) => {
    const materialized = materializeExternalFormalA18CropContextV4({
      logical_time: pin.logical_time,
      expected_identity_hash: pin.crop_stage_context_hash,
      crop_authority: input.crop_authority,
      configuration_matrix: input.configuration_matrix,
      current_crop_authority: input.current_crop_authority,
      biological_stage_architecture_effectiveness: input.biological_stage_architecture_effectiveness,
      activation_mode: "PRODUCTION_EFFECTIVE",
    });
    if (materialized.context_identity_hash !== pin.crop_stage_context_hash) {
      throw new Error(`AM19_V5_FORMAL_MANIFEST_CROP_IDENTITY_DRIFT:${pin.slot_id}`);
    }
    if (materialized.production_effective !== true) {
      throw new Error(`AM19_V5_FORMAL_MANIFEST_PRODUCTION_EFFECT_REQUIRED:${pin.slot_id}`);
    }
    return {
      slot_id: pin.slot_id,
      logical_time: pin.logical_time,
      crop_stage_context_materialization_hash: materializationHashV3(materialized),
    };
  });

  const manifest = buildExternalFormalAmendment19WindowManifestV1({
    subject_sha: arm.subject_sha,
    database_name: arm.formal_database_name,
    manifest_ref: arm.manifest_ref,
    bundle,
    crop_context_materialization_pins: materializationPins,
  });
  validateExternalFormalAmendment19WindowManifestV1(manifest, arm.subject_sha);
  return {
    arm,
    bundle,
    manifest: manifest as ExternalFormalAmendment19WindowManifestV1 & ExternalFormalV3Am19WindowManifestV1,
    crop_authority: input.crop_authority,
    configuration_matrix: input.configuration_matrix,
    current_crop_authority: input.current_crop_authority,
    biological_stage_architecture_effectiveness: input.biological_stage_architecture_effectiveness,
  };
}
