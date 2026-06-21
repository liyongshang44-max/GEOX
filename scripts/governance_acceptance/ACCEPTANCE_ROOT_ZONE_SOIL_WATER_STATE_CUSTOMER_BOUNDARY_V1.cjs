// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_CUSTOMER_BOUNDARY_V1.cjs
const fs = require("node:fs"); const path = require("node:path");
const name="ACCEPTANCE_ROOT_ZONE_SOIL_WATER_STATE_CUSTOMER_BOUNDARY_V1"; const roots=["apps/server/src/routes","apps/web/src"];
const tokens=["root_zone_soil_water_state_v1","root_zone_soil_water_state_index_v1","weighted_matric_potential_kpa","rootZoneSoilWaterState","weightedMatricPotentialKpa"];
function walk(dir){ if(!fs.existsSync(dir)) return []; return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name); return e.isDirectory()?walk(p):[p]})}
const hits=[]; for(const file of roots.flatMap(walk)){ const text=fs.readFileSync(file,"utf8"); for(const token of tokens) if(text.includes(token)) hits.push(`${file}: ${token}`)}
if(hits.length){console.error(`[${name}] FAIL customer exposure found`); console.error(hits.join("\n")); process.exit(1)}
console.log(`[${name}] PASS`);
