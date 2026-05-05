import { runIrrigationEffectAcceptanceSkillV1 } from "./skills/irrigation_effect_acceptance_skill_v1.js";
import { runReceiptCompletenessSkillV1 } from "./skills/receipt_completeness_skill_v1.js";
import type { JudgeResultV2CreateInput } from "./judge_result_v2.js";
import type { JudgeSkillTraceV1 } from "./skills/judge_skill_trace_v1.js";

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



function toSourceRef(trace: JudgeSkillTraceV1) {
  return {
    skill_id: trace.skill_id,
    skill_version: trace.skill_version,
    skill_category: trace.skill_category,
    trace_id: trace.trace_id,
    run_id: trace.run_id,
    input_digest: trace.input_digest,
    inputs: trace.inputs,
    outputs: trace.outputs,
    confidence: trace.confidence,
    evidence_refs: trace.evidence_refs,
  };
}

function toSkillTrace(trace: JudgeSkillTraceV1, output: { verdict: string; reasons: string[] }) {
  return {
    skill_id: trace.skill_id,
    trace_id: trace.trace_id,
    run_id: trace.run_id,
    skill_version: trace.skill_version,
    skill_category: trace.skill_category,
    verdict: output.verdict,
    reasons: output.reasons,
  };
}

function withBase(input: ExecutionJudgeEvaluateInput) {
  return {
    judge_kind: "EXECUTION" as const,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    prescription_id: String(input.prescription_id ?? "").trim() || null,
    field_id: input.field_id ?? null,
    device_id: input.device_id ?? null,
  };
}

export function evaluateExecutionJudgeV2(input: ExecutionJudgeEvaluateInput): JudgeResultV2CreateInput {
  const receipt = input.receipt ?? null;
  const asExecuted = input.as_executed ?? null;
  const asApplied = input.as_applied ?? null;
  const pre = toNumber(input.pre_soil_moisture);
  const post = toNumber(input.post_soil_moisture);
  const delta = pre != null && post != null ? post - pre : null;

  const receiptSkill = runReceiptCompletenessSkillV1({ receipt });

  if (receiptSkill.output.verdict !== "PASS") {
    return {
      ...withBase(input),
      verdict: receiptSkill.output.verdict,
      severity: receiptSkill.output.verdict === "FAIL" ? "HIGH" : "MEDIUM",
      reasons: receiptSkill.output.reasons,
      task_id: String(receipt?.task_id ?? asExecuted?.task_id ?? "").trim() || null,
      receipt_id: String(receipt?.receipt_id ?? "").trim() || null,
      as_executed_id: String(asExecuted?.as_executed_id ?? "").trim() || null,
      as_applied_id: String(asApplied?.as_applied_id ?? "").trim() || null,
      inputs: { receipt, as_executed: asExecuted, as_applied: asApplied, pre_soil_moisture: pre, post_soil_moisture: post },
      outputs: { soil_moisture_delta: delta, skill_traces: [toSkillTrace(receiptSkill.trace, receiptSkill.output)] },
      confidence: receiptSkill.trace.confidence,
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: [toSourceRef(receiptSkill.trace)],
    };
  }

  if (!asExecuted) {
    return {
      ...withBase(input),
      verdict: "INSUFFICIENT_EVIDENCE",
      severity: "HIGH",
      reasons: ["missing_as_executed"],
      task_id: String(receipt?.task_id ?? "").trim() || null,
      receipt_id: String(receipt?.receipt_id ?? "").trim() || null,
      inputs: { receipt, as_executed: null, as_applied: asApplied, pre_soil_moisture: pre, post_soil_moisture: post },
      outputs: { soil_moisture_delta: delta, skill_traces: [toSkillTrace(receiptSkill.trace, receiptSkill.output)] },
      confidence: { level: "LOW", basis: "assumed", reasons: ["as_executed_required"] },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: [toSourceRef(receiptSkill.trace)],
    };
  }

  if (!asApplied) {
    return {
      ...withBase(input),
      verdict: "WARN",
      severity: "MEDIUM",
      reasons: ["missing_as_applied"],
      task_id: String(receipt?.task_id ?? asExecuted.task_id ?? "").trim() || null,
      receipt_id: String(receipt?.receipt_id ?? "").trim() || null,
      as_executed_id: String(asExecuted.as_executed_id ?? "").trim() || null,
      inputs: { receipt, as_executed: asExecuted, as_applied: null, pre_soil_moisture: pre, post_soil_moisture: post },
      outputs: { soil_moisture_delta: delta, skill_traces: [toSkillTrace(receiptSkill.trace, receiptSkill.output)] },
      confidence: { level: "MEDIUM", basis: "estimated", reasons: ["as_applied_optional_warning"] },
      evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
      source_refs: [toSourceRef(receiptSkill.trace)],
    };
  }

  const effectSkill = runIrrigationEffectAcceptanceSkillV1({ delta });

  return {
    ...withBase(input),
    verdict: effectSkill.output.verdict,
    severity: effectSkill.output.verdict === "PASS" ? "LOW" : effectSkill.output.verdict === "FAIL" ? "HIGH" : "MEDIUM",
    reasons: effectSkill.output.reasons,
    task_id: String(receipt?.task_id ?? asExecuted.task_id ?? "").trim() || null,
    receipt_id: String(receipt?.receipt_id ?? "").trim() || null,
    as_executed_id: String(asExecuted.as_executed_id ?? "").trim() || null,
    as_applied_id: String(asApplied.as_applied_id ?? "").trim() || null,
    inputs: { receipt, as_executed: asExecuted, as_applied: asApplied, pre_soil_moisture: pre, post_soil_moisture: post },
    outputs: {
      soil_moisture_delta: delta,
      skill_traces: [toSkillTrace(receiptSkill.trace, receiptSkill.output), toSkillTrace(effectSkill.trace, effectSkill.output)],
    },
    confidence: effectSkill.trace.confidence,
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs : [],
    source_refs: [toSourceRef(receiptSkill.trace), toSourceRef(effectSkill.trace)],
  };
}
