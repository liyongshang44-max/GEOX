// MCFT-CAP-09 Production Hosting Phase 5: Twin Runtime production process.
//
// This is deployment/process composition only. It loads explicitly mounted governed
// authorities, opens the Twin Runtime database connection, wires the Phase4 production
// composition, and owns signal-driven lifecycle. It has no provider/R2 credentials and
// no EvidenceSupplyCursor authority.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

import productionAcquisitionHorizonAuthorityJson from "../../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json" with { type: "json" };

import { createDatabasePool } from "../../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  composeMcftCap09TwinRuntimeV1,
} from "./mcft_cap09_twin_runtime_composition_v1.js";
import type {
  TwinRuntimeDatabaseClockPortV1,
} from "./mcft_cap09_twin_runtime_host_v1.js";
import type {
  PersistentSequentialSchedulerClockAuthorityV1,
} from "./postgres_persistent_sequential_scheduler_adapter_v1.js";
import type {
  ExternalFormalV3Am19WindowManifestV1,
} from "./external_formal_v3_amendment19_runner_v1.js";
import {
  createMcftCap09ProcessStopV1,
  McftCap09ConsoleTwinHealthV1,
  McftCap09ProductionTwinFailureClassifierV1,
  McftCap09ProductionTwinWaitV1,
} from "../mcft_cap09_production_process_lifecycle_v1.js";
import {
  loadMcftCap09ProductionRuntimeStartAuthorityV1,
  type McftCap09ProductionRuntimeStartAuthorityInstanceV1,
} from "../mcft_cap09_production_runtime_start_authority_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
} from "../mcft_cap09_production_service_identity_v1.js";

export const MCFT_CAP09_TWIN_RUNTIME_PROCESS_ID_V1 =
  "MCFT_CAP09_TWIN_RUNTIME_PROCESS_V1" as const;

export const MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V1 = {
  process_id: MCFT_CAP09_TWIN_RUNTIME_PROCESS_ID_V1,
  composition: "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V1",
  database_authority: "TWIN_RUNTIME_DATABASE_URL_ONLY",
  database_principal: "geox_mcft_cap09_twin_runtime_login_v1",
  authority_loading: "EXPLICIT_MOUNTED_JSON_PATHS",
  provider_credentials_allowed: false,
  raw_storage_credentials_allowed: false,
  evidence_supply_cursor_authority: false,
  process_clock_for_tick_authority: false,
  database_clock_for_tick_authority: true,
  qualification_clock_boundary:
    "EXPLICIT_DATABASE_CLOCK_AND_SCHEDULER_AUTHORITY_INJECTION_WITH_PRODUCTION_DEFAULT",
  formal_arm_authority: false,
  runtime_start_authority: "SEPARATE_GOVERNED_AUTHORITY_REQUIRED",
  production_current_crop_authority:
    "READ_ONLY_MOUNT_EXACT_SHA256_AND_EFFECTIVE_SEMANTICS_REQUIRED",
  biological_stage_architecture_effectiveness:
    "READ_ONLY_MOUNT_EXACT_SHA256_AND_EFFECTIVE_SEMANTICS_REQUIRED",
  production_owner_cutover: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;
type JsonRecordV1 = Record<string, unknown>;

export type McftCap09TwinRuntimeProcessConfigV1 = {
  database_url: string;
  manifest_path: string;
  crop_authority_path: string;
  configuration_matrix_path: string;
  current_crop_authority_path: string;
  biological_stage_architecture_effectiveness_path: string;
  lease_owner: string;
  lease_duration_seconds: number;
  idle_poll_ms: number;
  not_ready_poll_ms: number;
  terminal_poll_ms: number;
  retry_base_ms: number;
  retry_maximum_ms: number;
};

function requiredEnvV1(
  env: EnvironmentV1,
  name: string,
  code: string,
): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}

function integerEnvV1(
  env: EnvironmentV1,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  code: string,
): number {
  const raw = String(env[name] ?? fallback).trim();
  if (!/^-?\d+$/.test(raw)) throw new Error(code);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(code);
  }
  return value;
}

function readJsonObjectV1(pathValue: string, code: string): JsonRecordV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(pathValue, "utf8"));
  } catch (error) {
    throw new Error(`${code}:${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(code);
  }
  return parsed as JsonRecordV1;
}

function fileDigestV1(pathValue: string, code: string): string {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(pathValue);
  } catch (error) {
    throw new Error(`${code}:${error instanceof Error ? error.message : String(error)}`);
  }
  return "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex");
}

export function loadMcftCap09ProductionStageAuthorityMountsV1(input: {
  runtime_start_authority: Pick<
    McftCap09ProductionRuntimeStartAuthorityInstanceV1,
    | "current_crop_authority_sha256"
    | "biological_stage_architecture_effectiveness_sha256"
  >;
  current_crop_authority_path: string;
  biological_stage_architecture_effectiveness_path: string;
}): {
  current_crop_authority: JsonRecordV1;
  biological_stage_architecture_effectiveness: JsonRecordV1;
} {
  const currentPath = String(input.current_crop_authority_path ?? "").trim();
  if (!currentPath) throw new Error("MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_PATH_REQUIRED");
  const stageArchitecturePath = String(
    input.biological_stage_architecture_effectiveness_path ?? "",
  ).trim();
  if (!stageArchitecturePath) {
    throw new Error(
      "MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH_REQUIRED",
    );
  }

  if (
    fileDigestV1(currentPath, "MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_FILE_INVALID")
    !== input.runtime_start_authority.current_crop_authority_sha256
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_DIGEST_MISMATCH");
  }
  if (
    fileDigestV1(
      stageArchitecturePath,
      "MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_FILE_INVALID",
    )
    !== input.runtime_start_authority.biological_stage_architecture_effectiveness_sha256
  ) {
    throw new Error(
      "MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_DIGEST_MISMATCH",
    );
  }

  const current = readJsonObjectV1(
    currentPath,
    "MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_INVALID",
  );
  if (
    current.schema_version
      !== "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || current.status !== "PASS"
    || current.qualification_outcome
      !== "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
    || current.architecture_effective !== true
    || current.runtime_consumption_authorized !== true
  ) {
    throw new Error("MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_NOT_EFFECTIVE");
  }

  const stageArchitecture = readJsonObjectV1(
    stageArchitecturePath,
    "MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_INVALID",
  );
  if (
    stageArchitecture.schema_version
      !== "geox_dt02_biological_stage_authority_effectiveness_v1"
    || stageArchitecture.amendment_id !== "DT02-AMENDMENT-03"
    || stageArchitecture.status !== "EFFECTIVE"
    || stageArchitecture.effective !== true
  ) {
    throw new Error(
      "MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_NOT_EFFECTIVE",
    );
  }

  return {
    current_crop_authority: current,
    biological_stage_architecture_effectiveness: stageArchitecture,
  };
}

export function readMcftCap09TwinRuntimeProcessConfigV1(
  env: EnvironmentV1 = process.env,
): McftCap09TwinRuntimeProcessConfigV1 {
  const databaseUrl = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
    "PHASE5_TWIN_RUNTIME_DATABASE_URL_REQUIRED",
  );

  return {
    database_url: databaseUrl,
    manifest_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_MANIFEST_PATH",
      "PHASE5_TWIN_RUNTIME_MANIFEST_PATH_REQUIRED",
    ),
    crop_authority_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH",
      "PHASE5_TWIN_RUNTIME_CROP_AUTHORITY_PATH_REQUIRED",
    ),
    configuration_matrix_path: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH",
      "PHASE5_TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH_REQUIRED",
    ),
    current_crop_authority_path: String(
      env.GEOX_MCFT_CAP09_TWIN_RUNTIME_CURRENT_CROP_AUTHORITY_PATH ?? "",
    ).trim(),
    biological_stage_architecture_effectiveness_path: String(
      env.GEOX_MCFT_CAP09_TWIN_RUNTIME_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH ?? "",
    ).trim(),
    lease_owner: String(
      env.GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER
      ?? `twin-runtime:${env.HOSTNAME ?? os.hostname()}`,
    ).trim(),
    lease_duration_seconds: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_DURATION_SECONDS",
      300,
      1,
      3600,
      "PHASE5_TWIN_RUNTIME_LEASE_DURATION_INVALID",
    ),
    idle_poll_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_IDLE_POLL_MS",
      5000,
      100,
      3_600_000,
      "PHASE5_TWIN_RUNTIME_IDLE_POLL_MS_INVALID",
    ),
    not_ready_poll_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_NOT_READY_POLL_MS",
      15000,
      100,
      3_600_000,
      "PHASE5_TWIN_RUNTIME_NOT_READY_POLL_MS_INVALID",
    ),
    terminal_poll_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_TERMINAL_POLL_MS",
      0,
      0,
      3_600_000,
      "PHASE5_TWIN_RUNTIME_TERMINAL_POLL_MS_INVALID",
    ),
    retry_base_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_RETRY_BASE_MS",
      1000,
      100,
      3_600_000,
      "PHASE5_TWIN_RUNTIME_RETRY_BASE_MS_INVALID",
    ),
    retry_maximum_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_TWIN_RUNTIME_RETRY_MAXIMUM_MS",
      60000,
      100,
      3_600_000,
      "PHASE5_TWIN_RUNTIME_RETRY_MAXIMUM_MS_INVALID",
    ),
  };
}

export async function runMcftCap09TwinRuntimeProcessV1(input?: {
  env?: EnvironmentV1;
  database_clock?: TwinRuntimeDatabaseClockPortV1;
  scheduler_clock_authority?: PersistentSequentialSchedulerClockAuthorityV1;
  runtime_start_authority?: unknown;
  qualification_lease_owner?: string;
}): Promise<void> {
  const document = productionAcquisitionHorizonAuthorityJson as {
    runtime_start_binding?: unknown;
  };
  const env = input?.env ?? process.env;

  const qualificationLeaseOwner = String(
    input?.qualification_lease_owner ?? "",
  ).trim();
  if (qualificationLeaseOwner) {
    if (
      input?.runtime_start_authority === undefined
      || input?.database_clock === undefined
      || input?.scheduler_clock_authority?.mode !== "ACCELERATED_ENGINEERING_ONLY"
    ) {
      throw new Error(
        "MCFT_CAP09_TWIN_QUALIFICATION_LEASE_OWNER_REQUIRES_EXPLICIT_ENGINEERING_BOUNDARIES",
      );
    }
  }
  const runtimeEnv: EnvironmentV1 = {
    ...env,
    GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER:
      qualificationLeaseOwner
      || buildMcftCap09ProductionLeaseOwnerV1({
        plane: "TWIN_RUNTIME",
        configured_service_id: requiredEnvV1(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID",
          "MCFT_CAP09_PRODUCTION_TWIN_SERVICE_ID_REQUIRED",
        ),
        instance_id: String(env.HOSTNAME ?? os.hostname()).trim(),
      }),
  };
  const config = readMcftCap09TwinRuntimeProcessConfigV1(runtimeEnv);
  if (!config.lease_owner) throw new Error("PHASE5_TWIN_RUNTIME_LEASE_OWNER_REQUIRED");

  const manifest = readJsonObjectV1(
    config.manifest_path,
    "PHASE5_TWIN_RUNTIME_MANIFEST_INVALID",
  ) as unknown as ExternalFormalV3Am19WindowManifestV1;
  const runtimeStartAuthority = loadMcftCap09ProductionRuntimeStartAuthorityV1({
    plane: "TWIN_RUNTIME",
    expected: {
      deployment_subject_sha: requiredEnvV1(
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
  if (!qualificationLeaseOwner) {
    loadMcftCap09ProductionStageAuthorityMountsV1({
      runtime_start_authority: runtimeStartAuthority,
      current_crop_authority_path: config.current_crop_authority_path,
      biological_stage_architecture_effectiveness_path:
        config.biological_stage_architecture_effectiveness_path,
    });
  }
  const cropAuthority = readJsonObjectV1(
    config.crop_authority_path,
    "PHASE5_TWIN_RUNTIME_CROP_AUTHORITY_INVALID",
  );
  const configurationMatrix = readJsonObjectV1(
    config.configuration_matrix_path,
    "PHASE5_TWIN_RUNTIME_CONFIGURATION_MATRIX_INVALID",
  );

  const pool = createDatabasePool(config.database_url);
  const stop = createMcftCap09ProcessStopV1();
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "TWIN_RUNTIME");

    const composition = composeMcftCap09TwinRuntimeV1({
      pool,
      manifest,
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      wait: new McftCap09ProductionTwinWaitV1({
        idle_poll_ms: config.idle_poll_ms,
        not_ready_poll_ms: config.not_ready_poll_ms,
        terminal_poll_ms: config.terminal_poll_ms,
        retry_base_ms: config.retry_base_ms,
        retry_maximum_ms: config.retry_maximum_ms,
      }),
      health: new McftCap09ConsoleTwinHealthV1(),
      stop,
      failure_classifier: new McftCap09ProductionTwinFailureClassifierV1(),
      database_clock: input?.database_clock,
      scheduler_clock_authority: input?.scheduler_clock_authority,
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
