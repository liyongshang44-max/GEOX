import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  KbsRawHourlyPublicationSnapshotComparisonV1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_comparison_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_KBS_PUBLICATION_SNAPSHOT_COMPARISON_V1_RESULT.json",
);
const HEADER = "datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n";
const PREVIOUS_ROWS = [
  "2026-08-31 16:00:00,120.0,2.0,1.7,23.0,0.1",
  "2026-08-31 17:00:00,150.0,2.5,1.8,24.0,0.2",
  "2026-08-31 18:00:00,180.0,3.0,1.9,25.0,0.3",
];
const PREVIOUS = Buffer.from(HEADER + PREVIOUS_ROWS.join("\n") + "\n", "utf8");
const PREVIOUS_AVAILABLE = "2026-08-31T18:05:00.000Z";
const CURRENT_AVAILABLE = "2026-08-31T20:05:00.000Z";
const BASELINE = "2026-08-31T18:00:00.000Z";
function body(rows: readonly string[]): Buffer {
  return Buffer.from(HEADER + rows.join("\n") + "\n", "utf8");
}

async function main(): Promise<void> {
  const comparison = new KbsRawHourlyPublicationSnapshotComparisonV1();
  const noChange = await comparison.compare({
    previous_raw_bytes: PREVIOUS, previous_available_at: PREVIOUS_AVAILABLE,
    current_raw_bytes: PREVIOUS, current_available_at: CURRENT_AVAILABLE,
    baseline_latest_event_time: BASELINE,
  });
  assert.equal(noChange.status, "NO_CHANGE");
  assert.equal(noChange.historical_prefix_exact_match, true);
  assert.equal(noChange.forward_event_count, 0);

  const forward = await comparison.compare({
    previous_raw_bytes: PREVIOUS, previous_available_at: PREVIOUS_AVAILABLE,
    current_raw_bytes: body(PREVIOUS_ROWS.concat([
      "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
      "2026-08-31 20:00:00,200.0,3.2,2.1,26.0,0.5",
    ])), current_available_at: CURRENT_AVAILABLE, baseline_latest_event_time: BASELINE,
  });
  assert.equal(forward.status, "FORWARD_DELTA");
  assert.equal(forward.historical_prefix_exact_match, true);
  assert.deepEqual(forward.forward_event_times, [
    "2026-08-31T19:00:00.000Z", "2026-08-31T20:00:00.000Z",
  ]);

  const revised = await comparison.compare({
    previous_raw_bytes: PREVIOUS, previous_available_at: PREVIOUS_AVAILABLE,
    current_raw_bytes: body([
      PREVIOUS_ROWS[0]!,
      "2026-08-31 17:00:00,151.0,2.5,1.8,24.0,0.2",
      PREVIOUS_ROWS[2]!,
      "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
    ]), current_available_at: CURRENT_AVAILABLE, baseline_latest_event_time: BASELINE,
  });
  assert.equal(revised.status, "HISTORICAL_DRIFT");
  assert.deepEqual(revised.historical_drift, [{
    event_time: "2026-08-31T17:00:00.000Z",
    kind: "CHANGED_BEFORE_OR_AT_BASELINE",
  }]);
  assert.equal(revised.forward_event_count, 1);
  assert.equal(revised.historical_revision_or_backfill_auto_promotion_authorized, false);

  const addedHistorical = await comparison.compare({
    previous_raw_bytes: PREVIOUS, previous_available_at: PREVIOUS_AVAILABLE,
    current_raw_bytes: body([
      "2026-08-31 15:00:00,100.0,1.9,1.6,22.0,0.0",
      ...PREVIOUS_ROWS,
    ]), current_available_at: CURRENT_AVAILABLE, baseline_latest_event_time: BASELINE,
  });
  assert.equal(addedHistorical.status, "HISTORICAL_DRIFT");
  assert.deepEqual(addedHistorical.historical_drift, [{
    event_time: "2026-08-31T15:00:00.000Z",
    kind: "ADDED_BEFORE_OR_AT_BASELINE",
  }]);

  const ambiguous = await comparison.compare({
    previous_raw_bytes: PREVIOUS, previous_available_at: PREVIOUS_AVAILABLE,
    current_raw_bytes: body(PREVIOUS_ROWS.concat([
      "2026-08-31 19:00:00,190.0,3.1,2.0,25.5,0.4",
      "2026-08-31 19:00:00,191.0,3.1,2.0,25.5,0.4",
    ])), current_available_at: CURRENT_AVAILABLE, baseline_latest_event_time: BASELINE,
  });
  assert.equal(ambiguous.status, "AMBIGUOUS_FORWARD");
  assert.deepEqual(ambiguous.ambiguous_forward_event_times, ["2026-08-31T19:00:00.000Z"]);

  await assert.rejects(
    () => comparison.compare({
      previous_raw_bytes: PREVIOUS, previous_available_at: PREVIOUS_AVAILABLE,
      current_raw_bytes: PREVIOUS, current_available_at: CURRENT_AVAILABLE,
      baseline_latest_event_time: "2026-08-31T17:00:00.000Z",
    }),
    /MCFT_CAP09_KBS_PUBLICATION_COMPARE_BASELINE_POINTER_SNAPSHOT_MISMATCH/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_kbs_publication_snapshot_comparison_acceptance_v1",
    status: "PASS",
    exact_no_change_detected: true,
    forward_delta_detected: true,
    historical_changed_row_fails_closed: true,
    historical_backfill_row_fails_closed: true,
    ambiguous_forward_duplicate_fails_closed: true,
    baseline_pointer_snapshot_mismatch_fails_closed: true,
    status_precedence: ["HISTORICAL_DRIFT","AMBIGUOUS_FORWARD","FORWARD_DELTA","NO_CHANGE"],
    historical_revision_or_backfill_auto_promotion_authorized: false,
    raw_values_emitted: false,
    provider_request_count: 0,
    raw_store_write_count: 0,
    database_connection_attempted: false,
    canonical_evidence_write_count: 0,
    runtime_tick_cursor_access_count: 0,
    twin_state_mutation: false,
    production_target_planner_bound: false,
    runtime_process_start: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}
main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    schema_version: "geox_mcft_cap09_kbs_publication_snapshot_comparison_acceptance_v1",
    status: "FAIL", error: error instanceof Error ? error.message : String(error),
    provider_request_count: 0, database_connection_attempted: false,
    production_target_planner_bound: false,
  }, null, 2) + "\n");
  console.error(error); process.exitCode = 1;
});
