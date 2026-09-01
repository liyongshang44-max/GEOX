// MCFT-CAP-09 Evidence Runtime host attempt seam.
// One long-running EvidenceRuntimeHostV1 executes heterogeneous Evidence-plane attempts.
// This contract contains no cadence, provider, database, Twin, RuntimeTickCursor, or activation authority.

import type {
  EvidenceRuntimeCycleServiceV1,
  EvidenceRuntimeCycleWorkItemV1,
} from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_V1" as const;

export type EvidenceRuntimeHostAttemptKindV1 =
  | "CANONICAL_WORK_ITEM_CYCLE"
  | "KBS_RAW_HOURLY_PUBLICATION_CYCLE"
  | "GFS_PARTIAL_PAIR_REHYDRATION";

export type EvidenceRuntimeHostAttemptExecutionInputV1 = {
  scope: EvidenceRuntimeScopeV1;
  lease_owner: string;
  lease_duration_seconds: number;
};

export type EvidenceRuntimeHostAttemptResultV1 = {
  attempt_contract_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1;
  attempt_id: string;
  attempt_kind: EvidenceRuntimeHostAttemptKindV1;
  status: "COMPLETED" | "LEASE_HELD_BY_OTHER_OWNER";
  lease_claim: EvidenceProducerLeaseClaimV1 | null;
  canonical_record_count: number;
  visible_ingress_count: number;
  evidence_supply_cursor_advance_count: number;
  twin_state_mutation: false;
  runtime_tick_cursor_mutation: false;
};

export interface EvidenceRuntimeHostAttemptPlanV1 {
  readonly attempt_id: string;
  readonly attempt_kind: EvidenceRuntimeHostAttemptKindV1;
  execute(
    input: EvidenceRuntimeHostAttemptExecutionInputV1,
  ): Promise<EvidenceRuntimeHostAttemptResultV1>;
}

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

export function buildCanonicalWorkItemAttemptPlanV1(input: {
  attempt_id: string;
  cycle_service: Pick<EvidenceRuntimeCycleServiceV1, "executeCycle">;
  work_items: readonly EvidenceRuntimeCycleWorkItemV1[];
}): EvidenceRuntimeHostAttemptPlanV1 {
  const attemptId = textV1(
    input.attempt_id,
    "EVIDENCE_RUNTIME_ATTEMPT_ID_REQUIRED",
  );
  if (!Array.isArray(input.work_items) || input.work_items.length === 0) {
    throw new Error("EVIDENCE_RUNTIME_CANONICAL_ATTEMPT_WORK_ITEMS_REQUIRED");
  }
  const workItems = [...input.work_items];
  return {
    attempt_id: attemptId,
    attempt_kind: "CANONICAL_WORK_ITEM_CYCLE",
    async execute(execution) {
      const result = await input.cycle_service.executeCycle({
        scope: execution.scope,
        lease_owner: execution.lease_owner,
        lease_duration_seconds: execution.lease_duration_seconds,
        work_items: workItems,
      });
      return {
        attempt_contract_id:
          MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,
        attempt_id: attemptId,
        attempt_kind: "CANONICAL_WORK_ITEM_CYCLE",
        status: result.status,
        lease_claim: result.lease_claim,
        canonical_record_count: result.canonical_record_count,
        visible_ingress_count: result.visible_ingress_count,
        evidence_supply_cursor_advance_count:
          result.evidence_supply_cursor_advance_count,
        twin_state_mutation: false,
        runtime_tick_cursor_mutation: false,
      };
    },
  };
}
