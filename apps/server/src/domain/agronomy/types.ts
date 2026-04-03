import type { AgronomyRecommendationV2 } from "@geox/contracts";

export type AgronomyActionType = "IRRIGATE" | "FERTILIZE" | "SPRAY" | "INSPECT";

export type AgronomyPriority = "low" | "medium" | "high";

export type EffectType = "moisture_increase" | "nutrition_boost" | "disease_risk_reduce";

export type AgronomyContext = {
  tenantId: string;
  projectId: string;
  groupId: string;
  fieldId: string;
  seasonId?: string;
  programId?: string;

  cropCode: string;
  cropStage: string;

  currentMetrics: {
    soil_moisture?: number | null;
    temperature?: number | null;
    canopy_temp?: number | null;
    humidity?: number | null;
  };

  constraints?: Record<string, unknown>;
};

export type AgronomyRule = {
  ruleId: string;
  cropCode: string;
  cropStage: string;
  actionType: AgronomyActionType;
  priority: AgronomyPriority;
  reasonCodes: string[];
  expectedEffect: {
    type: EffectType;
    value: number;
  };
  riskIfNotExecute: string;
  matches: (ctx: AgronomyContext) => boolean;
};

export type AgronomyRecommendationPayload = AgronomyRecommendationV2;
