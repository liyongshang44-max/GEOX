// MCFT-CAP-09 Production Hosting Phase 5: service login principals.
//
// Phase3/Phase4 define NOLOGIN privilege roles. This module provisions two separate
// LOGIN principals whose only role membership is the corresponding Evidence/Twin
// privilege role. Passwords are runtime bootstrap inputs and never live in migrations.

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

  const memberships = await pool.query<{ role_name: string }>(
    `SELECT granted.rolname AS role_name
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
  ) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_EXACT_MEMBERSHIP_REQUIRED:${roleName}`);
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

  const exists = await pool.query<{ present: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=$1) AS present",
    [spec.login_role],
  );
  if (exists.rows[0]?.present !== true) {
    await pool.query(
      await formattedSqlV1(pool, "CREATE ROLE %I", [spec.login_role]),
    );
  }

  await pool.query(
    await formattedSqlV1(
      pool,
      "ALTER ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS",
      [spec.login_role],
    ),
  );
  await pool.query(
    await formattedSqlV1(pool, "ALTER ROLE %I RESET ALL", [spec.login_role]),
  );
  await pool.query(
    await formattedSqlV1(pool, "ALTER ROLE %I PASSWORD %L", [
      spec.login_role,
      requiredTextV1(input.password, "PHASE5_SERVICE_PASSWORD_REQUIRED"),
    ]),
  );

  for (const objectKind of ["TABLES", "SEQUENCES", "FUNCTIONS"] as const) {
    await pool.query(
      await formattedSqlV1(
        pool,
        `REVOKE ALL ON ALL ${objectKind} IN SCHEMA public FROM %I`,
        [spec.login_role],
      ),
    );
  }
  await pool.query(
    await formattedSqlV1(
      pool,
      "REVOKE ALL ON SCHEMA public FROM %I",
      [spec.login_role],
    ),
  );

  // Remove any previously allowed opposite-plane membership before establishing the
  // exact one-role membership. Unexpected third-party memberships fail closed above.
  for (const privilegeRole of [
    MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
    MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
  ]) {
    await pool.query(
      await formattedSqlV1(
        pool,
        "REVOKE %I FROM %I",
        [privilegeRole, spec.login_role],
      ),
    );
  }
  await pool.query(
    await formattedSqlV1(
      pool,
      "GRANT %I TO %I",
      [spec.privilege_role, spec.login_role],
    ),
  );
  await pool.query(
    await formattedSqlV1(
      pool,
      `GRANT CONNECT ON DATABASE ${databaseIdentifierV1(input.database_name)} TO %I`,
      [spec.login_role],
    ),
  );

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

export async function assertMcftCap09ServicePrincipalV1(
  pool: Pick<Pool, "query">,
  kind: McftCap09ServicePrincipalKindV1,
): Promise<void> {
  const spec = specV1(kind);
  const opposite = kind === "EVIDENCE_RUNTIME"
    ? MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1
    : MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1;
  const result = await pool.query<{
    current_user: string;
    privilege_usage: boolean;
    opposite_usage: boolean;
  }>(
    `SELECT current_user::text AS current_user,
            pg_catalog.pg_has_role(current_user,$1,'USAGE') AS privilege_usage,
            pg_catalog.pg_has_role(current_user,$2,'USAGE') AS opposite_usage`,
    [spec.privilege_role, opposite],
  );
  const row = result.rows[0];
  if (!row || row.current_user !== spec.login_role) {
    throw new Error(`PHASE5_SERVICE_PRINCIPAL_IDENTITY_MISMATCH:${kind}`);
  }
  if (row.privilege_usage !== true || row.opposite_usage !== false) {
    throw new Error(`PHASE5_SERVICE_PRINCIPAL_MEMBERSHIP_MISMATCH:${kind}`);
  }
}
