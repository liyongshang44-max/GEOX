#!/usr/bin/env node
"use strict";

const HOUR=3_600_000;
const STAGE_AUTHORITY_TIME_ZONE="America/Detroit";
const STAGE_AUTHORITY_FORWARD_STABILITY_HOURS=30;
const EPOCH_SELECTION_MODE=
  "CLOCK_ONLY_LIFECYCLE_AND_STAGE_AUTHORITY_CADENCE_BOUNDED_PENDING_POST_ARM_DT02_A18_STAGE_AUTHORITY";

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function iso(ms){return new Date(ms).toISOString();}
function exactIso(value,code){
  const text=String(value??"").trim();
  const ms=Date.parse(text);
  req(text&&Number.isFinite(ms)&&new Date(ms).toISOString()===text,code);
  return text;
}
function ceilHour(ms){return Math.ceil(ms/HOUR)*HOUR;}
function partsAt(ms,timeZone){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone,
    year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",second:"2-digit",
    hourCycle:"h23",
  }).formatToParts(new Date(ms));
  const values=Object.fromEntries(parts.filter((p)=>p.type!=="literal").map((p)=>[p.type,p.value]));
  return {
    year:Number(values.year),month:Number(values.month),day:Number(values.day),
    hour:Number(values.hour),minute:Number(values.minute),second:Number(values.second),
  };
}
function localDateAt(ms,timeZone){
  const p=partsAt(ms,timeZone);
  return `${String(p.year).padStart(4,"0")}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
}
function localMidnightUtc(localDate,timeZone){
  const [year,month,day]=localDate.split("-").map(Number);
  const targetWall=Date.UTC(year,month-1,day,0,0,0);
  let guess=targetWall;
  for(let i=0;i<6;i+=1){
    const p=partsAt(guess,timeZone);
    const representedWall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    const offset=representedWall-guess;
    const next=targetWall-offset;
    if(next===guess)break;
    guess=next;
  }
  const p=partsAt(guess,timeZone);
  req(
    p.year===year&&p.month===month&&p.day===day&&p.hour===0&&p.minute===0&&p.second===0,
    "FORMAL_V5_EPOCH_CLOCK_LOCAL_MIDNIGHT_RESOLUTION_FAILED",
    localDate+":"+iso(guess),
  );
  return guess;
}
function stageAuthorityRefreshClockEligibilityV1(a0Ms,o23Ms){
  const localDate=localDateAt(a0Ms,STAGE_AUTHORITY_TIME_ZONE);
  const snapshotBoundaryMs=localMidnightUtc(localDate,STAGE_AUTHORITY_TIME_ZONE);
  const snapshotValidUntilMs=snapshotBoundaryMs+STAGE_AUTHORITY_FORWARD_STABILITY_HOURS*HOUR;
  return {
    eligible:snapshotBoundaryMs<a0Ms&&snapshotValidUntilMs>=o23Ms,
    time_zone:STAGE_AUTHORITY_TIME_ZONE,
    local_date:localDate,
    snapshot_boundary_utc:iso(snapshotBoundaryMs),
    snapshot_valid_until_utc:iso(snapshotValidUntilMs),
    snapshot_boundary_strictly_before_a0:snapshotBoundaryMs<a0Ms,
    snapshot_validity_covers_o23:snapshotValidUntilMs>=o23Ms,
    stage_value_consulted:false,
    authority_identity_frozen:false,
  };
}
function selectFormalV5EpochClockV1(input){
  const planningTime=exactIso(input?.planning_time_utc,"FORMAL_V5_EPOCH_CLOCK_PLANNING_TIME_INVALID");
  const horizonText=exactIso(input?.lifecycle_horizon_end_utc,"FORMAL_V5_EPOCH_CLOCK_LIFECYCLE_HORIZON_INVALID");
  const planningMs=Date.parse(planningTime);
  const horizon=Date.parse(horizonText);
  const first=ceilHour(planningMs+36*HOUR);
  let scanned=0;
  let firstRejected=null;
  for(let candidate=first;candidate+23*HOUR<=horizon;candidate+=HOUR){
    const a0=candidate-HOUR;
    const o23=candidate+23*HOUR;
    const cadence=stageAuthorityRefreshClockEligibilityV1(a0,o23);
    scanned+=1;
    if(!cadence.eligible){
      if(!firstRejected)firstRejected={
        candidate_o00:iso(candidate),a0:iso(a0),o23:iso(o23),cadence,
      };
      continue;
    }
    return {
      planning_time_utc:planningTime,
      lifecycle_horizon_end_utc:horizonText,
      o00:iso(candidate),
      o23:iso(o23),
      a0:iso(a0),
      readiness_deadline:iso(candidate-12*HOUR),
      minimum_governance_lead_hours:36,
      epoch_selection_mode:EPOCH_SELECTION_MODE,
      stage_authority_refresh_clock_eligibility:cadence,
      scanned_candidate_hour_count:scanned,
    };
  }
  fail(
    "FORMAL_V5_EPOCH_CLOCK_NO_AUTHORITY_CADENCE_COMPATIBLE_WINDOW_BEFORE_LIFECYCLE_HORIZON",
    JSON.stringify({
      first_candidate_o00:iso(first),
      lifecycle_horizon:horizonText,
      first_rejected:firstRejected,
      scanned_candidate_hour_count:scanned,
    }),
  );
}

module.exports=Object.freeze({
  HOUR,
  STAGE_AUTHORITY_TIME_ZONE,
  STAGE_AUTHORITY_FORWARD_STABILITY_HOURS,
  EPOCH_SELECTION_MODE,
  selectFormalV5EpochClockV1,
  stageAuthorityRefreshClockEligibilityV1,
});
