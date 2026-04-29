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



export const variableIrrigationAcceptanceV1: AcceptanceSkill = {
  skill_id: "variable_irrigation_acceptance_v1",
  version: "v1",
  action_type: "IRRIGATE",
  run(input) {
    const variableExecution = input.receipt?.payload?.meta?.variable_execution;
    const mode = String(variableExecution?.mode ?? "").trim().toUpperCase();
    if (mode !== "VARIABLE_BY_ZONE") {
      return { verdict: "PENDING", explanation_codes: ["MISSING_VARIABLE_EXECUTION"] };
    }
    const zones = Array.isArray(variableExecution?.zone_applications) ? variableExecution.zone_applications : [];
    if (!zones.length) {
      return { verdict: "PENDING", explanation_codes: ["MISSING_ZONE_APPLICATIONS"] };
    }

    for (const z of zones) {
      const zone_id = String(z?.zone_id ?? "").trim();
      const planned_amount = Number(z?.planned_amount);
      const applied_amount = Number(z?.applied_amount);
      const coverage_percent = Number(z?.coverage_percent);
      const status = String(z?.status ?? "").trim().toUpperCase();
      const valid = zone_id
        && Number.isFinite(planned_amount) && planned_amount > 0
        && Number.isFinite(applied_amount) && applied_amount >= 0
        && Number.isFinite(coverage_percent) && coverage_percent >= 0 && coverage_percent <= 100
        && (status === "APPLIED" || status === "PARTIAL" || status === "SKIPPED");
      if (!valid) return { verdict: "PENDING", explanation_codes: ["INVALID_ZONE_APPLICATION"] };

      if (status === "SKIPPED") return { verdict: "FAIL", explanation_codes: ["ZONE_APPLICATION_SKIPPED"] };
      if (coverage_percent < 95) return { verdict: "FAIL", explanation_codes: ["ZONE_COVERAGE_BELOW_THRESHOLD"] };
      const deviationPercent = Math.abs(((applied_amount - planned_amount) / planned_amount) * 100);
      if (deviationPercent > 15) return { verdict: "FAIL", explanation_codes: ["ZONE_AMOUNT_DEVIATION_EXCEEDED"] };
    }

    return { verdict: "PASS", explanation_codes: ["VARIABLE_IRRIGATION_APPLICATION_OK", "ZONE_APPLICATIONS_OK"] };
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
  variableIrrigationAcceptanceV1,
  irrigationAcceptanceV1,
  fertilizationAcceptanceV1,
  sensorEvidenceAcceptanceV1,
];
