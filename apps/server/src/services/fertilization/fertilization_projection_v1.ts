import type { Pool } from "pg";

export type FertilizationReportZoneRateV1 = {
  zone_id: string;
  planned_n_kg_ha: number | null;
  actual_n_kg_ha: number | null;
  coverage_percent: number | null;
  deviation_percent: number | null;
  result: "PASS" | "FAIL" | "NEEDS_REVIEW";
};

export type FertilizationReportProjectionV1 = {
  assessment_id: string | null;
  trigger_source: "SAMPLING_LAB" | "SENSING_RISK" | "MANUAL_AGRONOMIST" | "CROP_STAGE_WINDOW" | null;
  evidence_tier: "FORMAL" | "WARNING" | "MANUAL_REVIEW" | null;
  fertilization_recommendation_id: string | null;
  fertilization_prescription_id: string | null;
  nutrient: "N" | null;
  material_type: string | null;
  zone_rates: FertilizationReportZoneRateV1[];
  acceptance_status: "PASS" | "FAIL" | "NEEDS_REVIEW" | "MISSING";
  customer_visible_eligible: boolean;
  blocking_reasons: string[];
};

type TenantTripleV1 = { tenant_id: string; project_id: string; group_id: string };

type FactRowV1 = { fact_id: string; occurred_at: string; record_json: any };

function cleanText(input: unknown): string | null {
  const text = String(input ?? "").trim();
  return text ? text : null;
}

function parseJson(input: unknown): any {
  if (input && typeof input === "object") return input;
  if (typeof input === "string") {
    try { return JSON.parse(input); } catch { return null; }
  }
  return null;
}

function finiteOrNull(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(input);
  return Number.isFinite(n) ? n : null;
}

function normalizeTriggerSource(input: unknown): FertilizationReportProjectionV1["trigger_source"] {
  const value = String(input ?? "").trim().toUpperCase();
  if (value === "SAMPLING_LAB" || value === "SENSING_RISK" || value === "MANUAL_AGRONOMIST" || value === "CROP_STAGE_WINDOW") return value;
  return null;
}

function normalizeEvidenceTier(input: unknown): FertilizationReportProjectionV1["evidence_tier"] {
  const value = String(input ?? "").trim().toUpperCase();
  if (value === "FORMAL" || value === "WARNING" || value === "MANUAL_REVIEW") return value;
  return null;
}

function normalizeAcceptanceStatus(input: unknown): FertilizationReportProjectionV1["acceptance_status"] {
  const value = String(input ?? "").trim().toUpperCase();
  if (value === "PASS" || value === "FAIL" || value === "NEEDS_REVIEW" || value === "MISSING") return value;
  return "MISSING";
}

function normalizeZoneResult(input: unknown): FertilizationReportZoneRateV1["result"] {
  const value = String(input ?? "").trim().toUpperCase();
  if (value === "PASS" || value === "FAIL" || value === "NEEDS_REVIEW") return value;
  return "NEEDS_REVIEW";
}

function emptyProjection(blocking_reasons: string[] = ["missing:fertilization"]): FertilizationReportProjectionV1 {
  return {
    assessment_id: null,
    trigger_source: null,
    evidence_tier: null,
    fertilization_recommendation_id: null,
    fertilization_prescription_id: null,
    nutrient: null,
    material_type: null,
    zone_rates: [],
    acceptance_status: "MISSING",
    customer_visible_eligible: false,
    blocking_reasons,
  };
}

function uniqueReasons(input: Array<string | null | undefined>): string[] {
  return Array.from(new Set(input.map((x) => String(x ?? "").trim()).filter(Boolean)));
}

async function queryFacts(pool: Pool, tenant: TenantTripleV1, candidates: string[]): Promise<FactRowV1[]> {
  const keys = Array.from(new Set(candidates.map((x) => String(x ?? "").trim()).filter(Boolean)));
  if (!keys.length) return [];
  const result = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE COALESCE(record_json::jsonb->>'tenant_id', record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND COALESCE(record_json::jsonb->>'project_id', record_json::jsonb#>>'{payload,project_id}') = $2
        AND COALESCE(record_json::jsonb->>'group_id', record_json::jsonb#>>'{payload,group_id}') = $3
        AND (
          record_json::jsonb->>'assessment_id' = ANY($4::text[])
          OR record_json::jsonb->>'fertilization_recommendation_id' = ANY($4::text[])
          OR record_json::jsonb->>'fertilization_prescription_id' = ANY($4::text[])
          OR record_json::jsonb->>'act_task_id' = ANY($4::text[])
          OR record_json::jsonb->>'receipt_id' = ANY($4::text[])
          OR record_json::jsonb->>'operation_plan_id' = ANY($4::text[])
          OR record_json::jsonb#>>'{payload,operation_plan_id}' = ANY($4::text[])
          OR record_json::jsonb#>>'{payload,prescription_id}' = ANY($4::text[])
        )
      ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, keys],
  ).catch(() => ({ rows: [] as any[] }));
  return (result.rows ?? []).map((row: any) => ({ fact_id: String(row.fact_id ?? ""), occurred_at: String(row.occurred_at ?? ""), record_json: parseJson(row.record_json) }));
}

function latest(facts: FactRowV1[], type: string): any | null {
  const hit = [...facts].reverse().find((row) => String(row.record_json?.type ?? "") === type);
  return hit?.record_json ?? null;
}

function findRecommendation(facts: FactRowV1[], prescription: any, acceptance: any): any | null {
  const target = cleanText(prescription?.fertilization_recommendation_id);
  const fromPrescription = target ? [...facts].reverse().find((row) => row.record_json?.type === "fertilization_recommendation_v1" && row.record_json?.fertilization_recommendation_id === target)?.record_json : null;
  if (fromPrescription) return fromPrescription;
  const acceptancePrescriptionId = cleanText(acceptance?.fertilization_prescription_id);
  const byAcceptancePrescription = acceptancePrescriptionId ? [...facts].reverse().find((row) => row.record_json?.type === "fertilization_prescription_v1" && row.record_json?.fertilization_prescription_id === acceptancePrescriptionId)?.record_json : null;
  if (byAcceptancePrescription) {
    const recId = cleanText(byAcceptancePrescription.fertilization_recommendation_id);
    return recId ? [...facts].reverse().find((row) => row.record_json?.type === "fertilization_recommendation_v1" && row.record_json?.fertilization_recommendation_id === recId)?.record_json ?? null : null;
  }
  return latest(facts, "fertilization_recommendation_v1");
}

function findAssessment(facts: FactRowV1[], recommendation: any, prescription: any): any | null {
  const assessmentId = cleanText(recommendation?.assessment_id ?? prescription?.assessment_id);
  if (assessmentId) {
    const hit = [...facts].reverse().find((row) => row.record_json?.type === "nitrogen_need_assessment_v1" && row.record_json?.assessment_id === assessmentId);
    if (hit) return hit.record_json;
  }
  return latest(facts, "nitrogen_need_assessment_v1");
}

function normalizeZoneRates(prescription: any, acceptance: any): FertilizationReportZoneRateV1[] {
  const accepted = Array.isArray(acceptance?.zone_results) ? acceptance.zone_results : [];
  const planned = Array.isArray(prescription?.zone_rates) ? prescription.zone_rates : [];
  const byZone = new Map<string, any>();
  for (const row of accepted) {
    const zoneId = cleanText(row?.zone_id);
    if (zoneId) byZone.set(zoneId, row);
  }
  const source = planned.length ? planned : accepted;
  return source.map((row: any) => {
    const zone_id = cleanText(row?.zone_id) ?? "UNKNOWN_ZONE";
    const acc = byZone.get(zone_id) ?? row;
    return {
      zone_id,
      planned_n_kg_ha: finiteOrNull(acc?.planned_n_kg_ha ?? row?.planned_n_kg_ha ?? row?.planned_amount),
      actual_n_kg_ha: finiteOrNull(acc?.actual_n_kg_ha ?? acc?.actual_rate ?? acc?.applied_amount),
      coverage_percent: finiteOrNull(acc?.coverage_percent),
      deviation_percent: finiteOrNull(acc?.deviation_percent),
      result: normalizeZoneResult(acc?.result ?? acc?.zone_acceptance_result),
    };
  });
}

function buildBlockingReasons(input: { assessment: any; recommendation: any; prescription: any; acceptance: any; zoneRates: FertilizationReportZoneRateV1[] }): string[] {
  const reasons: string[] = [];
  if (!input.assessment) reasons.push("missing:fertilization_assessment");
  if (input.assessment?.trigger_source === "SENSING_RISK") reasons.push("fertilization_sensing_review_only");
  if (input.assessment?.evidence_tier === "WARNING") reasons.push("fertilization_warning_only");
  if (Number(input.assessment?.metrics?.ec_ds_m ?? 0) >= 4) reasons.push("fertilization_salinity_risk");
  if (!input.recommendation) reasons.push("missing:fertilization_recommendation");
  if (input.recommendation && input.recommendation.customer_visible_eligible !== true) reasons.push("fertilization_not_customer_visible");
  if (!input.prescription) reasons.push("missing:fertilization_prescription");
  if (!input.acceptance) reasons.push("missing:fertilization_acceptance");
  if (input.acceptance && normalizeAcceptanceStatus(input.acceptance.acceptance_status) !== "PASS") reasons.push("fertilization_acceptance_not_pass");
  if (input.zoneRates.some((z) => z.result === "FAIL")) reasons.push("fertilization_zone_deviation_large");
  return uniqueReasons(reasons);
}

export async function buildFertilizationReportProjectionV1(pool: Pool, params: {
  tenant: TenantTripleV1;
  operation_plan_id?: string | null;
  operation_id?: string | null;
  act_task_id?: string | null;
  receipt_id?: string | null;
  prescription_id?: string | null;
  recommendation_id?: string | null;
}): Promise<FertilizationReportProjectionV1 | null> {
  const candidates = [
    params.operation_plan_id,
    params.operation_id,
    params.act_task_id,
    params.receipt_id,
    params.prescription_id,
    params.recommendation_id,
  ].map((x) => cleanText(x)).filter((x): x is string => Boolean(x));
  const facts = await queryFacts(pool, params.tenant, candidates);
  const acceptance = latest(facts, "fertilization_acceptance_v1");
  const prescriptionByLatest = latest(facts, "fertilization_prescription_v1");
  const prescription = prescriptionByLatest ?? (acceptance?.fertilization_prescription_id
    ? [...facts].reverse().find((row) => row.record_json?.type === "fertilization_prescription_v1" && row.record_json?.fertilization_prescription_id === acceptance.fertilization_prescription_id)?.record_json ?? null
    : null);
  const recommendation = findRecommendation(facts, prescription, acceptance);
  const assessment = findAssessment(facts, recommendation, prescription);
  if (!assessment && !recommendation && !prescription && !acceptance) return null;
  const zone_rates = normalizeZoneRates(prescription, acceptance);
  const blocking_reasons = buildBlockingReasons({ assessment, recommendation, prescription, acceptance, zoneRates: zone_rates });
  return {
    assessment_id: cleanText(assessment?.assessment_id),
    trigger_source: normalizeTriggerSource(assessment?.trigger_source),
    evidence_tier: normalizeEvidenceTier(assessment?.evidence_tier),
    fertilization_recommendation_id: cleanText(recommendation?.fertilization_recommendation_id ?? prescription?.fertilization_recommendation_id),
    fertilization_prescription_id: cleanText(prescription?.fertilization_prescription_id ?? acceptance?.fertilization_prescription_id),
    nutrient: prescription?.nutrient === "N" ? "N" : null,
    material_type: cleanText(prescription?.material_type),
    zone_rates,
    acceptance_status: normalizeAcceptanceStatus(acceptance?.acceptance_status),
    customer_visible_eligible: Boolean(recommendation?.customer_visible_eligible === true && prescription?.customer_visible_eligible === true && normalizeAcceptanceStatus(acceptance?.acceptance_status) === "PASS"),
    blocking_reasons,
  };
}

export function buildFertilizationReportProjectionFallbackV1(input?: Partial<FertilizationReportProjectionV1> | null): FertilizationReportProjectionV1 {
  return { ...emptyProjection(), ...(input ?? {}) };
}
