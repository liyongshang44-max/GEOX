const fs=require('node:fs');
const c=JSON.parse(fs.readFileSync('docs/twin_kernel/P32_FORECAST_PROJECTION_CORE_CONTRACT_V0.json','utf8'));
const ok=c.atomic_write_contract.forecast_run_without_projection_blocked&&c.atomic_write_contract.projection_without_forecast_run_blocked;
console.log(JSON.stringify({ok,acceptance:'P32_02_ATOMIC_SCHEMA'},null,2));
if(!ok)process.exit(1);
