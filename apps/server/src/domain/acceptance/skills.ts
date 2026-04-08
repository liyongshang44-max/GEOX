export type AcceptanceSkillVerdict = "PASS" | "FAIL" | "PENDING";

export type AcceptanceSkillInput = {
  receipt: Record<string, any>;
  water_flow_state?: Record<string, any> | null;
  fertility_state?: Record<string, any> | null;
  sensor_quality_state?: Record<string, any> | null;
};

export type AcceptanceSkillOutput = {
  verdict: AcceptanceSkillVerdict;
  explanation_codes: string[];
};

export type AcceptanceSkill = {
  skill_id: string;
  version: string;
  action_type: string;
  run(input: AcceptanceSkillInput): AcceptanceSkillOutput;
};

function normalizeCodes(codes: Array<string | null | undefined>): string[] {
  return Array.from(new Set(codes.map((x) => String(x ?? "").trim()).filter(Boolean)));
}

export const irrigationAcceptanceV1: AcceptanceSkill = {
  skill_id: "irrigation_acceptance_v1",
  version: "v1",
  action_type: "IRRIGATE",
  run(input) {
    const observed = (input.receipt?.payload?.observed_parameters ?? {}) as Record<string, any>;
    const durationMin = Number(observed.duration_min ?? input.receipt?.payload?.duration_min ?? NaN);
    const effectiveness = String(input.water_flow_state?.irrigation_effectiveness ?? "").toLowerCase();
    const leakRisk = String(input.water_flow_state?.leak_risk ?? "").toLowerCase();

    if (!Number.isFinite(durationMin) || durationMin <= 0) {
      return { verdict: "PENDING", explanation_codes: ["MISSING_RECEIPT_DURATION"] };
    }

    if (effectiveness === "low") {
      return { verdict: "FAIL", explanation_codes: normalizeCodes(["WATER_FLOW_LOW_EFFECTIVENESS", leakRisk ? `LEAK_RISK_${leakRisk.toUpperCase()}` : null]) };
    }

    if (leakRisk === "high") {
      return { verdict: "FAIL", explanation_codes: ["LEAK_RISK_HIGH"] };
    }

    return {
      verdict: "PASS",
      explanation_codes: normalizeCodes([
        "IRRIGATION_RECEIPT_OK",
        effectiveness ? `WATER_FLOW_${effectiveness.toUpperCase()}` : null,
      ])
    };
  }
};

export const fertilizationAcceptanceV1: AcceptanceSkill = {
  skill_id: "fertilization_acceptance_v1",
  version: "v1",
  action_type: "FERTILIZE",
  run(input) {
    const observed = (input.receipt?.payload?.observed_parameters ?? {}) as Record<string, any>;
    const fertilizerKg = Number(observed.fertilizer_kg ?? input.receipt?.payload?.fertilizer_kg ?? NaN);
    const fertilityLevel = String(input.fertility_state?.level ?? "").toUpperCase();

    if (!Number.isFinite(fertilizerKg) || fertilizerKg <= 0) {
      return { verdict: "PENDING", explanation_codes: ["MISSING_FERTILIZER_RECEIPT"] };
    }
    if (fertilizerKg > 500) {
      return { verdict: "FAIL", explanation_codes: ["FERTILIZER_AMOUNT_OUT_OF_RANGE"] };
    }

    return {
      verdict: "PASS",
      explanation_codes: normalizeCodes([
        "FERTILIZATION_RECEIPT_OK",
        fertilityLevel ? `FERTILITY_${fertilityLevel}` : null,
      ])
    };
  }
};

export const sensorEvidenceAcceptanceV1: AcceptanceSkill = {
  skill_id: "sensor_evidence_acceptance_v1",
  version: "v1",
  action_type: "INSPECT",
  run(input) {
    const quality = String(input.sensor_quality_state?.level ?? "").toUpperCase();
    const metrics = input.receipt?.payload?.metrics;
    const hasMetricEvidence = Array.isArray(metrics) && metrics.length > 0;

    if (!hasMetricEvidence) {
      return { verdict: "PENDING", explanation_codes: ["MISSING_SENSOR_METRICS"] };
    }
    if (quality === "INVALID") {
      return { verdict: "FAIL", explanation_codes: ["SENSOR_QUALITY_INVALID"] };
    }

    return {
      verdict: "PASS",
      explanation_codes: normalizeCodes([
        "SENSOR_EVIDENCE_OK",
        quality ? `SENSOR_QUALITY_${quality}` : null,
      ])
    };
  }
};

export const acceptanceSkillRegistryV1: AcceptanceSkill[] = [
  irrigationAcceptanceV1,
  fertilizationAcceptanceV1,
  sensorEvidenceAcceptanceV1,
];
