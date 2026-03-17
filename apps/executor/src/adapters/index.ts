export type AoActTask = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  act_task_id: string;
  command_id: string;
  action_type: string;
  parameters: Record<string, unknown>;
};

export type DispatchResult = {
  adapter_type: string;
  success: boolean;
  error: string | null;
  receipt_payload: Record<string, unknown> | null;
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

export function findAdapter(registry: ActuatorAdapter[], actionType: string): ActuatorAdapter {
  const matches = registry.filter((adapter) => adapter.supports(actionType));
  if (matches.length === 0) {
    throw new Error(`ADAPTER_NOT_FOUND: action_type=${actionType}`);
  }
  if (matches.length > 1) {
    throw new Error(`ADAPTER_CONFLICT: action_type=${actionType} match_count=${matches.length}`);
  }
  return matches[0];
}
