// apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.ts
// Purpose: compile and validate the exact 24-object immutable CAP-04 Runtime Config parent chain.
// Boundary: pure deterministic construction; no persistence, active-config pointer, Forecast/Scenario execution, clock, filesystem or network.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  compileCap04RuntimeConfigV1,
  validateCap04RuntimeConfigPayloadV1,
  type CompileCap04RuntimeConfigInputV1,
} from "./forecast_scenario_runtime_config_v1.js";

export const CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1 = 24 as const;

export type CompileCap04RuntimeConfigChainInputV1 = Omit<
  CompileCap04RuntimeConfigInputV1,
  "effective_logical_time" | "parent_runtime_config_ref" | "parent_runtime_config_hash"
> & {
  first_effective_logical_time: string;
  predecessor_runtime_config_ref: string;
  predecessor_runtime_config_hash: string;
};

function addHoursV1(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function canonicalHourV1(value: string): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) throw new Error("CAP04_CONFIG_CHAIN_TIME_INVALID");
}

export function compileCap04RuntimeConfigChainV1(
  input: CompileCap04RuntimeConfigChainInputV1,
): CanonicalObjectEnvelopeV1[] {
  canonicalHourV1(input.first_effective_logical_time);
  if (!input.predecessor_runtime_config_ref || !input.predecessor_runtime_config_hash) throw new Error("CAP04_CONFIG_CHAIN_PREDECESSOR_REQUIRED");
  const configs: CanonicalObjectEnvelopeV1[] = [];
  let parentRef = input.predecessor_runtime_config_ref;
  let parentHash = input.predecessor_runtime_config_hash;
  for (let index = 0; index < CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1; index += 1) {
    const config = compileCap04RuntimeConfigV1({
      ...input,
      effective_logical_time: addHoursV1(input.first_effective_logical_time, index),
      parent_runtime_config_ref: parentRef,
      parent_runtime_config_hash: parentHash,
    });
    configs.push(config);
    parentRef = config.object_id;
    parentHash = config.determinism_hash;
  }
  validateCap04RuntimeConfigChainV1(configs, {
    predecessor_runtime_config_ref: input.predecessor_runtime_config_ref,
    predecessor_runtime_config_hash: input.predecessor_runtime_config_hash,
    first_effective_logical_time: input.first_effective_logical_time,
  });
  return configs;
}

export function validateCap04RuntimeConfigChainV1(
  configs: readonly CanonicalObjectEnvelopeV1[],
  expected: {
    predecessor_runtime_config_ref: string;
    predecessor_runtime_config_hash: string;
    first_effective_logical_time: string;
  },
): void {
  if (!Array.isArray(configs) || configs.length !== CAP04_STANDARD_CONFIG_CHAIN_LENGTH_V1) throw new Error("CAP04_CONFIG_CHAIN_REQUIRES_24_CONFIGS");
  const ids = new Set<string>();
  for (let index = 0; index < configs.length; index += 1) {
    const config = configs[index];
    validateCap04RuntimeConfigPayloadV1(config.payload);
    if (config.object_type !== "twin_runtime_config_v1" || config.runtime_config_ref !== null || config.runtime_config_hash !== null) throw new Error("CAP04_CONFIG_CHAIN_OBJECT_CONTRACT_MISMATCH");
    const payload = config.payload as Record<string, unknown>;
    const expectedTime = addHoursV1(expected.first_effective_logical_time, index);
    if (config.logical_time !== expectedTime || payload.effective_logical_time !== expectedTime) throw new Error("CAP04_CONFIG_CHAIN_EFFECTIVE_TIME_MISMATCH");
    const expectedParentRef = index === 0 ? expected.predecessor_runtime_config_ref : configs[index - 1].object_id;
    const expectedParentHash = index === 0 ? expected.predecessor_runtime_config_hash : configs[index - 1].determinism_hash;
    if (payload.parent_runtime_config_ref !== expectedParentRef || payload.parent_runtime_config_hash !== expectedParentHash) throw new Error("CAP04_CONFIG_CHAIN_PARENT_MISMATCH");
    if (config.object_id === expectedParentRef) throw new Error("CAP04_CONFIG_CHAIN_SELF_PARENT_FORBIDDEN");
    if (ids.has(config.object_id)) throw new Error("CAP04_CONFIG_CHAIN_DUPLICATE_OBJECT_ID");
    ids.add(config.object_id);
  }
}
