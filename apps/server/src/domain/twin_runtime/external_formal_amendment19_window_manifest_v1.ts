// Purpose: one pure Amendment-19 manifest builder shared by accelerated qualification and real Formal.
// Boundary: no filesystem, database, provider, scheduler, clock, persistence, or Formal side effect.

import { semanticHashV1 } from "./canonical_identity_v1.js";
import type { ExternalFormalPrewindowAuthorityBundleV3 } from "./external_formal_prewindow_authority_bundle_v3.js";

export const MCFT_CAP09_AM19_SHARED_WINDOW_MANIFEST_PROFILE_V1 =
  "MCFT_CAP09_AM19_SHARED_WINDOW_MANIFEST_V1" as const;

export type ExternalFormalAmendment19ManifestSlotPinV1 = {
  manifest_ref: string;
  manifest_hash: string;
  epoch_id: string;
  slot_id: string;
  logical_time: string;
  runtime_config_ref: string;
  runtime_config_hash: string;
  parent_runtime_config_ref: string;
  parent_runtime_config_hash: string;
  crop_stage_context_ref: string;
  crop_stage_context_hash: string;
  crop_stage_context_materialization_hash: string;
};

export type ExternalFormalAmendment19WindowManifestV1 = {
  schema_version: "geox_mcft_cap09_amendment19_window_manifest_v1";
  subject_sha: string;
  manifest_ref: string;
  manifest_hash: string;
  epoch_id: string;
  database_name: string;
  scope: ExternalFormalPrewindowAuthorityBundleV3["persistence_bundle"]["scope"];
  o00_logical_time: string;
  o23_logical_time: string;
  slots: readonly ExternalFormalAmendment19ManifestSlotPinV1[];
};

export type ExternalFormalAmendment19MaterializationPinV1 = {
  slot_id: string;
  logical_time: string;
  crop_stage_context_materialization_hash: string;
};

export type BuildExternalFormalAmendment19WindowManifestInputV1 = {
  subject_sha: string;
  database_name: string;
  manifest_ref: string;
  bundle: ExternalFormalPrewindowAuthorityBundleV3;
  crop_context_materialization_pins: readonly ExternalFormalAmendment19MaterializationPinV1[];
};

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function exactSubjectV1(value: unknown): string {
  const subject = requiredTextV1(value, "AM19_MANIFEST_SUBJECT_SHA_REQUIRED");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("AM19_MANIFEST_EXACT_SUBJECT_SHA_REQUIRED");
  return subject;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredTextV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactSlotIdV1(index: number): string {
  return `O${String(index).padStart(2, "0")}`;
}

function slotCoreV1(manifest: ExternalFormalAmendment19WindowManifestV1): Array<Record<string, string>> {
  return manifest.slots.map((slot) => ({
    epoch_id: slot.epoch_id,
    slot_id: slot.slot_id,
    logical_time: slot.logical_time,
    runtime_config_ref: slot.runtime_config_ref,
    runtime_config_hash: slot.runtime_config_hash,
    parent_runtime_config_ref: slot.parent_runtime_config_ref,
    parent_runtime_config_hash: slot.parent_runtime_config_hash,
    crop_stage_context_ref: slot.crop_stage_context_ref,
    crop_stage_context_hash: slot.crop_stage_context_hash,
    crop_stage_context_materialization_hash: slot.crop_stage_context_materialization_hash,
  }));
}

function manifestSemanticHashV1(input: {
  subject_sha: string;
  manifest_ref: string;
  epoch_id: string;
  database_name: string;
  scope: ExternalFormalAmendment19WindowManifestV1["scope"];
  o00_logical_time: string;
  o23_logical_time: string;
  slots: readonly Record<string, string>[];
}): string {
  return semanticHashV1({
    profile: MCFT_CAP09_AM19_SHARED_WINDOW_MANIFEST_PROFILE_V1,
    subject_sha: input.subject_sha,
    manifest_ref: input.manifest_ref,
    epoch_id: input.epoch_id,
    database_name: input.database_name,
    scope: input.scope,
    o00: input.o00_logical_time,
    o23: input.o23_logical_time,
    slots: input.slots,
  });
}

export function buildExternalFormalAmendment19WindowManifestV1(
  input: BuildExternalFormalAmendment19WindowManifestInputV1,
): ExternalFormalAmendment19WindowManifestV1 {
  const subjectSha = exactSubjectV1(input.subject_sha);
  const databaseName = requiredTextV1(input.database_name, "AM19_MANIFEST_DATABASE_NAME_REQUIRED");
  if (databaseName === "geox_mcft_cap09_s6_formal_t3r1_24h_v2") {
    throw new Error("AM19_MANIFEST_FAILED_V2_DATABASE_REUSE_FORBIDDEN");
  }
  const manifestRef = requiredTextV1(input.manifest_ref, "AM19_MANIFEST_REF_REQUIRED");
  const bundle = input.bundle;
  const epochId = requiredTextV1(bundle?.epoch_id, "AM19_MANIFEST_EPOCH_ID_REQUIRED");
  const o00 = canonicalIsoV1(bundle?.o00_logical_time, "AM19_MANIFEST_O00_INVALID");
  const o23 = canonicalIsoV1(bundle?.o23_logical_time, "AM19_MANIFEST_O23_INVALID");
  if (Date.parse(o23) - Date.parse(o00) !== 23 * 3_600_000) throw new Error("AM19_MANIFEST_EXACT_O00_O23_SPAN_REQUIRED");

  const configs = bundle?.persistence_bundle?.runtime_configs ?? [];
  const cropPins = bundle?.hourly_crop_pins ?? [];
  if (configs.length !== 24 || cropPins.length !== 24 || input.crop_context_materialization_pins.length !== 24) {
    throw new Error("AM19_MANIFEST_EXACT_24_INPUTS_REQUIRED");
  }
  const materializationBySlot = new Map(
    input.crop_context_materialization_pins.map((pin) => [`${pin.slot_id}|${pin.logical_time}`, pin]),
  );
  if (materializationBySlot.size !== 24) throw new Error("AM19_MANIFEST_EXACT_24_MATERIALIZATION_PINS_REQUIRED");

  const slotCore = configs.map((config, index) => {
    const pin = cropPins[index]!;
    const expectedSlotId = exactSlotIdV1(index);
    const expectedLogicalTime = new Date(Date.parse(o00) + index * 3_600_000).toISOString();
    if (pin.slot_id !== expectedSlotId || pin.logical_time !== expectedLogicalTime) {
      throw new Error(`AM19_MANIFEST_SLOT_SEQUENCE_DRIFT:${expectedSlotId}`);
    }
    const materialization = materializationBySlot.get(`${pin.slot_id}|${pin.logical_time}`);
    if (!materialization) throw new Error(`AM19_MANIFEST_MATERIALIZATION_PIN_REQUIRED:${pin.slot_id}`);
    const materializationHash = requiredTextV1(
      materialization.crop_stage_context_materialization_hash,
      `AM19_MANIFEST_MATERIALIZATION_HASH_REQUIRED:${pin.slot_id}`,
    );
    const payload = config.payload as Record<string, any>;
    const parentRef = requiredTextV1(payload.parent_runtime_config_ref, `AM19_MANIFEST_PARENT_REF_REQUIRED:${pin.slot_id}`);
    const parentHash = requiredTextV1(payload.parent_runtime_config_hash, `AM19_MANIFEST_PARENT_HASH_REQUIRED:${pin.slot_id}`);
    const cropAuthority = payload.crop_stage_context_authority as Record<string, unknown> | undefined;
    const contextRef = requiredTextV1(cropAuthority?.context_ref, `AM19_MANIFEST_CROP_CONTEXT_REF_REQUIRED:${pin.slot_id}`);
    if (cropAuthority?.context_hash !== pin.crop_stage_context_hash) {
      throw new Error(`AM19_MANIFEST_CROP_CONTEXT_HASH_DRIFT:${pin.slot_id}`);
    }
    if (payload.effective_logical_time !== pin.logical_time) {
      throw new Error(`AM19_MANIFEST_RUNTIME_CONFIG_TIME_DRIFT:${pin.slot_id}`);
    }
    return {
      epoch_id: epochId,
      slot_id: pin.slot_id,
      logical_time: pin.logical_time,
      runtime_config_ref: config.object_id,
      runtime_config_hash: config.determinism_hash,
      parent_runtime_config_ref: parentRef,
      parent_runtime_config_hash: parentHash,
      crop_stage_context_ref: contextRef,
      crop_stage_context_hash: pin.crop_stage_context_hash,
      crop_stage_context_materialization_hash: materializationHash,
    };
  });

  const bootstrap = bundle.persistence_bundle.bootstrap_runtime_config;
  if (slotCore[0]!.parent_runtime_config_ref !== bootstrap.object_id
    || slotCore[0]!.parent_runtime_config_hash !== bootstrap.determinism_hash) {
    throw new Error("AM19_MANIFEST_O00_PARENT_MUST_BE_A0");
  }
  for (let index = 1; index < slotCore.length; index += 1) {
    if (slotCore[index]!.parent_runtime_config_ref !== slotCore[index - 1]!.runtime_config_ref
      || slotCore[index]!.parent_runtime_config_hash !== slotCore[index - 1]!.runtime_config_hash) {
      throw new Error(`AM19_MANIFEST_PARENT_CHAIN_DRIFT:${slotCore[index]!.slot_id}`);
    }
  }

  const manifestHash = manifestSemanticHashV1({
    subject_sha: subjectSha,
    manifest_ref: manifestRef,
    epoch_id: epochId,
    database_name: databaseName,
    scope: bundle.persistence_bundle.scope,
    o00_logical_time: o00,
    o23_logical_time: o23,
    slots: slotCore,
  });

  return {
    schema_version: "geox_mcft_cap09_amendment19_window_manifest_v1",
    subject_sha: subjectSha,
    manifest_ref: manifestRef,
    manifest_hash: manifestHash,
    epoch_id: epochId,
    database_name: databaseName,
    scope: { ...bundle.persistence_bundle.scope },
    o00_logical_time: o00,
    o23_logical_time: o23,
    slots: slotCore.map((slot) => ({ ...slot, manifest_ref: manifestRef, manifest_hash: manifestHash })),
  };
}

export function validateExternalFormalAmendment19WindowManifestV1(
  manifest: ExternalFormalAmendment19WindowManifestV1,
  expectedSubjectSha?: string,
): void {
  const subjectSha = exactSubjectV1(manifest.subject_sha);
  if (expectedSubjectSha !== undefined && subjectSha !== exactSubjectV1(expectedSubjectSha)) {
    throw new Error("AM19_MANIFEST_SUBJECT_SHA_MISMATCH");
  }
  if (manifest.schema_version !== "geox_mcft_cap09_amendment19_window_manifest_v1") {
    throw new Error("AM19_MANIFEST_SCHEMA_REQUIRED");
  }
  if (manifest.database_name === "geox_mcft_cap09_s6_formal_t3r1_24h_v2") {
    throw new Error("AM19_MANIFEST_FAILED_V2_DATABASE_REUSE_FORBIDDEN");
  }
  const o00 = canonicalIsoV1(manifest.o00_logical_time, "AM19_MANIFEST_O00_INVALID");
  const o23 = canonicalIsoV1(manifest.o23_logical_time, "AM19_MANIFEST_O23_INVALID");
  if (Date.parse(o23) - Date.parse(o00) !== 23 * 3_600_000) throw new Error("AM19_MANIFEST_EXACT_O00_O23_SPAN_REQUIRED");
  if (manifest.slots.length !== 24) throw new Error("AM19_MANIFEST_EXACT_24_SLOTS_REQUIRED");
  for (let index = 0; index < manifest.slots.length; index += 1) {
    const slot = manifest.slots[index]!;
    const expectedSlotId = exactSlotIdV1(index);
    const expectedLogicalTime = new Date(Date.parse(o00) + index * 3_600_000).toISOString();
    if (slot.slot_id !== expectedSlotId || slot.logical_time !== expectedLogicalTime) {
      throw new Error(`AM19_MANIFEST_SLOT_SEQUENCE_DRIFT:${expectedSlotId}`);
    }
    if (slot.epoch_id !== manifest.epoch_id || slot.manifest_ref !== manifest.manifest_ref || slot.manifest_hash !== manifest.manifest_hash) {
      throw new Error(`AM19_MANIFEST_SLOT_IDENTITY_DRIFT:${slot.slot_id}`);
    }
  }
  const computed = manifestSemanticHashV1({
    subject_sha: subjectSha,
    manifest_ref: manifest.manifest_ref,
    epoch_id: manifest.epoch_id,
    database_name: manifest.database_name,
    scope: manifest.scope,
    o00_logical_time: manifest.o00_logical_time,
    o23_logical_time: manifest.o23_logical_time,
    slots: slotCoreV1(manifest),
  });
  if (computed !== manifest.manifest_hash) throw new Error("AM19_MANIFEST_SEMANTIC_HASH_DRIFT");
}
