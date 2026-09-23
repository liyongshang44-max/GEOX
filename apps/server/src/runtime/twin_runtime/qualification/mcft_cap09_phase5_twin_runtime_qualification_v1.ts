// MCFT-CAP-09 Phase 5 qualification-only Twin clock boundary.
//
// The current Production V2 Twin process/composition/host/runner/scheduler/persistence graph is reused.
// This module substitutes only the observed clock authority so O00-O23 can be exercised
// without real elapsed waiting. It does not implement a scheduler, lease, cursor, runner,
// evidence source, canonical tick, persistence path, or provider fallback.

import crypto from "node:crypto";
import fs from "node:fs";

import {
  MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
  type TwinRuntimeDatabaseClockPortV1,
} from "../mcft_cap09_twin_runtime_host_v1.js";
import { createDatabasePool } from "../../../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../../../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  composeMcftCap09TwinRuntimeV2,
} from "../mcft_cap09_twin_runtime_composition_v2.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "../external_formal_v4_amendment19_runner_v2.js";
import {
  createMcftCap09ProcessStopV1,
  installMcftCap09RuntimePoolIdleErrorGuardV1,
  McftCap09ConsoleTwinHealthV1,
  McftCap09ProductionTwinFailureClassifierV1,
  McftCap09ProductionTwinWaitV1,
} from "../../mcft_cap09_production_process_lifecycle_v1.js";
import {
  loadMcftCap09ProductionRuntimeStartAuthorityV1,
} from "../../mcft_cap09_production_runtime_start_authority_v1.js";
import {
  loadMcftCap09ProductionStageAuthorityMountsV1,
  readMcftCap09TwinRuntimeProcessConfigV1,
} from "../mcft_cap09_twin_runtime_process_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
  type PersistentSequentialSchedulerClockAuthorityV1,
} from "../postgres_persistent_sequential_scheduler_adapter_v1.js";

export const MCFT_CAP09_PHASE5_TWIN_QUALIFICATION_ENTRYPOINT_ID_V1 =
  "MCFT_CAP09_PHASE5_TWIN_QUALIFICATION_ENTRYPOINT_V1" as const;

export const MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1 =
  "MCFT_CAP09_PHASE5_ACCELERATED_WAIT_AND_CLOCK_ONLY" as const;

export const MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1 =
  "ACCELERATED_24T" as const;
export const MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1 =
  "REAL_CLOCK_REHEARSAL" as const;
export type McftCap09Phase5QualificationRunClassV1 =
  | typeof MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1
  | typeof MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1;

export const MCFT_CAP09_PHASE5_RUNTIME_START_QUALIFICATION_AUTHORITY_REF_V1 =
  "qualification://mcft-cap09/phase5/runtime-start-authority-v1" as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

function requiredEnvV1(env: EnvironmentV1, name: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`PHASE5_TWIN_QUALIFICATION_ENV_REQUIRED:${name}`);
  return value;
}

function readJsonObjectV1(filePath: string, code: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
  return value as Record<string, unknown>;
}

function canonicalHourV1(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_CLOCK_INVALID");
  }
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value || !canonical.endsWith(":00:00.000Z")) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_CLOCK_EXACT_HOUR_REQUIRED");
  }
  return canonical;
}

export class Phase5FixedTwinQualificationDatabaseClockV1
implements TwinRuntimeDatabaseClockPortV1 {
  private readonly observedAt: string;

  constructor(observedAt: string) {
    this.observedAt = canonicalHourV1(observedAt);
  }

  async readDatabaseNow() {
    return {
      // TwinRuntimeDatabaseClockPortV1 keeps the structural port identity used by
      // the Phase4 host. Qualification provenance is explicit at this entrypoint.
      clock_id: MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
      observed_at: this.observedAt,
    };
  }
}

export function buildPhase5TwinQualificationClockBoundaryV1(input: {
  through_logical_time: string;
  qualification_ack: string;
}): {
  database_clock: TwinRuntimeDatabaseClockPortV1;
  scheduler_clock_authority: PersistentSequentialSchedulerClockAuthorityV1;
} {
  if (input.qualification_ack !== MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_CLOCK_ACK_REQUIRED");
  }
  const through = canonicalHourV1(input.through_logical_time);
  const now = () => new Date(through);
  return {
    database_clock: new Phase5FixedTwinQualificationDatabaseClockV1(through),
    scheduler_clock_authority: {
      mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_ack: MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
      now,
    },
  };
}

export function buildPhase5TwinQualificationRuntimeStartAuthorityV1(input: {
  formal_a0: string;
  run_class: McftCap09Phase5QualificationRunClassV1;
  qualification_ack?: string;
  rehearsal_activation_fence_time?: string;
  deployment_subject_sha: string;
  current_crop_authority_sha256?: string;
  biological_stage_architecture_effectiveness_sha256?: string;
  scope: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    season_id: string;
    zone_id: string;
  };
}) {
  if (
    input.run_class === MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1
    && input.qualification_ack !== MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1
  ) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_RUNTIME_START_ACK_REQUIRED");
  }
  if (
    input.run_class !== MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1
    && input.run_class !== MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1
  ) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_RUN_CLASS_INVALID");
  }
  const formalA0 = canonicalHourV1(input.formal_a0);
  const activationFence = input.run_class === MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1
    ? (() => {
        const raw = String(input.rehearsal_activation_fence_time ?? "").trim();
        if (!raw) throw new Error("PHASE5_TWIN_REAL_CLOCK_REHEARSAL_ACTIVATION_FENCE_REQUIRED");
        const parsed = Date.parse(raw);
        if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== raw) {
          throw new Error("PHASE5_TWIN_REAL_CLOCK_REHEARSAL_ACTIVATION_FENCE_INVALID");
        }
        if (parsed >= Date.parse(formalA0)) {
          throw new Error("PHASE5_TWIN_REAL_CLOCK_REHEARSAL_FENCE_MUST_PRECEDE_A0");
        }
        return raw;
      })()
    : new Date(Date.parse(formalA0) - 30 * 60 * 1000).toISOString();
  return {
    schema_version:
      "geox_mcft_cap09_production_runtime_start_authority_instance_v1",
    authority_id:
      "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-INSTANCE-V1",
    status: "AUTHORIZED",
    armed: true,
    authority_class:
      "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
    authority_ref:
      input.run_class === MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1
        ? "qualification://mcft-cap09/phase5/real-clock-rehearsal/runtime-start-authority-v1"
        : MCFT_CAP09_PHASE5_RUNTIME_START_QUALIFICATION_AUTHORITY_REF_V1,
    deployment_subject_sha: input.deployment_subject_sha,
    scope: input.scope,
    activation_fence_time: activationFence,
    formal_a0_authority_ref:
      "qualification://mcft-cap09/phase5/formal-a0-authority-v1",
    formal_a0_authority_sha256:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    live_activation_authority_ref:
      "qualification://mcft-cap09/phase5/live-activation-authority-v1",
    live_activation_authority_sha256:
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    current_crop_authority_ref:
      "qualification://mcft-cap09/phase5/current-crop-authority-v1",
    current_crop_authority_sha256:
      input.current_crop_authority_sha256
      ?? "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    biological_stage_architecture_effectiveness_ref:
      "qualification://mcft-cap09/phase5/biological-stage-architecture-effectiveness-v1",
    biological_stage_architecture_effectiveness_sha256:
      input.biological_stage_architecture_effectiveness_sha256
      ?? "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    formal_a0_logical_time: formalA0,
    runtime_process_start_authorized: true,
    evidence_runtime_start_authorized: false,
    twin_runtime_start_authorized: true,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
  } as const;
}

export async function runMcftCap09Phase5TwinRuntimeQualificationV1(input?: {
  env?: EnvironmentV1;
}): Promise<void> {
  const env = input?.env ?? process.env;
  const runClass = String(
    env.GEOX_MCFT_CAP09_PHASE5_RUN_CLASS ?? MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1,
  ).trim() as McftCap09Phase5QualificationRunClassV1;
  if (
    runClass !== MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1
    && runClass !== MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1
  ) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_RUN_CLASS_INVALID");
  }
  const qualificationAck = runClass === MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1
    ? requiredEnvV1(env, "GEOX_MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK")
    : undefined;
  const boundary = runClass === MCFT_CAP09_PHASE5_ACCELERATED_RUN_CLASS_V1
    ? buildPhase5TwinQualificationClockBoundaryV1({
        through_logical_time: requiredEnvV1(
          env,
          "GEOX_MCFT_CAP09_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME",
        ),
        qualification_ack: qualificationAck!,
      })
    : null;
  const currentCropAuthorityPath = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_TWIN_RUNTIME_CURRENT_CROP_AUTHORITY_PATH",
  );
  const stageArchitectureEffectivenessPath = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_TWIN_RUNTIME_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH",
  );
  const fileSha256 = (filePath: string) =>
    "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

  const runtimeStartAuthority =
    buildPhase5TwinQualificationRuntimeStartAuthorityV1({
      formal_a0: requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_PHASE5_A0",
      ),
      run_class: runClass,
      qualification_ack: qualificationAck,
      rehearsal_activation_fence_time:
        runClass === MCFT_CAP09_PHASE5_REAL_CLOCK_REHEARSAL_RUN_CLASS_V1
          ? requiredEnvV1(env, "GEOX_MCFT_CAP09_PHASE5_REHEARSAL_ACTIVATION_FENCE")
          : undefined,
      deployment_subject_sha: requiredEnvV1(
        env,
        "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
      ),
      current_crop_authority_sha256: fileSha256(currentCropAuthorityPath),
      biological_stage_architecture_effectiveness_sha256:
        fileSha256(stageArchitectureEffectivenessPath),
      scope: {
        tenant_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_TENANT_ID"),
        project_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_PROJECT_ID"),
        group_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_GROUP_ID"),
        field_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_FIELD_ID"),
        season_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_SEASON_ID"),
        zone_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_ZONE_ID"),
      },
    });
  const hostname = requiredEnvV1(env, "HOSTNAME");
  const leaseOwner = `twin-runtime:${hostname}`;
  const runtimeEnv: EnvironmentV1 = {
    ...env,
    GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER: leaseOwner,
  };
  const config = readMcftCap09TwinRuntimeProcessConfigV1(runtimeEnv);
  const manifest = readJsonObjectV1(
    config.manifest_path,
    "PHASE5_TWIN_V2_MANIFEST_INVALID",
  ) as unknown as ExternalFormalV4Am19WindowManifestV2;
  const validatedRuntimeStartAuthority =
    loadMcftCap09ProductionRuntimeStartAuthorityV1({
      plane: "TWIN_RUNTIME",
      expected: {
        deployment_subject_sha: requiredEnvV1(env, "GEOX_DEPLOYMENT_SUBJECT_COMMIT"),
        scope: manifest.scope,
      },
      explicit_authority: runtimeStartAuthority,
    });
  const stageAuthorities = loadMcftCap09ProductionStageAuthorityMountsV1({
    runtime_start_authority: validatedRuntimeStartAuthority,
    current_crop_authority_path: config.current_crop_authority_path,
    biological_stage_architecture_effectiveness_path:
      config.biological_stage_architecture_effectiveness_path,
  });
  const cropAuthority = readJsonObjectV1(
    config.crop_authority_path,
    "PHASE5_TWIN_V2_CROP_AUTHORITY_INVALID",
  );
  const configurationMatrix = readJsonObjectV1(
    config.configuration_matrix_path,
    "PHASE5_TWIN_V2_CONFIGURATION_MATRIX_INVALID",
  );
  const pool = createDatabasePool(config.database_url);
  const failureClassifier = new McftCap09ProductionTwinFailureClassifierV1();
  const poolErrorGuard = installMcftCap09RuntimePoolIdleErrorGuardV1({
    pool,
    runtime_role: "TWIN_RUNTIME",
    failure_classifier: failureClassifier,
  });
  const stop = createMcftCap09ProcessStopV1();
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "TWIN_RUNTIME");
    const composition = composeMcftCap09TwinRuntimeV2({
      pool,
      manifest,
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      current_crop_authority: stageAuthorities.current_crop_authority,
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
      failure_classifier: failureClassifier,
      ...(boundary ?? {}),
    });
    await composition.host.run({
      lease_owner: leaseOwner,
      lease_duration_seconds: config.lease_duration_seconds,
    });
  } finally {
    stop.dispose();
    try {
      await pool.end();
    } finally {
      poolErrorGuard.dispose();
    }
  }
}
