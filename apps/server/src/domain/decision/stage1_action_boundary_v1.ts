export const FORMAL_STAGE1_ACTION_FIELDS = ["irrigation_effectiveness", "leak_risk"] as const;

export const SUPPORT_ONLY_STAGE1_FIELDS = ["canopy_temp_status", "evapotranspiration_risk", "sensor_quality_level"] as const;

export const FORBIDDEN_STAGE1_TRIGGER_FIELDS = [
  "fertility_state",
  "salinity_risk_state",
  "canopy_state",
  "water_flow_state",
  "irrigation_need_state",
  "irrigation_need_level",
  "sensor_quality"
] as const;

export type Stage1FormalActionField = (typeof FORMAL_STAGE1_ACTION_FIELDS)[number];
export type Stage1SupportOnlyField = (typeof SUPPORT_ONLY_STAGE1_FIELDS)[number];
export type Stage1ForbiddenTriggerField = (typeof FORBIDDEN_STAGE1_TRIGGER_FIELDS)[number];

export type Stage1ActionBoundaryNormalizedInputV1 = Partial<Record<Stage1FormalActionField | Stage1SupportOnlyField, unknown>>;

const RECOMMENDATION_FORMAL_INPUT_LAYER = "stage1_sensing_summary_v1" as const;

export function normalizeStage1RecommendationInput(summaryPayload: unknown): Stage1ActionBoundaryNormalizedInputV1 {
  const summary = summaryPayload && typeof summaryPayload === "object"
    ? summaryPayload as Record<string, unknown>
    : {};
  const output: Stage1ActionBoundaryNormalizedInputV1 = {};
  for (const key of [...FORMAL_STAGE1_ACTION_FIELDS, ...SUPPORT_ONLY_STAGE1_FIELDS]) {
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      output[key] = summary[key];
    }
  }
  return output;
}

export function assertFormalTriggerInputLayer(sourceKind: unknown): asserts sourceKind is typeof RECOMMENDATION_FORMAL_INPUT_LAYER {
  const normalized = String(sourceKind ?? "").trim();
  if (normalized !== RECOMMENDATION_FORMAL_INPUT_LAYER) {
    throw new Error(`STAGE1_FORMAL_TRIGGER_LAYER_REQUIRED:${RECOMMENDATION_FORMAL_INPUT_LAYER}`);
  }
}

export function assertNoForbiddenTriggerFields(input: unknown): void {
  if (!input || typeof input !== "object") return;
  const data = input as Record<string, unknown>;
  for (const forbidden of FORBIDDEN_STAGE1_TRIGGER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, forbidden) && data[forbidden] !== undefined) {
      throw new Error(`STAGE1_FORBIDDEN_TRIGGER_FIELD:${forbidden}`);
    }
  }
}

export function deriveFormalTriggerSignalsFromStage1Summary(summaryPayload: unknown): Record<Stage1FormalActionField, unknown> {
  const normalized = normalizeStage1RecommendationInput(summaryPayload);
  assertNoForbiddenTriggerFields(summaryPayload);
  return {
    irrigation_effectiveness: normalized.irrigation_effectiveness,
    leak_risk: normalized.leak_risk,
  };
}
