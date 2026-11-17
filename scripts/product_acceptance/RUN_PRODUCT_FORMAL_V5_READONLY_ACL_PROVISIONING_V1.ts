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

function quotedIdentifier(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}

async function main(): Promise<void> {
  if (!process.argv.includes("--operator-authorized")) {
    throw new Error("PRODUCT_FORMAL_V5_ACL_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
  }

  const pool = new Pool({
    connectionString: requiredEnv("GEOX_PRODUCT_FORMAL_V5_ADMIN_DATABASE_URL"),
    max: 1,
  });

  try {
    const db = await pool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (db.rows[0]?.database_name !== TARGET_DATABASE) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_WRONG_DATABASE");
    }

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema='public'
          AND table_type='BASE TABLE'
          AND table_name = ANY($1::text[])
        ORDER BY table_name`,
      [TABLES],
    );
    if (tables.rows.length !== TABLES.length) {
      throw new Error("PRODUCT_FORMAL_V5_ACL_TARGET_TABLE_SET_INCOMPLETE");
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

    await pool.query("BEGIN");
    try {
      for (const principal of PRINCIPALS) {
        for (const table of TABLES) {
          await pool.query(
            `GRANT SELECT ON TABLE public.${quotedIdentifier(table)}
               TO ${quotedIdentifier(principal)}`,
          );
        }
      }
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK").catch(() => undefined);
      throw error;
    }

    console.log(JSON.stringify({
      schema_version: "geox_product_formal_v5_readonly_acl_provisioning_v1",
      status: "PASS",
      database_name: TARGET_DATABASE,
      principals: PRINCIPALS,
      table_select_surface: TABLES,
      grant_option: false,
      role_creation: false,
      role_membership_change: false,
      schema_change: false,
      default_privilege_change: false,
      revoke_operation: false,
      a0_execution: false,
      o00_execution: false,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
