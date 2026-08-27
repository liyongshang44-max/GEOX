import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_SERVICE_IDENTITIES_V1_RESULT.json",
);

const EVIDENCE_LOGIN = "geox_mcft_cap09_evidence_service_v1";
const TWIN_LOGIN = "geox_mcft_cap09_twin_service_v1";
const EVIDENCE_PRIVILEGE = "geox_mcft_cap09_evidence_runtime_v1";
const TWIN_PRIVILEGE = "geox_mcft_cap09_twin_runtime_v1";

async function currentUserV1(pool: Pool): Promise<string> {
  const result = await pool.query<{ current_user: string }>(
    "SELECT current_user::text AS current_user",
  );
  return result.rows[0]?.current_user ?? "";
}

async function tablePrivilegeV1(
  pool: Pool,
  table: string,
  privilege: string,
): Promise<boolean> {
  const result = await pool.query<{ allowed: boolean }>(
    "SELECT pg_catalog.has_table_privilege(current_user,$1,$2) AS allowed",
    ["public." + table, privilege],
  );
  return result.rows[0]?.allowed === true;
}

async function expectDeniedV1(
  client: PoolClient,
  label: string,
  sql: string,
): Promise<void> {
  await client.query("SAVEPOINT " + label);
  let denied = false;
  try {
    await client.query(sql);
  } catch (error) {
    denied = (error as { code?: string }).code === "42501";
  }
  await client.query("ROLLBACK TO SAVEPOINT " + label);
  assert.equal(denied, true, "PHASE5_DATABASE_DENIAL_REQUIRED:" + label);
}

async function assertSetRoleDeniedV1(
  pool: Pool,
  role: string,
  label: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await expectDeniedV1(client, label, "SET LOCAL ROLE " + role);
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const adminUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  const evidenceUrl = String(process.env.GEOX_MCFT_CAP09_EVIDENCE_DATABASE_URL || "").trim();
  const twinUrl = String(process.env.GEOX_MCFT_CAP09_TWIN_DATABASE_URL || "").trim();
  assert(adminUrl, "PHASE5_ADMIN_DATABASE_URL_REQUIRED");
  assert(evidenceUrl, "PHASE5_EVIDENCE_DATABASE_URL_REQUIRED");
  assert(twinUrl, "PHASE5_TWIN_DATABASE_URL_REQUIRED");
  assert.notEqual(evidenceUrl, twinUrl, "PHASE5_SERVICE_DATABASE_URL_REUSE_FORBIDDEN");

  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  const evidence = new Pool({ connectionString: evidenceUrl, max: 2 });
  const twin = new Pool({ connectionString: twinUrl, max: 2 });

  try {
    assert.equal(await currentUserV1(evidence), EVIDENCE_LOGIN);
    assert.equal(await currentUserV1(twin), TWIN_LOGIN);

    const roleRows = await admin.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolinherit: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolbypassrls: boolean;
    }>(
      "SELECT rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolbypassrls " +
      "FROM pg_catalog.pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname",
      [[EVIDENCE_LOGIN, TWIN_LOGIN]],
    );
    assert.equal(roleRows.rows.length, 2);
    for (const row of roleRows.rows) {
      assert.equal(row.rolcanlogin, true);
      assert.equal(row.rolinherit, true);
      assert.equal(row.rolsuper, false);
      assert.equal(row.rolcreatedb, false);
      assert.equal(row.rolcreaterole, false);
      assert.equal(row.rolbypassrls, false);
    }

    const memberships = await admin.query<{
      evidence_has_evidence: boolean;
      evidence_has_twin: boolean;
      evidence_has_generic: boolean;
      twin_has_twin: boolean;
      twin_has_evidence: boolean;
      twin_has_generic: boolean;
    }>(
      "SELECT " +
      "pg_catalog.pg_has_role($1,$2,'MEMBER') AS evidence_has_evidence," +
      "pg_catalog.pg_has_role($1,$3,'MEMBER') AS evidence_has_twin," +
      "pg_catalog.pg_has_role($1,'geox_runtime_v1','MEMBER') AS evidence_has_generic," +
      "pg_catalog.pg_has_role($4,$3,'MEMBER') AS twin_has_twin," +
      "pg_catalog.pg_has_role($4,$2,'MEMBER') AS twin_has_evidence," +
      "pg_catalog.pg_has_role($4,'geox_runtime_v1','MEMBER') AS twin_has_generic",
      [EVIDENCE_LOGIN, EVIDENCE_PRIVILEGE, TWIN_PRIVILEGE, TWIN_LOGIN],
    );
    assert.deepEqual(memberships.rows[0], {
      evidence_has_evidence: true,
      evidence_has_twin: false,
      evidence_has_generic: false,
      twin_has_twin: true,
      twin_has_evidence: false,
      twin_has_generic: false,
    });

    const direct = await admin.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.role_table_grants " +
      "WHERE grantee=ANY($1::text[])",
      [[EVIDENCE_LOGIN, TWIN_LOGIN]],
    );
    assert.equal(direct.rows[0]?.n, 0);

    assert.equal(await tablePrivilegeV1(evidence, "facts", "SELECT"), true);
    assert.equal(await tablePrivilegeV1(evidence, "facts", "INSERT"), false);
    for (const table of [
      "external_evidence_producer_lease_v1",
      "external_evidence_supply_event_v1",
      "external_evidence_supply_cursor_v1",
    ]) {
      assert.equal(await tablePrivilegeV1(evidence, table, "SELECT"), true);
      assert.equal(await tablePrivilegeV1(evidence, table, "INSERT"), true);
      assert.equal(await tablePrivilegeV1(evidence, table, "UPDATE"), true);
      assert.equal(await tablePrivilegeV1(twin, table, "SELECT"), false);
      assert.equal(await tablePrivilegeV1(twin, table, "INSERT"), false);
      assert.equal(await tablePrivilegeV1(twin, table, "UPDATE"), false);
    }
    assert.equal(await tablePrivilegeV1(evidence, "twin_runtime_lease_v1", "SELECT"), false);
    assert.equal(await tablePrivilegeV1(evidence, "twin_runtime_lease_v1", "INSERT"), false);

    assert.equal(await tablePrivilegeV1(twin, "facts", "SELECT"), true);
    assert.equal(await tablePrivilegeV1(twin, "facts", "INSERT"), true);
    assert.equal(await tablePrivilegeV1(twin, "facts", "UPDATE"), false);
    assert.equal(await tablePrivilegeV1(twin, "facts", "DELETE"), false);
    for (const table of [
      "twin_runtime_lease_v1",
      "twin_shadow_online_scheduler_cursor_v1",
      "twin_shadow_online_scheduler_slot_v1",
    ]) {
      assert.equal(await tablePrivilegeV1(twin, table, "SELECT"), true);
      assert.equal(await tablePrivilegeV1(twin, table, "INSERT"), true);
      assert.equal(await tablePrivilegeV1(twin, table, "UPDATE"), true);
    }

    const evidenceClient = await evidence.connect();
    try {
      await evidenceClient.query("BEGIN");
      await expectDeniedV1(
        evidenceClient,
        "evidence_facts_insert",
        "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) " +
        "VALUES('phase5_forbidden_evidence_fact',transaction_timestamp(),'forbidden','{}'::jsonb)",
      );
      await expectDeniedV1(
        evidenceClient,
        "evidence_twin_lease",
        "SELECT * FROM public.twin_runtime_lease_v1 LIMIT 1",
      );
      await evidenceClient.query(
        "INSERT INTO public.external_evidence_producer_lease_v1 " +
        "(tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token," +
        "acquired_at,expires_at,heartbeat_at) VALUES " +
        "('phase5','project','group','field','season','zone','evidence-service',1," +
        "transaction_timestamp(),transaction_timestamp()+interval '5 minutes',transaction_timestamp())",
      );
      await evidenceClient.query("ROLLBACK");
    } finally {
      evidenceClient.release();
    }

    const twinClient = await twin.connect();
    try {
      await twinClient.query("BEGIN");
      await expectDeniedV1(
        twinClient,
        "twin_evidence_cursor",
        "SELECT * FROM public.external_evidence_supply_cursor_v1 LIMIT 1",
      );
      await expectDeniedV1(
        twinClient,
        "twin_facts_update",
        "UPDATE public.facts SET source=source WHERE false",
      );
      await twinClient.query(
        "INSERT INTO public.twin_runtime_lease_v1 " +
        "(tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token," +
        "acquired_at,expires_at,heartbeat_at) VALUES " +
        "('phase5','project','group','field','season','zone','twin-service',1," +
        "transaction_timestamp(),transaction_timestamp()+interval '5 minutes',transaction_timestamp())",
      );
      await twinClient.query("ROLLBACK");
    } finally {
      twinClient.release();
    }

    await assertSetRoleDeniedV1(evidence, "geox_runtime_v1", "evidence_generic_runtime");
    await assertSetRoleDeniedV1(twin, "geox_runtime_v1", "twin_generic_runtime");
    await assertSetRoleDeniedV1(evidence, TWIN_PRIVILEGE, "evidence_cross_plane");
    await assertSetRoleDeniedV1(twin, EVIDENCE_PRIVILEGE, "twin_cross_plane");

    const proof = {
      schema_version: "geox_mcft_cap09_phase5_service_identities_qualification_v1",
      status: "PASS",
      evidence_login_role: EVIDENCE_LOGIN,
      twin_login_role: TWIN_LOGIN,
      distinct_login_credentials: true,
      direct_table_privilege_count: 0,
      evidence_inherits_only_evidence_plane: true,
      twin_inherits_only_twin_plane: true,
      generic_runtime_membership: false,
      cross_plane_membership: false,
      evidence_direct_fact_insert_denied: true,
      twin_evidence_cursor_access_denied: true,
      twin_fact_update_delete_denied: true,
      evidence_twin_runtime_lease_denied: true,
      set_generic_runtime_role_denied: true,
      set_cross_plane_role_denied: true,
      production_activation: false,
      phase6_cutover: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await Promise.allSettled([admin.end(), evidence.end(), twin.end()]);
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
    }, null, 2) + "\n",
  );
  console.error(error);
  process.exitCode = 1;
});
