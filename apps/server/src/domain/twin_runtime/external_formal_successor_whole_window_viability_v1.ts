export const MCFT_CAP09_SUCCESSOR_VIABILITY_PROFILE_V1 = {
  schema_version: "geox_mcft_cap09_successor_whole_window_viability_v1",
  planting_window_start_inclusive: "2026-05-11T04:00:00.000Z",
  planting_window_end_exclusive: "2026-05-12T04:00:00.000Z",
  variant_stage_lengths_days: [[30,50,60,40],[25,40,45,30],[20,35,40,30],[20,35,40,30],[30,40,50,30],[30,40,50,50]],
  allowed_stage_codes: ["INITIAL","DEVELOPMENT","MID","LATE"],
  backward_stability_hours: 6,
  forward_transition_guard_hours: 30,
  exact_slot_count: 24,
  minimum_lead_hours: 36,
  ea5e3_readiness_offset_hours: -12,
  amendment08_effective_at: "2026-08-11T02:33:13.000Z",
  future_observations_authorized: false,
} as const;

export type CropStageCodeV1 = "INITIAL"|"DEVELOPMENT"|"MID"|"LATE";
export type SlotViabilityV1 = { logical_time:string; status:"PASS"|"FAIL"; stage:CropStageCodeV1|null; reason:string|null };
export type WholeWindowCandidateV1 = { o00:string; o23:string; stage:CropStageCodeV1; latest_selection_effectiveness_time:string };
export type SuccessorWholeWindowScanResultV1 = {
  profile_id:"MCFT_CAP09_SUCCESSOR_WHOLE_WINDOW_VIABILITY_V1";
  latest_complete_current_season_candidate:WholeWindowCandidateV1|null;
  amendment08_effective_at:string;
  amendment08_after_latest_selection_deadline:boolean;
  current_season_successor_epoch_eligible_after_amendment08:boolean;
  expected_result:"NO_CURRENT_SEASON_SUCCESSOR_EPOCH";
  future_observations_used:false;
};

const HOUR=3_600_000;
function iso(ms:number):string{return new Date(ms).toISOString();}
function stageAtAgeHours(age:number,lengths:readonly number[]):CropStageCodeV1|null{
  if(age<0)return null;
  const names:CropStageCodeV1[]=["INITIAL","DEVELOPMENT","MID","LATE"];
  let cumulative=0;
  for(let i=0;i<4;i+=1){cumulative+=lengths[i]! * 24;if(age < cumulative)return names[i]!;}
  return null;
}
export function evaluateSuccessorSlotV1(logicalTime:string):SlotViabilityV1{
  const p=MCFT_CAP09_SUCCESSOR_VIABILITY_PROFILE_V1;
  const t=Date.parse(logicalTime);if(!Number.isFinite(t)||t%HOUR!==0||iso(t)!==logicalTime)throw new Error("SUCCESSOR_SLOT_EXACT_UTC_HOUR_REQUIRED");
  const plantingStart=Date.parse(p.planting_window_start_inclusive), plantingEnd=Date.parse(p.planting_window_end_exclusive);
  const guardedStart=t-p.backward_stability_hours*HOUR, guardedEnd=t+p.forward_transition_guard_hours*HOUR;
  // Conservative closure: latest possible planting approaches end_exclusive; T+30h is inclusive for transition-risk rejection.
  const minAge=(guardedStart-plantingEnd)/HOUR, maxAge=(guardedEnd-plantingStart)/HOUR;
  const stages:CropStageCodeV1[]=[];
  for(const variant of p.variant_stage_lengths_days){
    const a=stageAtAgeHours(minAge,variant), b=stageAtAgeHours(maxAge,variant);
    if(a===null||b===null||a!==b)return {logical_time:logicalTime,status:"FAIL",stage:null,reason:"STAGE_TRANSITION_RISK"};
    stages.push(a);
  }
  if(new Set(stages).size!==1)return {logical_time:logicalTime,status:"FAIL",stage:null,reason:"CROP_WATER_USE_STAGE_NO_CONSERVATIVE_CONSENSUS"};
  return {logical_time:logicalTime,status:"PASS",stage:stages[0]!,reason:null};
}
export function scanSuccessorWholeWindowV1():SuccessorWholeWindowScanResultV1{
  const p=MCFT_CAP09_SUCCESSOR_VIABILITY_PROFILE_V1;
  const plantingStart=Date.parse(p.planting_window_start_inclusive);
  const maxSeasonHours=Math.max(...p.variant_stage_lengths_days.map(v=>v.reduce((a,b)=>a+b,0)))*24;
  const scanEnd=plantingStart+maxSeasonHours*HOUR;
  let latest:WholeWindowCandidateV1|null=null;
  for(let start=Math.ceil(plantingStart/HOUR)*HOUR;start<=scanEnd;start+=HOUR){
    const slots=Array.from({length:p.exact_slot_count},(_,i)=>evaluateSuccessorSlotV1(iso(start+i*HOUR)));
    if(slots.every(s=>s.status==="PASS") && new Set(slots.map(s=>s.stage)).size===1){
      latest={o00:iso(start),o23:iso(start+23*HOUR),stage:slots[0]!.stage!,latest_selection_effectiveness_time:iso(start-p.minimum_lead_hours*HOUR)};
    }
  }
  if(!latest)throw new Error("SUCCESSOR_WHOLE_WINDOW_EXPECTED_CURRENT_SEASON_CANDIDATE_MISSING");
  const amendment08=Date.parse(p.amendment08_effective_at), deadline=Date.parse(latest.latest_selection_effectiveness_time);
  return {profile_id:"MCFT_CAP09_SUCCESSOR_WHOLE_WINDOW_VIABILITY_V1",latest_complete_current_season_candidate:latest,amendment08_effective_at:p.amendment08_effective_at,amendment08_after_latest_selection_deadline:amendment08>deadline,current_season_successor_epoch_eligible_after_amendment08:false,expected_result:"NO_CURRENT_SEASON_SUCCESSOR_EPOCH",future_observations_used:false};
}
