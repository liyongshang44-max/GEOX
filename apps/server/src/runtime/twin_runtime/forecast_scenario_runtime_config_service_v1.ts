// apps/server/src/runtime/twin_runtime/forecast_scenario_runtime_config_service_v1.ts
// Purpose: persist the exact 24-object CAP-04 Runtime Config chain through the existing D transaction port and verify canonical readback.
// Boundary: config application service only; no SQL, active-config pointer, Forecast/Scenario execution, A/B persistence, route, scheduler or model activation.

import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateCap04RuntimeConfigChainV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_chain_v1.js";
import { validateCap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "./ports.js";

export type CommitCap04RuntimeConfigChainResultV1 = {
  inserted_count: number;
  existing_count: number;
  runtime_configs: CanonicalObjectEnvelopeV1[];
};

export class ForecastScenarioRuntimeConfigServiceV1 {
  constructor(private readonly repository: RuntimeConfigRepositoryPortV1) {}

  async commitChainAndVerify(input: {
    configs: readonly CanonicalObjectEnvelopeV1[];
    predecessor_runtime_config_ref: string;
    predecessor_runtime_config_hash: string;
    first_effective_logical_time: string;
  }): Promise<CommitCap04RuntimeConfigChainResultV1> {
    validateCap04RuntimeConfigChainV1(input.configs, input);
    const predecessor = await this.repository.readRuntimeConfig(input.predecessor_runtime_config_ref);
    if (!predecessor) throw new Error("CAP04_PREDECESSOR_RUNTIME_CONFIG_NOT_FOUND");
    if (predecessor.determinism_hash !== input.predecessor_runtime_config_hash) throw new Error("CAP04_PREDECESSOR_RUNTIME_CONFIG_HASH_MISMATCH");
    let insertedCount = 0;
    let existingCount = 0;
    const readbacks: CanonicalObjectEnvelopeV1[] = [];
    for (const config of input.configs) {
      validateCap04RuntimeConfigPayloadV1(config.payload);
      const payload = config.payload as Record<string, unknown>;
      const parent = await this.repository.readRuntimeConfig(String(payload.parent_runtime_config_ref));
      if (!parent || parent.determinism_hash !== payload.parent_runtime_config_hash) throw new Error("CAP04_CONFIG_PARENT_CANONICAL_READBACK_MISMATCH");
      const committed = await this.repository.commitRuntimeConfig(config);
      if (committed.status === "INSERTED") insertedCount += 1;
      else existingCount += 1;
      const readback = await this.repository.readRuntimeConfig(config.object_id);
      if (!readback) throw new Error("CAP04_RUNTIME_CONFIG_READBACK_MISSING");
      validateCap04RuntimeConfigPayloadV1(readback.payload);
      if (readback.determinism_hash !== config.determinism_hash || readback.idempotency_key !== config.idempotency_key || canonicalJsonV1(readback.payload) !== canonicalJsonV1(config.payload)) throw new Error("CAP04_RUNTIME_CONFIG_READBACK_MISMATCH");
      readbacks.push(readback);
    }
    validateCap04RuntimeConfigChainV1(readbacks, input);
    return { inserted_count: insertedCount, existing_count: existingCount, runtime_configs: readbacks };
  }
}
