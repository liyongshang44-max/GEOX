// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_FUTURE_FORCING_NEGATIVE.ts
// Purpose: prove CAP-04 S2 rejects cross-cycle stitching, unavailable or incomplete windows, conflicting snapshots/cycles, unauthorized bindings, scope drift, and forcing-window hash or order corruption.
// Boundary: pure negative acceptance only; no database, filesystem, network, environment, wall clock, Forecast equations, Scenario equations, or canonical writes.

import {
  CAP04_FUTURE_FORCING_BLOCK_REASON_V1,
  validateCap04ForecastForcingWindowV1,
} from "../../apps/server/src/domain/twin_runtime/future_forcing_contracts_v1.js";
import { selectCap04FutureForcingWindowV1 } from "../../apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.js";
import {
  CAP04_S2_FIRST_LOGICAL_TIME_V1,
  buildCap04FutureForcingSelectorInputV1,
  buildCap04FutureForcingSnapshotV1,
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

function expectThrow(action: () => void, code: string, message: string): void {
  try {
    action();
    check(false, message);
  } catch (error) {
    check(error instanceof Error && error.message.startsWith(code), message);
  }
}

const selectedInput = buildCap04FutureForcingSelectorInputV1();
const selectedWeather = selectedInput.candidate_records.find((record) => record.source_record_id.startsWith("weather_selected_"));
const selectedEt0 = selectedInput.candidate_records.find((record) => record.source_record_id.startsWith("et0_selected_"));
if (!selectedWeather || !selectedEt0) throw new Error("CAP04_S2_SELECTED_FIXTURE_RECORDS_MISSING");

const mismatchedEt0 = buildCap04FutureForcingSnapshotV1({
  kind: "et0",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: "2026-06-03T00:44:00.000Z",
  available_to_runtime_at: "2026-06-03T01:05:00.000Z",
  source_record_id: "et0_mismatched_cycle",
});
const crossCycle = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [selectedWeather, mismatchedEt0],
}));
check(
  crossCycle.status === "BLOCKED" && crossCycle.reason_codes[0] === CAP04_FUTURE_FORCING_BLOCK_REASON_V1,
  "weather and ET0 from different forcing cycles cannot be stitched",
);

const futureWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: "2026-06-03T01:45:00.000Z",
  available_to_runtime_at: "2026-06-03T02:05:00.000Z",
  source_record_id: "weather_available_after_t",
});
const futureEt0 = buildCap04FutureForcingSnapshotV1({
  kind: "et0",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: "2026-06-03T01:45:00.000Z",
  available_to_runtime_at: "2026-06-03T02:05:00.000Z",
  source_record_id: "et0_available_after_t",
});
const futureOnly = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [futureWeather, futureEt0],
}));
check(
  futureOnly.status === "BLOCKED" && futureOnly.trace.excluded_reason_counts.FORCING_AVAILABLE_AFTER_LOGICAL_TIME === 2,
  "snapshots available after T are excluded by no-future-leakage",
);

const shortWeatherPoints = structuredClone(selectedWeather.canonical_payload.points as Array<Record<string, unknown>>).slice(0, 71);
const shortWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_71_points",
  points_override: shortWeatherPoints,
});
const shortWindow = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [shortWeather, selectedEt0],
}));
check(
  shortWindow.status === "BLOCKED" && shortWindow.trace.excluded_reason_counts.FORCING_POINTS_NOT_EXACT_72_HOURLY === 1,
  "71-point snapshot cannot form a complete forcing pair",
);

const gapPoints = structuredClone(selectedWeather.canonical_payload.points as Array<Record<string, unknown>>);
gapPoints[20] = { ...gapPoints[20], valid_from: "2026-06-04T00:30:00.000Z" };
const gapWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_gap",
  points_override: gapPoints,
});
const gapWindow = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [gapWeather, selectedEt0],
}));
check(gapWindow.status === "BLOCKED", "hour gap or overlap cannot form a complete forcing pair");

const conflictingWeatherA = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_conflict_a",
  seed: 1,
});
const conflictingWeatherB = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_conflict_b",
  seed: 2,
});
expectThrow(
  () => selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({ candidate_records: [conflictingWeatherA, conflictingWeatherB, selectedEt0] })),
  "CONFLICTING_FORCING_SNAPSHOT",
  "same semantic snapshot identity with different canonical payload is rejected",
);

const alternateOriginWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_alternate_origin",
  origin_source_id: "origin_weather_alternate",
  seed: 1,
});
expectThrow(
  () => selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({ candidate_records: [selectedWeather, alternateOriginWeather, selectedEt0] })),
  "CONFLICTING_FORCING_CYCLE",
  "multiple non-collapsible weather snapshots in one cycle are rejected",
);

const wrongScopeWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_wrong_scope",
  scope_override: { zone_id: "zone_other" },
});
const wrongScope = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [wrongScopeWeather, selectedEt0],
}));
check(wrongScope.status === "BLOCKED", "scope mismatch cannot form a forcing pair");

const unauthorizedWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_unauthorized",
  binding_id: "binding_weather_unauthorized",
});
const unauthorized = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [unauthorizedWeather, selectedEt0],
}));
check(unauthorized.status === "BLOCKED", "unauthorized binding cannot form a forcing pair");

const failedQualityWeather = buildCap04FutureForcingSnapshotV1({
  kind: "weather",
  logical_time: CAP04_S2_FIRST_LOGICAL_TIME_V1,
  issued_at: String(selectedWeather.role_time.issued_at),
  available_to_runtime_at: selectedWeather.available_to_runtime_at,
  source_record_id: "weather_quality_fail",
  quality_status: "FAIL",
});
const qualityFail = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [failedQualityWeather, selectedEt0],
}));
check(qualityFail.status === "BLOCKED", "quality FAIL snapshot cannot form a forcing pair");

const selectedResult = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [selectedWeather, selectedEt0],
}));
if (selectedResult.status !== "SELECTED") throw new Error("CAP04_S2_SELECTED_WINDOW_REQUIRED");
const forgedHash = structuredClone(selectedResult.window);
forgedHash.forcing_window_hash = "sha256:forged";
expectThrow(() => validateCap04ForecastForcingWindowV1(forgedHash), "CAP04_FORCING_WINDOW_HASH_MISMATCH", "forged forcing_window_hash is rejected");

const reordered = structuredClone(selectedResult.window);
[reordered.points[0], reordered.points[1]] = [reordered.points[1], reordered.points[0]];
expectThrow(() => validateCap04ForecastForcingWindowV1(reordered), "CAP04_FORCING_HORIZON_MISMATCH", "reordered forcing points are rejected");

const futureObservedRainfall = structuredClone(selectedWeather);
futureObservedRainfall.record_type = "observed_rainfall_v1";
futureObservedRainfall.source_record_id = "future_actual_rainfall_forbidden";
futureObservedRainfall.available_to_runtime_at = "2026-06-03T03:00:00.000Z";
const ignoredActual = selectCap04FutureForcingWindowV1(buildCap04FutureForcingSelectorInputV1({
  candidate_records: [selectedWeather, selectedEt0, futureObservedRainfall],
}));
check(
  ignoredActual.status === "SELECTED" && ignoredActual.trace.candidate_snapshot_count === 2,
  "future actual observations are outside the forcing selector authority",
);

console.log(`MCFT-CAP-04 future forcing negative: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) process.exit(1);
