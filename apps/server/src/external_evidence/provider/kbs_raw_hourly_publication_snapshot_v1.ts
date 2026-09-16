// MCFT-CAP-09 KBS Raw Hourly retained full-table publication snapshot inspector.
// Metadata-only product bridge over the product scientific core. No provider request,
// database access, raw retention, canonical Evidence write, cadence authority, or runtime activation.

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

export const MCFT_CAP09_KBS_PUBLICATION_SNAPSHOT_INSPECTOR_ID_V1 =
  "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_SNAPSHOT_INSPECTOR_V1" as const;

export type KbsRawHourlyPublicationSnapshotInventoryV1 = {
  schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_inventory_v1";
  endpoint_shape: "COMPLETE_ACCUMULATED_TABLE";
  parsed_row_count: number;
  valid_row_count: number;
  unique_event_time_count: number;
  latest_event_time: string;
  latest_event_row_count: number;
  latest_event_row_variant_count: number;
  latest_event_row_identity_hash: string;
  event_index_sha256: string;
  raw_values_emitted: false;
};

export type KbsRawHourlyPublicationForwardDeltaV1 = {
  schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_forward_delta_v1";
  status: "NO_CHANGE" | "FORWARD_DELTA" | "AMBIGUOUS_FORWARD";
  baseline_latest_event_time: string;
  current_latest_event_time: string;
  forward_event_count: number;
  forward_event_times: readonly string[];
  forward_event_rows: readonly {
    event_time: string;
    row_count: number;
    row_variant_count: number;
    row_identity_hash: string;
  }[];
  ambiguous_forward_event_times: readonly string[];
  revision_or_backfill_auto_promotion_authorized: false;
  raw_values_emitted: false;
};

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function digestV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(code);
  return value;
}

function positiveIntegerV1(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function nonNegativeIntegerV1(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(code);
  return Number(value);
}

function validateInventoryV1(value: unknown): KbsRawHourlyPublicationSnapshotInventoryV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("KBS_PUBLICATION_SNAPSHOT_INVENTORY_OBJECT_REQUIRED");
  }
  const row = value as Record<string, unknown>;
  if (row.schema_version !== "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_inventory_v1") {
    throw new Error("KBS_PUBLICATION_SNAPSHOT_INVENTORY_SCHEMA_INVALID");
  }
  if (row.endpoint_shape !== "COMPLETE_ACCUMULATED_TABLE" || row.raw_values_emitted !== false) {
    throw new Error("KBS_PUBLICATION_SNAPSHOT_INVENTORY_BOUNDARY_INVALID");
  }
  const latest = canonicalHourV1(row.latest_event_time, "KBS_PUBLICATION_SNAPSHOT_LATEST_INVALID");
  const parsed = positiveIntegerV1(row.parsed_row_count, "KBS_PUBLICATION_SNAPSHOT_PARSED_COUNT_INVALID");
  const valid = positiveIntegerV1(row.valid_row_count, "KBS_PUBLICATION_SNAPSHOT_VALID_COUNT_INVALID");
  const unique = positiveIntegerV1(row.unique_event_time_count, "KBS_PUBLICATION_SNAPSHOT_UNIQUE_COUNT_INVALID");
  if (valid > parsed || unique > valid) throw new Error("KBS_PUBLICATION_SNAPSHOT_COUNT_ORDER_INVALID");
  return {
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_snapshot_inventory_v1",
    endpoint_shape: "COMPLETE_ACCUMULATED_TABLE",
    parsed_row_count: parsed,
    valid_row_count: valid,
    unique_event_time_count: unique,
    latest_event_time: latest,
    latest_event_row_count: positiveIntegerV1(row.latest_event_row_count, "KBS_PUBLICATION_SNAPSHOT_LATEST_ROW_COUNT_INVALID"),
    latest_event_row_variant_count: positiveIntegerV1(row.latest_event_row_variant_count, "KBS_PUBLICATION_SNAPSHOT_LATEST_VARIANT_COUNT_INVALID"),
    latest_event_row_identity_hash: digestV1(row.latest_event_row_identity_hash, "KBS_PUBLICATION_SNAPSHOT_LATEST_HASH_INVALID"),
    event_index_sha256: digestV1(row.event_index_sha256, "KBS_PUBLICATION_SNAPSHOT_INDEX_HASH_INVALID"),
    raw_values_emitted: false,
  };
}

function validateForwardDeltaV1(value: unknown, after: string): KbsRawHourlyPublicationForwardDeltaV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("KBS_PUBLICATION_FORWARD_DELTA_OBJECT_REQUIRED");
  }
  const row = value as Record<string, unknown>;
  if (row.schema_version !== "geox_mcft_cap09_kbs_raw_hourly_publication_forward_delta_v1") {
    throw new Error("KBS_PUBLICATION_FORWARD_DELTA_SCHEMA_INVALID");
  }
  if (!["NO_CHANGE", "FORWARD_DELTA", "AMBIGUOUS_FORWARD"].includes(String(row.status))) {
    throw new Error("KBS_PUBLICATION_FORWARD_DELTA_STATUS_INVALID");
  }
  if (canonicalHourV1(row.baseline_latest_event_time, "KBS_PUBLICATION_FORWARD_BASELINE_INVALID") !== after) {
    throw new Error("KBS_PUBLICATION_FORWARD_BASELINE_MISMATCH");
  }
  const currentLatest = canonicalHourV1(row.current_latest_event_time, "KBS_PUBLICATION_FORWARD_CURRENT_LATEST_INVALID");
  if (Date.parse(currentLatest) < Date.parse(after)) throw new Error("KBS_PUBLICATION_FORWARD_LATEST_REGRESSION");
  if (!Array.isArray(row.forward_event_times) || !Array.isArray(row.forward_event_rows) || !Array.isArray(row.ambiguous_forward_event_times)) {
    throw new Error("KBS_PUBLICATION_FORWARD_ARRAYS_REQUIRED");
  }
  const events = row.forward_event_times.map((event) => canonicalHourV1(event, "KBS_PUBLICATION_FORWARD_EVENT_INVALID"));
  if (new Set(events).size !== events.length || [...events].sort().join("\0") !== events.join("\0")) {
    throw new Error("KBS_PUBLICATION_FORWARD_EVENTS_ORDER_OR_DUPLICATE");
  }
  const count = nonNegativeIntegerV1(row.forward_event_count, "KBS_PUBLICATION_FORWARD_COUNT_INVALID");
  if (count !== events.length || row.forward_event_rows.length !== count) {
    throw new Error("KBS_PUBLICATION_FORWARD_COUNT_MISMATCH");
  }
  const rows = row.forward_event_rows.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("KBS_PUBLICATION_FORWARD_ROW_INVALID");
    const source = item as Record<string, unknown>;
    const eventTime = canonicalHourV1(source.event_time, "KBS_PUBLICATION_FORWARD_ROW_EVENT_INVALID");
    if (eventTime !== events[index]) throw new Error("KBS_PUBLICATION_FORWARD_ROW_EVENT_MISMATCH");
    return {
      event_time: eventTime,
      row_count: positiveIntegerV1(source.row_count, "KBS_PUBLICATION_FORWARD_ROW_COUNT_INVALID"),
      row_variant_count: positiveIntegerV1(source.row_variant_count, "KBS_PUBLICATION_FORWARD_ROW_VARIANT_COUNT_INVALID"),
      row_identity_hash: digestV1(source.row_identity_hash, "KBS_PUBLICATION_FORWARD_ROW_HASH_INVALID"),
    };
  });
  const ambiguous = row.ambiguous_forward_event_times.map((event) =>
    canonicalHourV1(event, "KBS_PUBLICATION_FORWARD_AMBIGUOUS_EVENT_INVALID")
  );
  const expectedStatus = count === 0
    ? "NO_CHANGE"
    : ambiguous.length > 0
      ? "AMBIGUOUS_FORWARD"
      : "FORWARD_DELTA";
  if (row.status !== expectedStatus) throw new Error("KBS_PUBLICATION_FORWARD_STATUS_MISMATCH");
  if (row.revision_or_backfill_auto_promotion_authorized !== false || row.raw_values_emitted !== false) {
    throw new Error("KBS_PUBLICATION_FORWARD_BOUNDARY_INVALID");
  }
  return {
    schema_version: "geox_mcft_cap09_kbs_raw_hourly_publication_forward_delta_v1",
    status: row.status as KbsRawHourlyPublicationForwardDeltaV1["status"],
    baseline_latest_event_time: after,
    current_latest_event_time: currentLatest,
    forward_event_count: count,
    forward_event_times: events,
    forward_event_rows: rows,
    ambiguous_forward_event_times: ambiguous,
    revision_or_backfill_auto_promotion_authorized: false,
    raw_values_emitted: false,
  };
}

export class KbsRawHourlyPublicationSnapshotInspectorV1 {
  readonly inspector_id = MCFT_CAP09_KBS_PUBLICATION_SNAPSHOT_INSPECTOR_ID_V1;
  private readonly pythonExecutable: string;
  private readonly scientificCorePath: string;

  constructor(config: Pick<KbsRawHourlyDecoderConfigV1, "python_executable" | "scientific_core_path"> = {}) {
    this.pythonExecutable = config.python_executable?.trim() || "python3";
    this.scientificCorePath = path.resolve(
      config.scientific_core_path?.trim() || MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1,
    );
  }

  private async runV1(input: {
    command: "inspect-snapshot" | "diff-forward";
    raw_bytes: Uint8Array;
    available_at: string;
    after?: string;
  }): Promise<unknown> {
    const availableAt = canonicalIsoV1(input.available_at, "KBS_PUBLICATION_INSPECTOR_AVAILABLE_AT_INVALID");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-kbs-publication-"));
    const rawPath = path.join(temp, "raw-hourly.csv");
    const outPath = path.join(temp, "result.json");
    try {
      fs.writeFileSync(rawPath, Buffer.from(input.raw_bytes));
      const args = [
        this.scientificCorePath,
        input.command,
        "--available-at", availableAt,
        "--input", rawPath,
        "--output", outPath,
      ];
      if (input.command === "diff-forward") {
        args.push("--after", canonicalHourV1(input.after, "KBS_PUBLICATION_INSPECTOR_AFTER_INVALID"));
      }
      await execFileAsync(this.pythonExecutable, args, {
        cwd: process.cwd(),
        maxBuffer: 4 * 1024 * 1024,
        timeout: 120_000,
      });
      return JSON.parse(fs.readFileSync(outPath, "utf8"));
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }

  async inspectSnapshot(input: {
    raw_bytes: Uint8Array;
    available_at: string;
  }): Promise<KbsRawHourlyPublicationSnapshotInventoryV1> {
    return validateInventoryV1(await this.runV1({
      command: "inspect-snapshot",
      raw_bytes: input.raw_bytes,
      available_at: input.available_at,
    }));
  }

  async diffForward(input: {
    raw_bytes: Uint8Array;
    available_at: string;
    after_event_time: string;
  }): Promise<KbsRawHourlyPublicationForwardDeltaV1> {
    const after = canonicalHourV1(input.after_event_time, "KBS_PUBLICATION_INSPECTOR_AFTER_INVALID");
    return validateForwardDeltaV1(await this.runV1({
      command: "diff-forward",
      raw_bytes: input.raw_bytes,
      available_at: input.available_at,
      after,
    }), after);
  }
}
