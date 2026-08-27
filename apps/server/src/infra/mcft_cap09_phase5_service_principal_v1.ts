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

export type McftCap09ServicePrincipalKindV1 = "EVIDENCE_RUNTIME" | "TWIN_RUNTIME";

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

async function assertLoginRoleSafeBeforeMutationV1(
  pool: Pool,
  roleName: string,
): Promise<void> {
  const role = await pool.query<{ oid: number }>(
    "SELECT oid FROM pg_catalog.pg_roles WHERE rolname=$1",
    [roleName],
  );
  if (role.rows.length === 0) return;
  const oid = role.rows[0]!.oid;
  const ownership = await pool.query<{ n: number }>(
    `SELECT (
       (SELECT count(*) FROM pg_catalog.pg_database WHERE datdba=$1) +
       (SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspowner=$1) +
       (SELECT count(*) FROM pg_catalog.pg_class WHERE relowner=$1) +
       (SELECT count(*) FROM pg_catalog.pg_proc WHERE proowner=$1)
     )::int AS n`,
    [oid],
  );
  if (ownership.rows[0]?.n !== 0) {
    throw new Error(`PHASE5_SERVICE_LOGIN_ROLE_OWNS_OBJECT:${roleName}`);
  }

  const memberships = await pool.query<{ role_name: string }>(
    `SELECT granted.rolname AS role_name
       FROM pg_catalog.pg_auth_members membership
       JOIN pg_catalog.pg_roles granted ON granted.oid=membership.roleid
      WHERE membership.member=$1
      ORDER BY granted.rolname`,
    [oid],
  );
  const allowed = new Set([
    MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
    MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
  ]);
  const unexpected = memberships.rows
    .map((row) => row.role_name)
    .filter((name) => !allowed.has(name));
  if (unexpected.length) {
    throw new Error(
      `PHASE5_SERVICE_LOGIN_ROLE_UNEXPECTED_MEMBERSHIP:${roleName}:${unexpected.join(",")}`,
    );
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
  await assertLoginRoleSafeBeforeMutationV1(pool, spec.login_role);

  await pool.query(
    `DO $body$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=$1) THEN
         EXECUTE pg_catalog.format('CREATE ROLE %I', $1);
       END IF;
     END
     $body$`,
    [spec.login_role],
  );
  await pool.query(
    `SELECT pg_catalog.format(
       'ALTER ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
       $1::text
     ) AS sql`,
    [spec.login_role],
  ).then(async (result) => pool.query(result.rows[0].sql));
  await pool.query(
    "SELECT pg_catalog.format('ALTER ROLE %I RESET ALL',$1::text) AS sql",
    [spec.login_role],
  ).then(async (result) => pool.query(result.rows[0].sql));
  await pool.query(
    "SELECT pg_catalog.format('ALTER ROLE %I PASSWORD %L',$1::text,$2::text) AS sql",
    [spec.login_role, requiredTextV1(input.password, "PHASE5_SERVICE_PASSWORD_REQUIRED")],
  ).then(async (result) => pool.query(result.rows[0].sql));

  // Login principals receive no direct object privileges. They inherit exactly one
  // NOLOGIN privilege role whose ACL was qualified in Phase3/Phase4.
  for (const objectKind of ["TABLES", "SEQUENCES", "FUNCTIONS"] as const) {
    await pool.query(
      `SELECT pg_catalog.format(
         'REVOKE ALL ON ALL ${objectKind} IN SCHEMA public FROM %I',
         $1::text
       ) AS sql`,
      [spec.login_role],
    ).then(async (result) => pool.query(result.rows[0].sql));
  }
  await pool.query(
    "SELECT pg_catalog.format('REVOKE ALL ON SCHEMA public FROM %I',$1::text) AS sql",
    [spec.login_role],
  ).then(async (result) => pool.query(result.rows[0].sql));

  await pool.query(
    "SELECT pg_catalog.format('GRANT %I TO %I',$1::text,$2::text) AS sql",
    [spec.privilege_role, spec.login_role],
  ).then(async (result) => pool.query(result.rows[0].sql));
  await pool.query(
    `SELECT pg_catalog.format(
       'GRANT CONNECT ON DATABASE ${databaseIdentifierV1(input.database_name)} TO %I',
       $1::text
     ) AS sql`,
    [spec.login_role],
  ).then(async (result) => pool.query(result.rows[0].sql));

  await assertLoginRoleSafeBeforeMutationV1(pool, spec.login_role);
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
    if (row.session_user !== row.current_user || (!row.rolsuper && !row.rolcreaterole)) {
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

    const crossMembership = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM pg_catalog.pg_auth_members membership
         JOIN pg_catalog.pg_roles granted ON granted.oid=membership.roleid
         JOIN pg_catalog.pg_roles member ON member.oid=membership.member
        WHERE (member.rolname=$1 AND granted.rolname=$2)
           OR (member.rolname=$3 AND granted.rolname=$4)`,
      [
        MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
        MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
        MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
        MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
      ],
    );
    if (crossMembership.rows[0]?.n !== 0) {
      throw new Error("PHASE5_SERVICE_CROSS_PLANE_MEMBERSHIP_FORBIDDEN");
    }

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
  const result = await pool.query<{
    current_user: string;
    privilege_usage: boolean;
    opposite_usage: boolean;
  }>(
    `SELECT current_user::text AS current_user,
            pg_catalog.pg_has_role(current_user,$1,'USAGE') AS privilege_usage,
            pg_catalog.pg_has_role(current_user,$2,'USAGE') AS opposite_usage`,
    [
      spec.privilege_role,
      kind === "EVIDENCE_RUNTIME"
        ? MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1
        : MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
    ],
  );
  const row = result.rows[0];
  if (!row || row.current_user !== spec.login_role) {
    throw new Error(`PHASE5_SERVICE_PRINCIPAL_IDENTITY_MISMATCH:${kind}`);
  }
  if (row.privilege_usage !== true || row.opposite_usage !== false) {
    throw new Error(`PHASE5_SERVICE_PRINCIPAL_MEMBERSHIP_MISMATCH:${kind}`);
  }
}
