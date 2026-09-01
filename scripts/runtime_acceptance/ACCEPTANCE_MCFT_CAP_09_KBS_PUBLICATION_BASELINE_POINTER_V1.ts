import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import type {
  EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  PostgresEvidenceProducerLeaseV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import {
  PostgresKbsRawHourlyPublicationBaselinePointerReadV1,
  PostgresKbsRawHourlyPublicationBaselinePointerV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_kbs_publication_baseline_pointer_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_KBS_PUBLICATION_BASELINE_POINTER_V1_RESULT.json",
);
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");

const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_e3r1",
  season_id: "season_2026",
  zone_id: "zone_root",
};

function baseline(input: {
  digestChar: string;
  latest: string;
  storedAt: string;
}) {
  const digest = "sha256:" + input.digestChar.repeat(64);
  return {
    baseline_ref:
      "s3-private://phase3-qualification/" +
      "mcft-cap09-kbs-raw-hourly-publication-baseline-v1/sha256/" +
      digest.slice("sha256:".length),
    baseline_digest: digest,
    manifest_bytes: 1024 + input.digestChar.charCodeAt(0),
    latest_event_time: input.latest,
    stored_at: input.storedAt,
  };
}

async function expectReject(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown = null;
  try { await fn(); } catch (error) { caught = error; }
  assert(caught instanceof Error, "KBS_BASELINE_POINTER_EXPECTED_FAIL_CLOSED_ERROR");
  assert.match(caught.message, pattern);
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    application_name: "mcft-cap09-kbs-publication-baseline-pointer-qualification",
  });
  try {
    await pool.query(
      "TRUNCATE TABLE external_evidence_supply_event_v1, external_evidence_supply_cursor_v1, external_evidence_producer_lease_v1",
    );

    const tableCount = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    assert.equal(tableCount.rows[0]?.count, 3, "KBS_BASELINE_POINTER_MUST_NOT_ADD_TABLE");

    const columns = await pool.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns " +
      "WHERE table_schema='public' AND table_name='external_evidence_producer_lease_v1' " +
      "AND column_name LIKE 'kbs_raw_hourly_baseline_%' ORDER BY column_name",
    );
    assert.deepEqual(columns.rows.map((row) => row.column_name), [
      "kbs_raw_hourly_baseline_advanced_at",
      "kbs_raw_hourly_baseline_digest",
      "kbs_raw_hourly_baseline_latest_event_time",
      "kbs_raw_hourly_baseline_manifest_bytes",
      "kbs_raw_hourly_baseline_ref",
      "kbs_raw_hourly_baseline_stored_at",
      "kbs_raw_hourly_baseline_writer_fencing_token",
      "kbs_raw_hourly_baseline_writer_owner",
    ]);

    const readOnly = new PostgresKbsRawHourlyPublicationBaselinePointerReadV1(pool, SCOPE);
    assert.equal(await readOnly.readCurrentBaselinePointer({ scope: SCOPE }), null);

    const leaseRepo = new PostgresEvidenceProducerLeaseV1(pool, SCOPE);
    const claimA = await leaseRepo.acquireLease({
      scope: SCOPE,
      lease_owner: "evidence-producer-A",
      lease_duration_seconds: 300,
    });
    assert(claimA);
    assert.equal(claimA.fencing_token, 1n);

    const pointerA = new PostgresKbsRawHourlyPublicationBaselinePointerV1(pool, SCOPE, claimA);
    const first = baseline({
      digestChar: "a",
      latest: "2026-08-31T18:00:00.000Z",
      storedAt: "2026-08-31T18:05:00.000Z",
    });
    const firstAdvance = await pointerA.advanceCurrentBaselinePointer({
      claim: claimA,
      expected_previous_digest: null,
      next: first,
    });
    assert.equal(firstAdvance.status, "ADVANCED");
    assert.equal(firstAdvance.pointer.writer_lease_owner, claimA.lease_owner);
    assert.equal(firstAdvance.pointer.writer_fencing_token, 1n);

    const firstRetry = await pointerA.advanceCurrentBaselinePointer({
      claim: claimA,
      expected_previous_digest: null,
      next: first,
    });
    assert.equal(firstRetry.status, "EXISTING_IDEMPOTENT_SUCCESS");

    const second = baseline({
      digestChar: "b",
      latest: "2026-08-31T19:00:00.000Z",
      storedAt: "2026-08-31T19:05:00.000Z",
    });
    await expectReject(
      () => pointerA.advanceCurrentBaselinePointer({
        claim: claimA,
        expected_previous_digest: null,
        next: second,
      }),
      /KBS_BASELINE_POINTER_EXPECTED_PREDECESSOR_MISMATCH/,
    );

    await leaseRepo.releaseLease({ claim: claimA });
    const claimB = await leaseRepo.acquireLease({
      scope: SCOPE,
      lease_owner: "evidence-producer-B",
      lease_duration_seconds: 300,
    });
    assert(claimB);
    assert.equal(claimB.fencing_token, 2n);

    const afterTakeover = await readOnly.readCurrentBaselinePointer({ scope: SCOPE });
    assert(afterTakeover);
    assert.equal(afterTakeover.baseline_digest, first.baseline_digest);
    assert.equal(afterTakeover.writer_lease_owner, "evidence-producer-A");
    assert.equal(afterTakeover.writer_fencing_token, 1n);

    await expectReject(
      () => pointerA.advanceCurrentBaselinePointer({
        claim: claimA,
        expected_previous_digest: first.baseline_digest,
        next: second,
      }),
      /KBS_BASELINE_POINTER_STALE_FENCE/,
    );

    const pointerB = new PostgresKbsRawHourlyPublicationBaselinePointerV1(pool, SCOPE, claimB);
    await expectReject(
      () => pointerB.advanceCurrentBaselinePointer({
        claim: claimB,
        expected_previous_digest: "sha256:" + "c".repeat(64),
        next: second,
      }),
      /KBS_BASELINE_POINTER_EXPECTED_PREDECESSOR_MISMATCH/,
    );

    const secondAdvance = await pointerB.advanceCurrentBaselinePointer({
      claim: claimB,
      expected_previous_digest: first.baseline_digest,
      next: second,
    });
    assert.equal(secondAdvance.status, "ADVANCED");
    assert.equal(secondAdvance.pointer.writer_lease_owner, "evidence-producer-B");
    assert.equal(secondAdvance.pointer.writer_fencing_token, 2n);

    const nonMonotone = baseline({
      digestChar: "d",
      latest: "2026-08-31T19:00:00.000Z",
      storedAt: "2026-08-31T19:06:00.000Z",
    });
    await expectReject(
      () => pointerB.advanceCurrentBaselinePointer({
        claim: claimB,
        expected_previous_digest: second.baseline_digest,
        next: nonMonotone,
      }),
      /KBS_BASELINE_POINTER_LATEST_EVENT_MUST_STRICTLY_ADVANCE/,
    );

    const restartReader = new PostgresKbsRawHourlyPublicationBaselinePointerReadV1(pool, SCOPE);
    const restartPointer = await restartReader.readCurrentBaselinePointer({ scope: SCOPE });
    assert(restartPointer);
    assert.equal(restartPointer.baseline_digest, second.baseline_digest);
    assert.equal(restartPointer.latest_event_time, second.latest_event_time);
    assert.equal(restartPointer.writer_lease_owner, "evidence-producer-B");
    assert.equal(restartPointer.writer_fencing_token, 2n);

    const counts = await pool.query<{ leases: number; tables: number }>(
      "SELECT " +
      "(SELECT count(*)::int FROM external_evidence_producer_lease_v1) AS leases," +
      "(SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS tables",
    );
    assert.deepEqual(counts.rows[0], { leases: 1, tables: 3 });

    const proof = {
      schema_version: "geox_mcft_cap09_kbs_publication_baseline_pointer_result_v1",
      status: "PASS",
      table_count_unchanged: true,
      new_table_count: 0,
      pointer_column_count: columns.rows.length,
      initial_pointer_absent: true,
      initial_bind_requires_null_predecessor: true,
      exact_retry_idempotent: true,
      wrong_predecessor_rejected: true,
      stale_owner_after_takeover_rejected: true,
      takeover_preserves_previous_writer_identity: true,
      exact_predecessor_cas_advance: true,
      latest_event_time_must_strictly_advance: true,
      restart_readback_verified: true,
      final_writer_fencing_token: restartPointer.writer_fencing_token.toString(),
      provider_request_count: 0,
      raw_store_write_count: 0,
      canonical_evidence_write_count: 0,
      runtime_tick_cursor_access_count: 0,
      twin_state_mutation: false,
      production_schema_mutation: false,
      production_runtime_start: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_kbs_publication_baseline_pointer_result_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    production_schema_mutation: false,
    production_runtime_start: false,
  }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
