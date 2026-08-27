import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_ACL_V1_RESULT.json");
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");

async function expectDenied(pool: Pool, sql: string, params: unknown[] = []): Promise<void> {
  const client = await pool.connect();
  let caught: unknown = null;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE geox_mcft_cap09_evidence_runtime_v1");
    await client.query(sql, params);
    await client.query("ROLLBACK");
  } catch (error) {
    caught = error;
    try { await client.query("ROLLBACK"); } catch {}
  } finally {
    client.release();
  }
  assert(caught instanceof Error, `ACL_EXPECTED_DENIAL:${sql}`);
  assert.match(caught.message, /permission denied|must be owner|not allowed/i);
}

async function withRole(pool: Pool, fn: (client: import("pg").PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE geox_mcft_cap09_evidence_runtime_v1");
    await fn(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, application_name: "mcft-cap09-phase3-evidence-acl-qualification" });
  try {
    const role = await pool.query<{
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolcanlogin: boolean;
    }>(
      `SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolcanlogin
         FROM pg_roles WHERE rolname='geox_mcft_cap09_evidence_runtime_v1'`,
    );
    assert.equal(role.rows.length, 1);
    assert.deepEqual(role.rows[0], {
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolcanlogin: false,
    });

    await withRole(pool, async (client) => {
      await client.query(
        "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
        ["phase3_acl_fact_1", "2026-08-27T02:30:00.000Z", "phase3_acl_qualification", JSON.stringify({ type: "acl_fixture", payload: { ok: true } })],
      );
      const fact = await client.query("SELECT fact_id FROM public.facts WHERE fact_id=$1", ["phase3_acl_fact_1"]);
      assert.equal(fact.rows.length, 1);

      await client.query(
        `INSERT INTO public.external_evidence_producer_lease_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
         VALUES ('aclTenant','aclProject','aclGroup','aclField','aclSeason','aclZone','acl-owner',1,
                 transaction_timestamp(),transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
      );
      const updatedLease = await client.query(
        `UPDATE public.external_evidence_producer_lease_v1
            SET heartbeat_at=transaction_timestamp()
          WHERE tenant_id='aclTenant' AND project_id='aclProject' AND group_id='aclGroup'
            AND field_id='aclField' AND season_id='aclSeason' AND zone_id='aclZone'`,
      );
      assert.equal(updatedLease.rowCount, 1);

      await client.query(
        `INSERT INTO public.external_evidence_supply_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,
          fact_id,record_semantic_sha256,available_to_runtime_at,role_time,post_commit_db_readback_at,
          lease_owner,fencing_token)
         VALUES ('aclTenant','aclProject','aclGroup','aclField','aclSeason','aclZone',
                 'acl-binding','acl-source','phase3_acl_fact_1',
                 'sha256:${"a".repeat(64)}','2026-08-27T02:30:00.000Z','{}'::jsonb,
                 '2026-08-27T02:30:01.000Z','acl-owner',1)`,
      );
      const cursor = await client.query("SELECT fact_id FROM public.external_evidence_supply_cursor_v1 WHERE binding_id='acl-binding'");
      assert.equal(cursor.rows.length, 1);
    });

    await expectDenied(pool, "UPDATE public.facts SET source='mutated' WHERE fact_id='phase3_acl_fact_1'");
    await expectDenied(pool, "DELETE FROM public.facts WHERE fact_id='phase3_acl_fact_1'");
    await expectDenied(pool, "SELECT * FROM public.twin_runtime_lease_v1");
    await expectDenied(pool, "INSERT INTO public.twin_runtime_lease_v1(id) VALUES (1)");
    await expectDenied(pool, "UPDATE public.twin_runtime_checkpoint_latest_index_v1 SET value='x' WHERE id=1");
    await expectDenied(pool, "INSERT INTO public.twin_shadow_online_scheduler_cursor_v1(id) VALUES (1)");
    await expectDenied(pool, "INSERT INTO public.approvals(id) VALUES (1)");
    await expectDenied(pool, "INSERT INTO public.actions(id) VALUES (1)");
    await expectDenied(pool, "CREATE TABLE public.phase3_acl_escape(id integer)");
    await expectDenied(pool, "CREATE FUNCTION public.phase3_acl_escape_fn() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$");

    const grants = await pool.query<{ table_name: string; privilege_type: string }>(
      `SELECT table_name, privilege_type
         FROM information_schema.role_table_grants
        WHERE grantee='geox_mcft_cap09_evidence_runtime_v1'
        ORDER BY table_name, privilege_type`,
    );
    const actual = grants.rows.map((row) => `${row.table_name}:${row.privilege_type}`);
    assert.deepEqual(actual, [
      "external_evidence_producer_lease_v1:INSERT",
      "external_evidence_producer_lease_v1:SELECT",
      "external_evidence_producer_lease_v1:UPDATE",
      "external_evidence_supply_cursor_v1:INSERT",
      "external_evidence_supply_cursor_v1:SELECT",
      "external_evidence_supply_cursor_v1:UPDATE",
      "facts:INSERT",
      "facts:SELECT",
    ]);

    const proof = {
      schema_version: "geox_mcft_cap09_phase3_evidence_runtime_acl_qualification_v1",
      status: "PASS",
      allowed: {
        facts_select: true,
        facts_insert: true,
        evidence_producer_lease_select_insert_update: true,
        evidence_supply_cursor_select_insert_update: true,
      },
      denied: {
        facts_update: true,
        facts_delete: true,
        twin_runtime_lease: true,
        twin_checkpoint: true,
        twin_scheduler_cursor: true,
        approvals: true,
        actions: true,
        schema_ddl: true,
        function_ddl: true,
      },
      exact_table_grants: actual,
      dedicated_role_no_login: true,
      dedicated_role_not_superuser: true,
      runtime_tick_cursor_mutation: false,
      twin_state_mutation: false,
      production_cadence_activation: false,
      formal_v5_armed: false,
      graduation_effect: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(proof, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(proof)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
