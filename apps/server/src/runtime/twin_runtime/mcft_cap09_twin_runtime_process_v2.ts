// MCFT-CAP-09 Production Twin Runtime process V2.
//
// Production successor for biological-stage-aware crop context.
// It preserves the V1 process as historical/qualification evidence and routes
// only the production entrypoint through Composition V2 / A18 V4.
//
// Hard boundaries:
// - mounted current-crop and architecture-effectiveness authorities are mandatory;
// - both mounts must match the exact runtime-start authority SHA256 bindings;
// - current-crop authority must be runtime-consumable and architecture-effective;
// - DT-02 Amendment-03 must be EFFECTIVE;
// - no provider/R2 credentials or EvidenceSupplyCursor authority.
// - production selection remains the mounted static exact-bound snapshot unless an
//   already-governed resolver is explicitly injected by a bounded successor caller.

import fs from "node:fs";
import os from "node:os";

import productionAcquisitionHorizonAuthorityJson from "../../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json" with { type: "json" };

import { createDatabasePool } from "../../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  composeMcftCap09TwinRuntimeV2,
} from "./mcft_cap09_twin_runtime_composition_v2.js";
import {
  createStaticMcftCap09CurrentCropAuthorityResolverV1,
  type McftCap09CurrentCropAuthorityResolverPortV1,
} from "./mcft_cap09_current_crop_authority_resolver_v1.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import {
  createMcftCap09ProcessStopV1,
  McftCap09ConsoleTwinHealthV1,
  McftCap09ProductionTwinFailureClassifierV1,
  McftCap09ProductionTwinWaitV1,
} from "../mcft_cap09_production_process_lifecycle_v1.js";
import {
  loadMcftCap09ProductionRuntimeStartAuthorityV1,
} from "../mcft_cap09_production_runtime_start_authority_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
} from "../mcft_cap09_production_service_identity_v1.js";
import {
  loadMcftCap09ProductionStageAuthorityMountsV1,
  readMcftCap09TwinRuntimeProcessConfigV1,
} from "./mcft_cap09_twin_runtime_process_v1.js";

export const MCFT_CAP09_TWIN_RUNTIME_PROCESS_ID_V2 =
  "MCFT_CAP09_TWIN_RUNTIME_PROCESS_V2" as const;

export const MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V2 = {
  process_id: MCFT_CAP09_TWIN_RUNTIME_PROCESS_ID_V2,
  composition: "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V2",
  runner: "ExternalFormalV4Amendment19RunnerV2",
  crop_context_materializer: "materializeExternalFormalA18CropContextV4",
  historical_v1_process_rewritten: false,
  historical_v3_crop_context_rewritten: false,
  database_authority: "TWIN_RUNTIME_DATABASE_URL_ONLY",
  database_principal: "geox_mcft_cap09_twin_runtime_login_v1",
  authority_loading: "EXPLICIT_MOUNTED_JSON_PATHS",
  current_crop_authority:
    "READ_ONLY_MOUNT_EXACT_SHA256_RUNTIME_CONSUMPTION_AUTHORIZED_REQUIRED",
  current_crop_resolver_selection:
    "STATIC_EXACT_BOUND_SNAPSHOT_DEFAULT_WITH_EXPLICIT_DEPENDENCY_INJECTION_ONLY",
  production_rolling_authority_env_switch: false,
  production_registry_path_discovery: false,
  biological_stage_architecture_effectiveness:
    "READ_ONLY_MOUNT_EXACT_SHA256_DT02_AMENDMENT03_EFFECTIVE_REQUIRED",
  runtime_start_authority: "SEPARATE_GOVERNED_AUTHORITY_REQUIRED",
  provider_credentials_allowed: false,
  raw_storage_credentials_allowed: false,
  evidence_supply_cursor_authority: false,
  process_clock_for_tick_authority: false,
  database_clock_for_tick_authority: true,
  production_owner_cutover: false,
  formal_arm_authority: false,
} as const;

type EnvironmentV2 = Readonly<Record<string, string | undefined>>;
type JsonRecordV2 = Record<string, unknown>;

function requiredEnvV2(
  env: EnvironmentV2,
  name: string,
  code: string,
): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}

function readJsonObjectV2(pathValue: string, code: string): JsonRecordV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(pathValue, "utf8"));
  } catch (error) {
    throw new Error(
      `${code}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(code);
  }
  return parsed as JsonRecordV2;
}

export function selectMcftCap09TwinRuntimeCurrentCropAuthorityResolverV2(input: {
  mounted_current_crop_authority: JsonRecordV2;
  explicit_resolver?: McftCap09CurrentCropAuthorityResolverPortV1;
}): McftCap09CurrentCropAuthorityResolverPortV1 {
  return input.explicit_resolver
    ?? createStaticMcftCap09CurrentCropAuthorityResolverV1(
      input.mounted_current_crop_authority,
    );
}

export async function runMcftCap09TwinRuntimeProcessV2(input?: {
  env?: EnvironmentV2;
  runtime_start_authority?: unknown;
  current_crop_authority_resolver?: McftCap09CurrentCropAuthorityResolverPortV1;
}): Promise<void> {
  const document = productionAcquisitionHorizonAuthorityJson as {
    runtime_start_binding?: unknown;
  };
  const env = input?.env ?? process.env;

  const runtimeEnv: EnvironmentV2 = {
    ...env,
    GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER:
      buildMcftCap09ProductionLeaseOwnerV1({
        plane: "TWIN_RUNTIME",
        configured_service_id: requiredEnvV2(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID",
          "MCFT_CAP09_PRODUCTION_TWIN_SERVICE_ID_REQUIRED",
        ),
        instance_id: String(env.HOSTNAME ?? os.hostname()).trim(),
      }),
  };

  const config = readMcftCap09TwinRuntimeProcessConfigV1(runtimeEnv);
  if (!config.lease_owner) {
    throw new Error("PHASE5_TWIN_RUNTIME_LEASE_OWNER_REQUIRED");
  }

  const manifest = readJsonObjectV2(
    config.manifest_path,
    "MCFT_CAP09_TWIN_V2_MANIFEST_INVALID",
  ) as unknown as ExternalFormalV4Am19WindowManifestV2;

  const runtimeStartAuthority =
    loadMcftCap09ProductionRuntimeStartAuthorityV1({
      plane: "TWIN_RUNTIME",
      expected: {
        deployment_subject_sha: requiredEnvV2(
          env,
          "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
          "MCFT_CAP09_PRODUCTION_DEPLOYMENT_SUBJECT_REQUIRED",
        ),
        scope: manifest.scope,
      },
      authority_path:
        env.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH,
      explicit_authority: input?.runtime_start_authority,
      embedded_authority: document.runtime_start_binding,
    });

  const stageAuthorities =
    loadMcftCap09ProductionStageAuthorityMountsV1({
      runtime_start_authority: runtimeStartAuthority,
      current_crop_authority_path: config.current_crop_authority_path,
      biological_stage_architecture_effectiveness_path:
        config.biological_stage_architecture_effectiveness_path,
    });

  const currentCropAuthorityResolver =
    selectMcftCap09TwinRuntimeCurrentCropAuthorityResolverV2({
      mounted_current_crop_authority: stageAuthorities.current_crop_authority,
      explicit_resolver: input?.current_crop_authority_resolver,
    });

  const cropAuthority = readJsonObjectV2(
    config.crop_authority_path,
    "MCFT_CAP09_TWIN_V2_CROP_AUTHORITY_INVALID",
  );
  const configurationMatrix = readJsonObjectV2(
    config.configuration_matrix_path,
    "MCFT_CAP09_TWIN_V2_CONFIGURATION_MATRIX_INVALID",
  );

  const pool = createDatabasePool(config.database_url);
  const stop = createMcftCap09ProcessStopV1();
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "TWIN_RUNTIME");

    const composition = composeMcftCap09TwinRuntimeV2({
      pool,
      manifest,
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      current_crop_authority:
        stageAuthorities.current_crop_authority,
      current_crop_authority_resolver: currentCropAuthorityResolver,
      biological_stage_architecture_effectiveness:
        stageAuthorities.biological_stage_architecture_effectiveness,
      wait: new McftCap09ProductionTwinWaitV1({
        idle_poll_ms: config.idle_poll_ms,
        not_ready_poll_ms: config.not_ready_poll_ms,
        terminal_poll_ms: config.terminal_poll_ms,
        retry_base_ms: config.retry_base_ms,
        retry_maximum_ms: config.retry_maximum_ms,
      }),
      health: new McftCap09ConsoleTwinHealthV1(),
      stop,
      failure_classifier:
        new McftCap09ProductionTwinFailureClassifierV1(),
    });

    await composition.host.run({
      lease_owner: config.lease_owner,
      lease_duration_seconds: config.lease_duration_seconds,
    });
  } finally {
    stop.dispose();
    await pool.end();
  }
}
