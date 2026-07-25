// Purpose: deterministic MCFT-CAP-08.S4 append-forward identity and authority contracts.
// Boundary: pure contracts/validation only; no persistence, projection, clock, route, scheduler, Residual, Calibration, Shadow, or production authority.

import { deriveSemanticObjectIdV1, semanticHashV1 } from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { Cap04ScenarioSetEnvelopeV1 } from "./forecast_scenario_contracts_v1.js";
import { validateCap04CanonicalEnvelopeV1 } from "./forecast_scenario_record_set_validator_v1.js";
import type { Cap08S4LateCorrectionAppliedV1, Cap08S4LateCorrectionInputV1 } from "./cap08_s4_late_correction_math_v1.js";

export const CAP08_S4_CONTRACT_ID_V1 = "MCFT-CAP-08.S4-LATE-EVIDENCE-APPEND-FORWARD-V1" as const;
export const CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1 = "geox_mcft_cap08_s4_append_forward_authority_v1" as const;
export const CAP08_S4_AUTHORITY_KIND_V1 = "REALITY_BINDING" as const;
export const CAP08_S4_OPERATION_VARIANT_V1 = "A3_LATE_APPEND_FORWARD" as const;
export const CAP08_S4_LATE_OBSERVATION_ID_V1 = "FVO-01" as const;
export const CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1 = "FVO-16" as const;
export const CAP08_S4_CORRECTION_TICK_ID_V1 = "T16" as const;
export const CAP08_S4_NEXT_TICK_ID_V1 = "T17" as const;
export const CAP08_S4_LAG_HOURS_V1 = 15 as const;
export const CAP08_S4_RESIDUAL_OBLIGATIONS_V1 = ["R-01", "R-16"] as const;

export type Cap08S4ScopeV1 = { tenant_id:string; project_id:string; group_id:string; field_id:string; season_id:string; zone_id:string };
export type Cap08S4ObjectBindingV1 = { ref:string; hash:string };
export type Cap08S4HistoricalHashManifestV1 = { state_bindings:Cap08S4ObjectBindingV1[]; forecast_bindings:Cap08S4ObjectBindingV1[]; manifest_digest:string };
export type Cap08S4CorrectedCanonicalSetV1 = { state:CanonicalObjectEnvelopeV1; forecast:CanonicalObjectEnvelopeV1; scenario:Cap04ScenarioSetEnvelopeV1; tick:CanonicalObjectEnvelopeV1; checkpoint:CanonicalObjectEnvelopeV1 };
export type Cap08S4T17CorrectedPredecessorV1 = {
  schema_version:"geox_mcft_cap08_s4_t17_corrected_predecessor_v1"; scope:Cap08S4ScopeV1; lineage_id:string; revision_id:string;
  next_logical_tick_time:string; previous_tick_sequence:number; previous_posterior_ref:string; previous_posterior_hash:string;
  previous_checkpoint_ref:string; previous_checkpoint_hash:string; previous_forecast_result_ref:string; previous_forecast_result_hash:string;
  latest_successful_forecast_ref:string; latest_successful_forecast_hash:string; previous_scenario_set_ref:string; previous_scenario_set_hash:string;
  correction_authority_ref:string; correction_authority_hash:string;
};
export type Cap08S4AppendForwardAuthorityIdentityInputV1 = {
  formal_run_id:string; scope:Cap08S4ScopeV1; lineage_id:string; revision_id:string; correction_logical_time:string; next_logical_time:string;
  base_t16_state:Cap08S4ObjectBindingV1; base_t16_forecast:Cap08S4ObjectBindingV1; base_t16_tick:Cap08S4ObjectBindingV1;
  base_t16_checkpoint:Cap08S4ObjectBindingV1; source_t01_state:Cap08S4ObjectBindingV1; late_observation:Cap08S4ObjectBindingV1;
  ordinary_due_observation:Cap08S4ObjectBindingV1; historical_hash_manifest_digest:string; phase_engine_contract_digest:string; phase_engine_source_digest:string;
};
export type Cap08S4AppendForwardIdentityV1 = {
  identity_input:Cap08S4AppendForwardAuthorityIdentityInputV1; identity_hash:string; authority_ref:string; idempotency_key:string;
  corrected_object_ids:{ state:string; forecast:string; tick:string; checkpoint:string };
};
export type Cap08S4AppendForwardAuthorityV1 = {
  schema_version:typeof CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1; contract_id:typeof CAP08_S4_CONTRACT_ID_V1; authority_kind:typeof CAP08_S4_AUTHORITY_KIND_V1;
  authority_ref:string; idempotency_key:string; formal_run_id:string; scope:Cap08S4ScopeV1; lineage_id:string; revision_id:string;
  correction_tick_id:typeof CAP08_S4_CORRECTION_TICK_ID_V1; correction_logical_time:string; next_tick_id:typeof CAP08_S4_NEXT_TICK_ID_V1;
  next_logical_time:string; operation_variant:typeof CAP08_S4_OPERATION_VARIANT_V1; late_observation_id:typeof CAP08_S4_LATE_OBSERVATION_ID_V1;
  ordinary_due_observation_id:typeof CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1; lag_hours:typeof CAP08_S4_LAG_HOURS_V1;
  identity_input:Cap08S4AppendForwardAuthorityIdentityInputV1; math_input:Cap08S4LateCorrectionInputV1; math_result:Cap08S4LateCorrectionAppliedV1;
  corrected_objects:{ state:Cap08S4ObjectBindingV1; forecast:Cap08S4ObjectBindingV1; scenario:Cap08S4ObjectBindingV1; tick:Cap08S4ObjectBindingV1; checkpoint:Cap08S4ObjectBindingV1 };
  historical_hash_manifest:Cap08S4HistoricalHashManifestV1; historical_rewrite:false; historical_revision_created:false;
  latest_pointer_regression_authorized:false; ordinary_state_assimilation_for_fvo16:false; residual_obligations:readonly ["R-01","R-16"];
  residual_commit_status:"PENDING_S5_C_PROVIDER"; t17_predecessor:Omit<Cap08S4T17CorrectedPredecessorV1,"correction_authority_hash">;
  phase_engine_contract_digest:string; phase_engine_source_digest:string; slice_acceptance_only:true; final_formal_run_id:null;
  production_runtime_source_authorized:false; s5_authorized:false; mcft_cap_09_authorized:false; determinism_hash:string;
};

function req(value:unknown, code:string):string { if(typeof value!=="string"||!value.trim()) throw new Error(code); return value; }
function hour(value:unknown, code:string):string { const text=req(value,code); const n=Date.parse(text); if(!Number.isFinite(n)||new Date(n).toISOString()!==text||!text.endsWith(":00:00.000Z")) throw new Error(code); return text; }
function scope(value:Cap08S4ScopeV1):Cap08S4ScopeV1 { return { tenant_id:req(value?.tenant_id,"CAP08_S4_SCOPE_TENANT_REQUIRED"),project_id:req(value?.project_id,"CAP08_S4_SCOPE_PROJECT_REQUIRED"),group_id:req(value?.group_id,"CAP08_S4_SCOPE_GROUP_REQUIRED"),field_id:req(value?.field_id,"CAP08_S4_SCOPE_FIELD_REQUIRED"),season_id:req(value?.season_id,"CAP08_S4_SCOPE_SEASON_REQUIRED"),zone_id:req(value?.zone_id,"CAP08_S4_SCOPE_ZONE_REQUIRED")}; }
function binding(value:Cap08S4ObjectBindingV1, code:string):Cap08S4ObjectBindingV1 { const result={ref:req(value?.ref,`${code}_REF_REQUIRED`),hash:req(value?.hash,`${code}_HASH_REQUIRED`)}; if(!/^sha256:[0-9a-f]{64}$/.test(result.hash)) throw new Error(`${code}_HASH_INVALID`); return result; }

export function buildCap08S4HistoricalHashManifestV1(input:{state_bindings:readonly Cap08S4ObjectBindingV1[];forecast_bindings:readonly Cap08S4ObjectBindingV1[]}):Cap08S4HistoricalHashManifestV1 {
  const states=input.state_bindings.map((v,i)=>binding(v,`CAP08_S4_HISTORY_STATE_${i}`));
  const forecasts=input.forecast_bindings.map((v,i)=>binding(v,`CAP08_S4_HISTORY_FORECAST_${i}`));
  if(states.length!==17||forecasts.length!==17) throw new Error("CAP08_S4_HISTORICAL_HASH_MANIFEST_CARDINALITY");
  if(new Set(states.map(v=>v.ref)).size!==17||new Set(forecasts.map(v=>v.ref)).size!==17) throw new Error("CAP08_S4_HISTORICAL_HASH_MANIFEST_DUPLICATE_REF");
  const basis={state_bindings:states,forecast_bindings:forecasts}; return {...basis,manifest_digest:semanticHashV1(basis)};
}

export function deriveCap08S4AppendForwardIdentityV1(raw:Cap08S4AppendForwardAuthorityIdentityInputV1):Cap08S4AppendForwardIdentityV1 {
  const correction=hour(raw.correction_logical_time,"CAP08_S4_CORRECTION_LOGICAL_TIME_INVALID");
  const next=hour(raw.next_logical_time,"CAP08_S4_NEXT_LOGICAL_TIME_INVALID");
  if(next!==new Date(Date.parse(correction)+3_600_000).toISOString()) throw new Error("CAP08_S4_NEXT_LOGICAL_TIME_MISMATCH");
  const identity_input:Cap08S4AppendForwardAuthorityIdentityInputV1={formal_run_id:req(raw.formal_run_id,"CAP08_S4_FORMAL_RUN_ID_REQUIRED"),scope:scope(raw.scope),lineage_id:req(raw.lineage_id,"CAP08_S4_LINEAGE_ID_REQUIRED"),revision_id:req(raw.revision_id,"CAP08_S4_REVISION_ID_REQUIRED"),correction_logical_time:correction,next_logical_time:next,base_t16_state:binding(raw.base_t16_state,"CAP08_S4_BASE_T16_STATE"),base_t16_forecast:binding(raw.base_t16_forecast,"CAP08_S4_BASE_T16_FORECAST"),base_t16_tick:binding(raw.base_t16_tick,"CAP08_S4_BASE_T16_TICK"),base_t16_checkpoint:binding(raw.base_t16_checkpoint,"CAP08_S4_BASE_T16_CHECKPOINT"),source_t01_state:binding(raw.source_t01_state,"CAP08_S4_SOURCE_T01_STATE"),late_observation:binding(raw.late_observation,"CAP08_S4_LATE_OBSERVATION"),ordinary_due_observation:binding(raw.ordinary_due_observation,"CAP08_S4_ORDINARY_DUE_OBSERVATION"),historical_hash_manifest_digest:req(raw.historical_hash_manifest_digest,"CAP08_S4_HISTORY_MANIFEST_DIGEST_REQUIRED"),phase_engine_contract_digest:req(raw.phase_engine_contract_digest,"CAP08_S4_PHASE_CONTRACT_DIGEST_REQUIRED"),phase_engine_source_digest:req(raw.phase_engine_source_digest,"CAP08_S4_PHASE_SOURCE_DIGEST_REQUIRED")};
  const identity_hash=semanticHashV1(identity_input); const authority_ref=deriveSemanticObjectIdV1("cap08_s4_late_authority",{identity_hash});
  return {identity_input,identity_hash,authority_ref,idempotency_key:deriveSemanticObjectIdV1("cap08_s4_late_key",{identity_hash}),corrected_object_ids:{state:deriveSemanticObjectIdV1("cap08_s4_state",{authority_ref}),forecast:deriveSemanticObjectIdV1("cap08_s4_forecast",{authority_ref}),tick:deriveSemanticObjectIdV1("cap08_s4_tick",{authority_ref}),checkpoint:deriveSemanticObjectIdV1("cap08_s4_checkpoint",{authority_ref})}};
}

function exactObject(object:CanonicalObjectEnvelopeV1|Cap04ScenarioSetEnvelopeV1, expected:Cap08S4ObjectBindingV1, code:string):void {
  if(object.object_id!==expected.ref||object.determinism_hash!==expected.hash) throw new Error(code);
  validateCap04CanonicalEnvelopeV1(object as unknown as CanonicalObjectEnvelopeV1);
}
export function computeCap08S4AuthorityDeterminismHashV1(authority:Omit<Cap08S4AppendForwardAuthorityV1,"determinism_hash">):string { return semanticHashV1(authority); }

export function validateCap08S4AppendForwardAuthorityV1(input:{authority:Cap08S4AppendForwardAuthorityV1;corrected_set:Cap08S4CorrectedCanonicalSetV1}):void {
  const a=input.authority,s=input.corrected_set,id=deriveCap08S4AppendForwardIdentityV1(a.identity_input);
  if(a.schema_version!==CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1||a.contract_id!==CAP08_S4_CONTRACT_ID_V1||a.authority_kind!==CAP08_S4_AUTHORITY_KIND_V1||a.operation_variant!==CAP08_S4_OPERATION_VARIANT_V1) throw new Error("CAP08_S4_AUTHORITY_HEADER_MISMATCH");
  if(a.authority_ref!==id.authority_ref||a.idempotency_key!==id.idempotency_key||a.formal_run_id!==id.identity_input.formal_run_id||a.lineage_id!==id.identity_input.lineage_id||a.revision_id!==id.identity_input.revision_id||a.correction_logical_time!==id.identity_input.correction_logical_time||a.next_logical_time!==id.identity_input.next_logical_time) throw new Error("CAP08_S4_AUTHORITY_IDENTITY_MISMATCH");
  if(a.correction_tick_id!==CAP08_S4_CORRECTION_TICK_ID_V1||a.next_tick_id!==CAP08_S4_NEXT_TICK_ID_V1||a.late_observation_id!==CAP08_S4_LATE_OBSERVATION_ID_V1||a.ordinary_due_observation_id!==CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1||a.lag_hours!==CAP08_S4_LAG_HOURS_V1||a.math_result.disposition!=="APPLIED") throw new Error("CAP08_S4_AUTHORITY_FORMAL_DATASET_MISMATCH");
  const manifest=buildCap08S4HistoricalHashManifestV1(a.historical_hash_manifest); if(manifest.manifest_digest!==a.historical_hash_manifest.manifest_digest||manifest.manifest_digest!==id.identity_input.historical_hash_manifest_digest) throw new Error("CAP08_S4_AUTHORITY_HISTORY_MANIFEST_MISMATCH");
  exactObject(s.state,a.corrected_objects.state,"CAP08_S4_STATE_BINDING_MISMATCH"); exactObject(s.forecast,a.corrected_objects.forecast,"CAP08_S4_FORECAST_BINDING_MISMATCH"); exactObject(s.scenario,a.corrected_objects.scenario,"CAP08_S4_SCENARIO_BINDING_MISMATCH"); exactObject(s.tick,a.corrected_objects.tick,"CAP08_S4_TICK_BINDING_MISMATCH"); exactObject(s.checkpoint,a.corrected_objects.checkpoint,"CAP08_S4_CHECKPOINT_BINDING_MISMATCH");
  if(s.state.object_id!==id.corrected_object_ids.state||s.forecast.object_id!==id.corrected_object_ids.forecast||s.tick.object_id!==id.corrected_object_ids.tick||s.checkpoint.object_id!==id.corrected_object_ids.checkpoint) throw new Error("CAP08_S4_CORRECTED_OBJECT_ID_MISMATCH");
  if(a.historical_rewrite!==false||a.historical_revision_created!==false||a.latest_pointer_regression_authorized!==false||a.ordinary_state_assimilation_for_fvo16!==false||a.residual_commit_status!=="PENDING_S5_C_PROVIDER"||JSON.stringify(a.residual_obligations)!==JSON.stringify(CAP08_S4_RESIDUAL_OBLIGATIONS_V1)) throw new Error("CAP08_S4_AUTHORITY_BOUNDARY_MISMATCH");
  const p=a.t17_predecessor; if(p.schema_version!=="geox_mcft_cap08_s4_t17_corrected_predecessor_v1"||p.next_logical_tick_time!==a.next_logical_time||p.previous_tick_sequence!==s.checkpoint.payload.tick_sequence||p.previous_posterior_ref!==s.state.object_id||p.previous_posterior_hash!==s.state.determinism_hash||p.previous_checkpoint_ref!==s.checkpoint.object_id||p.previous_checkpoint_hash!==s.checkpoint.determinism_hash||p.previous_forecast_result_ref!==s.forecast.object_id||p.previous_forecast_result_hash!==s.forecast.determinism_hash||p.latest_successful_forecast_ref!==s.forecast.object_id||p.latest_successful_forecast_hash!==s.forecast.determinism_hash||p.previous_scenario_set_ref!==s.scenario.object_id||p.previous_scenario_set_hash!==s.scenario.determinism_hash||p.correction_authority_ref!==a.authority_ref) throw new Error("CAP08_S4_T17_PREDECESSOR_MISMATCH");
  if(a.phase_engine_contract_digest!==id.identity_input.phase_engine_contract_digest||a.phase_engine_source_digest!==id.identity_input.phase_engine_source_digest||a.slice_acceptance_only!==true||a.final_formal_run_id!==null||a.production_runtime_source_authorized!==false||a.s5_authorized!==false||a.mcft_cap_09_authorized!==false) throw new Error("CAP08_S4_AUTHORITY_NONCLAIM_MISMATCH");
  const {determinism_hash:_,...basis}=a; if(computeCap08S4AuthorityDeterminismHashV1(basis)!==a.determinism_hash) throw new Error("CAP08_S4_AUTHORITY_DETERMINISM_HASH_MISMATCH");
}
