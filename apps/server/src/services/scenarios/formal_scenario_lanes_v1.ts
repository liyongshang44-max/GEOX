import type { FormalScenarioLaneV1, FormalScenarioTypeV1 } from "./formal_scenario_manifest_v1.js";

export type FormalScenarioLaneDefinitionV1 = {
  scenario_type: FormalScenarioTypeV1;
  lane: FormalScenarioLaneV1;
  label: string;
  release_gate: boolean;
  flight_table_visible: boolean;
  kernel_ready: boolean;
};

export const FORMAL_SCENARIO_TYPES_V1: readonly FormalScenarioTypeV1[] = [
  "FORMAL_IRRIGATION",
  "DEVICE_ANOMALY",
  "FORMAL_VARIABLE_OPERATION",
] as const;

export const FORMAL_SCENARIO_LANES_V1: readonly FormalScenarioLaneV1[] = [
  "positive",
  "negative",
  "anomaly",
  "partial",
] as const;

const DEFINITIONS: readonly FormalScenarioLaneDefinitionV1[] = [
  { scenario_type: "FORMAL_IRRIGATION", lane: "positive", label: "Formal irrigation positive closed loop", release_gate: true, flight_table_visible: true, kernel_ready: true },
  { scenario_type: "FORMAL_IRRIGATION", lane: "negative", label: "Formal irrigation negative evidence lanes", release_gate: true, flight_table_visible: true, kernel_ready: true },
  { scenario_type: "DEVICE_ANOMALY", lane: "anomaly", label: "Device anomaly and offline fail-safe lane", release_gate: true, flight_table_visible: true, kernel_ready: false },
  { scenario_type: "FORMAL_VARIABLE_OPERATION", lane: "positive", label: "Formal variable operation positive lane", release_gate: true, flight_table_visible: true, kernel_ready: false },
  { scenario_type: "FORMAL_VARIABLE_OPERATION", lane: "partial", label: "Formal variable operation partial rollup lane", release_gate: true, flight_table_visible: true, kernel_ready: false },
  { scenario_type: "FORMAL_VARIABLE_OPERATION", lane: "negative", label: "Formal variable operation negative zone lanes", release_gate: true, flight_table_visible: true, kernel_ready: false },
] as const;

export function isFormalScenarioTypeV1(input: unknown): input is FormalScenarioTypeV1 {
  return FORMAL_SCENARIO_TYPES_V1.includes(String(input ?? "") as FormalScenarioTypeV1);
}

export function isFormalScenarioLaneV1(input: unknown): input is FormalScenarioLaneV1 {
  return FORMAL_SCENARIO_LANES_V1.includes(String(input ?? "") as FormalScenarioLaneV1);
}

export function listFormalScenarioLaneDefinitionsV1(): FormalScenarioLaneDefinitionV1[] {
  return DEFINITIONS.map((item) => ({ ...item }));
}

export function getFormalScenarioLaneDefinitionV1(
  scenario_type: FormalScenarioTypeV1,
  lane: FormalScenarioLaneV1,
): FormalScenarioLaneDefinitionV1 | null {
  const hit = DEFINITIONS.find((item) => item.scenario_type === scenario_type && item.lane === lane);
  return hit ? { ...hit } : null;
}


export function listArchitectureClosureGateLanesV1(): FormalScenarioLaneDefinitionV1[] {
  return listFormalScenarioLaneDefinitionsV1().filter((item) => item.release_gate);
}

export function listKernelDebtLanesV1(): FormalScenarioLaneDefinitionV1[] {
  return listFormalScenarioLaneDefinitionsV1().filter((item) => item.release_gate && !item.kernel_ready);
}
