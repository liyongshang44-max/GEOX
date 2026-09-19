// MCFT-CAP-09 H6 Formal-v5 pre-window Runtime Config successor.
//
// Reuses the already-qualified A18/DT02 stage/context construction from V4, then
// recompiles the exact A0 + O00..O23 Runtime Config chain with the V5 fresh-store
// authority pin. The intermediate V4 bundle is pure/in-memory only and is never
// persisted or authorized for execution.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
  type ExternalFormalHourlyCropPinV4,
  type ExternalFormalPrewindowAuthorityBundleInputV4,
} from "./external_formal_prewindow_authority_bundle_v4.js";
import type {
  ExternalFormalBootstrapAuthorityBundleV1,
} from "./external_formal_bootstrap_authority_bundle_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type ExternalFormalRuntimeConfigPayloadV1,
} from "./external_formal_runtime_config_v1.js";

export const MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V3.json" as const;
export const MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5 =
  "34fd3e92e0e628cf0db16e10df3633337fe81a1a" as const;

export type ExternalFormalPrewindowAuthorityBundleInputV5 = Omit<
  ExternalFormalPrewindowAuthorityBundleInputV4,
  "fresh_database_authority_ref" | "fresh_database_authority_blob_sha"
>;

export type ExternalFormalPrewindowAuthorityBundleV5 = {
  epoch_id: string;
  o00_logical_time: string;
  o23_logical_time: string;
  hourly_crop_pins: readonly ExternalFormalHourlyCropPinV4[];
  persistence_bundle: ExternalFormalBootstrapAuthorityBundleV1;
};

function payloadV5(
  config: CanonicalObjectEnvelopeV1,
  code: string,
): ExternalFormalRuntimeConfigPayloadV1 {
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload;
  if (
    payload.formal_authorities.fresh_database.ref
      !== MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4
    || payload.formal_authorities.fresh_database.hash
      !== MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4
  ) {
    throw new Error(code);
  }
  return payload;
}

function recompileV5(
  source: CanonicalObjectEnvelopeV1,
  parent: CanonicalObjectEnvelopeV1 | null,
  createdAt: string,
): CanonicalObjectEnvelopeV1 {
  const payload = payloadV5(
    source,
    "EXTERNAL_FORMAL_V5_INTERMEDIATE_V4_DATABASE_AUTHORITY_REQUIRED",
  );
  return compileExternalFormalRuntimeConfigV1({
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    config_role: payload.config_role,
    effective_logical_time: payload.effective_logical_time,
    created_at: createdAt,
    parent_runtime_config_ref: parent?.object_id ?? null,
    parent_runtime_config_hash: parent?.determinism_hash ?? null,
    reality_binding_ref: payload.reality_binding_ref,
    reality_binding_hash: payload.reality_binding_hash,
    source_matrix_ref: payload.source_matrix_ref,
    source_matrix_hash: payload.source_matrix_hash,
    configuration_matrix_ref: payload.configuration_matrix_ref,
    configuration_matrix_hash: payload.configuration_matrix_hash,
    geometry_semantic_hash: payload.geometry_semantic_hash,
    formal_authorities: {
      ...structuredClone(payload.formal_authorities),
      fresh_database: {
        ref: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
        hash: MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
      },
    },
    crop_stage_context_authority:
      structuredClone(payload.crop_stage_context_authority),
    model_prior: {
      source_ref: payload.model_prior.source_ref,
      source_hash: payload.model_prior.source_hash,
    },
  });
}

function assertV5Config(
  config: CanonicalObjectEnvelopeV1,
  expectedParent: CanonicalObjectEnvelopeV1 | null,
  expectedCropHash: string,
  code: string,
): void {
  validateExternalFormalRuntimeConfigPayloadV1(config.payload);
  const payload = config.payload;
  const freshDatabaseRef: string = payload.formal_authorities.fresh_database.ref;
  const freshDatabaseHash: string = payload.formal_authorities.fresh_database.hash;
  if (
    freshDatabaseRef !== MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5
    || freshDatabaseHash !== MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5
  ) {
    throw new Error(code + "_V5_DATABASE_AUTHORITY_REQUIRED");
  }
  if (
    freshDatabaseRef === MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4
    || freshDatabaseHash === MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4
  ) {
    throw new Error(code + "_V4_DATABASE_AUTHORITY_RESIDUAL_FORBIDDEN");
  }
  if (
    payload.parent_runtime_config_ref !== (expectedParent?.object_id ?? null)
    || payload.parent_runtime_config_hash
      !== (expectedParent?.determinism_hash ?? null)
  ) {
    throw new Error(code + "_PARENT_CHAIN_DRIFT");
  }
  if (payload.crop_stage_context_authority.context_hash !== expectedCropHash) {
    throw new Error(code + "_CROP_CONTEXT_HASH_DRIFT");
  }
}

export function buildExternalFormalPrewindowAuthorityBundleV5(
  input: ExternalFormalPrewindowAuthorityBundleInputV5,
): ExternalFormalPrewindowAuthorityBundleV5 {
  const intermediate = buildExternalFormalPrewindowAuthorityBundleV4({
    ...input,
    fresh_database_authority_ref:
      MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
    fresh_database_authority_blob_sha:
      MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  });

  const bootstrap = recompileV5(
    intermediate.persistence_bundle.bootstrap_runtime_config,
    null,
    input.created_at,
  );
  assertV5Config(
    bootstrap,
    null,
    (intermediate.persistence_bundle.bootstrap_runtime_config.payload as
      ExternalFormalRuntimeConfigPayloadV1).crop_stage_context_authority
      .context_hash,
    "EXTERNAL_FORMAL_V5_A0_CONFIG",
  );

  const runtimeConfigs: CanonicalObjectEnvelopeV1[] = [];
  let parent = bootstrap;
  for (
    let index = 0;
    index < intermediate.persistence_bundle.runtime_configs.length;
    index += 1
  ) {
    const source = intermediate.persistence_bundle.runtime_configs[index]!;
    const pin = intermediate.hourly_crop_pins[index]!;
    const config = recompileV5(source, parent, input.created_at);
    assertV5Config(
      config,
      parent,
      pin.crop_stage_context_hash,
      `EXTERNAL_FORMAL_V5_HOURLY_CONFIG:${pin.slot_id}`,
    );
    runtimeConfigs.push(config);
    parent = config;
  }
  if (runtimeConfigs.length !== 24) {
    throw new Error("EXTERNAL_FORMAL_V5_EXACT_24_HOURLY_CONFIGS_REQUIRED");
  }

  const persistenceBundle: ExternalFormalBootstrapAuthorityBundleV1 = {
    ...intermediate.persistence_bundle,
    bootstrap_runtime_config: bootstrap,
    runtime_configs: runtimeConfigs,
  };

  return {
    epoch_id: intermediate.epoch_id,
    o00_logical_time: intermediate.o00_logical_time,
    o23_logical_time: intermediate.o23_logical_time,
    hourly_crop_pins: intermediate.hourly_crop_pins.map((pin) => ({ ...pin })),
    persistence_bundle: persistenceBundle,
  };
}
