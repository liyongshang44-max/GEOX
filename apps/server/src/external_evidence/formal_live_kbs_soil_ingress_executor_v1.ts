// MCFT-CAP-09 S6-EA5C2B1 live KBS soil Evidence ingress executor.
// Collector-side only: public-source fetch is permitted here, never inside Runtime.
// Raw bytes pass through the frozen EA3 retention-before-decode barrier and the
// frozen EA5C1 restricted facts ingress. Public return values never expose soil values.

import crypto from "node:crypto";
import type { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type ExternalEvidenceDecoderInputV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceFetchResponseV1,
  type ExternalEvidenceTransportPortV1,
  type GovernedDecodedEvidenceDraftV1,
  type RawEvidenceRetentionPortV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type { RawEvidenceRetentionVerificationPortV1 } from "./s3_compatible_raw_evidence_retention_adapter_v1.js";
import { PostgresExternalFormalEvidenceIngressV1 } from "../persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

export const MCFT_CAP09_EA5C2B1_KBS_SOIL_EXECUTOR_ID_V1 =
  "MCFT_CAP09_EA5C2B1_LIVE_KBS_SOIL_INGRESS_EXECUTOR_V1" as const;
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
const KBS_PATH = "/weather/variates/25";
const MAX_RAW_BYTES = 5_000_000;
const LATEST_MAX_AGE_MINUTES = 30;
const FUTURE_TOLERANCE_MINUTES = 5;
const CONTINUITY_WINDOW_HOURS = 24;
const MAX_GAP_MINUTES = 30;
const MIN_DISTINCT_HOUR_BUCKETS = 24;
const MIN_WINDOW_SPAN_MINUTES = 1430;

export type PrefetchedKbsSoilRawV1 = {
  request: ExternalEvidenceFetchRequestV1;
  response: ExternalEvidenceFetchResponseV1;
};

export type LiveKbsSoilIngressPublicProofV1 = {
  executor_id: typeof MCFT_CAP09_EA5C2B1_KBS_SOIL_EXECUTOR_ID_V1;
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  fact_id: string;
  source_record_id: string;
  record_type: "soil_moisture_observation_v1";
  binding_id: typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  observed_at: string;
  retrieved_at: string;
  raw_sha256: string;
  raw_bytes: number;
  retention_ref: string;
  canonical_fact_write_count: 0 | 1;
  raw_value_emitted: false;
  runtime_public_provider_fetch_count: 0;
};

type NowV1 = () => Date;
type FetchImplV1 = typeof fetch;
type DurableRetentionV1 = RawEvidenceRetentionPortV1 & RawEvidenceRetentionVerificationPortV1;

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

export async function prefetchLiveKbsVariate25RawV1(input: {
  fetch_impl?: FetchImplV1;
  now?: NowV1;
} = {}): Promise<PrefetchedKbsSoilRawV1> {
  const fetchImpl = input.fetch_impl ?? fetch;
  const now = input.now ?? (() => new Date());
  const requestedAt = now().toISOString();
  const request: ExternalEvidenceFetchRequestV1 = {
    request_id: `ea5c2b1-kbs-soil-${crypto.randomUUID()}`,
    provider_id: "KBS_LTER",
    source_family: "CURRENT_WEATHER_VARIATE_JSON",
    locator: MCFT_CAP09_KBS_SOIL_ENDPOINT_V1,
    allowed_final_hosts: [KBS_HOST],
    use_policy_ref: MCFT_CAP09_KBS_SOIL_USE_POLICY_REF_V1,
    requested_at: requestedAt,
    expected_content_type_prefixes: ["application/json"],
    limitations: ["PRIVATE_RESTRICTED_RAW_EVIDENCE", "NO_PUBLIC_RAW_VALUE_EMISSION"],
  };

  const response = await fetchImpl(MCFT_CAP09_KBS_SOIL_ENDPOINT_V1, {
    method: "GET",
    redirect: "follow",
    headers: { Accept: "application/json,*/*;q=0.5", "User-Agent": "GEOX-MCFT-CAP09-EA5C2B1/1" },
    signal: AbortSignal.timeout(30_000),
  });
  requireConditionV1(response.status >= 200 && response.status < 300, `EA5C2B1_KBS_SOIL_HTTP_STATUS:${response.status}`);
  const finalUrl = new URL(response.url || MCFT_CAP09_KBS_SOIL_ENDPOINT_V1);
  requireConditionV1(finalUrl.protocol === "https:" && finalUrl.hostname === KBS_HOST && finalUrl.pathname === KBS_PATH, "EA5C2B1_KBS_SOIL_FINAL_IDENTITY_DRIFT");
  const contentType = response.headers.get("content-type")?.trim() ?? "";
  requireConditionV1(contentType.toLowerCase().startsWith("application/json"), `EA5C2B1_KBS_SOIL_CONTENT_TYPE:${contentType || "MISSING"}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  requireConditionV1(bytes.byteLength > 0 && bytes.byteLength <= MAX_RAW_BYTES, `EA5C2B1_KBS_SOIL_RAW_BYTES:${bytes.byteLength}`);
  const retrievedAt = now().toISOString();
  requireConditionV1(Date.parse(retrievedAt) >= Date.parse(requestedAt), "EA5C2B1_KBS_SOIL_RETRIEVED_BEFORE_REQUEST");

  return {
    request,
    response: {
      status: response.status,
      final_locator: finalUrl.toString(),
      content_type: contentType,
      retrieved_at: retrievedAt,
      available_at: retrievedAt,
      bytes,
    },
  };
}

class OneShotPrefetchedTransportV1 implements ExternalEvidenceTransportPortV1 {
  private used = false;
  constructor(private readonly prefetched: PrefetchedKbsSoilRawV1) {}
  async fetchRawEvidence(request: ExternalEvidenceFetchRequestV1): Promise<ExternalEvidenceFetchResponseV1> {
    if (this.used) throw new Error("EA5C2B1_PREFETCHED_TRANSPORT_REUSE_FORBIDDEN");
    this.used = true;
    if (request.request_id !== this.prefetched.request.request_id || request.locator !== this.prefetched.request.locator) {
      throw new Error("EA5C2B1_PREFETCHED_REQUEST_IDENTITY_MISMATCH");
    }
    return this.prefetched.response;
  }
}

export async function executePrefetchedKbsSoilFormalIngressV1(input: {
  pool: Pool;
  retention: DurableRetentionV1;
  prefetched: PrefetchedKbsSoilRawV1;
  canonicalized_at: string;
}): Promise<LiveKbsSoilIngressPublicProofV1> {
  const canonicalizedAt = canonicalIsoV1(input.canonicalized_at, "EA5C2B1_CANONICALIZED_AT_INVALID");
  requireConditionV1(
    Date.parse(canonicalizedAt) >= Date.parse(input.prefetched.response.retrieved_at),
    "EA5C2B1_CANONICALIZED_BEFORE_RETRIEVAL",
  );
  const results = await collectRetainDecodeCanonicalizeExternalEvidenceV1(
    {
      dataset_id: MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
      scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
      request: input.prefetched.request,
      canonicalized_at: canonicalizedAt,
    },
    {
      transport: new OneShotPrefetchedTransportV1(input.prefetched),
      retention: input.retention,
      decoder: new KbsVariate25SoilEvidenceDecoderV1(),
    },
  );
  requireConditionV1(results.length === 1, `EA5C2B1_EXACT_ONE_SOIL_RECORD_REQUIRED:${results.length}`);
  const canonical = results[0];
  requireConditionV1(canonical.record.record_type === "soil_moisture_observation_v1", "EA5C2B1_SOIL_RECORD_TYPE_REQUIRED");
  requireConditionV1(canonical.record.binding_id === MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1, "EA5C2B1_SOIL_BINDING_REQUIRED");
  const ingress = new PostgresExternalFormalEvidenceIngressV1(input.pool, input.retention);
  const persisted = await ingress.appendCanonicalizedExternalEvidence(canonical);
  const observedAt = canonicalIsoV1(canonical.record.role_time.observed_at, "EA5C2B1_OBSERVED_AT_INVALID");

  return {
    executor_id: MCFT_CAP09_EA5C2B1_KBS_SOIL_EXECUTOR_ID_V1,
    status: persisted.status,
    fact_id: persisted.fact_id,
    source_record_id: persisted.source_record_id,
    record_type: "soil_moisture_observation_v1",
    binding_id: MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    observed_at: observedAt,
    retrieved_at: input.prefetched.response.retrieved_at,
    raw_sha256: persisted.raw_sha256,
    raw_bytes: persisted.raw_bytes,
    retention_ref: persisted.retention_ref,
    canonical_fact_write_count: persisted.canonical_fact_write_count,
    raw_value_emitted: false,
    runtime_public_provider_fetch_count: 0,
  };
}

export async function executeFormalLiveKbsSoilIngressV1(input: {
  pool: Pool;
  retention: DurableRetentionV1;
  fetch_impl?: FetchImplV1;
  now?: NowV1;
}): Promise<LiveKbsSoilIngressPublicProofV1> {
  const now = input.now ?? (() => new Date());
  const prefetched = await prefetchLiveKbsVariate25RawV1({ fetch_impl: input.fetch_impl, now });
  const canonicalizedAt = now().toISOString();
  return executePrefetchedKbsSoilFormalIngressV1({
    pool: input.pool,
    retention: input.retention,
    prefetched,
    canonicalized_at: canonicalizedAt,
  });
}
