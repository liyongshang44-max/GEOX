// MCFT-CAP-09 production KBS Raw Hourly Evidence provider/decoder.
// Boundary: HTTPS acquisition plus retained-byte scientific decode only.
// Scientific CSV/exact-T/ASCE ET0 semantics live in the product-owned Python core.
// No raw retention, governed ingress, scheduler/lease ownership, runtime tick cursor,
// Twin state mutation, GitHub identity, or production cadence ownership is defined here.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type {
  ExternalEvidenceDecoderInputV1,
  ExternalEvidenceDecoderPortV1,
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
  GovernedDecodedEvidenceDraftV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";
import { HttpsExternalEvidenceTransportV1 } from "./https_external_evidence_transport_v1.js";

const execFileAsync = promisify(execFile);

export const MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1 =
  "https://lter.kbs.msu.edu/datatables/13.csv" as const;
export const MCFT_CAP09_KBS_RAW_HOURLY_DECODER_ID_V1 =
  "MCFT_CAP09_KBS_RAW_HOURLY_EXACT_INTERVAL_DECODER_V1" as const;
export const MCFT_CAP09_KBS_RAW_HOURLY_DECODER_VERSION_V1 = "1" as const;
export const MCFT_CAP09_KBS_RAW_HOURLY_USE_POLICY_REF_V1 =
  "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1" as const;
export const MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1 =
  "apps/server/src/external_evidence/provider/python/mcft_cap09_kbs_raw_hourly_scientific_core_v1.py" as const;

const KBS_HOST = "lter.kbs.msu.edu";
const MAX_RAW_BYTES = 110_000_000;
const HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS = 6;
const STATION_ELEVATION_M = 286.43;
const STATION_LATITUDE = 42.408537;
const STATION_LONGITUDE = -85.373637;
const WIND_10M_TO_2M_FACTOR = 0.747951075;
const SOLAR_W_M2_TO_MJ_M2_H_FACTOR = 0.0036;
const SOURCE_MATRIX_REF =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json";
const RAIN_BINDING = "kbs_lter_raw_hourly_rain_mm_v1";
const HIST_ET0_BINDING = "kbs_lter_asce_short_reference_et_hourly_v1";

type KbsRawHourlyScientificResultV1 = {
  schema_version: "geox_mcft_cap09_kbs_raw_hourly_exact_interval_scientific_result_v1";
  target_interval_end: string;
  provider_latest_timestamp: string;
  provider_latest_age_hours: number;
  historical_online_freshness_diagnostic_le_threshold: boolean;
  freshness_is_late_authoritative_admission_gate: false;
  rainfall_mm: number;
  historical_et0_mm: number;
  air_temperature_c: number;
  actual_vapor_pressure_kpa: number;
  solar_radiation_w_m2: number;
  wind_speed_10m: number;
};

export type KbsRawHourlyDecoderConfigV1 = {
  python_executable?: string;
  scientific_core_path?: string;
  clock?: () => Date;
};

function requireConditionV1(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function canonicalIsoV1(value: unknown, code: string): string {
  requireConditionV1(typeof value === "string" && Boolean(value.trim()), code);
  const parsed = Date.parse(value);
  requireConditionV1(Number.isFinite(parsed) && new Date(parsed).toISOString() === value, code);
  return value;
}

function canonicalHourV1(value: string, code: string): string {
  const canonical = canonicalIsoV1(value, code);
  requireConditionV1(canonical.endsWith(":00:00.000Z"), code);
  return canonical;
}

function finiteNumberV1(value: unknown, code: string): number {
  requireConditionV1(typeof value === "number" && Number.isFinite(value), code);
  return value;
}

function assertScientificResultV1(value: unknown, target: string): KbsRawHourlyScientificResultV1 {
  requireConditionV1(Boolean(value) && typeof value === "object" && !Array.isArray(value), "KBS_RAW_HOURLY_SCIENTIFIC_RESULT_OBJECT_REQUIRED");
  const row = value as Record<string, unknown>;
  requireConditionV1(
    row.schema_version === "geox_mcft_cap09_kbs_raw_hourly_exact_interval_scientific_result_v1",
    "KBS_RAW_HOURLY_SCIENTIFIC_RESULT_SCHEMA",
  );
  requireConditionV1(canonicalIsoV1(row.target_interval_end, "KBS_RAW_HOURLY_RESULT_TARGET_INVALID") === target, "KBS_RAW_HOURLY_RESULT_TARGET_MISMATCH");
  canonicalIsoV1(row.provider_latest_timestamp, "KBS_RAW_HOURLY_RESULT_LATEST_INVALID");
  finiteNumberV1(row.provider_latest_age_hours, "KBS_RAW_HOURLY_RESULT_AGE_INVALID");
  requireConditionV1(typeof row.historical_online_freshness_diagnostic_le_threshold === "boolean", "KBS_RAW_HOURLY_RESULT_FRESHNESS_DIAGNOSTIC_REQUIRED");
  requireConditionV1(row.freshness_is_late_authoritative_admission_gate === false, "KBS_RAW_HOURLY_FRESHNESS_MUST_NOT_BE_ADMISSION_GATE");
  const rain = finiteNumberV1(row.rainfall_mm, "KBS_RAW_HOURLY_RESULT_RAIN_INVALID");
  const et0 = finiteNumberV1(row.historical_et0_mm, "KBS_RAW_HOURLY_RESULT_ET0_INVALID");
  const air = finiteNumberV1(row.air_temperature_c, "KBS_RAW_HOURLY_RESULT_AIR_INVALID");
  const vapor = finiteNumberV1(row.actual_vapor_pressure_kpa, "KBS_RAW_HOURLY_RESULT_VAPOR_INVALID");
  const solar = finiteNumberV1(row.solar_radiation_w_m2, "KBS_RAW_HOURLY_RESULT_SOLAR_INVALID");
  const wind = finiteNumberV1(row.wind_speed_10m, "KBS_RAW_HOURLY_RESULT_WIND_INVALID");
  requireConditionV1(rain >= 0 && rain <= 100, "KBS_RAW_HOURLY_RESULT_RAIN_RANGE");
  requireConditionV1(air >= -50 && air <= 60, "KBS_RAW_HOURLY_RESULT_AIR_RANGE");
  requireConditionV1(vapor > 0 && vapor <= 10, "KBS_RAW_HOURLY_RESULT_VAPOR_RANGE");
  requireConditionV1(solar >= 0 && solar <= 1600, "KBS_RAW_HOURLY_RESULT_SOLAR_RANGE");
  requireConditionV1(wind >= 0 && wind <= 100, "KBS_RAW_HOURLY_RESULT_WIND_RANGE");
  requireConditionV1(Number.isFinite(et0), "KBS_RAW_HOURLY_RESULT_ET0_NONFINITE");
  return row as unknown as KbsRawHourlyScientificResultV1;
}

export function buildKbsRawHourlyFetchRequestV1(input: {
  request_id: string;
  requested_at: string;
  source_event_time?: string;
  limitations?: readonly string[];
}): ExternalEvidenceFetchRequestV1 {
  requireConditionV1(typeof input.request_id === "string" && Boolean(input.request_id.trim()), "KBS_RAW_HOURLY_REQUEST_ID_REQUIRED");
  const requestedAt = canonicalIsoV1(input.requested_at, "KBS_RAW_HOURLY_REQUESTED_AT_INVALID");
  const sourceEventTime = input.source_event_time === undefined
    ? undefined
    : canonicalHourV1(input.source_event_time, "KBS_RAW_HOURLY_SOURCE_EVENT_TIME_INVALID");
  return {
    request_id: input.request_id.trim(),
    provider_id: "KBS_LTER",
    source_family: "RAW_HOURLY_WEATHER",
    locator: MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
    allowed_final_hosts: [KBS_HOST],
    use_policy_ref: MCFT_CAP09_KBS_RAW_HOURLY_USE_POLICY_REF_V1,
    requested_at: requestedAt,
    source_event_time: sourceEventTime,
    expected_content_type_prefixes: ["text/csv", "text/plain", "application/octet-stream"],
    limitations: [...(input.limitations ?? ["PRIVATE_RESTRICTED_RAW_EVIDENCE", "NO_PUBLIC_RAW_VALUE_EMISSION"])],
  };
}

export class KbsRawHourlyLiveTransportV1 implements ExternalEvidenceTransportPortV1 {
  readonly transport_id = "MCFT_CAP09_KBS_RAW_HOURLY_LIVE_TRANSPORT_V1" as const;
  provider_request_count = 0;
  private readonly delegate: HttpsExternalEvidenceTransportV1;

  constructor(input: { fetch_impl?: typeof fetch; clock?: () => Date } = {}) {
    this.delegate = new HttpsExternalEvidenceTransportV1({
      fetch_impl: input.fetch_impl,
      clock: input.clock,
      user_agent: "GEOX-MCFT-CAP09-KBS-RAW-HOURLY/1",
      max_raw_bytes: MAX_RAW_BYTES,
      timeout_ms: 90_000,
      require_final_path_match: true,
      error_prefix: "KBS_RAW_HOURLY",
    });
  }

  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    requireConditionV1(request.locator === MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1, "KBS_RAW_HOURLY_LOCATOR_MISMATCH");
    requireConditionV1(request.provider_id === "KBS_LTER", "KBS_RAW_HOURLY_PROVIDER_ID_MISMATCH");
    requireConditionV1(request.source_family === "RAW_HOURLY_WEATHER", "KBS_RAW_HOURLY_SOURCE_FAMILY_MISMATCH");
    this.provider_request_count += 1;
    return this.delegate.fetchRawEvidence(request);
  }
}

export class KbsRawHourlyExactIntervalDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = MCFT_CAP09_KBS_RAW_HOURLY_DECODER_ID_V1;
  readonly decoder_version = MCFT_CAP09_KBS_RAW_HOURLY_DECODER_VERSION_V1;
  private readonly target: string;
  private readonly pythonExecutable: string;
  private readonly scientificCorePath: string;
  private readonly clock: () => Date;

  constructor(target: string, config: KbsRawHourlyDecoderConfigV1 = {}) {
    this.target = canonicalHourV1(target, "KBS_RAW_HOURLY_DECODER_TARGET_INVALID");
    this.pythonExecutable = config.python_executable?.trim() || "python3";
    this.scientificCorePath = path.resolve(
      config.scientific_core_path?.trim() || MCFT_CAP09_KBS_RAW_HOURLY_SCIENTIFIC_CORE_RELATIVE_PATH_V1,
    );
    this.clock = config.clock ?? (() => new Date());
  }

  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcft-cap09-kbs-raw-hourly-"));
    const rawPath = path.join(temp, "raw-hourly.csv");
    const outputPath = path.join(temp, "scientific-result.json");
    try {
      fs.writeFileSync(rawPath, Buffer.from(input.raw_bytes));
      await execFileAsync(this.pythonExecutable, [
        this.scientificCorePath,
        "decode-exact",
        "--target", this.target,
        "--available-at", canonicalIsoV1(input.provenance.available_at, "KBS_RAW_HOURLY_AVAILABLE_AT_INVALID"),
        "--input", rawPath,
        "--output", outputPath,
        "--historical-online-freshness-diagnostic-hours", String(HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS),
        "--station-elevation-m", String(STATION_ELEVATION_M),
        "--station-latitude", String(STATION_LATITUDE),
        "--station-longitude", String(STATION_LONGITUDE),
        "--wind-10m-to-2m-factor", String(WIND_10M_TO_2M_FACTOR),
      ], {
        cwd: process.cwd(),
        maxBuffer: 4 * 1024 * 1024,
        timeout: 120_000,
      });
      const scientific = assertScientificResultV1(JSON.parse(fs.readFileSync(outputPath, "utf8")), this.target);
      const decodedAt = canonicalIsoV1(this.clock().toISOString(), "KBS_RAW_HOURLY_DECODED_AT_INVALID");
      const intervalStart = new Date(Date.parse(this.target) - 3_600_000).toISOString();
      const key = this.target.replace(/[-:]/g, "").replace(".000Z", "Z").toLowerCase();
      const ageHours = Number(scientific.provider_latest_age_hours.toFixed(6));
      return [
        {
          role: "RAINFALL_OBSERVATION",
          source_record_id: `kbs_raw_hourly_rain_${key}`,
          binding_id: RAIN_BINDING,
          origin_source_kind: "KBS_LTER_RAW_HOURLY_WEATHER",
          origin_source_id: "KBS002-007.142:rain_mm",
          epistemic_class: "OBSERVED",
          available_to_runtime_at: input.provenance.available_at,
          role_time: { interval_start: intervalStart, interval_end: this.target, ingested_at: decodedAt },
          quality: {
            status: "PASS",
            provider_latest_age_hours: ageHours,
            historical_online_freshness_diagnostic_hours: HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
            historical_online_freshness_diagnostic_le_threshold: scientific.historical_online_freshness_diagnostic_le_threshold,
            freshness_is_late_authoritative_admission_gate: false,
          },
          source_payload: {
            provider_table_id: "KBS002-007.142",
            source_column: "rain_mm",
            spatial_support: "NEAR_SITE_METEOROLOGICAL_SUPPORT",
          },
          canonical_payload: { value: scientific.rainfall_mm, unit: "mm" },
          source_unit: "mm",
          canonical_unit: "mm",
          conversion_rule: {
            conversion_rule_id: "KBS_RAW_HOURLY_RAIN_MM_IDENTITY_V1",
            conversion_rule_version: "1",
            authority_ref: SOURCE_MATRIX_REF,
          },
          source_binding_version: 1,
          limitations: ["NEAR_SITE_METEOROLOGICAL_SUPPORT", "FIELD_POINT_PRECIPITATION_TRUTH_NOT_CLAIMED"],
        },
        {
          role: "HISTORICAL_ET0_INPUT",
          source_record_id: `kbs_asce_short_reference_et0_${key}`,
          binding_id: HIST_ET0_BINDING,
          origin_source_kind: "KBS_LTER_RAW_HOURLY_DERIVED",
          origin_source_id: "KBS002-007.142:ASCE_SHORT_REFERENCE_ET0",
          epistemic_class: "ESTIMATED",
          available_to_runtime_at: input.provenance.available_at,
          role_time: {
            interval_start: intervalStart,
            interval_end: this.target,
            ingested_at: decodedAt,
            calculation_method: "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
            method_version: "refet-0.4.2",
          },
          quality: {
            status: "PASS",
            provider_latest_age_hours: ageHours,
            historical_online_freshness_diagnostic_hours: HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS,
            historical_online_freshness_diagnostic_le_threshold: scientific.historical_online_freshness_diagnostic_le_threshold,
            freshness_is_late_authoritative_admission_gate: false,
            negative_clipping_performed: false,
          },
          source_payload: {
            provider_table_id: "KBS002-007.142",
            input_columns: ["airtmp_107_avg", "ah", "solrad_avg", "wind_speed"],
            wind_10m_to_2m_factor: WIND_10M_TO_2M_FACTOR,
            solar_w_m2_to_mj_m2_h_factor: SOLAR_W_M2_TO_MJ_M2_H_FACTOR,
            station_elevation_m: STATION_ELEVATION_M,
            station_latitude: STATION_LATITUDE,
            station_longitude: STATION_LONGITUDE,
          },
          canonical_payload: {
            value: scientific.historical_et0_mm,
            unit: "mm",
            rate_unit: "mm_per_hour",
            calculation_method: "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
            method_version: "refet-0.4.2",
          },
          source_unit: "KBS_HOURLY_METEOROLOGICAL_INPUTS",
          canonical_unit: "mm",
          conversion_rule: {
            conversion_rule_id: "ASCE_STANDARDIZED_REFERENCE_ET_SHORT_HOURLY_V1",
            conversion_rule_version: "refet-0.4.2",
            authority_ref: SOURCE_MATRIX_REF,
          },
          source_binding_version: 1,
          limitations: ["REFERENCE_ET_ESTIMATE_NOT_FIELD_ET", "NO_SILENT_IMPUTATION", "NO_NEGATIVE_CLIPPING"],
        },
      ];
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  }
}
