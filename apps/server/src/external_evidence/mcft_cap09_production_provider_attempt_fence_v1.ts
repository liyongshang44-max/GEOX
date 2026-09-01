// Production binding from already-adjudicated source decisions to durable
// Evidence-plane poll/retry claims. This module does not plan targets or perform provider I/O.
import type { EvidenceRuntimeProviderAttemptFencePortV1 } from "./mcft_cap09_evidence_runtime_provider_attempt_fence_v1.js";
import type { EvidenceSourcePollScheduleClaimPortV1 } from "./mcft_cap09_evidence_source_poll_schedule_v1.js";
import type { GfsRetrySchedulePortV1 } from "./mcft_cap09_gfs_retry_schedule_v1.js";
import type { ProductionEvidenceSourceDecisionV1 } from "./mcft_cap09_production_evidence_source_planner_v1.js";

export const MCFT_CAP09_PRODUCTION_PROVIDER_ATTEMPT_FENCE_FACTORY_ID_V1 =
  "MCFT_CAP09_PRODUCTION_PROVIDER_ATTEMPT_FENCE_FACTORY_V1" as const;

function isoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed=Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString()!==value) throw new Error(code);
  return value;
}

export class ProductionEvidenceProviderAttemptFenceFactoryV1 {
  readonly factory_id=MCFT_CAP09_PRODUCTION_PROVIDER_ATTEMPT_FENCE_FACTORY_ID_V1;
  private readonly activationFenceTime:string;
  constructor(private readonly deps:{
    source_poll_schedule: EvidenceSourcePollScheduleClaimPortV1;
    gfs_retry_schedule: GfsRetrySchedulePortV1;
    activation_fence_time:string;
  }){
    this.activationFenceTime=isoV1(deps.activation_fence_time,"PRODUCTION_PROVIDER_ATTEMPT_FENCE_ACTIVATION_FENCE_INVALID");
  }

  buildForDecision(decision:ProductionEvidenceSourceDecisionV1):EvidenceRuntimeProviderAttemptFencePortV1|null {
    if(decision.status==="NOT_DUE") return null;
    const op=decision.operation;
    if(op.kind==="KBS_RAW_HOURLY_PUBLICATION_CYCLE"||op.kind==="KBS_SOIL_CURRENT_ACQUIRE"){
      const source_family=op.kind==="KBS_RAW_HOURLY_PUBLICATION_CYCLE"?"KBS_RAW_HOURLY" as const:"KBS_SOIL" as const;
      return {claimBeforeProviderFetch:async({claim})=>{
        const r=await this.deps.source_poll_schedule.claimPollBeforeProviderFetch({
          claim,source_family,activation_fence_time:this.activationFenceTime,requested_at:op.requested_at
        });
        return r.status==="CLAIMED"
          ? {status:"AUTHORIZED" as const,durable_coordination_write_count:r.database_write_count}
          : {status:"NOT_DUE" as const,durable_coordination_write_count:0 as const};
      }};
    }
    if(op.kind==="GFS_BUNDLE_ACQUIRE"){
      return {claimBeforeProviderFetch:async({claim})=>{
        const r=await this.deps.gfs_retry_schedule.claimGfsAttemptBeforeProviderFetch({
          claim,target_logical_time:op.target_logical_time,requested_at:op.requested_at,
          due_window_start:op.due_window_start,due_window_end_exclusive:op.due_window_end_exclusive
        });
        if(r.status==="CLAIMED") return {status:"AUTHORIZED" as const,durable_coordination_write_count:r.database_write_count};
        if(r.status==="NOT_DUE") return {status:"NOT_DUE" as const,durable_coordination_write_count:0 as const};
        if(r.status==="ATTEMPT_BUDGET_EXHAUSTED") throw new Error("PRODUCTION_PROVIDER_ATTEMPT_GFS_ATTEMPT_BUDGET_EXHAUSTED:"+op.target_logical_time);
        if(r.status==="MISSED_WINDOW") throw new Error("PRODUCTION_PROVIDER_ATTEMPT_GFS_MISSED_WINDOW:"+op.target_logical_time);
        const unreachable:never=r; throw new Error("PRODUCTION_PROVIDER_ATTEMPT_GFS_FENCE_RESULT_INVALID:"+String(unreachable));
      }};
    }
    if(op.kind==="GFS_PARTIAL_PAIR_REHYDRATE") return null;
    const unreachable:never=op; throw new Error("PRODUCTION_PROVIDER_ATTEMPT_FENCE_OPERATION_UNSUPPORTED:"+String(unreachable));
  }
}
