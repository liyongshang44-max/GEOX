// MCFT-CAP-09 post-merge v13 production forcing process boundary.
// This module creates a production process context but never starts it automatically.
// Runtime infrastructure credentials come from environment. Formal authority inputs
// (scope, subject, epoch, base window, qualified timing budget) must be injected by a
// governed caller and therefore cannot be invented by deployment environment variables.

import type { Pool } from "pg";

import { createDatabasePool } from "../infra/database.js";
import { assertMcftCap09ServicePrincipalV1 } from "../infra/mcft_cap09_phase5_service_principal_v1.js";
import type { TwinScopeKeyV1 } from "../runtime/twin_runtime/ports.js";
import type { FormalForcingAcquisitionBudgetAdjudicationV1 } from "../domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  composeMcftCap09V13ForcingProductionV1,
} from "./mcft_cap09_v13_forcing_production_composition_v1.js";

export const MCFT_CAP09_V13_FORCING_PRODUCTION_PROCESS_ID_V1 =
  "MCFT_CAP09_V13_FORCING_PRODUCTION_PROCESS_V1" as const;

export const MCFT_CAP09_V13_FORCING_PRODUCTION_PROCESS_CONTRACT_V1 = {
  process_id: MCFT_CAP09_V13_FORCING_PRODUCTION_PROCESS_ID_V1,
  runtime_role: "EVIDENCE_RUNTIME",
  database_principal: "geox_mcft_cap09_evidence_runtime_login_v1",
  direct_facts_insert_required: false,
  fenced_writer_execute_required: true,
  auto_start: false,
  activation_mode: "EXPLICIT_GOVERNED_CALLER_RUN_ONCE",
  environment_may_define_formal_subject: false,
  environment_may_define_epoch: false,
  environment_may_define_base_window: false,
  environment_may_define_timing_budget: false,
  remote_store_provisioning_performed: false,
  production_owner_activation_performed: false,
  formal_v5_arm_performed: false,
  o00_started: false,
} as const;

type EnvironmentV1 = Readonly<Record<string, string | undefined>>;

export type McftCap09V13ForcingRuntimeCredentialsV1 = {
  database_url: string;
  s3_endpoint: string;
  s3_bucket: string;
  s3_region: string;
  s3_access_key_id: string;
  s3_secret_access_key: string;
  s3_allow_insecure_http_for_test: boolean;
  controller_owner: string;
  producer_owner: string;
  controller_lease_duration_seconds: number;
  producer_lease_duration_seconds: number;
  heartbeat_interval_ms: number;
};

export type McftCap09V13ForcingGovernedAuthorityV1 = {
  scope: TwinScopeKeyV1;
  subject_sha: string;
  epoch_id: string;
  first_required_base: string;
  last_required_base: string;
  qualified_budget: FormalForcingAcquisitionBudgetAdjudicationV1;
};

function requiredEnv(env: EnvironmentV1, name: string, code: string): string {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(code);
  return value;
}
function integerEnv(
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
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(code);
  return value;
}
function booleanEnv(env: EnvironmentV1, name: string, fallback: boolean): boolean {
  const raw = String(env[name] ?? (fallback ? "1" : "0")).trim();
  if (raw === "1") return true;
  if (raw === "0") return false;
  throw new Error("POSTMERGE_V13_PROCESS_BOOLEAN_ENV_INVALID:" + name);
}

export function readMcftCap09V13ForcingRuntimeCredentialsV1(
  env: EnvironmentV1 = process.env,
): McftCap09V13ForcingRuntimeCredentialsV1 {
  return {
    database_url: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
      "POSTMERGE_V13_PROCESS_DATABASE_URL_REQUIRED",
    ),
    s3_endpoint: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
      "POSTMERGE_V13_PROCESS_S3_ENDPOINT_REQUIRED",
    ),
    s3_bucket: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
      "POSTMERGE_V13_PROCESS_S3_BUCKET_REQUIRED",
    ),
    s3_region: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
      "POSTMERGE_V13_PROCESS_S3_REGION_REQUIRED",
    ),
    s3_access_key_id: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
      "POSTMERGE_V13_PROCESS_S3_ACCESS_KEY_REQUIRED",
    ),
    s3_secret_access_key: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
      "POSTMERGE_V13_PROCESS_S3_SECRET_KEY_REQUIRED",
    ),
    s3_allow_insecure_http_for_test: booleanEnv(
      env,
      "GEOX_MCFT_CAP09_EVIDENCE_S3_ALLOW_INSECURE_HTTP_FOR_TEST",
      false,
    ),
    controller_owner: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_V13_CONTROLLER_OWNER",
      "POSTMERGE_V13_PROCESS_CONTROLLER_OWNER_REQUIRED",
    ),
    producer_owner: requiredEnv(
      env,
      "GEOX_MCFT_CAP09_V13_PRODUCER_OWNER",
      "POSTMERGE_V13_PROCESS_PRODUCER_OWNER_REQUIRED",
    ),
    controller_lease_duration_seconds: integerEnv(
      env,
      "GEOX_MCFT_CAP09_V13_CONTROLLER_LEASE_SECONDS",
      300,
      1,
      1800,
      "POSTMERGE_V13_PROCESS_CONTROLLER_LEASE_INVALID",
    ),
    producer_lease_duration_seconds: integerEnv(
      env,
      "GEOX_MCFT_CAP09_V13_PRODUCER_LEASE_SECONDS",
      300,
      1,
      1800,
      "POSTMERGE_V13_PROCESS_PRODUCER_LEASE_INVALID",
    ),
    heartbeat_interval_ms: integerEnv(
      env,
      "GEOX_MCFT_CAP09_V13_HEARTBEAT_INTERVAL_MS",
      30_000,
      100,
      1_799_999,
      "POSTMERGE_V13_PROCESS_HEARTBEAT_INVALID",
    ),
  };
}

export async function assertMcftCap09V13ForcingProductionDatabaseAuthorityV1(
  pool: Pick<Pool, "query">,
): Promise<void> {
  const functionSignature =
    "public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(" +
    "text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)";
  const result = await pool.query<{
    current_user: string;
    direct_facts_insert: boolean;
    fenced_writer_present: boolean;
    fenced_writer_execute: boolean;
  }>(
    `SELECT current_user::text AS current_user,
            pg_catalog.has_table_privilege(current_user,'public.facts','INSERT') AS direct_facts_insert,
            pg_catalog.to_regprocedure($1) IS NOT NULL AS fenced_writer_present,
            CASE WHEN pg_catalog.to_regprocedure($1) IS NULL THEN false
                 ELSE pg_catalog.has_function_privilege(current_user,$1,'EXECUTE') END AS fenced_writer_execute`,
    [functionSignature],
  );
  const row = result.rows[0];
  if (!row || row.current_user !== "geox_mcft_cap09_evidence_runtime_login_v1") {
    throw new Error("POSTMERGE_V13_PROCESS_DATABASE_PRINCIPAL_MISMATCH");
  }
  if (row.direct_facts_insert !== false) {
    throw new Error("POSTMERGE_V13_PROCESS_DIRECT_FACTS_INSERT_MUST_REMAIN_DENIED");
  }
  if (row.fenced_writer_present !== true || row.fenced_writer_execute !== true) {
    throw new Error("POSTMERGE_V13_PROCESS_FENCED_WRITER_AUTHORITY_REQUIRED");
  }
}

export async function createMcftCap09V13ForcingProductionProcessV1(input: {
  authority: McftCap09V13ForcingGovernedAuthorityV1;
  env?: EnvironmentV1;
  clock?: () => Date;
  work_item_config?: {
    fetch_impl?: typeof fetch;
    python_executable?: string;
    gfs_product_decoder_path?: string;
    gfs_byte_client_max_bytes?: number;
    gfs_timeout_ms?: number;
  };
}) {
  const credentials = readMcftCap09V13ForcingRuntimeCredentialsV1(input.env ?? process.env);
  const pool = createDatabasePool(credentials.database_url);
  try {
    await assertMcftCap09ServicePrincipalV1(pool, "EVIDENCE_RUNTIME");
    await assertMcftCap09V13ForcingProductionDatabaseAuthorityV1(pool);

    const composition = composeMcftCap09V13ForcingProductionV1({
      pool,
      scope: input.authority.scope,
      subject_sha: input.authority.subject_sha,
      epoch_id: input.authority.epoch_id,
      first_required_base: input.authority.first_required_base,
      last_required_base: input.authority.last_required_base,
      qualified_budget: input.authority.qualified_budget,
      private_store: {
        endpoint: credentials.s3_endpoint,
        bucket: credentials.s3_bucket,
        region: credentials.s3_region,
        access_key_id: credentials.s3_access_key_id,
        secret_access_key: credentials.s3_secret_access_key,
        allow_insecure_http_for_test: credentials.s3_allow_insecure_http_for_test,
        clock: input.clock,
      },
      controller_owner: credentials.controller_owner,
      producer_owner: credentials.producer_owner,
      controller_lease_duration_seconds: credentials.controller_lease_duration_seconds,
      producer_lease_duration_seconds: credentials.producer_lease_duration_seconds,
      heartbeat_interval_ms: credentials.heartbeat_interval_ms,
      clock: input.clock,
      work_item_config: input.work_item_config,
    });

    return {
      process_id: MCFT_CAP09_V13_FORCING_PRODUCTION_PROCESS_ID_V1,
      contract: MCFT_CAP09_V13_FORCING_PRODUCTION_PROCESS_CONTRACT_V1,
      activation_state: "NOT_ACTIVATED" as const,
      composition,
      // Deliberately explicit: only a separately governed activator may call this.
      runOnce: () => composition.controller_service.runOnce(),
      close: async () => { await pool.end(); },
    };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
