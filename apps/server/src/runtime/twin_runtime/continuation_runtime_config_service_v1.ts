// apps/server/src/runtime/twin_runtime/continuation_runtime_config_service_v1.ts
// Purpose: persist the immutable MCFT-CAP-02 continuation Runtime Config through the existing D transaction repository and verify canonical readback before any A2 tick.
// Boundary: application orchestration over an existing Runtime Config port only; no SQL, filesystem, routes, Dynamics, Evidence selection, Forecast success, or scheduler.

import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { validateContinuationRuntimeConfigPayloadV1 } from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import type { RuntimeConfigRepositoryPortV1 } from "./ports.js";

export type CommitContinuationRuntimeConfigResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  object_id: string;
  fact_id: string;
  runtime_config: CanonicalObjectEnvelopeV1;
};

export class ContinuationRuntimeConfigServiceV1 {
  constructor(private readonly repository: RuntimeConfigRepositoryPortV1) {}

  async commitAndVerify(config: CanonicalObjectEnvelopeV1): Promise<CommitContinuationRuntimeConfigResultV1> {
    validateCanonicalObjectV1(config);
    if (config.object_type !== "twin_runtime_config_v1") throw new Error("CONTINUATION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    if (config.runtime_config_ref !== null || config.runtime_config_hash !== null) throw new Error("CONTINUATION_RUNTIME_CONFIG_SELF_REFERENCE_FORBIDDEN");
    validateContinuationRuntimeConfigPayloadV1(config.payload);

    const committed = await this.repository.commitRuntimeConfig(config);
    const readback = await this.repository.readRuntimeConfig(config.object_id);
    if (!readback) throw new Error("CONTINUATION_RUNTIME_CONFIG_READBACK_MISSING");
    validateCanonicalObjectV1(readback);
    validateContinuationRuntimeConfigPayloadV1(readback.payload);
    if (readback.object_id !== config.object_id) throw new Error("CONTINUATION_RUNTIME_CONFIG_READBACK_OBJECT_ID_MISMATCH");
    if (readback.determinism_hash !== config.determinism_hash) throw new Error("CONTINUATION_RUNTIME_CONFIG_READBACK_HASH_MISMATCH");
    if (readback.idempotency_key !== config.idempotency_key) throw new Error("CONTINUATION_RUNTIME_CONFIG_READBACK_IDEMPOTENCY_MISMATCH");

    // PostgreSQL jsonb preserves JSON semantics but not object-key insertion order.
    // Canonical JSON therefore compares the complete payload without introducing
    // a false mismatch when jsonb returns the same object with reordered keys.
    if (canonicalJsonV1(readback.payload) !== canonicalJsonV1(config.payload)) {
      throw new Error("CONTINUATION_RUNTIME_CONFIG_READBACK_PAYLOAD_MISMATCH");
    }

    return {
      ...committed,
      runtime_config: readback,
    };
  }
}
