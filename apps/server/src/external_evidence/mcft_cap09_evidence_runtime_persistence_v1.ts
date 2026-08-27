// MCFT-CAP-09 Production Hosting Phase 3: Evidence Runtime persistence contracts.
// Boundary: Evidence-plane ownership/cursor contracts only. No Twin Runtime imports,
// RuntimeTickCursor, provider fetch, timers, process lifecycle, environment, or production activation.

import type {
  EvidenceSupplyCursorPortV1,
} from "./mcft_cap09_evidence_visibility_supply_cursor_v1.js";

export const MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1 =
  "MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_V1" as const;

export type EvidenceRuntimeScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type EvidenceProducerLeaseClaimV1 = {
  lease_contract_id: typeof MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1;
  scope: EvidenceRuntimeScopeV1;
  lease_owner: string;
  fencing_token: bigint;
  acquired_at: string;
  expires_at: string;
  heartbeat_at: string;
  database_now: string;
};

export interface EvidenceProducerLeasePortV1 {
  acquireLease(input: {
    scope: EvidenceRuntimeScopeV1;
    lease_owner: string;
    lease_duration_seconds: number;
  }): Promise<EvidenceProducerLeaseClaimV1 | null>;

  renewLease(input: {
    claim: EvidenceProducerLeaseClaimV1;
    lease_duration_seconds: number;
  }): Promise<EvidenceProducerLeaseClaimV1>;

  releaseLease(input: {
    claim: EvidenceProducerLeaseClaimV1;
  }): Promise<void>;
}

export type EvidenceSupplyCursorSnapshotV1 = {
  scope: EvidenceRuntimeScopeV1;
  binding_id: string;
  origin_source_id: string;
  fact_id: string;
  record_semantic_sha256: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
  post_commit_db_readback_at: string;
  lease_owner: string;
  fencing_token: bigint;
  advanced_at: string;
};

export interface EvidenceSupplyCursorReadPortV1 {
  readSupplyCursor(input: {
    scope: EvidenceRuntimeScopeV1;
    binding_id: string;
    origin_source_id: string;
  }): Promise<EvidenceSupplyCursorSnapshotV1 | null>;
}

export type DurableEvidenceSupplyCursorPortV1 =
  EvidenceSupplyCursorPortV1 & EvidenceSupplyCursorReadPortV1;
