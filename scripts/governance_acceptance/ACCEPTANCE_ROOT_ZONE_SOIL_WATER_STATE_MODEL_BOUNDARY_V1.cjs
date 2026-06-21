// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_MODEL_BOUNDARY_V1.cjs
const fs = require("node:fs");
require("tsx/cjs");
const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_MODEL_BOUNDARY_V1";
function fail(m,d){console.error(`[${name}] FAIL: ${m}`); if(d) console.error(d); process.exit(1)}
function assert(c,m,d){if(!c) fail(m,d)}
const file = "apps/server/src/domain/soil_water/root_zone_soil_water_state_builder_v1.ts";
const text = fs.readFileSync(file,"utf8");
assert(text.startsWith(`// ${file}`), "builder must start with path comment");
for (const token of ['from "pg"','require("pg")','express','router','app.get','app.post','process.env','Date.now','new Date','randomUUID','recommendation','approval','operation_plan','ao_act','dispatch','roi_ledger','field_memory','INSERT INTO facts']) assert(!text.includes(token), `forbidden token found: ${token}`);
const { buildRootZoneSoilWaterStateV1 } = require(`${process.cwd()}/${file}`);
const base = {tenant_id:"t",project_id:"p",group_id:"g",field_id:"f",zone_id:"z",computed_at:"2026-06-21T00:00:00.000Z",root_zone_depth_cm:60};
const layer=(id,depth,mp,awf,w=1,status="ESTIMATED")=>({estimate_id:id,tenant_id:"t",project_id:"p",group_id:"g",field_id:"f",zone_id:"z",layer_depth_cm:depth,source_window_id:null,source_profile_id:null,observed_theta:null,theta_unit:"m3_m3",normalized_theta_m3_m3:null,matric_potential_kpa:mp,matric_potential_class: mp == null ? "UNKNOWN" : mp >= -10 ? "SATURATED_OR_NEAR_SATURATED" : mp >= -60 ? "READILY_AVAILABLE" : mp >= -200 ? "LIMITED_AVAILABLE" : "STRESS",available_water_fraction:awf,root_zone_weight:w,input_status:status,blocking_reasons:[],hydraulic_profile_ref:null,data_quality_ref:null,evidence_refs:[],calculation_inputs:{},derivation:{},confidence:{level:"HIGH",score:0.9,basis:"test"},computed_at:"2026-06-21T00:00:00.000Z",determinism_hash:`hash_${id}`});
let out = buildRootZoneSoilWaterStateV1({...base, layerEstimates:[layer("a",20,-20,0.8),layer("b",40,-70,0.4),layer("c",60,-100,0.2)]});
assert(out.input_status === "ESTIMATED", "valid three-layer input returns ESTIMATED");
assert(JSON.stringify(out) === JSON.stringify(buildRootZoneSoilWaterStateV1({...base, layerEstimates:[layer("a",20,-20,0.8),layer("b",40,-70,0.4),layer("c",60,-100,0.2)]})), "same input returns identical output");
assert(buildRootZoneSoilWaterStateV1({...base, layerEstimates:[]}).input_status === "INSUFFICIENT_LAYER_ESTIMATES", "no layer estimate returns INSUFFICIENT_LAYER_ESTIMATES");
assert(buildRootZoneSoilWaterStateV1({...base, layerEstimates:[layer("x",20,null,null,1,"BLOCKED_BY_DATA_QUALITY")]}).input_status === "INSUFFICIENT_LAYER_ESTIMATES", "blocked-only layers return INSUFFICIENT_LAYER_ESTIMATES");
assert(buildRootZoneSoilWaterStateV1({...base, layerEstimates:[layer("a",20,-20,0.8),layer("x",40,null,null,1,"BLOCKED_BY_DATA_QUALITY")]}).input_status === "PARTIAL_ESTIMATE", "mixed valid/blocked layers return PARTIAL_ESTIMATE");
assert(buildRootZoneSoilWaterStateV1({...base, layerEstimates:[layer("a",20,-20,0.8),layer("b",40,-250,0.1)]}).root_zone_water_potential_class === "MIXED", "mixed stress/readily layers returns MIXED");
assert(buildRootZoneSoilWaterStateV1({...base, root_zone_depth_cm:0, layerEstimates:[]}).input_status === "INVALID_INPUT", "invalid root_zone_depth_cm returns INVALID_INPUT");
out = buildRootZoneSoilWaterStateV1({...base, root_zone_depth_cm:40, layerEstimates:[layer("a",20,-20,0.8),layer("b",80,-250,0.1)]});
assert(out.layer_count === 1 && out.layer_estimate_refs[0] === "a", "layers deeper than root_zone_depth_cm are excluded");
console.log(`[${name}] PASS`);
