// scripts/governance_acceptance/ACCEPTANCE_SOIL_WATER_POTENTIAL_MODEL_BOUNDARY_V1.cjs
const fs = require('node:fs'); const path = require('node:path'); require('tsx/cjs');
const NAME='ACCEPTANCE_SOIL_WATER_POTENTIAL_MODEL_BOUNDARY_V1';
function assert(c,m,d){ if(!c){ console.error(`[${NAME}] FAIL: ${m}`, d||''); process.exit(1);} }
const file=path.join(process.cwd(),'apps/server/src/domain/soil_water/van_genuchten_v1.ts');
assert(fs.existsSync(file),'model module missing');
const src=fs.readFileSync(file,'utf8');
assert(src.startsWith('// apps/server/src/domain/soil_water/van_genuchten_v1.ts'),'first-line path comment missing');
const { estimateVanGenuchtenMatricPotentialV1 } = require(file);
const input={theta:0.28,theta_r:0.08,theta_s:0.43,alpha_per_kpa:0.035,n:1.56};
const a=estimateVanGenuchtenMatricPotentialV1(input); const b=estimateVanGenuchtenMatricPotentialV1(input);
assert(a.ok && a.input_status==='ESTIMATED' && Number.isFinite(a.matric_potential_kpa) && a.matric_potential_kpa<0,'valid input did not estimate finite negative',a);
assert(JSON.stringify(a)===JSON.stringify(b),'same input must produce identical output',{a,b});
assert(estimateVanGenuchtenMatricPotentialV1({...input,theta:0.08}).input_status==='INVALID_INPUT','theta <= theta_r must be invalid');
assert(estimateVanGenuchtenMatricPotentialV1({...input,theta:0.43}).input_status==='INVALID_INPUT','theta >= theta_s must be invalid');
assert(estimateVanGenuchtenMatricPotentialV1({...input,alpha_per_kpa:0}).input_status==='INVALID_INPUT','alpha <= 0 must be invalid');
assert(estimateVanGenuchtenMatricPotentialV1({...input,n:1}).input_status==='INVALID_INPUT','n <= 1 must be invalid');
assert(!/from\s+["']pg["']|require\(["']pg["']\)/.test(src),'model module must not import pg');
assert(!/routes?\//.test(src),'model module must not import server route modules');
for (const word of ['recommendation','approval','operation','ao_act','dispatch','roi','field_memory']) assert(!src.toLowerCase().includes(word),'model module references forbidden boundary string '+word);
console.log(`[${NAME}] PASS`);
