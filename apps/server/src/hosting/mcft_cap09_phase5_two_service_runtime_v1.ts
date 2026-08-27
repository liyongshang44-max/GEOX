// MCFT-CAP-09 Production Hosting Phase 5: actual two-service process assembly.
//
// Both process runners delegate to the already-qualified Phase3/Phase4 product
// compositions. This module owns only environment/file configuration and process
// lifecycle assembly. It contains no Evidence decoder/science, Twin algorithm,
// persistence implementation, provider fallback, or production ownership cutover.

import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

import {
  composeEvidenceRuntimeV1,
  type EvidenceRuntimeAcquisitionTargetV1,
} from "../external_evidence/mcft_cap09_evidence_runtime_composition_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import type {
  ProductionEvidenceSourceFamilyV1,
} from "../external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import {
  composeMcftCap09TwinRuntimeV1,
} from "../runtime/twin_runtime/mcft_cap09_twin_runtime_composition_v1.js";
import type {
  ExternalFormalV3Am19WindowManifestV1,
} from "../runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import {
  MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
  type TwinRuntimeDatabaseClockPortV1,
  type TwinRuntimeHostHealthEventV1,
  type TwinRuntimeHostHealthPortV1,
} from "../runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
  type PersistentSequentialSchedulerClockAuthorityV1,
} from "../runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import {
  JsonLineServiceHealthPortV1,
  Phase5ServiceWaitPortV1,
  PostgresTransientFailureClassifierV1,
  ProcessSignalStopPortV1,
  type Phase5ServiceWaitProfileV1,
} from "./mcft_cap09_phase5_service_lifecycle_v1.js";

export const MCFT_CAP09_PHASE5_TWO_SERVICE_RUNTIME_ID_V1 =
  "MCFT_CAP09_PHASE5_TWO_SERVICE_RUNTIME_V1" as const;

export const MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1 =
  "MCFT_CAP09_PHASE5_ACCELERATED_WAIT_AND_CLOCK_ONLY" as const;

type JsonRecordV1 = Record<string, unknown>;

function requiredEnvV1(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("PHASE5_SERVICE_ENV_REQUIRED:" + name);
  return value;
}

function optionalEnvV1(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function integerEnvV1(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = optionalEnvV1(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error("PHASE5_SERVICE_INTEGER_ENV_INVALID:" + name);
  }
  return value;
}

function booleanEnvV1(name: string, fallback = false): boolean {
  const raw = optionalEnvV1(name);
  if (raw === null) return fallback;
  if (raw === "1" || raw.toLowerCase() === "true") return true;
  if (raw === "0" || raw.toLowerCase() === "false") return false;
  throw new Error("PHASE5_SERVICE_BOOLEAN_ENV_INVALID:" + name);
}

function canonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(code);
  }
  return value;
}

function canonicalHourV1(value: string, code: string): string {
  const canonical = canonicalIsoV1(value, code);
  if (!canonical.endsWith(":00:00.000Z")) throw new Error(code);
  return canonical;
}

function readJsonFileV1(file: string): JsonRecordV1 {
  const resolved = path.resolve(file);
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PHASE5_SERVICE_JSON_OBJECT_REQUIRED:" + resolved);
  }
  return parsed as JsonRecordV1;
}

function scopeFromEnvironmentV1(): EvidenceRuntimeScopeV1 {
  return {
    tenant_id: requiredEnvV1("GEOX_MCFT_CAP09_TENANT_ID"),
    project_id: requiredEnvV1("GEOX_MCFT_CAP09_PROJECT_ID"),
    group_id: requiredEnvV1("GEOX_MCFT_CAP09_GROUP_ID"),
    field_id: requiredEnvV1("GEOX_MCFT_CAP09_FIELD_ID"),
    season_id: requiredEnvV1("GEOX_MCFT_CAP09_SEASON_ID"),
    zone_id: requiredEnvV1("GEOX_MCFT_CAP09_ZONE_ID"),
  };
}

function waitProfileFromEnvironmentV1(): Phase5ServiceWaitProfileV1 {
  return {
    success_wait_ms: integerEnvV1("GEOX_MCFT_CAP09_SUCCESS_WAIT_MS", 60_000, 0, 3_600_000),
    standby_wait_ms: integerEnvV1("GEOX_MCFT_CAP09_STANDBY_WAIT_MS", 5_000, 0, 3_600_000),
    retry_wait_ms: integerEnvV1("GEOX_MCFT_CAP09_RETRY_WAIT_MS", 5_000, 0, 3_600_000),
    terminal_wait_ms: integerEnvV1("GEOX_MCFT_CAP09_TERMINAL_WAIT_MS", 60_000, 0, 3_600_000),
    no_due_wait_ms: integerEnvV1("GEOX_MCFT_CAP09_NO_DUE_WAIT_MS", 5_000, 0, 3_600_000),
    backpressure_wait_ms: integerEnvV1("GEOX_MCFT_CAP09_BACKPRESSURE_WAIT_MS", 5_000, 0, 3_600_000),
  };
}

function evidenceSourceFamiliesFromEnvironmentV1():
readonly ProductionEvidenceSourceFamilyV1[] {
  const raw = optionalEnvV1("GEOX_MCFT_CAP09_EVIDENCE_SOURCE_FAMILIES")
    ?? "KBS_SOIL,GFS_BUNDLE";
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  const allowed: readonly ProductionEvidenceSourceFamilyV1[] = [
    "KBS_SOIL",
    "KBS_RAW_HOURLY",
    "GFS_BUNDLE",
  ];
  if (
    values.length === 0
    || new Set(values).size !== values.length
    || values.some((value) => !allowed.includes(value as ProductionEvidenceSourceFamilyV1))
  ) {
    throw new Error("PHASE5_EVIDENCE_SOURCE_FAMILIES_INVALID");
  }
  return values as ProductionEvidenceSourceFamilyV1[];
}

class FixedQualificationTwinClockV1
implements TwinRuntimeDatabaseClockPortV1 {
  constructor(private readonly now: string) {}

  async readDatabaseNow() {
    return {
      // The host consumes only observed_at; the scheduler has its own explicitly
      // ack-gated accelerated authority. Keep the structural identifier stable.
      clock_id: MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
      observed_at: this.now,
    };
  }
}

class StopAfterTerminalHealthPortV1 implements TwinRuntimeHostHealthPortV1 {
  constructor(
    private readonly delegate: TwinRuntimeHostHealthPortV1,
    private readonly stop: ProcessSignalStopPortV1,
    private readonly stopAfterTerminalTicks: number | null,
  ) {}

  async recordHealth(event: TwinRuntimeHostHealthEventV1): Promise<void> {
    await this.delegate.recordHealth(event);
    if (
      this.stopAfterTerminalTicks !== null
      && event.detail === "TERMINAL_SLOT_RECORDED"
      && event.terminal_slot_count >= this.stopAfterTerminalTicks
    ) {
      this.stop.requestStopForQualification();
    }
  }
}

function acceleratedTwinClockFromEnvironmentV1(): {
  host_clock?: TwinRuntimeDatabaseClockPortV1;
  scheduler_clock_authority?: PersistentSequentialSchedulerClockAuthorityV1;
} {
  const accelerated = optionalEnvV1("GEOX_MCFT_CAP09_ACCELERATED_CLOCK_AT");
  if (accelerated === null) return {};
  if (
    requiredEnvV1("GEOX_MCFT_CAP09_ACCELERATED_CLOCK_ACK")
    !== MCFT_CAP09_PHASE5_ACCELERATED_CLOCK_ACK_V1
  ) {
    throw new Error("PHASE5_ACCELERATED_CLOCK_ACK_REQUIRED");
  }
  const now = canonicalHourV1(
    accelerated,
    "PHASE5_ACCELERATED_CLOCK_HOUR_REQUIRED",
  );
  const fixed = () => new Date(now);
  return {
    host_clock: new FixedQualificationTwinClockV1(now),
    scheduler_clock_authority: {
      mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_ack: MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
      now: fixed,
    },
  };
}

export async function runMcftCap09Phase5EvidenceServiceFromEnvironmentV1():
Promise<void> {
  const pool = new Pool({
    connectionString: requiredEnvV1("DATABASE_URL"),
    max: integerEnvV1("GEOX_MCFT_CAP09_DB_POOL_MAX", 4, 1, 32),
  });
  const stop = new ProcessSignalStopPortV1();
  stop.install();
  const health = new JsonLineServiceHealthPortV1("EVIDENCE_RUNTIME");
  const wait = new Phase5ServiceWaitPortV1(waitProfileFromEnvironmentV1());
  const classifier = new PostgresTransientFailureClassifierV1();
  const scope = scopeFromEnvironmentV1();
  const target = canonicalHourV1(
    requiredEnvV1("GEOX_MCFT_CAP09_EVIDENCE_TARGET_LOGICAL_TIME"),
    "PHASE5_EVIDENCE_TARGET_HOUR_REQUIRED",
  );
  const requestedAt = canonicalIsoV1(
    requiredEnvV1("GEOX_MCFT_CAP09_EVIDENCE_REQUESTED_AT"),
    "PHASE5_EVIDENCE_REQUESTED_AT_INVALID",
  );
  const sourceFamilies = evidenceSourceFamiliesFromEnvironmentV1();
  const requestPrefix = requiredEnvV1("GEOX_MCFT_CAP09_EVIDENCE_REQUEST_PREFIX");

  const targetPlanner = {
    async nextTarget(input: {
      successful_cycle_count: number;
    }): Promise<EvidenceRuntimeAcquisitionTargetV1 | null> {
      if (input.successful_cycle_count >= 1) return null;
      return {
        target_logical_time: target,
        requested_at: requestedAt,
        request_id_prefix: requestPrefix,
        source_families: sourceFamilies,
      };
    },
  };

  const composition = composeEvidenceRuntimeV1({
    pool,
    scope,
    raw_retention: {
      endpoint: requiredEnvV1("GEOX_MCFT_CAP09_RAW_S3_ENDPOINT"),
      bucket: requiredEnvV1("GEOX_MCFT_CAP09_RAW_S3_BUCKET"),
      region: requiredEnvV1("GEOX_MCFT_CAP09_RAW_S3_REGION"),
      access_key_id: requiredEnvV1("GEOX_MCFT_CAP09_RAW_S3_ACCESS_KEY_ID"),
      secret_access_key: requiredEnvV1("GEOX_MCFT_CAP09_RAW_S3_SECRET_ACCESS_KEY"),
      allow_insecure_http_for_test: booleanEnvV1(
        "GEOX_MCFT_CAP09_RAW_S3_ALLOW_INSECURE_HTTP",
        false,
      ),
    },
    target_planner: targetPlanner,
    wait,
    health,
    stop,
    failure_classifier: classifier,
    completion_clock: () => new Date().toISOString(),
    work_item_config: {
      python_executable: optionalEnvV1("GEOX_MCFT_CAP09_PYTHON_EXECUTABLE") ?? "python",
    },
  });

  try {
    const result = await composition.host.run({
      scope,
      lease_owner: requiredEnvV1("GEOX_MCFT_CAP09_LEASE_OWNER"),
      lease_duration_seconds: integerEnvV1(
        "GEOX_MCFT_CAP09_LEASE_DURATION_SECONDS",
        300,
        1,
        3600,
      ),
    });
    process.stdout.write(JSON.stringify({
      schema_version: "geox_mcft_cap09_phase5_evidence_service_exit_v1",
      service_runtime_id: MCFT_CAP09_PHASE5_TWO_SERVICE_RUNTIME_ID_V1,
      ...result,
    }) + "\n");
  } finally {
    await pool.end();
  }
}

export async function runMcftCap09Phase5TwinServiceFromEnvironmentV1():
Promise<void> {
  const pool = new Pool({
    connectionString: requiredEnvV1("DATABASE_URL"),
    max: integerEnvV1("GEOX_MCFT_CAP09_DB_POOL_MAX", 6, 1, 32),
  });
  const stop = new ProcessSignalStopPortV1();
  stop.install();
  const baseHealth = new JsonLineServiceHealthPortV1("TWIN_RUNTIME");
  const stopAfter = optionalEnvV1("GEOX_MCFT_CAP09_STOP_AFTER_TERMINAL_TICKS");
  const stopAfterTerminalTicks = stopAfter === null
    ? null
    : integerEnvV1("GEOX_MCFT_CAP09_STOP_AFTER_TERMINAL_TICKS", 24, 1, 24);
  const health = new StopAfterTerminalHealthPortV1(
    baseHealth,
    stop,
    stopAfterTerminalTicks,
  );
  const wait = new Phase5ServiceWaitPortV1(waitProfileFromEnvironmentV1());
  const classifier = new PostgresTransientFailureClassifierV1();
  const manifest = readJsonFileV1(
    requiredEnvV1("GEOX_MCFT_CAP09_TWIN_MANIFEST_PATH"),
  ) as unknown as ExternalFormalV3Am19WindowManifestV1;
  const cropAuthority = readJsonFileV1(
    requiredEnvV1("GEOX_MCFT_CAP09_CROP_AUTHORITY_PATH"),
  );
  const configurationMatrix = readJsonFileV1(
    requiredEnvV1("GEOX_MCFT_CAP09_CONFIGURATION_MATRIX_PATH"),
  );
  const clock = acceleratedTwinClockFromEnvironmentV1();

  const composition = composeMcftCap09TwinRuntimeV1({
    pool,
    manifest,
    crop_authority: cropAuthority,
    configuration_matrix: configurationMatrix,
    wait,
    health,
    stop,
    failure_classifier: classifier,
    ...clock,
  });

  try {
    const result = await composition.host.run({
      lease_owner: requiredEnvV1("GEOX_MCFT_CAP09_LEASE_OWNER"),
      lease_duration_seconds: integerEnvV1(
        "GEOX_MCFT_CAP09_LEASE_DURATION_SECONDS",
        300,
        1,
        3600,
      ),
    });
    process.stdout.write(JSON.stringify({
      schema_version: "geox_mcft_cap09_phase5_twin_service_exit_v1",
      service_runtime_id: MCFT_CAP09_PHASE5_TWO_SERVICE_RUNTIME_ID_V1,
      accelerated_clock_substituted_wait_only:
        optionalEnvV1("GEOX_MCFT_CAP09_ACCELERATED_CLOCK_AT") !== null,
      ...result,
    }) + "\n");
  } finally {
    await pool.end();
  }
}
