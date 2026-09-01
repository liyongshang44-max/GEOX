// MCFT-CAP-09 production source-plan executor core.
// Maps already-adjudicated pure source decisions into the single EvidenceRuntimeHost attempt seam.
// It does not plan, read clocks/environment, start processes, or bind production ownership.
// Provider-attempt fenced poll/retry claims are injected here but execute only inside the service after the current Evidence producer lease is acquired.

import type {
  EvidenceRuntimeCycleServiceV1,
  EvidenceRuntimeCycleWorkItemV1,
} from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  buildCanonicalWorkItemAttemptPlanV1,
  MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,
  type EvidenceRuntimeHostAttemptPlanV1,
  type EvidenceRuntimeHostAttemptResultV1,
} from "./mcft_cap09_evidence_runtime_host_attempt_v1.js";
import type {
  GfsPartialPairRehydrationWorkItemFactoryV1,
} from "./mcft_cap09_gfs_partial_pair_rehydration_v1.js";
import type {
  KbsRawHourlyPublicationCycleServiceV1,
} from "./mcft_cap09_kbs_raw_hourly_publication_cycle_service_v1.js";
import type {
  ProductionEvidenceSourceDecisionV1,
} from "./mcft_cap09_production_evidence_source_planner_v1.js";
import type {
  ProductionEvidenceWorkItemFactoryV1,
} from "./mcft_cap09_production_evidence_work_items_v1.js";
import type { ProductionEvidenceProviderAttemptFenceFactoryV1 } from "./mcft_cap09_production_provider_attempt_fence_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLAN_EXECUTOR_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLAN_EXECUTOR_V1" as const;

function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function isoV1(value: unknown, code: string): string {
  const text = textV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) {
    throw new Error(code);
  }
  return text;
}
function requestPrefixV1(kind: string, requestedAt: string): string {
  const requested = isoV1(
    requestedAt,
    "PRODUCTION_SOURCE_PLAN_EXECUTOR_REQUESTED_AT_INVALID",
  );
  return `mcft-cap09-production:${kind}:${requested}`;
}
function normalizeResultV1(input: {
  attempt_id: string;
  attempt_kind:
    | "KBS_RAW_HOURLY_PUBLICATION_CYCLE"
    | "GFS_PARTIAL_PAIR_REHYDRATION";
  lease_claim: EvidenceRuntimeHostAttemptResultV1["lease_claim"];
  status: "COMPLETED" | "LEASE_HELD_BY_OTHER_OWNER" | "PROVIDER_NOT_DUE";
  canonical_record_count: number;
  visible_ingress_count: number;
  evidence_supply_cursor_advance_count: number;
}): EvidenceRuntimeHostAttemptResultV1 {
  return {
    attempt_contract_id:
      MCFT_CAP09_EVIDENCE_RUNTIME_HOST_ATTEMPT_CONTRACT_ID_V1,
    attempt_id: input.attempt_id,
    attempt_kind: input.attempt_kind,
    status: input.status,
    lease_claim: input.lease_claim,
    canonical_record_count: input.canonical_record_count,
    visible_ingress_count: input.visible_ingress_count,
    evidence_supply_cursor_advance_count:
      input.evidence_supply_cursor_advance_count,
    twin_state_mutation: false,
    runtime_tick_cursor_mutation: false,
  };
}

export class ProductionEvidenceSourcePlanExecutorV1 {
  readonly executor_id =
    MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_PLAN_EXECUTOR_ID_V1;

  constructor(private readonly deps: {
    cycle_service: Pick<EvidenceRuntimeCycleServiceV1, "executeCycle">;
    work_item_factory: Pick<
      ProductionEvidenceWorkItemFactoryV1,
      "buildKbsSoilCurrent" | "buildGfsBundle"
    >;
    gfs_partial_factory: Pick<
      GfsPartialPairRehydrationWorkItemFactoryV1,
      "buildWorkItem"
    >;
    kbs_publication_cycle: Pick<
      KbsRawHourlyPublicationCycleServiceV1,
      "executeCycle"
    >;
    runtime_start_authority_ref: string;
    activation_fence_time: string;
    provider_attempt_fence_factory: Pick<ProductionEvidenceProviderAttemptFenceFactoryV1, "buildForDecision">;
  }) {
    textV1(
      deps.runtime_start_authority_ref,
      "PRODUCTION_SOURCE_PLAN_EXECUTOR_RUNTIME_START_AUTHORITY_REQUIRED",
    );
    isoV1(
      deps.activation_fence_time,
      "PRODUCTION_SOURCE_PLAN_EXECUTOR_ACTIVATION_FENCE_INVALID",
    );
  }

  buildAttempt(
    decision: ProductionEvidenceSourceDecisionV1,
  ): EvidenceRuntimeHostAttemptPlanV1 | null {
    if (decision.status === "NOT_DUE") return null;
    const operation = decision.operation;
    const prefix = requestPrefixV1(operation.kind, operation.requested_at);

    if (operation.kind === "KBS_RAW_HOURLY_PUBLICATION_CYCLE") {
      const providerFence=this.deps.provider_attempt_fence_factory.buildForDecision(decision);
      if(!providerFence) throw new Error("PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_PROVIDER_FENCE_REQUIRED");
      const attemptId = prefix;
      return {
        attempt_id: attemptId,
        attempt_kind: "KBS_RAW_HOURLY_PUBLICATION_CYCLE",
        execute: async (execution) => {
          const result = await this.deps.kbs_publication_cycle.executeCycle({
            scope: execution.scope,
            lease_owner: execution.lease_owner,
            lease_duration_seconds: execution.lease_duration_seconds,
            requested_at: operation.requested_at,
            request_id_prefix: prefix,
            runtime_start_authority_ref:
              this.deps.runtime_start_authority_ref,
            activation_fence_time: this.deps.activation_fence_time,
            provider_attempt_fence: providerFence,
          });
          if(result.status==="PROVIDER_NOT_DUE"){
            return normalizeResultV1({attempt_id:attemptId,attempt_kind:"KBS_RAW_HOURLY_PUBLICATION_CYCLE",lease_claim:result.lease_claim,status:"PROVIDER_NOT_DUE",canonical_record_count:0,visible_ingress_count:0,evidence_supply_cursor_advance_count:0});
          }
          if (result.status === "LEASE_HELD_BY_OTHER_OWNER") {
            return normalizeResultV1({
              attempt_id: attemptId,
              attempt_kind: "KBS_RAW_HOURLY_PUBLICATION_CYCLE",
              lease_claim: null,
              status: "LEASE_HELD_BY_OTHER_OWNER",
              canonical_record_count: 0,
              visible_ingress_count: 0,
              evidence_supply_cursor_advance_count: 0,
            });
          }
          if (result.status.startsWith("BLOCKED_")) {
            throw new Error(
              "PRODUCTION_SOURCE_PLAN_EXECUTOR_KBS_BLOCKED:"
              + result.status
              + ":"
              + String(result.blocked_reason ?? "UNSPECIFIED"),
            );
          }
          return normalizeResultV1({
            attempt_id: attemptId,
            attempt_kind: "KBS_RAW_HOURLY_PUBLICATION_CYCLE",
            lease_claim: result.lease_claim,
            status: "COMPLETED",
            canonical_record_count: result.canonical_record_count,
            visible_ingress_count: result.visible_ingress_count,
            evidence_supply_cursor_advance_count:
              result.evidence_supply_cursor_advance_count,
          });
        },
      };
    }

    if (operation.kind === "GFS_PARTIAL_PAIR_REHYDRATE") {
      if(this.deps.provider_attempt_fence_factory.buildForDecision(decision)!==null) throw new Error("PRODUCTION_SOURCE_PLAN_EXECUTOR_GFS_REHYDRATION_PROVIDER_FENCE_FORBIDDEN");
      const attemptId = prefix + ":" + operation.cycle_key;
      return {
        attempt_id: attemptId,
        attempt_kind: "GFS_PARTIAL_PAIR_REHYDRATION",
        execute: async (execution) => {
          const built = await this.deps.gfs_partial_factory.buildWorkItem({
            scope: execution.scope,
            partial: operation.partial_progress,
            target_logical_time: operation.target_logical_time,
            work_item_id_prefix: prefix,
          });
          const canonical = buildCanonicalWorkItemAttemptPlanV1({
            attempt_id: attemptId,
            cycle_service: this.deps.cycle_service,
            work_items: [built.work_item],
          });
          const result = await canonical.execute(execution);
          return normalizeResultV1({
            attempt_id: attemptId,
            attempt_kind: "GFS_PARTIAL_PAIR_REHYDRATION",
            lease_claim: result.lease_claim,
            status: result.status,
            canonical_record_count: result.canonical_record_count,
            visible_ingress_count: result.visible_ingress_count,
            evidence_supply_cursor_advance_count:
              result.evidence_supply_cursor_advance_count,
          });
        },
      };
    }

    let workItem: EvidenceRuntimeCycleWorkItemV1;
    if (operation.kind === "GFS_BUNDLE_ACQUIRE") {
      workItem = this.deps.work_item_factory.buildGfsBundle({
        target_logical_time: operation.target_logical_time,
        requested_at: operation.requested_at,
        request_id_prefix: prefix,
      });
    } else if (operation.kind === "KBS_SOIL_CURRENT_ACQUIRE") {
      workItem = this.deps.work_item_factory.buildKbsSoilCurrent({
        requested_at: operation.requested_at,
        request_id_prefix: prefix,
      });
    } else {
      const unreachable: never = operation;
      throw new Error(
        "PRODUCTION_SOURCE_PLAN_EXECUTOR_OPERATION_UNSUPPORTED:"
        + String(unreachable),
      );
    }
    const providerFence=this.deps.provider_attempt_fence_factory.buildForDecision(decision);
    if(!providerFence) throw new Error("PRODUCTION_SOURCE_PLAN_EXECUTOR_PROVIDER_FENCE_REQUIRED");
    return buildCanonicalWorkItemAttemptPlanV1({
      attempt_id: prefix,
      cycle_service: this.deps.cycle_service,
      work_items: [workItem],
      provider_attempt_fence: providerFence,
    });
  }
}
