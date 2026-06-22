export type ExecutorIdV1 = { kind: "human" | "script" | "device"; id: string; namespace: string };
export type RefV1 = { kind: string; ref: string };
export type DeviceRefV1 = { kind: "device_ref_fact"; ref: string; note?: string | null };

export type ExecutorAoActReceiptSubmissionStatusV1 =
  | "AO_ACT_RECEIPT_RECORDED"
  | "REJECTED_TASK_NOT_FOUND"
  | "REJECTED_TASK_NOT_FROM_OPERATION_PLAN"
  | "REJECTED_OPERATION_PLAN_NOT_FOUND"
  | "REJECTED_OPERATION_PLAN_TASK_MISMATCH"
  | "REJECTED_RECEIPT_ALREADY_CREATED"
  | "REJECTED_SCOPE_MISMATCH"
  | "REJECTED_DUPLICATE"
  | "REJECTED_INVALID_INPUT";

export type AoActReceiptFromTaskInputV1 = {
  tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null;
  operation_plan_id: string; act_task_id: string;
  aoActTask: Record<string, unknown> | null; aoActTaskFactId: string | null;
  operationPlanIndexRecord: Record<string, unknown> | null;
  executor_id: ExecutorIdV1;
  execution_time: { start_ts: number; end_ts: number };
  execution_coverage: { kind: "area" | "path" | "field"; ref: string };
  resource_usage: { fuel_l: number | null; electric_kwh: number | null; water_l: number | null; chemical_ml: number | null };
  evidence_refs: RefV1[]; logs_refs: RefV1[];
  status: "executed" | "not_executed";
  constraint_check: { violated: boolean; violations: string[] };
  observed_parameters: Record<string, number | boolean | string>;
  device_refs?: DeviceRefV1[];
  idempotency_key: string; command_id: string;
  submission_id: string; ao_act_receipt_id: string; created_at: string; created_at_ts: number;
};

export type AoActReceiptPayloadV1 = Record<string, unknown>;
export type ExecutorAoActReceiptSubmissionPayloadV1 = Record<string, unknown>;

const boundaryRules = [
  { rule_code: "H41_RECEIPT_ONLY", label: "Record AO-ACT receipt without acceptance, ROI, or Field Memory" },
  { rule_code: "H41_NO_OPERATION_PLAN_TRANSITION", label: "Do not create operation_plan_transition_v1 or terminal operation_plan_v1" },
  { rule_code: "H41_UPDATE_INDEX_RECEIPT_POINTER", label: "Update operation_plan_index_v1.receipt_fact_id only after receipt fact append" },
];

export function buildAoActReceiptFromTaskV1(input: AoActReceiptFromTaskInputV1): { submission: ExecutorAoActReceiptSubmissionPayloadV1; receipt: AoActReceiptPayloadV1 | null } {
  const receipt: AoActReceiptPayloadV1 = {
    version: "v1",
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    ao_act_receipt_id: input.ao_act_receipt_id,
    operation_plan_id: input.operation_plan_id,
    act_task_id: input.act_task_id,
    ao_act_task_fact_id: input.aoActTaskFactId,
    executor_id: input.executor_id,
    execution_time: input.execution_time,
    execution_coverage: input.execution_coverage,
    resource_usage: input.resource_usage,
    evidence_refs: input.evidence_refs,
    logs_refs: input.logs_refs,
    status: input.status === "executed" ? "EXECUTED" : "NOT_EXECUTED",
    constraint_check: input.constraint_check,
    observed_parameters: input.observed_parameters,
    ...(input.device_refs ? { device_refs: input.device_refs } : {}),
    meta: {
      source: "AO_ACT_TASK_V0",
      idempotency_key: input.idempotency_key,
      command_id: input.command_id,
      operation_plan_id: input.operation_plan_id,
      act_task_id: input.act_task_id,
      task_fact_id: input.aoActTaskFactId,
      no_acceptance_created: true,
      no_effect_judgement: true,
      no_roi_created: true,
      no_field_memory_created: true,
    },
    created_at_ts: input.created_at_ts,
  };

  const submission: ExecutorAoActReceiptSubmissionPayloadV1 = {
    version: "v1",
    surface: "ACTION_EXECUTION",
    submission_id: input.submission_id,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    group_id: input.group_id,
    field_id: input.field_id,
    zone_id: input.zone_id,
    operation_plan_id: input.operation_plan_id,
    act_task_id: input.act_task_id,
    ao_act_task_fact_id: input.aoActTaskFactId,
    executor_id: input.executor_id,
    idempotency_key: input.idempotency_key,
    command_id: input.command_id,
    ao_act_receipt_id: input.ao_act_receipt_id,
    ao_act_receipt_fact_id: null,
    status: "AO_ACT_RECEIPT_RECORDED",
    receipt_created: true,
    as_executed_created: false,
    acceptance_created: false,
    operation_plan_transition_created: false,
    roi_created: false,
    field_memory_created: false,
    no_acceptance_created: true,
    no_effect_judgement: true,
    evidence_refs: input.evidence_refs,
    logs_refs: input.logs_refs,
    ao_act_receipt_v1: receipt,
    boundary_rules: boundaryRules,
    created_at: input.created_at,
  };
  return { submission, receipt };
}
