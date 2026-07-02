const fs=require('node:fs');
const c=JSON.parse(fs.readFileSync('docs/twin_kernel/P32_FORECAST_PROJECTION_CORE_CONTRACT_V0.json','utf8'));
const ok=c.baseline_commit==='129e981f24befa061c876399869a92a0fffe0297'&&c.allowed_created_fact_types.length===2&&c.atomic_write_contract.forecast_run_v1_and_twin_state_projection_v1_must_be_created_atomically===true;
console.log(JSON.stringify({ok,acceptance:'P32_01_FORECAST_RUNTIME_CONTRACT',allowed_created_fact_types:c.allowed_created_fact_types},null,2));
if(!ok)process.exit(1);
