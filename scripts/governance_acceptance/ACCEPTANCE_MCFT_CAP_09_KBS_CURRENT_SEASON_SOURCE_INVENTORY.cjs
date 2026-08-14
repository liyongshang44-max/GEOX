#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const INVENTORY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-KBS-CURRENT-SEASON-SOURCE-INVENTORY-V1.json";
const A13 = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-13-CURRENT-CROP-AUTHORITY-REQUALIFICATION-SEPARATION.md";
const CROP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json";
const EXPECTED_BASE = "3aee8450e9afc140296b13be666617ef69bf2e11";
const EXPECTED_A13_BLOB = "5210001b387993cea502aac9480834400b3b8ef3";
const EXPECTED_CROP_BLOB = "b5de9d29189cb654444b3f57d00df290eefe16d3";

function git(...args){ return execFileSync("git", args, {encoding:"utf8"}).trim(); }
function readJson(file){ return JSON.parse(fs.readFileSync(file,"utf8")); }

try {
  const head = git("rev-parse","HEAD");
  const base = git("merge-base", EXPECTED_BASE, head);
  assert.equal(base, EXPECTED_BASE, "SOURCE_INVENTORY_MUST_DESCEND_FROM_EXACT_BASE");
  assert.equal(git("rev-parse",`HEAD:${A13}`), EXPECTED_A13_BLOB, "AMENDMENT13_MUTATED");
  assert.equal(git("rev-parse",`HEAD:${CROP}`), EXPECTED_CROP_BLOB, "FORMAL_CROP_CONTEXT_MUTATED");

  const x = readJson(INVENTORY);
  assert.equal(x.schema_version,"geox_mcft_cap09_kbs_current_season_source_inventory_v1");
  assert.equal(x.record_status,"SOURCE_INVENTORY_ONLY_NOT_AUTHORITY");
  assert.equal(x.exact_base_protected_main,EXPECTED_BASE);
  assert.equal(x.formal_scope.site_id,"KBS_MCSE_T1R1");
  assert.equal(x.formal_scope.season_id,"season_2026_corn");
  assert.equal(x.formal_scope.crop,"corn");
  assert.equal(x.formal_scope.hybrid_product_code,"P0306Q");
  assert.deepEqual(x.required_proof_layers,[
    "POSITIVE_LIFECYCLE_ANCHOR",
    "BOUNDED_LIFECYCLE_CARRY_FORWARD",
    "PHENOLOGY_TO_WATER_USE_STAGE",
    "STAGE_TO_KC_TO_LEGAL_T"
  ]);

  const surfaces = new Map(x.source_surfaces.map((s)=>[s.source_id,s]));
  for(const id of [
    "KBS_AGLOG_MCSE_LIVE",
    "KBS004_SEEDS_AND_PLANTING_DATE",
    "KBS019_ANNUAL_CROP_BIOMASS",
    "KBS030_ANNUAL_CROP_STAND_COUNTS",
    "KBS020_AGRONOMIC_YIELDS",
    "KBS092_GLBRC_PHENOLOGY",
    "KBS_GIS_SATELLITE_AND_PUBLIC_IMAGE_SURFACES"
  ]) assert(surfaces.has(id),`SOURCE_SURFACE_REQUIRED:${id}`);

  assert.equal(surfaces.get("KBS_AGLOG_MCSE_LIVE").formal_scope_current_positive_crop_bound_anchor_established,false);
  assert.equal(surfaces.get("KBS_AGLOG_MCSE_LIVE").formal_scope_current_phenology_established,false);
  assert.equal(surfaces.get("KBS004_SEEDS_AND_PLANTING_DATE").proves_managed_active_at_later_observation_time,false);
  assert.equal(surfaces.get("KBS019_ANNUAL_CROP_BIOMASS").current_2026_formal_scope_observation_identified,false);
  assert.equal(surfaces.get("KBS092_GLBRC_PHENOLOGY").formal_scope_experiment_match,false);

  const candidates = new Map(x.formal_scope_observation_candidates.map((c)=>[c.provider_observation_id,c]));
  for(const id of [6931,6977,7076,7095]) assert(candidates.has(id),`OBSERVATION_CANDIDATE_REQUIRED:${id}`);
  const planting = candidates.get(6931);
  assert.deepEqual(planting.can_prove,["SEASON_ORIGIN"]);
  assert(planting.cannot_prove.includes("ACTIVE_AT_LATER_TIME"));

  const anchor = candidates.get(6977);
  assert.equal(anchor.candidate_layer,"POSITIVE_LIFECYCLE_ANCHOR");
  assert.equal(anchor.positive_management_activity,true);
  assert.equal(anchor.explicit_crop_token_in_event_detail,false);
  assert.equal(anchor.explicit_hybrid_token_in_event_detail,false);
  assert.equal(anchor.candidate_requires_composite_binding_to_planting_6931,true);
  assert.equal(anchor.candidate_requires_intervening_season_identity_continuity_qualification,true);
  assert.equal(anchor.phenology_support,false);
  assert.equal(anchor.kc_support,false);
  assert.equal(anchor.authority_effect,"NONE");

  assert.equal(x.out_of_scope_positive_control.provider_observation_id,7109);
  assert.equal(x.out_of_scope_positive_control.demonstrates_kbs_aglog_can_express_direct_current_crop_management,true);
  assert.equal(x.out_of_scope_positive_control.may_substitute_for_t1r1,false);

  const a = x.inventory_adjudication;
  assert.equal(a.kbs_public_current_season_evidence_globally_empty,false);
  assert.equal(a.kbs_public_source_class_can_express_positive_crop_bound_current_management,true);
  assert.equal(a.direct_positive_t1r1_p0306q_active_anchor_established,false);
  assert.equal(a.direct_t1r1_current_phenology_established,false);
  assert.equal(a.formal_conclusion,"KBS_PUBLIC_CURRENT_SEASON_EVIDENCE_DOES_NOT_YET_ESTABLISH_REQUIRED_POSITIVE_T1R1_P0306Q_CROP_AUTHORITY");
  assert.equal(a.first_targeted_candidate,"KBS_AGLOG_OBSERVATION_6977");
  assert.equal(a.next_frontier,"T1R1_OBSERVATION_6977_POSITIVE_LIFECYCLE_ANCHOR_QUALIFICATION");

  const effect = x.authority_effect;
  for(const key of [
    "season_lifecycle_active_established",
    "phenology_stage_resolved",
    "crop_model_parameter_resolved",
    "ea5e2_operational_activation_qualified",
    "database_write_authorized",
    "runtime_config_write_authorized",
    "scheduler_write_authorized",
    "formal_window_started"
  ]) assert.equal(effect[key],false,`AUTHORITY_EFFECT_MUST_REMAIN_FALSE:${key}`);
  assert.equal(effect.formal_execution_count,"0/24");

  console.log(JSON.stringify({
    schema_version:"geox_mcft_cap09_kbs_current_season_source_inventory_acceptance_v1",
    status:"PASS",
    subject_sha:head,
    exact_base_protected_main:EXPECTED_BASE,
    source_surface_count:x.source_surfaces.length,
    first_targeted_candidate:a.first_targeted_candidate,
    next_frontier:a.next_frontier,
    direct_positive_t1r1_p0306q_active_anchor_established:false,
    direct_t1r1_current_phenology_established:false,
    authority_effect:"NONE",
    formal_execution_count:"0/24"
  }));
} catch(error) {
  console.error(JSON.stringify({schema_version:"geox_mcft_cap09_kbs_current_season_source_inventory_acceptance_v1",status:"FAIL",error:String(error?.message||error),authority_effect:"NONE",formal_execution_count:"0/24"}));
  process.exitCode=1;
}
