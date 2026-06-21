// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_BOUNDARY_V1.cjs
const fs = require("node:fs");
require("tsx/cjs");
const name = "ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_MODEL_BOUNDARY_V1";
const file = "apps/server/src/domain/soil_water/root_zone_soil_water_forecast_builder_v1.ts";
const forbiddenTokens = ['from "pg"','require("pg")',"express","router","app.get","app.post","process.env","Date.now","new Date","randomUUID","recommendation","approval","operation_plan","ao_act","dispatch","roi_ledger","field_memory","INSERT INTO facts"];
function fail(m,d){console.error(`[${name}] FAIL: ${m}`); if(d) console.error(d); process.exit(1)}
function assert(c,m,d){if(!c) fail(m,d)}
const text = fs.readFileSync(file,"utf8"); assert(text.startsWith(`// ${file}`),"builder must start with path comment"); for (const t of forbiddenTokens) assert(!text.includes(t),`forbidden token found: ${t}`);
const { buildRootZoneSoilWaterForecastV1 } = require(`${process.cwd()}/${file}`);
const scope={tenant_id:"tenant_a",project_id:"project_a",group_id:"group_a",field_id:"field_a",zone_id:"zone_a"};
const sourceState={state_id:"state_a",...scope,root_zone_depth_cm:60,layer_estimate_refs:[],layer_count:1,estimated_layer_count:1,blocked_layer_count:0,weighted_matric_potential_kpa:-50,root_zone_available_water_fraction:0.5,root_zone_water_potential_class:"READILY_AVAILABLE",worst_layer_class:"READILY_AVAILABLE",stress_layer_count:0,limited_layer_count:0,input_status:"ESTIMATED",blocking_reasons:[],calculation_inputs:{},derivation:{},confidence:{level:"HIGH",score:.9,basis:"test"},computed_at:"2026-06-21T00:00:00.000Z",determinism_hash:"state_hash"};
const weather=[{date:"2026-06-23",precipitation_mm:0,et0_mm:5,crop_coefficient:1},{date:"2026-06-21",precipitation_mm:0,et0_mm:5,crop_coefficient:1},{date:"2026-06-22",precipitation_mm:0,et0_mm:5,crop_coefficient:1}];
function build(over={}){return buildRootZoneSoilWaterForecastV1({...scope,sourceState,weather_forecast_ref:"wx",root_zone_available_water_capacity_mm:100,effective_rainfall_factor:.8,dailyWeather:weather,computed_at:"2026-06-21T00:00:00.000Z",...over});}
let out=build(); assert(out.forecast_status==="ESTIMATED","valid forecast returns ESTIMATED"); assert(JSON.stringify(out)===JSON.stringify(build()),"same input returns identical output"); assert(out.daily_forecast[0].date==="2026-06-21","daily weather sorted deterministically");
assert(build({root_zone_available_water_capacity_mm:0}).forecast_status==="INVALID_INPUT","invalid capacity returns INVALID_INPUT");
assert(build({effective_rainfall_factor:1.1}).forecast_status==="INVALID_INPUT","invalid rainfall factor returns INVALID_INPUT");
assert(build({dailyWeather:[]}).forecast_status==="INVALID_INPUT","empty dailyWeather returns INVALID_INPUT");
assert(build({sourceState:{...sourceState,input_status:"INSUFFICIENT_LAYER_ESTIMATES"}}).forecast_status==="INSUFFICIENT_STATE","invalid source state returns INSUFFICIENT_STATE");
assert(build({dailyWeather:[{date:"2026-06-21",precipitation_mm:-1,et0_mm:1,crop_coefficient:1}]}).forecast_status==="INVALID_INPUT","negative precipitation returns INVALID_INPUT");
assert(build({dailyWeather:[{date:"2026-06-21",precipitation_mm:0,et0_mm:-1,crop_coefficient:1}]}).forecast_status==="INVALID_INPUT","negative ET0 returns INVALID_INPUT");
assert(build({dailyWeather:[{date:"2026-06-21",precipitation_mm:0,et0_mm:1,crop_coefficient:-1}]}).forecast_status==="INVALID_INPUT","negative crop coefficient returns INVALID_INPUT");
assert(build({dailyWeather:[{date:"2026-06-21",precipitation_mm:0,et0_mm:99,crop_coefficient:1}]}).daily_forecast[0].bound_applied==="LOWER_BOUND","lower bound is recorded");
assert(build({dailyWeather:[{date:"2026-06-21",precipitation_mm:99,et0_mm:0,crop_coefficient:1}]}).daily_forecast[0].bound_applied==="UPPER_BOUND","upper bound is recorded");
out=build({sourceState:{...sourceState,root_zone_available_water_fraction:.3},dailyWeather:[{date:"2026-06-21",precipitation_mm:0,et0_mm:1,crop_coefficient:1},{date:"2026-06-22",precipitation_mm:0,et0_mm:5,crop_coefficient:1},{date:"2026-06-23",precipitation_mm:0,et0_mm:5,crop_coefficient:1}]});
assert(out.limited_day_count===1,"limited day count is correct"); assert(out.stress_day_count===2,"stress day count is correct");
console.log(`[${name}] PASS`);
