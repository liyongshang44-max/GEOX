// apps/server/src/domain/twin_runtime/forecast_scenario_member_hash_v1.ts
// Purpose: compute CAP-04 A-member hashes with an explicit nonrecursive Tick basis while retaining the aggregate hash in the emitted Tick payload.
// Boundary: pure hashing only; no persistence, identity lookup, Forecast/Scenario math, clock, filesystem or network.

import { computeMemberDeterminismHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";

export function computeCap04AMemberDeterminismHashV1(
  member: CanonicalObjectEnvelopeV1,
): string {
  const basis = structuredClone(member) as CanonicalObjectEnvelopeV1;
  if (basis.object_type === "twin_runtime_tick_v1") {
    const payload = { ...basis.payload };
    delete payload.aggregate_determinism_hash;
    basis.payload = payload;
  }
  return computeMemberDeterminismHashV1(basis as unknown as Record<string, unknown>);
}
