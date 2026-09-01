import type { Pool } from "pg";

export type FertilizationAcceptanceScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type FertilizationAcceptancePrescriptionV1 = {
  fertilization_prescription_id: string;
  field_id: string;
  zone_rates: Array<{
    zone_id: string;
    planned_n_kg_ha: number;
    max_n_kg_ha?: number | null;
    unit: "kgN/ha";
    required: boolean;
    reason?: string | null;
  }>;
};

export type FertilizationAcceptanceExactExecutionInputV1 = FertilizationAcceptanceScopeV1 & {
  fertilization_prescription_id: string;
  operation_plan_id: string;
  act_task_id: string;
  receipt_id: string;
  as_executed_id: string;
  as_applied_id: string;
};

export type FertilizationAcceptanceZoneEvidenceV1 = {
  zone_id: string;
  planned_n_kg_ha: number;
  actual_n_kg_ha: number | null;
  coverage_percent: number | null;
  deviation_percent: number | null;
  result: "PASS" | "FAIL" | "NEEDS_REVIEW";
  reasons: string[];
};

export type FertilizationAcceptanceExactExecutionProofV1 = {
  variable_prescription_id: string;
  receipt_fact_id: string;
  receipt_fact_type: string;
  as_executed_id: string;
  as_applied_id: string;
  amount_tolerance_percent: number;
  required_coverage_percent: number;
  zone_results: FertilizationAcceptanceZoneEvidenceV1[];
  evidence_refs: Array<{ kind: string; ref_id: string }>;
};

export class FertilizationAcceptanceExactExecutionErrorV1 extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function object(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function assertExactText(actual: unknown, expected: string, code: string): void {
  if (text(actual) !== expected) throw new FertilizationAcceptanceExactExecutionErrorV1(code, 409);
}

async function loadVariablePrescription(
  pool: Pool,
  input: FertilizationAcceptanceExactExecutionInputV1,
  prescription: FertilizationAcceptancePrescriptionV1,
): Promise<Record<string, any>> {
  const bridgeRecommendationId = `fert_bridge_${input.fertilization_prescription_id}`;
  const q = await pool.query(
    `SELECT prescription_id, recommendation_id, tenant_id, project_id, group_id, field_id, operation_type,
            operation_amount::jsonb AS operation_amount,
            acceptance_conditions::jsonb AS acceptance_conditions
       FROM prescription_contract_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND recommendation_id = $4
        AND operation_type = 'FERTILIZATION'
      LIMIT 2`,
    [input.tenant_id, input.project_id, input.group_id, bridgeRecommendationId],
  );
  if (!q.rows?.length) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_VARIABLE_PRESCRIPTION_NOT_FOUND", 404);
  if (q.rows.length !== 1) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_VARIABLE_PRESCRIPTION_AMBIGUOUS", 409);
  const row = q.rows[0] as Record<string, any>;
  assertExactText(row.field_id, prescription.field_id, "FERTILIZATION_VARIABLE_PRESCRIPTION_FIELD_MISMATCH");
  if (text(row.operation_type).toUpperCase() !== "FERTILIZATION") {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_VARIABLE_PRESCRIPTION_OPERATION_TYPE_MISMATCH", 409);
  }

  const variableZones = array(object(row.operation_amount).zone_rates);
  for (const zone of prescription.zone_rates) {
    const variableZone = variableZones.filter((item) => text(item?.zone_id) === zone.zone_id);
    if (variableZone.length !== 1) {
      throw new FertilizationAcceptanceExactExecutionErrorV1(
        variableZone.length ? "FERTILIZATION_VARIABLE_PRESCRIPTION_ZONE_AMBIGUOUS" : "FERTILIZATION_VARIABLE_PRESCRIPTION_ZONE_MISSING",
        409,
      );
    }
    const planned = finite(variableZone[0]?.planned_amount);
    if (planned == null || Math.abs(planned - zone.planned_n_kg_ha) > 1e-9) {
      throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_VARIABLE_PRESCRIPTION_PLANNED_RATE_MISMATCH", 409);
    }
    if (text(variableZone[0]?.unit) !== "kgN/ha") {
      throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_VARIABLE_PRESCRIPTION_UNIT_MISMATCH", 409);
    }
  }
  return row;
}

async function loadAsExecuted(
  pool: Pool,
  input: FertilizationAcceptanceExactExecutionInputV1,
): Promise<Record<string, any>> {
  const q = await pool.query(
    `SELECT as_executed_id, tenant_id, project_id, group_id, field_id, task_id, receipt_id, prescription_id,
            planned::jsonb AS planned, executed::jsonb AS executed, receipt_refs::jsonb AS receipt_refs,
            evidence_refs::jsonb AS evidence_refs
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_executed_id = $4
      LIMIT 2`,
    [input.tenant_id, input.project_id, input.group_id, input.as_executed_id],
  );
  if (!q.rows?.length) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_EXECUTED_NOT_FOUND", 404);
  if (q.rows.length !== 1) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_EXECUTED_AMBIGUOUS", 409);
  return q.rows[0] as Record<string, any>;
}

async function loadAsApplied(
  pool: Pool,
  input: FertilizationAcceptanceExactExecutionInputV1,
): Promise<Record<string, any>> {
  const q = await pool.query(
    `SELECT as_applied_id, as_executed_id, tenant_id, project_id, group_id, field_id, task_id, receipt_id,
            prescription_id, coverage::jsonb AS coverage, application::jsonb AS application,
            evidence_refs::jsonb AS evidence_refs
       FROM as_applied_map_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND as_applied_id = $4
      LIMIT 2`,
    [input.tenant_id, input.project_id, input.group_id, input.as_applied_id],
  );
  if (!q.rows?.length) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_NOT_FOUND", 404);
  if (q.rows.length !== 1) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_AMBIGUOUS", 409);
  return q.rows[0] as Record<string, any>;
}

async function loadExactReceiptFromAsExecuted(
  pool: Pool,
  input: FertilizationAcceptanceExactExecutionInputV1,
  asExecuted: Record<string, any>,
  expectedFieldId: string,
): Promise<{ fact_id: string; type: string; payload: Record<string, any> }> {
  const receiptFactIds = Array.from(new Set(
    array(asExecuted.receipt_refs)
      .map((item) => text(object(item).fact_id))
      .filter(Boolean),
  ));
  if (receiptFactIds.length !== 1) {
    throw new FertilizationAcceptanceExactExecutionErrorV1(
      receiptFactIds.length ? "FERTILIZATION_RECEIPT_FACT_REF_AMBIGUOUS" : "FERTILIZATION_RECEIPT_FACT_REF_MISSING",
      409,
    );
  }
  const q = await pool.query(
    `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
      WHERE fact_id = $4
        AND (record_json::jsonb->>'type') IN ('ao_act_receipt_v0','ao_act_receipt_v1')
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
      LIMIT 1`,
    [input.tenant_id, input.project_id, input.group_id, receiptFactIds[0]],
  );
  if (!q.rows?.[0]) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_RECEIPT_FACT_NOT_FOUND", 404);
  const record = object(q.rows[0].record_json);
  const payload = object(record.payload);
  assertExactText(payload.act_task_id ?? payload.task_id ?? payload.command_id, input.act_task_id, "FERTILIZATION_RECEIPT_TASK_MISMATCH");
  assertExactText(payload.operation_plan_id ?? payload.operation_id, input.operation_plan_id, "FERTILIZATION_RECEIPT_OPERATION_MISMATCH");
  assertExactText(payload.field_id ?? payload.execution_coverage?.ref, expectedFieldId, "FERTILIZATION_RECEIPT_FIELD_MISMATCH");
  const payloadReceiptId = text(payload.receipt_id);
  if (payloadReceiptId && payloadReceiptId !== input.receipt_id) {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_RECEIPT_ID_MISMATCH", 409);
  }
  return { fact_id: text(q.rows[0].fact_id), type: text(record.type), payload };
}

function readThresholds(variablePrescription: Record<string, any>): {
  amount_tolerance_percent: number;
  required_coverage_percent: number;
} {
  const conditions = object(variablePrescription.acceptance_conditions);
  const amountTolerance = finite(conditions.amount_tolerance_percent);
  const coverageRequired = finite(conditions.required_coverage_percent);
  if (amountTolerance == null || amountTolerance < 0 || amountTolerance > 100) {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_ACCEPTANCE_AMOUNT_TOLERANCE_POLICY_MISSING", 409);
  }
  if (coverageRequired == null || coverageRequired < 0 || coverageRequired > 100) {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_ACCEPTANCE_COVERAGE_POLICY_MISSING", 409);
  }
  return {
    amount_tolerance_percent: amountTolerance,
    required_coverage_percent: coverageRequired,
  };
}

function deriveZoneResults(
  prescription: FertilizationAcceptancePrescriptionV1,
  asApplied: Record<string, any>,
  thresholds: { amount_tolerance_percent: number; required_coverage_percent: number },
): FertilizationAcceptanceZoneEvidenceV1[] {
  const application = object(asApplied.application);
  if (text(application.mode) !== "VARIABLE_BY_ZONE") {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_NOT_VARIABLE_BY_ZONE", 409);
  }
  const sourceZones = array(application.zone_applications);
  if (!sourceZones.length) {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_ZONE_APPLICATIONS_MISSING", 409);
  }

  return prescription.zone_rates
    .filter((zone) => zone.required !== false)
    .map((zone) => {
      const matches = sourceZones.filter((item) => text(item?.zone_id) === zone.zone_id);
      if (matches.length > 1) {
        throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_ZONE_AMBIGUOUS", 409);
      }
      if (!matches.length) {
        return {
          zone_id: zone.zone_id,
          planned_n_kg_ha: zone.planned_n_kg_ha,
          actual_n_kg_ha: null,
          coverage_percent: null,
          deviation_percent: null,
          result: "NEEDS_REVIEW" as const,
          reasons: ["MISSING_ZONE_APPLICATION"],
        };
      }

      const item = matches[0];
      const sourcePlanned = finite(item?.planned_amount);
      const actual = finite(item?.applied_amount);
      const coverage = finite(item?.coverage_percent);
      if (sourcePlanned == null || Math.abs(sourcePlanned - zone.planned_n_kg_ha) > 1e-9) {
        throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_PLANNED_RATE_MISMATCH", 409);
      }
      if (text(item?.unit) !== "kgN/ha") {
        throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_APPLIED_UNIT_MISMATCH", 409);
      }
      if (actual == null || actual < 0) {
        return {
          zone_id: zone.zone_id,
          planned_n_kg_ha: zone.planned_n_kg_ha,
          actual_n_kg_ha: null,
          coverage_percent: coverage,
          deviation_percent: null,
          result: "NEEDS_REVIEW" as const,
          reasons: ["MISSING_ACTUAL_N_KG_HA"],
        };
      }
      if (coverage == null || coverage < 0 || coverage > 100) {
        return {
          zone_id: zone.zone_id,
          planned_n_kg_ha: zone.planned_n_kg_ha,
          actual_n_kg_ha: actual,
          coverage_percent: coverage,
          deviation_percent: null,
          result: "NEEDS_REVIEW" as const,
          reasons: ["INVALID_ZONE_COVERAGE_PERCENT"],
        };
      }

      const deviation = zone.planned_n_kg_ha > 0
        ? Math.abs(actual - zone.planned_n_kg_ha) / zone.planned_n_kg_ha * 100
        : (actual === 0 ? 0 : null);
      const reasons: string[] = [];
      let result: "PASS" | "FAIL" | "NEEDS_REVIEW" = "PASS";
      if (coverage < thresholds.required_coverage_percent) {
        result = "FAIL";
        reasons.push("ZONE_COVERAGE_BELOW_THRESHOLD");
      }
      if (deviation == null) {
        result = "NEEDS_REVIEW";
        reasons.push("ZERO_PLANNED_RATE_NONZERO_APPLICATION");
      } else if (deviation > thresholds.amount_tolerance_percent) {
        result = "FAIL";
        reasons.push("ZONE_N_DEVIATION_EXCEEDED");
      }
      if (!reasons.length) reasons.push("ZONE_APPLICATION_WITHIN_TOLERANCE");

      return {
        zone_id: zone.zone_id,
        planned_n_kg_ha: zone.planned_n_kg_ha,
        actual_n_kg_ha: actual,
        coverage_percent: coverage,
        deviation_percent: deviation == null ? null : Number(deviation.toFixed(6)),
        result,
        reasons,
      };
    });
}

export async function requireFertilizationAcceptanceExactExecutionV1(
  pool: Pool,
  input: FertilizationAcceptanceExactExecutionInputV1,
  prescription: FertilizationAcceptancePrescriptionV1,
): Promise<FertilizationAcceptanceExactExecutionProofV1> {
  for (const [key, value] of Object.entries(input)) {
    if (!text(value)) throw new FertilizationAcceptanceExactExecutionErrorV1(`MISSING_OR_INVALID:${key}`, 400);
  }
  assertExactText(prescription.fertilization_prescription_id, input.fertilization_prescription_id, "FERTILIZATION_PRESCRIPTION_ID_MISMATCH");

  const variablePrescription = await loadVariablePrescription(pool, input, prescription);
  const variablePrescriptionId = text(variablePrescription.prescription_id);
  if (!variablePrescriptionId) throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_VARIABLE_PRESCRIPTION_ID_MISSING", 409);

  const asExecuted = await loadAsExecuted(pool, input);
  assertExactText(asExecuted.task_id, input.act_task_id, "FERTILIZATION_AS_EXECUTED_TASK_MISMATCH");
  assertExactText(asExecuted.receipt_id, input.receipt_id, "FERTILIZATION_AS_EXECUTED_RECEIPT_MISMATCH");
  assertExactText(asExecuted.prescription_id, variablePrescriptionId, "FERTILIZATION_AS_EXECUTED_PRESCRIPTION_MISMATCH");
  assertExactText(asExecuted.field_id, prescription.field_id, "FERTILIZATION_AS_EXECUTED_FIELD_MISMATCH");
  if (text(object(asExecuted.executed).status) !== "CONFIRMED") {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_EXECUTED_NOT_CONFIRMED", 409);
  }
  if (text(object(asExecuted.planned).operation_type).toUpperCase() !== "FERTILIZATION") {
    throw new FertilizationAcceptanceExactExecutionErrorV1("FERTILIZATION_AS_EXECUTED_OPERATION_TYPE_MISMATCH", 409);
  }

  const asApplied = await loadAsApplied(pool, input);
  assertExactText(asApplied.as_executed_id, input.as_executed_id, "FERTILIZATION_AS_APPLIED_AS_EXECUTED_MISMATCH");
  assertExactText(asApplied.task_id, input.act_task_id, "FERTILIZATION_AS_APPLIED_TASK_MISMATCH");
  assertExactText(asApplied.receipt_id, input.receipt_id, "FERTILIZATION_AS_APPLIED_RECEIPT_MISMATCH");
  assertExactText(asApplied.prescription_id, variablePrescriptionId, "FERTILIZATION_AS_APPLIED_PRESCRIPTION_MISMATCH");
  assertExactText(asApplied.field_id, prescription.field_id, "FERTILIZATION_AS_APPLIED_FIELD_MISMATCH");

  const receipt = await loadExactReceiptFromAsExecuted(pool, input, asExecuted, prescription.field_id);
  const thresholds = readThresholds(variablePrescription);
  const zoneResults = deriveZoneResults(prescription, asApplied, thresholds);

  return {
    variable_prescription_id: variablePrescriptionId,
    receipt_fact_id: receipt.fact_id,
    receipt_fact_type: receipt.type || "ao_act_receipt_v1",
    as_executed_id: input.as_executed_id,
    as_applied_id: input.as_applied_id,
    ...thresholds,
    zone_results: zoneResults,
    evidence_refs: [
      { kind: "fertilization_prescription_v1", ref_id: input.fertilization_prescription_id },
      { kind: "prescription_contract_v1", ref_id: variablePrescriptionId },
      { kind: receipt.type || "ao_act_receipt_v1", ref_id: receipt.fact_id },
      { kind: "as_executed_record_v1", ref_id: input.as_executed_id },
      { kind: "as_applied_map_v1", ref_id: input.as_applied_id },
    ],
  };
}
