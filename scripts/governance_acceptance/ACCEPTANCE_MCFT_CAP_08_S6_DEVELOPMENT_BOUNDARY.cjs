#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='8f9bcfd5b441317649dd7bcbbc28eec0a17f6bf4';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_DEVELOPMENT_BOUNDARY_RESULT.json');
const EXPECTED=[
 '.github/workflows/mcft-cap-08-s6-development-preflight.yml',
 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_DEVELOPMENT_BOUNDARY.cjs',
 'scripts/governance_acceptance/mcft_cap08_s6_two_run_compare.cjs',
 'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FINAL_RUN_RECOVERY_DB.ts',
 'scripts/runtime_acceptance/mcft_cap08_s6_existing_recovery_support_v1.ts',
];
const FROZEN={
 taskbook:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md','a24114ff629560345b3bd3cda6b4024b9f3d61e4'],
 contract:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json','9cecc1aa6bd4063b770304f2539bc68a1ed2390c'],
 review:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REVIEW-POLICY-V1.json','7a2ed8aac94c86c186f4491c5845320bd8b8ad3c'],
 status:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json','d8128c4ec0c68c86b10578a6e0d5544a66a87a38'],
 predecessor:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREDECESSOR-CONSUMPTION-V1.json','bb199f705b08eca9a152d1d91faeb8cc11658b38'],
 frontier:['docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json','385433f57a4393596166c124db7b08a2489b238f'],
 registry:['docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','268844d3e690e5241c94b6453999d9454db6a967'],
};
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(v,null,2)}\n`)}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'S6_DEV_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'S6_DEV_BASE_NOT_ANCESTOR');
 assert.equal(git('diff','--check',`${base}...HEAD`),'','S6_DEV_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'S6_DEV_BOUNDARY');
 assert.equal(changed.length,5);
 for(const [name,[file,sha]] of Object.entries(FROZEN))assert.equal(git('rev-parse',`HEAD:${file}`),sha,`S6_DEV_FROZEN_${name.toUpperCase()}`);
 const source=changed.map(file=>fs.readFileSync(path.join(ROOT,file),'utf8')).join('\n');
 for(const token of ['RUN_A','RUN_B','hard_acceptance_item_count','operator_surface_count','semantic_digest','operational_invariant_digest','closure_digest','product_read_write_delta'])assert.equal(source.includes(token),true,`S6_DEV_TOKEN_${token}`);
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(source.includes(declarationMarker),false);
 assert.equal(changed.some(file=>file.startsWith('apps/')||file.startsWith('db/')||file.includes('migration')||file.includes('/routes/')||file.includes('scheduler')),false);
 const result={schema_version:'geox_mcft_cap08_s6_development_boundary_result_v1',status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:5,changed_files:changed,two_fresh_runs_required:true,hard_acceptance_item_count:24,cap07_get_surface_count:10,independent_review_required_for_formal_candidate:true,candidate_declaration_present:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result));
}catch(error){write({schema_version:'geox_mcft_cap08_s6_development_boundary_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
