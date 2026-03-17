export type AoActTask = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  act_task_id: string;
  action_type: string;
  parameters: Record<string, unknown>;
};

export type DispatchResult = {
  adapter_type: string;
  ok: boolean;
  receipt_fact_id?: string;
  detail?: unknown;
  error?: string;
};

export type ActuatorAdapter = {
  adapter_type: string;
  supports(actionType: string): boolean;
  dispatch(task: AoActTask): Promise<DispatchResult>;
};

export type AdapterRuntimeContext = {
  baseUrl: string;
  token: string;
};

import { createIrrigationSimulatorAdapter } from "./irrigation_simulator";

export function createAdapterRegistry(ctx: AdapterRuntimeContext): ActuatorAdapter[] {
  return [
    createIrrigationSimulatorAdapter(ctx)
  ];
}

export function findAdapter(registry: ActuatorAdapter[], actionType: string): ActuatorAdapter | null {
  for (const adapter of registry) {
    if (adapter.supports(actionType)) return adapter;
  }
  return null;
}
