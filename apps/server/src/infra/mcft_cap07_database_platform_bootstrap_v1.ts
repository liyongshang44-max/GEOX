// apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts
// Purpose: provision the frozen MCFT-CAP-07 database roles from an external administrative credential and preserve the pre-existing schema baseline before the dedicated CAP-07 migration runs.
// Boundary: this one-shot platform bootstrap is not Runtime code, never accepts the Runtime credential as fallback, and never creates CAP-07 visibility tables or canonical facts.

import { Pool } from "pg";
import { runSqlMigrations, type SqlMigrationRunSummary } from "./migrations.js";

export const MCFT_CAP07_MIGRATION_OWNER_ROLE_V1 = "geox_mcft_migration_owner_v1" as const;
export const MCFT_CAP07_MIGRATOR_ROLE_V1 = "geox_mcft_migrator_v1" as const;
export const MCFT_CAP07_RUNTIME_ROLE_V1 = "geox_runtime_v1" as const;
export const MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1 =
  "2026_07_20_mcft_cap_07_fact_visibility_support.sql" as const;

export type McftCap07DatabasePlatformBootstrapConfigV1 = {
  admin_database_url: string;
  migrator_password: string;
  runtime_password: string;
  apply_legacy_migrations?: boolean;
};

export type McftCap07DatabasePlatformBootstrapResultV1 = {
  status: "PASS";
  session_user: string;
  current_user: string;
  roles_provisioned: readonly [
    typeof MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
    typeof MCFT_CAP07_MIGRATOR_ROLE_V1,
    typeof MCFT_CAP07_RUNTIME_ROLE_V1,
  ];
  cap07_visibility_migration_excluded: true;
  legacy_migration_summary: SqlMigrationRunSummary | null;
};

function requiredSecret(value: string, code: string): string {
  const normalized = String(value || "");
  if (!normalized) throw new Error(code);
  return normalized;
}

async function formattedRolePasswordSql(pool: Pool, roleName: string, password: string): Promise<string> {
  const result = await pool.query<{ sql: string }>(
    "SELECT pg_catalog.format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS sql",
    [roleName, password],
  );
  const sql = result.rows[0]?.sql;
  if (!sql) throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:PASSWORD_SQL");
  return sql;
}

async function assertAdministrativeSessionV1(pool: Pool): Promise<{ session_user: string; current_user: string }> {
  const result = await pool.query<{
    session_user: string;
    current_user: string;
    rolsuper: boolean;
    rolcreaterole: boolean;
  }>(`
    SELECT
      session_user::text AS session_user,
      current_user::text AS current_user,
      r.rolsuper,
      r.rolcreaterole
    FROM pg_catalog.pg_roles AS r
    WHERE r.rolname = current_user
  `);
  const row = result.rows[0];
  if (!row || row.session_user !== row.current_user || (!row.rolsuper && !row.rolcreaterole)) {
    throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:ADMIN_AUTHORITY_REQUIRED");
  }
  if (
    [MCFT_CAP07_MIGRATION_OWNER_ROLE_V1, MCFT_CAP07_MIGRATOR_ROLE_V1, MCFT_CAP07_RUNTIME_ROLE_V1].includes(
      row.session_user as typeof MCFT_CAP07_RUNTIME_ROLE_V1,
    )
  ) {
    throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:DEDICATED_ROLE_REUSED_AS_ADMIN");
  }
  return { session_user: row.session_user, current_user: row.current_user };
}

async function createOrNormalizeRolesV1(pool: Pool, config: McftCap07DatabasePlatformBootstrapConfigV1): Promise<void> {
  await pool.query(`
    DO $bootstrap$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}') THEN
        CREATE ROLE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1};
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${MCFT_CAP07_MIGRATOR_ROLE_V1}') THEN
        CREATE ROLE ${MCFT_CAP07_MIGRATOR_ROLE_V1};
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${MCFT_CAP07_RUNTIME_ROLE_V1}') THEN
        CREATE ROLE ${MCFT_CAP07_RUNTIME_ROLE_V1};
      END IF;
    END
    $bootstrap$;

    ALTER ROLE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}
      NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE ${MCFT_CAP07_MIGRATOR_ROLE_V1}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE ${MCFT_CAP07_RUNTIME_ROLE_V1}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

    GRANT ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1} TO ${MCFT_CAP07_MIGRATOR_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1} FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATOR_ROLE_V1} FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
  `);

  const migratorPasswordSql = await formattedRolePasswordSql(
    pool,
    MCFT_CAP07_MIGRATOR_ROLE_V1,
    requiredSecret(config.migrator_password, "MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:MIGRATOR_PASSWORD_REQUIRED"),
  );
  const runtimePasswordSql = await formattedRolePasswordSql(
    pool,
    MCFT_CAP07_RUNTIME_ROLE_V1,
    requiredSecret(config.runtime_password, "MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:RUNTIME_PASSWORD_REQUIRED"),
  );
  await pool.query(migratorPasswordSql);
  await pool.query(runtimePasswordSql);
}

async function grantFrozenRuntimeBaselineV1(pool: Pool): Promise<void> {
  const databaseGrant = await pool.query<{ sql: string }>(
    `SELECT pg_catalog.format('GRANT CONNECT ON DATABASE %I TO ${MCFT_CAP07_MIGRATOR_ROLE_V1}, ${MCFT_CAP07_RUNTIME_ROLE_V1}', pg_catalog.current_database()) AS sql`,
  );
  const databaseGrantSql = databaseGrant.rows[0]?.sql;
  if (!databaseGrantSql) throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:DATABASE_GRANT_SQL");
  await pool.query(databaseGrantSql);
  await pool.query(`
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE CREATE ON SCHEMA public FROM ${MCFT_CAP07_MIGRATOR_ROLE_V1};
    REVOKE CREATE ON SCHEMA public FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT USAGE ON SCHEMA public TO ${MCFT_CAP07_MIGRATOR_ROLE_V1};
    GRANT USAGE ON SCHEMA public TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT USAGE, CREATE ON SCHEMA public TO ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1};

    GRANT SELECT, UPDATE, REFERENCES, TRIGGER ON TABLE public.facts TO ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1};

    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${MCFT_CAP07_RUNTIME_ROLE_V1};

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT EXECUTE ON FUNCTIONS TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
  `);
}

export async function reassertMcftCap07RuntimeVisibilityBoundaryV1(pool: Pool): Promise<boolean> {
  const relationState = await pool.query<{
    ledger_exists: boolean;
    epoch_exists: boolean;
    index_exists: boolean;
    fact_function_exists: boolean;
    epoch_function_exists: boolean;
    index_function_exists: boolean;
  }>(`
    SELECT
      pg_catalog.to_regclass('public.geox_schema_migration_ledger_v1') IS NOT NULL AS ledger_exists,
      pg_catalog.to_regclass('public.twin_fact_visibility_epoch_v1') IS NOT NULL AS epoch_exists,
      pg_catalog.to_regclass('public.twin_fact_visibility_index_v1') IS NOT NULL AS index_exists,
      pg_catalog.to_regprocedure('public.enforce_mcft_cap07_fact_visibility_v1()') IS NOT NULL AS fact_function_exists,
      pg_catalog.to_regprocedure('public.enforce_mcft_cap07_visibility_epoch_authority_v1()') IS NOT NULL AS epoch_function_exists,
      pg_catalog.to_regprocedure('public.enforce_mcft_cap07_visibility_index_immutability_v1()') IS NOT NULL AS index_function_exists
  `);
  const row = relationState.rows[0];
  if (!row) throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:CAP07_VISIBILITY_DISCOVERY");
  const values = [
    row.ledger_exists,
    row.epoch_exists,
    row.index_exists,
    row.fact_function_exists,
    row.epoch_function_exists,
    row.index_function_exists,
  ];
  const existingCount = values.filter(Boolean).length;
  if (existingCount === 0) return false;
  if (existingCount !== values.length) {
    throw new Error(`MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:CAP07_VISIBILITY_CONTRACT_PARTIAL:${existingCount}`);
  }
  await pool.query(`
    REVOKE ALL ON TABLE public.geox_schema_migration_ledger_v1 FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    REVOKE ALL ON TABLE public.twin_fact_visibility_epoch_v1 FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    REVOKE ALL ON TABLE public.twin_fact_visibility_index_v1 FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_fact_visibility_v1() FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_visibility_epoch_authority_v1() FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    REVOKE ALL ON FUNCTION public.enforce_mcft_cap07_visibility_index_immutability_v1() FROM ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT SELECT ON TABLE public.twin_fact_visibility_epoch_v1 TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT SELECT ON TABLE public.twin_fact_visibility_index_v1 TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
    GRANT SELECT ON TABLE public.geox_schema_migration_ledger_v1 TO ${MCFT_CAP07_RUNTIME_ROLE_V1};
  `);
  return true;
}

async function assertRoleGraphV1(pool: Pool): Promise<void> {
  const result = await pool.query<{
    owner_login: boolean;
    owner_super: boolean;
    migrator_login: boolean;
    migrator_inherit: boolean;
    runtime_login: boolean;
    runtime_super: boolean;
    migrator_can_set_owner: boolean;
    runtime_can_set_owner: boolean;
    runtime_can_set_migrator: boolean;
    runtime_can_create_public: boolean;
  }>(`
    SELECT
      owner.rolcanlogin AS owner_login,
      owner.rolsuper AS owner_super,
      migrator.rolcanlogin AS migrator_login,
      migrator.rolinherit AS migrator_inherit,
      runtime.rolcanlogin AS runtime_login,
      runtime.rolsuper AS runtime_super,
      pg_catalog.pg_has_role('${MCFT_CAP07_MIGRATOR_ROLE_V1}', '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}', 'SET') AS migrator_can_set_owner,
      pg_catalog.pg_has_role('${MCFT_CAP07_RUNTIME_ROLE_V1}', '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}', 'SET') AS runtime_can_set_owner,
      pg_catalog.pg_has_role('${MCFT_CAP07_RUNTIME_ROLE_V1}', '${MCFT_CAP07_MIGRATOR_ROLE_V1}', 'SET') AS runtime_can_set_migrator,
      pg_catalog.has_schema_privilege('${MCFT_CAP07_RUNTIME_ROLE_V1}', 'public', 'CREATE') AS runtime_can_create_public
    FROM pg_catalog.pg_roles AS owner
    CROSS JOIN pg_catalog.pg_roles AS migrator
    CROSS JOIN pg_catalog.pg_roles AS runtime
    WHERE owner.rolname = '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}'
      AND migrator.rolname = '${MCFT_CAP07_MIGRATOR_ROLE_V1}'
      AND runtime.rolname = '${MCFT_CAP07_RUNTIME_ROLE_V1}'
  `);
  const row = result.rows[0];
  if (
    !row ||
    row.owner_login ||
    row.owner_super ||
    !row.migrator_login ||
    row.migrator_inherit ||
    !row.runtime_login ||
    row.runtime_super ||
    !row.migrator_can_set_owner ||
    row.runtime_can_set_owner ||
    row.runtime_can_set_migrator ||
    row.runtime_can_create_public
  ) {
    throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:ROLE_GRAPH");
  }
}

export async function runMcftCap07DatabasePlatformBootstrapV1(
  config: McftCap07DatabasePlatformBootstrapConfigV1,
): Promise<McftCap07DatabasePlatformBootstrapResultV1> {
  const adminDatabaseUrl = requiredSecret(
    config.admin_database_url,
    "MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:ADMIN_DATABASE_URL_REQUIRED",
  );
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const authority = await assertAdministrativeSessionV1(pool);
    await createOrNormalizeRolesV1(pool, config);
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      GRANT USAGE ON SCHEMA public TO ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1};
      GRANT EXECUTE ON FUNCTION public.digest(bytea, text) TO ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1};
    `);
    const legacyMigrationSummary = config.apply_legacy_migrations === false
      ? null
      : await runSqlMigrations(pool, {
          exclude_files: [MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1],
        });
    if (legacyMigrationSummary?.migration_files.includes(MCFT_CAP07_VISIBILITY_MIGRATION_FILE_V1)) {
      throw new Error("MCFT_DATABASE_ROLE_BOOTSTRAP_INVALID:CAP07_MIGRATION_NOT_EXCLUDED");
    }
    await grantFrozenRuntimeBaselineV1(pool);
    await reassertMcftCap07RuntimeVisibilityBoundaryV1(pool);
    await assertRoleGraphV1(pool);
    return {
      status: "PASS",
      session_user: authority.session_user,
      current_user: authority.current_user,
      roles_provisioned: [
        MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
        MCFT_CAP07_MIGRATOR_ROLE_V1,
        MCFT_CAP07_RUNTIME_ROLE_V1,
      ],
      cap07_visibility_migration_excluded: true,
      legacy_migration_summary: legacyMigrationSummary,
    };
  } finally {
    await pool.end();
  }
}

export async function runMcftCap07DatabasePlatformBootstrapFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  const migrationDatabaseUrl = String(process.env.GEOX_MIGRATION_DATABASE_URL || "").trim();
  const runtimeDatabaseUrl = String(
    process.env.GEOX_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || "",
  ).trim();
  if (!adminDatabaseUrl || !migrationDatabaseUrl || !runtimeDatabaseUrl) {
    throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:THREE_DATABASE_IDENTITIES_REQUIRED");
  }
  if (
    adminDatabaseUrl === migrationDatabaseUrl ||
    adminDatabaseUrl === runtimeDatabaseUrl ||
    migrationDatabaseUrl === runtimeDatabaseUrl
  ) {
    throw new Error("MCFT_MIGRATION_CREDENTIAL_SEPARATION_INVALID:DATABASE_URL_REUSE");
  }
  const result = await runMcftCap07DatabasePlatformBootstrapV1({
    admin_database_url: adminDatabaseUrl,
    migrator_password: String(process.env.GEOX_MCFT_MIGRATOR_PASSWORD || ""),
    runtime_password: String(process.env.GEOX_RUNTIME_DATABASE_PASSWORD || ""),
  });
  console.log(
    JSON.stringify({
      status: result.status,
      session_user: result.session_user,
      current_user: result.current_user,
      roles_provisioned: result.roles_provisioned,
      cap07_visibility_migration_excluded: result.cap07_visibility_migration_excluded,
      legacy_sql_file_count: result.legacy_migration_summary?.sql_file_count ?? 0,
      legacy_applied_file_count: result.legacy_migration_summary?.applied_file_count ?? 0,
    }),
  );
}
