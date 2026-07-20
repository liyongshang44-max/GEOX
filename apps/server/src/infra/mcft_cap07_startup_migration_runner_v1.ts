// apps/server/src/infra/mcft_cap07_startup_migration_runner_v1.ts
// Purpose: apply the single registered MCFT-CAP-07 visibility migration with the dedicated migrator credential, ledger its exact checksum, verify the physical contract, and exit.
// Boundary: no Runtime credential fallback, canonical fact creation, HTTP startup, long-running process, or unregistered migration execution.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";
import {
  MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
  MCFT_CAP07_MIGRATOR_ROLE_V1,
  MCFT_CAP07_RUNTIME_ROLE_V1,
  MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1,
} from "./mcft_cap07_database_platform_bootstrap_v1.js";

export const MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1 =
  "2026_07_20_mcft_cap_07_fact_visibility_support" as const;
export const MCFT_CAP07_TASKBOOK_VERSION_V1 = "v0.2.5" as const;
export const MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1 =
  "mcft-cap07-initial-visibility-epoch-v1" as const;
const ADVISORY_LOCK_KEY = "7102072026";

export type McftCap07RegisteredMigrationV1 = {
  migration_id: typeof MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1;
  migration_file: typeof MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1;
  migration_checksum_sha256: `sha256:${string}`;
  migration_sql: string;
};

export type McftCap07StartupMigrationResultV1 = {
  status: "PASS";
  migration_id: typeof MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1;
  migration_checksum_sha256: `sha256:${string}`;
  migration_action: "APPLIED" | "ALREADY_APPLIED_EXACT";
  session_user: typeof MCFT_CAP07_MIGRATOR_ROLE_V1;
  current_user: typeof MCFT_CAP07_MIGRATION_OWNER_ROLE_V1;
  active_epoch_id: string;
  fact_count: string;
  visibility_row_count: string;
  trigger_enabled: true;
  runtime_metadata_direct_dml: "FORBIDDEN";
};

function locateMigrationFileV1(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), "apps/server/db/migrations", MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1),
    path.resolve(process.cwd(), "db/migrations", MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1),
    path.resolve(here, "../../db/migrations", MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1),
    path.resolve(here, "../db/migrations", MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`MCFT_REQUIRED_MIGRATION_PENDING:FILE_NOT_FOUND:${candidates.join(",")}`);
  return found;
}

export function loadMcftCap07RegisteredMigrationV1(): McftCap07RegisteredMigrationV1 {
  const bytes = fs.readFileSync(locateMigrationFileV1());
  const migrationSql = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!migrationSql) throw new Error("MCFT_REQUIRED_MIGRATION_PENDING:EMPTY_MIGRATION");
  return {
    migration_id: MCFT_CAP07_VISIBILITY_MIGRATION_ID_V1,
    migration_file: MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1,
    migration_checksum_sha256: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`,
    migration_sql: migrationSql,
  };
}

async function assertMigratorSessionV1(client: PoolClient): Promise<void> {
  const result = await client.query<{
    session_user: string;
    current_user: string;
    rolsuper: boolean;
    rolinherit: boolean;
    can_set_owner: boolean;
    runtime_can_set_owner: boolean;
  }>(`
    SELECT session_user::text AS session_user,
           current_user::text AS current_user,
           role.rolsuper,
           role.rolinherit,
           pg_catalog.pg_has_role(session_user, '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}', 'SET') AS can_set_owner,
           pg_catalog.pg_has_role('${MCFT_CAP07_RUNTIME_ROLE_V1}', '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}', 'SET') AS runtime_can_set_owner
      FROM pg_catalog.pg_roles AS role
     WHERE role.rolname = session_user
  `);
  const row = result.rows[0];
  if (!row || row.session_user !== MCFT_CAP07_MIGRATOR_ROLE_V1 || row.current_user !== MCFT_CAP07_MIGRATOR_ROLE_V1 ||
      row.rolsuper || row.rolinherit || !row.can_set_owner || row.runtime_can_set_owner) {
    throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:MIGRATOR_SESSION");
  }
}

export class McftCap07MigrationLedgerRepositoryV1 {
  async read(client: PoolClient, migrationId: string): Promise<{ migration_checksum_sha256: string; status: string } | null> {
    const relation = await client.query<{ relation: string | null }>(
      "SELECT pg_catalog.to_regclass('public.geox_schema_migration_ledger_v1')::text AS relation",
    );
    if (!relation.rows[0]?.relation) return null;
    const result = await client.query<{ migration_checksum_sha256: string; status: string }>(
      `SELECT migration_checksum_sha256, status
         FROM public.geox_schema_migration_ledger_v1
        WHERE migration_id = $1`,
      [migrationId],
    );
    if (result.rowCount === 0) return null;
    if (result.rowCount !== 1) throw new Error("MCFT_MIGRATION_LEDGER_CHECKSUM_MISMATCH:DUPLICATE_ROW");
    return result.rows[0] ?? null;
  }

  async writeApplied(
    client: PoolClient,
    migration: McftCap07RegisteredMigrationV1,
    subjectCommit: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO public.geox_schema_migration_ledger_v1 (
         migration_id, migration_checksum_sha256, taskbook_version, subject_commit,
         applied_at, applied_by_session_user, applied_by_current_user, status
       ) VALUES ($1, $2, $3, $4, pg_catalog.transaction_timestamp(), session_user::text, current_user::text, 'APPLIED')`,
      [migration.migration_id, migration.migration_checksum_sha256, MCFT_CAP07_TASKBOOK_VERSION_V1, subjectCommit],
    );
  }
}

async function verifyPhysicalContractV1(
  client: PoolClient,
  migration: McftCap07RegisteredMigrationV1,
): Promise<Omit<McftCap07StartupMigrationResultV1, "status" | "migration_action">> {
  const result = await client.query<{
    ledger_checksum: string;
    ledger_status: string;
    ledger_session_user: string;
    ledger_current_user: string;
    active_epoch_count: string;
    active_epoch_id: string;
    fact_count: string;
    visibility_row_count: string;
    missing_count: string;
    trigger_count: string;
    trigger_owner: string;
    trigger_security_definer: boolean;
    trigger_search_path: string;
    epoch_owner: string;
    index_owner: string;
    ledger_owner: string;
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
             pg_catalog.min(visibility_epoch_id) AS active_epoch_id
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
               WHERE v.fact_id IS NULL) AS missing_count
    ), trigger_contract AS (
      SELECT pg_catalog.count(*)::text AS trigger_count,
             pg_catalog.max(owner.rolname) AS trigger_owner,
             pg_catalog.bool_and(proc.prosecdef) AS trigger_security_definer,
             pg_catalog.min(proc.proconfig::text) AS trigger_search_path
        FROM pg_catalog.pg_trigger AS trig
        JOIN pg_catalog.pg_class AS rel ON rel.oid = trig.tgrelid
        JOIN pg_catalog.pg_namespace AS ns ON ns.oid = rel.relnamespace
        JOIN pg_catalog.pg_proc AS proc ON proc.oid = trig.tgfoid
        JOIN pg_catalog.pg_roles AS owner ON owner.oid = proc.proowner
       WHERE ns.nspname = 'public' AND rel.relname = 'facts'
         AND trig.tgname = 'mcft_cap07_fact_visibility_after_insert_v1'
         AND trig.tgenabled = 'O' AND NOT trig.tgisinternal
    )
    SELECT ledger.migration_checksum_sha256 AS ledger_checksum,
           ledger.status AS ledger_status,
           ledger.applied_by_session_user AS ledger_session_user,
           ledger.applied_by_current_user AS ledger_current_user,
           active_epoch.active_epoch_count,
           active_epoch.active_epoch_id,
           coverage.fact_count,
           coverage.visibility_row_count,
           coverage.missing_count,
           trigger_contract.trigger_count,
           trigger_contract.trigger_owner,
           trigger_contract.trigger_security_definer,
           trigger_contract.trigger_search_path,
           (SELECT owner.rolname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner WHERE c.oid='public.twin_fact_visibility_epoch_v1'::regclass) AS epoch_owner,
           (SELECT owner.rolname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner WHERE c.oid='public.twin_fact_visibility_index_v1'::regclass) AS index_owner,
           (SELECT owner.rolname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles owner ON owner.oid=c.relowner WHERE c.oid='public.geox_schema_migration_ledger_v1'::regclass) AS ledger_owner,
           pg_catalog.has_table_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.twin_fact_visibility_epoch_v1','SELECT') AS runtime_epoch_select,
           pg_catalog.has_table_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.twin_fact_visibility_index_v1','SELECT') AS runtime_index_select,
           pg_catalog.has_table_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.geox_schema_migration_ledger_v1','SELECT') AS runtime_ledger_select,
           pg_catalog.has_table_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.twin_fact_visibility_epoch_v1','INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_epoch_write,
           pg_catalog.has_table_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.twin_fact_visibility_index_v1','INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_index_write,
           pg_catalog.has_table_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.geox_schema_migration_ledger_v1','INSERT,UPDATE,DELETE,TRUNCATE') AS runtime_ledger_write,
           pg_catalog.has_function_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}','public.enforce_mcft_cap07_fact_visibility_v1()','EXECUTE') AS runtime_trigger_execute
      FROM public.geox_schema_migration_ledger_v1 AS ledger
      CROSS JOIN active_epoch
      CROSS JOIN coverage
      CROSS JOIN trigger_contract
     WHERE ledger.migration_id = $1
  `, [migration.migration_id]);
  const row = result.rows[0];
  if (!row || row.ledger_checksum !== migration.migration_checksum_sha256 || row.ledger_status !== "APPLIED" ||
      row.ledger_session_user !== MCFT_CAP07_MIGRATOR_ROLE_V1 || row.ledger_current_user !== MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 ||
      row.active_epoch_count !== "1" || row.active_epoch_id !== MCFT_CAP07_INITIAL_VISIBILITY_EPOCH_ID_V1 ||
      row.fact_count !== row.visibility_row_count || row.missing_count !== "0" || row.trigger_count !== "1" ||
      row.trigger_owner !== MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 || !row.trigger_security_definer ||
      !String(row.trigger_search_path).includes("search_path=pg_catalog") ||
      row.epoch_owner !== MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 || row.index_owner !== MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 ||
      row.ledger_owner !== MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 || !row.runtime_epoch_select || !row.runtime_index_select ||
      !row.runtime_ledger_select || row.runtime_epoch_write || row.runtime_index_write || row.runtime_ledger_write ||
      row.runtime_trigger_execute) {
    throw new Error("MCFT_STARTUP_VISIBILITY_PREFLIGHT_FAILED:MIGRATION_POSTCHECK");
  }
  return {
    migration_id: migration.migration_id,
    migration_checksum_sha256: migration.migration_checksum_sha256,
    session_user: MCFT_CAP07_MIGRATOR_ROLE_V1,
    current_user: MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
    active_epoch_id: row.active_epoch_id,
    fact_count: row.fact_count,
    visibility_row_count: row.visibility_row_count,
    trigger_enabled: true,
    runtime_metadata_direct_dml: "FORBIDDEN",
  };
}

export async function runMcftCap07StartupMigrationRunnerV1(config: {
  migration_database_url: string;
  subject_commit: string;
}): Promise<McftCap07StartupMigrationResultV1> {
  const databaseUrl = String(config.migration_database_url || "").trim();
  const subjectCommit = String(config.subject_commit || "").trim();
  if (!databaseUrl) throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:MIGRATION_DATABASE_URL_REQUIRED");
  if (!/^[0-9a-f]{40}$/i.test(subjectCommit)) throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:SUBJECT_COMMIT_INVALID");

  const migration = loadMcftCap07RegisteredMigrationV1();
  const ledger = new McftCap07MigrationLedgerRepositoryV1();
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  let action: "APPLIED" | "ALREADY_APPLIED_EXACT" = "APPLIED";
  try {
    await assertMigratorSessionV1(client);
    await client.query("SELECT pg_catalog.pg_advisory_lock($1::bigint)", [ADVISORY_LOCK_KEY]);
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}`);
    const current = await ledger.read(client, migration.migration_id);
    if (current) {
      if (current.status !== "APPLIED" || current.migration_checksum_sha256 !== migration.migration_checksum_sha256) {
        throw new Error("MCFT_MIGRATION_LEDGER_CHECKSUM_MISMATCH");
      }
      action = "ALREADY_APPLIED_EXACT";
    } else {
      await client.query(migration.migration_sql);
      await ledger.writeApplied(client, migration, subjectCommit);
    }
    const verified = await verifyPhysicalContractV1(client, migration);
    await client.query("COMMIT");
    return { status: "PASS", migration_action: action, ...verified };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.query("SELECT pg_catalog.pg_advisory_unlock($1::bigint)", [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
    await pool.end();
  }
}

export class McftCap07StartupMigrationRunnerV1 {
  run(config: { migration_database_url: string; subject_commit: string }): Promise<McftCap07StartupMigrationResultV1> {
    return runMcftCap07StartupMigrationRunnerV1(config);
  }
}

export async function runMcftCap07StartupMigrationFromEnvironmentV1(): Promise<void> {
  const migrationDatabaseUrl = String(process.env.GEOX_MIGRATION_DATABASE_URL || "").trim();
  if (!migrationDatabaseUrl) throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:MIGRATION_DATABASE_URL_REQUIRED");
  if (String(process.env.DATABASE_URL || "").trim() || String(process.env.GEOX_RUNTIME_DATABASE_URL || "").trim() ||
      String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim()) {
    throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:NON_MIGRATION_CREDENTIAL_IN_MIGRATION_ENVIRONMENT");
  }
  const result = await runMcftCap07StartupMigrationRunnerV1({
    migration_database_url: migrationDatabaseUrl,
    subject_commit: String(process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT || "").trim(),
  });
  console.log(JSON.stringify(result));
}
