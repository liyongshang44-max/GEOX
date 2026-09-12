// MCFT-CAP-09 Production Hosting Phase 5: Evidence Runtime production process factory.
//
// Production DB/S3 credentials, independent Evidence lease ownership, process lifecycle,
// and the exact Phase3 product composition are wired here. Acquisition target selection
// and provider transport are explicit injected boundaries so accelerated qualification may
// substitute only the frozen test clock/provider-adapter boundaries. No target cadence is
// invented by this module.

import os from "node:os";

import productionAcquisitionHorizonAuthorityJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-ACQUISITION-HORIZON-AUTHORITY-V1.json" with { type: "json" };

import { createDatabasePool } from "../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  composeEvidenceRuntimeV1,
  type EvidenceRuntimeAcquisitionTargetPlannerV1,
  type EvidenceRuntimeHostPlannerFactoryV1,
  type EvidenceRuntimeWorkItemFactoryV1,
} from "./mcft_cap09_evidence_runtime_composition_v1.js";
import type {
  EvidenceRuntimeHostPlannerV1,
} from "./mcft_cap09_evidence_runtime_host_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import type {
  ProductionEvidenceWorkItemFactoryConfigV1,
} from "./mcft_cap09_production_evidence_work_items_v1.js";
import {
  createProductionEvidenceHostPlannerFactoryV1,
} from "./mcft_cap09_production_evidence_planner_assembly_v1.js";
import type {
  ProductionEvidencePlanningClockV1,
  ProductionEvidenceRuntimeStartAuthorityInstanceV1,
} from "./mcft_cap09_production_evidence_host_planner_v1.js";
import {
  createMcftCap09ProcessStopV1,
  McftCap09ConsoleEvidenceHealthV1,
  McftCap09ProductionEvidenceFailureClassifierV1,
  McftCap09ProductionEvidenceWaitV1,
} from "../runtime/mcft_cap09_production_process_lifecycle_v1.js";
import {
  loadMcftCap09ProductionRuntimeStartAuthorityV1,
  parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1,
} from "../runtime/mcft_cap09_production_runtime_start_authority_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
} from "../runtime/mcft_cap09_production_service_identity_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_V1" as const;

export const MCFT_CAP09_PRODUCTION_EVIDENCE_RUNTIME_ENTRYPOINT_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_RUNTIME_ENTRYPOINT_V1" as const;

export const MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_CONTRACT_V1 = {
  process_id: MCFT_CAP09_EVIDENCE_RUNTIME_PROCESS_ID_V1,
  composition: "MCFT_CAP09_EVIDENCE_RUNTIME_COMPOSITION_V1",
  database_authority: "EVIDENCE_RUNTIME_DATABASE_URL_ONLY",
  database_principal: "geox_mcft_cap09_evidence_runtime_login_v1",
  raw_storage_authority: "EVIDENCE_RUNTIME_S3_CREDENTIALS_ONLY",
  target_selection_boundary: "EXPLICIT_INJECTED_TARGET_PLANNER",
  host_planner_boundary: "EXPLICIT_INJECTED_HOST_PLANNER",
  qualification_provider_boundary: "EXPLICIT_WORK_ITEM_FACTORY_INJECTION_WITH_PRODUCTION_DEFAULT",
  graceful_current_lease_release: true,
  runtime_tick_cursor_authority: false,
  twin_state_authority: false,
  action_authority: false,
  formal_arm_authority: false,
  runtime_start_authority: "SEPARATE_GOVERNED_AUTHORITY_REQUIRED",
  production_owner_cutover: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

export type McftCap09EvidenceRuntimeProcessConfigV1 = {
  database_url: string;
  scope: EvidenceRuntimeScopeV1;
  s3_endpoint: string;
  s3_bucket: string;
  s3_region: string;
  s3_access_key_id: string;
  s3_secret_access_key: string;
  s3_allow_insecure_http_for_test: boolean;
  lease_owner: string;
  lease_duration_seconds: number;
  success_cadence_ms: number;
  lease_standby_ms: number;
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
  if (!/^\d+$/.test(raw)) throw new Error(code);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(code);
  }
  return value;
}

function booleanEnvV1(
  env: EnvironmentV1,
  name: string,
  fallback: boolean,
): boolean {
  const raw = String(env[name] ?? (fallback ? "1" : "0")).trim();
  if (raw === "1") return true;
  if (raw === "0") return false;
  throw new Error(`PHASE5_EVIDENCE_BOOLEAN_ENV_INVALID:${name}`);
}

function scopeFromEnvironmentV1(env: EnvironmentV1): EvidenceRuntimeScopeV1 {
  return {
    tenant_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_TENANT_ID", "PHASE5_EVIDENCE_TENANT_ID_REQUIRED"),
    project_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_PROJECT_ID", "PHASE5_EVIDENCE_PROJECT_ID_REQUIRED"),
    group_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_GROUP_ID", "PHASE5_EVIDENCE_GROUP_ID_REQUIRED"),
    field_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_FIELD_ID", "PHASE5_EVIDENCE_FIELD_ID_REQUIRED"),
    season_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_SEASON_ID", "PHASE5_EVIDENCE_SEASON_ID_REQUIRED"),
    zone_id: requiredEnvV1(env, "GEOX_MCFT_CAP09_ZONE_ID", "PHASE5_EVIDENCE_ZONE_ID_REQUIRED"),
  };
}

export function readMcftCap09EvidenceRuntimeProcessConfigV1(
  env: EnvironmentV1 = process.env,
): McftCap09EvidenceRuntimeProcessConfigV1 {
  return {
    database_url: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
      "PHASE5_EVIDENCE_DATABASE_URL_REQUIRED",
    ),
    scope: scopeFromEnvironmentV1(env),
    s3_endpoint: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
      "PHASE5_EVIDENCE_S3_ENDPOINT_REQUIRED",
    ),
    s3_bucket: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
      "PHASE5_EVIDENCE_S3_BUCKET_REQUIRED",
    ),
    s3_region: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
      "PHASE5_EVIDENCE_S3_REGION_REQUIRED",
    ),
    s3_access_key_id: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
      "PHASE5_EVIDENCE_S3_ACCESS_KEY_REQUIRED",
    ),
    s3_secret_access_key: requiredEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
      "PHASE5_EVIDENCE_S3_SECRET_KEY_REQUIRED",
    ),
    s3_allow_insecure_http_for_test: booleanEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_ALLOW_INSECURE_HTTP_FOR_TEST",
      false,
    ),
    lease_owner: String(
      env.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_OWNER
      ?? `evidence-runtime:${env.HOSTNAME ?? os.hostname()}`,
    ).trim(),
    lease_duration_seconds: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_DURATION_SECONDS",
      300,
      1,
      3600,
      "PHASE5_EVIDENCE_LEASE_DURATION_INVALID",
    ),
    success_cadence_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_SUCCESS_CADENCE_MS",
      60_000,
      100,
      86_400_000,
      "PHASE5_EVIDENCE_SUCCESS_CADENCE_MS_INVALID",
    ),
    lease_standby_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_LEASE_STANDBY_MS",
      5000,
      100,
      3_600_000,
      "PHASE5_EVIDENCE_LEASE_STANDBY_MS_INVALID",
    ),
    retry_base_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_RETRY_BASE_MS",
      1000,
      100,
      3_600_000,
      "PHASE5_EVIDENCE_RETRY_BASE_MS_INVALID",
    ),
    retry_maximum_ms: integerEnvV1(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_RETRY_MAXIMUM_MS",
      60_000,
      100,
      3_600_000,
      "PHASE5_EVIDENCE_RETRY_MAXIMUM_MS_INVALID",
    ),
  };
}

export async function runMcftCap09EvidenceRuntimeProcessV1(input: {
  env?: EnvironmentV1;
  completion_clock?: () => string;
  work_item_config?: Omit<ProductionEvidenceWorkItemFactoryConfigV1, "retention">;
  work_item_factory?: EvidenceRuntimeWorkItemFactoryV1;
} & (
  | { target_planner: EvidenceRuntimeAcquisitionTargetPlannerV1; host_planner?: never; host_planner_factory?: never }
  | { target_planner?: never; host_planner: EvidenceRuntimeHostPlannerV1; host_planner_factory?: never }
  | { target_planner?: never; host_planner?: never; host_planner_factory: EvidenceRuntimeHostPlannerFactoryV1 }
)): Promise<void> {
  const env = input.env ?? process.env;
  const config = readMcftCap09EvidenceRuntimeProcessConfigV1(env);
  if (!config.lease_owner) throw new Error("PHASE5_EVIDENCE_LEASE_OWNER_REQUIRED");

  const pool = createDatabasePool(config.database_url);
  const stop = createMcftCap09ProcessStopV1();
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "EVIDENCE_RUNTIME");

    const composition = composeEvidenceRuntimeV1({
      pool,
      scope: config.scope,
      raw_retention: {
        endpoint: config.s3_endpoint,
        bucket: config.s3_bucket,
        region: config.s3_region,
        access_key_id: config.s3_access_key_id,
        secret_access_key: config.s3_secret_access_key,
        allow_insecure_http_for_test: config.s3_allow_insecure_http_for_test,
      },
      ...(input.host_planner
        ? { host_planner: input.host_planner }
        : input.host_planner_factory
          ? { host_planner_factory: input.host_planner_factory }
          : { target_planner: input.target_planner! }),
      wait: new McftCap09ProductionEvidenceWaitV1({
        success_cadence_ms: config.success_cadence_ms,
        lease_standby_ms: config.lease_standby_ms,
        retry_base_ms: config.retry_base_ms,
        retry_maximum_ms: config.retry_maximum_ms,
      }),
      health: new McftCap09ConsoleEvidenceHealthV1(),
      stop,
      failure_classifier: new McftCap09ProductionEvidenceFailureClassifierV1(),
      completion_clock: input.completion_clock ?? (() => new Date().toISOString()),
      work_item_config: input.work_item_config,
      work_item_factory: input.work_item_factory,
    });

    const result = await composition.host.run({
      scope: config.scope,
      lease_owner: config.lease_owner,
      lease_duration_seconds: config.lease_duration_seconds,
    });
    const finalClaim = result.last_attempt_result?.lease_claim ?? null;
    if (finalClaim && finalClaim.lease_owner === config.lease_owner) {
      await composition.lease_repository.releaseLease({ claim: finalClaim });
    }
  } finally {
    stop.dispose();
    await pool.end();
  }
}

export function parseMcftCap09ProductionRuntimeStartAuthorityV1(
  value: unknown,
  expected: {
    deployment_subject_sha: string;
    scope: EvidenceRuntimeScopeV1;
  },
): ProductionEvidenceRuntimeStartAuthorityInstanceV1 {
  return parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
    value,
    "EVIDENCE_RUNTIME",
    expected,
  );
}

export async function runMcftCap09ProductionEvidenceRuntimeV1(input: {
  env?: EnvironmentV1;
  planning_clock?: ProductionEvidencePlanningClockV1;
  work_item_config?: Omit<ProductionEvidenceWorkItemFactoryConfigV1, "retention">;
  runtime_start_authority?: unknown;
} = {}): Promise<void> {
  const document = productionAcquisitionHorizonAuthorityJson as {
    runtime_start_binding?: unknown;
  };
  const env = input.env ?? process.env;
  const expectedScope = scopeFromEnvironmentV1(env);
  const authority = loadMcftCap09ProductionRuntimeStartAuthorityV1({
    plane: "EVIDENCE_RUNTIME",
    expected: {
      deployment_subject_sha: requiredEnvV1(
        env,
        "GEOX_DEPLOYMENT_SUBJECT_COMMIT",
        "MCFT_CAP09_PRODUCTION_DEPLOYMENT_SUBJECT_REQUIRED",
      ),
      scope: expectedScope,
    },
    authority_path:
      env.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH,
    explicit_authority: input.runtime_start_authority,
    embedded_authority: document.runtime_start_binding,
  });
  const runtimeEnv: EnvironmentV1 = {
    ...env,
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_LEASE_OWNER:
      buildMcftCap09ProductionLeaseOwnerV1({
        plane: "EVIDENCE_RUNTIME",
        configured_service_id: requiredEnvV1(
          env,
          "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_SERVICE_ID",
          "MCFT_CAP09_PRODUCTION_EVIDENCE_SERVICE_ID_REQUIRED",
        ),
        instance_id: String(env.HOSTNAME ?? os.hostname()).trim(),
      }),
  };
  const config = readMcftCap09EvidenceRuntimeProcessConfigV1(runtimeEnv);
  const planningClock = input.planning_clock ?? { now: () => new Date().toISOString() };
  const hostPlannerFactory = createProductionEvidenceHostPlannerFactoryV1({
    runtime_start_authority: authority,
    planning_clock: planningClock,
    private_store: {
      endpoint: config.s3_endpoint,
      bucket: config.s3_bucket,
      region: config.s3_region,
      access_key_id: config.s3_access_key_id,
      secret_access_key: config.s3_secret_access_key,
      allow_insecure_http_for_test: config.s3_allow_insecure_http_for_test,
    },
    work_item_config: input.work_item_config,
  });
  await runMcftCap09EvidenceRuntimeProcessV1({
    env: runtimeEnv,
    host_planner_factory: hostPlannerFactory,
    work_item_config: input.work_item_config,
  });
}
