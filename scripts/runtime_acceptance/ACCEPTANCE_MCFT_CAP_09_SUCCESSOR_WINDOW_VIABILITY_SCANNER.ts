import assert from "node:assert/strict";

import {
  EXTERNAL_FORMAL_NO_CURRENT_SEASON_SUCCESSOR_EPOCH_V1,
  scanExternalFormalSuccessorWindowViabilityV1,
  type ExternalFormalSuccessorWindowScannerInputV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_successor_window_viability_scanner_v1.js";

const FROZEN_INPUT: ExternalFormalSuccessorWindowScannerInputV1 = {
  planting_window_utc: {
    start_inclusive: "2026-05-11T04:00:00.000Z",
    end_exclusive: "2026-05-12T04:00:00.000Z",
  },
  variant_stage_lengths_days: [
    [30, 50, 60, 40],
    [25, 40, 45, 30],
    [20, 35, 40, 30],
    [20, 35, 40, 30],
    [30, 40, 50, 30],
    [30, 40, 50, 50],
  ],
  allowed_stage_codes: ["INITIAL", "DEVELOPMENT", "MID", "LATE"],
  backward_stability_hours: 6,
  forward_transition_guard_hours: 30,
  slot_count: 24,
  slot_interval_hours: 1,
  minimum_lead_hours: 36,
  earliest_successor_selection_authority_effective_at: "2026-08-11T02:33:13.000Z",
};

function main(): void {
  const result = scanExternalFormalSuccessorWindowViabilityV1(FROZEN_INPUT);
  assert.equal(result.scan_deterministic, true);
  assert.equal(result.future_observations_used, false);
  assert.equal(result.variant_count, 6);
  assert.deepEqual(result.viable_window_ranges, [
    {
      first_o00: "2026-05-12T10:00:00.000Z",
      last_o00: "2026-05-28T22:00:00.000Z",
      stage_code: "INITIAL",
      candidate_count: 397,
    },
    {
      first_o00: "2026-06-11T10:00:00.000Z",
      last_o00: "2026-07-02T22:00:00.000Z",
      stage_code: "DEVELOPMENT",
      candidate_count: 517,
    },
    {
      first_o00: "2026-07-31T10:00:00.000Z",
      last_o00: "2026-08-11T22:00:00.000Z",
      stage_code: "MID",
      candidate_count: 277,
    },
  ]);
  assert.equal(result.viable_windows.length, 1191);
  assert.equal(result.latest_complete_current_season_o00, "2026-08-11T22:00:00.000Z");
  assert.equal(result.latest_complete_current_season_o23, "2026-08-12T21:00:00.000Z");
  assert.equal(result.latest_complete_current_season_stage, "MID");
  assert.equal(result.latest_successor_selection_authority_effective_at, "2026-08-10T10:00:00.000Z");
  assert.equal(result.earliest_successor_selection_authority_effective_at, "2026-08-11T02:33:13.000Z");
  assert.equal(result.earliest_authority_misses_latest_selection_deadline_by_seconds, 59593);
  assert.equal(result.current_season_successor_epoch_eligible, false);
  assert.equal(result.disposition, EXTERNAL_FORMAL_NO_CURRENT_SEASON_SUCCESSOR_EPOCH_V1);

  const exactBoundary = scanExternalFormalSuccessorWindowViabilityV1({
    ...FROZEN_INPUT,
    earliest_successor_selection_authority_effective_at: "2026-08-10T10:00:00.000Z",
  });
  assert.equal(exactBoundary.current_season_successor_epoch_eligible, true);
  assert.equal(exactBoundary.disposition, "CURRENT_SEASON_SUCCESSOR_EPOCH_POSSIBLE");
  assert.equal(exactBoundary.earliest_authority_misses_latest_selection_deadline_by_seconds, 0);

  const oneSecondLate = scanExternalFormalSuccessorWindowViabilityV1({
    ...FROZEN_INPUT,
    earliest_successor_selection_authority_effective_at: "2026-08-10T10:00:01.000Z",
  });
  assert.equal(oneSecondLate.current_season_successor_epoch_eligible, false);
  assert.equal(oneSecondLate.disposition, EXTERNAL_FORMAL_NO_CURRENT_SEASON_SUCCESSOR_EPOCH_V1);
  assert.equal(oneSecondLate.earliest_authority_misses_latest_selection_deadline_by_seconds, 1);

  console.log(JSON.stringify({
    status: "PASS",
    scanner_id: result.scanner_id,
    viable_window_range_count: result.viable_window_ranges.length,
    viable_window_count: result.viable_windows.length,
    latest_complete_current_season_o00: result.latest_complete_current_season_o00,
    latest_complete_current_season_o23: result.latest_complete_current_season_o23,
    latest_complete_current_season_stage: result.latest_complete_current_season_stage,
    latest_successor_selection_authority_effective_at: result.latest_successor_selection_authority_effective_at,
    amendment_08_effective_at: result.earliest_successor_selection_authority_effective_at,
    amendment_08_missed_latest_selection_deadline_by_seconds: result.earliest_authority_misses_latest_selection_deadline_by_seconds,
    disposition: result.disposition,
    operational_activation_qualified: false,
    successor_epoch_selected: false,
    ea5e3_authorized: false,
    formal_window_started: false,
    database_write_count: 0,
    provider_request_count: 0,
  }));
}

main();
