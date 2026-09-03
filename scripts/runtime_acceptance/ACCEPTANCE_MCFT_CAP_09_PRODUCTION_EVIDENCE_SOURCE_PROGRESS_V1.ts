import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  EvidenceSourceSpecificProgressReaderV1,
  MCFT_CAP09_KBS_HISTORICAL_ET0_ORIGIN_SOURCE_ID_V1,
  MCFT_CAP09_KBS_RAIN_ORIGIN_SOURCE_ID_V1,
  MCFT_CAP09_KBS_SOIL_ORIGIN_SOURCE_ID_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_source_progress_v1.js";
import type {
  EvidenceRuntimeScopeV1,
  EvidenceSupplyCursorBindingSetReadPortV1,
  EvidenceSupplyCursorSnapshotV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PRODUCTION_EVIDENCE_SOURCE_PROGRESS_V1_RESULT.json",
);

const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_mcft_cap09",
  field_id: "field_mcft_external",
  season_id: "season_2026",
  zone_id: "zone_root",
};

function cursor(input: {
  binding_id: string;
  origin_source_id: string;
  contiguous_through: string;
  latest_event_time?: string;
  role_time: Record<string, unknown>;
}): EvidenceSupplyCursorSnapshotV1 {
  const event = input.latest_event_time ?? input.contiguous_through;
  return {
    scope: { ...SCOPE },
    binding_id: input.binding_id,
    origin_source_id: input.origin_source_id,
    fact_id: "fact_" + "1".repeat(64),
    record_semantic_sha256: "sha256:" + "2".repeat(64),
    available_to_runtime_at: "2026-09-01T10:10:00.000Z",
    publication_available_through: "2026-09-01T10:10:00.000Z",
    latest_event_time: event,
    latest_source_record_id: "record_" + input.binding_id,
    event_time_contiguous_from: input.contiguous_through,
    event_time_contiguous_through: input.contiguous_through,
    event_time_max_seen: event,
    event_gap_count: 0,
    revision_count: 0,
    publication_event_count: 1,
    cadence_profile_id: "qualification",
    role_time: { ...input.role_time },
    post_commit_db_readback_at: "2026-09-01T10:11:00.000Z",
    lease_owner: "evidence-runtime",
    fencing_token: 1n,
    advanced_at: "2026-09-01T10:11:00.000Z",
  };
}

class FakeCursorSetReader implements EvidenceSupplyCursorBindingSetReadPortV1 {
  calls: Array<{ scope: EvidenceRuntimeScopeV1; binding_ids: readonly string[] }> = [];

  constructor(private readonly rows: readonly EvidenceSupplyCursorSnapshotV1[]) {}

  async readSupplyCursorsByBindings(input: {
    scope: EvidenceRuntimeScopeV1;
    binding_ids: readonly string[];
  }): Promise<readonly EvidenceSupplyCursorSnapshotV1[]> {
    this.calls.push({ scope: { ...input.scope }, binding_ids: [...input.binding_ids] });
    return this.rows;
  }
}

async function expectReject(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown = null;
  try { await fn(); } catch (error) { caught = error; }
  assert(caught instanceof Error, "SOURCE_PROGRESS_EXPECTED_FAIL_CLOSED_ERROR");
  assert.match(caught.message, pattern);
}

async function main(): Promise<void> {
  const rows = [
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
      origin_source_id: MCFT_CAP09_KBS_RAIN_ORIGIN_SOURCE_ID_V1,
      contiguous_through: "2026-09-01T05:00:00.000Z",
      role_time: { interval_end: "2026-09-01T05:00:00.000Z" },
    }),
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
      origin_source_id: MCFT_CAP09_KBS_HISTORICAL_ET0_ORIGIN_SOURCE_ID_V1,
      contiguous_through: "2026-09-01T04:00:00.000Z",
      role_time: { interval_end: "2026-09-01T04:00:00.000Z" },
    }),
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
      origin_source_id: "gfs_20260901t120000z_pgrb2_0p25_kbs",
      contiguous_through: "2026-09-01T12:00:00.000Z",
      role_time: {
        issued_at: "2026-09-01T12:00:00.000Z",
        valid_from: "2026-09-01T13:00:00.000Z",
      },
    }),
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
      origin_source_id: "gfs_20260901t120000z_asce_short_reference_et0_kbs",
      contiguous_through: "2026-09-01T12:00:00.000Z",
      role_time: {
        issued_at: "2026-09-01T12:00:00.000Z",
        valid_from: "2026-09-01T13:00:00.000Z",
      },
    }),
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
      origin_source_id: "gfs_20260901t180000z_pgrb2_0p25_kbs",
      contiguous_through: "2026-09-01T18:00:00.000Z",
      role_time: {
        issued_at: "2026-09-01T18:00:00.000Z",
        valid_from: "2026-09-01T19:00:00.000Z",
      },
    }),
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      origin_source_id: MCFT_CAP09_KBS_SOIL_ORIGIN_SOURCE_ID_V1,
      contiguous_through: "2026-09-01T08:37:00.000Z",
      role_time: { observed_at: "2026-09-01T08:37:00.000Z" },
    }),
  ];

  const fake = new FakeCursorSetReader(rows);
  const reader = new EvidenceSourceSpecificProgressReaderV1(fake);
  const progress = await reader.readProgress({ scope: SCOPE });

  assert.equal(fake.calls.length, 1, "SOURCE_PROGRESS_SINGLE_CURSOR_SET_READ_REQUIRED");
  assert.equal(fake.calls[0].binding_ids.length, 5, "SOURCE_PROGRESS_EXACT_FIVE_BINDINGS_REQUIRED");
  assert.deepEqual(fake.calls[0].scope, SCOPE, "SOURCE_PROGRESS_SCOPE_MUST_THREAD_EXACTLY");

  assert.equal(progress.kbs_raw_hourly.state, "PAIRED");
  assert.equal(progress.kbs_raw_hourly.paired_contiguous_through, "2026-09-01T04:00:00.000Z");
  assert.equal(progress.kbs_raw_hourly.pair_skew_seconds, 3600);

  assert.equal(progress.gfs_bundle.cycles.length, 2);
  assert.equal(progress.gfs_bundle.cycles[0].cycle_issued_at, "2026-09-01T18:00:00.000Z");
  assert.equal(progress.gfs_bundle.cycles[0].state, "PARTIAL");
  assert.equal(progress.gfs_bundle.cycles[1].cycle_issued_at, "2026-09-01T12:00:00.000Z");
  assert.equal(progress.gfs_bundle.cycles[1].state, "PAIRED");
  assert.equal(progress.gfs_bundle.cycles[1].paired_valid_from, "2026-09-01T13:00:00.000Z");
  assert.equal(progress.gfs_bundle.complete_pair_count, 1);
  assert.equal(progress.gfs_bundle.partial_pair_count, 1);
  assert.equal(progress.kbs_soil.latest?.origin_source_id, MCFT_CAP09_KBS_SOIL_ORIGIN_SOURCE_ID_V1);

  const skewRows = rows.filter((row) =>
    !(
      row.binding_id === MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1 &&
      row.origin_source_id.includes("20260901t120000z")
    )
  ).concat([
    cursor({
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
      origin_source_id: "gfs_20260901t120000z_asce_short_reference_et0_kbs",
      contiguous_through: "2026-09-01T12:00:00.000Z",
      role_time: {
        issued_at: "2026-09-01T12:00:00.000Z",
        valid_from: "2026-09-01T14:00:00.000Z",
      },
    }),
  ]);
  await expectReject(
    () => new EvidenceSourceSpecificProgressReaderV1(new FakeCursorSetReader(skewRows)).readProgress({ scope: SCOPE }),
    /PRODUCTION_EVIDENCE_GFS_PAIR_VALID_FROM_SKEW/,
  );

  const wrongOriginRows = rows.map((row) =>
    row.binding_id === MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1
      ? { ...row, origin_source_id: "unexpected-rain-origin" }
      : row
  );
  await expectReject(
    () => new EvidenceSourceSpecificProgressReaderV1(new FakeCursorSetReader(wrongOriginRows)).readProgress({ scope: SCOPE }),
    /PRODUCTION_EVIDENCE_KBS_RAIN_PROGRESS_UNEXPECTED_ORIGIN/,
  );

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_production_evidence_source_progress_result_v1",
    status: "PASS",
    cursor_set_read_count: fake.calls.length,
    exact_binding_count: fake.calls[0].binding_ids.length,
    kbs_pair_progress: "PASS",
    gfs_cross_cycle_progress: "PASS",
    gfs_pair_skew_fail_closed: "PASS",
    soil_latest_event_progress: "PASS",
    database_connection_attempted: false,
    provider_request_count: 0,
    cursor_advance_count: 0,
    runtime_tick_cursor_access_count: 0,
    production_planner_bound: false,
    runtime_process_start: false,
  }, null, 2) + "\n");
  console.log("MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PROGRESS_PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
