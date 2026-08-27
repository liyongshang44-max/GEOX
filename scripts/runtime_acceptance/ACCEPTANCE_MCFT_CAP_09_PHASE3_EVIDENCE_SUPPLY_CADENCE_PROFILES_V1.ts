import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  MCFT_CAP09_KBS_DAILY_BATCH_HOURLY_EVENT_PROFILE_V1,
  MCFT_CAP09_TRUE_HOURLY_EVENT_PROFILE_V1,
  MCFT_CAP09_HOURLY_OUTAGE_BACKFILL_PROFILE_V1,
  summarizeEvidenceSupplyContinuityV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_supply_cadence_profile_v1.js";
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

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_SUPPLY_CADENCE_PROFILES_V1_RESULT.json");
const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");

const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "cadenceTenant",
  project_id: "cadenceProject",
  group_id: "cadenceGroup",
  field_id: "cadenceField",
  season_id: "cadenceSeason",
  zone_id: "cadenceZone",
};

function isoHour(base: string, offset: number): string {
  return new Date(Date.parse(base) + offset * 3600_000).toISOString();
}

function rainfallEvidence(input: {
  event_time: string;
  publication_available_at: string;
  fact_id: string;
  semantic: string;
  source_record_id: string;
  origin_source_id: string;
}): EvidenceSupplyCursorAdvanceInputV1 {
  return {
    cursor_contract_id: MCFT_CAP09_EVIDENCE_SUPPLY_CURSOR_CONTRACT_ID_V1,
    visible_evidence: {
      visibility_id: MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,
      fact_id: input.fact_id,
      record_type: "observed_rainfall_v1",
      source_record_id: input.source_record_id,
      source_record_hash: "sha256:" + "1".repeat(64),
      record_semantic_sha256: input.semantic,
      retention_ref: "s3-private://cadence/sha256/" + "2".repeat(64),
      raw_sha256: "sha256:" + "2".repeat(64),
      raw_bytes: 64,
      post_commit_db_readback_at: input.publication_available_at,
    },
    binding_id: "kbs_lter_raw_hourly_rain_mm_v1",
    origin_source_id: input.origin_source_id,
    available_to_runtime_at: input.publication_available_at,
    role_time: {
      interval_start: new Date(Date.parse(input.event_time) - 3600_000).toISOString(),
      interval_end: input.event_time,
      ingested_at: input.publication_available_at,
    },
  };
}

async function main(): Promise<void> {
  // Pure generic profile qualification: publication pattern is independent of event cadence.
  const dailyBase = "2026-08-26T05:00:00.000Z";
  const dailyPublication = "2026-08-27T05:03:00.000Z";
  const dailyEvents = Array.from({ length: 24 }, (_, i) => ({
    event_time: isoHour(dailyBase, i),
    publication_available_at: dailyPublication,
    revision_count: 0,
    publication_count: 1,
  }));
  const daily = summarizeEvidenceSupplyContinuityV1(
    dailyEvents,
    MCFT_CAP09_KBS_DAILY_BATCH_HOURLY_EVENT_PROFILE_V1,
  );
  assert.equal(daily.publication_available_through, dailyPublication);
  assert.equal(daily.event_time_contiguous_from, dailyBase);
  assert.equal(daily.event_time_contiguous_through, isoHour(dailyBase, 23));
  assert.equal(daily.event_time_max_seen, isoHour(dailyBase, 23));
  assert.equal(daily.event_gap_count, 0);
  assert.equal(daily.publication_event_count, 24);

  const hourlyBase = "2026-08-27T00:00:00.000Z";
  const trueHourlyEvents = Array.from({ length: 6 }, (_, i) => ({
    event_time: isoHour(hourlyBase, i),
    publication_available_at: new Date(Date.parse(isoHour(hourlyBase, i)) + 5 * 60_000).toISOString(),
    revision_count: 0,
    publication_count: 1,
  }));
  const trueHourly = summarizeEvidenceSupplyContinuityV1(
    trueHourlyEvents,
    MCFT_CAP09_TRUE_HOURLY_EVENT_PROFILE_V1,
  );
  assert.equal(trueHourly.event_gap_count, 0);
  assert.equal(trueHourly.event_time_contiguous_through, isoHour(hourlyBase, 5));
  assert.equal(trueHourly.publication_available_through, "2026-08-27T05:05:00.000Z");

  const outage = summarizeEvidenceSupplyContinuityV1(
    [
      { event_time: isoHour(hourlyBase, 0), publication_available_at: "2026-08-27T00:05:00.000Z", revision_count: 0, publication_count: 1 },
      { event_time: isoHour(hourlyBase, 1), publication_available_at: "2026-08-27T01:05:00.000Z", revision_count: 0, publication_count: 1 },
      { event_time: isoHour(hourlyBase, 3), publication_available_at: "2026-08-27T03:05:00.000Z", revision_count: 0, publication_count: 1 },
    ],
    MCFT_CAP09_HOURLY_OUTAGE_BACKFILL_PROFILE_V1,
  );
  assert.equal(outage.event_gap_count, 1);
  assert.equal(outage.event_time_contiguous_through, isoHour(hourlyBase, 1));
  assert.equal(outage.event_time_max_seen, isoHour(hourlyBase, 3));

  const backfilled = summarizeEvidenceSupplyContinuityV1(
    [
      { event_time: isoHour(hourlyBase, 0), publication_available_at: "2026-08-27T00:05:00.000Z", revision_count: 0, publication_count: 1 },
      { event_time: isoHour(hourlyBase, 1), publication_available_at: "2026-08-27T01:05:00.000Z", revision_count: 0, publication_count: 1 },
      { event_time: isoHour(hourlyBase, 2), publication_available_at: "2026-08-27T04:00:00.000Z", revision_count: 1, publication_count: 2 },
      { event_time: isoHour(hourlyBase, 3), publication_available_at: "2026-08-27T03:05:00.000Z", revision_count: 0, publication_count: 1 },
    ],
    MCFT_CAP09_HOURLY_OUTAGE_BACKFILL_PROFILE_V1,
  );
  assert.equal(backfilled.event_gap_count, 0);
  assert.equal(backfilled.event_time_contiguous_through, isoHour(hourlyBase, 3));
  assert.equal(backfilled.publication_available_through, "2026-08-27T04:00:00.000Z");
  assert.equal(backfilled.revision_count, 1);
  assert.equal(backfilled.publication_event_count, 5);

  // PostgreSQL proof: same publication timestamp for a daily batch must not conflict.
  const pool = new Pool({ connectionString: DATABASE_URL, application_name: "mcft-cap09-phase3-cadence-profile-qualification" });
  try {
    await pool.query(
      "DELETE FROM external_evidence_supply_event_v1 WHERE tenant_id=$1; " +
      "DELETE FROM external_evidence_supply_cursor_v1 WHERE tenant_id=$1; " +
      "DELETE FROM external_evidence_producer_lease_v1 WHERE tenant_id=$1",
      [SCOPE.tenant_id],
    );

    const leaseRepo = new PostgresEvidenceProducerLeaseV1(pool, SCOPE);
    const claim = await leaseRepo.acquireLease({
      scope: SCOPE,
      lease_owner: "cadence-owner",
      lease_duration_seconds: 600,
    });
    assert(claim);

    const dailyCursor = new PostgresEvidenceSupplyCursorV1(pool, SCOPE, claim);
    for (let i = 0; i < 24; i += 1) {
      const result = await dailyCursor.advanceAfterVisibleEvidence(rainfallEvidence({
        event_time: isoHour(dailyBase, i),
        publication_available_at: dailyPublication,
        fact_id: "daily-fact-" + String(i).padStart(2, "0"),
        semantic: "sha256:" + i.toString(16).padStart(64, "0"),
        source_record_id: "daily-source-" + String(i).padStart(2, "0"),
        origin_source_id: "KBS_DAILY_BATCH_QUALIFICATION",
      }));
      assert.equal(result.status, "ADVANCED");
    }
    const dailySnapshot = await dailyCursor.readSupplyCursor({
      scope: SCOPE,
      binding_id: "kbs_lter_raw_hourly_rain_mm_v1",
      origin_source_id: "KBS_DAILY_BATCH_QUALIFICATION",
    });
    assert(dailySnapshot);
    assert.equal(dailySnapshot.publication_available_through, dailyPublication);
    assert.equal(dailySnapshot.event_time_contiguous_through, isoHour(dailyBase, 23));
    assert.equal(dailySnapshot.event_gap_count, 0);
    assert.equal(dailySnapshot.publication_event_count, 24);

    // PostgreSQL outage -> later backfill -> later revision on the same event_time.
    const gapCursor = new PostgresEvidenceSupplyCursorV1(pool, SCOPE, claim);
    for (const hour of [0, 1, 3]) {
      await gapCursor.advanceAfterVisibleEvidence(rainfallEvidence({
        event_time: isoHour(hourlyBase, hour),
        publication_available_at: new Date(Date.parse(isoHour(hourlyBase, hour)) + 5 * 60_000).toISOString(),
        fact_id: "gap-fact-" + hour,
        semantic: "sha256:" + (100 + hour).toString(16).padStart(64, "0"),
        source_record_id: "gap-source-" + hour,
        origin_source_id: "HOURLY_BACKFILL_QUALIFICATION",
      }));
    }
    const gapSnapshot = await gapCursor.readSupplyCursor({
      scope: SCOPE,
      binding_id: "kbs_lter_raw_hourly_rain_mm_v1",
      origin_source_id: "HOURLY_BACKFILL_QUALIFICATION",
    });
    assert(gapSnapshot);
    assert.equal(gapSnapshot.event_gap_count, 1);
    assert.equal(gapSnapshot.event_time_contiguous_through, isoHour(hourlyBase, 1));

    await gapCursor.advanceAfterVisibleEvidence(rainfallEvidence({
      event_time: isoHour(hourlyBase, 2),
      publication_available_at: "2026-08-27T04:00:00.000Z",
      fact_id: "gap-fact-2-backfill",
      semantic: "sha256:" + "b".repeat(64),
      source_record_id: "gap-source-2",
      origin_source_id: "HOURLY_BACKFILL_QUALIFICATION",
    }));
    const closedSnapshot = await gapCursor.readSupplyCursor({
      scope: SCOPE,
      binding_id: "kbs_lter_raw_hourly_rain_mm_v1",
      origin_source_id: "HOURLY_BACKFILL_QUALIFICATION",
    });
    assert(closedSnapshot);
    assert.equal(closedSnapshot.event_gap_count, 0);
    assert.equal(closedSnapshot.event_time_contiguous_through, isoHour(hourlyBase, 3));
    assert.equal(closedSnapshot.publication_available_through, "2026-08-27T04:00:00.000Z");

    await gapCursor.advanceAfterVisibleEvidence(rainfallEvidence({
      event_time: isoHour(hourlyBase, 2),
      publication_available_at: "2026-08-27T05:00:00.000Z",
      fact_id: "gap-fact-2-revision",
      semantic: "sha256:" + "c".repeat(64),
      source_record_id: "gap-source-2-revision",
      origin_source_id: "HOURLY_BACKFILL_QUALIFICATION",
    }));
    const revisedSnapshot = await gapCursor.readSupplyCursor({
      scope: SCOPE,
      binding_id: "kbs_lter_raw_hourly_rain_mm_v1",
      origin_source_id: "HOURLY_BACKFILL_QUALIFICATION",
    });
    assert(revisedSnapshot);
    assert.equal(revisedSnapshot.event_gap_count, 0);
    assert.equal(revisedSnapshot.event_time_contiguous_through, isoHour(hourlyBase, 3));
    assert.equal(revisedSnapshot.revision_count, 1);
    assert.equal(revisedSnapshot.publication_available_through, "2026-08-27T05:00:00.000Z");

    const proof = {
      schema_version: "geox_mcft_cap09_phase3_evidence_supply_cadence_profiles_qualification_v1",
      status: "PASS",
      models: {
        kbs_daily_batch: {
          event_count: 24,
          same_publication_timestamp_accepted: true,
          gap_count: dailySnapshot.event_gap_count,
          publication_available_through: dailySnapshot.publication_available_through,
          event_time_contiguous_through: dailySnapshot.event_time_contiguous_through,
        },
        true_hourly: {
          event_count: 6,
          gap_count: trueHourly.event_gap_count,
          publication_available_through: trueHourly.publication_available_through,
        },
        hourly_outage_backfill_revision: {
          gap_detected_before_backfill: gapSnapshot.event_gap_count,
          gap_count_after_backfill: closedSnapshot.event_gap_count,
          revision_count_after_revision: revisedSnapshot.revision_count,
          continuity_preserved_after_revision: revisedSnapshot.event_time_contiguous_through,
          publication_available_through: revisedSnapshot.publication_available_through,
        },
      },
      publication_axis_independent_from_event_axis: true,
      daily_batch_supported: true,
      gap_supported: true,
      backfill_supported: true,
      revision_supported: true,
      runtime_tick_cursor_mutation: false,
      twin_state_mutation: false,
      production_cadence_activation: false,
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
