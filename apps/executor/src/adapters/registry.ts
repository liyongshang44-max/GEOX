import { createIrrigationSimulatorAdapter } from "./irrigation_simulator";
import { createIrrigationRealAdapter } from "./irrigation_real_adapter";
import { createMqttAdapter } from "./mqtt";
import type { Adapter, AdapterRuntimeContext, AoActTask } from "./index";

type AdapterRegistry = Map<string, Adapter>;

function normalizeAdapterType(value: string): string {
  return value.trim().toLowerCase();
}

function registerAdapter(registry: AdapterRegistry, adapterType: string, adapter: Adapter): void {
  const key = normalizeAdapterType(adapterType);
  if (!key) throw new Error("ADAPTER_TYPE_REQUIRED");
  if (registry.has(key)) throw new Error(`ADAPTER_ALREADY_REGISTERED:${key}`);
  registry.set(key, adapter);
}

function defaultAdapterTypeByActionType(actionType: string): string {
  const normalized = actionType.trim().toLowerCase();
  if (normalized === "irrigation.start" || normalized === "irrigate") return "irrigation_real";
  return "mqtt";
}

function resolveTaskAdapterType(task: AoActTask): string {
  const fromPlan = typeof task.adapter_type === "string" ? task.adapter_type.trim() : "";
  if (fromPlan) return fromPlan;

  const fromTaskHint = typeof task.adapter_hint === "string" ? task.adapter_hint.trim() : "";
  if (fromTaskHint) return fromTaskHint;

  const fromMeta = typeof task.meta?.adapter_type === "string" ? String(task.meta.adapter_type).trim() : "";
  if (fromMeta) return fromMeta;

  return defaultAdapterTypeByActionType(task.action_type);
}

export function createAdapterRegistry(ctx: AdapterRuntimeContext): AdapterRegistry {
  const registry: AdapterRegistry = new Map<string, Adapter>();
  registerAdapter(registry, "irrigation", createIrrigationRealAdapter(ctx));
  registerAdapter(registry, "irrigation_real", createIrrigationRealAdapter(ctx));
  registerAdapter(registry, "irrigation_simulator", createIrrigationSimulatorAdapter(ctx));
  registerAdapter(registry, "mqtt", createMqttAdapter(ctx));
  return registry;
}

export function findAdapter(registry: AdapterRegistry, task: AoActTask): { adapterType: string; adapter: Adapter } {
  const requested = resolveTaskAdapterType(task);
  const key = normalizeAdapterType(requested);
  const adapter = registry.get(key);
  if (adapter) return { adapterType: key, adapter };

  const normalizedHint = key;
  if (normalizedHint === "irrigation") {
    const irrigationRealAdapter = registry.get("irrigation_real");
    if (irrigationRealAdapter) return { adapterType: "irrigation_real", adapter: irrigationRealAdapter };
  }
  if (normalizedHint === "mqtt_downlink_once_v1") {
    const mqttAdapter = registry.get("mqtt");
    if (mqttAdapter) return { adapterType: "mqtt", adapter: mqttAdapter };
  }

  throw new Error(
    `ADAPTER_NOT_FOUND: adapter_type=${requested || "<empty>"} action_type=${task.action_type}`
  );
}
