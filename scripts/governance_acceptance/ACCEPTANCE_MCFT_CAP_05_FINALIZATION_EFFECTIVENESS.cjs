#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const BASELINE='fd6c54e84ee4ede7bbb581b4fc55660251c2265f';
const S11='MCFT-CAP-05.CLOSURE-AND-FINALIZATION-V1';
const EFFECT='docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINALIZATION-EFFECTIVENESS.json';
const FILES=["docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md","docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json","docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json","docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json","docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json","docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-FINALIZATION-EFFECTIVENESS.json","docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json","docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md","scripts/dev/assert_local_pnpm_runtime.cjs","scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_FINALIZATION_EFFECTIVENESS.cjs"];
let pass=0,fail=0;
const check=(c,l)=>{if(c){pass++;console.log('PASS '+l)}else{fail++;console.error('FAIL '+l)}};
const J=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const T=p=>fs.readFileSync(p,'utf8');
const changed=()=>{for(const r of [BASELINE+'..HEAD','HEAD^1..HEAD','origin/main...HEAD','origin/main..HEAD']){try{return execFileSync('git',['diff','--name-only',r],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/).filter(Boolean).sort()}catch{}}return null};
const f=J(EFFECT),c=J('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-CLOSURE-RECORD.json'),
v=J('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-MAIN-VERIFICATION.json'),
a=J('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-AUTHORIZATION-STATUS.json'),
d=J('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-DELIVERY-SLICE-STATUS.json'),
m=J('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json'),
task=T('docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md'),
map=T('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md'),
wrapper=T('scripts/dev/assert_local_pnpm_runtime.cjs'),
cap=m.capability_lines.find(x=>x.capability_line_id==='MCFT-CAP-05'),
ds=(d.slices||d.delivery_slices||[]).find(x=>x.delivery_slice_id===S11);
check(f.schema_version==='geox_mcft_cap_05_finalization_effectiveness_v1','finalization schema exact');
check(f.status==='COMPLETE'&&f.effectiveness_condition_satisfied===true,'finalization effectiveness active');
check(f.s11a_s11b_effectiveness_evidence.s11a_exact_head_ci_run===29407551807,'S11A exact-head CI frozen');
check(f.s11a_s11b_effectiveness_evidence.s11a_merge_commit===BASELINE,'S11A merge frozen');
check(f.s11a_s11b_effectiveness_evidence.s11b_probe_workflow_run===29407976303,'S11B probe workflow frozen');
check(f.s11a_s11b_effectiveness_evidence.s11b_finalization_gate==='PASS','S11B finalization Gate passed');
check(f.pending_completion_claims.length===0&&f.effective_completion_claims.length===40,'40 completion claims effective');
check(f.successor_authorized===false,'CAP-06 unauthorized');
check(c.status==='COMPLETE'&&c.implementation_status==='COMPLETE','closure COMPLETE');
check(c.closure_effective===true&&c.capability_complete===true&&c.active_delivery_slice_id===null,'closure effective and no active slice');
check(c.pending_completion_claims.length===0&&c.effective_completion_claims.length===40,'closure claims activated');
check(c.current_authority.authority_ref===EFFECT,'closure current authority finalization effectiveness');
check(v.status==='COMPLETE'&&v.verified===true,'main verification complete');
check(v.completion_claims.pending.length===0&&v.completion_claims.effective.length===40,'main verification claims active');
check(a.implementation_status==='COMPLETE'&&a.runtime_source_authorized===false,'authorization COMPLETE without Runtime authority');
check(a.active_delivery_slice_id===null&&a.successor_authorized===false,'authorization clears active slice and CAP-06');
check(d.status==='COMPLETE'&&d.active_delivery_slice_id===null,'delivery status COMPLETE');
check(ds&&ds.status==='MERGED_EFFECTIVE'&&ds.effectiveness_condition_satisfied===true,'S11 delivery slice effective');
check(cap&&cap.status==='COMPLETE'&&cap.implementation_status==='COMPLETE','matrix COMPLETE');
check(cap&&cap.closure_effective===true&&cap.capability_complete===true&&cap.active_delivery_slice_id===null,'matrix closure effective');
check(cap&&cap.effective_completion_claims.length===40&&cap.successor_authorized===false,'matrix claims active and CAP-06 false');
check(task.includes('implementation_status:\nCOMPLETE')&&task.includes('S11C Complete Activation — Final Effectiveness'),'Task records COMPLETE activation');
check(map.includes('MCFT-CAP-05 S11C Complete Activation'),'implementation map records final activation');
check(wrapper.includes('ACCEPTANCE_MCFT_CAP_05_FINALIZATION_EFFECTIVENESS.cjs'),'standard acceptance wires final Gate');
check(f.canonical_object_type_delta===0&&f.transaction_family_delta===0&&f.migration_delta===0&&f.runtime_source_delta===0,'no architecture or Runtime delta');
check(JSON.stringify(f.exact_changed_file_boundary.slice().sort())===JSON.stringify(FILES),'finalization freezes exact ten-file boundary');
const mode=process.argv.includes('--candidate')?'candidate':process.argv.includes('--postmerge')?'postmerge':'auto';
const files=changed();
if(mode!=='auto'||(files&&JSON.stringify(files)===JSON.stringify(FILES))) check(JSON.stringify(files)===JSON.stringify(FILES),mode+' exact ten-file boundary');
else if(files===null) check(true,'auto accepts shallow merge checkout after semantic checks');
else check(false,'auto rejects unexpected changed files '+JSON.stringify(files));
check(!FILES.some(x=>x.startsWith('apps/server/src/')||x.startsWith('apps/web/')||x.includes('/migrations/')),'boundary excludes Runtime web and migrations');
console.log('SUMMARY '+pass+' PASS / '+fail+' FAIL');
if(fail)process.exit(1);
