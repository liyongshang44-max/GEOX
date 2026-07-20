// apps/server/src/infra/mcft_cap07_runtime_startup_preflight_v1.ts
// Purpose: fail closed before Runtime readiness unless the exact MCFT-CAP-07 migration, role, trigger, active epoch, privilege, visibility coverage, and preprovisioned Runtime compatibility contracts are present.
// Boundary: one read-only transaction only; no DDL, DML, SET ROLE, migration execution, credential fallback, or readiness side effect.

import type { Pool, PoolClient } from "pg";
import {
  MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1,
  MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1,
  loadMcftCap07RegisteredMigrationV1,
} from "./mcft_cap07_startup_migration_runner_v1.js";
import {
  MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
  MCFT_CAP07_MIGRATOR_ROLE_V1,
  MCFT_CAP07_RUNTIME_ROLE_V1,
} from "./mcft_cap07_database_platform_bootstrap_v1.js";
import { RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1 } from "./runtime_schema_compatibility_bootstrap_v1.js";

export type McftCap07RuntimeStartupPreflightResultV1 = {
  status: "PASS";
  session_user: typeof MCFT_CAP07_RUNTIME_ROLE_V1;
  current_user: typeof MCFT_CAP07_RUNTIME_ROLE_V1;
  transaction_read_only: true;
  transaction_isolation: "repeatable read";
  migration_id: typeof MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1;
  migration_checksum_sha256: `sha256:${string}`;
  active_epoch_id: string;
  fact_count: string;
  visibility_row_count: string;
  runtime_metadata_direct_dml: "FORBIDDEN";
  runtime_migration_role_assumption: "FORBIDDEN";
  runtime_schema_create_authority: "FORBIDDEN";
  runtime_schema_compatibility: "PREPROVISIONED";
};

const RUNTIME_SCHEMA_COMPATIBILITY_REQUIRED_COLUMNS_V1 = [
  {
    relation: "public.worker_runtime_heartbeat_v1",
    columns: [
      "worker_type", "worker_id", "runtime_instance_id", "status", "started_at",
      "last_heartbeat_at", "heartbeat_count", "last_tick_status", "last_error",
      "metadata_json", "updated_at",
    ],
  },
  {
    relation: "public.jobs",
    columns: ["job_id", "job_type", "payload", "status", "result", "error", "created_at", "updated_at"],
  },
  {
    relation: "public.evidence_export_job_index_v1",
    columns: [
      "tenant_id", "job_id", "scope_type", "scope_id", "from_ts_ms", "to_ts_ms",
      "status", "created_ts_ms", "updated_ts_ms", "artifact_path", "artifact_sha256",
      "error", "export_format", "export_language",
    ],
  },
  {
    relation: "public.evidence_pack_index_v1",
    columns: [
      "tenant_id", "job_id", "storage_mode", "object_store_key", "object_store_bundle_path",
      "object_store_manifest_path", "object_store_checksums_path", "export_format",
      "export_language", "built_at_ts_ms", "bundle_sha256", "manifest_sha256", "checksums_sha256",
    ],
  },
] as const;

function fail(detail: string): never {
  throw new Error(`MCFT_STARTUP_VISIBILITY_PREFLIGHT_FAILED:${detail}`);
}

async function assertRuntimeConnectionIdentityV1(client: PoolClient): Promise<void> {
  const result = await client.query<{
    session_user: string;
    current_user: string;
    rolsuper: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
    can_set_owner: boolean;
    can_set_migrator: boolean;
    can_create_public: boolean;
    session_replication_role: string;
  }>(`
    SELECT session_user::text AS session_user,
           current_user::text AS current_user,
           role.rolsuper,
           role.rolreplication,
           role.rolbypassrls,
           pg_catalog.pg_has_role(session_user, '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}', 'SET') AS can_set_owner,
           pg_catalog.pg_has_role(session_user, '${MCFT_CAP07_MIGRATOR_ROLE_V1}', 'SET') AS can_set_migrator,
           pg_catalog.has_schema_privilege(session_user, 'public', 'CREATE') AS can_create_public,
           pg_catalog.current_setting('session_replication_role') AS session_replication_role
      FROM pg_catalog.pg_roles AS role
     WHERE role.rolname = session_user
  `);
  const row = result.rows[0];
  if (!row || row.session_user !== MCFT_CAP07_RUNTIME_ROLE_V1 || row.current_user !== MCFT_CAP07_RUNTIME_ROLE_V1 ||
      row.rolsuper || row.rolreplication || row.rolbypassrls || row.can_set_owner || row.can_set_migrator ||
      row.can_create_public || row.session_replication_role !== "origin") {
    fail("MCFT_RUNTIME_ROLE_PRIVILEGE_INVALID");
  }
}

async function assertRuntimeSchemaCompatibilityV1(client: PoolClient): Promise<void> {
  const relationResult = await client.query<{ relation_name: string; relation_exists: boolean }>(
    `SELECT required.relation_name,
            pg_catalog.to_regclass(required.relation_name) IS NOT NULL AS relation_exists
       FROM pg_catalog.unnest($1::text[]) AS required(relation_name)
      ORDER BY required.relation_name`,
    [RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1],
  );
  const observedRelations = new Map(
    relationResult.rows.map((row) => [row.relation_name, row.relation_exists]),
  );
  for (const relation of RUNTIME_SCHEMA_COMPATIBILITY_RELATIONS_V1) {
    if (observedRelations.get(relation) !== true) {
      fail(`RUNTIME_SCHEMA_COMPATIBILITY_RELATION_MISSING:${relation}`);
    }
  }

  for (const contract of RUNTIME_SCHEMA_COMPATIBILITY_REQUIRED_COLUMNS_V1) {
    const columnResult = await client.query<{ observed_count: number }>(
      `SELECT pg_catalog.count(*)::int AS observed_count
         FROM pg_catalog.pg_attribute
        WHERE attrelid = pg_catalog.to_regclass($1)
          AND attname = ANY($2::text[])
          AND attnum > 0
          AND NOT attisdropped`,
      [contract.relation, contract.columns],
    );
    if (Number(columnResult.rows[0]?.observed_count ?? 0) !== contract.columns.length) {
      fail(`RUNTIME_SCHEMA_COMPATIBILITY_COLUMNS_MISSING:${contract.relation}`);
    }
  }
}

async function inspectVisibilityContractV1(client: PoolClient): Promise<McftCap07RuntimeStartupPreflightResultV1> {
  const migration = loadMcftCap07RegisteredMigrationV1();
  const result = await client.query<{
    transaction_read_only: string;
    transaction_isolation: string;
    ledger_count: string;
    ledger_checksum: string | null;
    ledger_status: string | null;
    active_epoch_count: string;
    active_epoch_id: string | null;
    active_schema_version: string | null;
    fact_count: string;
    visibility_row_count: string;
    missing_count: string;
    duplicate_count: string;
    wrong_epoch_count: string;
    trigger_count: string;
    trigger_owner: string | null;
    trigger_security_definer: boolean | null;
    trigger_search_path: string | null;
    epoch_guard_count: string;
    index_guard_count: string;
    runtime_epoch_select: boolean;
    runtime_index_select: boolean;
    runtime_ledger_select: boolean;
    runtime_epoch_write: boolean;
    runtime_index_write: boolean;
    runtime_ledger_write: boolean;
    runtime_trigger_execute: boolean;
  }>(`
    WITH active_epoch AS (
      SELECT pg_catalog.count(*)::text AS active_epoch_count,
             pg_catalog.min(visibility_epoch_id) AS active_epoch_id,
             pg_catalog.min(schema_version) AS active_schema_version
        FROM public.twin_fact_visibility_epoch_v1
       WHERE status = 'ACTIVE'
    ), coverage AS (
      SELECT (SELECT pg_catalog.count(*)::text FROM public.facts) AS fact_count,
             (SELECT pg_catalog.count(*)::text
                FROM public.twin_fact_visibility_index_v1
               WHERE visibility_epoch_id = (SELECT active_epoch_id FROM active_epoch)) AS visibility_row_count,
             (SELECT pg_catalog.count(*)::text
                FROM public.facts AS f
                LEFT JOIN public.twin_fact_visibility_index_v1 AS v
                  ON v.visibility_epoch_id = (SELECT active_epoch_id FROM active_epoch)
                 AND v.fact_id = f.fact_id
               WHERE v.fact_id IS NULL) AS missing_count,
             (SELECT pg_catalog.count(*)::text FROM (
                SELECT visibility_epoch_id, fact_id
                  FROM public.twin_fact_visibility_index_v1
                 GROUP BY visibility_epoch_id, fact_id
                HAVING pg_catalog.count(*) <> 1
              ) AS duplicate_rows) AS duplicate_count,
             (SELECT pg_catalog.count(*)::text
                FROM public.twin_fact_visibility_index_v1
               WHERE visibility_epoch_id <> (SELECT active_epoch_id FROM active_epoch)) AS wrong_epoch_count
    ), trigger_contract AS (
      SELECT pg_catalog.count(*)::text AS trigger_count,
             pg_catalog.max(owner.rolname) AS trigger_owner,
             pg_catalog.bool_and(proc.prosecdef) AS trigger_security_definer,
             pg_catalog.min(proc.proconfig::text) AS trigger_search_path
        FROM pg_catalog.pg_trigger AS trig
        JOIN pg_catalog.pg_class AS rel ON rel.oid=trig.tgrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid=rel.relnamespace
        JOIN pg_catalog.pg_proc AS proc ON proc.oid=trig.tgfoid
        JOIN pg_catalog.pg_roles AS owner ON owner.oid=proc.proowner
       WHERE ns.nspname='public' AND rel.relname='facts'
         AND trig.tgname='mcft_cap07_fact_visibility_after_insert_v1'
         AND trig.tgenabled='O' AND NOT trig.tgisinternal
    )
    SELECT pg_catalog.current_setting('transaction_read_only') AS transaction_read_only,
           pg_catalog.current_setting('transaction_isolation') AS transaction_isolation,
           (SELECT pg_catalog.count(*)::text FROM public.geox_schema_migration_ledger_v1 WHERE migration_id=$1) AS ledger_count,
           (SELECT migration_checksum_sha256 FROM public.geox_schema_migration_ledger_v1 WHERE migration_id=$1) AS ledger_checksum,
           (SELECT status FROM public.geox_schema_migration_ledger_v1 WHERE migration_id=$1) AS ledger_status,
           active_epoch.active_epoch_count,
           active_epoch.active_epoch_id,
           active_epoch.active_schema_version,
           coverage.fact_count,
           coverage.visibility_row_count,
           coverage.missing_count,
           coverage.duplicate_count,
           coverage.wrong_epoch_count,
           trigger_contract.trigger_count,
           trigger_contract.trigger_owner,
           trigger_contract.trigger_security_definer,
           trigger_contract.trigger_search_path,
           (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='twin_fact_visibility_epoch_v1' AND t.tgname='mcft_cap07_visibility_epoch_authority_v1' AND t.tgenabled='O' AND NOT t.tgisinternal) AS epoch_guard_count,
           (SELECT pg_catalog.count(*)::text FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='twin_fact_visibility_index_v1' AND t.tgname='mcft_cap07_visibility_index_immutability_v1' AND t.tgenabled='O' AND NOT t.tgisinternal) AS index_guard_count,
           pg_catalog.has_table_privilege(current_user,'public.twin_fact_visibility_epoch_v1','SELECT') AS runtime_epoch_select,
           pg_catalog.has_table_privilege(current_user,'public.twin_fact_visibility_index_v1','SELECT') AS runtime_index_select,
           pg_catalog.has_table_privilege(current_user,'public.geox_schema_migration_ledger_v1','SELECT') AS runtime_ledger_select,
           pg_catalog.has_table_privilege(current_user,'public.twin_fact_visibility_epoch_v1','INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_epoch_write,
           pg_catalog.has_table_privilege(current_user,'public.twin_fact_visibility_index_v1','INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_index_write,
           pg_catalog.has_table_privilege(current_user,'public.geox_schema_migration_ledger_v1','INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_ledger_write,
           pg_catalog.has_function_privilege(current_user,'public.enforce_mcft_cap07_fact_visibility_v1()','EXECUTE') AS runtime_trigger_execute
      FROM active_epoch CROSS JOIN coverage CROSS JOIN trigger_contract
  `, [MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1]);
  const row = result.rows[0];
  if (!row) fail("MCFT_CANONICAL_VISIBILITY_METADATA_NOT_ESTABLISHED");
  if (row.transaction_read_only !== "on" || row.transaction_isolation !== "repeatable read") fail("READ_ONLY_TRANSACTION_INVALID");
  if (row.ledger_count !== "1") fail("MCFT_REQUIRED_MIGRATION_PENDING");
  if (row.ledger_status !== "APPLIED" || row.ledger_checksum !== migration.migration_checksum_sha256) {
    fail("MCFT_MIGRATION_LEDGER_CHECKSUM_MISMATCH");
  }
  if (row.active_epoch_count !== "1" || row.active_epoch_id !== MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1 ||
      row.active_schema_version !== "mcft_cap_07_fact_visibility_epoch_v1") {
    fail("MCFT_VISIBILITY_ACTIVE_EPOCH_CARDINALITY_INVALID");
  }
  if (row.fact_count !== row.visibility_row_count || row.missing_count !== "0" || row.duplicate_count !== "0" || row.wrong_epoch_count !== "0") {
    fail("MCFT_FACT_VISIBILITY_METADATA_INCONSISTENT");
  }
  if (row.trigger_count !== "1" || row.trigger_owner !== MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 ||
      row.trigger_security_definer !== true || !String(row.trigger_search_path).includes("search_path=pg_catalog") ||
      row.epoch_guard_count !== "1" || row.index_guard_count !== "1") {
    fail("MCFT_VISIBILITY_TRIGGER_CONTRACT_INVALID");
  }
  if (!row.runtime_epoch_select || !row.runtime_index_select || !row.runtime_ledger_select ||
      row.runtime_epoch_write || row.runtime_index_write || row.runtime_ledger_write || row.runtime_trigger_execute) {
    fail("MCFT_VISIBILITY_METADATA_PRIVILEGE_CONTRACT_INVALID");
  }
  return {
    status: "PASS",
    session_user: MCFT_CAP07_RUNTIME_ROLE_V1,
    current_user: MCFT_CAP07_RUNTIME_ROLE_V1,
    transaction_read_only: true,
    transaction_isolation: "repeatable read",
    migration_id: MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1,
    migration_checksum_sha256: migration.migration_checksum_sha256,
    active_epoch_id: row.active_epoch_id,
    fact_count: row.fact_count,
    visibility_row_count: row.visibility_row_count,
    runtime_metadata_direct_dml: "FORBIDDEN",
    runtime_migration_role_assumption: "FORBIDDEN",
    runtime_schema_create_authority: "FORBIDDEN",
    runtime_schema_compatibility: "PREPROVISIONED",
  };
}

export async function runMcftCap07RuntimeStartupPreflightV1(
  pool: Pool,
): Promise<McftCap07RuntimeStartupPreflightResultV1> {
  if (String(process.env.GEOX_MIGRATION_DATABASE_URL || "").trim() ||
      String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim()) {
    throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:MIGRATION_CREDENTIAL_PRESENT_IN_RUNTIME");
  }
  const client = await pool.connect();
  try {
    await assertRuntimeConnectionIdentityV1(client);
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await assertRuntimeSchemaCompatibilityV1(client);
    const result = await inspectVisibilityContractV1(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export class McftCap07RuntimeStartupPreflightV1 {
  run(pool: Pool): Promise<McftCap07RuntimeStartupPreflightResultV1> {
    return runMcftCap07RuntimeStartupPreflightV1(pool);
  }
}
