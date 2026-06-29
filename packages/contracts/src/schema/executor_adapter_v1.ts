// packages/contracts/src/schema/executor_adapter_v1.ts
// Purpose: define the canonical executor adapter contract used by the P2 runtime adapter path.
// Boundary: type contract only; this file does not dispatch tasks, connect devices, create receipts, or start live adapters.

export type AoActTaskRuntimeV1 = {
  executor_id?: string;
  lease_token?: string;
  lease_until_ts?: number;
  attempt_no?: number;
};

export type AoActTaskV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  act_task_id: string;
  command_id: string;
  operation_plan_id: string;
  action_type: string;
  task_type?: string;
  adapter_type: string | null;
  adapter_hint: string | null;
  parameters: Record<string, unknown>;
  meta: Record<string, unknown>;
  outbox_fact_id?: string | null;
  device_id?: string | null;
  downlink_topic?: string | null;
  qos?: number | null;
  retain?: boolean | null;
  runtime?: AoActTaskRuntimeV1;
};

export type AoActTaskV0 = AoActTaskV1;

export type ExecutorAdapterRuntimeContextV1 = {
  baseUrl: string;
  token: string;
  executor_token?: string;
  executor_id?: string;
  lease_token?: string;
  lease_until_ts?: number;
  attempt_no?: number;
};

export type DispatchContext = ExecutorAdapterRuntimeContextV1;

export type ExecutorAdapterSupportInputV1 = string | AoActTaskV1;

export type ExecutorAdapterValidationResultV1 =
  | { ok: true }
  | { ok: false; reason: string };

export type ExecutorAdapterExecutionResultV1 = {
  status: "SUCCEEDED" | "FAILED";
  meta?: Record<string, unknown>;
};

export type ExecutorAdapterV1 = {
  type: string;
  adapter_type: string;
  supports?: (input: ExecutorAdapterSupportInputV1) => boolean;
  validate?: (task: AoActTaskV1) => ExecutorAdapterValidationResultV1;
  execute: (task: AoActTaskV1) => Promise<ExecutorAdapterExecutionResultV1>;
};

export type LegacyDispatchResultV1 = {
  command_id: string;
  adapter_type: string;
  receipt_status: "ACKED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  receipt_code?: string;
  receipt_message?: string;
  raw_receipt_ref?: string;
  adapter_payload?: Record<string, unknown> | null;
};

export type DispatchResult = LegacyDispatchResultV1;

export type LegacyReceiptContextV1 = {
  baseUrl: string;
  token: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  command_id?: string;
};

export type ReceiptContext = LegacyReceiptContextV1;

export type LegacyReceiptResultV1 = {
  task_id: string;
  command_id: string;
  device_id?: string | null;
  adapter_type: string;
  receipt_status: "ACKED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  receipt_code?: string;
  receipt_message?: string;
  raw_receipt_ref?: string;
  received_ts: number;
};

export type ReceiptResult = LegacyReceiptResultV1;

export type LegacyDispatchExecutorAdapterV1 = {
  adapter_type: string;
  supports: (action_type: string) => boolean;
  validate: (task: AoActTaskV1) => ExecutorAdapterValidationResultV1;
  dispatch: (task: AoActTaskV1, ctx: ExecutorAdapterRuntimeContextV1) => Promise<LegacyDispatchResultV1>;
  pollReceipt?: (ctx: LegacyReceiptContextV1) => Promise<LegacyReceiptResultV1[]>;
};
