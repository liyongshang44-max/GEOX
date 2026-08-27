import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool, type PoolClient } from "pg";

const ROLE = "geox_mcft_cap09_twin_runtime_v1";
const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE4_TWIN_RUNTIME_ACL_V1_RESULT.json",
);

const POSITIVE_TABLE_PRIVILEGES: Record<string, readonly string[]> = {
  facts: ["SELECT", "INSERT"],
  twin_runtime_lease_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_shadow_online_scheduler_cursor_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_shadow_online_scheduler_slot_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_object_idempotency_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_active_lineage_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_state_history_projection_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_state_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_forecast_result_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_forecast_success_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_runtime_checkpoint_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_runtime_health_latest_index_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_runtime_authority_snapshot_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_terminal_tick_uniqueness_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_scenario_set_uniqueness_v1: ["SELECT", "INSERT", "UPDATE"],
  twin_forecast_run_projection_v1: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  twin_forecast_point_projection_v1: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  twin_scenario_set_projection_v1: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  twin_scenario_point_projection_v1: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  twin_scenario_latest_index_v1: ["SELECT", "INSERT", "UPDATE", "DELETE"],
};

const FORBIDDEN_CONTROL_PLANE_TABLES = [
  "external_evidence_producer_lease_v1",
  "external_evidence_supply_event_v1",
  "external_evidence_supply_cursor_v1",
  "twin_external_formal_forcing_base_cursor_v1",
  "twin_external_formal_forcing_base_target_v1",
  "twin_external_formal_forcing_controller_lease_v1",
] as const;

async function tablePrivilege(
  pool: Pool,
  table: string,
  privilege: string,
): Promise<boolean> {
  const result = await pool.query<{ allowed: boolean }>(
    "SELECT pg_catalog.has_table_privilege($1,$2,$3) AS allowed",
    [ROLE, `public.${table}`, privilege],
  );
  return result.rows[0]?.allowed === true;
}

async function expectPermissionDenied(
  client: PoolClient,
  label: string,
  sql: string,
): Promise<void> {
  const savepoint = `sp_${label.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let denied = false;
  try {
    await client.query(sql);
  } catch (error) {
    const pg = error as { code?: string };
    denied = pg.code === "42501";
  }
  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  assert.equal(denied, true, `DATABASE_PERMISSION_DENIAL_REQUIRED:${label}`);
}

async function main(): Promise<void> {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  assert(databaseUrl, "PHASE4_ACL_DATABASE_URL_REQUIRED");

  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const role = await pool.query<{
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolbypassrls
         FROM pg_catalog.pg_roles WHERE rolname=$1`,
      [ROLE],
    );
    assert.equal(role.rows.length, 1, "PHASE4_TWIN_RUNTIME_ROLE_REQUIRED");
    assert.deepEqual(role.rows[0], {
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolinherit: false,
      rolbypassrls: false,
    });

    const schema = await pool.query<{ usage: boolean; create: boolean }>(
      `SELECT
         pg_catalog.has_schema_privilege($1,'public','USAGE') AS usage,
         pg_catalog.has_schema_privilege($1,'public','CREATE') AS create`,
      [ROLE],
    );
    assert.equal(schema.rows[0]?.usage, true);
    assert.equal(schema.rows[0]?.create, false);

    for (const [table, privileges] of Object.entries(POSITIVE_TABLE_PRIVILEGES)) {
      const exists = await pool.query<{ relation: string | null }>(
        "SELECT pg_catalog.to_regclass($1)::text AS relation",
        [`public.${table}`],
      );
      assert(exists.rows[0]?.relation, `PHASE4_REQUIRED_RUNTIME_TABLE_MISSING:${table}`);
      for (const privilege of privileges) {
        assert.equal(
          await tablePrivilege(pool, table, privilege),
          true,
          `PHASE4_REQUIRED_PRIVILEGE_MISSING:${table}:${privilege}`,
        );
      }
    }

    assert.equal(await tablePrivilege(pool, "facts", "UPDATE"), false);
    assert.equal(await tablePrivilege(pool, "facts", "DELETE"), false);
    assert.equal(await tablePrivilege(pool, "facts", "TRUNCATE"), false);

    for (const table of FORBIDDEN_CONTROL_PLANE_TABLES) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        assert.equal(
          await tablePrivilege(pool, table, privilege),
          false,
          `PHASE4_EVIDENCE_PLANE_PRIVILEGE_FORBIDDEN:${table}:${privilege}`,
        );
      }
    }

    for (const table of ["approvals", "actions"]) {
      const exists = await pool.query<{ relation: string | null }>(
        "SELECT pg_catalog.to_regclass($1)::text AS relation",
        [`public.${table}`],
      );
      if (!exists.rows[0]?.relation) continue;
      for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
        assert.equal(
          await tablePrivilege(pool, table, privilege),
          false,
          `PHASE4_ACTION_PLANE_WRITE_FORBIDDEN:${table}:${privilege}`,
        );
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL ROLE ${ROLE}`);

      await client.query("SELECT fact_id FROM public.facts LIMIT 1");
      await client.query(
        `INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
         VALUES ('phase4_acl_probe_fact','2026-08-27T00:00:00.000Z','phase4_acl_probe',
                 '{"type":"phase4_acl_probe","payload":{"probe":true}}'::jsonb)`,
      );

      await client.query(
        `INSERT INTO public.twin_runtime_lease_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,
          lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
         VALUES ('phase4_acl','project','group','field','season','zone',
                 'phase4_acl_probe',1,transaction_timestamp(),
                 transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
      );
      await client.query(
        `INSERT INTO public.twin_shadow_online_scheduler_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,
          schedule_start_logical_time,next_slot_index,next_slot_id,next_logical_time)
         VALUES ('phase4_acl','project','group','field','season','zone',
                 '2026-08-27T00:00:00.000Z',0,'O00','2026-08-27T00:00:00.000Z')`,
      );

      await expectPermissionDenied(
        client,
        "facts_update",
        "UPDATE public.facts SET source=source WHERE false",
      );
      await expectPermissionDenied(
        client,
        "facts_delete",
        "DELETE FROM public.facts WHERE false",
      );
      await expectPermissionDenied(
        client,
        "evidence_lease_select",
        "SELECT * FROM public.external_evidence_producer_lease_v1 LIMIT 1",
      );
      await expectPermissionDenied(
        client,
        "evidence_lease_update",
        "UPDATE public.external_evidence_producer_lease_v1 SET lease_owner=lease_owner WHERE false",
      );
      await expectPermissionDenied(
        client,
        "legacy_forcing_target_select",
        "SELECT * FROM public.twin_external_formal_forcing_base_target_v1 LIMIT 1",
      );
      await expectPermissionDenied(
        client,
        "legacy_forcing_cursor_update",
        "UPDATE public.twin_external_formal_forcing_base_cursor_v1 SET completed=completed WHERE false",
      );
      await expectPermissionDenied(
        client,
        "legacy_forcing_controller_lease_select",
        "SELECT * FROM public.twin_external_formal_forcing_controller_lease_v1 LIMIT 1",
      );
      await expectPermissionDenied(
        client,
        "evidence_cursor_insert",
        `INSERT INTO public.external_evidence_supply_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,
          fact_id,record_semantic_sha256,available_to_runtime_at,publication_available_through,
          latest_event_time,latest_source_record_id,event_time_contiguous_from,
          event_time_contiguous_through,event_time_max_seen,cadence_profile_id,role_time,
          post_commit_db_readback_at,lease_owner,fencing_token)
         VALUES ('x','x','x','x','x','x','x','x','x','x',transaction_timestamp(),
                 transaction_timestamp(),transaction_timestamp(),'x',transaction_timestamp(),
                 transaction_timestamp(),transaction_timestamp(),'x','{}'::jsonb,
                 transaction_timestamp(),'x',1)`,
      );

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    const proof = {
      schema_version: "geox_mcft_cap09_phase4_twin_runtime_acl_qualification_v1",
      status: "PASS",
      role: ROLE,
      role_login: false,
      public_schema_create: false,
      governed_evidence_read_path: "public.facts",
      facts_select_insert_only: true,
      runtime_scheduler_cursor_lease_write_authorized: true,
      canonical_twin_forecast_scenario_write_authorized: true,
      evidence_plane_direct_access_denied: true,
      evidence_supply_cursor_mutation_denied: true,
      evidence_producer_lease_mutation_denied: true,
      legacy_forcing_controller_authority_denied: true,
      facts_update_delete_denied: true,
      action_plane_write_denied_when_present: true,
      production_container_activation: false,
      provider_request: false,
      formal_v5_armed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await pool.end();
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
