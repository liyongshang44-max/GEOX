"use strict";
const { validateQualifiedEnvelope } = require("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const HOUR = 3600000;
const SCOPE = Object.freeze({tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_public_research",field_id:"field_kbs_mcse_t4r1",season_id:"season_2026_corn",zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1"});
const req = (ok, code) => { if (!ok) throw new Error("AM22_CLOCK_" + code); };
function selectClock(input) {
  const now = Date.parse(input.database_now_utc);
  req(Number.isFinite(now) && new Date(now).toISOString() === input.database_now_utc, "DATABASE_TIME_REQUIRED");
  const budget = validateQualifiedEnvelope(input.preparation_envelope, input.binding, now);
  const stage = input.current_crop_authority;
  req(stage?.status === "PASS" && stage.architecture_effective === true && stage.runtime_consumption_authorized === true, "EFFECTIVE_STAGE_REQUIRED");
  for (const [key,value] of Object.entries(SCOPE)) req(stage.scope?.[key] === value, "EXACT_SCOPE_REQUIRED_" + key);
  const life = stage.lifecycle;
  req(life?.domain_state === "ACTIVE" && life.authority_status === "RESOLVED" && life.authority_validity === "VALID" && life.authority_mode === "GOVERNED_PERSISTENT_STATE" && life.active_consumable_candidate === true, "INDEPENDENT_LIFECYCLE_REQUIRED");
  req(stage.crop_water_use_stage === "LATE" && stage.crop_model_parameter?.value === 0.6 && ["R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE","R6_OR_LATER_MODEL_ESTIMATE"].includes(stage.biological_stage?.resolved_biological_stage), "R6_CONSUMER_BINDING_REQUIRED");
  const asOf = Date.parse(stage.biological_stage.authority_as_of);
  const until = Date.parse(stage.biological_stage.authority_valid_until);
  req(until - asOf === 30 * HOUR && stage.biological_stage.forward_stability_hours === 30, "QUALIFIED_STAGE_VALIDITY_REQUIRED");
  req(asOf <= now && Date.parse(stage.graduation?.graduated_at) <= now && until > now, "STAGE_FUTURE_OR_STALE");
  const a0 = Math.ceil((now + budget) / HOUR) * HOUR;
  const o00 = a0 + HOUR, o23 = o00 + 23 * HOUR;
  req(until >= o23, "CURRENT_STAGE_DOES_NOT_COVER_A0_O23");
  req(Date.parse(life.horizon_end_utc) >= o23, "LIFECYCLE_DOES_NOT_COVER_O23");
  return Object.freeze({schema_version:"geox_mcft_cap09_am22_evidence_clock_v2",status:"WINDOW_SELECTED_NOT_ARMED",database_now_utc:input.database_now_utc,a0:new Date(a0).toISOString(),o00:new Date(o00).toISOString(),o23:new Date(o23).toISOString(),pre_a0_budget_ms:budget,readiness_deadline:new Date(a0).toISOString(),fixed_36_hour_lead_used:false,o00_minus_12_hour_deadline_used:false,required_slot_count:24,future_stage_pin_used:false,fresh_prewrite_reverification_required:true,production_start_authorized:false,formal_v5_arm:false,a0_execution:false,mcft_cap09_completed:false});
}
module.exports = { SCOPE, selectClock };
if (require.main === module) { console.error("AM22_CLOCK_REQUIRES_VERIFIED_ADMISSION_DRIVER"); process.exitCode = 2; }
