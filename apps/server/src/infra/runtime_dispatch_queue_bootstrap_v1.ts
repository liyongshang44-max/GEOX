// apps/server/src/infra/runtime_dispatch_queue_bootstrap_v1.ts
// Purpose: materialize the legacy AO-ACT dispatch queue under the external database-platform bootstrap identity.
// Boundary: one-shot administrative DDL/DML only; the long-running Runtime validates this contract and never performs the migration shim.

import { Pool } from "pg";

export const RUNTIME_DISPATCH_QUEUE_RELATION_V1 = "public.dispatch_queue_v1" as const;
export const RUNTIME_DISPATCH_QUEUE_COMMAND_UNIQUE_V1 = "dispatch_queue_v1_command_unique" as const;

export async function ensureRuntimeDispatchQueueSchemaV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.dispatch_queue_v1 (
      queue_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      act_task_id TEXT NOT NULL,
      command_id TEXT NOT NULL,
      task_fact_id TEXT NOT NULL,
      outbox_fact_id TEXT NOT NULL,
      device_id TEXT,
      downlink_topic TEXT,
      qos INTEGER NOT NULL DEFAULT 1,
      retain BOOLEAN NOT NULL DEFAULT false,
      adapter_hint TEXT,
      state TEXT NOT NULL,
      claim_id TEXT,
      lease_token TEXT,
      leased_by TEXT,
      lease_expires_at TIMESTAMPTZ,
      lease_expire_at BIGINT,
      claimed_by TEXT,
      claimed_ts BIGINT,
      lease_until_ts BIGINT,
      publish_fact_id TEXT,
      ack_fact_id TEXT,
      receipt_fact_id TEXT,
      attempt_no INTEGER NOT NULL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT dispatch_queue_v1_state_ck
        CHECK (state IN ('CREATED','READY','DISPATCHED','ACKED','SUCCEEDED','FAILED')),
      CONSTRAINT dispatch_queue_v1_task_unique
        UNIQUE (tenant_id, project_id, group_id, act_task_id),
      CONSTRAINT dispatch_queue_v1_command_unique
        UNIQUE (tenant_id, project_id, group_id, command_id)
    );
    CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_ready
      ON public.dispatch_queue_v1 (tenant_id, project_id, group_id, state, created_at);
    CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_outbox
      ON public.dispatch_queue_v1 (outbox_fact_id);

    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS command_id TEXT;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claim_id TEXT;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claimed_by TEXT;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claimed_ts BIGINT;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS lease_until_ts BIGINT;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS lease_expire_at BIGINT;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS attempt_no INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.dispatch_queue_v1 ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

    UPDATE public.dispatch_queue_v1
       SET command_id = act_task_id
     WHERE command_id IS NULL OR command_id = '';
    ALTER TABLE public.dispatch_queue_v1 ALTER COLUMN command_id SET NOT NULL;

    DO $dispatch_queue$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
         WHERE conname = '${RUNTIME_DISPATCH_QUEUE_COMMAND_UNIQUE_V1}'
           AND conrelid = 'public.dispatch_queue_v1'::regclass
      ) THEN
        ALTER TABLE public.dispatch_queue_v1
          ADD CONSTRAINT dispatch_queue_v1_command_unique
          UNIQUE (tenant_id, project_id, group_id, command_id);
      END IF;
    END
    $dispatch_queue$;
  `);

  const verification = await pool.query<{
    relation_exists: boolean;
    command_not_null: boolean;
    command_unique_exists: boolean;
    pending_backfill_count: string;
  }>(`
    SELECT pg_catalog.to_regclass('${RUNTIME_DISPATCH_QUEUE_RELATION_V1}') IS NOT NULL AS relation_exists,
           COALESCE((
             SELECT attribute.attnotnull
               FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = '${RUNTIME_DISPATCH_QUEUE_RELATION_V1}'::regclass
                AND attribute.attname = 'command_id'
                AND attribute.attnum > 0
                AND NOT attribute.attisdropped
           ), false) AS command_not_null,
           EXISTS (
             SELECT 1 FROM pg_catalog.pg_constraint
              WHERE conname = '${RUNTIME_DISPATCH_QUEUE_COMMAND_UNIQUE_V1}'
                AND conrelid = '${RUNTIME_DISPATCH_QUEUE_RELATION_V1}'::regclass
           ) AS command_unique_exists,
           (SELECT pg_catalog.count(*)::text
              FROM public.dispatch_queue_v1
             WHERE command_id IS NULL OR command_id = '') AS pending_backfill_count
  `);
  const row = verification.rows[0];
  if (!row?.relation_exists || !row.command_not_null || !row.command_unique_exists || row.pending_backfill_count !== "0") {
    throw new Error("RUNTIME_DISPATCH_QUEUE_SCHEMA_NOT_ESTABLISHED");
  }
}

export async function runRuntimeDispatchQueueBootstrapFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  if (!adminDatabaseUrl) throw new Error("RUNTIME_DISPATCH_QUEUE_ADMIN_DATABASE_URL_REQUIRED");
  if (String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim() === adminDatabaseUrl) {
    throw new Error("RUNTIME_DISPATCH_QUEUE_RUNTIME_CREDENTIAL_FORBIDDEN");
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    await ensureRuntimeDispatchQueueSchemaV1(pool);
    console.log(JSON.stringify({ status: "PASS", relation: RUNTIME_DISPATCH_QUEUE_RELATION_V1 }));
  } finally {
    await pool.end();
  }
}
