import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  PostgresExternalFormalForcingControllerLifecycleV1,
  type ExternalFormalForcingControllerLeaseV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_FORCING_CONTROLLER_LIFECYCLE_POSTGRES_RESULT.json");
const SUBJECT = "d".repeat(40);
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const EPOCH = "v13-controller-lifecycle-acceptance";

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  await pool.query(fs.readFileSync(path.join(ROOT, "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql"), "utf8"));
}

async function expireControllerLease(pool: Pool): Promise<void> {
  await pool.query(
    `UPDATE twin_external_formal_forcing_controller_lease_v1
        SET lease_expires_at=clock_timestamp() - interval '1 second'
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
    [...scopeValues, EPOCH],
  );
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_CONTROLLER_LIFECYCLE_DESTRUCTIVE_ACCEPTANCE !== "1") {
    throw new Error("SET_MCFT_CAP09_V13_CONTROLLER_LIFECYCLE_DESTRUCTIVE_ACCEPTANCE_1");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 8 });
  try {
    await reset(pool);
    const repo = new PostgresExternalFormalForcingControllerLifecycleV1(pool, { scope, epoch_id: EPOCH, subject_sha: SUBJECT });

    const first = await repo.acquireOrRenew({ lease_owner: "controller-A", lease_duration_seconds: 300 });
    assert.equal(first.status, "ACQUIRED");
    if (first.status !== "ACQUIRED") throw new Error("V13_CONTROLLER_FIRST_ACQUIRE_REQUIRED");
    assert.equal(first.lease.fencing_token, 1n);

    const renewed = await repo.acquireOrRenew({ lease_owner: "controller-A", lease_duration_seconds: 300 });
    assert.equal(renewed.status, "RENEWED");
    if (renewed.status !== "RENEWED") throw new Error("V13_CONTROLLER_SAME_OWNER_RENEW_REQUIRED");
    assert.equal(renewed.lease.fencing_token, 1n);

    const busy = await repo.acquireOrRenew({ lease_owner: "controller-B", lease_duration_seconds: 300 });
    assert.equal(busy.status, "BUSY");
    if (busy.status !== "BUSY") throw new Error("V13_CONTROLLER_SECOND_LIVE_OWNER_MUST_BE_BUSY");
    assert.equal(busy.current_owner, "controller-A");
    assert.equal(busy.fencing_token, 1n);

    // Scope identity is part of the lease authority; a lease from another scope must never terminal this epoch row.
    const foreignLease: ExternalFormalForcingControllerLeaseV1 = {
      ...renewed.lease,
      scope: { ...renewed.lease.scope, zone_id: "zoneB" },
    };
    await assert.rejects(
      () => repo.recordTerminal({ lease: foreignLease, reason: "FOREIGN_SCOPE_MUST_NOT_TERMINAL" }),
      /FORMAL_FORCING_CONTROLLER_TERMINAL_LEASE_IDENTITY_MISMATCH/,
    );

    await expireControllerLease(pool);
    const takeover = await repo.acquireOrRenew({ lease_owner: "controller-B", lease_duration_seconds: 300 });
    assert.equal(takeover.status, "TAKEN_OVER");
    if (takeover.status !== "TAKEN_OVER") throw new Error("V13_CONTROLLER_EXPIRED_LEASE_TAKEOVER_REQUIRED");
    assert.equal(takeover.lease.fencing_token, 2n);

    await assert.rejects(
      () => repo.recordTerminal({ lease: first.lease, reason: "STALE_OWNER_MUST_NOT_TERMINAL" }),
      /FORMAL_FORCING_CONTROLLER_STALE_FENCE/,
    );

    const oldOwnerBusy = await repo.acquireOrRenew({ lease_owner: "controller-A", lease_duration_seconds: 300 });
    assert.equal(oldOwnerBusy.status, "BUSY");
    if (oldOwnerBusy.status !== "BUSY") throw new Error("V13_CONTROLLER_OLD_OWNER_MUST_REMAIN_BUSY");
    assert.equal(oldOwnerBusy.fencing_token, 2n);

    await repo.recordTerminal({ lease: takeover.lease, reason: "CONTROLLED_ACCEPTANCE_TERMINAL" });
    const afterTerminal = await repo.acquireOrRenew({ lease_owner: "controller-C", lease_duration_seconds: 300 });
    assert.equal(afterTerminal.status, "TERMINAL");
    if (afterTerminal.status !== "TERMINAL") throw new Error("V13_CONTROLLER_TERMINAL_MUST_BE_IRREVERSIBLE");
    assert.equal(afterTerminal.fencing_token, 2n);
    assert.equal(afterTerminal.terminal_reason, "CONTROLLED_ACCEPTANCE_TERMINAL");

    const row = (await pool.query<{
      lifecycle_state: string;
      lease_owner: string;
      fencing_token: string;
      lease_expires_at: Date | null;
      terminal_reason: string | null;
    }>(
      `SELECT lifecycle_state,lease_owner,fencing_token,lease_expires_at,terminal_reason
         FROM twin_external_formal_forcing_controller_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scopeValues, EPOCH],
    )).rows[0];
    assert.ok(row);
    assert.equal(row.lifecycle_state, "TERMINAL");
    assert.equal(row.lease_owner, "controller-B");
    assert.equal(BigInt(row.fencing_token), 2n);
    assert.equal(row.lease_expires_at, null);

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_V13_FORCING_CONTROLLER_LIFECYCLE",
      first_owner_token: "1",
      same_owner_renew_preserves_token: true,
      concurrent_second_owner_denied: true,
      scope_identity_enforced: true,
      expired_lease_takeover_token: "2",
      stale_owner_terminal_denied: true,
      terminal_irreversible: true,
      production_workflow_effect: false,
      formal_database_effect: false,
      canonical_tick_core_changed: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
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
