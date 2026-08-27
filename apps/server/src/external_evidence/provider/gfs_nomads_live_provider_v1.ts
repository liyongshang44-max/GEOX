// MCFT-CAP-09 product GFS/NOMADS acquisition provider.
// Boundary: source discovery and byte acquisition only. Scientific decoding remains in
// mcft_cap09_gfs_scientific_core_v1.py. Raw retention is deliberately outside this module
// so orchestration can retain each response before parsing or scientific decode.

import { createHash } from "node:crypto";
import { setTimeout as waitTimeoutV1 } from "node:timers/promises";

import {
  ControlledHttpsByteClientV1,
  type ControlledHttpsByteResponseV1,
} from "./https_external_evidence_transport_v1.js";

export const MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1 =
  "MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_V1" as const;

export const MCFT_CAP09_GFS_ACQUISITION_AUTHORITY_REF_V1 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json" as const;

export const MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1 = 10_000 as const;
export const MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_RESPONSIBLE_SHARING_REF_V1 =
  "https://nomads.ncep.noaa.gov/info.php?page=gribfilter" as const;

export type GfsNomadsGribFilterCadencePortV1 = {
  now_ms(): number;
  wait_ms(milliseconds: number): Promise<void>;
};

export const MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1 = Object.freeze({
  production_root: "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod",
  pgrb2_filter: "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl",
  allowed_final_hosts: ["nomads.ncep.noaa.gov"] as const,
  point_count: 72,
  max_lead: 120,
  pgrb2_grid_latitude: 42.5,
  pgrb2_grid_longitude_native: 274.75,
  candidate_lookback_hours: 48,
  max_directory_bytes: 20_000_000,
  max_pgrb2_bytes: 20_000_000,
  max_sflux_idx_bytes: 2_000_000,
  max_sflux_message_bytes: 12_000_000,
  same_exact_cycle_required: true,
  future_file_waiting_forbidden: true,
  cross_cycle_substitution_authorized: false,
});

export type GfsDirectoryEntryV1 = {
  basename: string;
  observed_minute: string;
  availability_upper_bound: string;
  size_bytes: number;
};

export type GfsDirectoryInventoryV1 = ReadonlyMap<string, readonly GfsDirectoryEntryV1[]>;

export type GfsCycleWindowV1 = {
  cycle: string;
  lead_start: number;
  lead_end: number;
  support_lead: number;
};

export type GfsCycleSelectionV1 = GfsCycleWindowV1 & {
  directory_sha256: string;
  rejected_cycles: readonly { cycle: string; reason: string }[];
};

export type GfsSfluxIndexSelectionV1 = {
  lead: number;
  offset: number;
  end: number;
  length: number;
  line_sha256: string;
};

export type GfsNomadsRawObjectV1 = {
  kind: "GFS_DIRECTORY_LISTING" | "GFS_PGRB2_FILTER_RESPONSE" | "GFS_SFLUX_IDX" | "GFS_SFLUX_EXACT_GRIB_MESSAGE";
  identity: string;
  response: ControlledHttpsByteResponseV1;
  sha256: string;
};

export type GfsNomadsLiveProviderConfigV1 = {
  byte_client: ControlledHttpsByteClientV1;
  grib_filter_cadence?: GfsNomadsGribFilterCadencePortV1;
};

function requireConditionV1(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function canonicalUtcHourV1(value: Date | string, code: string): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  requireConditionV1(Number.isFinite(date.getTime()), code);
  requireConditionV1(
    date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0,
    `${code}_CANONICAL_HOUR_REQUIRED`,
  );
  return date;
}

function isoV1(value: Date): string {
  return value.toISOString().replace(".000Z", "Z");
}

function sha256V1(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function basenameFromHrefV1(href: string): string {
  const rawPath = href.split("?", 1)[0]?.split("#", 1)[0] ?? "";
  const raw = rawPath.slice(rawPath.lastIndexOf("/") + 1);
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function parseDirectorySizeV1(token: string): number {
  const match = token.trim().match(/^([0-9]+(?:\.[0-9]+)?)([KMGTP]?)$/i);
  requireConditionV1(Boolean(match), "MCFT_CAP09_GFS_DIRECTORY_SIZE_UNPARSEABLE");
  const value = Number(match![1]);
  const power = ({ "": 0, K: 1, M: 2, G: 3, T: 4, P: 5 } as const)[match![2]!.toUpperCase() as "" | "K" | "M" | "G" | "T" | "P"];
  const bytes = value * 1024 ** power;
  requireConditionV1(Number.isFinite(bytes) && bytes > 0, "MCFT_CAP09_GFS_DIRECTORY_SIZE_INVALID");
  return bytes;
}

const MONTHS_V1: Readonly<Record<string, number>> = Object.freeze({
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
});

function parseDirectoryMinuteV1(value: string): Date {
  const match = value.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2})$/);
  requireConditionV1(Boolean(match), "MCFT_CAP09_GFS_DIRECTORY_TIMESTAMP_INVALID");
  const month = MONTHS_V1[match![2]!];
  requireConditionV1(month !== undefined, "MCFT_CAP09_GFS_DIRECTORY_MONTH_INVALID");
  const date = new Date(Date.UTC(Number(match![3]), month, Number(match![1]), Number(match![4]), Number(match![5])));
  requireConditionV1(Number.isFinite(date.getTime()), "MCFT_CAP09_GFS_DIRECTORY_TIMESTAMP_INVALID");
  return date;
}

function escapeRegexV1(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseGfsDirectoryInventoryV1(body: Uint8Array): GfsDirectoryInventoryV1 {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  const anchor = /<a\b[^>]*href\s*=\s*["'](?<href>[^"']+)["'][^>]*>.*?<\/a>/gis;
  const object = /^gfs\.t\d{2}z\.(?:pgrb2\.0p25\.f\d{3}|sfluxgrbf\d{3}\.grib2)(?:\.idx)?$/i;
  const stamp = /\b(?<stamp>\d{2}-[A-Za-z]{3}-\d{4}\s+\d{2}:\d{2})\b/;
  const size = /\b(?<size>[0-9]+(?:\.[0-9]+)?[KMGTP]?)\b/i;
  const tag = /<[^>]+>/gs;
  const anchors = [...text.matchAll(anchor)];
  const entries = new Map<string, GfsDirectoryEntryV1[]>();

  anchors.forEach((match, index) => {
    const href = match.groups?.href ?? "";
    const basename = basenameFromHrefV1(href);
    if (!object.test(basename)) return;
    const currentEnd = (match.index ?? 0) + match[0].length;
    const nextStart = index + 1 < anchors.length ? (anchors[index + 1]!.index ?? text.length) : text.length;
    const tail = text.slice(currentEnd, Math.min(nextStart, currentEnd + 1200)).replace(tag, " ").replace(/\s+/g, " ");
    const stampMatch = tail.match(stamp);
    if (!stampMatch?.groups?.stamp) return;
    const afterStamp = tail.slice((stampMatch.index ?? 0) + stampMatch[0].length);
    const sizeMatch = afterStamp.match(size);
    if (!sizeMatch?.groups?.size) return;
    const minute = parseDirectoryMinuteV1(stampMatch.groups.stamp);
    const row: GfsDirectoryEntryV1 = {
      basename,
      observed_minute: isoV1(minute),
      availability_upper_bound: new Date(minute.getTime() + 59_999).toISOString(),
      size_bytes: parseDirectorySizeV1(sizeMatch.groups.size),
    };
    const rows = entries.get(basename) ?? [];
    rows.push(row);
    entries.set(basename, rows);
  });

  requireConditionV1(entries.size > 0, "MCFT_CAP09_GFS_DIRECTORY_ENTRIES_REQUIRED");
  return entries;
}

export function candidateGfsCyclesV1(tick: Date | string): readonly string[] {
  const target = canonicalUtcHourV1(tick, "MCFT_CAP09_GFS_TICK_INVALID");
  const out: string[] = [];
  for (let back = 0; back <= MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.candidate_lookback_hours; back += 1) {
    const candidate = new Date(target.getTime() - back * 3_600_000);
    if ([0, 6, 12, 18].includes(candidate.getUTCHours())) out.push(isoV1(candidate));
  }
  return out;
}

export function gfsLeadWindowV1(tick: Date | string, cycle: Date | string): GfsCycleWindowV1 {
  const target = canonicalUtcHourV1(tick, "MCFT_CAP09_GFS_TICK_INVALID");
  const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
  const deltaHours = (target.getTime() - issue.getTime()) / 3_600_000;
  requireConditionV1(Number.isInteger(deltaHours), "MCFT_CAP09_GFS_CYCLE_TICK_ALIGNMENT_REQUIRED");
  const leadStart = deltaHours + 1;
  const leadEnd = leadStart + MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.point_count - 1;
  const support = leadStart - 1;
  requireConditionV1(support >= 0 && leadEnd <= MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_lead, "MCFT_CAP09_GFS_LEAD_WINDOW_UNSUPPORTED");
  return { cycle: isoV1(issue), lead_start: leadStart, lead_end: leadEnd, support_lead: support };
}

export function gfsPgrb2NamesV1(cycle: Date | string, lead: number): readonly [string, string] {
  const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
  requireConditionV1(Number.isInteger(lead) && lead >= 0 && lead <= MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_lead, "MCFT_CAP09_GFS_LEAD_INVALID");
  const hh = String(issue.getUTCHours()).padStart(2, "0");
  const stem = `gfs.t${hh}z.pgrb2.0p25.f${String(lead).padStart(3, "0")}`;
  return [stem, `${stem}.idx`];
}

export function gfsSfluxNamesV1(cycle: Date | string, lead: number): readonly [string, string] {
  const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
  requireConditionV1(Number.isInteger(lead) && lead >= 0 && lead <= MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_lead, "MCFT_CAP09_GFS_LEAD_INVALID");
  const hh = String(issue.getUTCHours()).padStart(2, "0");
  const stem = `gfs.t${hh}z.sfluxgrbf${String(lead).padStart(3, "0")}.grib2`;
  return [stem, `${stem}.idx`];
}

export function gfsDirectoryUrlV1(cycle: Date | string): string {
  const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
  const ymd = issue.toISOString().slice(0, 10).replaceAll("-", "");
  const hh = String(issue.getUTCHours()).padStart(2, "0");
  return `${MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.production_root}/gfs.${ymd}/${hh}/atmos/`;
}

export function gfsPgrb2FilterUrlV1(cycle: Date | string, lead: number): string {
  const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
  const [filename] = gfsPgrb2NamesV1(issue, lead);
  const ymd = issue.toISOString().slice(0, 10).replaceAll("-", "");
  const hh = String(issue.getUTCHours()).padStart(2, "0");
  const lat = MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.pgrb2_grid_latitude;
  const lon = MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.pgrb2_grid_longitude_native;
  const params = new URLSearchParams([
    ["file", filename],
    ["var_TMP", "on"], ["var_RH", "on"], ["var_UGRD", "on"], ["var_VGRD", "on"], ["var_APCP", "on"],
    ["lev_2_m_above_ground", "on"], ["lev_10_m_above_ground", "on"], ["lev_surface", "on"], ["subregion", ""],
    ["leftlon", (lon - 0.01).toFixed(2)], ["rightlon", (lon + 0.01).toFixed(2)],
    ["toplat", (lat + 0.01).toFixed(2)], ["bottomlat", (lat - 0.01).toFixed(2)],
    ["dir", `/gfs.${ymd}/${hh}/atmos`],
  ]);
  return `${MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.pgrb2_filter}?${params.toString()}`;
}

export function gfsSfluxUrlsV1(cycle: Date | string, lead: number): readonly [string, string] {
  const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
  const [filename] = gfsSfluxNamesV1(issue, lead);
  const ymd = issue.toISOString().slice(0, 10).replaceAll("-", "");
  const hh = String(issue.getUTCHours()).padStart(2, "0");
  const base = `${MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.production_root}/gfs.${ymd}/${hh}/atmos/${filename}`;
  return [base, `${base}.idx`];
}

function requireUniqueAvailableEntryV1(
  inventory: GfsDirectoryInventoryV1,
  basename: string,
  tick: Date,
  code: string,
): void {
  const rows = inventory.get(basename) ?? [];
  requireConditionV1(rows.length === 1 && rows[0]!.size_bytes > 0, `${code}_MISSING:${basename}`);
  requireConditionV1(Date.parse(rows[0]!.availability_upper_bound) <= tick.getTime(), `${code}_AFTER_TICK:${basename}`);
}

export function validateCompleteGfsCycleInventoryV1(
  inventory: GfsDirectoryInventoryV1,
  tick: Date | string,
  cycle: Date | string,
): GfsCycleWindowV1 {
  const target = canonicalUtcHourV1(tick, "MCFT_CAP09_GFS_TICK_INVALID");
  const window = gfsLeadWindowV1(target, cycle);
  for (let lead = window.support_lead; lead <= window.lead_end; lead += 1) {
    for (const name of gfsPgrb2NamesV1(window.cycle, lead)) {
      requireUniqueAvailableEntryV1(inventory, name, target, "MCFT_CAP09_GFS_PGRB2_DIRECTORY_ENTRY");
    }
    for (const name of gfsSfluxNamesV1(window.cycle, lead)) {
      requireUniqueAvailableEntryV1(inventory, name, target, "MCFT_CAP09_GFS_SFLUX_DIRECTORY_ENTRY");
    }
  }
  return window;
}

export function parseGfsSfluxIndexV1(body: Uint8Array, lead: number): GfsSfluxIndexSelectionV1 {
  requireConditionV1(Number.isInteger(lead) && lead >= 0 && lead <= MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_lead, "MCFT_CAP09_GFS_SFLUX_LEAD_INVALID");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const parts = line.split(":");
    if (parts.length < 5 || !/^\d+$/.test(parts[1] ?? "")) return [];
    return [{ offset: Number(parts[1]), parts, line }];
  });
  const expected = `${lead} hour fcst`.toLowerCase();
  const eligible: GfsSfluxIndexSelectionV1[] = [];
  rows.forEach((row, index) => {
    const variableIndex = row.parts.indexOf("DSWRF");
    if (variableIndex < 0 || row.parts[variableIndex + 1] !== "surface" || row.parts[variableIndex + 2]?.trim().toLowerCase() !== expected) return;
    requireConditionV1(index + 1 < rows.length, `MCFT_CAP09_GFS_SFLUX_IDX_LAST_RECORD:F${String(lead).padStart(3, "0")}`);
    const end = rows[index + 1]!.offset - 1;
    const length = end - row.offset + 1;
    requireConditionV1(length > 0, `MCFT_CAP09_GFS_SFLUX_RANGE_INVALID:F${String(lead).padStart(3, "0")}`);
    eligible.push({ lead, offset: row.offset, end, length, line_sha256: sha256V1(new TextEncoder().encode(row.line)) });
  });
  requireConditionV1(eligible.length === 1, `MCFT_CAP09_GFS_SFLUX_INSTANT_RECORD_COUNT:F${String(lead).padStart(3, "0")}:${eligible.length}`);
  requireConditionV1(eligible[0]!.length <= MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_sflux_message_bytes, `MCFT_CAP09_GFS_SFLUX_MESSAGE_TOO_LARGE:F${String(lead).padStart(3, "0")}`);
  return eligible[0]!;
}

function parseLastModifiedV1(response: ControlledHttpsByteResponseV1, code: string): Date {
  const raw = response.response_headers["last-modified"];
  requireConditionV1(Boolean(raw), `${code}_LAST_MODIFIED_REQUIRED`);
  const timestamp = Date.parse(raw!);
  requireConditionV1(Number.isFinite(timestamp), `${code}_LAST_MODIFIED_INVALID`);
  return new Date(timestamp);
}

function rawObjectV1(kind: GfsNomadsRawObjectV1["kind"], identity: string, response: ControlledHttpsByteResponseV1): GfsNomadsRawObjectV1 {
  return { kind, identity, response, sha256: sha256V1(response.bytes) };
}

export class GfsNomadsLiveProviderV1 {
  readonly provider_id = MCFT_CAP09_GFS_NOMADS_LIVE_PROVIDER_ID_V1;
  readonly authority_ref = MCFT_CAP09_GFS_ACQUISITION_AUTHORITY_REF_V1;
  readonly grib_filter_responsible_sharing_ref =
    MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_RESPONSIBLE_SHARING_REF_V1;
  private readonly byteClient: ControlledHttpsByteClientV1;
  private readonly gribFilterCadence: GfsNomadsGribFilterCadencePortV1;
  private lastGribFilterRequestStartedAtMs: number | null = null;
  private gribFilterCadenceGate: Promise<void> = Promise.resolve();

  constructor(config: GfsNomadsLiveProviderConfigV1) {
    this.byteClient = config.byte_client;
    this.gribFilterCadence = config.grib_filter_cadence ?? {
      now_ms: () => Date.now(),
      wait_ms: async (milliseconds) => {
        await waitTimeoutV1(milliseconds);
      },
    };
  }

  private async waitForResponsibleGribFilterCadenceV1(): Promise<void> {
    let releaseCadence!: () => void;
    const prior = this.gribFilterCadenceGate;
    this.gribFilterCadenceGate = new Promise<void>((resolve) => {
      releaseCadence = resolve;
    });
    await prior;
    try {
      const before = this.gribFilterCadence.now_ms();
      requireConditionV1(
        Number.isFinite(before),
        "MCFT_CAP09_GFS_GRIB_FILTER_CADENCE_CLOCK_INVALID",
      );
      if (this.lastGribFilterRequestStartedAtMs !== null) {
        const elapsed = before - this.lastGribFilterRequestStartedAtMs;
        requireConditionV1(
          elapsed >= 0,
          "MCFT_CAP09_GFS_GRIB_FILTER_CADENCE_CLOCK_REGRESSION",
        );
        const remaining =
          MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1 - elapsed;
        if (remaining > 0) await this.gribFilterCadence.wait_ms(remaining);
        const afterWait = this.gribFilterCadence.now_ms();
        requireConditionV1(
          Number.isFinite(afterWait)
            && afterWait - this.lastGribFilterRequestStartedAtMs
              >= MCFT_CAP09_GFS_NOMADS_GRIB_FILTER_MINIMUM_INTERVAL_MS_V1,
          "MCFT_CAP09_GFS_GRIB_FILTER_MINIMUM_INTERVAL_NOT_OBSERVED",
        );
      }
      const started = this.gribFilterCadence.now_ms();
      requireConditionV1(
        Number.isFinite(started),
        "MCFT_CAP09_GFS_GRIB_FILTER_CADENCE_CLOCK_INVALID",
      );
      this.lastGribFilterRequestStartedAtMs = started;
    } finally {
      releaseCadence();
    }
  }

  async fetchDirectoryRaw(cycle: Date | string): Promise<GfsNomadsRawObjectV1> {
    const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
    const response = await this.byteClient.requestBytes({
      locator: gfsDirectoryUrlV1(issue),
      allowed_final_hosts: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.allowed_final_hosts,
      expected_statuses: [200],
      request_headers: { Accept: "text/html,*/*;q=0.5", "Cache-Control": "no-cache" },
      max_bytes: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_directory_bytes,
      error_prefix: "MCFT_CAP09_GFS_DIRECTORY",
    });
    return rawObjectV1("GFS_DIRECTORY_LISTING", isoV1(issue), response);
  }

  async selectLatestCompleteCycle(
    tick: Date | string,
    retain_then_parse: (raw: GfsNomadsRawObjectV1) => Promise<GfsDirectoryInventoryV1>,
  ): Promise<GfsCycleSelectionV1> {
    const target = canonicalUtcHourV1(tick, "MCFT_CAP09_GFS_TICK_INVALID");
    const rejections: { cycle: string; reason: string }[] = [];
    for (const cycle of candidateGfsCyclesV1(target)) {
      try {
        const window = gfsLeadWindowV1(target, cycle);
        const raw = await this.fetchDirectoryRaw(cycle);
        const inventory = await retain_then_parse(raw);
        validateCompleteGfsCycleInventoryV1(inventory, target, cycle);
        return {
          ...window,
          directory_sha256: raw.sha256,
          rejected_cycles: rejections,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        rejections.push({ cycle, reason: reason.slice(0, 240) });
      }
    }
    throw new Error(`MCFT_CAP09_GFS_NO_COMPLETE_CYCLE:${JSON.stringify(rejections)}`);
  }

  async fetchPgrb2FilteredRaw(cycle: Date | string, lead: number): Promise<GfsNomadsRawObjectV1> {
    await this.waitForResponsibleGribFilterCadenceV1();
    const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
    const response = await this.byteClient.requestBytes({
      locator: gfsPgrb2FilterUrlV1(issue, lead),
      allowed_final_hosts: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.allowed_final_hosts,
      expected_statuses: [200],
      request_headers: { Accept: "application/octet-stream,*/*;q=0.5", "Cache-Control": "no-cache" },
      max_bytes: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_pgrb2_bytes,
      error_prefix: `MCFT_CAP09_GFS_PGRB2_F${String(lead).padStart(3, "0")}`,
    });
    requireConditionV1(
      response.bytes.length >= 8 && new TextDecoder("ascii").decode(response.bytes.slice(0, 4)) === "GRIB",
      `MCFT_CAP09_GFS_PGRB2_NOT_GRIB:F${String(lead).padStart(3, "0")}`,
    );
    return rawObjectV1("GFS_PGRB2_FILTER_RESPONSE", `${isoV1(issue)}|F${String(lead).padStart(3, "0")}`, response);
  }

  async fetchSfluxIndexRaw(cycle: Date | string, lead: number, tick: Date | string): Promise<GfsNomadsRawObjectV1> {
    const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
    const target = canonicalUtcHourV1(tick, "MCFT_CAP09_GFS_TICK_INVALID");
    const [, idxUrl] = gfsSfluxUrlsV1(issue, lead);
    const response = await this.byteClient.requestBytes({
      locator: idxUrl,
      allowed_final_hosts: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.allowed_final_hosts,
      expected_statuses: [200],
      request_headers: { Accept: "text/plain,*/*;q=0.5", "Cache-Control": "no-cache" },
      max_bytes: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_sflux_idx_bytes,
      error_prefix: `MCFT_CAP09_GFS_SFLUX_IDX_F${String(lead).padStart(3, "0")}`,
    });
    requireConditionV1(
      parseLastModifiedV1(response, `MCFT_CAP09_GFS_SFLUX_IDX_F${String(lead).padStart(3, "0")}`).getTime() <= target.getTime(),
      `MCFT_CAP09_GFS_SFLUX_IDX_AFTER_TICK:F${String(lead).padStart(3, "0")}`,
    );
    return rawObjectV1("GFS_SFLUX_IDX", `${isoV1(issue)}|F${String(lead).padStart(3, "0")}`, response);
  }

  async fetchSfluxMessageRaw(
    cycle: Date | string,
    lead: number,
    tick: Date | string,
    selected: GfsSfluxIndexSelectionV1,
  ): Promise<GfsNomadsRawObjectV1> {
    const issue = canonicalUtcHourV1(cycle, "MCFT_CAP09_GFS_CYCLE_INVALID");
    const target = canonicalUtcHourV1(tick, "MCFT_CAP09_GFS_TICK_INVALID");
    requireConditionV1(selected.lead === lead, "MCFT_CAP09_GFS_SFLUX_SELECTION_LEAD_MISMATCH");
    const [gribUrl] = gfsSfluxUrlsV1(issue, lead);
    const response = await this.byteClient.requestBytes({
      locator: gribUrl,
      allowed_final_hosts: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.allowed_final_hosts,
      expected_statuses: [206],
      request_headers: { Accept: "application/octet-stream,*/*;q=0.5", "Cache-Control": "no-cache", Range: `bytes=${selected.offset}-${selected.end}` },
      max_bytes: MCFT_CAP09_GFS_NOMADS_AUTHORITY_V1.max_sflux_message_bytes,
      error_prefix: `MCFT_CAP09_GFS_SFLUX_RANGE_F${String(lead).padStart(3, "0")}`,
    });
    const contentRange = response.response_headers["content-range"] ?? "";
    const rangeMatch = contentRange.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
    requireConditionV1(
      Boolean(rangeMatch) && Number(rangeMatch![1]) === selected.offset && Number(rangeMatch![2]) === selected.end,
      `MCFT_CAP09_GFS_SFLUX_CONTENT_RANGE_DRIFT:F${String(lead).padStart(3, "0")}`,
    );
    requireConditionV1(
      parseLastModifiedV1(response, `MCFT_CAP09_GFS_SFLUX_RANGE_F${String(lead).padStart(3, "0")}`).getTime() <= target.getTime(),
      `MCFT_CAP09_GFS_SFLUX_RANGE_AFTER_TICK:F${String(lead).padStart(3, "0")}`,
    );
    const bytes = response.bytes;
    const prefix = new TextDecoder("ascii").decode(bytes.slice(0, 4));
    const suffix = new TextDecoder("ascii").decode(bytes.slice(-4));
    requireConditionV1(
      bytes.length === selected.length && prefix === "GRIB" && suffix === "7777",
      `MCFT_CAP09_GFS_SFLUX_MESSAGE_BOUNDARY:F${String(lead).padStart(3, "0")}`,
    );
    return rawObjectV1("GFS_SFLUX_EXACT_GRIB_MESSAGE", `${isoV1(issue)}|F${String(lead).padStart(3, "0")}`, response);
  }
}
