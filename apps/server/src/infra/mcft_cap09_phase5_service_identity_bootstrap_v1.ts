// MCFT-CAP-09 Production Hosting Phase 5: dedicated database service identities.
// One-shot administrative bootstrap for qualification/deployment only.
// Evidence and Twin containers receive distinct LOGIN principals whose effective
// privileges come only from the Phase3/Phase4 NOLOGIN privilege roles.

import { Pool } from "pg";

export const MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 =
  "geox_mcft_cap09_evidence_service_v1" as const;
export const MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 =
  "geox_mcft_cap09_twin_service_v1" as const;
export const MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1 =
  "geox_mcft_cap09_evidence_runtime_v1" as const;
export const MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1 =
  "geox_mcft_cap09_twin_runtime_v1" as const;

const FORBIDDEN_PARENT_ROLES = [
  "geox_runtime_v1",
  "geox_mcft_migrator_v1",
  "geox_mcft_migration_owner_v1",
] as const;

export type McftCap09Phase5ServiceIdentityBootstrapConfigV1 = {
  admin_database_url: string;
  evidence_service_password: string;
  twin_service_password: string;
};

export type McftCap09Phase5ServiceIdentityBootstrapResultV1 = {
  status: "PASS";
  database_name: string;
  evidence_service_role: typeof MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1;
  twin_service_role: typeof MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1;
  evidence_privilege_role: typeof MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1;
  twin_privilege_role: typeof MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1;
  cross_plane_membership: false;
  generic_runtime_membership: false;
  direct_table_privilege_count: 0;
};

function requiredSecretV1(value: string, code: string): string {
  const text = String(value || "");
  if (!text) throw new Error(code);
  return text;
}

async function formattedRolePasswordSqlV1(
  pool: Pool,
  roleName: string,
  password: string,
): Promise<string> {
  const result = await pool.query<{ sql: string }>(
    "SELECT pg_catalog.format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS sql",
    [roleName, password],
  );
  const sql = result.rows[0]?.sql;
  if (!sql) throw new Error("PHASE5_SERVICE_IDENTITY_PASSWORD_SQL_INVALID");
  return sql;
}

async function assertAdministrativeSessionV1(pool: Pool): Promise<void> {
  const result = await pool.query<{
    session_user: string;
    current_user: string;
    rolsuper: boolean;
    rolcreaterole: boolean;
  }>(
    "SELECT session_user::text AS session_user, current_user::text AS current_user, " +
    "role_row.rolsuper, role_row.rolcreaterole " +
    "FROM pg_catalog.pg_roles AS role_row WHERE role_row.rolname=current_user",
  );
  const row = result.rows[0];
  if (
    !row ||
    row.session_user !== row.current_user ||
    (!row.rolsuper && !row.rolcreaterole)
  ) {
    throw new Error("PHASE5_SERVICE_IDENTITY_ADMIN_AUTHORITY_REQUIRED");
  }
}

async function assertPrivilegeRolesExistV1(pool: Pool): Promise<void> {
  const result = await pool.query<{ rolname: string; rolcanlogin: boolean }>(
    "SELECT rolname,rolcanlogin FROM pg_catalog.pg_roles " +
    "WHERE rolname = ANY($1::text[]) ORDER BY rolname",
    [[MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1, MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1]],
  );
  if (result.rows.length !== 2) {
    throw new Error("PHASE5_SERVICE_IDENTITY_PRIVILEGE_ROLES_REQUIRED");
  }
  if (result.rows.some((row) => row.rolcanlogin)) {
    throw new Error("PHASE5_SERVICE_IDENTITY_PRIVILEGE_ROLE_MUST_BE_NOLOGIN");
  }
}

async function createOrNormalizeServiceRolesV1(
  pool: Pool,
  config: McftCap09Phase5ServiceIdentityBootstrapConfigV1,
): Promise<void> {
  const rolesSql = [
    "DO $bootstrap$",
    "BEGIN",
    "  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='" +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + "') THEN",
    "    CREATE ROLE " + MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "  END IF;",
    "  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='" +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + "') THEN",
    "    CREATE ROLE " + MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "  END IF;",
    "END",
    "$bootstrap$;",
    "ALTER ROLE " + MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 +
      " LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;",
    "ALTER ROLE " + MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 +
      " LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;",
    "REVOKE ALL ON SCHEMA public FROM " + MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL ON SCHEMA public FROM " + MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE " + MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1 + " FROM " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE " + MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1 + " FROM " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE geox_runtime_v1 FROM " + MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE geox_runtime_v1 FROM " + MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE geox_mcft_migrator_v1 FROM " + MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE geox_mcft_migrator_v1 FROM " + MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE geox_mcft_migration_owner_v1 FROM " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "REVOKE geox_mcft_migration_owner_v1 FROM " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
    "GRANT " + MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1 + " TO " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ";",
    "GRANT " + MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1 + " TO " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + ";",
  ].join("\n");
  await pool.query(rolesSql);

  await pool.query(
    await formattedRolePasswordSqlV1(
      pool,
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1,
      requiredSecretV1(
        config.evidence_service_password,
        "PHASE5_EVIDENCE_SERVICE_PASSWORD_REQUIRED",
      ),
    ),
  );
  await pool.query(
    await formattedRolePasswordSqlV1(
      pool,
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1,
      requiredSecretV1(
        config.twin_service_password,
        "PHASE5_TWIN_SERVICE_PASSWORD_REQUIRED",
      ),
    ),
  );

  const databaseGrant = await pool.query<{ sql: string }>(
    "SELECT pg_catalog.format(" +
      "'GRANT CONNECT ON DATABASE %I TO " +
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1 + ", " +
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1 + "', " +
      "pg_catalog.current_database()) AS sql",
  );
  const grantSql = databaseGrant.rows[0]?.sql;
  if (!grantSql) throw new Error("PHASE5_SERVICE_IDENTITY_DATABASE_GRANT_INVALID");
  await pool.query(grantSql);
}

async function assertRoleGraphV1(pool: Pool): Promise<number> {
  const servicePairs = [
    {
      service: MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1,
      required: MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1,
      forbidden: MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1,
    },
    {
      service: MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1,
      required: MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1,
      forbidden: MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1,
    },
  ] as const;

  for (const pair of servicePairs) {
    const role = await pool.query<{
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(
      "SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls " +
      "FROM pg_catalog.pg_roles WHERE rolname=$1",
      [pair.service],
    );
    const row = role.rows[0];
    if (
      !row ||
      !row.rolcanlogin ||
      !row.rolinherit ||
      row.rolsuper ||
      row.rolcreatedb ||
      row.rolcreaterole ||
      row.rolbypassrls
    ) {
      throw new Error("PHASE5_SERVICE_IDENTITY_ROLE_ATTRIBUTES_INVALID:" + pair.service);
    }

    const requiredMembership = await pool.query<{ member: boolean }>(
      "SELECT pg_catalog.pg_has_role($1,$2,'MEMBER') AS member",
      [pair.service, pair.required],
    );
    if (requiredMembership.rows[0]?.member !== true) {
      throw new Error("PHASE5_SERVICE_IDENTITY_REQUIRED_MEMBERSHIP_MISSING:" + pair.service);
    }

    const forbiddenMembership = await pool.query<{ member: boolean }>(
      "SELECT pg_catalog.pg_has_role($1,$2,'MEMBER') AS member",
      [pair.service, pair.forbidden],
    );
    if (forbiddenMembership.rows[0]?.member === true) {
      throw new Error("PHASE5_SERVICE_IDENTITY_CROSS_PLANE_MEMBERSHIP:" + pair.service);
    }

    for (const forbiddenParent of FORBIDDEN_PARENT_ROLES) {
      const membership = await pool.query<{ member: boolean }>(
        "SELECT pg_catalog.pg_has_role($1,$2,'MEMBER') AS member",
        [pair.service, forbiddenParent],
      );
      if (membership.rows[0]?.member === true) {
        throw new Error(
          "PHASE5_SERVICE_IDENTITY_FORBIDDEN_PARENT:" +
          pair.service + ":" + forbiddenParent,
        );
      }
    }
  }

  const direct = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM information_schema.role_table_grants " +
    "WHERE grantee = ANY($1::text[])",
    [[
      MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1,
      MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1,
    ]],
  );
  const directCount = Number(direct.rows[0]?.count ?? "-1");
  if (directCount !== 0) {
    throw new Error("PHASE5_SERVICE_IDENTITY_DIRECT_TABLE_PRIVILEGES_FORBIDDEN");
  }
  return directCount;
}

export async function runMcftCap09Phase5ServiceIdentityBootstrapV1(
  config: McftCap09Phase5ServiceIdentityBootstrapConfigV1,
): Promise<McftCap09Phase5ServiceIdentityBootstrapResultV1> {
  const evidencePassword = requiredSecretV1(
    config.evidence_service_password,
    "PHASE5_EVIDENCE_SERVICE_PASSWORD_REQUIRED",
  );
  const twinPassword = requiredSecretV1(
    config.twin_service_password,
    "PHASE5_TWIN_SERVICE_PASSWORD_REQUIRED",
  );
  if (evidencePassword === twinPassword) {
    throw new Error("PHASE5_SERVICE_IDENTITY_PASSWORD_REUSE_FORBIDDEN");
  }

  const pool = new Pool({
    connectionString: requiredSecretV1(
      config.admin_database_url,
      "PHASE5_SERVICE_IDENTITY_ADMIN_DATABASE_URL_REQUIRED",
    ),
    max: 1,
  });
  try {
    await assertAdministrativeSessionV1(pool);
    await assertPrivilegeRolesExistV1(pool);
    await createOrNormalizeServiceRolesV1(pool, {
      ...config,
      evidence_service_password: evidencePassword,
      twin_service_password: twinPassword,
    });
    const directCount = await assertRoleGraphV1(pool);
    const database = await pool.query<{ name: string }>(
      "SELECT pg_catalog.current_database()::text AS name",
    );
    return {
      status: "PASS",
      database_name: database.rows[0]?.name ?? "",
      evidence_service_role: MCFT_CAP09_EVIDENCE_SERVICE_LOGIN_ROLE_V1,
      twin_service_role: MCFT_CAP09_TWIN_SERVICE_LOGIN_ROLE_V1,
      evidence_privilege_role: MCFT_CAP09_EVIDENCE_PRIVILEGE_ROLE_V1,
      twin_privilege_role: MCFT_CAP09_TWIN_PRIVILEGE_ROLE_V1,
      cross_plane_membership: false,
      generic_runtime_membership: false,
      direct_table_privilege_count: directCount as 0,
    };
  } finally {
    await pool.end();
  }
}

export async function runMcftCap09Phase5ServiceIdentityBootstrapFromEnvironmentV1(): Promise<void> {
  const result = await runMcftCap09Phase5ServiceIdentityBootstrapV1({
    admin_database_url: String(
      process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "",
    ),
    evidence_service_password: String(
      process.env.GEOX_MCFT_CAP09_EVIDENCE_SERVICE_PASSWORD || "",
    ),
    twin_service_password: String(
      process.env.GEOX_MCFT_CAP09_TWIN_SERVICE_PASSWORD || "",
    ),
  });
  process.stdout.write(JSON.stringify(result) + "\n");
}
