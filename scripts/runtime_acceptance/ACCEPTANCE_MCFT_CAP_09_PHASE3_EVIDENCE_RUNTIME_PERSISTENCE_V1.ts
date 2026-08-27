import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
  MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1,
  type EvidenceSupplyCursorAdvanceInputV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  PostgresEvidenceProducerLeaseV1,
  PostgresEvidenceSupplyCursorV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_PERSISTENCE_V1_RESULT.json");
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

function soilEvidence(input: {
  fact: string;
  semantic: string;
  available_at: string;
  observed_at: string;
  source_record_id: string;
}): EvidenceSupplyCursorAdvanceInputV1 {
  return {
    cursor_contract_id: MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1,
    visible_evidence: {
      visibility_id: MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
      fact_id: input.fact,
      record_type: "soil_moisture_observation_v1",
      source_record_id: input.source_record_id,
      source_record_hash: "sha256:" + "3".repeat(64),
      record_semantic_sha256: input.semantic,
      retention_ref: "s3-private://phase3-qualification/sha256/" + "4".repeat(64),
      raw_sha256: "sha256:" + "4".repeat(64),
      raw_bytes: 128,
      post_commit_db_readback_at: input.available_at,
    },
    binding_id: "kbs_lter_variate25_vwc_100mm_v1",
    origin_source_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
    available_to_runtime_at: input.available_at,
    role_time: {
      observed_at: input.observed_at,
      ingested_at: input.available_at,
    },
  };
}

async function expectReject(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown = null;
  try { await fn(); } catch (error) { caught = error; }
  assert(caught instanceof Error, "PHASE3_EXPECTED_FAIL_CLOSED_ERROR");
  assert.match(caught.message, pattern);
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: DATABASE_URL, application_name: "mcft-cap09-phase3-evidence-persistence-qualification" });
  try {
    await pool.query("TRUNCATE TABLE external_evidence_supply_event_v1, external_evidence_supply_cursor_v1, external_evidence_producer_lease_v1");

    const twinLease = await pool.query<{ name: string | null }>(
      "SELECT to_regclass('public.twin_runtime_lease_v1')::text AS name",
    );
    assert.equal(twinLease.rows[0]?.name ?? null, null, "PHASE3_QUALIFICATION_MUST_NOT_REQUIRE_TWIN_RUNTIME_LEASE_TABLE");

    const leaseRepo = new PostgresEvidenceProducerLeaseV1(pool, SCOPE);
    const a = await leaseRepo.acquireLease({ scope: SCOPE, lease_owner: "evidence-producer-A", lease_duration_seconds: 300 });
    assert(a, "PHASE3_INITIAL_LEASE_REQUIRED");
    assert.equal(a.fencing_token, 1n);

    const blocked = await leaseRepo.acquireLease({ scope: SCOPE, lease_owner: "evidence-producer-B", lease_duration_seconds: 300 });
    assert.equal(blocked, null, "PHASE3_SECOND_OWNER_MUST_NOT_ACQUIRE_LIVE_LEASE");

    const renewed = await leaseRepo.renewLease({ claim: a, lease_duration_seconds: 300 });
    assert.equal(renewed.lease_owner, a.lease_owner);
    assert.equal(renewed.fencing_token, a.fencing_token);

    const cursorA = new PostgresEvidenceSupplyCursorV1(pool, SCOPE, renewed);
    const first = soilEvidence({
      fact: "fact_" + "1".repeat(64),
      semantic: "sha256:" + "5".repeat(64),
      available_at: "2026-08-27T02:00:00.000Z",
      observed_at: "2026-08-27T01:55:00.000Z",
      source_record_id: "soil-0155",
    });
    const firstAdvance = await cursorA.advanceAfterVisibleEvidence(first);
    assert.equal(firstAdvance.status, "ADVANCED");
    const repeat = await cursorA.advanceAfterVisibleEvidence(first);
    assert.equal(repeat.status, "EXISTING_IDEMPOTENT_SUCCESS");

    await leaseRepo.releaseLease({ claim: renewed });
    const b = await leaseRepo.acquireLease({ scope: SCOPE, lease_owner: "evidence-producer-B", lease_duration_seconds: 300 });
    assert(b, "PHASE3_EXPIRED_TAKEOVER_REQUIRED");
    assert.equal(b.fencing_token, 2n);

    const second = soilEvidence({
      fact: "fact_" + "2".repeat(64),
      semantic: "sha256:" + "6".repeat(64),
      // Earlier publication timestamp is allowed to be processed later; the publication
      // watermark remains the maximum visible publication, independently of event order.
      available_at: "2026-08-27T01:59:00.000Z",
      observed_at: "2026-08-26T23:00:00.000Z",
      source_record_id: "soil-2300-backfill",
    });

    await expectReject(
      () => cursorA.advanceAfterVisibleEvidence(second),
      /PHASE3_EVIDENCE_CURSOR_STALE_FENCE/,
    );

    const cursorB = new PostgresEvidenceSupplyCursorV1(pool, SCOPE, b);
    const secondAdvance = await cursorB.advanceAfterVisibleEvidence(second);
    assert.equal(secondAdvance.status, "ADVANCED");

    const snapshot = await cursorB.readSupplyCursor({
      scope: SCOPE,
      binding_id: second.binding_id,
      origin_source_id: second.origin_source_id,
    });
    assert(snapshot);
    assert.equal(snapshot.fact_id, second.visible_evidence.fact_id);
    assert.equal(snapshot.fencing_token, 2n);
    assert.equal(snapshot.lease_owner, "evidence-producer-B");
    assert.equal(snapshot.available_to_runtime_at, "2026-08-27T01:59:00.000Z");
    assert.equal(snapshot.publication_available_through, "2026-08-27T02:00:00.000Z");
    assert.equal(snapshot.event_time_max_seen, "2026-08-27T01:55:00.000Z");
    assert.equal(snapshot.event_time_contiguous_from, "2026-08-26T23:00:00.000Z");
    assert.equal(snapshot.event_time_contiguous_through, "2026-08-27T01:55:00.000Z");
    assert.equal(snapshot.event_gap_count, 0);
    assert.equal(snapshot.revision_count, 0);
    assert.equal(snapshot.publication_event_count, 2);
    assert.equal(snapshot.cadence_profile_id, "KBS_VARIATE25_IRREGULAR_EVENT_V1");

    const restartedCursorB = new PostgresEvidenceSupplyCursorV1(pool, SCOPE, b);
    const restartRepeat = await restartedCursorB.advanceAfterVisibleEvidence(second);
    assert.equal(restartRepeat.status, "EXISTING_IDEMPOTENT_SUCCESS");

    await expectReject(
      () => leaseRepo.renewLease({ claim: renewed, lease_duration_seconds: 300 }),
      /PHASE3_EVIDENCE_LEASE_RENEW_STALE_FENCE/,
    );

    const counts = await pool.query<{ leases: number; cursors: number; events: number }>(
      "SELECT " +
      "(SELECT count(*)::int FROM external_evidence_producer_lease_v1) AS leases," +
      "(SELECT count(*)::int FROM external_evidence_supply_cursor_v1) AS cursors," +
      "(SELECT count(*)::int FROM external_evidence_supply_event_v1) AS events",
    );
    assert.deepEqual(counts.rows[0], { leases: 1, cursors: 1, events: 2 });

    const result = {
      schema_version: "geox_mcft_cap09_phase3_evidence_runtime_persistence_qualification_v2",
      status: "PASS",
      initial_fencing_token: "1",
      takeover_fencing_token: "2",
      second_owner_blocked_while_live: true,
      same_owner_renew_preserves_fence: true,
      stale_fence_cursor_advance_rejected: true,
      stale_fence_renew_rejected: true,
      cursor_first_advance: firstAdvance.status,
      cursor_exact_retry: repeat.status,
      restart_exact_retry: restartRepeat.status,
      publication_watermark_independent_from_processing_order: true,
      event_time_continuity_separate_from_publication_time: true,
      evidence_event_ledger_row_count: counts.rows[0].events,
      evidence_supply_cursor_row_count: counts.rows[0].cursors,
      evidence_producer_lease_row_count: counts.rows[0].leases,
      evidence_producer_lease_independent_from_twin_runtime_lease: true,
      database_clock_lease_authority: true,
      runtime_tick_cursor_mutation: false,
      twin_state_mutation: false,
      production_evidence_runtime_activation: false,
      production_twin_runtime_activation: false,
      formal_v5_armed: false,
      graduation_effect: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    process.stdout.write(JSON.stringify(result) + "\n");
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
