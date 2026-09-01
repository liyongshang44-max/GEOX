// MCFT-CAP-09 compiled production Evidence host planner core.
// Reads only explicit runtime-start authority + Evidence-plane durable read ports,
// invokes pure source policies/arbitration, and returns one existing host attempt plan.
// No provider I/O, cursor mutation, RuntimeTickCursor, environment, process start, or owner activation.

import type { EvidenceRuntimeHostPlannerV1 } from "./mcft_cap09_evidence_runtime_host_v1.js";
import type { EvidenceRuntimeScopeV1 } from "./mcft_cap09_evidence_runtime_persistence_v1.js";
import type { EvidenceSourceSpecificProgressReaderV1 } from "./mcft_cap09_evidence_source_progress_v1.js";
import type { EvidenceSourcePollScheduleReadPortV1 } from "./mcft_cap09_evidence_source_poll_schedule_v1.js";
import {
  MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1,
  materializeProductionEvidenceAcquisitionHorizonV1,
} from "./mcft_cap09_production_evidence_acquisition_horizon_v1.js";
import { evaluateProductionEvidenceSourceDueV1 } from "./mcft_cap09_production_evidence_source_due_policy_v1.js";
import { evaluateProductionGfsTargetDueV1 } from "./mcft_cap09_production_gfs_target_due_policy_v1.js";
import { planProductionEvidenceSourcesV1, type ProductionEvidenceGfsDueStateV1 } from "./mcft_cap09_production_evidence_source_planner_v1.js";
import { selectNextProductionEvidenceActionV1 } from "./mcft_cap09_production_evidence_source_arbitration_v1.js";
import type { ProductionEvidenceSourcePlanExecutorV1 } from "./mcft_cap09_production_evidence_source_plan_executor_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_HOST_PLANNER_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_HOST_PLANNER_V1" as const;

export type ProductionEvidenceRuntimeStartAuthorityInstanceV1 = {
  authority_class: typeof MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1;
  authority_ref: string;
  activation_fence_time: string;
  formal_a0_authority_ref: string;
  formal_a0_logical_time: string;
};

export interface ProductionEvidencePlanningClockV1 { now(): string }

function textV1(v:unknown,code:string):string{if(typeof v!=="string"||!v.trim())throw new Error(code);return v.trim();}
function isoV1(v:unknown,code:string):string{const x=textV1(v,code),p=Date.parse(x);if(!Number.isFinite(p)||new Date(p).toISOString()!==x)throw new Error(code);return x;}
function hourV1(v:unknown,code:string):string{const x=isoV1(v,code);if(!x.endsWith(":00:00.000Z"))throw new Error(code);return x;}

export class ProductionEvidenceHostPlannerV1 implements EvidenceRuntimeHostPlannerV1 {
  readonly planner_id=MCFT_CAP09_PRODUCTION_EVIDENCE_HOST_PLANNER_ID_V1;
  private readonly horizon;
  private readonly formalA0:string;

  constructor(private readonly deps:{
    scope:EvidenceRuntimeScopeV1;
    runtime_start_authority:ProductionEvidenceRuntimeStartAuthorityInstanceV1;
    planning_clock:ProductionEvidencePlanningClockV1;
    progress_reader:Pick<EvidenceSourceSpecificProgressReaderV1,"readProgress">;
    source_poll_schedule:EvidenceSourcePollScheduleReadPortV1;
    source_plan_executor:Pick<ProductionEvidenceSourcePlanExecutorV1,"buildAttempt">;
  }){
    const a=deps.runtime_start_authority;
    if(a.authority_class!==MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY_CLASS_V1)throw new Error("PRODUCTION_EVIDENCE_HOST_PLANNER_RUNTIME_START_AUTHORITY_CLASS_INVALID");
    textV1(a.formal_a0_authority_ref,"PRODUCTION_EVIDENCE_HOST_PLANNER_FORMAL_A0_AUTHORITY_REF_REQUIRED");
    this.formalA0=hourV1(a.formal_a0_logical_time,"PRODUCTION_EVIDENCE_HOST_PLANNER_FORMAL_A0_INVALID");
    this.horizon=materializeProductionEvidenceAcquisitionHorizonV1({
      authority_class:a.authority_class,
      authority_ref:textV1(a.authority_ref,"PRODUCTION_EVIDENCE_HOST_PLANNER_RUNTIME_START_AUTHORITY_REF_REQUIRED"),
      activation_fence_time:isoV1(a.activation_fence_time,"PRODUCTION_EVIDENCE_HOST_PLANNER_ACTIVATION_FENCE_INVALID"),
    });
    if(Date.parse(this.horizon.activation_fence_time)>=Date.parse(this.formalA0))throw new Error("PRODUCTION_EVIDENCE_HOST_PLANNER_ACTIVATION_FENCE_MUST_PRECEDE_A0");
  }

  async nextAttemptPlan():ReturnType<EvidenceRuntimeHostPlannerV1["nextAttemptPlan"]>{
    const planningTime=isoV1(this.deps.planning_clock.now(),"PRODUCTION_EVIDENCE_HOST_PLANNER_CLOCK_INVALID");
    const [progress,rawSchedule,soilSchedule]=await Promise.all([
      this.deps.progress_reader.readProgress({scope:this.deps.scope}),
      this.deps.source_poll_schedule.readSourcePollSchedule({scope:this.deps.scope,source_family:"KBS_RAW_HOURLY"}),
      this.deps.source_poll_schedule.readSourcePollSchedule({scope:this.deps.scope,source_family:"KBS_SOIL"}),
    ]);
    const rawDue=evaluateProductionEvidenceSourceDueV1({source_family:"KBS_RAW_HOURLY",planning_time:planningTime,activation_fence_time:this.horizon.activation_fence_time,schedule:rawSchedule});
    const soilDue=evaluateProductionEvidenceSourceDueV1({source_family:"KBS_SOIL",planning_time:planningTime,activation_fence_time:this.horizon.activation_fence_time,schedule:soilSchedule});
    const gfs=evaluateProductionGfsTargetDueV1({
      planning_time:planningTime,
      activation_fence_time:this.horizon.activation_fence_time,
      formal_a0_logical_time:this.formalA0,
      durable_paired_targets:progress.gfs_bundle.cycles
        .filter(c=>c.state==="PAIRED"&&c.paired_valid_from!==null)
        .map(c=>({paired_valid_from:c.paired_valid_from!})),
    });
    if(gfs.status==="MISSED_WINDOW")throw new Error("PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW:"+gfs.target_logical_time);
    const gfsDue:ProductionEvidenceGfsDueStateV1=gfs.status==="DUE"
      ? {status:"DUE",authority_ref:gfs.authority_ref,evaluated_at:planningTime,requested_at:gfs.requested_at,target_logical_time:gfs.target_logical_time,due_window_start:gfs.due_window_start,due_window_end_exclusive:gfs.due_window_end_exclusive,max_attempts_per_target_window:gfs.max_attempts_per_target_window,retry_minimum_interval_seconds:gfs.retry_minimum_interval_seconds}
      : {status:"NOT_DUE",authority_ref:gfs.authority_ref,evaluated_at:planningTime};

    const sourcePlan=planProductionEvidenceSourcesV1({
      planning_time:planningTime,horizon:this.horizon,progress,
      due_state:{kbs_raw_hourly:rawDue,gfs_bundle:gfsDue,kbs_soil:soilDue},
    });
    const selected=selectNextProductionEvidenceActionV1(sourcePlan.decisions);
    if(!selected){
      if(sourcePlan.action_count!==0)throw new Error("PRODUCTION_EVIDENCE_HOST_PLANNER_ARBITRATION_DROPPED_ACTION");
      return {status:"NOT_DUE"};
    }
    const attempt=this.deps.source_plan_executor.buildAttempt(selected);
    if(!attempt)throw new Error("PRODUCTION_EVIDENCE_HOST_PLANNER_SELECTED_ACTION_NOT_EXECUTABLE");
    return attempt;
  }
}
