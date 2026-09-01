// MCFT-CAP-09 read-only canonical GFS hourly target-pair history.
// Reads public.facts only. No cursor mutation, provider I/O, RuntimeTickCursor,
// Twin state, environment, wall clock, or production activation.

import type { Pool } from "pg";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_GFS_TARGET_PAIR_HISTORY_READER_ID_V1,
  type GfsCanonicalPartialTargetV1,
  type GfsCanonicalTargetPairHistoryReadPortV1,
  type GfsCanonicalTargetPairHistoryV1,
  type GfsCanonicalTargetPairV1,
} from "../../external_evidence/mcft_cap09_gfs_target_pair_history_v1.js";
import type { EvidenceRuntimeScopeV1 } from "../../external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1 } from "../twin_runtime/postgres_external_formal_evidence_ingress_v1.js";

export const MCFT_CAP09_POSTGRES_GFS_TARGET_PAIR_HISTORY_ID_V1 =
  "MCFT_CAP09_POSTGRES_GFS_TARGET_PAIR_HISTORY_V1" as const;

type PoolV1 = Pick<Pool, "query">;
type RowV1 = { fact_id: string; record_json: unknown };
type ParsedRoleV1 = {
  role: "WEATHER" | "FUTURE_ET0";
  target: string;
  cycle: string;
  fact_id: string;
};
const SCOPE_KEYS = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;

function objectV1(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function textV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}
function hourV1(value: unknown, code: string): string {
  const text=textV1(value,code), parsed=Date.parse(text);
  if(!Number.isFinite(parsed)||new Date(parsed).toISOString()!==text||!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}
function compactHourV1(value:string):string {
  return value.replace(/[-:.]/g,"").replace("000Z","Z").toLowerCase();
}
function exactScopeV1(payload:Record<string,unknown>, scope:EvidenceRuntimeScopeV1):void {
  for(const key of SCOPE_KEYS){
    if(textV1(payload[key],"GFS_TARGET_HISTORY_SCOPE_"+key.toUpperCase()+"_REQUIRED")!==scope[key]){
      throw new Error("GFS_TARGET_HISTORY_SCOPE_MISMATCH:"+key);
    }
  }
}
function parseRoleV1(row:RowV1,scope:EvidenceRuntimeScopeV1):ParsedRoleV1 {
  const envelope=objectV1(typeof row.record_json==="string"?JSON.parse(row.record_json):row.record_json,"GFS_TARGET_HISTORY_ENVELOPE_INVALID");
  const type=textV1(envelope.type,"GFS_TARGET_HISTORY_TYPE_REQUIRED");
  const payload=objectV1(envelope.payload,"GFS_TARGET_HISTORY_PAYLOAD_REQUIRED");
  if(payload.record_type!==type) throw new Error("GFS_TARGET_HISTORY_RECORD_TYPE_MISMATCH");
  exactScopeV1(payload,scope);
  const role=type==="future_weather_assumption_v1"?"WEATHER":type==="future_et0_assumption_v1"?"FUTURE_ET0":null;
  if(!role) throw new Error("GFS_TARGET_HISTORY_TYPE_FORBIDDEN:"+type);
  const expectedBinding=role==="WEATHER"
    ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    : MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  if(payload.binding_id!==expectedBinding) throw new Error("GFS_TARGET_HISTORY_BINDING_MISMATCH:"+role);
  const roleTime=objectV1(payload.role_time,"GFS_TARGET_HISTORY_ROLE_TIME_REQUIRED");
  const target=hourV1(roleTime.valid_from,"GFS_TARGET_HISTORY_VALID_FROM_INVALID");
  const cycle=hourV1(roleTime.issued_at,"GFS_TARGET_HISTORY_ISSUED_AT_INVALID");
  const sourcePayload=objectV1(payload.source_payload,"GFS_TARGET_HISTORY_SOURCE_PAYLOAD_REQUIRED");
  if(sourcePayload.target_logical_time!==target) throw new Error("GFS_TARGET_HISTORY_SOURCE_TARGET_MISMATCH");
  if(sourcePayload.selected_cycle!==cycle) throw new Error("GFS_TARGET_HISTORY_SOURCE_CYCLE_MISMATCH");
  const cycleKey=compactHourV1(cycle), targetKey=compactHourV1(target);
  const expectedOrigin=role==="WEATHER"
    ? "gfs_"+cycleKey+"_pgrb2_0p25_kbs"
    : "gfs_"+cycleKey+"_asce_short_reference_et0_kbs";
  if(payload.origin_source_id!==expectedOrigin) throw new Error("GFS_TARGET_HISTORY_ORIGIN_MISMATCH:"+role);
  const expectedRecord=role==="WEATHER"
    ? "gfs_future_weather_"+cycleKey+"_"+targetKey
    : "gfs_future_et0_"+cycleKey+"_"+targetKey;
  if(payload.source_record_id!==expectedRecord) throw new Error("GFS_TARGET_HISTORY_SOURCE_RECORD_ID_MISMATCH:"+role);
  return {role,target,cycle,fact_id:textV1(row.fact_id,"GFS_TARGET_HISTORY_FACT_ID_REQUIRED")};
}

export class PostgresGfsCanonicalTargetPairHistoryV1 implements GfsCanonicalTargetPairHistoryReadPortV1 {
  readonly persistence_id=MCFT_CAP09_POSTGRES_GFS_TARGET_PAIR_HISTORY_ID_V1;
  constructor(private readonly pool:PoolV1,private readonly configuredScope:EvidenceRuntimeScopeV1){}

  async readGfsTargetPairHistory(input:{
    scope:EvidenceRuntimeScopeV1;
    from_target_logical_time:string;
  }):Promise<GfsCanonicalTargetPairHistoryV1>{
    for(const key of SCOPE_KEYS){
      if(input.scope[key]!==this.configuredScope[key]) throw new Error("GFS_TARGET_HISTORY_CONFIGURED_SCOPE_MISMATCH:"+key);
    }
    const from=hourV1(input.from_target_logical_time,"GFS_TARGET_HISTORY_FROM_TARGET_INVALID");
    const rows=await this.pool.query<RowV1>(
      `SELECT fact_id,record_json
         FROM public.facts
        WHERE source=$1
          AND record_json->>'type'=ANY($2::text[])
          AND record_json#>>'{payload,tenant_id}'=$3
          AND record_json#>>'{payload,project_id}'=$4
          AND record_json#>>'{payload,group_id}'=$5
          AND record_json#>>'{payload,field_id}'=$6
          AND record_json#>>'{payload,season_id}'=$7
          AND record_json#>>'{payload,zone_id}'=$8
        ORDER BY fact_id ASC`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,
        ["future_weather_assumption_v1","future_et0_assumption_v1"],
        ...SCOPE_KEYS.map(key=>this.configuredScope[key]),
      ],
    );
    const grouped=new Map<string,{weather:ParsedRoleV1|null;et0:ParsedRoleV1|null}>();
    for(const row of rows.rows){
      const parsed=parseRoleV1(row,this.configuredScope);
      if(Date.parse(parsed.target)<Date.parse(from)) continue;
      const item=grouped.get(parsed.target)??{weather:null,et0:null};
      if(parsed.role==="WEATHER"){
        if(item.weather) throw new Error("GFS_TARGET_HISTORY_DUPLICATE_WEATHER_TARGET:"+parsed.target);
        item.weather=parsed;
      }else{
        if(item.et0) throw new Error("GFS_TARGET_HISTORY_DUPLICATE_ET0_TARGET:"+parsed.target);
        item.et0=parsed;
      }
      grouped.set(parsed.target,item);
    }

    const pairs:GfsCanonicalTargetPairV1[]=[];
    const partial:GfsCanonicalPartialTargetV1[]=[];
    for(const [target,item] of [...grouped.entries()].sort((a,b)=>Date.parse(a[0])-Date.parse(b[0]))){
      if(item.weather&&item.et0){
        if(item.weather.cycle!==item.et0.cycle) throw new Error("GFS_TARGET_HISTORY_CROSS_CYCLE_PAIR_FORBIDDEN:"+target);
        pairs.push({target_logical_time:target,cycle_issued_at:item.weather.cycle,weather_fact_id:item.weather.fact_id,future_et0_fact_id:item.et0.fact_id});
      }else if(item.weather){
        partial.push({target_logical_time:target,present_role:"WEATHER",cycle_issued_at:item.weather.cycle,fact_id:item.weather.fact_id});
      }else if(item.et0){
        partial.push({target_logical_time:target,present_role:"FUTURE_ET0",cycle_issued_at:item.et0.cycle,fact_id:item.et0.fact_id});
      }
    }
    return {reader_id:MCFT_CAP09_GFS_TARGET_PAIR_HISTORY_READER_ID_V1,pairs,partial_targets:partial,canonical_fact_read_count:rows.rows.length};
  }
}
