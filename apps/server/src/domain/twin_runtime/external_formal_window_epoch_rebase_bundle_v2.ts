// Purpose: deterministically construct the selected T3R1 successor External Formal O00-O23 Runtime Config chain
// from the exact persisted T3R1 A0 Runtime Config and the effective successor epoch-selection slot contexts.
// Boundary: pure construction only; no filesystem, database, provider network, scheduler, wall clock,
// environment, persistence, recommendation, action, model activation, or Formal-slot execution.

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

export const MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2 =
  "mcft_cap09_external_formal_window_epoch_20260817t200000z_v2" as const;
export const MCFT_CAP09_T3R1_SUCCESSOR_O00_V2 = "2026-08-17T20:00:00.000Z" as const;
export const MCFT_CAP09_T3R1_SUCCESSOR_O23_V2 = "2026-08-18T19:00:00.000Z" as const;
export const MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_EFFECTIVE_AT_V2 = "2026-08-16T07:40:52.000Z" as const;
export const MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_AUTHORITY_REF_V2 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json" as const;
export const MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_AUTHORITY_BLOB_V2 =
  "9c12e31b0a9a3d33e027f0677ad1cf2d92a5097f" as const;

export const MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2 =
  "external_formal_runtime_config_49959a28cfc9eb357bf18f9d" as const;
export const MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2 =
  "sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48" as const;
export const MCFT_CAP09_T3R1_PERSISTED_A0_LOGICAL_TIME_V2 = "2026-08-15T10:00:00.000Z" as const;

export type ExternalFormalSuccessorSlotContextV2 = {
  slot_id: string;
  logical_time: string;
  crop_stage_code: "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";
  crop_stage_context_hash: string;
};

export type ExternalFormalSuccessorRuntimeConfigBundleInputV2 = {
  selected_epoch_id: string;
  slots: readonly ExternalFormalSuccessorSlotContextV2[];
  persisted_a0_runtime_config: CanonicalObjectEnvelopeV1;
};

export type ExternalFormalSuccessorRuntimeConfigBundleV2 = {
  selected_epoch_id: string;
  selected_o00: string;
  selected_o23: string;
  persisted_a0_runtime_config_ref: string;
  persisted_a0_runtime_config_hash: string;
  runtime_configs: readonly CanonicalObjectEnvelopeV1[];
  runtime_config_refs: readonly string[];
  runtime_config_hashes: readonly string[];
  slot_crop_stage_context_hashes: readonly string[];
  runtime_config_count: 24;
  database_write_count: 0;
  raw_object_write_count: 0;
  provider_request_count: 0;
  scheduler_slot_write_count: 0;
  scheduler_cursor_write_count: 0;
  formal_window_started: false;
};

function canonicalHourV2(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return value;
}

function validatePersistedA0V2(config: CanonicalObjectEnvelopeV1): ExternalFormalRuntimeConfigPayloadV1 {
  validateCanonicalObjectV1(config);
  if (config.object_type !== "twin_runtime_config_v1") throw new Error("T3R1_SUCCESSOR_BUILDER_A0_TYPE_REQUIRED");
  if (config.object_id !== MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_REF_V2) throw new Error("T3R1_SUCCESSOR_BUILDER_A0_REF_MISMATCH");
  if (config.determinism_hash !== MCFT_CAP09_T3R1_PERSISTED_A0_RUNTIME_CONFIG_HASH_V2) throw new Error("T3R1_SUCCESSOR_BUILDER_A0_HASH_MISMATCH");
  if (config.logical_time !== MCFT_CAP09_T3R1_PERSISTED_A0_LOGICAL_TIME_V2) throw new Error("T3R1_SUCCESSOR_BUILDER_A0_TIME_MISMATCH");
  for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
    if (config[key as keyof CanonicalObjectEnvelopeV1] !== expected) throw new Error(`T3R1_SUCCESSOR_BUILDER_A0_SCOPE_MISMATCH:${key}`);
  }
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
  if (payload.config_role !== "A0_BOOTSTRAP") throw new Error("T3R1_SUCCESSOR_BUILDER_A0_ROLE_REQUIRED");
  if (payload.parent_runtime_config_ref !== null || payload.parent_runtime_config_hash !== null) throw new Error("T3R1_SUCCESSOR_BUILDER_A0_PARENT_MUST_BE_NULL");
  if (payload.effective_logical_time !== MCFT_CAP09_T3R1_PERSISTED_A0_LOGICAL_TIME_V2) throw new Error("T3R1_SUCCESSOR_BUILDER_A0_EFFECTIVE_TIME_MISMATCH");
  return payload;
}

function validateSlotsV2(slots: readonly ExternalFormalSuccessorSlotContextV2[]): void {
  if (slots.length !== 24) throw new Error("T3R1_SUCCESSOR_BUILDER_EXACT_24_SLOTS_REQUIRED");
  const hashes = new Set<string>();
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!;
    const expectedId = `O${String(index).padStart(2, "0")}`;
    const expectedTime = new Date(Date.parse(MCFT_CAP09_T3R1_SUCCESSOR_O00_V2) + index * 3_600_000).toISOString();
    if (slot.slot_id !== expectedId) throw new Error(`T3R1_SUCCESSOR_BUILDER_SLOT_ID_MISMATCH:${index}`);
    if (canonicalHourV2(slot.logical_time, `T3R1_SUCCESSOR_BUILDER_SLOT_TIME_INVALID:${index}`) !== expectedTime) {
      throw new Error(`T3R1_SUCCESSOR_BUILDER_SLOT_TIME_MISMATCH:${index}`);
    }
    if (slot.crop_stage_code !== "MID") throw new Error(`T3R1_SUCCESSOR_BUILDER_SLOT_STAGE_MISMATCH:${index}`);
    if (!/^sha256:[0-9a-f]{64}$/.test(slot.crop_stage_context_hash)) throw new Error(`T3R1_SUCCESSOR_BUILDER_SLOT_HASH_INVALID:${index}`);
    hashes.add(slot.crop_stage_context_hash);
  }
  if (hashes.size !== 24) throw new Error("T3R1_SUCCESSOR_BUILDER_DISTINCT_CONTEXT_HASHES_REQUIRED");
  if (slots[23]!.logical_time !== MCFT_CAP09_T3R1_SUCCESSOR_O23_V2) throw new Error("T3R1_SUCCESSOR_BUILDER_O23_MISMATCH");
}

export function buildExternalFormalSuccessorRuntimeConfigBundleV2(
  input: ExternalFormalSuccessorRuntimeConfigBundleInputV2,
): ExternalFormalSuccessorRuntimeConfigBundleV2 {
  if (input.selected_epoch_id !== MCFT_CAP09_T3R1_SUCCESSOR_EPOCH_ID_V2) throw new Error("T3R1_SUCCESSOR_BUILDER_EPOCH_MISMATCH");
  validateSlotsV2(input.slots);
  const a0Payload = validatePersistedA0V2(input.persisted_a0_runtime_config);

  const runtimeConfigs: CanonicalObjectEnvelopeV1[] = [];
  let parent = input.persisted_a0_runtime_config;
  for (const slot of input.slots) {
    const config = compileExternalFormalRuntimeConfigV1({
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      config_role: "HOURLY_CAP04",
      effective_logical_time: slot.logical_time,
      created_at: MCFT_CAP09_T3R1_SUCCESSOR_SELECTION_EFFECTIVE_AT_V2,
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
    if (config.logical_time !== slot.logical_time) throw new Error(`T3R1_SUCCESSOR_BUILDER_COMPILED_TIME_MISMATCH:${slot.slot_id}`);
    const payload = config.payload as unknown as ExternalFormalRuntimeConfigPayloadV1;
    if (payload.crop_stage_context_authority.context_hash !== slot.crop_stage_context_hash) throw new Error(`T3R1_SUCCESSOR_BUILDER_COMPILED_CONTEXT_MISMATCH:${slot.slot_id}`);
    if (payload.parent_runtime_config_ref !== parent.object_id || payload.parent_runtime_config_hash !== parent.determinism_hash) throw new Error(`T3R1_SUCCESSOR_BUILDER_PARENT_CHAIN_MISMATCH:${slot.slot_id}`);
    runtimeConfigs.push(config);
    parent = config;
  }

  return {
    selected_epoch_id: input.selected_epoch_id,
    selected_o00: runtimeConfigs[0]!.logical_time,
    selected_o23: runtimeConfigs[23]!.logical_time,
    persisted_a0_runtime_config_ref: input.persisted_a0_runtime_config.object_id,
    persisted_a0_runtime_config_hash: input.persisted_a0_runtime_config.determinism_hash,
    runtime_configs: runtimeConfigs,
    runtime_config_refs: runtimeConfigs.map((config) => config.object_id),
    runtime_config_hashes: runtimeConfigs.map((config) => config.determinism_hash),
    slot_crop_stage_context_hashes: input.slots.map((slot) => slot.crop_stage_context_hash),
    runtime_config_count: 24,
    database_write_count: 0,
    raw_object_write_count: 0,
    provider_request_count: 0,
    scheduler_slot_write_count: 0,
    scheduler_cursor_write_count: 0,
    formal_window_started: false,
  };
}
