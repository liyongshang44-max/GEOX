import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type FertilizationVariableBridgeScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type FertilizationVariableBridgeInputV1 = FertilizationVariableBridgeScopeV1 & {
  fertilization_prescription_id: string;
  created_by?: string | null;
};

type FertilizationPrescriptionFactV1 = {
  type: "fertilization_prescription_v1";
  schema_version?: string;
  fertilization_prescription_id: string;
  fertilization_recommendation_id: string;
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  nutrient: "N";
  material_type?: string | null;
  zone_rates: Array<{
    zone_id: string;
    planned_n_kg_ha: number;
    max_n_kg_ha?: number | null;
    unit: "kgN/ha";
    required: boolean;
    reason?: string | null;
  }>;
  manual_approval_required: boolean;
  customer_visible_eligible: boolean;
  status: string;
  evidence_refs: Array<{ kind: string; ref_id: string }>;
  created_at_ts: number;
};

type VariableBridgeZoneRateV1 = {
  zone_id: string;
  operation_type: "FERTILIZATION";
  planned_amount: number;
  unit: "kgN/ha";
  required: true;
};

type FertilizationVariablePlanV1 = {
  mode: "VARIABLE_BY_ZONE";
  operation_type: "FERTILIZATION";
  nutrient: "N";
  zone_rates: VariableBridgeZoneRateV1[];
};

export class FertilizationBridgeErrorV1 extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

function cleanText(input: unknown): string | null {
  const text = String(input ?? "").trim();
  return text ? text : null;
}

function parseJsonMaybe(input: unknown): any {
  if (input && typeof input === "object") return input;
  if (typeof input === "string") {
    try { return JSON.parse(input); } catch { return null; }
  }
  return null;
}

function tenantMatches(record: any, scope: FertilizationVariableBridgeScopeV1): boolean {
  return String(record?.tenant_id ?? "") === scope.tenant_id
    && String(record?.project_id ?? "") === scope.project_id
    && String(record?.group_id ?? "") === scope.group_id;
}

function normalizeEvidenceRefs(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  const out = new Set<string>();
  for (const ref of refs) {
    if (typeof ref === "string" && ref.trim()) out.add(ref.trim());
    else if (ref && typeof ref === "object") {
      const kind = cleanText((ref as any).kind);
      const refId = cleanText((ref as any).ref_id ?? (ref as any).ref ?? (ref as any).id);
      if (kind && refId) out.add(`${kind}:${refId}`);
      else if (refId) out.add(refId);
    }
  }
  return Array.from(out);
}

function buildVariablePlanFromFertilizationPrescription(input: FertilizationPrescriptionFactV1): FertilizationVariablePlanV1 {
  const zoneRates = Array.isArray(input.zone_rates) ? input.zone_rates : [];
  if (zoneRates.length < 1) throw new FertilizationBridgeErrorV1("FERTILIZATION_PRESCRIPTION_ZONE_RATES_REQUIRED", 400);
  const zone_rates = zoneRates.map((zone) => {
    const zone_id = cleanText(zone.zone_id);
    const planned_amount = Number(zone.planned_n_kg_ha);
    if (!zone_id) throw new FertilizationBridgeErrorV1("FERTILIZATION_ZONE_ID_INVALID", 400);
    if (!Number.isFinite(planned_amount) || planned_amount < 0) {
      throw new FertilizationBridgeErrorV1("FERTILIZATION_PLANNED_N_INVALID", 400);
    }
    const max = Number(zone.max_n_kg_ha);
    if (Number.isFinite(max) && planned_amount > max) {
      throw new FertilizationBridgeErrorV1("FERTILIZATION_PLANNED_N_EXCEEDS_MAX", 400);
    }
    return {
      zone_id,
      operation_type: "FERTILIZATION" as const,
      planned_amount,
      unit: "kgN/ha" as const,
      required: true as const,
    };
  });
  return {
    mode: "VARIABLE_BY_ZONE",
    operation_type: "FERTILIZATION",
    nutrient: "N",
    zone_rates,
  };
}

function buildOperationAmount(variablePlan: FertilizationVariablePlanV1): Record<string, unknown> {
  return {
    amount: variablePlan.zone_rates.reduce((sum, zone) => sum + zone.planned_amount, 0),
    unit: "kgN/ha",
    mode: "VARIABLE_BY_ZONE",
    operation_type: "FERTILIZATION",
    nutrient: "N",
    zone_rates: variablePlan.zone_rates,
    parameters: {
      mode: "VARIABLE_BY_ZONE",
      operation_type: "FERTILIZATION",
      nutrient: "N",
    },
  };
}

function buildSpatialScope(variablePlan: FertilizationVariablePlanV1): Record<string, unknown> {
  return {
    mode: "MANAGEMENT_ZONE",
    zone_boundary_refs: variablePlan.zone_rates.map((zone) => ({
      zone_id: zone.zone_id,
      boundary_ref: `management_zone_v1:${zone.zone_id}`,
    })),
  };
}

export class FertilizationVariableBridgeV1 {
  constructor(private readonly pool: Pool) {}

  private async loadFertilizationPrescription(input: FertilizationVariableBridgeInputV1): Promise<FertilizationPrescriptionFactV1 | null> {
    const result = await this.pool.query(
      `SELECT record_json
         FROM facts
        WHERE (record_json::jsonb->>'type') = 'fertilization_prescription_v1'
          AND (record_json::jsonb->>'fertilization_prescription_id') = $1
          AND (record_json::jsonb->>'tenant_id') = $2
          AND (record_json::jsonb->>'project_id') = $3
          AND (record_json::jsonb->>'group_id') = $4
        ORDER BY occurred_at DESC, fact_id DESC
        LIMIT 1`,
      [input.fertilization_prescription_id, input.tenant_id, input.project_id, input.group_id],
    );
    const record = parseJsonMaybe(result.rows?.[0]?.record_json);
    if (!record || !tenantMatches(record, input)) return null;
    return record as FertilizationPrescriptionFactV1;
  }

  private async getExistingVariablePrescription(scope: FertilizationVariableBridgeScopeV1, bridgeRecommendationId: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(
      `SELECT *
         FROM prescription_contract_v1
        WHERE recommendation_id = $1
          AND tenant_id = $2
          AND project_id = $3
          AND group_id = $4
        LIMIT 1`,
      [bridgeRecommendationId, scope.tenant_id, scope.project_id, scope.group_id],
    );
    return result.rows?.[0] ?? null;
  }

  async createVariablePrescription(input: FertilizationVariableBridgeInputV1): Promise<{
    fertilization_prescription: FertilizationPrescriptionFactV1;
    variable_plan: FertilizationVariablePlanV1;
    variable_prescription: Record<string, unknown>;
    idempotent: boolean;
  }> {
    const fertilization_prescription_id = cleanText(input.fertilization_prescription_id);
    if (!fertilization_prescription_id) throw new FertilizationBridgeErrorV1("MISSING_FERTILIZATION_PRESCRIPTION_ID", 400);
    const fertilizationPrescription = await this.loadFertilizationPrescription({ ...input, fertilization_prescription_id });
    if (!fertilizationPrescription) throw new FertilizationBridgeErrorV1("FERTILIZATION_PRESCRIPTION_NOT_FOUND", 404);
    if (fertilizationPrescription.customer_visible_eligible !== true) {
      throw new FertilizationBridgeErrorV1("FERTILIZATION_PRESCRIPTION_NOT_FORMAL", 400);
    }
    if (fertilizationPrescription.nutrient !== "N") {
      throw new FertilizationBridgeErrorV1("FERTILIZATION_NUTRIENT_NOT_SUPPORTED", 400);
    }

    const variable_plan = buildVariablePlanFromFertilizationPrescription(fertilizationPrescription);
    const bridgeRecommendationId = `fert_bridge_${fertilization_prescription_id}`;
    const existing = await this.getExistingVariablePrescription(input, bridgeRecommendationId);
    if (existing) {
      return { fertilization_prescription: fertilizationPrescription, variable_plan, variable_prescription: existing, idempotent: true };
    }

    const prescription_id = `prc_${randomUUID().replace(/-/g, "")}`;
    const now = new Date().toISOString();
    const evidence_refs = normalizeEvidenceRefs(fertilizationPrescription.evidence_refs);
    evidence_refs.push(`fertilization_prescription_v1:${fertilization_prescription_id}`);
    const variable_prescription = {
      prescription_id,
      recommendation_id: bridgeRecommendationId,
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      field_id: fertilizationPrescription.field_id,
      season_id: null,
      crop_id: null,
      zone_id: null,
      operation_type: "FERTILIZATION",
      spatial_scope: buildSpatialScope(variable_plan),
      timing_window: {},
      operation_amount: buildOperationAmount(variable_plan),
      device_requirements: {
        variable_rate_required: true,
        required_capabilities: ["device.fertilization.dispense"],
        online_required: false,
        calibration_required: false,
      },
      risk: { level: "HIGH", reasons: ["FERTILIZATION_VARIABLE_BY_ZONE", "MANUAL_APPROVAL_REQUIRED"] },
      evidence_refs,
      skill_trace_id: null,
      skill_trace: null,
      approval_requirement: {
        required: true,
        role: "agronomist_or_manager",
        second_confirmation_required: true,
        auto_execute_allowed: false,
        manual_takeover_required: true,
      },
      acceptance_conditions: {
        amount_tolerance_percent: 15,
        required_coverage_percent: 95,
        required_execution_window: true,
        evidence_required: ["receipt", "as_applied_map", "zone_application"],
        failure_conditions: ["ZONE_APPLICATION_MISSING", "ZONE_COVERAGE_BELOW_THRESHOLD", "ZONE_AMOUNT_DEVIATION_EXCEEDED"],
        insufficient_evidence_conditions: ["MISSING_VARIABLE_EXECUTION", "MISSING_AS_APPLIED_MAP"],
        zone_level_required: true,
        required_zone_count: variable_plan.zone_rates.length,
        nutrient: "N",
      },
      status: "READY_FOR_APPROVAL",
      created_at: now,
      updated_at: now,
      created_by: cleanText(input.created_by),
    };

    await this.pool.query(
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
        variable_prescription.prescription_id,
        variable_prescription.recommendation_id,
        variable_prescription.tenant_id,
        variable_prescription.project_id,
        variable_prescription.group_id,
        variable_prescription.field_id,
        variable_prescription.season_id,
        variable_prescription.crop_id,
        variable_prescription.zone_id,
        variable_prescription.operation_type,
        JSON.stringify(variable_prescription.spatial_scope),
        JSON.stringify(variable_prescription.timing_window),
        JSON.stringify(variable_prescription.operation_amount),
        JSON.stringify(variable_prescription.device_requirements),
        JSON.stringify(variable_prescription.risk),
        JSON.stringify(variable_prescription.evidence_refs),
        variable_prescription.skill_trace_id,
        variable_prescription.skill_trace ? JSON.stringify(variable_prescription.skill_trace) : null,
        JSON.stringify(variable_prescription.approval_requirement),
        JSON.stringify(variable_prescription.acceptance_conditions),
        variable_prescription.status,
        variable_prescription.created_by,
      ],
    );

    const saved = await this.getExistingVariablePrescription(input, bridgeRecommendationId);
    if (!saved) throw new FertilizationBridgeErrorV1("VARIABLE_PRESCRIPTION_BRIDGE_PERSIST_FAILED", 409);
    return { fertilization_prescription: fertilizationPrescription, variable_plan, variable_prescription: saved, idempotent: false };
  }
}
