// apps/server/src/infra/bline_commercial_principal_bootstrap_v1.ts
// Purpose: isolate Commercial worker PostgreSQL identities without modifying the frozen MCFT-CAP-07 role graph.
// Boundary: one-shot B-Line platform bootstrap only; never imported by long-running Runtime workloads.

import { Pool } from "pg";
import {
  MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
  MCFT_CAP07_MIGRATOR_ROLE_V1,
  MCFT_CAP07_RUNTIME_ROLE_V1,
} from "./mcft_cap07_database_platform_bootstrap_v1.js";

export const BLINE_COMMERCIAL_TELEMETRY_ROLE_V1 = "geox_telemetry_ingest_v1" as const;
export const BLINE_COMMERCIAL_JOBS_ROLE_V1 = "geox_jobs_v1" as const;
export const BLINE_COMMERCIAL_EXECUTOR_ROLE_V1 = "geox_executor_runtime_v1" as const;

export const BLINE_COMMERCIAL_WORKLOAD_ROLES_V1 = Object.freeze([
  BLINE_COMMERCIAL_TELEMETRY_ROLE_V1,
  BLINE_COMMERCIAL_JOBS_ROLE_V1,
  BLINE_COMMERCIAL_EXECUTOR_ROLE_V1,
] as const);

export type BlineCommercialPrincipalBootstrapConfigV1 = {
  admin_database_url: string;
  telemetry_password: string;
  jobs_password: string;
  executor_password: string;
};

export type BlineCommercialPrincipalBootstrapResultV1 = {
  status: "PASS";
  session_user: string;
  current_user: string;
  principals: readonly [
    typeof BLINE_COMMERCIAL_TELEMETRY_ROLE_V1,
    typeof BLINE_COMMERCIAL_JOBS_ROLE_V1,
    typeof BLINE_COMMERCIAL_EXECUTOR_ROLE_V1,
  ];
  mcft_runtime_role_unchanged: true;
  workload_role_membership_in_mcft_roles: false;
  effective_runtime_object_baseline: true;
};

function requiredSecret(value: string | undefined, code: string): string {
  const normalized = String(value ?? "");
  if (!normalized) throw new Error(code);
  return normalized;
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
    throw new Error("BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:ADMIN_AUTHORITY_REQUIRED");
  }
  const forbiddenAdminRoles = new Set<string>([
    MCFT_CAP07_MIGRATION_OWNER_ROLE_V1,
    MCFT_CAP07_MIGRATOR_ROLE_V1,
    MCFT_CAP07_RUNTIME_ROLE_V1,
    ...BLINE_COMMERCIAL_WORKLOAD_ROLES_V1,
  ]);
  if (forbiddenAdminRoles.has(row.session_user)) {
    throw new Error("BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:WORKLOAD_ROLE_REUSED_AS_ADMIN");
  }
  return { session_user: row.session_user, current_user: row.current_user };
}

async function formattedRolePasswordSql(pool: Pool, roleName: string, password: string): Promise<string> {
  const result = await pool.query<{ sql: string }>(
    "SELECT pg_catalog.format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS sql",
    [roleName, password],
  );
  const sql = result.rows[0]?.sql;
  if (!sql) throw new Error("BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:PASSWORD_SQL");
  return sql;
}

async function createOrNormalizeWorkloadRolesV1(pool: Pool): Promise<void> {
  await pool.query(`
    DO $bootstrap$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1}') THEN
        CREATE ROLE ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${BLINE_COMMERCIAL_JOBS_ROLE_V1}') THEN
        CREATE ROLE ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1}') THEN
        CREATE ROLE ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
      END IF;
    END
    $bootstrap$;

    ALTER ROLE ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE ${BLINE_COMMERCIAL_JOBS_ROLE_V1}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    ALTER ROLE ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1}
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

    REVOKE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1} FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATOR_ROLE_V1} FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1} FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATOR_ROLE_V1} FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1} FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
    REVOKE ${MCFT_CAP07_MIGRATOR_ROLE_V1} FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
    REVOKE ${MCFT_CAP07_RUNTIME_ROLE_V1} FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
  `);
}

async function setWorkloadPasswordsV1(pool: Pool, config: BlineCommercialPrincipalBootstrapConfigV1): Promise<void> {
  const passwordPairs: Array<[string, string]> = [
    [BLINE_COMMERCIAL_TELEMETRY_ROLE_V1, requiredSecret(config.telemetry_password, "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:TELEMETRY_PASSWORD_REQUIRED")],
    [BLINE_COMMERCIAL_JOBS_ROLE_V1, requiredSecret(config.jobs_password, "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:JOBS_PASSWORD_REQUIRED")],
    [BLINE_COMMERCIAL_EXECUTOR_ROLE_V1, requiredSecret(config.executor_password, "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:EXECUTOR_PASSWORD_REQUIRED")],
  ];
  for (const [roleName, password] of passwordPairs) {
    await pool.query(await formattedRolePasswordSql(pool, roleName, password));
  }
}

async function grantFrozenRuntimeObjectBaselineV1(pool: Pool): Promise<void> {
  const roles = BLINE_COMMERCIAL_WORKLOAD_ROLES_V1.join(", ");
  const databaseGrant = await pool.query<{ sql: string }>(
    `SELECT pg_catalog.format('GRANT CONNECT ON DATABASE %I TO ${roles}', pg_catalog.current_database()) AS sql`,
  );
  const databaseGrantSql = databaseGrant.rows[0]?.sql;
  if (!databaseGrantSql) throw new Error("BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:DATABASE_GRANT_SQL");
  await pool.query(databaseGrantSql);

  await pool.query(`
    REVOKE CREATE ON SCHEMA public FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE CREATE ON SCHEMA public FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE CREATE ON SCHEMA public FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
    GRANT USAGE ON SCHEMA public TO ${roles};

    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${BLINE_COMMERCIAL_TELEMETRY_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${BLINE_COMMERCIAL_JOBS_ROLE_V1};
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${BLINE_COMMERCIAL_EXECUTOR_ROLE_V1};

    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${roles};
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${roles};
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${roles};
  `);
}

async function assertWorkloadRoleGraphV1(pool: Pool): Promise<void> {
  for (const roleName of BLINE_COMMERCIAL_WORKLOAD_ROLES_V1) {
    const result = await pool.query<{
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      can_set_owner: boolean;
      can_set_migrator: boolean;
      can_set_runtime: boolean;
      can_create_public: boolean;
      can_use_public: boolean;
      can_select_facts: boolean;
      can_insert_facts: boolean;
      can_update_facts: boolean;
      can_delete_facts: boolean;
    }>(`
      SELECT
        r.rolcanlogin,
        r.rolinherit,
        r.rolsuper,
        r.rolcreatedb,
        r.rolcreaterole,
        r.rolreplication,
        r.rolbypassrls,
        pg_catalog.pg_has_role($1, '${MCFT_CAP07_MIGRATION_OWNER_ROLE_V1}', 'SET') AS can_set_owner,
        pg_catalog.pg_has_role($1, '${MCFT_CAP07_MIGRATOR_ROLE_V1}', 'SET') AS can_set_migrator,
        pg_catalog.pg_has_role($1, '${MCFT_CAP07_RUNTIME_ROLE_V1}', 'SET') AS can_set_runtime,
        pg_catalog.has_schema_privilege($1, 'public', 'CREATE') AS can_create_public,
        pg_catalog.has_schema_privilege($1, 'public', 'USAGE') AS can_use_public,
        pg_catalog.has_table_privilege($1, 'public.facts', 'SELECT') AS can_select_facts,
        pg_catalog.has_table_privilege($1, 'public.facts', 'INSERT') AS can_insert_facts,
        pg_catalog.has_table_privilege($1, 'public.facts', 'UPDATE') AS can_update_facts,
        pg_catalog.has_table_privilege($1, 'public.facts', 'DELETE') AS can_delete_facts
      FROM pg_catalog.pg_roles AS r
      WHERE r.rolname = $1
    `, [roleName]);
    const row = result.rows[0];
    if (
      !row ||
      !row.rolcanlogin ||
      row.rolinherit ||
      row.rolsuper ||
      row.rolcreatedb ||
      row.rolcreaterole ||
      row.rolreplication ||
      row.rolbypassrls ||
      row.can_set_owner ||
      row.can_set_migrator ||
      row.can_set_runtime ||
      row.can_create_public ||
      !row.can_use_public ||
      !row.can_select_facts ||
      !row.can_insert_facts ||
      !row.can_update_facts ||
      !row.can_delete_facts
    ) {
      throw new Error(`BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:ROLE_GRAPH:${roleName}`);
    }
  }
}

export async function runBlineCommercialPrincipalBootstrapV1(
  config: BlineCommercialPrincipalBootstrapConfigV1,
): Promise<BlineCommercialPrincipalBootstrapResultV1> {
  const adminDatabaseUrl = requiredSecret(
    config.admin_database_url,
    "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:ADMIN_DATABASE_URL_REQUIRED",
  );
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const authority = await assertAdministrativeSessionV1(pool);
    await createOrNormalizeWorkloadRolesV1(pool);
    await setWorkloadPasswordsV1(pool, config);
    await grantFrozenRuntimeObjectBaselineV1(pool);
    await assertWorkloadRoleGraphV1(pool);
    return {
      status: "PASS",
      session_user: authority.session_user,
      current_user: authority.current_user,
      principals: BLINE_COMMERCIAL_WORKLOAD_ROLES_V1,
      mcft_runtime_role_unchanged: true,
      workload_role_membership_in_mcft_roles: false,
      effective_runtime_object_baseline: true,
    };
  } finally {
    await pool.end();
  }
}

export async function runBlineCommercialPrincipalBootstrapFromEnvironmentV1(): Promise<BlineCommercialPrincipalBootstrapResultV1> {
  const result = await runBlineCommercialPrincipalBootstrapV1({
    admin_database_url: requiredSecret(
      process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL,
      "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:ADMIN_DATABASE_URL_REQUIRED",
    ),
    telemetry_password: requiredSecret(
      process.env.GEOX_TELEMETRY_DATABASE_PASSWORD,
      "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:TELEMETRY_PASSWORD_REQUIRED",
    ),
    jobs_password: requiredSecret(
      process.env.GEOX_JOBS_DATABASE_PASSWORD,
      "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:JOBS_PASSWORD_REQUIRED",
    ),
    executor_password: requiredSecret(
      process.env.GEOX_EXECUTOR_DATABASE_PASSWORD,
      "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_INVALID:EXECUTOR_PASSWORD_REQUIRED",
    ),
  });
  console.log(JSON.stringify({ event: "BLINE_COMMERCIAL_PRINCIPAL_BOOTSTRAP_V1", ...result }));
  return result;
}
