export type FertilityPrecheckConstraintInputV1 = {
  moisture_constraint?: string | null;
  salinity_risk?: string | null;
};

export type FertilityStateLikeV1 = {
  recommendation_bias?: unknown;
  fertility_level?: unknown;
  salinity_risk?: unknown;
};

type FrozenConstraintRuleV1 = {
  key: "moisture_constraint" | "salinity_risk";
  targetValue: "dry" | "high";
  when: (state: FertilityStateLikeV1) => boolean;
};

// 冻结：仅两条映射规则，避免策略面扩展导致行为漂移。
const FROZEN_CONSTRAINT_RULES_V1: FrozenConstraintRuleV1[] = [
  {
    key: "moisture_constraint",
    targetValue: "dry",
    when: (state) => {
      const recommendationBias = String(state.recommendation_bias ?? "").trim().toLowerCase();
      const fertilityLevel = String(state.fertility_level ?? "").trim().toLowerCase();
      return recommendationBias === "irrigate_first" || fertilityLevel === "low";
    }
  },
  {
    key: "salinity_risk",
    targetValue: "high",
    when: (state) => String(state.salinity_risk ?? "").trim().toUpperCase() === "HIGH"
  }
];

export function deriveFertilityPrecheckConstraintsV1(input: {
  fertilityState: FertilityStateLikeV1;
  baseConstraints?: FertilityPrecheckConstraintInputV1;
}): FertilityPrecheckConstraintInputV1 {
  const next: FertilityPrecheckConstraintInputV1 = {
    moisture_constraint: input.baseConstraints?.moisture_constraint ?? null,
    salinity_risk: input.baseConstraints?.salinity_risk ?? null,
  };

  for (const rule of FROZEN_CONSTRAINT_RULES_V1) {
    if (rule.when(input.fertilityState)) {
      next[rule.key] = rule.targetValue;
    }
  }

  return next;
}
