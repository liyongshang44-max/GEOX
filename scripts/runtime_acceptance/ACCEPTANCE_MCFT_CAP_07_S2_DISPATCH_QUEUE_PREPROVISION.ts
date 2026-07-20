// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_07_S2_DISPATCH_QUEUE_PREPROVISION.ts
// Purpose: prove the legacy dispatch queue migration shim is fully preprovisioned externally and suppressed under the Runtime credential.
// Boundary: isolated focused PostgreSQL only; no dispatch claim, task creation, canonical fact write, route call, or execution authority.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { createDatabasePool } from "../../apps/server/src/infra/database.js";
import {
  RUNTIME_DISPATCH_QUEUE_COMMAND_UNIQUE_V1,
  RUNTIME_DISPATCH_QUEUE_RELATION_V1,
  ensureRuntimeDispatchQueueSchemaV1,
} from "../../apps/server/src/infra/runtime_dispatch_queue_bootstrap_v1.js";

const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_07_S2_DISPATCH_QUEUE_PREPROVISION_RESULT.json");
const ADMIN_URL = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
const RUNTIME_URL = String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim();
const assertions: Array<{ name: string; passed: boolean; detail?: unknown }> = [];

function check(name: string, condition: unknown, detail?: unknown): void {
  const passed = condition === true;
  assertions.push({ name, passed, detail });
  assert.equal(passed, true, name);
}

async function expectFailure(name: string, operation: () => Promise<unknown>, token: string): Promise<void> {
  let observed = "";
  try {
    await operation();
  } catch (error) {
    observed = String(error instanceof Error ? error.message : error);
  }
  check(name, observed.includes(token), { observed, token });
}

async function runLegacyEnsureSequence(runtime: Pool): Promise<void> {
  await runtime.query(`
    CREATE TABLE IF NOT EXISTS dispatch_queue_v1 (
      queue_id text PRIMARY KEY,
      tenant_id text NOT NULL,
      project_id text NOT NULL,
      group_id text NOT NULL,
      act_task_id text NOT NULL,
      command_id text NOT NULL,
      task_fact_id text NOT NULL,
      outbox_fact_id text NOT NULL,
      device_id text NULL,
      downlink_topic text NULL,
      qos integer NOT NULL DEFAULT 1,
      retain boolean NOT NULL DEFAULT false,
      adapter_hint text NULL,
      state text NOT NULL,
      claim_id text NULL,
      lease_token text NULL,
      leased_by text NULL,
      lease_expires_at timestamptz NULL,
      lease_expire_at bigint NULL,
      claimed_by text NULL,
      claimed_ts bigint NULL,
      lease_until_ts bigint NULL,
      publish_fact_id text NULL,
      ack_fact_id text NULL,
      receipt_fact_id text NULL,
      attempt_no integer NOT NULL DEFAULT 0,
      attempt_count integer NOT NULL DEFAULT 0,
      last_error text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT dispatch_queue_v1_state_ck CHECK (state IN ('CREATED','READY','DISPATCHED','ACKED','SUCCEEDED','FAILED')),
      CONSTRAINT dispatch_queue_v1_task_unique UNIQUE (tenant_id, project_id, group_id, act_task_id),
      CONSTRAINT dispatch_queue_v1_command_unique UNIQUE (tenant_id, project_id, group_id, command_id)
    )
  `);
  await runtime.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_ready ON dispatch_queue_v1 (tenant_id, project_id, group_id, state, created_at)`);
  await runtime.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_queue_v1_outbox ON dispatch_queue_v1 (outbox_fact_id)`);
  for (const statement of [
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS command_id text`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claim_id text`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claimed_by text`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS claimed_ts bigint`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS lease_until_ts bigint`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS lease_expire_at bigint`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS attempt_no integer NOT NULL DEFAULT 0`,
    `ALTER TABLE dispatch_queue_v1 ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0`,
  ]) {
    await runtime.query(statement);
  }
  await runtime.query(`UPDATE dispatch_queue_v1 SET command_id = act_task_id WHERE command_id IS NULL OR command_id = ''`);
  await runtime.query(`ALTER TABLE dispatch_queue_v1 ALTER COLUMN command_id SET NOT NULL`);
  await runtime.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dispatch_queue_v1_command_unique') THEN ALTER TABLE dispatch_queue_v1 ADD CONSTRAINT dispatch_queue_v1_command_unique UNIQUE (tenant_id, project_id, group_id, command_id); END IF; END $$;`);
}

async function main(): Promise<void> {
  try {
    check("database_urls_present", Boolean(ADMIN_URL && RUNTIME_URL));
    check("database_identities_distinct", ADMIN_URL !== RUNTIME_URL);

    const admin = new Pool({ connectionString: ADMIN_URL, max: 1 });
    try {
      await ensureRuntimeDispatchQueueSchemaV1(admin);
    } finally {
      await admin.end();
    }

    const runtime = createDatabasePool(RUNTIME_URL);
    try {
      await runLegacyEnsureSequence(runtime);
      const result = await runtime.query<{
        relation_exists: boolean;
        command_not_null: boolean;
        command_unique_exists: boolean;
        pending_backfill_count: string;
        runtime_can_create_public: boolean;
      }>(`
        SELECT pg_catalog.to_regclass($1) IS NOT NULL AS relation_exists,
               COALESCE((
                 SELECT attribute.attnotnull
                   FROM pg_catalog.pg_attribute AS attribute
                  WHERE attribute.attrelid = pg_catalog.to_regclass($1)
                    AND attribute.attname = 'command_id'
                    AND attribute.attnum > 0
                    AND NOT attribute.attisdropped
               ), false) AS command_not_null,
               EXISTS (
                 SELECT 1 FROM pg_catalog.pg_constraint
                  WHERE conrelid = pg_catalog.to_regclass($1)
                    AND conname = $2
               ) AS command_unique_exists,
               (SELECT pg_catalog.count(*)::text
                  FROM public.dispatch_queue_v1
                 WHERE command_id IS NULL OR command_id = '') AS pending_backfill_count,
               pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE') AS runtime_can_create_public
      `, [RUNTIME_DISPATCH_QUEUE_RELATION_V1, RUNTIME_DISPATCH_QUEUE_COMMAND_UNIQUE_V1]);
      const row = result.rows[0];
      check("dispatch_queue_relation_preprovisioned", row?.relation_exists === true);
      check("dispatch_queue_command_not_null", row?.command_not_null === true);
      check("dispatch_queue_command_unique", row?.command_unique_exists === true);
      check("dispatch_queue_backfill_complete", row?.pending_backfill_count === "0");
      check("runtime_schema_create_forbidden", row?.runtime_can_create_public === false);
      await expectFailure(
        "unregistered_runtime_ddl_fails_closed",
        () => runtime.query("DROP TABLE public.dispatch_queue_v1"),
        "RUNTIME_DDL_FORBIDDEN",
      );
    } finally {
      await runtime.end();
    }

    const output = {
      status: "PASS",
      acceptance: "MCFT_CAP_07_S2_DISPATCH_QUEUE_PREPROVISION",
      assertion_count: assertions.length,
      failed_assertion_count: assertions.filter((item) => !item.passed).length,
      runtime_ddl_performed: false,
      runtime_migration_dml_performed: false,
      runtime_schema_create_authority: "FORBIDDEN",
      canonical_write_authority_delta: "ZERO",
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const output = {
      status: "FAIL",
      acceptance: "MCFT_CAP_07_S2_DISPATCH_QUEUE_PREPROVISION",
      error: String(error instanceof Error ? error.stack || error.message : error),
      assertions,
    };
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
    console.error(JSON.stringify(output, null, 2));
    process.exit(1);
  }
}

void main();
