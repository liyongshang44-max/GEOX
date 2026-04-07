function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(2));
}

function toStringOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function pickFact(readModel: any, key: "field_sensing_overview_v1" | "field_fertility_state_v1"): any {
  const direct = readModel?.[key];
  if (direct && typeof direct === "object") return direct;
  const inFacts = Array.isArray(readModel?.facts)
    ? readModel.facts.find((fact: any) => String(fact?.fact_type ?? fact?.type ?? "").toLowerCase() === key)
    : null;
  return inFacts?.payload ?? inFacts ?? null;
}

export type ParsedFieldReadModelV1 = {
  sensing: {
    status: string | null;
    explainCodes: string[];
    sensorQuality: string | null;
    soilMoisture: number | null;
    soilTemperature: number | null;
    soilEc: number | null;
    soilPh: number | null;
  } | null;
  fertility: {
    status: string | null;
    explainCodes: string[];
    fertilityState: string | null;
    salinityRisk: string | null;
    confidence: number | null;
    recommendationBias: string | null;
  } | null;
};

export function parseFieldReadModelV1(rawRecommendation: any, options?: { enableLegacyFallback?: boolean }): ParsedFieldReadModelV1 {
  const readModel = rawRecommendation?.read_model ?? rawRecommendation?.sensing_summary ?? rawRecommendation?.aggregated_result ?? {};
  const sensingFact = pickFact(readModel, "field_sensing_overview_v1");
  const fertilityFact = pickFact(readModel, "field_fertility_state_v1");
  const legacySensing = readModel?.sensing_overview ?? readModel?.sensing ?? readModel;
  const legacyFertility = readModel?.fertility_state ?? readModel?.fertility ?? readModel;
  const enableLegacyFallback = Boolean(options?.enableLegacyFallback);

  const sensingPayload = sensingFact ?? (enableLegacyFallback ? legacySensing : null) ?? null;
  const fertilityPayload = fertilityFact ?? (enableLegacyFallback ? legacyFertility : null) ?? null;

  return {
    sensing: sensingPayload
      ? {
        status: toStringOrNull(sensingPayload?.status ?? sensingPayload?.state ?? sensingPayload?.status_code),
        explainCodes: toStringArray(sensingPayload?.explain_codes ?? sensingPayload?.reason_codes ?? sensingPayload?.codes),
        sensorQuality: toStringOrNull(
          sensingPayload?.sensor_quality_level
          ?? sensingPayload?.sensor_quality
          ?? sensingPayload?.quality_level
          ?? sensingPayload?.quality
        ),
        soilMoisture: toNumberOrNull(sensingPayload?.soil_moisture),
        soilTemperature: toNumberOrNull(sensingPayload?.soil_temperature ?? sensingPayload?.soil_temp),
        soilEc: toNumberOrNull(sensingPayload?.soil_ec),
        soilPh: toNumberOrNull(sensingPayload?.soil_ph),
      }
      : null,
    fertility: fertilityPayload
      ? {
        status: toStringOrNull(
          fertilityPayload?.status
          ?? fertilityPayload?.state
          ?? fertilityPayload?.status_code
          ?? fertilityPayload?.level
        ),
        explainCodes: toStringArray(
          fertilityPayload?.explain_codes
          ?? fertilityPayload?.reason_codes
          ?? fertilityPayload?.codes
          ?? (fertilityPayload?.explanation ? [fertilityPayload.explanation] : [])
        ),
        fertilityState: toStringOrNull(
          fertilityPayload?.fertility_state
          ?? fertilityPayload?.fertility_level
          ?? fertilityPayload?.level
        ),
        salinityRisk: toStringOrNull(fertilityPayload?.salinity_risk),
        confidence: toNumberOrNull(
          fertilityPayload?.confidence
          ?? readModel?.confidence
          ?? rawRecommendation?.confidence
        ),
        recommendationBias: toStringOrNull(fertilityPayload?.recommendation_bias ?? readModel?.recommendation_bias),
      }
      : null,
  };
}
