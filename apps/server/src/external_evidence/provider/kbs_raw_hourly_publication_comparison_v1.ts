// MCFT-CAP-09 KBS Raw Hourly retained publication snapshot comparison.
// Compares previous/current already-retained complete-table bytes in the product scientific core.
// No provider request, raw-store mutation, database access, canonical Evidence write, or runtime activation.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1,
  type KbsRawHourlyDecoderConfigV1,
} from "./kbs_raw_hourly_live_provider_v1.js";

const execFileAsync = promisify(execFile);

export const MCFT_CAP09_KBS_PUBLICATION_SNAPSHOT_COMPARISON_ID_V1 =
  "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_SNAPSHOT_COMPARISON_V1" as const;

export type KbsRawHourlyPublicationHistoricalDriftKindV1 =
  | "ADDED_BEFORE_OR_AT_BASELINE"
  | "REMOVED_BEFORE_OR_AT_BASELINE"
  | "CHANGED_BEFORE_OR_AT_BASELINE";

export type KbsRawHourlyPublicationSnapshotComparisonResultV1 = {
  schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_comparison_v1";
  status: "NO_CHANGE" | "FORWARD_DELTA" | "AMBIGUOUS_FORWARD" | "HISTORICAL_DRIFT";
  baseline_latest_event_time: string;
  previous_latest_event_time: string;
  current_latest_event_time: string;
  historical_prefix_exact_match: boolean;
  historical_drift_count: number;
  historical_drift: readonly {
    event_time: string;
    kind: KbsRawHourlyPublicationHistoricalDriftKindV1;
  }[];
  forward_event_count: number;
  forward_event_times: readonly string[];
  forward_event_rows: readonly {
    event_time: string;
    row_count: number;
    row_variant_count: number;
    row_identity_hash: string;
  }[];
  ambiguous_forward_event_times: readonly string[];
  historical_revision_or_backfill_auto_promotion_authorized: false;
  raw_values_emitted: false;
};

function isoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}
function hourV1(value: unknown, code: string): string {
  const text = isoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function digestV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(code);
  return value;
}
function nonNegativeIntegerV1(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(code);
  return Number(value);
}
function positiveIntegerV1(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function validateComparisonV1(
  value: unknown,
  expectedBaseline: string,
): KbsRawHourlyPublicationSnapshotComparisonResultV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("KBS_PUBLICATION_COMPARISON_OBJECT_REQUIRED");
  }
  const row = value as Record<string, unknown>;
  if (row.schema_version !== "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_comparison_v1") {
    throw new Error("KBS_PUBLICATION_COMPARISON_SCHEMA_INVALID");
  }
  const allowed = ["NO_CHANGE", "FORWARD_DELTA", "AMBIGUOUS_FORWARD", "HISTORICAL_DRIFT"];
  if (!allowed.includes(String(row.status))) throw new Error("KBS_PUBLICATION_COMPARISON_STATUS_INVALID");
  const baseline = hourV1(row.baseline_latest_event_time, "KBS_PUBLICATION_COMPARISON_BASELINE_INVALID");
  if (baseline !== expectedBaseline) throw new Error("KBS_PUBLICATION_COMPARISON_BASELINE_MISMATCH");
  const previousLatest = hourV1(row.previous_latest_event_time, "KBS_PUBLICATION_COMPARISON_PREVIOUS_LATEST_INVALID");
  if (previousLatest !== baseline) throw new Error("KBS_PUBLICATION_COMPARISON_PREVIOUS_LATEST_MISMATCH");
  const currentLatest = hourV1(row.current_latest_event_time, "KBS_PUBLICATION_COMPARISON_CURRENT_LATEST_INVALID");
  if (Date.parse(currentLatest) < Date.parse(baseline)) throw new Error("KBS_PUBLICATION_COMPARISON_LATEST_REGRESSION");
  if (!Array.isArray(row.historical_drift) || !Array.isArray(row.forward_event_times)
      || !Array.isArray(row.forward_event_rows) || !Array.isArray(row.ambiguous_forward_event_times)) {
    throw new Error("KBS_PUBLICATION_COMPARISON_ARRAYS_REQUIRED");
  }

  const drift = row.historical_drift.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("KBS_PUBLICATION_COMPARISON_DRIFT_ITEM_INVALID");
    }
    const source = item as Record<string, unknown>;
    const kind = String(source.kind) as KbsRawHourlyPublicationHistoricalDriftKindV1;
    if (!["ADDED_BEFORE_OR_AT_BASELINE","REMOVED_BEFORE_OR_AT_BASELINE","CHANGED_BEFORE_OR_AT_BASELINE"].includes(kind)) {
      throw new Error("KBS_PUBLICATION_COMPARISON_DRIFT_KIND_INVALID");
    }
    const eventTime = hourV1(source.event_time, "KBS_PUBLICATION_COMPARISON_DRIFT_EVENT_INVALID");
    if (Date.parse(eventTime) > Date.parse(baseline)) throw new Error("KBS_PUBLICATION_COMPARISON_DRIFT_AFTER_BASELINE");
    return { event_time: eventTime, kind };
  });
  const driftCount = nonNegativeIntegerV1(row.historical_drift_count, "KBS_PUBLICATION_COMPARISON_DRIFT_COUNT_INVALID");
  if (driftCount !== drift.length) throw new Error("KBS_PUBLICATION_COMPARISON_DRIFT_COUNT_MISMATCH");
  if (row.historical_prefix_exact_match !== (driftCount === 0)) {
    throw new Error("KBS_PUBLICATION_COMPARISON_PREFIX_MATCH_MISMATCH");
  }

  const forwardTimes = row.forward_event_times.map((event) =>
    hourV1(event, "KBS_PUBLICATION_COMPARISON_FORWARD_EVENT_INVALID")
  );
  if (new Set(forwardTimes).size !== forwardTimes.length || [...forwardTimes].sort().join("\0") !== forwardTimes.join("\0")) {
    throw new Error("KBS_PUBLICATION_COMPARISON_FORWARD_ORDER_OR_DUPLICATE");
  }
  const forwardRows = row.forward_event_rows.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("KBS_PUBLICATION_COMPARISON_FORWARD_ROW_INVALID");
    }
    const source = item as Record<string, unknown>;
    const eventTime = hourV1(source.event_time, "KBS_PUBLICATION_COMPARISON_FORWARD_ROW_EVENT_INVALID");
    if (eventTime !== forwardTimes[index]) throw new Error("KBS_PUBLICATION_COMPARISON_FORWARD_ROW_EVENT_MISMATCH");
    if (Date.parse(eventTime) <= Date.parse(baseline)) throw new Error("KBS_PUBLICATION_COMPARISON_FORWARD_NOT_AFTER_BASELINE");
    return {
      event_time: eventTime,
      row_count: positiveIntegerV1(source.row_count, "KBS_PUBLICATION_COMPARISON_FORWARD_ROW_COUNT_INVALID"),
      row_variant_count: positiveIntegerV1(source.row_variant_count, "KBS_PUBLICATION_COMPARISON_FORWARD_VARIANT_COUNT_INVALID"),
      row_identity_hash: digestV1(source.row_identity_hash, "KBS_PUBLICATION_COMPARISON_FORWARD_HASH_INVALID"),
    };
  });
  const forwardCount = nonNegativeIntegerV1(row.forward_event_count, "KBS_PUBLICATION_COMPARISON_FORWARD_COUNT_INVALID");
  if (forwardCount !== forwardTimes.length || forwardRows.length !== forwardCount) {
    throw new Error("KBS_PUBLICATION_COMPARISON_FORWARD_COUNT_MISMATCH");
  }
  const ambiguous = row.ambiguous_forward_event_times.map((event) =>
    hourV1(event, "KBS_PUBLICATION_COMPARISON_AMBIGUOUS_EVENT_INVALID")
  );
  const expectedStatus = driftCount > 0
    ? "HISTORICAL_DRIFT"
    : ambiguous.length > 0
      ? "AMBIGUOUS_FORWARD"
      : forwardCount > 0
        ? "FORWARD_DELTA"
        : "NO_CHANGE";
  if (row.status !== expectedStatus) throw new Error("KBS_PUBLICATION_COMPARISON_STATUS_PRECEDENCE_MISMATCH");
  if (
    row.historical_revision_or_backfill_auto_promotion_authorized !== false
    || row.raw_values_emitted !== false
  ) throw new Error("KBS_PUBLICATION_COMPARISON_NON_EFFECT_BOUNDARY_INVALID");

  return {
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_comparison_v1",
    status: expectedStatus,
    baseline_latest_event_time: baseline,
    previous_latest_event_time: previousLatest,
    current_latest_event_time: currentLatest,
    historical_prefix_exact_match: driftCount === 0,
    historical_drift_count: driftCount,
    historical_drift: drift,
    forward_event_count: forwardCount,
    forward_event_times: forwardTimes,
    forward_event_rows: forwardRows,
    ambiguous_forward_event_times: ambiguous,
    historical_revision_or_backfill_auto_promotion_authorized: false,
    raw_values_emitted: false,
  };
}

export class KbsRawHourlyPublicationSnapshotComparisonV1 {
  readonly comparison_id = MCFT_CAP09_KBS_PUBLICATION_SNAPSHOT_COMPARISON_ID_V1;
  private readonly pythonExecutable: string;
  private readonly scientificCorePath: string;

  constructor(config: Pick<KbsRawHourlyDecoderConfigV1, "python_executable" | "scientific_core_path"> = {}) {
    this.pythonExecutable = config.python_executable?.trim() || "python3";
    this.scientificCorePath = path.resolve(
      config.scientific_core_path?.trim() || MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1,
    );
  }

  async compare(input: {
    previous_raw_bytes: Uint8Array;
    previous_available_at: string;
    current_raw_bytes: Uint8Array;
    current_available_at: string;
    baseline_latest_event_time: string;
  }): Promise<KbsRawHourlyPublicationSnapshotComparisonResultV1> {
    const previousAvailable = isoV1(input.previous_available_at, "KBS_PUBLICATION_COMPARISON_PREVIOUS_AVAILABLE_INVALID");
    const currentAvailable = isoV1(input.current_available_at, "KBS_PUBLICATION_COMPARISON_CURRENT_AVAILABLE_INVALID");
    if (Date.parse(currentAvailable) < Date.parse(previousAvailable)) {
      throw new Error("KBS_PUBLICATION_COMPARISON_AVAILABLE_TIME_REGRESSION");
    }
    const baseline = hourV1(input.baseline_latest_event_time, "KBS_PUBLICATION_COMPARISON_BASELINE_INVALID");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-kbs-compare-"));
    const previousPath = path.join(temp, "previous.csv");
    const currentPath = path.join(temp, "current.csv");
    const outputPath = path.join(temp, "comparison.json");
    try {
      fs.writeFileSync(previousPath, Buffer.from(input.previous_raw_bytes));
      fs.writeFileSync(currentPath, Buffer.from(input.current_raw_bytes));
      await execFileAsync(this.pythonExecutable, [
        this.scientificCorePath,
        "compare-snapshots",
        "--previous-input", previousPath,
        "--previous-available-at", previousAvailable,
        "--current-input", currentPath,
        "--current-available-at", currentAvailable,
        "--baseline-latest-event-time", baseline,
        "--output", outputPath,
      ], {
        cwd: process.cwd(),
        maxBuffer: 4 * 1024 * 1024,
        timeout: 120_000,
      });
      return validateComparisonV1(JSON.parse(fs.readFileSync(outputPath, "utf8")), baseline);
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}
