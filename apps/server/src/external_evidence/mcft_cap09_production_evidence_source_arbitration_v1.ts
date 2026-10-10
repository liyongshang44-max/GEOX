// MCFT-CAP-09 single-host Evidence source arbitration.
// Operational scheduling only. It does not change provider cadence, target identity,
// canonical semantics, Formal authority, or source scientific meaning.
// Every host attempt is followed by a fresh durable-state replan; no hidden queue exists.
import type { ProductionEvidenceSourceDecisionV1 } from "./mcft_cap09_production_evidence_source_planner_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_ARBITRATION_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_ARBITRATION_V1" as const;
export const MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_ARBITRATION_AUTHORITY_REF_V1 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-SOURCE-ARBITRATION-AUTHORITY-V1.json" as const;

type ActionDecisionV1=Extract<ProductionEvidenceSourceDecisionV1,{status:"ACTION"}>;

function isoV1(value:unknown,code:string):string{
 if(typeof value!=="string"||!value.trim())throw new Error(code);
 const parsed=Date.parse(value);if(!Number.isFinite(parsed)||new Date(parsed).toISOString()!==value)throw new Error(code);
 return value;
}
function requestedAtV1(d:ActionDecisionV1):string{return isoV1(d.operation.requested_at,"PRODUCTION_EVIDENCE_ARBITRATION_REQUESTED_AT_INVALID");}
function classV1(d:ActionDecisionV1):number{
 if(d.source_family==="GFS_BUNDLE")return 0;
 if(d.source_family==="KBS_SOIL")return 1;
 if(d.source_family==="KBS_RAW_HOURLY")return 2;
 const unreachable:never=d.source_family;throw new Error("PRODUCTION_EVIDENCE_ARBITRATION_SOURCE_UNSUPPORTED:"+String(unreachable));
}
function deadlineV1(d:ActionDecisionV1):number{
 if(d.source_family!=="GFS_BUNDLE")return Number.POSITIVE_INFINITY;
 if(d.operation.kind!=="GFS_BUNDLE_ACQUIRE"&&d.operation.kind!=="GFS_PARTIAL_PAIR_REHYDRATE")throw new Error("PRODUCTION_EVIDENCE_ARBITRATION_GFS_OPERATION_INVALID");
 return Date.parse(isoV1(d.operation.due_window_end_exclusive,"PRODUCTION_EVIDENCE_ARBITRATION_GFS_DEADLINE_INVALID"));
}

export function selectNextProductionEvidenceActionV1(
 decisions:readonly ProductionEvidenceSourceDecisionV1[],
):ActionDecisionV1|null{
 const actions=decisions.filter((d):d is ActionDecisionV1=>d.status==="ACTION");
 if(actions.length===0)return null;
 const ranked=[...actions].sort((a,b)=>{
  const c=classV1(a)-classV1(b);if(c!==0)return c;
  const deadline=deadlineV1(a)-deadlineV1(b);if(deadline!==0)return deadline;
  const requested=Date.parse(requestedAtV1(a))-Date.parse(requestedAtV1(b));if(requested!==0)return requested;
  return a.source_family.localeCompare(b.source_family);
 });
 return ranked[0]!;
}
