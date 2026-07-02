// scripts/twin_kernel/P46_ALL_ACCEPTANCE_CHECK.cjs
'use strict';
const cp=require('node:child_process');
const dry=JSON.parse(cp.execFileSync(process.execPath,['scripts/twin_kernel/P46_21_CONTROLLED_RECOMMENDATION_FROM_TWIN_RUNNER_V0.cjs'],{encoding:'utf8'}));
const wr=JSON.parse(cp.execFileSync(process.execPath,['scripts/twin_kernel/P46_21_CONTROLLED_RECOMMENDATION_FROM_TWIN_RUNNER_V0.cjs','--mode','controlled-write'],{encoding:'utf8'}));
const ok=dry.baseline_commit==='a20d83da551604a6900f9f3ee6caa30a001a2b90'&&wr.twin_recommendation_context_v1_created===true&&wr.recommendation_traceability_readback_v1_created===true&&wr.forbidden_downstream_fact_count===0;
console.log(JSON.stringify({ok,acceptance:'P46_ALL_ACCEPTANCE',phase:'P46',assertion_count:4,failed_assertion_count:ok?0:1,failed_assertions:ok?[]:['p46'],dry_run_determinism_hash:dry.determinism_hash,controlled_write_determinism_hash:wr.determinism_hash},null,2));
if(!ok)process.exit(1);
