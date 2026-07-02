// scripts/twin_kernel/P45_25_CHECK.cjs
'use strict';
const fs=require('node:fs');
const r=JSON.parse(fs.readFileSync('docs/twin_kernel/P45_POST_ACTIVATION_RUNTIME_OBSERVABILITY_ROLLBACK_READINESS_COMPLETION_REVIEW_V0.json','utf8'));
const ok=r.baseline_commit==='01f09751c7caace409a0d53459a7fcf56378fdb7'&&r.completion_status==='implementation_ready_for_review';
console.log(JSON.stringify({ok,acceptance:'P45_25_COMPLETION_REVIEW_ACCEPTANCE',phase:'P45',assertion_count:2,failed_assertion_count:ok?0:1,failed_assertions:ok?[]:['review']},null,2));
if(!ok)process.exit(1);
