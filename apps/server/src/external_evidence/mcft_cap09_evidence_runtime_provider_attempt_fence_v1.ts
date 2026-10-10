// MCFT-CAP-09 provider-attempt fence.
// The execution service obtains the current Evidence producer lease first and invokes
// this hook immediately before provider I/O. No planning, wall clock, Twin, or runtime-start authority.
import type { EvidenceProducerLeaseClaimV1 } from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_PROVIDER_ATTEMPT_FENCE_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_PROVIDER_ATTEMPT_FENCE_V1" as const;

export type EvidenceRuntimeProviderAttemptFenceResultV1 =
  | { status: "AUTHORIZED"; durable_coordination_write_count: 0 | 1 }
  | { status: "NOT_DUE"; durable_coordination_write_count: 0 };

export interface EvidenceRuntimeProviderAttemptFencePortV1 {
  claimBeforeProviderFetch(input: {
    claim: EvidenceProducerLeaseClaimV1;
  }): Promise<EvidenceRuntimeProviderAttemptFenceResultV1>;
}
