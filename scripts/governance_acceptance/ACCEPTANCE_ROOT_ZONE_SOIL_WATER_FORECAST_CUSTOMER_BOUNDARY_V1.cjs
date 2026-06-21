// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_CUSTOMER_BOUNDARY_V1.cjs
const fs = require("node:fs"); const path = require("node:path");
const name="ACCEPTANCE_ROOT_ZONE_SOIL_WATER_FORECAST_CUSTOMER_BOUNDARY_V1";
const roots=["apps/server/src/routes","apps/web/src"]; const tokens=["root_zone_soil_water_forecast_v1","root_zone_soil_water_forecast_index_v1","daily_forecast","projected_available_water_fraction","forecastWaterStatus","rootZoneSoilWaterForecast"];
function fail(m,d){console.error(`[${name}] FAIL: ${m}`); if(d) console.error(d); process.exit(1)}
function walk(dir,out=[]){if(!fs.existsSync(dir)) return out; for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name); if(ent.isDirectory()) walk(p,out); else out.push(p)} return out}
for(const file of roots.flatMap(r=>walk(r)).filter(f=>/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(f))){const text=fs.readFileSync(file,"utf8"); for(const t of tokens){if(text.includes(t)) fail(`Customer boundary token exposed: ${t}`,file)}}
console.log(`[${name}] PASS`);
