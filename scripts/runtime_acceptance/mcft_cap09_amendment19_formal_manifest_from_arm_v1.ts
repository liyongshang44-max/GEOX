import {
  buildExternalFormalAmendment19WindowManifestV1,
  validateExternalFormalAmendment19WindowManifestV1,
  type ExternalFormalAmendment19WindowManifestV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3,
  type ExternalFormalPrewindowAuthorityBundleV3,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
  materializeExternalFormalA18CropContextV3,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v3.js";
import type { ExternalFormalV3Am19WindowManifestV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";

export const MCFT_CAP09_AM19_FORMAL_DATABASE_V3 = "geox_mcft_cap09_s6_formal_t4r1_24h_v3" as const;
export const MCFT_CAP09_AM19_FAILED_FORMAL_DATABASE_V2 = "geox_mcft_cap09_s6_formal_t4r1_24h_v2" as const;

export type McftCap09Am19FormalArmV1 = {
  schema_version: "geox_mcft_cap09_amendment19_formal_arm_v1";
  status: "PASS";
  subject_sha: string;
  arm_identity_hash: string;
  epoch_id: string;
  formal_database_name: string;
  a0: string;
  o00: string;
  o23: string;
  manifest_ref: string;
  rolling: {
    captured_at: string;
    target_t: string;
  };
  temporal_authority: "PROVIDER_AVAILABILITY_WATERMARK_V1";
  bootstrap_lease_clock_required: "REAL_DATABASE_TRANSACTION_TIMESTAMP";
  formal_clock_mode_required: "SYSTEM_DATABASE_UTC";
  accelerated_clock_authorized_for_formal: false;
  formal_database_write_count: 0;
  formal_o00_started: false;
  final_actual_24h_still_required: true;
  human_override_used: false;
  mcft_cap09_completed: false;
};

export type BuiltMcftCap09Am19FormalManifestV1 = {
  arm: McftCap09Am19FormalArmV1;
  bundle: ExternalFormalPrewindowAuthorityBundleV3;
  manifest: ExternalFormalAmendment19WindowManifestV1 & ExternalFormalV3Am19WindowManifestV1;
  crop_authority: Record<string, unknown>;
  configuration_matrix: Record<string, unknown>;
};

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIso(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactSubject(value: unknown): string {
  const subject = requiredText(value, "AM19_FORMAL_MANIFEST_SUBJECT_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_FORMAL_MANIFEST_EXACT_SUBJECT_REQUIRED");
  return subject;
}

function materializationHash(materialized: ReturnType<typeof materializeExternalFormalA18CropContextV3>): string {
  return semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
    context_ref: materialized.context_ref,
    context_identity_hash: materialized.context_identity_hash,
    materialized_context: materialized.context,
  });
}

export function validateMcftCap09Am19FormalArmV1(arm: McftCap09Am19FormalArmV1, expectedSubject?: string): void {
  if (arm?.schema_version !== "geox_mcft_cap09_amendment19_formal_arm_v1" || arm.status !== "PASS") {
    throw new Error("AM19_FORMAL_MANIFEST_ARM_PASS_REQUIRED");
  }
  const subject = exactSubject(arm.subject_sha);
  if (expectedSubject !== undefined && subject !== exactSubject(expectedSubject)) throw new Error("AM19_FORMAL_MANIFEST_ARM_SUBJECT_MISMATCH");
  if (arm.formal_database_name !== MCFT_CAP09_AM19_FORMAL_DATABASE_V3) {
    throw new Error("AM19_FORMAL_MANIFEST_T4_ACTUAL_FORMAL_DATABASE_REQUIRED");
  }
  const a0 = canonicalIso(arm.a0, "AM19_FORMAL_MANIFEST_A0_INVALID");
  const o00 = canonicalIso(arm.o00, "AM19_FORMAL_MANIFEST_O00_INVALID");
  const o23 = canonicalIso(arm.o23, "AM19_FORMAL_MANIFEST_O23_INVALID");
  if (Date.parse(o00) - Date.parse(a0) !== 3_600_000 || Date.parse(o23) - Date.parse(a0) !== 24 * 3_600_000) {
    throw new Error("AM19_FORMAL_MANIFEST_ARM_WINDOW_DRIFT");
  }
  if (arm.rolling?.target_t !== a0) throw new Error("AM19_FORMAL_MANIFEST_ROLLING_A0_DRIFT");
  canonicalIso(arm.rolling?.captured_at, "AM19_FORMAL_MANIFEST_CAPTURED_AT_INVALID");
  if (Date.parse(arm.rolling.captured_at) > Date.parse(a0)) throw new Error("AM19_FORMAL_MANIFEST_CAPTURE_AFTER_A0_FORBIDDEN");
  if (arm.temporal_authority !== "PROVIDER_AVAILABILITY_WATERMARK_V1") throw new Error("AM19_FORMAL_MANIFEST_TEMPORAL_AUTHORITY_REQUIRED");
  if (arm.bootstrap_lease_clock_required !== "REAL_DATABASE_TRANSACTION_TIMESTAMP" || arm.formal_clock_mode_required !== "SYSTEM_DATABASE_UTC" || arm.accelerated_clock_authorized_for_formal !== false) {
    throw new Error("AM19_FORMAL_MANIFEST_REAL_CLOCK_AUTHORITY_REQUIRED");
  }
  if (arm.formal_database_write_count !== 0 || arm.formal_o00_started !== false || arm.final_actual_24h_still_required !== true || arm.human_override_used !== false || arm.mcft_cap09_completed !== false) {
    throw new Error("AM19_FORMAL_MANIFEST_ARM_PREMATURE_EFFECT_FORBIDDEN");
  }
}

export function buildMcftCap09Am19FormalManifestFromArmV1(input: {
  arm: McftCap09Am19FormalArmV1;
  crop_authority: Record<string, unknown>;
  configuration_matrix: Record<string, unknown>;
  expected_subject_sha?: string;
}): BuiltMcftCap09Am19FormalManifestV1 {
  validateMcftCap09Am19FormalArmV1(input.arm, input.expected_subject_sha);
  const arm = input.arm;
  const bundle = buildExternalFormalPrewindowAuthorityBundleV3({
    epoch_id: arm.epoch_id,
    bootstrap_logical_time: arm.a0,
    created_at: arm.rolling.captured_at,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_stage_codes: Array.from({ length: 24 }, () => "MID" as const),
    fresh_database_authority_ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3,
    fresh_database_authority_blob_sha: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3,
  });
  if (bundle.o00_logical_time !== arm.o00 || bundle.o23_logical_time !== arm.o23) throw new Error("AM19_FORMAL_MANIFEST_COMPILED_WINDOW_DRIFT");

  const materializationPins = bundle.hourly_crop_pins.map((pin) => {
    const materialized = materializeExternalFormalA18CropContextV3({
      logical_time: pin.logical_time,
      expected_identity_hash: pin.crop_stage_context_hash,
      crop_authority: input.crop_authority,
      configuration_matrix: input.configuration_matrix,
    });
    if (materialized.context_identity_hash !== pin.crop_stage_context_hash) {
      throw new Error(`AM19_FORMAL_MANIFEST_CROP_IDENTITY_DRIFT:${pin.slot_id}`);
    }
    return {
      slot_id: pin.slot_id,
      logical_time: pin.logical_time,
      crop_stage_context_materialization_hash: materializationHash(materialized),
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
  const productionManifest = manifest as unknown as ExternalFormalAmendment19WindowManifestV1 & ExternalFormalV3Am19WindowManifestV1;
  return {
    arm,
    bundle,
    manifest: productionManifest,
    crop_authority: input.crop_authority,
    configuration_matrix: input.configuration_matrix,
  };
}
