// MCFT-CAP-09 Phase 3 production Evidence Runtime composition.
// Wires product provider modules, private raw retention, governed ingress, post-COMMIT visibility,
// independent EvidenceProducerLease/EvidenceSupplyCursor, canonical cycle service, and long-running host.
// Boundary: target/cadence policy is injected; no Twin state, RuntimeTickCursor, action authority,
// environment lookup, signal handler, or automatic production activation is defined here.

import type { Pool } from "pg";

import {
  EvidenceRuntimeCycleServiceV1,
  type ExecuteEvidenceRuntimeCycleResultV1,
} from "./mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  EvidenceRuntimeHostV1,
  type EvidenceRuntimeHostFailureClassifierV1,
  type EvidenceRuntimeHostHealthPortV1,
  type EvidenceRuntimeHostPlannerV1,
  type EvidenceRuntimeHostStopPortV1,
  type EvidenceRuntimeHostWaitPortV1,
} from "./mcft_cap09_evidence_runtime_host_v1.js";
import type {
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import {
  ProductionEvidenceWorkItemFactoryV1,
  type ProductionEvidenceWorkItemFactoryConfigV1,
} from "./mcft_cap09_production_evidence_work_items_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
  type S3CompatiblePrivateRawRetentionConfigV1,
} from "./s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  PostgresEvidenceProducerLeaseV1,
  PostgresEvidenceSupplyCursorV1,
} from "../persistence/external_evidence/postgres_evidence_runtime_persistence_v1.js";
import {
  PostgresExternalFormalEvidenceVisibilityV1,
} from "../persistence/external_evidence/postgres_external_formal_evidence_visibility_v1.js";
import {
  PostgresEvidenceRuntimeGovernedIngressV1,
} from "../persistence/external_evidence/postgres_evidence_runtime_governed_ingress_v1.js";

export const MCFT_CAP09_EVIDENCE_RUNTIME_COMPOSITION_ID_V1 =
  "MCFT_CAP09_EVIDENCE_RUNTIME_COMPOSITION_V1" as const;

export type EvidenceRuntimeAcquisitionTargetV1 = {
  target_logical_time: string;
  requested_at: string;
  request_id_prefix: string;
};

export interface EvidenceRuntimeAcquisitionTargetPlannerV1 {
  nextTarget(input: {
    cycle_attempt: number;
    successful_cycle_count: number;
    consecutive_failure_count: number;
    previous_result: ExecuteEvidenceRuntimeCycleResultV1 | null;
  }): Promise<EvidenceRuntimeAcquisitionTargetV1 | null>;
}

export type EvidenceRuntimeCompositionV1 = {
  composition_id: typeof MCFT_CAP09_EVIDENCE_RUNTIME_COMPOSITION_ID_V1;
  host: EvidenceRuntimeHostV1;
  work_item_factory: ProductionEvidenceWorkItemFactoryV1;
  retention: S3CompatiblePrivateRawEvidenceRetentionAdapterV1;
  lease_repository: PostgresEvidenceProducerLeaseV1;
};

export function composeEvidenceRuntimeV1(input: {
  pool: Pool;
  scope: EvidenceRuntimeScopeV1;
  raw_retention: S3CompatiblePrivateRawRetentionConfigV1;
  target_planner: EvidenceRuntimeAcquisitionTargetPlannerV1;
  wait: EvidenceRuntimeHostWaitPortV1;
  health: EvidenceRuntimeHostHealthPortV1;
  stop: EvidenceRuntimeHostStopPortV1;
  failure_classifier: EvidenceRuntimeHostFailureClassifierV1;
  completion_clock: () => string;
  work_item_config?: Omit<ProductionEvidenceWorkItemFactoryConfigV1, "retention">;
}): EvidenceRuntimeCompositionV1 {
  const retention = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1(input.raw_retention);
  const leaseRepository = new PostgresEvidenceProducerLeaseV1(input.pool, input.scope);
  const visibility = new PostgresExternalFormalEvidenceVisibilityV1(input.pool);
  const workItemFactory = new ProductionEvidenceWorkItemFactoryV1({
    ...input.work_item_config,
    retention,
  });

  const cycleService = new EvidenceRuntimeCycleServiceV1({
    lease: leaseRepository,
    retention,
    committed_ingress_factory: {
      createForProducerClaim(claim) {
        return new PostgresEvidenceRuntimeGovernedIngressV1(
          input.pool,
          retention,
          input.scope,
          claim,
        );
      },
    },
    visibility,
    cursor_factory: {
      createForProducerClaim(claim) {
        return new PostgresEvidenceSupplyCursorV1(input.pool, input.scope, claim);
      },
    },
    completion_clock: input.completion_clock,
  });

  const planner: EvidenceRuntimeHostPlannerV1 = {
    async nextWorkItems(state) {
      const target = await input.target_planner.nextTarget(state);
      if (target === null) return null;
      return workItemFactory.buildForTarget(target);
    },
  };

  const host = new EvidenceRuntimeHostV1({
    cycle_service: cycleService,
    planner,
    wait: input.wait,
    health: input.health,
    stop: input.stop,
    failure_classifier: input.failure_classifier,
  });

  return {
    composition_id: MCFT_CAP09_EVIDENCE_RUNTIME_COMPOSITION_ID_V1,
    host,
    work_item_factory: workItemFactory,
    retention,
    lease_repository: leaseRepository,
  };
}
