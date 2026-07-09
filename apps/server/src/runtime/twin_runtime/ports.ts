// apps/server/src/runtime/twin_runtime/ports.ts
// Purpose: define MCFT-CAP-01 Runtime Config, controlled Replay evidence, A0 persistence, and projection rebuild ports without binding orchestration to SQL or files.
// Boundary: interfaces only; no implementation, equations, Fastify, filesystem, environment, or wall-clock reads.

import type { A0RecordSetV1, CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";

export type TwinScopeKeyV1 = { tenant_id: string; project_id: string; group_id: string; field_id: string; season_id: string; zone_id: string };
export type RuntimeLeaseClaimV1 = TwinScopeKeyV1 & { lease_owner: string; fencing_token: bigint; lease_duration_seconds: number };
export type FaultInjectionStageV1 = string;

export type ReplayEvidenceRoleV1 =
  | "SOIL_MOISTURE_OBSERVATION"
  | "RAINFALL_OBSERVATION"
  | "HISTORICAL_ET0_INPUT"
  | "FUTURE_WEATHER_ASSUMPTION"
  | "FUTURE_ET0_ASSUMPTION"
  | "APPROVED_IRRIGATION_PLAN"
  | "IRRIGATION_EXECUTION_EVIDENCE";

export type CanonicalReplayEvidenceRecordV1 = TwinScopeKeyV1 & {
  dataset_id: string;
  source_record_id: string;
  source_record_hash: string;
  record_type: string;
  binding_id: string;
  epistemic_class: string;
  available_to_runtime_at: string;
  role_time: Record<string, unknown>;
  quality: { status: string };
  canonical_payload: Record<string, unknown>;
  limitations: string[];
};

export interface ReplayEvidenceSourcePortV1 {
  loadCandidateRecords(input: { scope: TwinScopeKeyV1; logical_time: string }): Promise<readonly CanonicalReplayEvidenceRecordV1[]>;
}

export interface RuntimeConfigRepositoryPortV1 {
  commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; object_id: string; fact_id: string }>;
  readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null>;
}

export interface BootstrapPersistencePortV1 {
  acquireLease(claim: Omit<RuntimeLeaseClaimV1, "fencing_token">): Promise<RuntimeLeaseClaimV1>;
  lookupA0RecordSet(idempotencyKey: string): Promise<A0RecordSetV1 | null>;
  commitBootstrapState(input: { scope: TwinScopeKeyV1; lease: RuntimeLeaseClaimV1; expected: { active_lineage_ref: null; checkpoint_ref: null; state_ref: null; forecast_result_ref: null; successful_forecast_ref: null }; record_set: A0RecordSetV1; fault_injection?: (stage: FaultInjectionStageV1) => void }): Promise<{ status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS"; record_set: A0RecordSetV1; fact_ids_by_object_id: Record<string, string> }>;
  readBootstrapRecordSet(recordSetId: string): Promise<A0RecordSetV1 | null>;
}

export interface A0ProjectionRebuildPortV1 {
  rebuildA0Projections(recordSetId: string): Promise<{ rebuilt_projection_count: 6 }>;
}
