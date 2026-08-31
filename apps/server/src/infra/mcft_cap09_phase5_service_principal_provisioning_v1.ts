// MCFT-CAP-09 Production Hosting Phase 5: provisioning-only service LOGIN bootstrap.
//
// Keep this module outside the Evidence/Twin runtime import closure. Runtime identity
// assertion remains frozen in mcft_cap09_phase5_service_principal_v1.ts; Neon-specific
// delegated provisioning hardening belongs here so production-host portability does
// not invalidate an already-qualified V13 runtime dependency digest.

import { Pool } from "pg";

export const MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1 =
  "geox_mcft_cap09_evidence_runtime_v1" as const;
export const MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1 =
  "geox_mcft_cap09_twin_runtime_v1" as const;
export const MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1 =
  "geox_mcft_cap09_evidence_runtime_login_v1" as const;
export const MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1 =
  "geox_mcft_cap09_twin_runtime_login_v1" as const;

export type McftCap09ServicePrincipalKindV1 =
  | "EVIDENCE_RUNTIME"
  | "TWIN_RUNTIME";

type PrincipalSpecV1 = {
  login_role: string;
  privilege_role: string;
};

function specV1(kind: McftCap09ServicePrincipalKindV1): PrincipalSpecV1 {
  return kind === "EVIDENCE_RUNTIME"
    ? {
        login_role: MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
        privilege_role: MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
      }
    : {
        login_role: MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
        privilege_role: MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
      };
}

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function databaseIdentifierV1(value: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error("PHASE5_SERVICE_PRINCIPAL_DATABASE_NAME_INVALID");
  }
  return `"${value}"`;
}

async function formattedSqlV1(
  pool: Pool,
  template: string,
  values: readonly unknown[],
): Promise<string> {
  const placeholders = values.map((_, index) => `$${index + 2}::text`).join(",");
  const result = await pool.query<{ sql: string }>(
    `SELECT pg_catalog.format($1::text${placeholders ? `,${placeholders}` : ""}) AS sql`,
    [template, ...values],
  );
  const sql = result.rows[0]?.sql;
  if (!sql) throw new Error("PHASE5_SERVICE_FORMATTED_SQL_REQUIRED");
  return sql;
}

async function assertPrivilegeRolesV1(pool: Pool): Promise<void> {
  const result = await pool.query<{
    rolname: string;
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
  }>(
    `SELECT rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole
       FROM pg_catalog.pg_roles
      WHERE rolname = ANY($1::text[])
      ORDER BY rolname`,
    [[
      MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
      MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
    ]],
  );
  if (result.rows.length !== 2) {
    throw new Error("PHASE5_SERVICE_PRIVILEGE_ROLES_REQUIRED");
  }
  for (const row of result.rows) {
    if (
      row.rolcanlogin
      || row.rolsuper
      || row.rolcreatedb
      || row.rolcreaterole
    ) {
      throw new Error(`PHASE5_SERVICE_PRIVILEGE_ROLE_UNSAFE:${row.rolname}`);
    }
  }
}

async function assertLoginRoleSafeV1(
  pool: Pool,
  roleName: string,
  expectedPrivilegeRole?: string,
): Promise<void> {
  const role = await pool.query<{
    oid: number;
    rolcanlogin: boolean;
    rolinherit: boolean;
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
  }>(
    `SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,
            rolreplication,rolbypassrls
       FROM pg_catalog.pg_roles WHERE rolname=$1`,
    [roleName],
  );
  if (role.rows.length === 0) return;
  const row = role.rows[0]!;
  const ownership = await pool.query<{ n: number }>(
    `SELECT (
       (SELECT count(*) FROM pg_catalog.pg_database WHERE datdba=$1) +
       (SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspowner=$1) +
       (SELECT count(*) FROM pg_catalog.pg_class WHERE relowner=$1) +
       (SELECT count(*) FROM pg_catalog.pg_proc WHERE proowner=$1)
     )::int AS n`,
    [row.oid],
  );
  if (ownership.rows[0]?.n !== 0) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_OWNS_OBJECT:${roleName}`);
  }
  if (
    row.rolsuper
    || row.rolcreatedb
    || row.rolcreaterole
    || row.rolreplication
    || row.rolbypassrls
  ) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_UNSAFE:${roleName}`);
  }

  const memberships = await pool.query<{
    role_name: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>(
    `SELECT granted.rolname AS role_name,
            membership.admin_option,
            membership.inherit_option,
            membership.set_option
       FROM pg_catalog.pg_auth_members membership
       JOIN pg_catalog.pg_roles granted ON granted.oid=membership.roleid
      WHERE membership.member=$1
      ORDER BY granted.rolname`,
    [row.oid],
  );
  const names = memberships.rows.map((item) => item.role_name);
  if (expectedPrivilegeRole === undefined) {
    if (names.some((name) => ![
      MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
      MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
    ].includes(name as never))) {
      throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_UNEXPECTED_MEMBERSHIP:${roleName}`);
    }
    return;
  }
  if (
    row.rolcanlogin !== true
    || row.rolinherit !== true
    || names.length !== 1
    || names[0] !== expectedPrivilegeRole
    || memberships.rows[0]?.admin_option !== false
    || memberships.rows[0]?.inherit_option !== true
    || memberships.rows[0]?.set_option !== false
  ) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_EXACT_MEMBERSHIP_REQUIRED:${roleName}`);
  }
}

async function assertLoginRoleNoDirectPublicAclV1(
  pool: Pool,
  roleName: string,
): Promise<void> {
  const direct = await pool.query<{
    relation_grants: number;
    routine_grants: number;
    schema_grants: number;
  }>(
    `WITH target AS (
       SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$1
     )
     SELECT
       (SELECT count(*)::int
          FROM pg_catalog.pg_class object
          JOIN pg_catalog.pg_namespace namespace ON namespace.oid=object.relnamespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(object.relacl) acl
          JOIN target ON target.oid=acl.grantee
         WHERE namespace.nspname='public') AS relation_grants,
       (SELECT count(*)::int
          FROM pg_catalog.pg_proc routine
          JOIN pg_catalog.pg_namespace namespace ON namespace.oid=routine.pronamespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(routine.proacl) acl
          JOIN target ON target.oid=acl.grantee
         WHERE namespace.nspname='public') AS routine_grants,
       (SELECT count(*)::int
          FROM pg_catalog.pg_namespace namespace
          CROSS JOIN LATERAL pg_catalog.aclexplode(namespace.nspacl) acl
          JOIN target ON target.oid=acl.grantee
         WHERE namespace.nspname='public') AS schema_grants`,
    [roleName],
  );
  const row = direct.rows[0];
  if (
    row === undefined
    || row.relation_grants !== 0
    || row.routine_grants !== 0
    || row.schema_grants !== 0
  ) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_DIRECT_PUBLIC_ACL_FORBIDDEN:${roleName}`);
  }
}

async function provisionOneV1(
  pool: Pool,
  input: {
    database_name: string;
    kind: McftCap09ServicePrincipalKindV1;
    password: string;
  },
): Promise<void> {
  const spec = specV1(input.kind);
  await assertLoginRoleSafeV1(pool, spec.login_role);

  const password = requiredTextV1(
    input.password,
    "PHASE5_SERVICE_PASSWORD_REQUIRED",
  );
  const exists = await pool.query<{ present: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=$1) AS present",
    [spec.login_role],
  );
  if (exists.rows[0]?.present !== true) {
    await pool.query(
      await formattedSqlV1(
        pool,
        "CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L",
        [spec.login_role, password],
      ),
    );
  } else {
    const shape = await pool.query<{ rolcanlogin: boolean; rolinherit: boolean }>(
      "SELECT rolcanlogin,rolinherit FROM pg_catalog.pg_roles WHERE rolname=$1",
      [spec.login_role],
    );
    if (
      shape.rows[0]?.rolcanlogin !== true
      || shape.rows[0]?.rolinherit !== true
    ) {
      throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_SHAPE_REQUIRED:${spec.login_role}`);
    }
  }

  // Existing roles are validated from pg_roles. Do not re-declare privileged
  // SUPERUSER/REPLICATION/BYPASSRLS attributes with no-op ALTER ROLE clauses.
  await pool.query(
    await formattedSqlV1(pool, "ALTER ROLE %I RESET ALL", [spec.login_role]),
  );
  await pool.query(
    await formattedSqlV1(pool, "ALTER ROLE %I PASSWORD %L", [
      spec.login_role,
      password,
    ]),
  );

  // Do not attempt privileged blanket REVOKE against writer-owned objects.
  // A new LOGIN has no direct grants; an existing LOGIN must already be clean.
  await assertLoginRoleNoDirectPublicAclV1(pool, spec.login_role);

  const currentMemberships = await pool.query<{ role_name: string }>(
    `SELECT granted.rolname AS role_name
       FROM pg_catalog.pg_auth_members membership
       JOIN pg_catalog.pg_roles granted ON granted.oid=membership.roleid
       JOIN pg_catalog.pg_roles member ON member.oid=membership.member
      WHERE member.rolname=$1
      ORDER BY granted.rolname`,
    [spec.login_role],
  );
  const currentNames = currentMemberships.rows.map((row) => row.role_name);
  if (currentNames.some((name) => name !== spec.privilege_role)) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_OPPOSITE_MEMBERSHIP_FORBIDDEN:${spec.login_role}`);
  }
  if (!currentNames.includes(spec.privilege_role)) {
    await pool.query(
      await formattedSqlV1(
        pool,
        "GRANT %I TO %I WITH SET FALSE",
        [spec.privilege_role, spec.login_role],
      ),
    );
    await pool.query(
      await formattedSqlV1(
        pool,
        "GRANT %I TO %I WITH INHERIT TRUE",
        [spec.privilege_role, spec.login_role],
      ),
    );
  }
  await pool.query(
    await formattedSqlV1(
      pool,
      `GRANT CONNECT ON DATABASE ${databaseIdentifierV1(input.database_name)} TO %I`,
      [spec.login_role],
    ),
  );

  await assertLoginRoleNoDirectPublicAclV1(pool, spec.login_role);
  await assertLoginRoleSafeV1(pool, spec.login_role, spec.privilege_role);
}

export async function bootstrapMcftCap09Phase5ServicePrincipalsV1(input: {
  admin_database_url: string;
  expected_database_name: string;
  evidence_runtime_password: string;
  twin_runtime_password: string;
}): Promise<{
  status: "PASS";
  evidence_login_role: typeof MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1;
  twin_login_role: typeof MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1;
}> {
  const databaseName = requiredTextV1(
    input.expected_database_name,
    "PHASE5_SERVICE_DATABASE_NAME_REQUIRED",
  );
  databaseIdentifierV1(databaseName);
  const pool = new Pool({
    connectionString: requiredTextV1(
      input.admin_database_url,
      "PHASE5_SERVICE_ADMIN_DATABASE_URL_REQUIRED",
    ),
    max: 1,
  });
  try {
    const authority = await pool.query<{
      database_name: string;
      session_user: string;
      current_user: string;
      rolsuper: boolean;
      rolcreaterole: boolean;
    }>(
      `SELECT current_database()::text AS database_name,
              session_user::text AS session_user,
              current_user::text AS current_user,
              role.rolsuper,
              role.rolcreaterole
         FROM pg_catalog.pg_roles role
        WHERE role.rolname=current_user`,
    );
    const row = authority.rows[0];
    if (!row || row.database_name !== databaseName) {
      throw new Error("PHASE5_SERVICE_BOOTSTRAP_DATABASE_MISMATCH");
    }
    if (
      row.session_user !== row.current_user
      || (!row.rolsuper && !row.rolcreaterole)
    ) {
      throw new Error("PHASE5_SERVICE_BOOTSTRAP_ADMIN_AUTHORITY_REQUIRED");
    }

    await assertPrivilegeRolesV1(pool);
    await provisionOneV1(pool, {
      database_name: databaseName,
      kind: "EVIDENCE_RUNTIME",
      password: input.evidence_runtime_password,
    });
    await provisionOneV1(pool, {
      database_name: databaseName,
      kind: "TWIN_RUNTIME",
      password: input.twin_runtime_password,
    });

    return {
      status: "PASS",
      evidence_login_role: MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
      twin_login_role: MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
    };
  } finally {
    await pool.end();
  }
}

