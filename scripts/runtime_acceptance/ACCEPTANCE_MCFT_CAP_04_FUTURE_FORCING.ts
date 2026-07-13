// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING.ts
// Purpose: prove CAP-04 S2 exact joint pair selection, 72-point forcing DTO/hash, deterministic duplicate collapse, no-future-leakage, and the 24-tick 95-hour target union.
// Boundary: pure acceptance only; no database, filesystem, network, environment, wall clock, Forecast equations, Scenario equations, or canonical writes.

import { validateCap04ForecastForcingWindowV1 } from "../../apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.js";
import { selectCap04FutureForcingWindowV1 } from "../../apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.js";
import {
  CAP04_S2_FIRST_LOGICAL_TIME_V1,
  buildCap04FutureForcing24TickInputsV1,
  buildCap04FutureForcingSelectorInputV1,
  buildCap04FutureForcingSnapshotV1,
  addHoursForCap04S2FixtureV1,
} from "./mcft_cap_04_future_forcing_fixture_v1.js";

let pass = 0;
let fail = 0;

function check(value: unknown, message: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

const exactInput = buildCap04FutureForcingSelectorInputV1();
const exactResult = selectCap04FutureForcingWindowV1(exactInput);
check(exactResult.status === "SELECTED", "exact Replay fixture selects one complete matching forcing-cycle pair");

if (exactResult.status === "SELECTED") {
  validateCap04ForecastForcingWindowV1(exactResult.window);
  check(
    exactResult.window.weather_snapshot_issued_at === "2026-06-03T00:45:00.000Z"
      && exactResult.window.weather_snapshot_available_to_runtime_at === "2026-06-03T01:05:00.000Z"
      && exactResult.window.et0_snapshot_issued_at === "2026-06-03T00:45:00.000Z"
      && exactResult.window.et0_snapshot_available_to_runtime_at === "2026-06-03T01:05:00.000Z",
    "FORECAST_AT_T_SELECTS_LATEST_AVAILABLE_MATCHING_FORCING_CYCLE exact times",
  );
  check(
    !exactResult.window.weather_snapshot_ref.includes("future_revision")
      && !exactResult.window.et0_snapshot_ref.includes("future_revision")
      && !exactResult.window.weather_snapshot_ref.includes("incomplete"),
    "future revision and incomplete coverage snapshots are not selected",
  );
  check(
    exactResult.window.points.length === 72
      && exactResult.window.points.every((point, index) => point.horizon_hour === index + 1)
      && exactResult.window.points[0].interval_start === CAP04_S2_FIRST_LOGICAL_TIME_V1
      && exactResult.window.points[71].target_time === addHoursForCap04S2FixtureV1(CAP04_S2_FIRST_LOGICAL_TIME_V1, 72),
    "forcing DTO contains exact ordered horizons 1 through 72",
  );
  check(
    exactResult.window.evidence_refs.length === 2
      && exactResult.window.evidence_refs.includes(exactResult.window.weather_snapshot_ref)
      && exactResult.window.evidence_refs.includes(exactResult.window.et0_snapshot_ref)
      && exactResult.window.points.every((point) => point.precipitation_snapshot_ref === exactResult.window.weather_snapshot_ref && point.et0_snapshot_ref === exactResult.window.et0_snapshot_ref),
    "canonical Evidence refs and hashes remain bound through all 72 points",
  );
}

const repeatedResult = selectCap04FutureForcingWindowV1(structuredClone(exactInput));
check(JSON.stringify(repeatedResult) === JSON.stringify(exactResult), "same semantic input deterministically reproduces selection and forcing_window_hash");

const selectedWeather = exactInput.candidate_records.find((record) => record.source_record_id.startsWith("weather_selected_"));
const selectedEt0 = exactInput.candidate_records.find((record) => record.source_record_id.startsWith("et0_selected_"));
if (!selectedWeather || !selectedEt0) throw new Error("CAP04_S2_SELECTED_FIXTURE_RECORDS_MISSING");
const duplicateWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: exactInput.logical_time,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: `a_weather_identical_duplicate_${exactInput.logical_time}`,
  seed: 1,
});
const duplicateResult = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [selectedWeather, duplicateWeather, selectedEt0],
}));
check(
  duplicateResult.status === "SELECTED"
    && duplicateResult.trace.eligible_snapshot_count === 3
    && duplicateResult.trace.collapsed_snapshot_count === 2
    && duplicateResult.window.weather_snapshot_ref === duplicateWeather.source_record_id,
  "identical duplicate snapshots collapse deterministically by source-record identity",
);

const olderWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: exactInput.logical_time,
  issued_at: "2026-06-02T23:45:00.000Z",
  available_to_runtime_at: "2026-06-03T00:05:00.000Z",
  source_record_id: "weather_older_complete_pair",
  seed: 8,
});
const olderEt0 = buildCap04FutureForcingSnapshotV1({
  kind: "et0",
  logical_time: exactInput.logical_time,
  issued_at: "2026-06-02T23:45:00.000Z",
  available_to_runtime_at: "2026-06-03T00:05:00.000Z",
  source_record_id: "et0_older_complete_pair",
  seed: 8,
});
const latestResult = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [selectedWeather, selectedEt0, olderWeather, olderEt0],
}));
check(
  latestResult.status === "SELECTED"
    && latestResult.trace.matching_pair_count === 2
    && latestResult.window.weather_snapshot_ref === selectedWeather.source_record_id
    && latestResult.window.et0_snapshot_ref === selectedEt0.source_record_id,
  "matching pairs sort by availability then issued time before source-record tie breakers",
);

const rangeResults = buildCap04FutureForcing24TickInputsV1().map((input) => selectCap04FutureForcingWindowV1(input));
check(rangeResults.every((result) => result.status === "SELECTED"), "all 24 standard Replay ticks select an independent complete pair");
const targetTimes = new Set<string>();
for (const result of rangeResults) {
  if (result.status === "SELECTED") for (const point of result.window.points) targetTimes.add(point.target_time);
}
const orderedTargetTimes = [...targetTimes].sort();
check(
  orderedTargetTimes.length === 95
    && orderedTargetTimes[0] === "2026-06-03T03:00:00.000Z"
    && orderedTargetTimes[94] === "2026-06-07T01:00:00.000Z",
  "24 forcing windows produce the exact 95-hour target union",
);

console.log(`MCFT-CAP-04 future forcing: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
