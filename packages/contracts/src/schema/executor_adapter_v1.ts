export type AoActTaskV0 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  act_task_id: string;
  command_id: string;
  operation_plan_id: string;
  action_type: string;
  adapter_type: string | null;
  adapter_hint: string | null;
  parameters: Record<string, unknown>;
  meta: Record<string, unknown>;
  outbox_fact_id?: string | null;
  device_id?: string | null;
  downlink_topic?: string | null;
  qos?: number | null;
  retain?: boolean | null;
};

export type DispatchContext = {
  baseUrl: string;
  token: string;
  executor_id?: string;
  lease_token?: string;
  lease_until_ts?: number;
  attempt_no?: number;
};

export type DispatchResult = {
  command_id: string;
  adapter_type: string;
  receipt_status: "ACKED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  receipt_code?: string;
  receipt_message?: string;
  raw_receipt_ref?: string;
  adapter_payload?: Record<string, unknown> | null;
};

export type ReceiptContext = {
  baseUrl: string;
  token: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  command_id?: string;
};

export type ReceiptResult = {
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

export type ExecutorAdapterV1 = {
  adapter_type: string;
  supports: (action_type: string) => boolean;
  validate: (task: AoActTaskV0) => { ok: true } | { ok: false; reason: string };
  dispatch: (task: AoActTaskV0, ctx: DispatchContext) => Promise<DispatchResult>;
  pollReceipt?: (ctx: ReceiptContext) => Promise<ReceiptResult[]>;
};
