import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";

type ExecutionReceiptInput = {
  receipt_id?: string | null;
  task_id?: string | null;
  status?: string | null;
  evidence_refs?: unknown[];
};

type AsExecutedInput = {
  as_executed_id?: string | null;
  task_id?: string | null;
};

type AsAppliedInput = {
  as_applied_id?: string | null;
};

export type ExecutionJudgeEvaluateInput = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  prescription_id?: string | null;
  field_id?: string | null;
  device_id?: string | null;
  receipt?: ExecutionReceiptInput | null;
  as_executed?: AsExecutedInput | null;
  as_applied?: AsAppliedInput | null;
  pre_soil_moisture?: number | null;
  post_soil_moisture?: number | null;
  evidence_refs?: unknown[];
  source_refs?: unknown[];
};

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function evaluateExecutionJudgeV2(input: ExecutionJudgeEvaluateInput): JudgeResultV2CreateInput {
  const receipt = input.receipt ?? null;
  const asExecuted = input.as_executed ?? null;
  const asApplied = input.as_applied ?? null;

  const receiptStatus = normalizeStatus(receipt?.status);
  const receiptEvidenceRefs = Array.isArray(receipt?.evidence_refs) ? receipt?.evidence_refs ?? [] : [];

  const preSoilMoisture = toNumber(input.pre_soil_moisture);
  const postSoilMoisture = toNumber(input.post_soil_moisture);
  const soilDelta = preSoilMoisture != null && postSoilMoisture != null
    ? postSoilMoisture - preSoilMoisture
    : null;
  const prescriptionId = String(input.prescription_id ?? "").trim() || null;

  if (!receipt) {
    return {
      judge_kind: "EXECUTION",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      prescription_id: prescriptionId,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      verdict: "INSUFFICIENT_EVIDENCE",
      severity: "HIGH",
      reasons: ["missing_receipt"],
      inputs: {
        receipt: null,
        as_executed: toRecord(asExecuted),
        as_applied: toRecord(asApplied),
        pre_soil_moisture: preSoilMoisture,
        post_soil_moisture: postSoilMoisture,
      },
      outputs: {
        soil_moisture_delta: soilDelta,
      },
      confidence: {
        level: "LOW",
        basis: "assumed",
        reasons: ["receipt_required"],
      },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
    };
  }

  if (receiptStatus !== "executed") {
    return {
      judge_kind: "EXECUTION",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      prescription_id: prescriptionId,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      task_id: String(receipt.task_id ?? asExecuted?.task_id ?? "").trim() || null,
      receipt_id: String(receipt.receipt_id ?? "").trim() || null,
      as_executed_id: String(asExecuted?.as_executed_id ?? "").trim() || null,
      as_applied_id: String(asApplied?.as_applied_id ?? "").trim() || null,
      verdict: "FAIL",
      severity: "HIGH",
      reasons: ["receipt_not_executed"],
      inputs: {
        receipt,
        as_executed: toRecord(asExecuted),
        as_applied: toRecord(asApplied),
        pre_soil_moisture: preSoilMoisture,
        post_soil_moisture: postSoilMoisture,
      },
      outputs: {
        soil_moisture_delta: soilDelta,
      },
      confidence: {
        level: "HIGH",
        basis: "measured",
        reasons: ["receipt_status_rule"],
      },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
    };
  }

  if (receiptEvidenceRefs.length === 0) {
    return {
      judge_kind: "EXECUTION",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      prescription_id: prescriptionId,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      task_id: String(receipt.task_id ?? asExecuted?.task_id ?? "").trim() || null,
      receipt_id: String(receipt.receipt_id ?? "").trim() || null,
      as_executed_id: String(asExecuted?.as_executed_id ?? "").trim() || null,
      as_applied_id: String(asApplied?.as_applied_id ?? "").trim() || null,
      verdict: "INSUFFICIENT_EVIDENCE",
      severity: "HIGH",
      reasons: ["missing_receipt_evidence_refs"],
      inputs: {
        receipt,
        as_executed: toRecord(asExecuted),
        as_applied: toRecord(asApplied),
        pre_soil_moisture: preSoilMoisture,
        post_soil_moisture: postSoilMoisture,
      },
      outputs: {
        soil_moisture_delta: soilDelta,
      },
      confidence: {
        level: "MEDIUM",
        basis: "estimated",
        reasons: ["receipt_evidence_refs_required"],
      },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
    };
  }

  if (!asExecuted) {
    return {
      judge_kind: "EXECUTION",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      prescription_id: prescriptionId,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      task_id: String(receipt.task_id ?? "").trim() || null,
      receipt_id: String(receipt.receipt_id ?? "").trim() || null,
      verdict: "INSUFFICIENT_EVIDENCE",
      severity: "HIGH",
      reasons: ["missing_as_executed"],
      inputs: {
        receipt,
        as_executed: null,
        as_applied: toRecord(asApplied),
        pre_soil_moisture: preSoilMoisture,
        post_soil_moisture: postSoilMoisture,
      },
      outputs: {
        soil_moisture_delta: soilDelta,
      },
      confidence: {
        level: "LOW",
        basis: "assumed",
        reasons: ["as_executed_required"],
      },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
    };
  }

  if (!asApplied) {
    return {
      judge_kind: "EXECUTION",
      tenant_id: input.tenant_id,
      project_id: input.project_id,
      group_id: input.group_id,
      prescription_id: prescriptionId,
      field_id: input.field_id ?? null,
      device_id: input.device_id ?? null,
      task_id: String(receipt.task_id ?? asExecuted.task_id ?? "").trim() || null,
      receipt_id: String(receipt.receipt_id ?? "").trim() || null,
      as_executed_id: String(asExecuted.as_executed_id ?? "").trim() || null,
      verdict: "WARN",
      severity: "MEDIUM",
      reasons: ["missing_as_applied"],
      inputs: {
        receipt,
        as_executed: asExecuted,
        as_applied: null,
        pre_soil_moisture: preSoilMoisture,
        post_soil_moisture: postSoilMoisture,
      },
      outputs: {
        soil_moisture_delta: soilDelta,
      },
      confidence: {
        level: "MEDIUM",
        basis: "estimated",
        reasons: ["as_applied_optional_warning"],
      },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
    };
  }

  const passBySoilDelta = soilDelta != null && soilDelta >= 0.03;

  return {
    judge_kind: "EXECUTION",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    prescription_id: prescriptionId,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
    task_id: String(receipt.task_id ?? asExecuted.task_id ?? "").trim() || null,
    receipt_id: String(receipt.receipt_id ?? "").trim() || null,
    as_executed_id: String(asExecuted.as_executed_id ?? "").trim() || null,
    as_applied_id: String(asApplied.as_applied_id ?? "").trim() || null,
    verdict: passBySoilDelta ? "PASS" : "FAIL",
    severity: passBySoilDelta ? "LOW" : "HIGH",
    reasons: passBySoilDelta ? ["soil_moisture_delta_reached"] : ["soil_moisture_delta_not_reached"],
    inputs: {
      receipt,
      as_executed: asExecuted,
      as_applied: asApplied,
      pre_soil_moisture: preSoilMoisture,
      post_soil_moisture: postSoilMoisture,
    },
    outputs: {
      soil_moisture_delta: soilDelta,
      threshold: 0.03,
    },
    confidence: {
      level: soilDelta == null ? "LOW" : "HIGH",
      basis: soilDelta == null ? "estimated" : "measured",
      reasons: soilDelta == null ? ["missing_soil_moisture_delta"] : ["soil_delta_rule"],
    },
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
  };
}
