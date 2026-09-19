// MCFT-CAP-09 Phase 5 qualification-only Twin clock boundary.
//
// The production Twin process/composition/host/runner/scheduler/persistence graph is reused.
// This module substitutes only the observed clock authority so O00-O23 can be exercised
// without real elapsed waiting. It does not implement a scheduler, lease, cursor, runner,
// evidence source, canonical tick, persistence path, or provider fallback.

import {
  MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
  type TwinRuntimeDatabaseClockPortV1,
} from "../mcft_cap09_twin_runtime_host_v1.js";
import {
  runMcftCap09TwinRuntimeProcessV1,
} from "../mcft_cap09_twin_runtime_process_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
  type PersistentSequentialSchedulerClockAuthorityV1,
} from "../postgres_persistent_sequential_scheduler_adapter_v1.js";

export const MCFT_CAP09_PHASE5_TWIN_QUALIFICATION_ENTRYPOINT_ID_V1 =
  "MCFT_CAP09_PHASE5_TWIN_QUALIFICATION_ENTRYPOINT_V1" as const;

export const MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1 =
  "MCFT_CAP09_PHASE5_ACCELERATED_WAIT_AND_CLOCK_ONLY" as const;

export const MCFT_CAP09_PHASE5_RUNTIME_START_QUALIFICATION_AUTHORITY_REF_V1 =
  "qualification://mcft-cap09/phase5/runtime-start-authority-v1" as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

function requiredEnvV1(env: EnvironmentV1, name: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`PHASE5_TWIN_QUALIFICATION_ENV_REQUIRED:${name}`);
  return value;
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
  qualification_ack: string;
  deployment_subject_sha: string;
  scope: {
    tenant_id: string;
    project_id: string;
    group_id: string;
    field_id: string;
    season_id: string;
    zone_id: string;
  };
}) {
  if (input.qualification_ack !== MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1) {
    throw new Error("PHASE5_TWIN_QUALIFICATION_RUNTIME_START_ACK_REQUIRED");
  }
  const formalA0 = canonicalHourV1(input.formal_a0);
  const activationFence = new Date(
    Date.parse(formalA0) - 30 * 60 * 1000,
  ).toISOString();
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
      MCFT_CAP09_PHASE5_RUNTIME_START_QUALIFICATION_AUTHORITY_REF_V1,
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
      "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    biological_stage_architecture_effectiveness_ref:
      "qualification://mcft-cap09/phase5/biological-stage-architecture-effectiveness-v1",
    biological_stage_architecture_effectiveness_sha256:
      "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
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
  const boundary = buildPhase5TwinQualificationClockBoundaryV1({
    through_logical_time: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_PHASE5_ACCELERATED_THROUGH_LOGICAL_TIME",
    ),
    qualification_ack: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK",
    ),
  });
  const qualificationAck = requiredEnvV1(
    env,
    "GEOX_MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK",
  );
  const runtimeStartAuthority =
    buildPhase5TwinQualificationRuntimeStartAuthorityV1({
      formal_a0: requiredEnvV1(
        env,
        "GEOX_MCFT_CAP09_PHASE5_A0",
      ),
      qualification_ack: qualificationAck,
      deployment_subject_sha: requiredEnvV1(
        env,
        "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
      ),
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
  await runMcftCap09TwinRuntimeProcessV1({
    env,
    ...boundary,
    runtime_start_authority: runtimeStartAuthority,
    qualification_lease_owner: `twin-runtime:${hostname}`,
  });
}
