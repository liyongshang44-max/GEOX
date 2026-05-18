import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  FertilizationAcceptanceStatusV1,
  FertilizationEvidenceRefV1,
  FertilizationPrescriptionFactV1,
  FertilizationRecommendationFactV1,
  FertilizationRecommendationZoneRateV1,
  FertilizationSensingStateRefV1,
  FertilizationSkillSignalRefV1,
  FertilizationSourceSkillRefV1,
  NitrogenNeedAssessmentFactV1,
  NitrogenNeedAssessmentStatusV1,
  NitrogenNeedMetricsV1,
} from "../../domain/fertilization/fertilization_contract_v1.js";

type TenantScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type TenantFieldScopeV1 = TenantScopeV1 & {
  field_id: string;
};

type FactRowV1<T = Record<string, unknown>> = {
  fact_id: string;
  occurred_at: string;
  source: string;
  record_json: T;
};

type FertilizationServiceErrorStatusV1 = 400 | 404 | 409;

export class FertilizationServiceErrorV1 extends Error {
  constructor(
    message: string,
    public readonly statusCode: FertilizationServiceErrorStatusV1 = 400,
  ) {
    super(message);
  }
}

function nonEmptyText(input: unknown): string | null {
  const text = String(input ?? "").trim();
  return text ? text : null;
}

function finiteOrNull(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(input);
  return Number.isFinite(n) ? n : null;
}

function nowTs(): number {
  return Date.now();
}

function ensureTenantScope(scope: TenantScopeV1): void {
  if (!nonEmptyText(scope.tenant_id) || !nonEmptyText(scope.project_id) || !nonEmptyText(scope.group_id)) {
    throw new FertilizationServiceErrorV1("MISSING_TENANT_SCOPE", 400);
  }
}

function ensureTenantFieldScope(scope: TenantFieldScopeV1): void {
  ensureTenantScope(scope);
  if (!nonEmptyText(scope.field_id)) throw new FertilizationServiceErrorV1("MISSING_FIELD_ID", 400);
}

function tenantMatches(record: any, scope: TenantScopeV1): boolean {
  return String(record?.tenant_id ?? "") === scope.tenant_id
    && String(record?.project_id ?? "") === scope.project_id
    && String(record?.group_id ?? "") === scope.group_id;
}

function tenantFieldMatches(record: any, scope: TenantFieldScopeV1): boolean {
  return tenantMatches(record, scope) && String(record?.field_id ?? "") === scope.field_id;
}

function normalizeEvidenceRefs(input: unknown, required: boolean): FertilizationEvidenceRefV1[] {
  if (!Array.isArray(input)) {
    if (required) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:evidence_refs", 400);
    return [];
  }
  const refs = input.map((entry: any) => ({ kind: nonEmptyText(entry?.kind), ref_id: nonEmptyText(entry?.ref_id) }));
  if (refs.some((entry) => !entry.kind || !entry.ref_id)) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:evidence_refs", 400);
  if (required && refs.length < 1) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:evidence_refs", 400);
  return refs as FertilizationEvidenceRefV1[];
}

function normalizeSkillSignalRefs(input: unknown): FertilizationSkillSignalRefV1[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:skill_signal_refs", 400);
  return input.map((entry: any) => {
    const skill_id = nonEmptyText(entry?.skill_id);
    const signal_type = nonEmptyText(entry?.signal_type);
    if (!skill_id || !signal_type) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:skill_signal_refs", 400);
    return {
      skill_id,
      skill_run_id: nonEmptyText(entry?.skill_run_id),
      skill_trace_id: nonEmptyText(entry?.skill_trace_id),
      signal_type,
    };
  });
}

function normalizeSourceSkillRefs(input: unknown): FertilizationSourceSkillRefV1[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:source_skill_refs", 400);
  return input.map((entry: any) => {
    const skill_id = nonEmptyText(entry?.skill_id);
    if (!skill_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:source_skill_refs", 400);
    return {
      skill_id,
      skill_run_id: nonEmptyText(entry?.skill_run_id),
      output_ref: nonEmptyText(entry?.output_ref),
    };
  });
}

function normalizeSensingStateRefs(input: unknown): FertilizationSensingStateRefV1[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:sensing_state_refs", 400);
  return input.map((entry: any) => {
    const state_type = nonEmptyText(entry?.state_type);
    const ref_id = nonEmptyText(entry?.ref_id);
    if (!state_type || !ref_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:sensing_state_refs", 400);
    return { state_type, ref_id };
  });
}

function normalizeNitrogenMetrics(input: unknown): NitrogenNeedMetricsV1 {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return {
    nitrate_n_mg_kg: finiteOrNull(src.nitrate_n_mg_kg),
    ammonium_n_mg_kg: finiteOrNull(src.ammonium_n_mg_kg),
    total_n_percent: finiteOrNull(src.total_n_percent),
    organic_matter_percent: finiteOrNull(src.organic_matter_percent),
    tissue_n_percent: finiteOrNull(src.tissue_n_percent),
    ec_ds_m: finiteOrNull(src.ec_ds_m),
    canopy_temp_c: finiteOrNull(src.canopy_temp_c),
  };
}

function hasNitrogenMetric(metrics: NitrogenNeedMetricsV1): boolean {
  return metrics.nitrate_n_mg_kg != null
    || metrics.ammonium_n_mg_kg != null
    || metrics.total_n_percent != null
    || metrics.tissue_n_percent != null;
}

function normalizeAssessmentStatus(input: unknown, fallback: NitrogenNeedAssessmentStatusV1): NitrogenNeedAssessmentStatusV1 {
  const status = String(input ?? fallback).trim().toUpperCase();
  if (["SUFFICIENT", "LOW_N_RISK", "NEEDS_REVIEW", "INVALID"].includes(status)) return status as NitrogenNeedAssessmentStatusV1;
  throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:status", 400);
}

function normalizeZoneRates(input: unknown): FertilizationRecommendationZoneRateV1[] {
  if (!Array.isArray(input)) return [];
  return input.map((entry: any) => {
    const zone_id = nonEmptyText(entry?.zone_id);
    const n_kg_ha = finiteOrNull(entry?.n_kg_ha);
    const confidence = String(entry?.confidence ?? "MEDIUM").trim().toUpperCase();
    const reason = nonEmptyText(entry?.reason);
    if (!zone_id || n_kg_ha == null || n_kg_ha < 0 || !["HIGH", "MEDIUM", "LOW"].includes(confidence) || !reason) {
      throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:zone_rates", 400);
    }
    return { zone_id, n_kg_ha, confidence: confidence as "HIGH" | "MEDIUM" | "LOW", reason };
  });
}

function normalizeRiskFlags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map(nonEmptyText).filter((x): x is string => Boolean(x))));
}

function normalizeReasons(input: unknown, fallback: string[]): string[] {
  if (!Array.isArray(input)) return fallback;
  const reasons = input.map(nonEmptyText).filter((x): x is string => Boolean(x));
  return reasons.length ? reasons : fallback;
}

function uniqueEvidenceRefs(refs: FertilizationEvidenceRefV1[]): FertilizationEvidenceRefV1[] {
  const seen = new Set<string>();
  const out: FertilizationEvidenceRefV1[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.ref_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

const INSERT_FACT_SQL = `
  INSERT INTO facts (fact_id, occurred_at, source, record_json)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (fact_id) DO NOTHING
  RETURNING fact_id
`;

export class FertilizationServiceV1 {
  constructor(private readonly pool: Pool) {}

  private async insertFact(record_json: Record<string, unknown>, prefix: string): Promise<{ fact_id: string }> {
    const fact_id = `${prefix}_${randomUUID()}`;
    const result = await this.pool.query(INSERT_FACT_SQL, [fact_id, new Date().toISOString(), "api_v1_fertilization", JSON.stringify(record_json)]);
    if (!Array.isArray(result.rows) || result.rows.length < 1) throw new FertilizationServiceErrorV1("FACT_INSERT_CONFLICT_OR_FAILED", 409);
    return { fact_id };
  }

  private async findFactByTypeAndKey(type: string, key: string, value: string): Promise<FactRowV1 | null> {
    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = $1
          AND (record_json::jsonb->>$2) = $3
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [type, key, value],
    );
    return result.rows?.[0] ?? null;
  }

  private async findLabResult(scope: TenantScopeV1, sample_id: string, lab_import_id: string): Promise<FactRowV1 | null> {
    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'lab_result_import_v1'
          AND (record_json::jsonb->>'sample_id') = $1
          AND (record_json::jsonb->>'import_id') = $2
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [sample_id, lab_import_id],
    );
    const row = result.rows?.[0] ?? null;
    if (!row) return null;
    const receipt = await this.findFactByTypeAndKey("sample_receipt_v1", "sample_id", sample_id);
    if (!receipt || !tenantMatches(receipt.record_json, scope)) return null;
    return row;
  }

  private async findSamplingAcceptancePass(scope: TenantScopeV1, sample_id: string, lab_import_id: string): Promise<FactRowV1 | null> {
    const result = await this.pool.query(
      `SELECT fact_id, occurred_at, source, record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'sampling_acceptance_v1'
          AND (record_json::jsonb->>'sample_id') = $1
          AND COALESCE(record_json::jsonb->>'import_id', '') = $2
          AND UPPER(COALESCE(record_json::jsonb->>'verdict', '')) = 'PASS'
        ORDER BY occurred_at DESC
        LIMIT 1`,
      [sample_id, lab_import_id],
    );
    const row = result.rows?.[0] ?? null;
    if (!row || !tenantMatches(row.record_json, scope)) return null;
    return row;
  }

  async createNitrogenAssessment(input: TenantFieldScopeV1 & {
    season_id?: string | null;
    crop_code?: string | null;
    trigger_source: string;
    evidence_tier?: string;
    sample_id?: string | null;
    lab_import_id?: string | null;
    skill_signal_refs?: unknown;
    sensing_state_refs?: unknown;
    sample_type?: string | null;
    metrics?: unknown;
    status?: string;
    reasons?: unknown;
    evidence_refs?: unknown;
  }): Promise<{ assessment: NitrogenNeedAssessmentFactV1; fact_id: string }> {
    ensureTenantFieldScope(input);
    const trigger_source = String(input.trigger_source ?? "").trim().toUpperCase();
    if (!["SAMPLING_LAB", "SENSING_RISK", "MANUAL_AGRONOMIST", "CROP_STAGE_WINDOW"].includes(trigger_source)) {
      throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:trigger_source", 400);
    }
    if (trigger_source === "CROP_STAGE_WINDOW") throw new FertilizationServiceErrorV1("UNSUPPORTED_TRIGGER_SOURCE_FOR_API", 400);

    const skill_signal_refs = normalizeSkillSignalRefs(input.skill_signal_refs);
    const sensing_state_refs = normalizeSensingStateRefs(input.sensing_state_refs);
    let metrics = normalizeNitrogenMetrics(input.metrics);
    let evidence_refs = normalizeEvidenceRefs(input.evidence_refs, trigger_source === "MANUAL_AGRONOMIST");
    let evidence_tier: "FORMAL" | "WARNING" | "MANUAL_REVIEW";
    let status: NitrogenNeedAssessmentStatusV1;
    let reasons: string[];

    if (trigger_source === "SAMPLING_LAB") {
      const sample_id = nonEmptyText(input.sample_id);
      const lab_import_id = nonEmptyText(input.lab_import_id);
      if (!sample_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:sample_id", 400);
      if (!lab_import_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:lab_import_id", 400);
      const lab = await this.findLabResult(input, sample_id, lab_import_id);
      if (!lab) throw new FertilizationServiceErrorV1("NOT_FOUND:lab_result_import_v1", 404);
      const labRecord: any = lab.record_json ?? {};
      if (String(labRecord.quality_status ?? "").trim().toUpperCase() !== "PASS") {
        throw new FertilizationServiceErrorV1("LAB_RESULT_QUALITY_STATUS_NOT_PASS", 400);
      }
      const samplingAcceptance = await this.findSamplingAcceptancePass(input, sample_id, lab_import_id);
      if (!samplingAcceptance) throw new FertilizationServiceErrorV1("SAMPLING_ACCEPTANCE_PASS_REQUIRED", 400);
      metrics = normalizeNitrogenMetrics(input.metrics ?? labRecord.metrics);
      if (!hasNitrogenMetric(metrics)) throw new FertilizationServiceErrorV1("MISSING_NITROGEN_METRIC", 400);
      evidence_tier = "FORMAL";
      status = normalizeAssessmentStatus(input.status, "NEEDS_REVIEW");
      if (!["LOW_N_RISK", "SUFFICIENT", "NEEDS_REVIEW"].includes(status)) throw new FertilizationServiceErrorV1("FORMAL_ASSESSMENT_STATUS_INVALID", 400);
      reasons = normalizeReasons(input.reasons, status === "LOW_N_RISK" ? ["FORMAL_LAB_RESULT_LOW_N_RISK"] : ["FORMAL_LAB_RESULT_REVIEWED"]);
      evidence_refs = uniqueEvidenceRefs([
        ...evidence_refs,
        { kind: "lab_result_import_v1", ref_id: lab_import_id },
        { kind: "sampling_acceptance_v1", ref_id: String(samplingAcceptance.record_json?.acceptance_id ?? samplingAcceptance.fact_id) },
      ]);
    } else if (trigger_source === "SENSING_RISK") {
      if (skill_signal_refs.length < 1 && sensing_state_refs.length < 1) {
        throw new FertilizationServiceErrorV1("SENSING_RISK_REQUIRES_SIGNAL_REFS", 400);
      }
      evidence_tier = "WARNING";
      status = "NEEDS_REVIEW";
      if (String(input.status ?? "").trim().toUpperCase() === "LOW_N_RISK") throw new FertilizationServiceErrorV1("SENSING_RISK_CANNOT_BE_LOW_N_RISK", 400);
      reasons = normalizeReasons(input.reasons, ["SENSING_RISK_REQUIRES_REVIEW"]);
    } else {
      evidence_refs = normalizeEvidenceRefs(input.evidence_refs, true);
      evidence_tier = "MANUAL_REVIEW";
      status = normalizeAssessmentStatus(input.status, "NEEDS_REVIEW");
      if (status === "LOW_N_RISK") throw new FertilizationServiceErrorV1("MANUAL_REVIEW_CANNOT_DIRECTLY_CONFIRM_LOW_N_RISK", 400);
      reasons = normalizeReasons(input.reasons, ["MANUAL_AGRONOMIST_REVIEW_REQUIRED"]);
    }

    const assessment_id = randomUUID();
    const assessment: NitrogenNeedAssessmentFactV1 = {
      type: "nitrogen_need_assessment_v1",
      schema_version: "1",
      assessment_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      season_id: nonEmptyText(input.season_id),
      crop_code: nonEmptyText(input.crop_code),
      trigger_source: trigger_source as NitrogenNeedAssessmentFactV1["trigger_source"],
      evidence_tier,
      sample_id: nonEmptyText(input.sample_id),
      lab_import_id: nonEmptyText(input.lab_import_id),
      skill_signal_refs,
      sensing_state_refs,
      sample_type: input.sample_type === "SOIL" || input.sample_type === "TISSUE" ? input.sample_type : null,
      metrics,
      status,
      reasons,
      evidence_refs,
      created_at_ts: nowTs(),
    };
    const inserted = await this.insertFact(assessment, "fna");
    return { assessment, fact_id: inserted.fact_id };
  }

  async getAssessment(scope: TenantScopeV1, assessment_id: string): Promise<FactRowV1<NitrogenNeedAssessmentFactV1> | null> {
    ensureTenantScope(scope);
    const row = await this.findFactByTypeAndKey("nitrogen_need_assessment_v1", "assessment_id", assessment_id) as FactRowV1<NitrogenNeedAssessmentFactV1> | null;
    if (!row || !tenantMatches(row.record_json, scope)) return null;
    return row;
  }

  async createRecommendation(input: TenantFieldScopeV1 & {
    assessment_id: string;
    suggested_total_n_kg_ha?: unknown;
    zone_rates?: unknown;
    risk_flags?: unknown;
    customer_visible_eligible?: boolean;
    evidence_refs?: unknown;
    source_skill_refs?: unknown;
  }): Promise<{ recommendation: FertilizationRecommendationFactV1; fact_id: string }> {
    ensureTenantFieldScope(input);
    const assessment_id = nonEmptyText(input.assessment_id);
    if (!assessment_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:assessment_id", 400);
    const assessmentRow = await this.getAssessment(input, assessment_id);
    if (!assessmentRow) throw new FertilizationServiceErrorV1("NOT_FOUND:assessment", 404);
    const assessment = assessmentRow.record_json;
    if (!tenantFieldMatches(assessment, input)) throw new FertilizationServiceErrorV1("NOT_FOUND", 404);

    const formalLowN = assessment.status === "LOW_N_RISK" && assessment.evidence_tier === "FORMAL";
    const requestedCustomerVisible = input.customer_visible_eligible === true;
    if (requestedCustomerVisible && !formalLowN) {
      throw new FertilizationServiceErrorV1("CUSTOMER_VISIBLE_RECOMMENDATION_REQUIRES_FORMAL_LOW_N_RISK", 400);
    }
    const customer_visible_eligible = requestedCustomerVisible && formalLowN;
    const source_skill_refs = normalizeSourceSkillRefs(input.source_skill_refs);

    const recommendation_id = randomUUID();
    const recommendation: FertilizationRecommendationFactV1 = {
      type: "fertilization_recommendation_v1",
      schema_version: "1",
      fertilization_recommendation_id: recommendation_id,
      assessment_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      recommendation_type: "NITROGEN",
      suggested_total_n_kg_ha: finiteOrNull(input.suggested_total_n_kg_ha),
      zone_rates: normalizeZoneRates(input.zone_rates),
      risk_flags: normalizeRiskFlags(input.risk_flags),
      customer_visible_eligible,
      evidence_refs: uniqueEvidenceRefs([...normalizeEvidenceRefs(input.evidence_refs, false), { kind: "nitrogen_need_assessment_v1", ref_id: assessment_id }]),
      source_skill_refs,
      created_at_ts: nowTs(),
    };
    const inserted = await this.insertFact(recommendation, "frc");
    return { recommendation, fact_id: inserted.fact_id };
  }

  async getRecommendation(scope: TenantScopeV1, fertilization_recommendation_id: string): Promise<FactRowV1<FertilizationRecommendationFactV1> | null> {
    ensureTenantScope(scope);
    const row = await this.findFactByTypeAndKey("fertilization_recommendation_v1", "fertilization_recommendation_id", fertilization_recommendation_id) as FactRowV1<FertilizationRecommendationFactV1> | null;
    if (!row || !tenantMatches(row.record_json, scope)) return null;
    return row;
  }

  async createPrescription(input: TenantFieldScopeV1 & {
    fertilization_recommendation_id: string;
    zone_rates?: unknown;
    material_type?: string | null;
    manual_approval_required?: boolean;
    evidence_refs?: unknown;
  }): Promise<{ prescription: FertilizationPrescriptionFactV1; fact_id: string }> {
    ensureTenantFieldScope(input);
    const fertilization_recommendation_id = nonEmptyText(input.fertilization_recommendation_id);
    if (!fertilization_recommendation_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:fertilization_recommendation_id", 400);
    const recommendationRow = await this.getRecommendation(input, fertilization_recommendation_id);
    if (!recommendationRow) throw new FertilizationServiceErrorV1("NOT_FOUND:fertilization_recommendation", 404);
    const recommendation = recommendationRow.record_json;
    if (!tenantFieldMatches(recommendation, input)) throw new FertilizationServiceErrorV1("NOT_FOUND", 404);
    if (recommendation.customer_visible_eligible !== true) {
      throw new FertilizationServiceErrorV1("PRESCRIPTION_REQUIRES_CUSTOMER_VISIBLE_RECOMMENDATION", 400);
    }

    const sourceRates = Array.isArray(input.zone_rates) && input.zone_rates.length > 0
      ? input.zone_rates
      : recommendation.zone_rates.map((z) => ({ zone_id: z.zone_id, planned_n_kg_ha: z.n_kg_ha, max_n_kg_ha: null, required: true, reason: z.reason }));
    if (!Array.isArray(sourceRates) || sourceRates.length < 1) throw new FertilizationServiceErrorV1("PRESCRIPTION_ZONE_RATES_REQUIRED", 400);

    const zone_rates = sourceRates.map((entry: any) => {
      const zone_id = nonEmptyText(entry?.zone_id);
      const planned_n_kg_ha = finiteOrNull(entry?.planned_n_kg_ha ?? entry?.n_kg_ha);
      const max_n_kg_ha = finiteOrNull(entry?.max_n_kg_ha);
      if (!zone_id || planned_n_kg_ha == null) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:zone_rates", 400);
      if (planned_n_kg_ha < 0) throw new FertilizationServiceErrorV1("PLANNED_N_KG_HA_NEGATIVE", 400);
      if (max_n_kg_ha != null && planned_n_kg_ha > max_n_kg_ha) throw new FertilizationServiceErrorV1("PLANNED_N_KG_HA_EXCEEDS_MAX", 400);
      return {
        zone_id,
        planned_n_kg_ha,
        max_n_kg_ha,
        unit: "kgN/ha" as const,
        required: entry?.required !== false,
        reason: nonEmptyText(entry?.reason),
      };
    });

    const fertilization_prescription_id = randomUUID();
    const prescription: FertilizationPrescriptionFactV1 = {
      type: "fertilization_prescription_v1",
      schema_version: "1",
      fertilization_prescription_id,
      fertilization_recommendation_id,
      assessment_id: recommendation.assessment_id,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: input.field_id,
      nutrient: "N",
      material_type: nonEmptyText(input.material_type),
      zone_rates,
      manual_approval_required: input.manual_approval_required !== false,
      customer_visible_eligible: true,
      status: "READY_FOR_APPROVAL",
      evidence_refs: uniqueEvidenceRefs([...normalizeEvidenceRefs(input.evidence_refs, false), { kind: "fertilization_recommendation_v1", ref_id: fertilization_recommendation_id }]),
      created_at_ts: nowTs(),
    };
    const inserted = await this.insertFact(prescription, "fpr");
    return { prescription, fact_id: inserted.fact_id };
  }

  async getPrescription(scope: TenantScopeV1, fertilization_prescription_id: string): Promise<FactRowV1<FertilizationPrescriptionFactV1> | null> {
    ensureTenantScope(scope);
    const row = await this.findFactByTypeAndKey("fertilization_prescription_v1", "fertilization_prescription_id", fertilization_prescription_id) as FactRowV1<FertilizationPrescriptionFactV1> | null;
    if (!row || !tenantMatches(row.record_json, scope)) return null;
    return row;
  }

  async evaluateAcceptance(input: TenantScopeV1 & {
    fertilization_prescription_id: string;
    receipt_id?: string | null;
    act_task_id?: string | null;
    operation_plan_id?: string | null;
    as_applied_id?: string | null;
    receipt_status?: string | null;
    zone_applications?: unknown;
    evidence_refs?: unknown;
  }): Promise<{ acceptance: Record<string, unknown>; fact_id: string }> {
    ensureTenantScope(input);
    const fertilization_prescription_id = nonEmptyText(input.fertilization_prescription_id);
    if (!fertilization_prescription_id) throw new FertilizationServiceErrorV1("MISSING_OR_INVALID:fertilization_prescription_id", 400);
    const prescriptionRow = await this.getPrescription(input, fertilization_prescription_id);
    if (!prescriptionRow) throw new FertilizationServiceErrorV1("NOT_FOUND:fertilization_prescription", 404);
    const prescription = prescriptionRow.record_json;

    const apps = Array.isArray(input.zone_applications) ? input.zone_applications : [];
    const requiredZones = prescription.zone_rates.filter((z) => z.required !== false);
    const zone_results = requiredZones.map((zone) => {
      const app = apps.find((entry: any) => String(entry?.zone_id ?? "") === zone.zone_id) as any;
      const actual_n_kg_ha = finiteOrNull(app?.actual_n_kg_ha ?? app?.applied_n_kg_ha ?? app?.actual_rate);
      const coverage_percent = finiteOrNull(app?.coverage_percent);
      const deviation_percent = actual_n_kg_ha == null || zone.planned_n_kg_ha <= 0
        ? null
        : Math.abs(actual_n_kg_ha - zone.planned_n_kg_ha) / zone.planned_n_kg_ha;
      const reasons: string[] = [];
      let result: "PASS" | "FAIL" | "NEEDS_REVIEW" = "PASS";
      if (!app) {
        result = "NEEDS_REVIEW";
        reasons.push("MISSING_ZONE_APPLICATION");
      } else if (actual_n_kg_ha == null) {
        result = "NEEDS_REVIEW";
        reasons.push("MISSING_ACTUAL_N_KG_HA");
      } else if (coverage_percent != null && coverage_percent < 0.9) {
        result = "FAIL";
        reasons.push("ZONE_COVERAGE_BELOW_THRESHOLD");
      } else if (deviation_percent != null && deviation_percent > 0.15) {
        result = "FAIL";
        reasons.push("ZONE_N_DEVIATION_EXCEEDED");
      } else {
        reasons.push("ZONE_APPLICATION_WITHIN_TOLERANCE");
      }
      return {
        zone_id: zone.zone_id,
        planned_n_kg_ha: zone.planned_n_kg_ha,
        actual_n_kg_ha,
        coverage_percent,
        deviation_percent,
        result,
        reasons,
      };
    });

    let acceptance_status: FertilizationAcceptanceStatusV1 = "PASS";
    if (zone_results.length < 1 || zone_results.some((z) => z.result === "NEEDS_REVIEW")) acceptance_status = "NEEDS_REVIEW";
    if (zone_results.some((z) => z.result === "FAIL")) acceptance_status = "FAIL";
    if (apps.length < 1) acceptance_status = "NEEDS_REVIEW";

    const acceptance = {
      type: "fertilization_acceptance_v1",
      schema_version: "1",
      fertilization_acceptance_id: randomUUID(),
      fertilization_prescription_id,
      tenant_id: prescription.tenant_id,
      project_id: prescription.project_id,
      group_id: prescription.group_id,
      field_id: prescription.field_id,
      operation_plan_id: nonEmptyText(input.operation_plan_id),
      act_task_id: nonEmptyText(input.act_task_id),
      receipt_id: nonEmptyText(input.receipt_id),
      as_applied_id: nonEmptyText(input.as_applied_id),
      acceptance_status,
      zone_results,
      operation_rollup_policy: "ALL_REQUIRED_ZONES_PASS",
      reasons: acceptance_status === "PASS" ? ["ALL_REQUIRED_ZONES_PASS"] : ["ZONE_LEVEL_EVIDENCE_REQUIRED"],
      evidence_refs: uniqueEvidenceRefs([
        ...normalizeEvidenceRefs(input.evidence_refs, false),
        { kind: "fertilization_prescription_v1", ref_id: fertilization_prescription_id },
      ]),
      evaluated_at_ts: nowTs(),
    };
    const inserted = await this.insertFact(acceptance, "fac");
    return { acceptance, fact_id: inserted.fact_id };
  }
}
