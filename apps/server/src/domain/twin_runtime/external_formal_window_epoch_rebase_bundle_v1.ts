// Purpose: deterministically construct the Amendment-06 rebased External Formal O00-O23 Runtime Config chain
// from the already-persisted A0 Runtime Config and the protected-main A06A epoch/slot-context authority.
// Boundary: pure construction only; no filesystem, database, provider network, scheduler, wall clock,
// persistence, recommendation, action, model activation, or Formal-slot execution.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "./external_formal_runtime_config_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "./canonical_object_contracts_v1.js";

export const MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1 =
  "mcft_cap09_external_formal_window_epoch_20260811t170000z_v1" as const;
export const MCFT_CAP09_A06A_SELECTED_O00_V1 = "2026-08-11T17:00:00.000Z" as const;
export const MCFT_CAP09_A06A_SELECTED_O23_V1 = "2026-08-12T16:00:00.000Z" as const;
export const MCFT_CAP09_A06A_EFFECTIVE_AT_V1 = "2026-08-10T05:07:38.000Z" as const;
export const MCFT_CAP09_A06A_AUTHORITY_REF_V1 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json" as const;
export const MCFT_CAP09_A06A_AUTHORITY_BLOB_V1 =
  "c7788d525c56ab83117afbeeec85f2b9f990534f" as const;

export const MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1 =
  "external_formal_runtime_config_7284202e3b0bdae6d32f4814" as const;
export const MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1 =
  "sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8" as const;
export const MCFT_CAP09_EXISTING_EXTERNAL_A0_LOGICAL_TIME_V1 = "2026-08-09T21:00:00.000Z" as const;

export type ExternalFormalRebaseSlotContextV1 = {
  slot_id: string;
  logical_time: string;
  crop_stage_code: "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";
  crop_stage_context_hash: string;
};

export type ExternalFormalWindowEpochRebaseBundleInputV1 = {
  selected_epoch_id: string;
  slots: readonly ExternalFormalRebaseSlotContextV1[];
  existing_a0_runtime_config: CanonicalObjectEnvelopeV1;
};

export type ExternalFormalWindowEpochRebaseBundleV1 = {
  selected_epoch_id: string;
  selected_o00: string;
  selected_o23: string;
  existing_a0_runtime_config_ref: string;
  existing_a0_runtime_config_hash: string;
  runtime_configs: readonly CanonicalObjectEnvelopeV1[];
  runtime_config_refs: readonly string[];
  runtime_config_hashes: readonly string[];
  slot_crop_stage_context_hashes: readonly string[];
  runtime_config_count: 24;
  database_write_count: 0;
  provider_request_count: 0;
  scheduler_slot_write_count: 0;
  formal_window_started: false;
};

function canonicalHourV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return value;
}

function validateExistingA0V1(config: CanonicalObjectEnvelopeV1): ExternalFormalRuntimeConfigPayloadV1 {
  validateCanonicalObjectV1(config);
  if (config.object_type !== "twin_runtime_config_v1") throw new Error("A06B_A0_RUNTIME_CONFIG_TYPE_REQUIRED");
  if (config.object_id !== MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1) throw new Error("A06B_A0_RUNTIME_CONFIG_REF_MISMATCH");
  if (config.determinism_hash !== MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1) throw new Error("A06B_A0_RUNTIME_CONFIG_HASH_MISMATCH");
  if (config.logical_time !== MCFT_CAP09_EXISTING_EXTERNAL_A0_LOGICAL_TIME_V1) throw new Error("A06B_A0_LOGICAL_TIME_MISMATCH");
  for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
    if (config[key as keyof CanonicalObjectEnvelopeV1] !== expected) throw new Error(`A06B_A0_SCOPE_MISMATCH:${key}`);
  }
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (payload.config_role !== "A0_BOOTSTRAP") throw new Error("A06B_A0_CONFIG_ROLE_REQUIRED");
  if (payload.parent_runtime_config_ref !== null || payload.parent_runtime_config_hash !== null) {
    throw new Error("A06B_A0_PARENT_MUST_BE_NULL");
  }
  if (payload.effective_logical_time !== MCFT_CAP09_EXISTING_EXTERNAL_A0_LOGICAL_TIME_V1) {
    throw new Error("A06B_A0_EFFECTIVE_TIME_MISMATCH");
  }
  return payload;
}

function validateSlotsV1(slots: readonly ExternalFormalRebaseSlotContextV1[]): void {
  if (slots.length !== 24) throw new Error("A06B_EXACT_24_SLOT_CONTEXTS_REQUIRED");
  const hashes = new Set<string>();
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const expectedId = `O${String(index).padStart(2, "0")}`;
    const expectedTime = new Date(Date.parse(MCFT_CAP09_A06A_SELECTED_O00_V1) + index * 3_600_000).toISOString();
    if (slot.slot_id !== expectedId) throw new Error(`A06B_SLOT_ID_MISMATCH:${index}`);
    if (canonicalHourV1(slot.logical_time, `A06B_SLOT_TIME_INVALID:${index}`) !== expectedTime) {
      throw new Error(`A06B_SLOT_TIME_MISMATCH:${index}`);
    }
    if (slot.crop_stage_code !== "MID") throw new Error(`A06B_SLOT_CROP_STAGE_MISMATCH:${index}`);
    if (!/^sha256:[0-9a-f]{64}$/.test(slot.crop_stage_context_hash)) {
      throw new Error(`A06B_SLOT_CROP_CONTEXT_HASH_INVALID:${index}`);
    }
    hashes.add(slot.crop_stage_context_hash);
  }
  if (hashes.size !== 24) throw new Error("A06B_SLOT_CROP_CONTEXT_HASHES_MUST_BE_DISTINCT");
  if (slots[23]?.logical_time !== MCFT_CAP09_A06A_SELECTED_O23_V1) throw new Error("A06B_O23_TIME_MISMATCH");
}

export function buildExternalFormalWindowEpochRebaseBundleV1(
  input: ExternalFormalWindowEpochRebaseBundleInputV1,
): ExternalFormalWindowEpochRebaseBundleV1 {
  if (input.selected_epoch_id !== MCFT_CAP09_A06A_SELECTED_EPOCH_ID_V1) throw new Error("A06B_SELECTED_EPOCH_ID_MISMATCH");
  validateSlotsV1(input.slots);
  const a0Payload = validateExistingA0V1(input.existing_a0_runtime_config);

  const runtimeConfigs: CanonicalObjectEnvelopeV1[] = [];
  let parent = input.existing_a0_runtime_config;
  for (const slot of input.slots) {
    const config = compileExternalFormalRuntimeConfigV1({
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      config_role: "HOURLY_CAP04",
      effective_logical_time: slot.logical_time,
      created_at: MCFT_CAP09_A06A_EFFECTIVE_AT_V1,
      parent_runtime_config_ref: parent.object_id,
      parent_runtime_config_hash: parent.determinism_hash,
      reality_binding_ref: a0Payload.reality_binding_ref,
      reality_binding_hash: a0Payload.reality_binding_hash,
      source_matrix_ref: a0Payload.source_matrix_ref,
      source_matrix_hash: a0Payload.source_matrix_hash,
      configuration_matrix_ref: a0Payload.configuration_matrix_ref,
      configuration_matrix_hash: a0Payload.configuration_matrix_hash,
      geometry_semantic_hash: a0Payload.geometry_semantic_hash,
      formal_authorities: structuredClone(a0Payload.formal_authorities),
      crop_stage_context_authority: {
        context_ref: a0Payload.crop_stage_context_authority.context_ref,
        context_hash: slot.crop_stage_context_hash,
        configuration_matrix_ref: a0Payload.crop_stage_context_authority.configuration_matrix_ref,
        configuration_matrix_hash: a0Payload.crop_stage_context_authority.configuration_matrix_hash,
      },
      model_prior: {
        source_ref: a0Payload.model_prior.source_ref,
        source_hash: a0Payload.model_prior.source_hash,
      },
    });
    if (config.logical_time !== slot.logical_time) throw new Error(`A06B_COMPILED_SLOT_TIME_MISMATCH:${slot.slot_id}`);
    const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
    if (payload.crop_stage_context_authority.context_hash !== slot.crop_stage_context_hash) {
      throw new Error(`A06B_COMPILED_CROP_CONTEXT_HASH_MISMATCH:${slot.slot_id}`);
    }
    if (payload.parent_runtime_config_ref !== parent.object_id || payload.parent_runtime_config_hash !== parent.determinism_hash) {
      throw new Error(`A06B_COMPILED_PARENT_CHAIN_MISMATCH:${slot.slot_id}`);
    }
    runtimeConfigs.push(config);
    parent = config;
  }

  return {
    selected_epoch_id: input.selected_epoch_id,
    selected_o00: runtimeConfigs[0]!.logical_time,
    selected_o23: runtimeConfigs[23]!.logical_time,
    existing_a0_runtime_config_ref: input.existing_a0_runtime_config.object_id,
    existing_a0_runtime_config_hash: input.existing_a0_runtime_config.determinism_hash,
    runtime_configs: runtimeConfigs,
    runtime_config_refs: runtimeConfigs.map((config) => config.object_id),
    runtime_config_hashes: runtimeConfigs.map((config) => config.determinism_hash),
    slot_crop_stage_context_hashes: input.slots.map((slot) => slot.crop_stage_context_hash),
    runtime_config_count: 24,
    database_write_count: 0,
    provider_request_count: 0,
    scheduler_slot_write_count: 0,
    formal_window_started: false,
  };
}
