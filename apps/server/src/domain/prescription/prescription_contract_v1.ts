import { randomUUID } from "node:crypto";
import type {
  PrescriptionContractV1,
  PrescriptionOperationTypeV1,
  PrescriptionRiskLevelV1,
  PrescriptionStatusV1,
  SkillTraceV1,
} from "@geox/contracts";
import type { Pool } from "pg";
import { buildSkillTraceRef } from "../../services/skill_trace_service.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

type FromRecommendationInput = {
  recommendation_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id?: string | null;
  crop_id?: string | null;
  zone_id?: string | null;
  created_by?: string | null;
};

type RecommendationFact = {
  fact_id: string;
  payload: any;
};

function parseJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return null;
}

function toText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeEvidenceRefs(rec: any): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.add(v.trim());
  };
  if (Array.isArray(rec?.evidence_refs)) for (const x of rec.evidence_refs) add(x);
  if (Array.isArray(rec?.evidence_basis)) {
    for (const x of rec.evidence_basis) {
      add(x);
      if (x && typeof x === "object") {
        add((x as any).ref);
        add((x as any).fact_id);
        add((x as any).id);
      }
    }
  }
  if (rec?.evidence_basis && typeof rec.evidence_basis === "object") {
    const telemetryRefs = Array.isArray(rec.evidence_basis.telemetry_refs) ? rec.evidence_basis.telemetry_refs : [];
    for (const ref of telemetryRefs) add(ref);
    add(rec.evidence_basis.snapshot_id);
  }
  if (Array.isArray(rec?.skill_trace?.evidence_refs)) {
    for (const x of rec.skill_trace.evidence_refs) add(x);
  }
  add(buildSkillTraceRef(rec?.skill_trace));
  return [...out];
}

function deriveOperationType(rec: any): PrescriptionOperationTypeV1 {
  const suggestedAction = String(rec?.suggested_action?.action_type ?? "").trim().toLowerCase();
  const topAction = String(rec?.action_type ?? "").trim().toUpperCase();
  const recommendationType = String(rec?.recommendation_type ?? "").trim().toLowerCase();
  if (
    topAction === "IRRIGATE"
    || suggestedAction === "irrigation.start"
    || suggestedAction === "irrigation.apply"
    || recommendationType === "irrigation_recommendation_v1"
  ) return "IRRIGATION";
  if (
    topAction === "FERTILIZE"
    || suggestedAction === "fertilization.apply"
    || suggestedAction === "fertilizer.apply"
    || recommendationType.includes("fertil")
  ) return "FERTILIZATION";
  if (
    topAction === "SPRAY"
    || suggestedAction === "spray.start"
    || suggestedAction === "spraying.apply"
    || recommendationType.includes("spray")
  ) return "SPRAYING";
  if (
    topAction === "INSPECT"
    || suggestedAction.includes("inspect")
    || recommendationType.includes("crop_health")
    || recommendationType.includes("pest_risk")
    || recommendationType === "inspection_recommendation_v1"
  ) return "INSPECTION";
  return "OTHER";
}

function baseRiskLevel(operationType: PrescriptionOperationTypeV1): PrescriptionRiskLevelV1 {
  if (operationType === "INSPECTION") return "LOW";
  if (operationType === "IRRIGATION") return "MEDIUM";
  if (operationType === "FERTILIZATION") return "HIGH";
  if (operationType === "SPRAYING") return "HIGH";
  return "MEDIUM";
}

function escalateRisk(level: PrescriptionRiskLevelV1, target: PrescriptionRiskLevelV1): PrescriptionRiskLevelV1 {
  const rank: Record<PrescriptionRiskLevelV1, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return rank[target] > rank[level] ? target : level;
}

function deriveOperationAmount(
  rec: any,
  operationType: PrescriptionOperationTypeV1,
  paramsOverride?: Record<string, unknown>,
): { amount: PrescriptionContractV1["operation_amount"]; missingAmount: boolean } {
  const params = paramsOverride ?? ((rec?.suggested_action?.parameters && typeof rec.suggested_action.parameters === "object")
    ? rec.suggested_action.parameters
    : {});

  const amountExplicit = toNumber(params.amount);
  const waterMm = toNumber(params.water_mm ?? params.irrigation_mm);
  const fertilizerKgHa = toNumber(params.fertilizer_kg_ha);
  const rate = toNumber(params.rate);

  if (amountExplicit !== null) {
    return {
      amount: {
        amount: amountExplicit,
        unit: toText(params.unit) ?? "unit",
        rate,
        rate_unit: toText(params.rate_unit),
        parameters: params,
      },
      missingAmount: false,
    };
  }
  if (waterMm !== null) {
    return { amount: { amount: waterMm, unit: "mm", parameters: params }, missingAmount: false };
  }
  if (fertilizerKgHa !== null) {
    return { amount: { amount: fertilizerKgHa, unit: "kg/ha", parameters: params }, missingAmount: false };
  }
  if (operationType === "IRRIGATION") {
    return { amount: { amount: 25, unit: "L", rate, parameters: params }, missingAmount: false };
  }
  if (operationType === "INSPECTION") {
    return { amount: { amount: 1, unit: "visit", parameters: params }, missingAmount: false };
  }
  return { amount: { amount: 0, unit: "pending", rate, parameters: params }, missingAmount: true };
}

function deriveApprovalRequirement(operationType: PrescriptionOperationTypeV1): PrescriptionContractV1["approval_requirement"] {
  if (operationType === "IRRIGATION") {
    return { required: true, role: "field_manager", second_confirmation_required: false, auto_execute_allowed: false, manual_takeover_required: true };
  }
  if (operationType === "FERTILIZATION" || operationType === "SPRAYING") {
    return { required: true, role: "agronomist_or_manager", second_confirmation_required: true, auto_execute_allowed: false, manual_takeover_required: true };
  }
  if (operationType === "INSPECTION") {
    return { required: false, role: null, second_confirmation_required: false, auto_execute_allowed: false, manual_takeover_required: false };
  }
  return { required: true, role: "field_manager", second_confirmation_required: false, auto_execute_allowed: false, manual_takeover_required: true };
}

function deriveAcceptanceConditions(operationType: PrescriptionOperationTypeV1): PrescriptionContractV1["acceptance_conditions"] {
  if (operationType === "IRRIGATION") {
    return {
      amount_tolerance_percent: 15,
      required_coverage_percent: 95,
      required_execution_window: true,
      required_post_metric: {
        metric: "soil_moisture_delta",
        operator: ">",
        value: 0,
        unit: "delta",
        observation_window_hours: 24,
      },
      evidence_required: ["receipt", "post_soil_moisture", "soil_moisture_delta"],
      failure_conditions: ["NO_RECEIPT", "NO_POST_MOISTURE_INCREASE"],
      insufficient_evidence_conditions: ["MISSING_RECEIPT", "MISSING_POST_SENSOR_DATA"],
    };
  }
  if (operationType === "INSPECTION") {
    return {
      required_coverage_percent: null,
      required_execution_window: true,
      evidence_required: ["human_receipt"],
      failure_conditions: ["NO_RECEIPT"],
      insufficient_evidence_conditions: ["MISSING_HUMAN_EVIDENCE"],
    };
  }
  return {
    required_execution_window: true,
    evidence_required: ["receipt"],
    failure_conditions: ["NO_RECEIPT"],
    insufficient_evidence_conditions: ["MISSING_RECEIPT"],
  };
}

function deriveStatus(operationType: PrescriptionOperationTypeV1, missingAmount: boolean): PrescriptionStatusV1 {
  if ((operationType === "FERTILIZATION" || operationType === "SPRAYING") && missingAmount) {
    return "DRAFT";
  }
  return "READY_FOR_APPROVAL";
}

function hydratePrescription(row: any): PrescriptionContractV1 {
  const skillTrace = parseJsonMaybe(row.skill_trace);
  const hydratedSkillTrace = (skillTrace && typeof skillTrace === "object" && typeof (skillTrace as any).skill_id === "string")
    ? skillTrace as SkillTraceV1
    : undefined;
  return {
    prescription_id: String(row.prescription_id),
    recommendation_id: String(row.recommendation_id),
    tenant_id: String(row.tenant_id),
    project_id: String(row.project_id),
    group_id: String(row.group_id),
    field_id: String(row.field_id),
    season_id: row.season_id ? String(row.season_id) : null,
    crop_id: row.crop_id ? String(row.crop_id) : null,
    zone_id: row.zone_id ? String(row.zone_id) : null,
    operation_type: String(row.operation_type) as PrescriptionOperationTypeV1,
    spatial_scope: parseJsonMaybe(row.spatial_scope) ?? {},
    timing_window: parseJsonMaybe(row.timing_window) ?? {},
    operation_amount: parseJsonMaybe(row.operation_amount) ?? {},
    device_requirements: parseJsonMaybe(row.device_requirements) ?? {},
    risk: parseJsonMaybe(row.risk) ?? { level: "MEDIUM", reasons: [] },
    evidence_refs: Array.isArray(parseJsonMaybe(row.evidence_refs)) ? parseJsonMaybe(row.evidence_refs) : [],
    skill_trace_id: row.skill_trace_id ? String(row.skill_trace_id) : undefined,
    skill_trace: hydratedSkillTrace,
    approval_requirement: parseJsonMaybe(row.approval_requirement) ?? {},
    acceptance_conditions: parseJsonMaybe(row.acceptance_conditions) ?? { evidence_required: [] },
    status: String(row.status) as PrescriptionStatusV1,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    created_by: row.created_by ? String(row.created_by) : null,
  };
}

export async function getPrescriptionById(pool: Pool, prescription_id: string, scope?: TenantTriple): Promise<PrescriptionContractV1 | null> {
  const scopedSql = scope
    ? "SELECT * FROM prescription_contract_v1 WHERE prescription_id = $1 AND tenant_id = $2 AND project_id = $3 AND group_id = $4 LIMIT 1"
    : "SELECT * FROM prescription_contract_v1 WHERE prescription_id = $1 LIMIT 1";
  const res = await pool.query(scopedSql, scope
    ? [prescription_id, scope.tenant_id, scope.project_id, scope.group_id]
    : [prescription_id]);
  if (!res.rows.length) return null;
  return hydratePrescription(res.rows[0]);
}

export async function getPrescriptionByRecommendationId(pool: Pool, recommendation_id: string, scope?: TenantTriple): Promise<PrescriptionContractV1 | null> {
  const scopedSql = scope
    ? "SELECT * FROM prescription_contract_v1 WHERE recommendation_id = $1 AND tenant_id = $2 AND project_id = $3 AND group_id = $4 LIMIT 1"
    : "SELECT * FROM prescription_contract_v1 WHERE recommendation_id = $1 LIMIT 1";
  const res = await pool.query(scopedSql, scope
    ? [recommendation_id, scope.tenant_id, scope.project_id, scope.group_id]
    : [recommendation_id]);
  if (!res.rows.length) return null;
  return hydratePrescription(res.rows[0]);
}

export async function loadRecommendationFact(pool: Pool, tenant: TenantTriple, recommendation_id: string): Promise<RecommendationFact | null> {
  const res = await pool.query(
    `SELECT fact_id, record_json
     FROM facts
     WHERE (record_json::jsonb->>'type') = 'decision_recommendation_v1'
       AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
       AND (record_json::jsonb#>>'{payload,project_id}') = $2
       AND (record_json::jsonb#>>'{payload,group_id}') = $3
       AND (record_json::jsonb#>>'{payload,recommendation_id}') = $4
     ORDER BY occurred_at DESC, fact_id DESC
     LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, recommendation_id],
  );
  if (!res.rows.length) return null;
  const payload = parseJsonMaybe(res.rows[0].record_json)?.payload ?? null;
  if (!payload) return null;
  return { fact_id: String(res.rows[0].fact_id), payload };
}

export async function createPrescriptionFromRecommendation(pool: Pool, input: FromRecommendationInput, recPayload: any): Promise<{ prescription: PrescriptionContractV1; idempotent: boolean }> {
  const exists = await getPrescriptionByRecommendationId(pool, input.recommendation_id, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
  });
  if (exists) return { prescription: exists, idempotent: true };

  const operation_type = deriveOperationType(recPayload);
  const recommendationSkillTrace = (recPayload?.skill_trace && typeof recPayload.skill_trace === "object") ? recPayload.skill_trace as SkillTraceV1 : null;
  const skill_trace_id = toText(recPayload?.skill_trace_id)
    ?? toText(recommendationSkillTrace?.trace_id)
    ?? null;
  const suggestionParams = (recPayload?.suggested_action?.parameters && typeof recPayload.suggested_action.parameters === "object") ? recPayload.suggested_action.parameters : {};
  const operationParamsWithTrace = {
    ...suggestionParams,
    metadata: {
      trace_id: recommendationTraceId,
      recommendation_id: toText(recPayload?.recommendation_id),
      recommendation_type: toText(recPayload?.recommendation_type),
      action_type: toText(recPayload?.action_type),
      skill_trace: recommendationSkillTrace,
    },
    preserved_payload: {
      skill_trace: recommendationSkillTrace,
      evidence_basis: recPayload?.evidence_basis ?? null,
      rule_hit: Array.isArray(recPayload?.rule_hit) ? recPayload.rule_hit : [],
    },
  };
  const { amount: operation_amount, missingAmount } = deriveOperationAmount(recPayload, operation_type, operationParamsWithTrace);
  const evidence_refs = normalizeEvidenceRefs(recPayload);

  let riskLevel = baseRiskLevel(operation_type);
  const reasons: string[] = [];
  if (missingAmount) {
    reasons.push("MISSING_OPERATION_AMOUNT");
    if (operation_type === "SPRAYING") riskLevel = escalateRisk(riskLevel, "HIGH");
    else riskLevel = escalateRisk(riskLevel, "MEDIUM");
  }
  if (!evidence_refs.length) {
    reasons.push("MISSING_EVIDENCE_REFS");
    riskLevel = escalateRisk(riskLevel, "HIGH");
  }

  const status = deriveStatus(operation_type, missingAmount);
  const now = new Date().toISOString();
  const prescription_id = `prc_${randomUUID().replace(/-/g, "")}`;

  const prescription: PrescriptionContractV1 = {
    prescription_id,
    recommendation_id: input.recommendation_id,
    trace_id: recommendationTraceId,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    season_id: input.season_id ?? null,
    crop_id: input.crop_id ?? toText(recPayload?.crop_code) ?? null,
    zone_id: input.zone_id ?? null,
    operation_type,
    spatial_scope: {
      field_boundary_ref: toText(suggestionParams.field_boundary_ref),
      zone_boundary_ref: toText(suggestionParams.zone_boundary_ref),
      geometry: suggestionParams.geometry ?? null,
      area_ha: toNumber(suggestionParams.area_ha),
      excluded_area_refs: Array.isArray(suggestionParams.excluded_area_refs) ? suggestionParams.excluded_area_refs.map((x: any) => String(x)) : [],
      risk_area_refs: Array.isArray(suggestionParams.risk_area_refs) ? suggestionParams.risk_area_refs.map((x: any) => String(x)) : [],
    },
    timing_window: {
      recommended_start_at: toText(suggestionParams.recommended_start_at),
      recommended_end_at: toText(suggestionParams.recommended_end_at),
      latest_start_at: toText(suggestionParams.latest_start_at),
      forbidden_windows: Array.isArray(suggestionParams.forbidden_windows) ? suggestionParams.forbidden_windows : [],
      weather_constraints: suggestionParams.weather_constraints && typeof suggestionParams.weather_constraints === "object" ? suggestionParams.weather_constraints : {},
      crop_stage_constraints: Array.isArray(suggestionParams.crop_stage_constraints) ? suggestionParams.crop_stage_constraints.map((x: any) => String(x)) : [],
    },
    operation_amount,
    device_requirements: {
      device_type: toText(suggestionParams.device_type),
      required_capabilities: Array.isArray(suggestionParams.required_capabilities) ? suggestionParams.required_capabilities.map((x: any) => String(x)) : [],
      min_accuracy: toNumber(suggestionParams.min_accuracy),
      flow_rate_min: toNumber(suggestionParams.flow_rate_min),
      variable_rate_required: Boolean(suggestionParams.variable_rate_required),
      online_required: Boolean(suggestionParams.online_required),
      calibration_required: Boolean(suggestionParams.calibration_required),
    },
    risk: { level: riskLevel, reasons },
    evidence_refs,
    skill_trace_id: skill_trace_id ?? undefined,
    skill_trace: recommendationSkillTrace ?? undefined,
    approval_requirement: deriveApprovalRequirement(operation_type),
    acceptance_conditions: deriveAcceptanceConditions(operation_type),
    status,
    created_at: now,
    updated_at: now,
    created_by: input.created_by ?? null,
  };

  await pool.query(
    `INSERT INTO prescription_contract_v1 (
      prescription_id, recommendation_id, tenant_id, project_id, group_id, field_id, season_id, crop_id, zone_id, operation_type,
      spatial_scope, timing_window, operation_amount, device_requirements, risk, evidence_refs,
      skill_trace_id, skill_trace, approval_requirement, acceptance_conditions, status, created_at, updated_at, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb,
      $17, $18::jsonb, $19::jsonb, $20::jsonb, $21, NOW(), NOW(), $22
    ) ON CONFLICT (tenant_id, project_id, group_id, recommendation_id) DO NOTHING`,
    [
      prescription.prescription_id,
      prescription.recommendation_id,
      prescription.tenant_id,
      prescription.project_id,
      prescription.group_id,
      prescription.field_id,
      prescription.season_id,
      prescription.crop_id,
      prescription.zone_id,
      prescription.operation_type,
      JSON.stringify(prescription.spatial_scope),
      JSON.stringify(prescription.timing_window),
      JSON.stringify(prescription.operation_amount),
      JSON.stringify(prescription.device_requirements),
      JSON.stringify(prescription.risk),
      JSON.stringify(prescription.evidence_refs),
      prescription.skill_trace_id ?? null,
      prescription.skill_trace ? JSON.stringify(prescription.skill_trace) : null,
      JSON.stringify(prescription.approval_requirement),
      JSON.stringify(prescription.acceptance_conditions),
      prescription.status,
      prescription.created_by,
    ],
  );

  const saved = await getPrescriptionByRecommendationId(pool, input.recommendation_id, {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
  });
  if (!saved) throw new Error("PRESCRIPTION_PERSIST_FAILED");
  return { prescription: saved, idempotent: saved.prescription_id !== prescription_id };
}

export async function markPrescriptionStatus(pool: Pool, prescription_id: string, status: PrescriptionStatusV1): Promise<PrescriptionContractV1 | null> {
  await pool.query("UPDATE prescription_contract_v1 SET status = $2, updated_at = NOW() WHERE prescription_id = $1", [prescription_id, status]);
  return getPrescriptionById(pool, prescription_id);
}
