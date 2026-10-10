// MCFT-CAP-09 production KBS LTER variate-25 soil Evidence provider/decoder.
// Boundary: request construction, HTTPS transport configuration, and retained-byte decoding only.
// Raw retention, governed ingress, scheduler/cursor ownership, and Twin Runtime mutation are external.

import crypto from "node:crypto";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import type {
  ExternalEvidenceDecoderInputV1,
  ExternalEvidenceDecoderPortV1,
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  GovernedDecodedEvidenceDraftV1,
} from "../mcft_cap09_external_collector_canonicalizer_v1.js";
import { HttpsExternalEvidenceTransportV1 } from "./https_external_evidence_transport_v1.js";

export const MCFT_CAP09_KBS_SOIL_ENDPOINT_V1 =
  "https://lter.kbs.msu.edu/weather/variates/25" as const;
export const MCFT_CAP09_KBS_SOIL_DATASET_ID_V1 =
  "kbs_lter_current_weather_variate25_v1" as const;
export const MCFT_CAP09_KBS_SOIL_DECODER_ID_V1 =
  "KBS_LTER_CURRENT_WEATHER_VARIATE_25_VWC_DECODER_V1" as const;
export const MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1 = "1" as const;
export const MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1 =
  "GEOX-MCFT-CAP-09-EA2A-KBS-SOIL-CONTINUITY-USE-POLICY-V1" as const;

const KBS_HOST = "lter.kbs.msu.edu";
const MAX_RAW_BYTES = 5_000_000;
const LATEST_MAX_AGE_MINUTES = 30;
const FUTURE_TOLERANCE_MINUTES = 5;
const CONTINUITY_WINDOW_HOURS = 24;
const MAX_GAP_MINUTES = 30;
const MIN_DISTINCT_HOUR_BUCKETS = 24;
const MIN_WINDOW_SPAN_MINUTES = 1430;

export type KbsVariate25SoilRawV1 = {
  request: ExternalEvidenceFetchRequestV1;
  response: ExternalEvidenceFetchResponseV1;
};

type SoilPointV1 = { time: string; value: number };

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function requireConditionV1(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function sha256TextV1(value: unknown): string {
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function parseSoilPointV1(value: unknown): SoilPointV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.time !== "string") return null;
  const milliseconds = Date.parse(row.time);
  if (!Number.isFinite(milliseconds)) return null;
  const number = typeof row.value === "number" ? row.value : Number(row.value);
  if (!Number.isFinite(number)) return null;
  return { time: new Date(milliseconds).toISOString(), value: number };
}

function uniqueContinuityPointsV1(raw: readonly unknown[], retrievedAt: string): {
  latest: SoilPointV1;
  distinctPointCount: number;
  distinctHourBucketCount: number;
  spanMinutes: number;
  maximumGapMinutes: number;
  timestampChainSha256: string;
} {
  const byTimestamp = new Map<string, number>();
  for (const item of raw) {
    const point = parseSoilPointV1(item);
    if (!point) continue;
    requireConditionV1(point.value >= 0 && point.value <= 1, "EA5C2B1_KBS_SOIL_VALUE_OUT_OF_RANGE");
    const previous = byTimestamp.get(point.time);
    if (previous !== undefined && previous !== point.value) {
      throw new Error("EA5C2B1_KBS_SOIL_CONFLICTING_DUPLICATE_TIMESTAMP");
    }
    byTimestamp.set(point.time, point.value);
  }
  const points = [...byTimestamp.entries()]
    .map(([time, value]) => ({ time, value }))
    .sort((left, right) => left.time.localeCompare(right.time));
  requireConditionV1(points.length > 0, "EA5C2B1_KBS_SOIL_FINITE_POINTS_REQUIRED");

  const latest = points[points.length - 1];
  const retrievedMs = Date.parse(canonicalIsoV1(retrievedAt, "EA5C2B1_RETRIEVED_AT_INVALID"));
  const latestMs = Date.parse(latest.time);
  const ageMinutes = (retrievedMs - latestMs) / 60_000;
  requireConditionV1(ageMinutes >= -FUTURE_TOLERANCE_MINUTES, "EA5C2B1_KBS_SOIL_TIMESTAMP_TOO_FAR_FUTURE");
  requireConditionV1(ageMinutes <= LATEST_MAX_AGE_MINUTES, `EA5C2B1_KBS_SOIL_STALE:${ageMinutes.toFixed(3)}`);

  const windowStartMs = latestMs - CONTINUITY_WINDOW_HOURS * 3_600_000;
  const window = points.filter((point) => Date.parse(point.time) >= windowStartMs && Date.parse(point.time) <= latestMs);
  requireConditionV1(window.length > 1, "EA5C2B1_KBS_SOIL_24H_WINDOW_REQUIRED");
  const distinctHours = new Set(window.map((point) => Math.floor(Date.parse(point.time) / 3_600_000))).size;
  requireConditionV1(distinctHours >= MIN_DISTINCT_HOUR_BUCKETS, `EA5C2B1_KBS_SOIL_DISTINCT_HOURS:${distinctHours}`);
  const spanMinutes = (Date.parse(window[window.length - 1].time) - Date.parse(window[0].time)) / 60_000;
  requireConditionV1(spanMinutes >= MIN_WINDOW_SPAN_MINUTES, `EA5C2B1_KBS_SOIL_WINDOW_SPAN:${spanMinutes.toFixed(3)}`);
  let maximumGapMinutes = 0;
  for (let index = 1; index < window.length; index += 1) {
    maximumGapMinutes = Math.max(
      maximumGapMinutes,
      (Date.parse(window[index].time) - Date.parse(window[index - 1].time)) / 60_000,
    );
  }
  requireConditionV1(maximumGapMinutes <= MAX_GAP_MINUTES, `EA5C2B1_KBS_SOIL_MAX_GAP:${maximumGapMinutes.toFixed(3)}`);

  return {
    latest,
    distinctPointCount: window.length,
    distinctHourBucketCount: distinctHours,
    spanMinutes,
    maximumGapMinutes,
    timestampChainSha256: sha256TextV1(window.map((point) => point.time)),
  };
}

export function buildKbsVariate25SoilFetchRequestV1(input: {
  request_id: string;
  requested_at: string;
}): ExternalEvidenceFetchRequestV1 {
  const requestId = typeof input.request_id === "string" ? input.request_id.trim() : "";
  requireConditionV1(Boolean(requestId), "EA5C2B1_KBS_SOIL_REQUEST_ID_REQUIRED");
  const requestedAt = canonicalIsoV1(input.requested_at, "EA5C2B1_KBS_SOIL_REQUESTED_AT_INVALID");
  return {
    request_id: requestId,
    provider_id: "KBS_LTER",
    source_family: "CURRENT_WEATHER_VARIATE_JSON",
    locator: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
    allowed_final_hosts: [KBS_HOST],
    use_policy_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
    requested_at: requestedAt,
    expected_content_type_prefixes: ["application/json"],
    limitations: ["PRIVATE_RESTRICTED_RAW_EVIDENCE", "NO_PUBLIC_RAW_VALUE_EMISSION"],
  };
}

export function createKbsVariate25SoilTransportV1(input: {
  fetch_impl?: typeof fetch;
  clock?: () => Date;
} = {}): HttpsExternalEvidenceTransportV1 {
  return new HttpsExternalEvidenceTransportV1({
    fetch_impl: input.fetch_impl,
    clock: input.clock,
    user_agent: "GEOX-MCFT-CAP09-EA5C2B1/1",
    max_raw_bytes: MAX_RAW_BYTES,
    timeout_ms: 30_000,
    require_final_path_match: true,
    error_prefix: "EA5C2B1_KBS_SOIL",
  });
}

export async function fetchKbsVariate25SoilRawV1(input: {
  request_id: string;
  requested_at: string;
  fetch_impl?: typeof fetch;
  clock?: () => Date;
}): Promise<KbsVariate25SoilRawV1> {
  const request = buildKbsVariate25SoilFetchRequestV1({
    request_id: input.request_id,
    requested_at: input.requested_at,
  });
  const response = await createKbsVariate25SoilTransportV1({
    fetch_impl: input.fetch_impl,
    clock: input.clock,
  }).fetchRawEvidence(request);
  return { request, response };
}

export class KbsVariate25SoilEvidenceDecoderV1 implements ExternalEvidenceDecoderPortV1 {
  readonly decoder_id = MCFT_CAP09_KBS_SOIL_DECODER_ID_V1;
  readonly decoder_version = MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1;

  async decodeRetainedEvidence(input: ExternalEvidenceDecoderInputV1): Promise<readonly GovernedDecodedEvidenceDraftV1[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(input.raw_bytes).toString("utf8"));
    } catch {
      throw new Error("EA5C2B1_KBS_SOIL_JSON_INVALID");
    }
    requireConditionV1(Array.isArray(parsed), "EA5C2B1_KBS_SOIL_ARRAY_REQUIRED");
    const continuity = uniqueContinuityPointsV1(parsed, input.provenance.retrieved_at);
    const observedAt = continuity.latest.time;
    const sourceRecordId = `${MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1}:${observedAt}`;

    return [{
      role: "SOIL_MOISTURE_OBSERVATION",
      source_record_id: sourceRecordId,
      binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      origin_source_kind: "EXTERNAL_PUBLIC_RESEARCH_DATASET",
      origin_source_id: "KBS_LTER_CURRENT_WEATHER_VARIATE_25",
      epistemic_class: "OBSERVED",
      available_to_runtime_at: input.provenance.retrieved_at,
      role_time: {
        observed_at: observedAt,
        ingested_at: input.provenance.retrieved_at,
      },
      quality: {
        status: "PASS",
        continuity_window_hours: CONTINUITY_WINDOW_HOURS,
        distinct_point_count: continuity.distinctPointCount,
        distinct_hour_bucket_count: continuity.distinctHourBucketCount,
        span_minutes: Number(continuity.spanMinutes.toFixed(3)),
        maximum_gap_minutes: Number(continuity.maximumGapMinutes.toFixed(3)),
        timestamp_chain_sha256: continuity.timestampChainSha256,
        raw_value_publication_authorized: false,
      },
      source_payload: {
        provider: "KBS_LTER",
        source_family: "CURRENT_WEATHER_VARIATE_JSON",
        endpoint_id: 25,
        endpoint_url: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
        source_version: "KBS_CURRENT_WEATHER_VARIATE_25_V1",
        quantity_kind: "VOLUMETRIC_WATER_CONTENT",
        unit: "fraction",
        measurement_depth_mm: 100,
        use_policy_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
        raw_values_embedded: false,
      },
      canonical_payload: {
        quantity_kind: "VOLUMETRIC_WATER_CONTENT",
        value: continuity.latest.value,
        unit: "fraction",
        measurement_depth_mm: 100,
        spatial_support: "NEAR_SITE_POINT_SUPPORT",
        direct_field_equivalence: false,
        direct_root_zone_equivalence: false,
        root_zone_representativeness: "PARTIAL",
        observation_operator_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
      },
      source_unit: "fraction",
      canonical_unit: "fraction",
      conversion_rule: {
        conversion_rule_id: "IDENTITY_VWC_FRACTION_V1",
        conversion_rule_version: "1",
        id: "IDENTITY_VWC_FRACTION_V1",
        version: "1",
        authority_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
      },
      source_binding_version: 1,
      limitations: [
        "EXTERNAL_PUBLIC_RESEARCH_SCOPE",
        "KBS_RESTRICTED_USE_POLICY",
        "NEAR_SITE_POINT_SUPPORT",
        "PARTIAL_ROOT_ZONE_REPRESENTATIVENESS",
        "DIRECT_FIELD_EQUIVALENCE_FALSE",
        "DIRECT_ROOT_ZONE_EQUIVALENCE_FALSE",
        "NO_PUBLIC_RAW_VALUE_EMISSION",
      ],
    }];
  }
}
