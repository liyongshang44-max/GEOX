import type { Adapter, AdapterRuntimeContext } from "./index";
import { createIrrigationSimulatorAdapter } from "./irrigation_simulator";
import { createIrrigationRealAdapter } from "./irrigation_real_adapter";
import { createMqttAdapter } from "./mqtt";
import { createIrrigationHttpV1Adapter } from "./irrigation_http_v1";
import { createExecutorApi } from "../lib/executor_api";

type AdapterRegistry = Map<string, Adapter>;

function normalizeAdapterType(value: string): string {
  return value.trim().toLowerCase();
}

function registerAdapter(registry: AdapterRegistry, adapter: Adapter): void {
  const key = normalizeAdapterType(adapter.adapter_type);
  if (!key) throw new Error("ADAPTER_TYPE_REQUIRED");
  if (registry.has(key)) throw new Error(`ADAPTER_ALREADY_REGISTERED:${key}`);
  registry.set(key, adapter);
}

export function createAdapterRegistry(ctx: AdapterRuntimeContext): AdapterRegistry {
  const registry: AdapterRegistry = new Map<string, Adapter>();
  const api = createExecutorApi(ctx);
  registerAdapter(registry, createIrrigationRealAdapter(ctx));
  registerAdapter(registry, createIrrigationSimulatorAdapter(api));
  registerAdapter(registry, createMqttAdapter(api));
  registerAdapter(registry, createIrrigationHttpV1Adapter(ctx));
  return registry;
}

export function findAdapterByType(registry: AdapterRegistry, adapterType: string): Adapter {
  const key = normalizeAdapterType(adapterType);
  if (!key) throw new Error("ADAPTER_TYPE_REQUIRED");
  const adapter = registry.get(key);
  if (!adapter) throw new Error(`ADAPTER_NOT_FOUND: adapter_type=${adapterType || "<empty>"}`);
  return adapter;
}
