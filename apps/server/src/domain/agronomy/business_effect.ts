export type BusinessEffect = {
  expected_impact: string;
  risk_if_not_execute: string;
  estimated_gain?: string;
};

type DeriveBusinessEffectInput = {
  reason_codes?: unknown[];
  action_type?: unknown;
  final_status?: unknown;
};

function includesAny(text: string, tokens: string[]): boolean {
  return tokens.some((x) => text.includes(x));
}

export function deriveBusinessEffect(input: DeriveBusinessEffectInput): BusinessEffect {
  const finalStatus = String(input.final_status ?? "").trim().toUpperCase();
  if (finalStatus === "INVALID_EXECUTION") {
    return {
      expected_impact: "未产生有效业务效果",
      risk_if_not_execute: "该次作业未形成有效闭环，需尽快补做以避免窗口期损失",
    };
  }

  const actionType = String(input.action_type ?? "").trim().toUpperCase();
  if (actionType.includes("IRRIGATE") || actionType.includes("IRRIGATION")) {
    return {
      expected_impact: "预计24-72小时内缓解水分胁迫，稳定作物长势",
      risk_if_not_execute: "土壤含水持续下降，可能导致生长停滞或减产",
      estimated_gain: "减少因水分胁迫造成的潜在产量损失",
    };
  }
  if (actionType.includes("SPRAY")) {
    return {
      expected_impact: "预计降低病害扩散风险",
      risk_if_not_execute: "病害可能扩散，影响产量与品质",
      estimated_gain: "降低后续集中防治成本与品质损失概率",
    };
  }

  const reasonText = (Array.isArray(input.reason_codes) ? input.reason_codes : []).map((x) => String(x ?? "").toLowerCase()).join(" ");
  if (includesAny(reasonText, ["drought", "dry", "water_stress", "干旱", "缺水"])) {
    return {
      expected_impact: "预计缓解水分压力并降低作物生长波动风险",
      risk_if_not_execute: "持续缺水可能导致生长受限与减产",
    };
  }
  if (includesAny(reasonText, ["pest", "disease", "blight", "病害", "虫害"])) {
    return {
      expected_impact: "预计降低病虫害扩散风险",
      risk_if_not_execute: "病虫害可能持续扩散，影响产量与品质",
    };
  }

  return {
    expected_impact: "预计改善田间风险暴露并提升作业闭环质量",
    risk_if_not_execute: "风险可能持续累积并带来额外成本损失",
  };
}
