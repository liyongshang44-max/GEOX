import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_ACL_V1_RESULT.json");
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");

const ROLE = "geox_mcft_cap09_evidence_runtime_v1";
const WRITER_OWNER = "geox_mcft_cap09_evidence_writer_owner_v1";
const SCOPE = {
  tenant_id: "aclTenant",
  project_id: "aclProject",
  group_id: "aclGroup",
  field_id: "aclField",
  season_id: "aclSeason",
  zone_id: "aclZone",
};

async function expectDenied(pool: Pool, sql: string, params: unknown[] = []): Promise<Error> {
  const client = await pool.connect();
  let caught: unknown = null;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE " + ROLE);
    await client.query(sql, params);
    await client.query("ROLLBACK");
  } catch (error) {
    caught = error;
    try { await client.query("ROLLBACK"); } catch {}
  } finally {
    client.release();
  }
  assert(caught instanceof Error, "ACL_EXPECTED_DENIAL:" + sql);
  assert.match(caught.message, /permission denied|must be owner|not allowed|PHASE3_EVIDENCE_DB_INGRESS/i);
  return caught;
}

async function withRole(pool: Pool, fn: (client: PoolClient) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE " + ROLE);
    await fn(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function externalEvidenceEnvelope(sourceRecordId: string) {
  return {
    type: "soil_moisture_observation_v1",
    payload: {
      tenant_id: SCOPE.tenant_id,
      project_id: SCOPE.project_id,
      group_id: SCOPE.group_id,
      field_id: SCOPE.field_id,
      season_id: SCOPE.season_id,
      zone_id: SCOPE.zone_id,
      record_type: "soil_moisture_observation_v1",
      binding_id: "kbs_lter_variate25_vwc_100mm_v1",
      source_record_id: sourceRecordId,
    },
  };
}

function twinCanonicalEnvelope() {
  return {
    type: "twin_state_estimate_v1",
    payload: {
      tenant_id: SCOPE.tenant_id,
      project_id: SCOPE.project_id,
      group_id: SCOPE.group_id,
      field_id: SCOPE.field_id,
      season_id: SCOPE.season_id,
      zone_id: SCOPE.zone_id,
      record_type: "twin_state_estimate_v1",
      binding_id: "forbidden_twin_binding",
    },
  };
}

async function callGovernedFactFunction(
  client: PoolClient,
  input: {
    lease_owner: string;
    fencing_token: number;
    fact_id: string;
    occurred_at: string;
    record_json: unknown;
  },
) {
  return client.query(
    `SELECT status,canonical_fact_write_count
       FROM public.mcft_cap09_evidence_runtime_append_fact_v1(
         $1,$2,$3,$4,$5,$6,$7,$8::bigint,$9,$10::timestamptz,$11::jsonb
       )`,
    [
      SCOPE.tenant_id,
      SCOPE.project_id,
      SCOPE.group_id,
      SCOPE.field_id,
      SCOPE.season_id,
      SCOPE.zone_id,
      input.lease_owner,
      input.fencing_token,
      input.fact_id,
      input.occurred_at,
      JSON.stringify(input.record_json),
    ],
  );
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, application_name: "mcft-cap09-phase3-evidence-acl-qualification" });
  try {
    const roles = await pool.query<{
      rolname: string;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolcanlogin: boolean;
    }>(
      `SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolcanlogin
         FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname`,
      [[ROLE, WRITER_OWNER]],
    );
    assert.equal(roles.rows.length, 2);
    for (const row of roles.rows) {
      assert.equal(row.rolsuper, false);
      assert.equal(row.rolcreatedb, false);
      assert.equal(row.rolcreaterole, false);
      assert.equal(row.rolreplication, false);
      assert.equal(row.rolcanlogin, false);
    }

    const proc = await pool.query<{
      prosecdef: boolean;
      owner_name: string;
      proconfig: string[] | null;
    }>(
      `SELECT p.prosecdef,
              r.rolname AS owner_name,
              p.proconfig
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid=p.pronamespace
         JOIN pg_roles r ON r.oid=p.proowner
        WHERE n.nspname='public'
          AND p.proname='mcft_cap09_evidence_runtime_append_fact_v1'`,
    );
    assert.equal(proc.rows.length, 1);
    assert.equal(proc.rows[0].prosecdef, true);
    assert.equal(proc.rows[0].owner_name, WRITER_OWNER);
    assert((proc.rows[0].proconfig ?? []).some((value) => value.replace(/\s/g, "") === "search_path=pg_catalog,public"));

    // Direct arbitrary facts INSERT is denied at the database boundary.
    await expectDenied(
      pool,
      "INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES ('forbidden-direct','2026-08-27T02:30:00Z','forbidden','{}'::jsonb)",
    );

    await withRole(pool, async (client) => {
      await client.query(
        `INSERT INTO public.external_evidence_producer_lease_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
         VALUES ($1,$2,$3,$4,$5,$6,'acl-owner-A',1,
                 transaction_timestamp(),transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
        Object.values(SCOPE),
      );

      const allowed = await callGovernedFactFunction(client, {
        lease_owner: "acl-owner-A",
        fencing_token: 1,
        fact_id: "phase3_acl_external_fact_1",
        occurred_at: "2026-08-27T02:30:00.000Z",
        record_json: externalEvidenceEnvelope("acl-source-1"),
      });
      assert.deepEqual(allowed.rows, [{ status: "INSERTED", canonical_fact_write_count: 1 }]);

      const visible = await client.query(
        "SELECT source,record_json FROM public.facts WHERE fact_id='phase3_acl_external_fact_1'",
      );
      assert.equal(visible.rows.length, 1);
      assert.equal(visible.rows[0].source, "mcft_cap09_external_formal_evidence_v1");

      await client.query(
        `INSERT INTO public.external_evidence_supply_event_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,event_time,
          source_record_id,fact_id,record_semantic_sha256,
          first_publication_available_at,last_publication_available_at,
          first_post_commit_db_readback_at,last_post_commit_db_readback_at,
          revision_count,publication_count,lease_owner,fencing_token)
         VALUES ($1,$2,$3,$4,$5,$6,
                 'acl-binding','acl-source','2026-08-27T02:30:00.000Z',
                 'acl-source-record','phase3_acl_external_fact_1',$7,
                 '2026-08-27T02:30:00.000Z','2026-08-27T02:30:00.000Z',
                 '2026-08-27T02:30:01.000Z','2026-08-27T02:30:01.000Z',
                 0,1,'acl-owner-A',1)`,
        [...Object.values(SCOPE), "sha256:" + "a".repeat(64)],
      );
      await client.query(
        `INSERT INTO public.external_evidence_supply_cursor_v1
         (tenant_id,project_id,group_id,field_id,season_id,zone_id,binding_id,origin_source_id,
          fact_id,record_semantic_sha256,available_to_runtime_at,publication_available_through,
          latest_event_time,latest_source_record_id,event_time_contiguous_from,event_time_contiguous_through,
          event_time_max_seen,event_gap_count,revision_count,publication_event_count,cadence_profile_id,
          role_time,post_commit_db_readback_at,lease_owner,fencing_token)
         VALUES ($1,$2,$3,$4,$5,$6,
                 'acl-binding','acl-source','phase3_acl_external_fact_1',$7,
                 '2026-08-27T02:30:00.000Z','2026-08-27T02:30:00.000Z',
                 '2026-08-27T02:30:00.000Z','acl-source-record',
                 '2026-08-27T02:30:00.000Z','2026-08-27T02:30:00.000Z',
                 '2026-08-27T02:30:00.000Z',0,0,1,'ACL_QUALIFICATION_PROFILE',
                 '{}'::jsonb,'2026-08-27T02:30:01.000Z','acl-owner-A',1)`,
        [...Object.values(SCOPE), "sha256:" + "a".repeat(64)],
      );
    });

    // Even the governed function cannot be used to manufacture a Twin canonical fact.
    const twinDenied = await expectDenied(
      pool,
      `SELECT * FROM public.mcft_cap09_evidence_runtime_append_fact_v1(
         $1,$2,$3,$4,$5,$6,'acl-owner-A',1,'forbidden-twin-fact',
         '2026-08-27T02:31:00.000Z'::timestamptz,$7::jsonb)`,
      [...Object.values(SCOPE), JSON.stringify(twinCanonicalEnvelope())],
    );
    assert.match(twinDenied.message, /RECORD_TYPE_NOT_AUTHORIZED/);

    // Simulate ownership takeover. Old token must fail before any canonical fact is inserted.
    await pool.query(
      `UPDATE public.external_evidence_producer_lease_v1
          SET lease_owner='acl-owner-B',
              fencing_token=2,
              acquired_at=transaction_timestamp(),
              expires_at=transaction_timestamp()+interval '5 minutes',
              heartbeat_at=transaction_timestamp()
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
          AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      Object.values(SCOPE),
    );

    const staleDenied = await expectDenied(
      pool,
      `SELECT * FROM public.mcft_cap09_evidence_runtime_append_fact_v1(
         $1,$2,$3,$4,$5,$6,'acl-owner-A',1,'stale-owner-fact',
         '2026-08-27T02:32:00.000Z'::timestamptz,$7::jsonb)`,
      [...Object.values(SCOPE), JSON.stringify(externalEvidenceEnvelope("stale-source"))],
    );
    assert.match(staleDenied.message, /STALE_FENCE/);
    const staleFact = await pool.query("SELECT 1 FROM public.facts WHERE fact_id='stale-owner-fact'");
    assert.equal(staleFact.rows.length, 0);

    await withRole(pool, async (client) => {
      const current = await callGovernedFactFunction(client, {
        lease_owner: "acl-owner-B",
        fencing_token: 2,
        fact_id: "phase3_acl_external_fact_2",
        occurred_at: "2026-08-27T02:33:00.000Z",
        record_json: externalEvidenceEnvelope("acl-source-2"),
      });
      assert.deepEqual(current.rows, [{ status: "INSERTED", canonical_fact_write_count: 1 }]);
    });

    await expectDenied(pool, "UPDATE public.facts SET source='mutated' WHERE fact_id='phase3_acl_external_fact_1'");
    await expectDenied(pool, "DELETE FROM public.facts WHERE fact_id='phase3_acl_external_fact_1'");
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
        WHERE grantee=$1
        ORDER BY table_name, privilege_type`,
      [ROLE],
    );
    const actual = grants.rows.map((row) => row.table_name + ":" + row.privilege_type);
    assert.deepEqual(actual, [
      "external_evidence_producer_lease_v1:INSERT",
      "external_evidence_producer_lease_v1:SELECT",
      "external_evidence_producer_lease_v1:UPDATE",
      "external_evidence_supply_cursor_v1:INSERT",
      "external_evidence_supply_cursor_v1:SELECT",
      "external_evidence_supply_cursor_v1:UPDATE",
      "external_evidence_supply_event_v1:INSERT",
      "external_evidence_supply_event_v1:SELECT",
      "external_evidence_supply_event_v1:UPDATE",
      "facts:SELECT",
    ]);

    const routineGrant = await pool.query<{ privilege_type: string }>(
      `SELECT privilege_type
         FROM information_schema.role_routine_grants
        WHERE grantee=$1
          AND routine_schema='public'
          AND routine_name='mcft_cap09_evidence_runtime_append_fact_v1'`,
      [ROLE],
    );
    assert.deepEqual(routineGrant.rows.map((row) => row.privilege_type), ["EXECUTE"]);

    const proof = {
      schema_version: "geox_mcft_cap09_phase3_evidence_runtime_acl_qualification_v2",
      status: "PASS",
      arbitrary_facts_insert_denied: true,
      governed_external_evidence_function_execute_allowed: true,
      twin_canonical_fact_through_function_denied: true,
      stale_owner_rejected_before_fact_insert: true,
      stale_owner_fact_count: 0,
      current_owner_external_evidence_insert_allowed: true,
      security_definer_owner_no_login: true,
      security_definer_fixed_search_path: true,
      exact_table_grants: actual,
      facts_insert_table_grant: false,
      runtime_tick_cursor_mutation: false,
      twin_state_mutation: false,
      production_cadence_activation: false,
      formal_v5_armed: false,
      graduation_effect: false,
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
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
