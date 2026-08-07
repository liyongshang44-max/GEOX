// MCFT-CAP-09.S5: bind one Shadow-online scheduler claim to the unchanged CAP-04/CAP-05 canonical Runtime.
// H is read-only evidence for eligible C; no G, action, route, daemon, model activation, or new transaction family.
import type { Pool } from "pg";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP05_RUNTIME_CONFIG_PURPOSE_V1 } from "../../domain/twin_runtime/feedback_runtime_config_v1.js";
import { DirectCap04ExecutionConfigResolverV1 } from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresForecastResidualSourceV1 } from "../../persistence/twin_runtime/postgres_forecast_residual_source_v1.js";
import { Cap08FrozenEvidenceSourceV1 } from "./cap08_frozen_evidence_source_v1.js";
import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "./cap05_inherited_cap04_execution_config_resolver_v1.js";
import {
  Cap05ForecastResidualOutcomeTickServiceV1,
  type Cap05ForecastResidualHistoricalSourcePortV1,
  type Cap05ForecastResidualPersistencePortV1,
  type Cap05ForecastResidualTickExecutionPortV1,
} from "./forecast_residual_outcome_tick_service_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
  type ExecuteCap04SingleTickInputV1,
  type ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import { PostgresFrozenShadowOnlineEvidenceSourceV1 } from "./postgres_frozen_shadow_online_evidence_source_v1.js";
import { PostgresReadOnlyExecutionEvidenceAdapterV1 } from "./postgres_read_only_execution_evidence_adapter_v1.js";
import type {
  ExecutionFeedbackPortV1, FrozenShadowOnlineEvidenceV1, RuntimeConfigRepositoryPortV1,
  RuntimeLeaseClaimV1, ShadowOnlineSlotClaimV1, TwinScopeKeyV1,
} from "./ports.js";

const SF = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
type ScopeComparableV1 = {
  tenant_id: unknown; project_id: unknown; group_id: unknown;
  field_id: unknown; season_id: unknown; zone_id: unknown;
};
function scope(a:ScopeComparableV1,b:TwinScopeKeyV1,code:string):void {
  if (!SF.every((k)=>a[k]===b[k])) throw new Error(code);
}
function member(ms:readonly CanonicalObjectEnvelopeV1[],type:CanonicalObjectEnvelopeV1["object_type"]):CanonicalObjectEnvelopeV1 {
  const found=ms.filter((m)=>m.object_type===type);
  if(found.length!==1) throw new Error(`S5_CANONICAL_MEMBER_CARDINALITY:${type}`);
  return found[0];
}
function claimPersistence(c:Cap04SingleTickPersistencePortV1,claim:ShadowOnlineSlotClaimV1):Cap04SingleTickPersistencePortV1 {
  return {
    acquireLease:async (requested:Omit<RuntimeLeaseClaimV1,"fencing_token">)=>{
      scope(requested,claim.boundary.scope,"S5_CANONICAL_LEASE_SCOPE_MISMATCH");
      if(requested.lease_owner!==claim.lease_owner) throw new Error("S5_CANONICAL_LEASE_OWNER_MUST_EQUAL_SCHEDULER_CLAIM");
      return {...requested,fencing_token:claim.fencing_token};
    },
    lookupARecordSet:c.lookupARecordSet.bind(c), commitARecordSet:c.commitARecordSet.bind(c),
    readARecordSet:c.readARecordSet.bind(c), lookupScenarioSet:c.lookupScenarioSet.bind(c),
    commitScenarioSet:c.commitScenarioSet.bind(c), readScenarioSet:c.readScenarioSet.bind(c),
    readScenarioSetBySourceForecast:c.readScenarioSetBySourceForecast.bind(c),
    detectPendingScenario:c.detectPendingScenario.bind(c),
    rebuildForecastProjections:c.rebuildForecastProjections.bind(c),
    rebuildScenarioProjections:c.rebuildScenarioProjections.bind(c),
  };
}
function fixedTick(expected:ExecuteCap04SingleTickInputV1,result:ExecuteCap04SingleTickResultV1):Cap05ForecastResidualTickExecutionPortV1 {
  return {executeOneTick:async(input)=>{
    scope(input.scope,expected.scope,"S5_C_RESIDUAL_TICK_SCOPE_MISMATCH");
    for(const k of ["logical_time","runtime_config_ref","runtime_config_hash","lease_owner"] as const)
      if(input[k]!==expected[k]) throw new Error(`S5_C_RESIDUAL_TICK_INPUT_MISMATCH:${k}`);
    return result;
  }};
}

export type ExecuteShadowOnlineCanonicalTickInputV1={
  claim:ShadowOnlineSlotClaimV1; evidence:FrozenShadowOnlineEvidenceV1; canonical_input:ExecuteCap04SingleTickInputV1;
};
export type ExecuteShadowOnlineCanonicalTickResultV1={
  status:ExecuteCap04SingleTickResultV1["status"]; forecast_status:"COMPLETED"|"BLOCKED";
  tick_ref:string; health_ref:string; canonical_transaction_families:readonly("A"|"B"|"C"|"F")[];
  [key:string]:unknown;
};
export interface ShadowOnlineCanonicalTickPortV1 {
  executeOneTick(input:ExecuteShadowOnlineCanonicalTickInputV1):Promise<ExecuteShadowOnlineCanonicalTickResultV1>;
}

export class PostgresCap04ShadowOnlineCanonicalTickAdapterV1 implements ShadowOnlineCanonicalTickPortV1 {
  private readonly executionFeedback:ExecutionFeedbackPortV1;
  constructor(
    private readonly pool:Pool,
    private readonly handoff:PrepareNextTickInputServiceV1,
    private readonly runtimeConfig:RuntimeConfigRepositoryPortV1,
    private readonly canonicalPersistence:Cap04SingleTickPersistencePortV1,
    private readonly residualHistoricalSource?:Cap05ForecastResidualHistoricalSourcePortV1,
    private readonly residualPersistence?:Cap05ForecastResidualPersistencePortV1,
    executionFeedback?:ExecutionFeedbackPortV1,
  ) {
    if((residualHistoricalSource===undefined)!==(residualPersistence===undefined))
      throw new Error("S5_RESIDUAL_PORT_OVERRIDE_PAIR_REQUIRED");
    this.executionFeedback=executionFeedback??new PostgresReadOnlyExecutionEvidenceAdapterV1(pool);
  }

  async executeOneTick(input:ExecuteShadowOnlineCanonicalTickInputV1):Promise<ExecuteShadowOnlineCanonicalTickResultV1> {
    const {claim,evidence,canonical_input:ci}=input;
    scope(ci.scope,claim.boundary.scope,"S5_CANONICAL_INPUT_SCOPE_MISMATCH");
    if(ci.logical_time!==claim.boundary.logical_time) throw new Error("S5_CANONICAL_INPUT_LOGICAL_TIME_MISMATCH");
    if(ci.lease_owner!==claim.lease_owner) throw new Error("S5_CANONICAL_INPUT_LEASE_OWNER_MISMATCH");
    scope(evidence.boundary.scope,claim.boundary.scope,"S5_FROZEN_EVIDENCE_SCOPE_MISMATCH");
    if(evidence.boundary.logical_time!==claim.boundary.logical_time) throw new Error("S5_FROZEN_EVIDENCE_BOUNDARY_MISMATCH");

    const selected=new PostgresFrozenShadowOnlineEvidenceSourceV1(this.pool,evidence);
    const frozen=new Cap08FrozenEvidenceSourceV1(selected);
    await frozen.freeze({scope:claim.boundary.scope,logical_time:claim.boundary.logical_time});
    const config=await this.runtimeConfig.readRuntimeConfig(ci.runtime_config_ref);
    if(!config||config.object_type!=="twin_runtime_config_v1"||config.determinism_hash!==ci.runtime_config_hash)
      throw new Error("S5_CANONICAL_RUNTIME_CONFIG_MISMATCH");
    scope(config,claim.boundary.scope,"S5_CANONICAL_RUNTIME_CONFIG_SCOPE_MISMATCH");
    const cap05=config.payload.config_purpose===CAP05_RUNTIME_CONFIG_PURPOSE_V1;
    const resolver=cap05?new Cap05InheritedCap04ExecutionConfigResolverV1():new DirectCap04ExecutionConfigResolverV1();
    const service=new Cap04ForecastScenarioSingleTickServiceV1(
      this.handoff,frozen,this.runtimeConfig,claimPersistence(this.canonicalPersistence,claim),resolver,
    );
    const result=await service.executeOneTick(ci);
    if(frozen.getSourceLoadCount()!==1) throw new Error("S5_EXACT_ONE_FROZEN_EVIDENCE_SOURCE_LOAD_REQUIRED");

    const ms=result.a_record_set.members;
    const tick=member(ms,"twin_runtime_tick_v1"),state=member(ms,"twin_state_estimate_v1");
    const forecast=member(ms,"twin_forecast_run_v1"),health=member(ms,"twin_runtime_health_v1");
    const checkpoint=member(ms,"twin_runtime_checkpoint_v1");
    const fs=String(forecast.payload.status);
    if(fs!=="COMPLETED"&&fs!=="BLOCKED") throw new Error("S5_CANONICAL_FORECAST_TERMINAL_STATUS_REQUIRED");
    const points=Array.isArray(forecast.payload.points)?forecast.payload.points.length:0;
    if((fs==="COMPLETED"&&points!==72)||(fs==="BLOCKED"&&points!==0))
      throw new Error("S5_CANONICAL_FORECAST_POINT_CARDINALITY_MISMATCH");
    const scenario=result.b_record?.scenario_set??null;
    const options=scenario?.payload.options??[];
    const scenarioPoints=options.reduce((n,o)=>n+o.trajectory_points.length,0);
    if((fs==="COMPLETED"&&(options.length!==3||options.some((o)=>o.trajectory_points.length!==72)))||(fs==="BLOCKED"&&scenario!==null))
      throw new Error("S5_CANONICAL_SCENARIO_ELIGIBILITY_MISMATCH");

    let attempted=false,count:0|1=0,ref:string|null=null;
    let disposition="RUNTIME_CONFIG_NOT_CAP05",h=false,hrefs:string[]=[];
    if(fs==="BLOCKED"&&cap05) disposition="FORECAST_BLOCKED";
    if(fs==="COMPLETED"&&cap05){
      attempted=true;
      const existing=await this.executionFeedback.readExistingExecutionEvidence({scope:claim.boundary.scope,boundary:claim.boundary});
      const trusted=new Map(existing.map((e)=>[e.evidence_ref,e] as const));
      const residual=new Cap05ForecastResidualOutcomeTickServiceV1(
        fixedTick(ci,result),this.runtimeConfig,
        this.residualHistoricalSource??new PostgresForecastResidualSourceV1(this.pool),
        this.residualPersistence??new PostgresFeedbackPersistenceRepositoryV1(this.pool),
      );
      try{
        const out=await residual.executeOneTickAndCommitResidual(ci);
        const selectedTrace=out.forecast_selection_trace.entries.find((e)=>e.disposition==="SELECTED");
        const refs=selectedTrace?.source_posterior_action_feedback_refs??[];
        if(!refs.length) throw new Error("S5_C_RESIDUAL_SELECTED_H_REFERENCE_REQUIRED");
        for(const r of refs) if(trusted.get(r)?.trustworthy!==true) throw new Error(`S5_C_RESIDUAL_TRUSTWORTHY_H_REQUIRED:${r}`);
        h=true; hrefs=[...new Set(refs)].sort(); count=1; ref=out.residual.object_id; disposition="COMMITTED";
      }catch(error){
        if((error instanceof Error?error.message:String(error))==="CAP05_FORECAST_RESIDUAL_MATCH_NOT_FOUND")
          disposition="NO_ELIGIBLE_HISTORICAL_FORECAST";
        else throw error;
      }
    }
    return {
      status:result.status, canonical_transaction_families:count?["A","B","C","F"]:["A","B","F"],
      tick_ref:tick.object_id,state_ref:state.object_id,forecast_ref:forecast.object_id,forecast_status:fs,
      forecast_point_count:points,scenario_ref:scenario?.object_id??null,scenario_option_count:options.length,
      scenario_point_count:scenarioPoints,health_ref:health.object_id,checkpoint_ref:checkpoint.object_id,
      next_logical_tick_time:result.next_handoff.next_logical_tick_time,scheduler_fencing_token:claim.fencing_token.toString(),
      frozen_evidence_refs:[...new Set(evidence.selected.map((e)=>e.evidence_ref))].sort(),
      h_read_only_consumed:h,h_read_only_refs:hrefs,g_write_count: 0,c_residual_attempted:attempted,
      c_residual_count:count,c_residual_ref:ref,c_residual_disposition:disposition,
      recommendation_count:0,approval_count:0,ao_act_count:0,dispatch_count:0,model_activation_count:0,
    };
  }
}
