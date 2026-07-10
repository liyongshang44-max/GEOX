// apps/server/src/runtime/twin_runtime/assimilated_continuation_runtime_config_service_v1.ts
// Purpose: persist the immutable MCFT-CAP-03 Runtime Config through the existing D transaction repository and verify canonical readback before any observation-aware A2 tick.
// Boundary: application orchestration over an existing Runtime Config port only; no SQL, active-config pointer, Evidence selection, assimilation math, tick, route, scheduler, or model activation.

import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "./ports.js";

export type CommitAssimilatedContinuationRuntimeConfigResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  object_id: string;
  fact_id: string;
  runtime_config: CanonicalObjectEnvelopeV1;
};

export class AssimilatedContinuationRuntimeConfigServiceV1 {
  constructor(private readonly repository: RuntimeConfigRepositoryPortV1) {}

  async commitAndVerify(
    config: CanonicalObjectEnvelopeV1,
  ): Promise<CommitAssimilatedContinuationRuntimeConfigResultV1> {
    validateCanonicalObjectV1(config);
    if (config.object_type !== "twin_runtime_config_v1") throw new Error("ASSIMILATED_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    if (config.runtime_config_ref !== null || config.runtime_config_hash !== null) throw new Error("ASSIMILATED_RUNTIME_CONFIG_SELF_REFERENCE_FORBIDDEN");
    validateAssimilatedContinuationRuntimeConfigPayloadV1(config.payload);

    const committed = await this.repository.commitRuntimeConfig(config);
    const readback = await this.repository.readRuntimeConfig(config.object_id);
    if (!readback) throw new Error("ASSIMILATED_RUNTIME_CONFIG_READBACK_MISSING");
    validateCanonicalObjectV1(readback);
    validateAssimilatedContinuationRuntimeConfigPayloadV1(readback.payload);
    if (readback.object_id !== config.object_id) throw new Error("ASSIMILATED_RUNTIME_CONFIG_READBACK_OBJECT_ID_MISMATCH");
    if (readback.determinism_hash !== config.determinism_hash) throw new Error("ASSIMILATED_RUNTIME_CONFIG_READBACK_HASH_MISMATCH");
    if (readback.idempotency_key !== config.idempotency_key) throw new Error("ASSIMILATED_RUNTIME_CONFIG_READBACK_IDEMPOTENCY_MISMATCH");
    if (canonicalJsonV1(readback.payload) !== canonicalJsonV1(config.payload)) {
      throw new Error("ASSIMILATED_RUNTIME_CONFIG_READBACK_PAYLOAD_MISMATCH");
    }

    return {
      ...committed,
      runtime_config: readback,
    };
  }
}
