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
  runtime?: {
    executor_id?: string;
    lease_token?: string;
    lease_until_ts?: number;
    attempt_no?: number;
  };
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

export interface ExecutorAdapter {
  type: string;
  execute(task: AoActTask): Promise<{
    status: "SUCCEEDED" | "FAILED";
    meta?: any;
  }>;
}

export type ExecutorAdapterV1 = ExecutorAdapter & {
  adapter_type: string;
  supports?: (action_type: string) => boolean;
  validate?: (task: AoActTask) => { ok: true } | { ok: false; reason: string };
};

export type Adapter = ExecutorAdapterV1;
export type AdapterRuntimeContext = DispatchContext;

export { createAdapterRegistry, findAdapterByType } from "./registry";
