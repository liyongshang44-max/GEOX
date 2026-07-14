// apps/server/src/runtime/twin_runtime/approved_plan_binding_service_v1.ts
// Purpose: expose the bounded internal MCFT-CAP-05 operation that validates and materializes Decision → Approval Assertion → Approved Plan binding from exact persisted refs/hashes.
// Boundary: internal Replay Runtime service only; no public route, Evidence creation, approval exercise, canonical fact write, dispatch, Action Feedback, State mutation, clock, filesystem, environment or network authority.

import type { Pool } from "pg";
import {
  PostgresApprovedPlanBindingRepositoryV1,
  type Cap05ApprovedPlanBindingPersistenceResultV1,
  type Cap05ApprovedPlanBindingRecoverySummaryV1,
} from "../../persistence/twin_runtime/postgres_approved_plan_binding_repository_v1.js";

export const CAP05_APPROVED_PLAN_BINDING_SERVICE_ID_V1 =
  "MCFT_CAP_05_DECISION_APPROVAL_PLAN_BINDING_SERVICE_V1" as const;

export type BindCap05ApprovedPlanInputV1 = {
  decision_ref: string;
  decision_hash: string;
  approval_assertion_ref: string;
  approval_assertion_hash: string;
  approved_plan_ref: string;
  approved_plan_hash: string;
  as_of: string;
};

export type BindCap05ApprovedPlanResultV1 = Cap05ApprovedPlanBindingPersistenceResultV1 & {
  service_id: typeof CAP05_APPROVED_PLAN_BINDING_SERVICE_ID_V1;
};

export class Cap05ApprovedPlanBindingServiceV1 {
  private readonly repository: PostgresApprovedPlanBindingRepositoryV1;

  constructor(pool: Pool) {
    this.repository = new PostgresApprovedPlanBindingRepositoryV1(pool);
  }

  async bindApprovedPlan(input: BindCap05ApprovedPlanInputV1): Promise<BindCap05ApprovedPlanResultV1> {
    const result = await this.repository.bindApprovedPlan(input);
    return { ...result, service_id: CAP05_APPROVED_PLAN_BINDING_SERVICE_ID_V1 };
  }

  async rebuildBindings(): Promise<Cap05ApprovedPlanBindingRecoverySummaryV1> {
    return this.repository.rebuildAllBindings();
  }
}
