#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_S0_LIVE_TRUSTED_EXERCISE.cjs
// Purpose: prove the same PR contains a trusted negative candidate-integrity head followed by a corrected head.
// Boundary: GitHub read-only evidence inspection; no repository or branch write.
'use strict';
const fs=require('node:fs');const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_07_S0_LIVE_TRUSTED_EXERCISE_RESULT.json');
const probe=path.join(ROOT,'docs/digital_twin/mcft/cap_07/testing/GEOX-MCFT-CAP-07-S0-UNREGISTERED-PROBE.json');
const write=(v)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');};
async function api(p){const r=await fetch(`https://api.github.com${p}`,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'geox-mcft-cap07-s0-live-v1'}});if(!r.ok)throw new Error(`GITHUB_API:${r.status}:${p}:${(await r.text()).slice(0,300)}`);return r.json();}
(async()=>{try{
 const current=process.env.GITHUB_SHA||''; if(fs.existsSync(probe)){write({schema_version:'geox_mcft_cap_07_s0_live_trusted_exercise_v1',status:'PASS',phase:'NEGATIVE_INTERMEDIATE_HEAD',subject_commit:current,expected_trusted_result:'mcft-candidate-integrity-enforce-current-pr FAIL'});console.log('PASS negative intermediate head captured');return;}
 const repo=process.env.GITHUB_REPOSITORY; const pr=process.env.MCFT_PR_NUMBER;
 if(process.env.MCFT_LIVE_EXERCISE_REQUIRED==='false'){write({schema_version:'geox_mcft_cap_07_s0_live_trusted_exercise_v1',status:'PASS',phase:'MERGE_GROUP_STATIC_CONTINUATION',subject_commit:current,reason:'PR-level trusted negative-to-corrected evidence is enforced on pull_request exact heads'});console.log('PASS merge-group static continuation');return;}
 if(!repo||!pr||!process.env.GITHUB_TOKEN)throw new Error('LIVE_EXERCISE_GITHUB_CONTEXT_REQUIRED');
 const commits=await api(`/repos/${repo}/pulls/${pr}/commits?per_page=100`); const negative=commits.find(c=>String(c.commit?.message||'').includes('exercise unregistered candidate rejection')); if(!negative)throw new Error('NEGATIVE_INTERMEDIATE_COMMIT_NOT_FOUND');
 const suites=await api(`/repos/${repo}/commits/${negative.sha}/check-runs?per_page=100`); const failed=suites.check_runs.find(x=>String(x.name).includes('mcft-candidate-integrity-enforce-current-pr')&&['failure','cancelled','timed_out','action_required'].includes(x.conclusion)); if(!failed)throw new Error('TRUSTED_NEGATIVE_CHECK_FAILURE_NOT_FOUND');
 write({schema_version:'geox_mcft_cap_07_s0_live_trusted_exercise_v1',status:'PASS',phase:'CORRECTED_FINAL_HEAD',subject_commit:current,negative_head:negative.sha,negative_check_run_id:failed.id,negative_check_conclusion:failed.conclusion,negative_probe_absent:true,current_head_requires_independent_trusted_checks:true}); console.log(`PASS trusted negative head ${negative.sha}`);
}catch(e){write({schema_version:'geox_mcft_cap_07_s0_live_trusted_exercise_v1',status:'FAIL',error:String(e&&e.message||e)});console.error(e);process.exit(1);}})();
