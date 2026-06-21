// scripts/governance_acceptance/ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_CUSTOMER_BOUNDARY_V1.cjs
const fs=require('node:fs'); const cp=require('node:child_process'); const name='ACCEPTANCE_ROOT_ZONE_IRRIGATION_SCENARIO_CUSTOMER_BOUNDARY_V1';
const tokens=['root_zone_irrigation_scenario_set_v1','root_zone_irrigation_scenario_set_index_v1','daily_projection','delta_vs_baseline_fraction','rootZoneIrrigationScenario','rootZoneIrrigationScenarioSet'];
const files=cp.execFileSync('rg',['--files','apps/server/src/routes','apps/web/src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).filter(f=>!/operator|admin/i.test(f));
for(const f of files){const t=fs.readFileSync(f,'utf8'); for(const tok of tokens){ if(t.includes(tok)){ console.error(`[${name}] FAIL: customer surface exposes ${tok} in ${f}`); process.exit(1); }}}
console.log(`[${name}] PASS`);
