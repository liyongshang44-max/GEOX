// Purpose: provision the bounded MCFT-CAP-08 runner in a dedicated fresh PostgreSQL database.
// Boundary: role and ACL normalization only; no business DDL, canonical facts, projection rows, Runtime execution, or shared commercial database mutation.
import { Pool } from "pg";

export const MCFT_CAP08_RUNNER_ROLE_V1 = "geox_mcft_cap08_runner_v1" as const;
export const MCFT_CAP08_DATABASE_NAME_PATTERN_V1 = /^geox_mcft_cap08_[a-z0-9_]+$/;
export const MCFT_CAP08_RELATION_PRIVILEGES_V1 = {
  facts: ["SELECT", "INSERT"],
  twin_fact_visibility_epoch_v1: ["SELECT"],
  twin_fact_visibility_index_v1: ["SELECT"],
  twin_object_idempotency_index_v1: ["SELECT", "INSERT"],
  twin_runtime_lease_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_runtime_authority_snapshot_v1: ["SELECT", "INSERT"],
  twin_active_lineage_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_state_history_projection_v1: ["SELECT", "INSERT"],
  twin_state_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_forecast_result_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_forecast_success_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_runtime_checkpoint_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_runtime_health_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_terminal_tick_uniqueness_v1: ["SELECT", "INSERT"],
  twin_scenario_set_uniqueness_v1: ["SELECT", "INSERT"],
  twin_forecast_run_projection_v1: ["SELECT", "INSERT"],
  twin_forecast_point_projection_v1: ["SELECT", "INSERT"],
  twin_scenario_set_projection_v1: ["SELECT", "INSERT"],
  twin_scenario_point_projection_v1: ["SELECT", "INSERT"],
  twin_scenario_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_decision_record_projection_v1: ["SELECT", "INSERT"],
  twin_action_feedback_projection_v1: ["SELECT", "INSERT"],
  twin_action_feedback_evidence_index_v1: ["SELECT", "INSERT"],
  twin_forecast_residual_projection_v1: ["SELECT", "INSERT"],
  twin_approved_plan_binding_projection_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_action_feedback_cycle_projection_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_calibration_candidate_projection_v1: ["SELECT", "INSERT"],
  twin_shadow_evaluation_projection_v1: ["SELECT", "INSERT"],
  twin_candidate_evaluation_index_v1: ["SELECT", "INSERT"],
  twin_shadow_evaluation_case_projection_v1: ["SELECT", "INSERT"],
} as const;

export type McftCap08BootstrapConfigV1 = {
  admin_database_url: string;
  runner_password: string;
  expected_database_name: string;
};

function required(value: string, code: string): string {
  if (!String(value || "").trim()) throw new Error(code);
  return value;
}

function identifier(value: string, code: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error(code);
  return `"${value.replaceAll('"', '""')}"`;
}

async function assertDedicatedAdmin(pool: Pool, expectedDatabaseName: string): Promise<void> {
  if (!MCFT_CAP08_DATABASE_NAME_PATTERN_V1.test(expectedDatabaseName)) throw new Error("MCFT_CAP08_DEDICATED_DATABASE_NAME_REQUIRED");
  const result = await pool.query(`
    SELECT current_database()::text AS database_name,
           session_user::text AS session_user,
           current_user::text AS current_user,
           r.rolsuper,
           r.rolcreaterole
      FROM pg_roles r
     WHERE r.rolname = current_user
  `);
  const row = result.rows[0];
  if (!row || row.database_name !== expectedDatabaseName) throw new Error("MCFT_CAP08_TARGET_DATABASE_MISMATCH");
  if (row.session_user !== row.current_user || row.session_user === MCFT_CAP08_RUNNER_ROLE_V1) throw new Error("MCFT_CAP08_BOOTSTRAP_ADMIN_REQUIRED");
  if (row.rolsuper !== true) throw new Error("MCFT_CAP08_BOOTSTRAP_SUPERUSER_REQUIRED");
}

async function assertPreexistingRoleIsSafe(pool: Pool): Promise<void> {
  const role = await pool.query(`SELECT oid,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1`, [MCFT_CAP08_RUNNER_ROLE_V1]);
  if (!role.rows.length) return;
  const oid = role.rows[0].oid;
  const membership = await pool.query(`SELECT count(*)::int AS n FROM pg_auth_members WHERE member=$1 OR roleid=$1`, [oid]);
  if (membership.rows[0].n !== 0) throw new Error("MCFT_CAP08_RUNNER_ROLE_MEMBERSHIP_PRESENT");
  const ownership = await pool.query(`
    SELECT (
      (SELECT count(*) FROM pg_database WHERE datdba=$1) +
      (SELECT count(*) FROM pg_namespace WHERE nspowner=$1) +
      (SELECT count(*) FROM pg_class WHERE relowner=$1) +
      (SELECT count(*) FROM pg_proc WHERE proowner=$1)
    )::int AS n
  `, [oid]);
  if (ownership.rows[0].n !== 0) throw new Error("MCFT_CAP08_RUNNER_OWNS_DATABASE_OBJECT");
}

async function assertRelations(pool: Pool): Promise<void> {
  const missing: string[] = [];
  for (const relation of Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1)) {
    const result = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [`public.${relation}`]);
    if (result.rows[0]?.present !== true) missing.push(relation);
  }
  if (missing.length) throw new Error(`MCFT_CAP08_REQUIRED_RELATION_MISSING:${missing.sort().join(",")}`);
}

async function normalizeDefaultAclV1(pool: Pool): Promise<void> {
  await pool.query(`
    DO $normalize$
    DECLARE
      item record;
      grantee_name text;
      scope_clause text;
      object_keyword text;
    BEGIN
      FOR item IN
        SELECT DISTINCT owner.rolname AS owner_name,
               defaults.defaclobjtype,
               namespace.nspname AS schema_name
          FROM pg_default_acl AS defaults
          JOIN pg_roles AS owner ON owner.oid = defaults.defaclrole
          LEFT JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
         WHERE defaults.defaclobjtype IN ('r','S','f')
           AND (defaults.defaclnamespace = 0 OR namespace.nspname = 'public')
      LOOP
        scope_clause := CASE
          WHEN item.schema_name IS NULL THEN ''
          ELSE pg_catalog.format(' IN SCHEMA %I', item.schema_name)
        END;
        object_keyword := CASE item.defaclobjtype
          WHEN 'r' THEN 'TABLES'
          WHEN 'S' THEN 'SEQUENCES'
          WHEN 'f' THEN 'FUNCTIONS'
        END;
        EXECUTE pg_catalog.format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL ON %s FROM PUBLIC',
          item.owner_name,
          scope_clause,
          object_keyword
        );
        FOR grantee_name IN
          SELECT role.rolname
            FROM pg_roles AS role
           WHERE role.rolname IN (
             '${MCFT_CAP08_RUNNER_ROLE_V1}',
             'geox_mcft_migrator_v1',
             'geox_runtime_v1'
           )
        LOOP
          EXECUTE pg_catalog.format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL ON %s FROM %I',
            item.owner_name,
            scope_clause,
            object_keyword,
            grantee_name
          );
        END LOOP;
      END LOOP;

      FOR item IN
        SELECT role.rolname AS owner_name
          FROM pg_roles AS role
         WHERE role.rolname IN (
           current_user::text,
           'geox_mcft_migration_owner_v1',
           'geox_mcft_migrator_v1',
           'geox_runtime_v1',
           '${MCFT_CAP08_RUNNER_ROLE_V1}'
         )
      LOOP
        EXECUTE pg_catalog.format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
          item.owner_name
        );
        FOR grantee_name IN
          SELECT role.rolname
            FROM pg_roles AS role
           WHERE role.rolname IN (
             '${MCFT_CAP08_RUNNER_ROLE_V1}',
             'geox_mcft_migrator_v1',
             'geox_runtime_v1'
           )
        LOOP
          EXECUTE pg_catalog.format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
            item.owner_name,
            grantee_name
          );
          EXECUTE pg_catalog.format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
            item.owner_name,
            grantee_name
          );
          EXECUTE pg_catalog.format(
            'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',
            item.owner_name,
            grantee_name
          );
        END LOOP;
      END LOOP;
    END
    $normalize$;
  `);
}

async function assertNoUnexpectedDefaultAcl(pool: Pool): Promise<void> {
  const result = await pool.query(`
    SELECT count(*)::int AS n
      FROM pg_default_acl d
      CROSS JOIN LATERAL aclexplode(COALESCE(d.defaclacl, acldefault(d.defaclobjtype, d.defaclrole))) a
      LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
     WHERE a.grantee=0 OR grantee.rolname=$1
  `, [MCFT_CAP08_RUNNER_ROLE_V1]);
  if (result.rows[0].n !== 0) throw new Error("MCFT_CAP08_UNEXPECTED_DEFAULT_ACL");
}

export async function runMcftCap08DatabasePlatformBootstrapV1(config: McftCap08BootstrapConfigV1) {
  const expectedDatabaseName = required(config.expected_database_name, "MCFT_CAP08_EXPECTED_DATABASE_NAME_REQUIRED");
  const pool = new Pool({ connectionString: required(config.admin_database_url, "MCFT_CAP08_ADMIN_URL_REQUIRED"), max: 1 });
  try {
    await assertDedicatedAdmin(pool, expectedDatabaseName);
    await assertRelations(pool);
    await assertPreexistingRoleIsSafe(pool);

    await pool.query(`DO $body$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${MCFT_CAP08_RUNNER_ROLE_V1}') THEN
          CREATE ROLE ${MCFT_CAP08_RUNNER_ROLE_V1};
        END IF;
      END
    $body$`);
    await pool.query(`ALTER ROLE ${MCFT_CAP08_RUNNER_ROLE_V1} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    await pool.query(`ALTER ROLE ${MCFT_CAP08_RUNNER_ROLE_V1} RESET ALL`);
    const passwordSql = await pool.query(`SELECT format('ALTER ROLE %I PASSWORD %L',$1::text,$2::text) AS sql`, [MCFT_CAP08_RUNNER_ROLE_V1, required(config.runner_password, "MCFT_CAP08_RUNNER_PASSWORD_REQUIRED")]);
    await pool.query(passwordSql.rows[0].sql);
    await normalizeDefaultAclV1(pool);

    const databaseIdentifier = identifier(expectedDatabaseName, "MCFT_CAP08_DATABASE_IDENTIFIER_INVALID");
    await pool.query(`REVOKE CONNECT, TEMP ON DATABASE ${databaseIdentifier} FROM PUBLIC`);
    await pool.query(`REVOKE CONNECT ON DATABASE ${databaseIdentifier} FROM geox_mcft_migrator_v1, geox_runtime_v1`);
    await pool.query(`GRANT CONNECT ON DATABASE ${databaseIdentifier} TO ${MCFT_CAP08_RUNNER_ROLE_V1}`);
    await pool.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    await pool.query(`REVOKE ALL ON SCHEMA public FROM geox_mcft_migrator_v1, geox_runtime_v1`);
    await pool.query(`REVOKE ALL ON SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${MCFT_CAP08_RUNNER_ROLE_V1}`);
    await pool.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}, geox_mcft_migrator_v1, geox_runtime_v1`);
    await pool.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}, geox_mcft_migrator_v1, geox_runtime_v1`);
    await pool.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}, geox_mcft_migrator_v1, geox_runtime_v1`);
    await pool.query(`REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC`);

    for (const [relation, privileges] of Object.entries(MCFT_CAP08_RELATION_PRIVILEGES_V1)) {
      await pool.query(`GRANT ${privileges.join(",")} ON TABLE public.${identifier(relation, "MCFT_CAP08_RELATION_IDENTIFIER_INVALID")} TO ${MCFT_CAP08_RUNNER_ROLE_V1}`);
    }

    await assertPreexistingRoleIsSafe(pool);
    await assertNoUnexpectedDefaultAcl(pool);
    return {
      status: "PASS" as const,
      role: MCFT_CAP08_RUNNER_ROLE_V1,
      target_database: expectedDatabaseName,
      relation_count: Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).length,
      public_database_connect: false,
      public_database_temp: false,
      public_function_execute: false,
      business_schema_ddl_performed: false,
      canonical_runtime_write_performed: false,
    };
  } finally {
    await pool.end();
  }
}
