// MCFT-CAP-09 H6B Formal-v5 active Twin production process V3.
//
// This process is activated only after a valid Formal-v5 arm and successful A0 bootstrap.
// It deliberately does not consume the pre-Formal runtime-start authority. The exact arm
// subject remains the runtime semantic subject throughout O00-O23.
//
// No provider/R2 credentials or EvidenceSupplyCursor authority are accepted here.

import fs from "node:fs";
import os from "node:os";

import { createDatabasePool } from "../../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
} from "../mcft_cap09_production_service_identity_v1.js";
import {
  createMcftCap09ProcessStopV1,
  McftCap09ProductionTwinFailureClassifierV1,
  McftCap09ProductionTwinWaitV1,
} from "../mcft_cap09_production_process_lifecycle_v1.js";
import {
  composeMcftCap09TwinRuntimeV3,
} from "./mcft_cap09_twin_runtime_composition_v3.js";
import {
  loadMcftCap09FormalV5ActivationAuthorityV1,
  MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
  MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1,
} from "./mcft_cap09_formal_v5_activation_authority_v1.js";
import type {
  TwinRuntimeHostHealthEventV1,
  TwinRuntimeHostHealthPortV1,
} from "./mcft_cap09_twin_runtime_host_v1.js";

export const MCFT_CAP09_TWIN_RUNTIME_PROCESS_ID_V3 =
  "MCFT_CAP09_TWIN_RUNTIME_PROCESS_V3_FORMAL_V5_ACTIVE" as const;

export const MCFT_CAP09_TWIN_RUNTIME_PROCESS_CONTRACT_V3 = {
  process_id: MCFT_CAP09_TWIN_RUNTIME_PROCESS_ID_V3,
  predecessor_process: "MCFT_CAP09_TWIN_RUNTIME_PROCESS_V2",
  composition: "MCFT_CAP09_TWIN_RUNTIME_COMPOSITION_V3_FORMAL_V5_ACTIVE",
  mode: MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
  database_name: MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1,
  database_authority: "FORMAL_V5_TWIN_RUNTIME_DATABASE_URL_ONLY",
  database_principal: "geox_mcft_cap09_twin_runtime_login_v1",
  activation_authority:
    "FORMAL_V5_ARM_PLUS_A0_BOOTSTRAP_PLUS_EXACT_MANIFEST",
  preformal_runtime_start_authority_consumed: false,
  provider_credentials_allowed: false,
  raw_storage_credentials_allowed: false,
  evidence_supply_cursor_authority: false,
  database_clock_for_tick_authority: true,
  process_clock_for_tick_authority: false,
  exact_arm_subject_required: true,
  double_twin_owner_allowed: false,
  runtime_kernel_rewritten: false,
  scheduler_semantics_rewritten: false,
  github_production_clock_allowed: false,
} as const;

type EnvironmentV3 = Readonly<Record<string, string | undefined>>;
type JsonRecordV3 = Record<string, unknown>;

function requiredEnvV3(
  env: EnvironmentV3,
  name: string,
  code: string,
): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}

function integerEnvV3(
  env: EnvironmentV3,
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

function readJsonObjectV3(pathValue: string, code: string): JsonRecordV3 {
  try {
    const parsed = JSON.parse(fs.readFileSync(pathValue, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(code);
    }
    return parsed as JsonRecordV3;
  } catch (error) {
    throw new Error(
      `${code}:${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function databaseNameV3(urlText: string): string {
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    throw new Error("FORMAL_V5_TWIN_DATABASE_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("FORMAL_V5_TWIN_DATABASE_URL_INVALID");
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new Error("FORMAL_V5_TWIN_DATABASE_NAME_REQUIRED");
  return name;
}

class McftCap09FormalV5TwinHealthV1
implements TwinRuntimeHostHealthPortV1 {
  constructor(
    private readonly subject: string,
    private readonly epoch: string,
  ) {}

  async recordHealth(event: TwinRuntimeHostHealthEventV1): Promise<void> {
    process.stdout.write(`${JSON.stringify({
      runtime_role: "TWIN_RUNTIME",
      mode: MCFT_CAP09_FORMAL_V5_ACTIVE_MODE_V1,
      deployment_subject_sha: this.subject,
      epoch_id: this.epoch,
      ...event,
      provider_request_count: 0,
      r2_request_count: 0,
    })}\n`);
  }
}

export async function runMcftCap09TwinRuntimeProcessV3(input?: {
  env?: EnvironmentV3;
}): Promise<void> {
  const env = input?.env ?? process.env;
  const subject = requiredEnvV3(
    env,
    "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
    "FORMAL_V5_TWIN_DEPLOYMENT_SUBJECT_REQUIRED",
  );
  if (!/^[0-9a-f]{40}$/.test(subject)) {
    throw new Error("FORMAL_V5_TWIN_DEPLOYMENT_SUBJECT_INVALID");
  }

  const databaseUrl = requiredEnvV3(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL",
    "FORMAL_V5_TWIN_DATABASE_URL_REQUIRED",
  );
  if (databaseNameV3(databaseUrl) !== MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1) {
    throw new Error("FORMAL_V5_TWIN_EXACT_V5_DATABASE_REQUIRED");
  }

  const activation = loadMcftCap09FormalV5ActivationAuthorityV1({
    expected_subject_sha: subject,
    arm_path: requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_ARM_PATH",
      "FORMAL_V5_TWIN_ARM_PATH_REQUIRED",
    ),
    a0_bootstrap_path: requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PATH",
      "FORMAL_V5_TWIN_A0_BOOTSTRAP_PATH_REQUIRED",
    ),
    manifest_path: requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_MANIFEST_PATH",
      "FORMAL_V5_TWIN_MANIFEST_PATH_REQUIRED",
    ),
    current_crop_authority_path: requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH",
      "FORMAL_V5_TWIN_CURRENT_CROP_AUTHORITY_PATH_REQUIRED",
    ),
  });

  const cropAuthority = readJsonObjectV3(
    requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_CROP_AUTHORITY_PATH",
      "FORMAL_V5_TWIN_CROP_AUTHORITY_PATH_REQUIRED",
    ),
    "FORMAL_V5_TWIN_CROP_AUTHORITY_INVALID",
  );
  const configurationMatrix = readJsonObjectV3(
    requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_CONFIGURATION_MATRIX_PATH",
      "FORMAL_V5_TWIN_CONFIGURATION_MATRIX_PATH_REQUIRED",
    ),
    "FORMAL_V5_TWIN_CONFIGURATION_MATRIX_INVALID",
  );
  const biologicalStageArchitecture = readJsonObjectV3(
    requiredEnvV3(
      env,
      "GEOX_MCFT_CAP09_FORMAL_V5_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH",
      "FORMAL_V5_TWIN_STAGE_ARCHITECTURE_PATH_REQUIRED",
    ),
    "FORMAL_V5_TWIN_STAGE_ARCHITECTURE_INVALID",
  );
  if (
    biologicalStageArchitecture.schema_version
      !== "geox_dt02_biological_stage_authority_effectiveness_v1"
    || biologicalStageArchitecture.amendment_id !== "DT02-AMENDMENT-03"
    || biologicalStageArchitecture.status !== "EFFECTIVE"
    || biologicalStageArchitecture.effective !== true
  ) {
    throw new Error("FORMAL_V5_TWIN_STAGE_ARCHITECTURE_NOT_EFFECTIVE");
  }

  const serviceId = requiredEnvV3(
    env,
    "GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID",
    "FORMAL_V5_TWIN_SERVICE_ID_REQUIRED",
  );
  const leaseOwner = buildMcftCap09ProductionLeaseOwnerV1({
    plane: "TWIN_RUNTIME",
    configured_service_id: serviceId,
    instance_id: String(env.HOSTNAME ?? os.hostname()).trim(),
  });
  const leaseDurationSeconds = integerEnvV3(
    env,
    "GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_DURATION_SECONDS",
    300,
    1,
    3600,
    "FORMAL_V5_TWIN_LEASE_DURATION_INVALID",
  );

  const pool = createDatabasePool(databaseUrl);
  const stop = createMcftCap09ProcessStopV1();
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "TWIN_RUNTIME");
    const identity = (await pool.query<{
      current_user: string;
      database_name: string;
      direct_facts_insert: boolean;
    }>(
      `SELECT current_user::text AS current_user,
              current_database()::text AS database_name,
              pg_catalog.has_table_privilege(
                current_user,'public.facts','INSERT'
              ) AS direct_facts_insert`,
    )).rows[0];
    if (
      !identity
      || identity.current_user !== "geox_mcft_cap09_twin_runtime_login_v1"
      || identity.database_name !== MCFT_CAP09_FORMAL_V5_DATABASE_NAME_V1
      || identity.direct_facts_insert !== false
    ) {
      throw new Error("FORMAL_V5_TWIN_DATABASE_AUTHORITY_INVALID");
    }

    const composition = composeMcftCap09TwinRuntimeV3({
      pool,
      subject_sha: subject,
      manifest: activation.manifest,
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      current_crop_authority: activation.current_crop_authority,
      biological_stage_architecture_effectiveness:
        biologicalStageArchitecture,
      wait: new McftCap09ProductionTwinWaitV1({
        idle_poll_ms: integerEnvV3(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_IDLE_POLL_MS",
          5000,
          100,
          3_600_000,
          "FORMAL_V5_TWIN_IDLE_POLL_MS_INVALID",
        ),
        not_ready_poll_ms: integerEnvV3(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_NOT_READY_POLL_MS",
          15000,
          100,
          3_600_000,
          "FORMAL_V5_TWIN_NOT_READY_POLL_MS_INVALID",
        ),
        terminal_poll_ms: integerEnvV3(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_TERMINAL_POLL_MS",
          0,
          0,
          3_600_000,
          "FORMAL_V5_TWIN_TERMINAL_POLL_MS_INVALID",
        ),
        retry_base_ms: integerEnvV3(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_RETRY_BASE_MS",
          1000,
          100,
          3_600_000,
          "FORMAL_V5_TWIN_RETRY_BASE_MS_INVALID",
        ),
        retry_maximum_ms: integerEnvV3(
          env,
          "GEOX_MCFT_CAP09_TWIN_RUNTIME_RETRY_MAXIMUM_MS",
          60000,
          100,
          3_600_000,
          "FORMAL_V5_TWIN_RETRY_MAXIMUM_MS_INVALID",
        ),
      }),
      health: new McftCap09FormalV5TwinHealthV1(
        subject,
        activation.arm.epoch_id,
      ),
      stop,
      failure_classifier:
        new McftCap09ProductionTwinFailureClassifierV1(),
    });

    await composition.host.run({
      lease_owner: leaseOwner,
      lease_duration_seconds: leaseDurationSeconds,
    });
  } finally {
    stop.dispose();
    await pool.end();
  }
}
