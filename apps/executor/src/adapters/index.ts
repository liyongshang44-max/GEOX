// apps/executor/src/adapters/index.ts
// Purpose: expose executor runtime adapter types aligned with the P2 canonical adapter contract.
// Boundary: type exports only; this file does not dispatch tasks, connect devices, create receipts, or start live adapters.

export type AoActTaskRuntime = {
  executor_id?: string;
  lease_token?: string;
  lease_until_ts?: number;
  attempt_no?: number;
};

export type AoActTask = {
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
  runtime?: AoActTaskRuntime;
};

export type DispatchContext = {
  baseUrl: string;
  token: string;
  executor_token?: string;
  executor_id?: string;
  lease_token?: string;
  lease_until_ts?: number;
  attempt_no?: number;
};

export type AdapterSupportInput = string | AoActTask;

export type AdapterValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export type AdapterExecutionResult = {
  status: "SUCCEEDED" | "FAILED";
  meta?: Record<string, unknown>;
};

export interface ExecutorAdapter {
  type: string;
  adapter_type: string;
  execute(task: AoActTask): Promise<AdapterExecutionResult>;
  supports?: (input: AdapterSupportInput) => boolean;
  validate?: (task: AoActTask) => AdapterValidationResult;
}

export type ExecutorAdapterV1 = ExecutorAdapter;

export type Adapter = ExecutorAdapterV1;

export type AdapterRuntimeContext = DispatchContext;

export { createAdapterRegistry, findAdapterByType } from "./registry";
