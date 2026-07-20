// apps/server/src/infra/runtime_schema_compatibility_bootstrap_v1.ts
// Purpose: materialize legacy runtime schema shims under the external database-platform bootstrap identity before long-running Runtime starts.
// Boundary: one-shot administrative DDL only; no canonical facts, Runtime execution, route registration, or application credential fallback.

import { Pool } from "pg";

export const RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1 = [
  "public.worker_runtime_heartbeat_v1",
  "public.jobs",
  "public.evidence_export_job_index_v1",
  "public.evidence_pack_index_v1",
  "public.derived_sensing_state_index_v1",
  "public.agronomy_inference_result_v1",
  "public.agronomy_inference_index_v1",
  "public.agronomy_observation_index_v1",
  "public.field_season_index_v1",
] as const;

export const RUNTIME_SCHEMA_ROUTE_SHIM_RELATIONS_V1 = [
  "public.alert_notification_index_v1",
  "public.alert_actions_v1",
  "public.alert_workflow_v1",
  "public.operation_workflow_v1",
  "public.alert_operation_relation_v1",
] as const;

export type RuntimeSchemaCompatibilityBootstrapResultV1 = {
  status: "PASS";
  relations_preprovisioned: typeof RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1;
  route_shims_preprovisioned: typeof RUNTIME_SCHEMA_ROUTE_SHIM_RELATIONS_V1;
};

export async function ensureRuntimeSchemaCompatibilityV1(
  pool: Pool,
): Promise<RuntimeSchemaCompatibilityBootstrapResultV1> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.worker_runtime_heartbeat_v1 (
      worker_type TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      runtime_instance_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      last_heartbeat_at TIMESTAMPTZ NOT NULL,
      heartbeat_count BIGINT NOT NULL DEFAULT 0,
      last_tick_status TEXT,
      last_error TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (worker_type, worker_id)
    );
    CREATE INDEX IF NOT EXISTS idx_worker_runtime_heartbeat_v1_last_heartbeat_at
      ON public.worker_runtime_heartbeat_v1(last_heartbeat_at);
    CREATE INDEX IF NOT EXISTS idx_worker_runtime_heartbeat_v1_worker_type
      ON public.worker_runtime_heartbeat_v1(worker_type);

    CREATE TABLE IF NOT EXISTS public.jobs (
      job_id TEXT PRIMARY KEY,
      job_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL,
      result JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_type_status
      ON public.jobs(job_type, status, created_at);

    CREATE TABLE IF NOT EXISTS public.evidence_export_job_index_v1 (
      tenant_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT,
      from_ts_ms BIGINT NOT NULL,
      to_ts_ms BIGINT NOT NULL,
      status TEXT NOT NULL,
      created_ts_ms BIGINT NOT NULL,
      updated_ts_ms BIGINT NOT NULL,
      artifact_path TEXT,
      artifact_sha256 TEXT,
      error TEXT,
      export_format TEXT,
      export_language TEXT,
      PRIMARY KEY (tenant_id, job_id)
    );
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS scope_type TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS scope_id TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS from_ts_ms BIGINT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS to_ts_ms BIGINT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS created_ts_ms BIGINT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS updated_ts_ms BIGINT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS artifact_path TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS artifact_sha256 TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS error TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS export_format TEXT;
    ALTER TABLE public.evidence_export_job_index_v1 ADD COLUMN IF NOT EXISTS export_language TEXT;

    CREATE TABLE IF NOT EXISTS public.evidence_pack_index_v1 (
      tenant_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      storage_mode TEXT NOT NULL,
      object_store_key TEXT NOT NULL,
      object_store_bundle_path TEXT,
      object_store_manifest_path TEXT,
      object_store_checksums_path TEXT,
      export_format TEXT NOT NULL,
      export_language TEXT NOT NULL,
      built_at_ts_ms BIGINT NOT NULL,
      bundle_sha256 TEXT,
      manifest_sha256 TEXT,
      checksums_sha256 TEXT,
      PRIMARY KEY (tenant_id, job_id)
    );
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS storage_mode TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_key TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_bundle_path TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_manifest_path TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS object_store_checksums_path TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS export_format TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS export_language TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS built_at_ts_ms BIGINT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS bundle_sha256 TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS manifest_sha256 TEXT;
    ALTER TABLE public.evidence_pack_index_v1 ADD COLUMN IF NOT EXISTS checksums_sha256 TEXT;

    CREATE TABLE IF NOT EXISTS public.derived_sensing_state_index_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT,
      group_id TEXT,
      field_id TEXT NOT NULL,
      state_type TEXT NOT NULL,
      payload_json JSONB NOT NULL,
      confidence DOUBLE PRECISION,
      explanation_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_observation_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_device_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      computed_at TIMESTAMPTZ NOT NULL,
      computed_at_ts_ms BIGINT NOT NULL,
      fact_id TEXT NOT NULL,
      PRIMARY KEY (tenant_id, field_id, state_type, computed_at_ts_ms)
    );
    ALTER TABLE public.derived_sensing_state_index_v1
      ADD COLUMN IF NOT EXISTS source_observation_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE public.derived_sensing_state_index_v1
      ADD COLUMN IF NOT EXISTS source_device_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    UPDATE public.derived_sensing_state_index_v1
       SET source_observation_ids_json = '[]'::jsonb
     WHERE source_observation_ids_json IS NULL;
    UPDATE public.derived_sensing_state_index_v1
       SET source_device_ids_json = '[]'::jsonb
     WHERE source_device_ids_json IS NULL;
    CREATE INDEX IF NOT EXISTS idx_derived_sensing_state_index_v1_scope_time
      ON public.derived_sensing_state_index_v1 (tenant_id, project_id, group_id, field_id, computed_at_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS idx_derived_sensing_state_index_v1_type_time
      ON public.derived_sensing_state_index_v1 (tenant_id, field_id, state_type, computed_at_ts_ms DESC);
    DELETE FROM public.derived_sensing_state_index_v1 AS older
      USING public.derived_sensing_state_index_v1 AS newer
      WHERE older.ctid < newer.ctid AND older.fact_id = newer.fact_id;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_derived_sensing_state_index_v1_fact_id
      ON public.derived_sensing_state_index_v1 (fact_id);

    CREATE TABLE IF NOT EXISTS public.agronomy_inference_result_v1 (
      tenant_id TEXT NOT NULL,
      inference_id TEXT NOT NULL,
      fact_id TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      observation_id TEXT NOT NULL,
      media_key TEXT NOT NULL,
      field_id TEXT NOT NULL,
      season_id TEXT,
      device_id TEXT,
      model_name TEXT NOT NULL,
      model_version TEXT NOT NULL,
      task_type TEXT NOT NULL,
      labels_json JSONB NOT NULL,
      confidence NUMERIC(6,5) NOT NULL,
      health_score NUMERIC(6,2),
      pest_detected BOOLEAN NOT NULL,
      disease_detected BOOLEAN NOT NULL,
      inference_ts_ms BIGINT NOT NULL,
      raw_output_summary_json JSONB NOT NULL,
      created_ts_ms BIGINT NOT NULL,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, inference_id),
      UNIQUE (tenant_id, fact_id)
    );
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_observation_idx
      ON public.agronomy_inference_result_v1 (tenant_id, observation_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_field_idx
      ON public.agronomy_inference_result_v1 (tenant_id, field_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_season_idx
      ON public.agronomy_inference_result_v1 (tenant_id, season_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_device_idx
      ON public.agronomy_inference_result_v1 (tenant_id, device_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_result_v1_media_idx
      ON public.agronomy_inference_result_v1 (tenant_id, media_key, inference_ts_ms DESC);

    CREATE TABLE IF NOT EXISTS public.agronomy_inference_index_v1 (
      tenant_id TEXT NOT NULL,
      inference_id TEXT NOT NULL,
      observation_id TEXT NOT NULL,
      media_key TEXT NOT NULL,
      field_id TEXT NOT NULL,
      season_id TEXT,
      device_id TEXT,
      model_name TEXT NOT NULL,
      model_version TEXT NOT NULL,
      task_type TEXT NOT NULL,
      labels_json JSONB NOT NULL,
      confidence NUMERIC(6,5) NOT NULL,
      health_score NUMERIC(6,2),
      pest_detected BOOLEAN NOT NULL,
      disease_detected BOOLEAN NOT NULL,
      inference_ts_ms BIGINT NOT NULL,
      raw_output_summary_json JSONB NOT NULL,
      created_ts_ms BIGINT NOT NULL,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, inference_id)
    );
    ALTER TABLE public.agronomy_inference_index_v1
      ALTER COLUMN health_score TYPE NUMERIC(6,2);
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_field_lookup_idx
      ON public.agronomy_inference_index_v1 (tenant_id, field_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_observation_lookup_idx
      ON public.agronomy_inference_index_v1 (tenant_id, observation_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_media_lookup_idx
      ON public.agronomy_inference_index_v1 (tenant_id, media_key, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_season_lookup_idx
      ON public.agronomy_inference_index_v1 (tenant_id, season_id, inference_ts_ms DESC);
    CREATE INDEX IF NOT EXISTS agronomy_inference_index_v1_device_lookup_idx
      ON public.agronomy_inference_index_v1 (tenant_id, device_id, inference_ts_ms DESC);

    CREATE TABLE IF NOT EXISTS public.agronomy_observation_index_v1 (
      tenant_id TEXT NOT NULL,
      observation_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      season_id TEXT,
      telemetry_id TEXT,
      media_key TEXT NOT NULL,
      observed_ts_ms BIGINT NOT NULL,
      observation_type TEXT NOT NULL,
      media_type TEXT NOT NULL,
      device_type TEXT NOT NULL,
      source_type TEXT NOT NULL,
      device_id TEXT,
      severity NUMERIC(6,2),
      confidence NUMERIC(6,2),
      note TEXT,
      created_ts_ms BIGINT NOT NULL,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, observation_id)
    );
    ALTER TABLE public.agronomy_observation_index_v1 ADD COLUMN IF NOT EXISTS device_id TEXT;
    CREATE INDEX IF NOT EXISTS agronomy_observation_index_v1_lookup_idx
      ON public.agronomy_observation_index_v1 (tenant_id, field_id, observed_ts_ms DESC);

    CREATE TABLE IF NOT EXISTS public.field_season_index_v1 (
      tenant_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      season_id TEXT NOT NULL,
      name TEXT NOT NULL,
      crop TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL,
      created_ts_ms BIGINT NOT NULL,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, field_id, season_id)
    );
    CREATE INDEX IF NOT EXISTS field_season_index_v1_lookup_idx
      ON public.field_season_index_v1 (tenant_id, field_id, updated_ts_ms DESC);

    ALTER TABLE IF EXISTS public.alert_rule_index_v1
      ADD COLUMN IF NOT EXISTS notify_channels_json TEXT;
    CREATE TABLE IF NOT EXISTS public.alert_notification_index_v1 (
      tenant_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      detail_json TEXT,
      created_ts_ms BIGINT NOT NULL,
      delivered_ts_ms BIGINT,
      error TEXT,
      PRIMARY KEY (tenant_id, notification_id)
    );
    CREATE INDEX IF NOT EXISTS alert_notification_index_v1_lookup_idx
      ON public.alert_notification_index_v1 (tenant_id, event_id, rule_id, channel, created_ts_ms DESC);
    CREATE TABLE IF NOT EXISTS public.alert_actions_v1 (
      tenant_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      status TEXT NOT NULL,
      acted_by TEXT NOT NULL,
      acted_at BIGINT NOT NULL,
      note TEXT,
      PRIMARY KEY (tenant_id, alert_id, acted_at)
    );
    CREATE INDEX IF NOT EXISTS alert_actions_v1_lookup_idx
      ON public.alert_actions_v1 (tenant_id, alert_id, acted_at DESC);

    CREATE TABLE IF NOT EXISTS public.alert_workflow_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      assignee_actor_id TEXT,
      assignee_name TEXT,
      status TEXT NOT NULL,
      priority SMALLINT NOT NULL DEFAULT 5,
      sla_due_at BIGINT,
      assigned_at BIGINT,
      acked_at BIGINT,
      resolved_at BIGINT,
      last_note TEXT,
      updated_by TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      version BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (tenant_id, alert_id),
      CONSTRAINT alert_workflow_v1_status_ck
        CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','ACKED','RESOLVED','CLOSED'))
    );
    CREATE INDEX IF NOT EXISTS alert_workflow_v1_alert_lookup_idx
      ON public.alert_workflow_v1 (tenant_id, alert_id);
    CREATE INDEX IF NOT EXISTS alert_workflow_v1_status_updated_idx
      ON public.alert_workflow_v1 (tenant_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS alert_workflow_v1_assignee_idx
      ON public.alert_workflow_v1 (tenant_id, assignee_actor_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS public.operation_workflow_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      owner_actor_id TEXT,
      owner_name TEXT,
      last_note TEXT,
      updated_at BIGINT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (tenant_id, operation_id)
    );
    CREATE INDEX IF NOT EXISTS operation_workflow_v1_lookup_idx
      ON public.operation_workflow_v1 (tenant_id, operation_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS public.alert_operation_relation_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      updated_by TEXT NOT NULL,
      PRIMARY KEY (tenant_id, alert_id)
    );
    CREATE INDEX IF NOT EXISTS alert_operation_relation_v1_alert_idx
      ON public.alert_operation_relation_v1 (tenant_id, alert_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS alert_operation_relation_v1_operation_idx
      ON public.alert_operation_relation_v1 (tenant_id, operation_id, updated_at DESC);
  `);

  const allRelations = [
    ...RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1,
    ...RUNTIME_SCHEMA_ROUTE_SHIM_RELATIONS_V1,
  ];
  const result = await pool.query<{ relation_name: string; relation_exists: boolean }>(
    `SELECT required.relation_name,
            pg_catalog.to_regclass(required.relation_name) IS NOT NULL AS relation_exists
       FROM pg_catalog.unnest($1::text[]) AS required(relation_name)
      ORDER BY required.relation_name`,
    [allRelations],
  );
  const observed = new Map(result.rows.map((row) => [row.relation_name, row.relation_exists]));
  for (const relation of allRelations) {
    if (observed.get(relation) !== true) {
      throw new Error(`RUNTIME_SCHEMA_COMPATIBILITY_NOT_ESTABLISHED:${relation}`);
    }
  }

  return {
    status: "PASS",
    relations_preprovisioned: RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1,
    route_shims_preprovisioned: RUNTIME_SCHEMA_ROUTE_SHIM_RELATIONS_V1,
  };
}

export async function runRuntimeSchemaCompatibilityBootstrapFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  if (!adminDatabaseUrl) {
    throw new Error("RUNTIME_SCHEMA_COMPATIBILITY_ADMIN_DATABASE_URL_REQUIRED");
  }
  if (String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim() === adminDatabaseUrl) {
    throw new Error("RUNTIME_SCHEMA_COMPATIBILITY_RUNTIME_CREDENTIAL_FORBIDDEN");
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const result = await ensureRuntimeSchemaCompatibilityV1(pool);
    console.log(JSON.stringify(result));
  } finally {
    await pool.end();
  }
}
