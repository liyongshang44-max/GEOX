// MCFT-CAP-09 Production Hosting Phase 3: generic Evidence supply cadence semantics.
// Separates publication availability from observation/event-time continuity.
// No provider fetch, DB, timer, scheduler, Twin state, or production activation.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";

export const MCFT_CAP09_EVIDENCE_SUPPLY_CADENCE_PROFILE_CONTRACT_V1 =
  "MCFT_CAP09_EVIDENCE_SUPPLY_CADENCE_PROFILE_V1" as const;

export type EvidenceSupplyCadenceProfileV1 = {
  profile_contract_id: typeof MCFT_CAP09_EVIDENCE_SUPPLY_CADENCE_PROFILE_CONTRACT_V1;
  profile_id: string;
  event_time_mode: "FIXED_INTERVAL" | "IRREGULAR_EVENT";
  expected_event_interval_seconds: number | null;
  publication_mode: "PER_EVENT" | "BATCHED" | "PROVIDER_DEFINED";
};

export type EvidenceSupplyContinuityEventV1 = {
  event_time: string;
  publication_available_at: string;
  revision_count: number;
  publication_count: number;
};

export type EvidenceSupplyContinuitySummaryV1 = {
  cadence_profile_id: string;
  publication_available_through: string;
  event_time_contiguous_from: string;
  event_time_contiguous_through: string;
  event_time_max_seen: string;
  event_gap_count: number;
  revision_count: number;
  publication_event_count: number;
};

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
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

function profileV1(input: Omit<EvidenceSupplyCadenceProfileV1, "profile_contract_id">): EvidenceSupplyCadenceProfileV1 {
  if (!input.profile_id.trim()) throw new Error("PHASE3_EVIDENCE_CADENCE_PROFILE_ID_REQUIRED");
  if (input.event_time_mode === "FIXED_INTERVAL") {
    positiveIntegerV1(input.expected_event_interval_seconds, "PHASE3_EVIDENCE_CADENCE_INTERVAL_REQUIRED");
  } else if (input.expected_event_interval_seconds !== null) {
    throw new Error("PHASE3_EVIDENCE_CADENCE_IRREGULAR_INTERVAL_FORBIDDEN");
  }
  return {
    profile_contract_id: MCFT_CAP09_EVIDENCE_SUPPLY_CADENCE_PROFILE_CONTRACT_V1,
    ...input,
  };
}

export const MCFT_CAP09_KBS_DAILY_BATCH_HOURLY_EVENT_PROFILE_V1 = profileV1({
  profile_id: "KBS_DAILY_BATCH_HOURLY_EVENTS_V1",
  event_time_mode: "FIXED_INTERVAL",
  expected_event_interval_seconds: 3600,
  publication_mode: "BATCHED",
});

export const MCFT_CAP09_TRUE_HOURLY_EVENT_PROFILE_V1 = profileV1({
  profile_id: "TRUE_HOURLY_EVENTS_V1",
  event_time_mode: "FIXED_INTERVAL",
  expected_event_interval_seconds: 3600,
  publication_mode: "PER_EVENT",
});

export const MCFT_CAP09_HOURLY_OUTAGE_BACKFILL_PROFILE_V1 = profileV1({
  profile_id: "HOURLY_OUTAGE_BACKFILL_V1",
  event_time_mode: "FIXED_INTERVAL",
  expected_event_interval_seconds: 3600,
  publication_mode: "PROVIDER_DEFINED",
});

export const MCFT_CAP09_KBS_VARIATE25_IRREGULAR_PROFILE_V1 = profileV1({
  profile_id: "KBS_VARIATE25_IRREGULAR_EVENT_V1",
  event_time_mode: "IRREGULAR_EVENT",
  expected_event_interval_seconds: null,
  publication_mode: "PROVIDER_DEFINED",
});

export const MCFT_CAP09_GFS_SIX_HOUR_ISSUE_PROFILE_V1 = profileV1({
  profile_id: "GFS_SIX_HOUR_ISSUE_EVENTS_V1",
  event_time_mode: "FIXED_INTERVAL",
  expected_event_interval_seconds: 21600,
  publication_mode: "PROVIDER_DEFINED",
});

export function evidenceSupplyCadenceProfileForBindingV1(
  bindingId: string,
): EvidenceSupplyCadenceProfileV1 {
  switch (bindingId) {
    case MCFT_CAP09_EXTERNAL_FORMAL_RAINFALL_BINDING_ID_V1:
    case MCFT_CAP09_EXTERNAL_FORMAL_HISTORICAL_ET0_BINDING_ID_V1:
      return MCFT_CAP09_KBS_DAILY_BATCH_HOURLY_EVENT_PROFILE_V1;
    case MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1:
      return MCFT_CAP09_KBS_VARIATE25_IRREGULAR_PROFILE_V1;
    case MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1:
    case MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1:
      return MCFT_CAP09_GFS_SIX_HOUR_ISSUE_PROFILE_V1;
    default:
      throw new Error("PHASE3_EVIDENCE_CADENCE_BINDING_NOT_REGISTERED:" + bindingId);
  }
}

export function evidenceSupplyEventTimeV1(input: {
  record_type: string;
  role_time: Record<string, unknown>;
}): string {
  const field = (() => {
    switch (input.record_type) {
      case "soil_moisture_observation_v1": return "observed_at";
      case "observed_rainfall_v1":
      case "historical_et0_estimate_v1": return "interval_end";
      case "future_weather_assumption_v1":
      case "future_et0_assumption_v1": return "issued_at";
      default:
        throw new Error("PHASE3_EVIDENCE_EVENT_TIME_RECORD_TYPE_NOT_REGISTERED:" + input.record_type);
    }
  })();
  return canonicalIsoV1(
    input.role_time[field],
    "PHASE3_EVIDENCE_EVENT_TIME_" + field.toUpperCase() + "_INVALID",
  );
}

export function summarizeEvidenceSupplyContinuityV1(
  events: readonly EvidenceSupplyContinuityEventV1[],
  profile: EvidenceSupplyCadenceProfileV1,
): EvidenceSupplyContinuitySummaryV1 {
  if (profile.profile_contract_id !== MCFT_CAP09_EVIDENCE_SUPPLY_CADENCE_PROFILE_CONTRACT_V1) {
    throw new Error("PHASE3_EVIDENCE_CADENCE_PROFILE_CONTRACT_INVALID");
  }
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("PHASE3_EVIDENCE_CONTINUITY_EVENTS_REQUIRED");
  }
  const normalized = events.map((event) => ({
    event_time: canonicalIsoV1(event.event_time, "PHASE3_EVIDENCE_CONTINUITY_EVENT_TIME_INVALID"),
    publication_available_at: canonicalIsoV1(
      event.publication_available_at,
      "PHASE3_EVIDENCE_CONTINUITY_PUBLICATION_TIME_INVALID",
    ),
    revision_count: nonNegativeIntegerV1(event.revision_count, "PHASE3_EVIDENCE_CONTINUITY_REVISION_COUNT_INVALID"),
    publication_count: positiveIntegerV1(event.publication_count, "PHASE3_EVIDENCE_CONTINUITY_PUBLICATION_COUNT_INVALID"),
  })).sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));

  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i - 1].event_time === normalized[i].event_time) {
      throw new Error("PHASE3_EVIDENCE_CONTINUITY_DUPLICATE_EVENT_TIME");
    }
  }

  const publicationAvailableThrough = normalized.reduce(
    (latest, event) =>
      Date.parse(event.publication_available_at) > Date.parse(latest)
        ? event.publication_available_at
        : latest,
    normalized[0].publication_available_at,
  );
  const eventTimeContiguousFrom = normalized[0].event_time;
  const eventTimeMaxSeen = normalized[normalized.length - 1].event_time;
  let eventTimeContiguousThrough = eventTimeContiguousFrom;
  let gapCount = 0;
  let continuityOpen = true;

  if (profile.event_time_mode === "FIXED_INTERVAL") {
    const stepMs = positiveIntegerV1(
      profile.expected_event_interval_seconds,
      "PHASE3_EVIDENCE_CADENCE_INTERVAL_REQUIRED",
    ) * 1000;
    for (let i = 1; i < normalized.length; i += 1) {
      const delta = Date.parse(normalized[i].event_time) - Date.parse(normalized[i - 1].event_time);
      if (delta <= 0 || delta % stepMs !== 0) {
        throw new Error("PHASE3_EVIDENCE_CONTINUITY_EVENT_TIME_MISALIGNED");
      }
      const missing = delta / stepMs - 1;
      gapCount += missing;
      if (continuityOpen && missing === 0) {
        eventTimeContiguousThrough = normalized[i].event_time;
      } else if (missing > 0) {
        continuityOpen = false;
      }
    }
  } else {
    eventTimeContiguousThrough = eventTimeMaxSeen;
  }

  return {
    cadence_profile_id: profile.profile_id,
    publication_available_through: publicationAvailableThrough,
    event_time_contiguous_from: eventTimeContiguousFrom,
    event_time_contiguous_through: eventTimeContiguousThrough,
    event_time_max_seen: eventTimeMaxSeen,
    event_gap_count: gapCount,
    revision_count: normalized.reduce((sum, event) => sum + event.revision_count, 0),
    publication_event_count: normalized.reduce((sum, event) => sum + event.publication_count, 0),
  };
}
