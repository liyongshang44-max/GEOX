// MCFT-CAP-09 Production Hosting Phase 3: one Evidence Runtime supply cycle.
// Boundary: composition only. No provider selection, timer/cadence, environment, process lifecycle,
// Twin state, RuntimeTickCursor, action authority, or production activation.

import {
  collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1,
  type ExternalEvidenceDecoderPortV1,
  type ExternalEvidenceFetchRequestV1,
  type ExternalEvidenceTransportPortV1,
  type RawEvidenceRetentionPortV1,
} from "./mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  ExternalFormalEvidenceIngressPortV1,
} from "./mcft_cap09_external_formal_collector_phase_orchestrator_v1.js";
import {
  PostCommitVisibleExternalFormalEvidenceIngressV1,
  type EvidenceSupplyCursorPortV1,
  type ExternalEvidencePostCommitVisibilityPortV1,
} from "./mcft_cap09_evidence_visibility_supply_cursor_v1.js";
import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceProducerLeasePortV1,
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_V1" as const;

export type EvidenceRuntimeCycleWorkItemV1 = {
  work_item_id: string;
  dataset_id: string;
  request: ExternalEvidenceFetchRequestV1;
  transport: ExternalEvidenceTransportPortV1;
  decoder: ExternalEvidenceDecoderPortV1;
  retention?: RawEvidenceRetentionPortV1;
};

export interface EvidenceSupplyCursorFactoryV1 {
  createForProducerClaim(claim: EvidenceProducerLeaseClaimV1): EvidenceSupplyCursorPortV1;
}

export interface EvidenceCommittedIngressFactoryV1 {
  createForProducerClaim(claim: EvidenceProducerLeaseClaimV1): ExternalFormalEvidenceIngressPortV1;
}

export type ExecuteEvidenceRuntimeCycleInputV1 = {
  scope: EvidenceRuntimeScopeV1;
  lease_owner: string;
  lease_duration_seconds: number;
  work_items: readonly EvidenceRuntimeCycleWorkItemV1[];
};

export type ExecuteEvidenceRuntimeCycleResultV1 =
  | {
      service_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_ID_V1;
      status: "LEASE_HELD_BY_OTHER_OWNER";
      lease_claim: null;
      work_item_count: 0;
      canonical_record_count: 0;
      visible_ingress_count: 0;
      evidence_supply_cursor_advance_count: 0;
      twin_state_mutation: false;
      runtime_tick_cursor_mutation: false;
    }
  | {
      service_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_ID_V1;
      status: "COMPLETED";
      lease_claim: EvidenceProducerLeaseClaimV1;
      work_item_count: number;
      canonical_record_count: number;
      visible_ingress_count: number;
      evidence_supply_cursor_advance_count: number;
      work_item_results: readonly {
        work_item_id: string;
        canonical_record_count: number;
        visible_ingress_count: number;
      }[];
      twin_state_mutation: false;
      runtime_tick_cursor_mutation: false;
    };

function requiredTextV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function validateWorkItemsV1(items: readonly EvidenceRuntimeCycleWorkItemV1[]): void {
  if (!Array.isArray(items) || items.length === 0) throw new Error("PHASE3_EVIDENCE_CYCLE_WORK_ITEMS_REQUIRED");
  const ids = new Set<string>();
  const requestIds = new Set<string>();
  for (const item of items) {
    const id = requiredTextV1(item.work_item_id, "PHASE3_EVIDENCE_CYCLE_WORK_ITEM_ID_REQUIRED");
    if (ids.has(id)) throw new Error(`PHASE3_EVIDENCE_CYCLE_WORK_ITEM_ID_DUPLICATE:${id}`);
    ids.add(id);
    const requestId = requiredTextV1(item.request.request_id, "PHASE3_EVIDENCE_CYCLE_REQUEST_ID_REQUIRED");
    if (requestIds.has(requestId)) throw new Error(`PHASE3_EVIDENCE_CYCLE_REQUEST_ID_DUPLICATE:${requestId}`);
    requestIds.add(requestId);
    requiredTextV1(item.dataset_id, "PHASE3_EVIDENCE_CYCLE_DATASET_ID_REQUIRED");
  }
}

export class EvidenceRuntimeCycleServiceV1 {
  readonly service_id = MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_ID_V1;

  constructor(private readonly deps: {
    lease: EvidenceProducerLeasePortV1;
    retention: RawEvidenceRetentionPortV1;
    committed_ingress_factory: EvidenceCommittedIngressFactoryV1;
    visibility: ExternalEvidencePostCommitVisibilityPortV1;
    cursor_factory: EvidenceSupplyCursorFactoryV1;
    completion_clock: () => string;
  }) {}

  async executeCycle(input: ExecuteEvidenceRuntimeCycleInputV1): Promise<ExecuteEvidenceRuntimeCycleResultV1> {
    validateWorkItemsV1(input.work_items);
    const owner = requiredTextV1(input.lease_owner, "PHASE3_EVIDENCE_CYCLE_LEASE_OWNER_REQUIRED");
    let claim = await this.deps.lease.acquireLease({
      scope: input.scope,
      lease_owner: owner,
      lease_duration_seconds: input.lease_duration_seconds,
    });
    if (!claim) {
      return {
        service_id: this.service_id,
        status: "LEASE_HELD_BY_OTHER_OWNER",
        lease_claim: null,
        work_item_count: 0,
        canonical_record_count: 0,
        visible_ingress_count: 0,
        evidence_supply_cursor_advance_count: 0,
        twin_state_mutation: false,
        runtime_tick_cursor_mutation: false,
      };
    }

    let canonicalRecordCount = 0;
    let visibleIngressCount = 0;
    const workItemResults: {
      work_item_id: string;
      canonical_record_count: number;
      visible_ingress_count: number;
    }[] = [];

    for (const item of input.work_items) {
      // Keep the same owner/fence live across potentially slow provider work. A stale fence
      // will still be rejected atomically by the durable cursor before supply-watermark advance.
      claim = await this.deps.lease.renewLease({
        claim,
        lease_duration_seconds: input.lease_duration_seconds,
      });
      const committedIngress = this.deps.committed_ingress_factory.createForProducerClaim(claim);
      const cursor = this.deps.cursor_factory.createForProducerClaim(claim);
      const visibleIngress = new PostCommitVisibleExternalFormalEvidenceIngressV1(
        committedIngress,
        this.deps.visibility,
        cursor,
      );

      const canonical = await collectRetainDecodeCanonicalizeExternalEvidenceWithCompletionClockV1(
        {
          dataset_id: item.dataset_id,
          scope: input.scope,
          request: item.request,
        },
        {
          transport: item.transport,
          retention: item.retention ?? this.deps.retention,
          decoder: item.decoder,
        },
        this.deps.completion_clock,
      );

      let itemVisibleCount = 0;
      for (const result of canonical) {
        const receipt = await visibleIngress.appendCanonicalizedExternalEvidence(result);
        if (receipt.post_commit_visibility_verified !== true || receipt.evidence_supply_cursor_advanced !== true) {
          throw new Error("PHASE3_EVIDENCE_CYCLE_VISIBLE_CURSOR_RECEIPT_REQUIRED");
        }
        itemVisibleCount += 1;
      }
      canonicalRecordCount += canonical.length;
      visibleIngressCount += itemVisibleCount;
      workItemResults.push({
        work_item_id: item.work_item_id,
        canonical_record_count: canonical.length,
        visible_ingress_count: itemVisibleCount,
      });
    }

    return {
      service_id: this.service_id,
      status: "COMPLETED",
      lease_claim: claim,
      work_item_count: input.work_items.length,
      canonical_record_count: canonicalRecordCount,
      visible_ingress_count: visibleIngressCount,
      evidence_supply_cursor_advance_count: visibleIngressCount,
      work_item_results: workItemResults,
      twin_state_mutation: false,
      runtime_tick_cursor_mutation: false,
    };
  }
}
