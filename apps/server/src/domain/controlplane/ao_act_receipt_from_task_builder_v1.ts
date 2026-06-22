// apps/server/src/domain/controlplane/ao_act_receipt_from_task_builder_v1.ts
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


const ALLOWED_H41_ACTION_TYPES = new Set(["IRRIGATE"]);

function s(v: unknown): string { return String(v ?? "").trim(); }
function obj(v: unknown): Record<string, unknown> | null { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null; }
function payload(v: Record<string, unknown> | null | undefined): Record<string, unknown> { return obj((v as any)?.payload) ?? obj(v) ?? {}; }

export function h41AllowedActionTypesV1(): string[] { return Array.from(ALLOWED_H41_ACTION_TYPES); }

export function h41ParameterSchemaEntriesV1(schema: unknown): Map<string, Record<string, unknown>> {
  const root = obj(schema);
  const out = new Map<string, Record<string, unknown>>();
  if (!root) return out;
  const keys = Array.isArray(root.keys) ? root.keys : null;
  if (keys) {
    for (const item of keys) {
      if (typeof item === "string" && item.trim()) out.set(item.trim(), {});
      else {
        const rec = obj(item);
        const key = s(rec?.key ?? rec?.name ?? rec?.id);
        if (key) out.set(key, rec ?? {});
      }
    }
    return out;
  }
  const props = obj(root.properties) ?? root;
  for (const [key, decl] of Object.entries(props)) out.set(key, obj(decl) ?? {});
  return out;
}

export function validateH41TaskEligibilityV1(input: { task: Record<string, unknown>; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null; operation_plan_id: string; act_task_id: string }): string | null {
  const task = input.task;
  if (s(task.tenant_id) !== input.tenant_id || s(task.project_id) !== input.project_id || s(task.group_id) !== input.group_id || s(task.operation_plan_id) !== input.operation_plan_id || s(task.act_task_id) !== input.act_task_id) return "REJECTED_TASK_NOT_FROM_OPERATION_PLAN";
  if (s(task.field_id || input.field_id) !== input.field_id || s(task.zone_id ?? "") !== s(input.zone_id ?? "")) return "REJECTED_SCOPE_MISMATCH";
  if (!s(task.approval_request_id) || !ALLOWED_H41_ACTION_TYPES.has(s(task.action_type)) || !task.time_window || !task.parameter_schema || !task.parameters || !task.constraints) return "REJECTED_TASK_NOT_FROM_OPERATION_PLAN";
  const meta = obj(task.meta);
  if (s(meta?.source) !== "OPERATION_PLAN_READY_V1" || meta?.projected_from_ready_operation_plan !== true) return "REJECTED_TASK_NOT_FROM_OPERATION_PLAN";
  return null;
}

export function validateH41ApprovalRequestTransitionV1(input: { approvalRequestTransition: Record<string, unknown> | null; task: Record<string, unknown>; tenant_id: string; project_id: string; group_id: string; field_id: string; zone_id: string | null }): string | null {
  const ar = payload(input.approvalRequestTransition);
  if (!input.approvalRequestTransition) return "REJECTED_APPROVAL_REQUEST_NOT_FOUND";
  if (s((input.approvalRequestTransition as any).type ?? "approval_request_v1") !== "approval_request_v1" || s(ar.status) !== "APPROVED" || s(ar.request_id) !== s(input.task.approval_request_id)) return "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";
  if (["tenant_id","project_id","group_id","field_id"].some((k) => s((ar as any)[k]) !== s((input as any)[k])) || s(ar.zone_id ?? "") !== s(input.zone_id ?? "")) return "REJECTED_SCOPE_MISMATCH";
  const proposal = obj(ar.proposal);
  const meta = obj(proposal?.meta);
  const source = s(meta?.source);
  if (!proposal || !(source === "DECISION_RECOMMENDATION_V1" || source === "OPERATION_PLAN_READY_V1" || source === "DECISION_APPROVAL_CHAIN_V1" || source === "DECISION/APPROVAL")) return "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";
  if (source === "DECISION_RECOMMENDATION_V1" && s(meta?.approval_intent) !== "REQUEST_HUMAN_APPROVAL_ONLY") return "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";
  if (meta?.no_direct_execution !== true || meta?.skip_auto_task_issue !== true || meta?.allow_auto_task_issue !== false) return "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";
  if (s(proposal.action_type) !== s(input.task.action_type)) return "REJECTED_APPROVAL_REQUEST_NOT_APPROVED";
  return null;
}

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
