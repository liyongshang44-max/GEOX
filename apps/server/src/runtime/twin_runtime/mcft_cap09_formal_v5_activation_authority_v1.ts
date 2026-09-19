// MCFT-CAP-09 H6B Formal-v5 production activation authority loader.
//
// This is a read-only authority seam for the long-running Formal-v5 Twin process.
// It deliberately does not reuse the pre-Formal runtime-start authority. The active
// process requires the immutable Formal arm, successful A0 bootstrap proof, exact
// manifest, and the A0-selected current-crop authority digest.

import crypto from "node:crypto";
import fs from "node:fs";

import {
  validateExternalFormalAmendment19WindowManifestV1,
  type ExternalFormalAmendment19WindowManifestV1,
} from "../../domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";

export const MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1 =
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const;

export const MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1 =
  "FORMAL_V5_ACTIVE" as const;

type JsonRecordV1 = Record<string, unknown>;

export type McftCap09FormalV5ArmAuthorityV1 = {
  schema_version: "geox_mcft_cap09_formal_v5_arm_v1";
  status: "PASS";
  subject_sha: string;
  formal_database_name: typeof MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1;
  arm_time_database_utc: string;
  epoch_id: string;
  manifest_ref: string;
  a0: string;
  o00: string;
  o23: string;
  arm_identity_hash: string;
  formal_v5_arm: true;
  formal_v5_epoch_selected: true;
  formal_database_mutation: false;
  a0_bootstrap: false;
  o00_started: false;
  provider_request_count: 0;
  final_actual_24h_still_required: true;
  mcft_cap09_completed: false;
};

export type McftCap09FormalV5A0BootstrapProofV1 = {
  schema_version: "geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1";
  status: "PASS";
  arm_runtime_semantic_subject_sha: string;
  authority_continuity_head_sha: string;
  arm_identity_hash: string;
  epoch_id: string;
  manifest_ref: string;
  manifest_hash: string;
  formal_database_name: typeof MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1;
  current_crop_authority_ref: string;
  current_crop_authority_sha256: string;
  a0: string;
  o00: string;
  o23: string;
  hourly_runtime_config_count: 24;
  scheduler_slot_count: 0;
  next_tick_logical_time: string;
  lease_owner: string;
  lease_fencing_token: string;
  lease_expires_at: string;
  lease_expiry_lte_o00: true;
  provider_request_count: 0;
  formal_v5_arm: true;
  formal_a0_bootstrapped: true;
  formal_o00_started: false;
  store_reuse_authorized_after_success: true;
  human_override_used: false;
  mcft_cap09_completed: false;
};

export type McftCap09FormalV5ActivationAuthorityV1 = {
  mode: typeof MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1;
  arm: McftCap09FormalV5ArmAuthorityV1;
  bootstrap: McftCap09FormalV5A0BootstrapProofV1;
  manifest:
    ExternalFormalAmendment19WindowManifestV1
    & ExternalFormalV4Am19WindowManifestV2;
  current_crop_authority: JsonRecordV1;
};

function recordV1(value: unknown, code: string): JsonRecordV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as JsonRecordV1;
}

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function sha256V1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^sha256:[0-9a-f]{64}$/.test(text)) throw new Error(code);
  return text;
}

function subjectV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  if (!/^[0-9a-f]{40}$/.test(text)) throw new Error(code);
  return text;
}

function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}

function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function readJsonV1(pathValue: string, code: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(pathValue, "utf8"));
  } catch (error) {
    throw new Error(
      `${code}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function fileSha256V1(pathValue: string, code: string): string {
  try {
    return "sha256:" + crypto
      .createHash("sha256")
      .update(fs.readFileSync(pathValue))
      .digest("hex");
  } catch (error) {
    throw new Error(
      `${code}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function validateArmV1(
  value: unknown,
  expectedSubject: string,
): McftCap09FormalV5ArmAuthorityV1 {
  const arm = recordV1(value, "FORMAL_V5_ACTIVE_ARM_REQUIRED");
  if (
    arm.schema_version !== "geox_mcft_cap09_formal_v5_arm_v1"
    || arm.status !== "PASS"
    || arm.formal_database_name !== MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1
    || arm.formal_v5_arm !== true
    || arm.formal_v5_epoch_selected !== true
    || arm.formal_database_mutation !== false
    || arm.a0_bootstrap !== false
    || arm.o00_started !== false
    || arm.provider_request_count !== 0
    || arm.final_actual_24h_still_required !== true
    || arm.mcft_cap09_completed !== false
  ) {
    throw new Error("FORMAL_V5_ACTIVE_ARM_CONTRACT_INVALID");
  }
  if (
    subjectV1(arm.subject_sha, "FORMAL_V5_ACTIVE_ARM_SUBJECT_INVALID")
    !== expectedSubject
  ) {
    throw new Error("FORMAL_V5_ACTIVE_ARM_SUBJECT_MISMATCH");
  }
  textV1(arm.epoch_id, "FORMAL_V5_ACTIVE_ARM_EPOCH_REQUIRED");
  sha256V1(
    arm.arm_identity_hash,
    "FORMAL_V5_ACTIVE_ARM_IDENTITY_HASH_INVALID",
  );
  isoV1(arm.arm_time_database_utc, "FORMAL_V5_ACTIVE_ARM_TIME_INVALID");
  const a0 = hourV1(arm.a0, "FORMAL_V5_ACTIVE_ARM_A0_INVALID");
  const o00 = hourV1(arm.o00, "FORMAL_V5_ACTIVE_ARM_O00_INVALID");
  const o23 = hourV1(arm.o23, "FORMAL_V5_ACTIVE_ARM_O23_INVALID");
  if (Date.parse(o00) - Date.parse(a0) !== 3_600_000) {
    throw new Error("FORMAL_V5_ACTIVE_ARM_A0_O00_OFFSET_INVALID");
  }
  if (Date.parse(o23) - Date.parse(o00) !== 23 * 3_600_000) {
    throw new Error("FORMAL_V5_ACTIVE_ARM_O00_O23_SPAN_INVALID");
  }
  return arm as unknown as McftCap09FormalV5ArmAuthorityV1;
}

function validateBootstrapV1(
  value: unknown,
  arm: McftCap09FormalV5ArmAuthorityV1,
): McftCap09FormalV5A0BootstrapProofV1 {
  const proof = recordV1(value, "FORMAL_V5_ACTIVE_A0_BOOTSTRAP_REQUIRED");
  if (
    proof.schema_version
      !== "geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1"
    || proof.status !== "PASS"
    || proof.formal_database_name !== MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1
    || proof.hourly_runtime_config_count !== 24
    || proof.scheduler_slot_count !== 0
    || proof.lease_expiry_lte_o00 !== true
    || proof.provider_request_count !== 0
    || proof.formal_v5_arm !== true
    || proof.formal_a0_bootstrapped !== true
    || proof.formal_o00_started !== false
    || proof.store_reuse_authorized_after_success !== true
    || proof.human_override_used !== false
    || proof.mcft_cap09_completed !== false
  ) {
    throw new Error("FORMAL_V5_ACTIVE_A0_BOOTSTRAP_CONTRACT_INVALID");
  }
  if (
    subjectV1(
      proof.arm_runtime_semantic_subject_sha,
      "FORMAL_V5_ACTIVE_BOOTSTRAP_SUBJECT_INVALID",
    ) !== arm.subject_sha
    || proof.arm_identity_hash !== arm.arm_identity_hash
    || proof.epoch_id !== arm.epoch_id
    || proof.manifest_ref !== arm.manifest_ref
    || proof.a0 !== arm.a0
    || proof.o00 !== arm.o00
    || proof.o23 !== arm.o23
    || proof.next_tick_logical_time !== arm.o00
  ) {
    throw new Error("FORMAL_V5_ACTIVE_ARM_BOOTSTRAP_IDENTITY_MISMATCH");
  }
  sha256V1(
    proof.current_crop_authority_sha256,
    "FORMAL_V5_ACTIVE_CURRENT_CROP_DIGEST_INVALID",
  );
  sha256V1(
    proof.manifest_hash,
    "FORMAL_V5_ACTIVE_MANIFEST_HASH_INVALID",
  );
  isoV1(
    proof.lease_expires_at,
    "FORMAL_V5_ACTIVE_BOOTSTRAP_LEASE_EXPIRY_INVALID",
  );
  if (Date.parse(String(proof.lease_expires_at)) > Date.parse(arm.o00)) {
    throw new Error("FORMAL_V5_ACTIVE_BOOTSTRAP_LEASE_EXPIRES_AFTER_O00");
  }
  return proof as unknown as McftCap09FormalV5A0BootstrapProofV1;
}

function validateCurrentCropV1(
  value: unknown,
  bootstrap: McftCap09FormalV5A0BootstrapProofV1,
  currentCropPath: string,
): JsonRecordV1 {
  const crop = recordV1(
    value,
    "FORMAL_V5_ACTIVE_CURRENT_CROP_AUTHORITY_REQUIRED",
  );
  if (
    fileSha256V1(
      currentCropPath,
      "FORMAL_V5_ACTIVE_CURRENT_CROP_FILE_INVALID",
    ) !== bootstrap.current_crop_authority_sha256
  ) {
    throw new Error("FORMAL_V5_ACTIVE_CURRENT_CROP_DIGEST_MISMATCH");
  }
  if (
    crop.schema_version
      !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || crop.status !== "PASS"
    || crop.qualification_outcome
      !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
    || crop.architecture_effective !== true
    || crop.runtime_consumption_authorized !== true
  ) {
    throw new Error("FORMAL_V5_ACTIVE_CURRENT_CROP_NOT_EFFECTIVE");
  }
  const lifecycle = recordV1(
    crop.lifecycle,
    "FORMAL_V5_ACTIVE_CURRENT_CROP_LIFECYCLE_REQUIRED",
  );
  if (
    lifecycle.domain_state !== "ACTIVE"
    || lifecycle.authority_status !== "RESOLVED"
    || lifecycle.authority_validity !== "VALID"
    || lifecycle.authority_mode !== "GOVERNED_PERSISTENT_STATE"
  ) {
    throw new Error("FORMAL_V5_ACTIVE_CURRENT_CROP_LIFECYCLE_INVALID");
  }
  const horizon = isoV1(
    lifecycle.horizon_end_utc,
    "FORMAL_V5_ACTIVE_CURRENT_CROP_HORIZON_INVALID",
  );
  if (Date.parse(horizon) < Date.parse(bootstrap.o23)) {
    throw new Error("FORMAL_V5_ACTIVE_CURRENT_CROP_HORIZON_BEFORE_O23");
  }
  return crop;
}

export function loadMcftCap09FormalV5ActivationAuthorityV1(input: {
  expected_subject_sha: string;
  arm_path: string;
  a0_bootstrap_path: string;
  manifest_path: string;
  current_crop_authority_path: string;
}): McftCap09FormalV5ActivationAuthorityV1 {
  const expectedSubject = subjectV1(
    input.expected_subject_sha,
    "FORMAL_V5_ACTIVE_EXPECTED_SUBJECT_INVALID",
  );
  const arm = validateArmV1(
    readJsonV1(input.arm_path, "FORMAL_V5_ACTIVE_ARM_FILE_INVALID"),
    expectedSubject,
  );
  const bootstrap = validateBootstrapV1(
    readJsonV1(
      input.a0_bootstrap_path,
      "FORMAL_V5_ACTIVE_A0_BOOTSTRAP_FILE_INVALID",
    ),
    arm,
  );
  const manifestRaw = readJsonV1(
    input.manifest_path,
    "FORMAL_V5_ACTIVE_MANIFEST_FILE_INVALID",
  ) as ExternalFormalAmendment19WindowManifestV1;
  validateExternalFormalAmendment19WindowManifestV1(
    manifestRaw,
    expectedSubject,
  );
  if (
    manifestRaw.database_name !== MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1
    || manifestRaw.epoch_id !== arm.epoch_id
    || manifestRaw.manifest_ref !== bootstrap.manifest_ref
    || manifestRaw.manifest_hash !== bootstrap.manifest_hash
    || manifestRaw.o00_logical_time !== arm.o00
    || manifestRaw.o23_logical_time !== arm.o23
  ) {
    throw new Error("FORMAL_V5_ACTIVE_MANIFEST_BOOTSTRAP_IDENTITY_MISMATCH");
  }
  const currentCrop = validateCurrentCropV1(
    readJsonV1(
      input.current_crop_authority_path,
      "FORMAL_V5_ACTIVE_CURRENT_CROP_FILE_INVALID",
    ),
    bootstrap,
    input.current_crop_authority_path,
  );

  return {
    mode: MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
    arm,
    bootstrap,
    manifest: manifestRaw as
      ExternalFormalAmendment19WindowManifestV1
      & ExternalFormalV4Am19WindowManifestV2,
    current_crop_authority: currentCrop,
  };
}
