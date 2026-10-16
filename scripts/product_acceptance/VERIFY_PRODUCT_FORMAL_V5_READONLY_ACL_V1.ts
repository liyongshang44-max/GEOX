import { Pool } from "pg";

const TARGET_DATABASE = "geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const PRINCIPALS = [
  "geox_product_readonly_login_v1",
  "geox_product_readonly_v1",
] as const;
const TABLES = [
  "facts",
  "twin_active_lineage_index_v1",
  "twin_state_latest_index_v1",
  "twin_state_history_projection_v1",
] as const;

function requiredEnv(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`PRODUCT_FORMAL_V5_ACL_ENV_REQUIRED:${name}`);
  return value;
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: requiredEnv("GEOX_PRODUCT_FORMAL_V5_ADMIN_DATABASE_URL"),
    max: 1,
  });

  try {
    const db = await pool.query<{ database_name: string; transaction_read_only: string }>(
      `SELECT current_database() AS database_name,
              pg_catalog.current_setting('transaction_read_only') AS transaction_read_only`,
    );
    if (db.rows[0]?.database_name !== TARGET_DATABASE) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_WRONG_DATABASE");
    }

    const attrs = await pool.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb,
              rolcreaterole, rolreplication, rolbypassrls
         FROM pg_catalog.pg_roles
        WHERE rolname = ANY($1::text[])
        ORDER BY rolname`,
      [PRINCIPALS],
    );
    if (attrs.rows.length !== PRINCIPALS.length) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_PRINCIPAL_SET_INCOMPLETE");
    }
    for (const row of attrs.rows) {
      if (
        row.rolinherit !== false
        || row.rolsuper !== false
        || row.rolcreatedb !== false
        || row.rolcreaterole !== false
        || row.rolreplication !== false
        || row.rolbypassrls !== false
      ) {
        throw new Error(`PRODUCT_FORMAL_V5_ACL_PRINCIPAL_PRIVILEGE_DRIFT:${row.rolname}`);
      }
    }
    const login = attrs.rows.find((row) => row.rolname === "geox_product_readonly_login_v1");
    const role = attrs.rows.find((row) => row.rolname === "geox_product_readonly_v1");
    if (login?.rolcanlogin !== true || role?.rolcanlogin !== false) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_LOGIN_ROLE_SHAPE_DRIFT");
    }

    const member = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM pg_catalog.pg_auth_members m
         JOIN pg_catalog.pg_roles member ON member.oid=m.member
         JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
        WHERE member.rolname='geox_product_readonly_login_v1'
          AND granted.rolname='geox_product_readonly_v1'`,
    );
    if (Number(member.rows[0]?.n ?? "-1") !== 0) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_MEMBERSHIP_FORBIDDEN");
    }

    const settings = await pool.query<{ rolname: string; setting: string }>(
      `SELECT r.rolname, unnest(s.setconfig) AS setting
         FROM pg_catalog.pg_db_role_setting s
         JOIN pg_catalog.pg_roles r ON r.oid=s.setrole
        WHERE r.rolname = ANY($1::text[])
        ORDER BY r.rolname, setting`,
      [PRINCIPALS],
    );
    for (const principal of PRINCIPALS) {
      const values = settings.rows
        .filter((row) => row.rolname === principal)
        .map((row) => row.setting);
      if (!values.includes("default_transaction_read_only=on")) {
        throw new Error(`PRODUCT_FORMAL_V5_ACL_READ_ONLY_SETTING_MISSING:${principal}`);
      }
    }

    const direct = await pool.query<{
      grantee: string;
      relname: string;
      privilege_type: string;
      is_grantable: boolean;
    }>(
      `SELECT pg_get_userbyid(a.grantee) AS grantee,
              c.relname,
              a.privilege_type,
              a.is_grantable
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
         CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
        WHERE n.nspname='public'
          AND pg_get_userbyid(a.grantee) = ANY($1::text[])
        ORDER BY grantee, relname, privilege_type`,
      [PRINCIPALS],
    );

    const expected = new Set(
      PRINCIPALS.flatMap((principal) =>
        TABLES.map((table) => `${principal}|${table}|SELECT|false`),
      ),
    );
    const actual = new Set(
      direct.rows.map((row) =>
        `${row.grantee}|${row.relname}|${row.privilege_type}|${row.is_grantable}`,
      ),
    );

    if (actual.size !== expected.size) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_EFFECTIVE_SET_SIZE_MISMATCH");
    }
    for (const key of expected) {
      if (!actual.has(key)) {
        throw new Error(`PRODUCT_FORMAL_V5_ACL_EXPECTED_GRANT_MISSING:${key}`);
      }
    }

    console.log(JSON.stringify({
      schema_version: "geox_product_formal_v5_readonly_acl_verification_v1",
      status: "PASS",
      database_name: TARGET_DATABASE,
      principals: PRINCIPALS,
      direct_membership_between_product_principals: false,
      default_transaction_read_only: true,
      table_select_surface: TABLES,
      exact_direct_acl_count: expected.size,
      broader_table_privilege_count: 0,
      database_write: false,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
