export type AoActTask = {
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
};

export type DispatchResult = {
  adapter_type: string;
  success: boolean;
  error: string | null;
  receipt_payload: Record<string, unknown> | null;
};

export type Receipt = {
  command_id: string;
  status?: string;
  payload?: Record<string, unknown>;
};

export type Adapter = {
  dispatch(task: AoActTask): Promise<{ command_id: string }>;
  handleReceipt(msg: unknown): Receipt;
};

export type AdapterRuntimeContext = {
  baseUrl: string;
  token: string;
};

export { createAdapterRegistry, findAdapter } from "./registry";
