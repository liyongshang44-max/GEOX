import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Pool, type PoolClient } from "pg";

import {
  assertMcftCap09ServicePrincipalV1,
  bootstrapMcftCap09Phase5ServicePrincipalsV1,
  MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
  MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
  MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
  MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
} from "../../apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_SERVICE_PRINCIPALS_V1_RESULT.json",
);

const ADMIN_URL = String(process.env.DATABASE_URL ?? "").trim();
const DATABASE_NAME = String(
  process.env.MCFT_CAP_09_PHASE5_DATABASE_NAME ?? "mcft_cap09_phase5_acceptance",
).trim();
const EVIDENCE_PASSWORD = "phase5-evidence-password";
const TWIN_PASSWORD = "phase5-twin-password";

function urlForRole(role: string, password: string): string {
  const url = new URL(ADMIN_URL);
  url.username = role;
  url.password = password;
  return url.toString();
}

async function permissionDeniedV1(
  client: PoolClient,
  sql: string,
  params: readonly unknown[] = [],
): Promise<void> {
  await client.query("SAVEPOINT phase5_permission_probe");
  let code = "";
  try {
    await client.query(sql, [...params]);
  } catch (error) {
    code = String((error as { code?: unknown }).code ?? "");
  }
  await client.query("ROLLBACK TO SAVEPOINT phase5_permission_probe");
  assert.equal(code, "42501", `PHASE5_PERMISSION_DENIAL_REQUIRED:${sql}`);
}

async function ownershipCountV1(pool: Pool, role: string): Promise<number> {
  const result = await pool.query<{ n: number }>(
    `SELECT (
       (SELECT count(*) FROM pg_catalog.pg_database d JOIN pg_catalog.pg_roles r ON r.oid=d.datdba WHERE r.rolname=$1) +
       (SELECT count(*) FROM pg_catalog.pg_namespace n JOIN pg_catalog.pg_roles r ON r.oid=n.nspowner WHERE r.rolname=$1) +
       (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid=c.relowner WHERE r.rolname=$1) +
       (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE r.rolname=$1)
     )::int AS n`,
    [role],
  );
  return result.rows[0]?.n ?? -1;
}

async function membershipV1(pool: Pool, role: string): Promise<string[]> {
  const result = await pool.query<{ granted_role: string }>(
    `SELECT granted.rolname AS granted_role
       FROM pg_catalog.pg_auth_members m
       JOIN pg_catalog.pg_roles member ON member.oid=m.member
       JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
      WHERE member.rolname=$1
      ORDER BY granted.rolname`,
    [role],
  );
  return result.rows.map((row) => row.granted_role);
}

async function main(): Promise<void> {
  assert(ADMIN_URL, "PHASE5_SERVICE_PRINCIPALS_DATABASE_URL_REQUIRED");
  assert(/^[a-z_][a-z0-9_]*$/.test(DATABASE_NAME));

  const admin = new Pool({ connectionString: ADMIN_URL, max: 2 });
  try {
    const bootstrapped = await bootstrapMcftCap09Phase5ServicePrincipalsV1({
      admin_database_url: ADMIN_URL,
      expected_database_name: DATABASE_NAME,
      evidence_runtime_password: EVIDENCE_PASSWORD,
      twin_runtime_password: TWIN_PASSWORD,
    });
    assert.equal(bootstrapped.status, "PASS");

    assert.deepEqual(
      await membershipV1(admin, MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1),
      [MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1],
    );
    assert.deepEqual(
      await membershipV1(admin, MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1),
      [MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1],
    );
    assert.equal(
      await ownershipCountV1(admin, MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1),
      0,
    );
    assert.equal(
      await ownershipCountV1(admin, MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1),
      0,
    );

    const evidencePool = new Pool({
      connectionString: urlForRole(
        MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
        EVIDENCE_PASSWORD,
      ),
      max: 1,
    });
    const twinPool = new Pool({
      connectionString: urlForRole(
        MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
        TWIN_PASSWORD,
      ),
      max: 1,
    });

    try {
      await assertMcftCap09ServicePrincipalV1(evidencePool, "EVIDENCE_RUNTIME");
      await assertMcftCap09ServicePrincipalV1(twinPool, "TWIN_RUNTIME");

      const evidenceIdentity = await evidencePool.query<{
        user_name: string;
        evidence_role: boolean;
        twin_role: boolean;
      }>(
        `SELECT current_user::text AS user_name,
                pg_catalog.pg_has_role(current_user,$1,'USAGE') AS evidence_role,
                pg_catalog.pg_has_role(current_user,$2,'USAGE') AS twin_role`,
        [
          MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
          MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
        ],
      );
      assert.deepEqual(evidenceIdentity.rows[0], {
        user_name: MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
        evidence_role: true,
        twin_role: false,
      });

      const twinIdentity = await twinPool.query<{
        user_name: string;
        evidence_role: boolean;
        twin_role: boolean;
      }>(
        `SELECT current_user::text AS user_name,
                pg_catalog.pg_has_role(current_user,$1,'USAGE') AS evidence_role,
                pg_catalog.pg_has_role(current_user,$2,'USAGE') AS twin_role`,
        [
          MCFT_CAP09_EVIDENCE_RUNTIME_PRIVILEGE_ROLE_V1,
          MCFT_CAP09_TWIN_RUNTIME_PRIVILEGE_ROLE_V1,
        ],
      );
      assert.deepEqual(twinIdentity.rows[0], {
        user_name: MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
        evidence_role: false,
        twin_role: true,
      });

      const evidenceClient = await evidencePool.connect();
      try {
        await evidenceClient.query("BEGIN");
        await evidenceClient.query(
          `INSERT INTO public.external_evidence_producer_lease_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,
            lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
           VALUES ('phase5','phase5','phase5','phase5','phase5','phase5',
                   'phase5-evidence',1,transaction_timestamp(),
                   transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
        );
        await permissionDeniedV1(
          evidenceClient,
          `INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
           VALUES ('phase5-evidence-direct-fact',transaction_timestamp(),
                   'phase5','{}'::jsonb)`,
        );
        await permissionDeniedV1(
          evidenceClient,
          `INSERT INTO public.twin_runtime_lease_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,
            lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
           VALUES ('phase5','phase5','phase5','phase5','phase5','phase5',
                   'forbidden',1,transaction_timestamp(),
                   transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
        );
        await evidenceClient.query("ROLLBACK");
      } finally {
        evidenceClient.release();
      }

      const twinClient = await twinPool.connect();
      try {
        await twinClient.query("BEGIN");
        await twinClient.query(
          `INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
           VALUES ('phase5-twin-fact',transaction_timestamp(),
                   'phase5-twin','{"type":"phase5_twin_probe","payload":{}}'::jsonb)`,
        );
        await twinClient.query(
          `INSERT INTO public.twin_runtime_lease_v1
           (tenant_id,project_id,group_id,field_id,season_id,zone_id,
            lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
           VALUES ('phase5','phase5','phase5','phase5','phase5','phase5',
                   'phase5-twin',1,transaction_timestamp(),
                   transaction_timestamp()+interval '5 minutes',transaction_timestamp())`,
        );
        await permissionDeniedV1(
          twinClient,
          "SELECT * FROM public.external_evidence_supply_cursor_v1 LIMIT 1",
        );
        await permissionDeniedV1(
          twinClient,
          `UPDATE public.external_evidence_producer_lease_v1
              SET lease_owner=lease_owner WHERE false`,
        );
        await permissionDeniedV1(
          twinClient,
          "UPDATE public.facts SET source=source WHERE false",
        );
        await twinClient.query("ROLLBACK");
      } finally {
        twinClient.release();
      }
    } finally {
      await evidencePool.end();
      await twinPool.end();
    }

    const proof = {
      schema_version: "geox_mcft_cap09_phase5_service_principals_qualification_v1",
      status: "PASS",
      evidence_login_role: MCFT_CAP09_EVIDENCE_RUNTIME_LOGIN_ROLE_V1,
      twin_login_role: MCFT_CAP09_TWIN_RUNTIME_LOGIN_ROLE_V1,
      exact_one_privilege_role_per_login: true,
      cross_plane_role_membership: false,
      login_role_database_object_ownership_count: 0,
      evidence_login_can_mutate_evidence_lease: true,
      evidence_login_direct_fact_insert_denied: true,
      evidence_login_twin_runtime_lease_denied: true,
      twin_login_can_append_canonical_fact: true,
      twin_login_can_mutate_runtime_lease: true,
      twin_login_evidence_cursor_read_denied: true,
      twin_login_evidence_lease_mutation_denied: true,
      twin_login_fact_update_denied: true,
      production_owner_cutover: false,
      formal_v5_armed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    process.stdout.write(JSON.stringify(proof) + "\n");
  } finally {
    await admin.end();
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
