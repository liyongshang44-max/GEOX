#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='2e1b14e31a5420dccfd70c4955726427fc29eb7e';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_06_S11D_FINAL_RECONCILIATION_RESULT.json');
const EXPECTED=[
'.github/workflows/mcft-cap-06-s11c-capability-completion-effectiveness-activation.yml',
'.github/workflows/mcft-cap-06-s11d-final-effectiveness-reconciliation.yml',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json',
'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_FINAL_EFFECTIVENESS_RECONCILIATION.cjs'];
const FORBIDDEN=['apps/server/src/','apps/server/scripts/','apps/server/db/migrations/','apps/web/','scripts/runtime_acceptance/','fixtures/','docker/'];
const ZERO=['canonical_fact_append_count','canonical_fact_update_count','canonical_fact_delete_count','candidate_append_count','evaluation_append_count','projection_write_count','model_activation_count','active_config_switch_count','runtime_parameter_change_count','state_mutation_count','checkpoint_mutation_count','migration_count'];
const git=a=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const json=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const text=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const zero=(d,l)=>{for(const k of ZERO)assert.equal(d[k],0,`${l}_${k}`)};
function claims(){const s=text('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');const a=s.indexOf('# 45. Completion Claims Candidate');const b=s.indexOf('# 46. Closure lifecycle',a);const m=s.slice(a,b).match(/```text\s*\n([\s\S]*?MCFT_CAP_07_REMAINS_UNAUTHORIZED[\s\S]*?)```/);assert.ok(m);return m[1].split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function write(r){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(r,null,2)+'\n')}
function main(){
 const base=String(process.env.MCFT_CAP_06_S11D_BASE_REF||BASE).trim();git(['cat-file','-e',`${base}^{commit}`]);
 const raw=git(['diff','--name-only',`${base}...HEAD`]);const changed=raw?raw.split(/\r?\n/).filter(Boolean).sort():[];
 assert.ok(same(changed,EXPECTED),'S11D_CHANGED_FILE_BOUNDARY_INVALID');assert.equal(changed.some(f=>FORBIDDEN.some(p=>f.startsWith(p))),false);
 const c=claims();assert.equal(c.length,48);
 const closure=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CLOSURE-RECORD.json');
 const verify=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-MAIN-VERIFICATION.json');
 const a=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11A-CLOSURE-CANDIDATE-STATUS.json');
 const sc=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11C-CAPABILITY-COMPLETION-EFFECTIVENESS-ACTIVATION-STATUS.json');
 const sd=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S11D-FINAL-EFFECTIVENESS-RECONCILIATION-STATUS.json');
 const frontier=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-AUTHORITY-V2.json');
 const manifest=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASKBOOK-MANIFEST.json');
 const effect=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-FINALIZATION-EFFECTIVENESS.json');
 const recon=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-FINAL-EFFECTIVENESS-RECONCILIATION.json');
 const ledger=json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-HARD-ACCEPTANCE-EVIDENCE-LEDGER.json');
 assert.equal(ledger.total_check_count,255);assert.deepEqual(ledger.status_counts,{PASS:255,FAIL:0,NOT_APPLICABLE:0});
 const pr=sd.reconciliation_pr_number;assert.ok(Number.isInteger(pr)&&pr>0);assert.equal(closure.reconciliation_pr_number,pr);assert.equal(effect.reconciliation_pr_number,pr);assert.equal(recon.pr_number,pr);assert.equal(manifest.s11d.reconciliation_pr_number,pr);
 for(const o of [closure,verify,a,sc,sd,effect,recon]){assert.equal(o.closure_effective,true);assert.equal(o.capability_complete,true);assert.equal(o.active_delivery_slice_id,null);assert.equal(o.runtime_source_authorized,false)}
 assert.equal(frontier.status,'MCFT_CAP_06_COMPLETE');assert.equal(frontier.active_delivery_slice_id,null);assert.equal(frontier.next_repository_action,null);assert.equal(frontier.successor_capability_line_authorized,false);zero(frontier.runtime_delta,'FRONTIER');
 assert.equal(manifest.execution_control.active_delivery_slice_id,null);assert.equal(manifest.execution_control.next_action,null);assert.equal(manifest.terminal_state.status,'COMPLETE');assert.equal(manifest.successor_capability_line_authorized,false);
 assert.deepEqual(closure.pending_completion_claims,[]);assert.deepEqual(closure.effective_completion_claims,c);assert.equal(closure.completion_claim_effective_delta,48);zero(closure.runtime_delta,'CLOSURE');
 assert.equal(verify.completion_claims.pending_count,0);assert.equal(verify.completion_claims.effective_count,48);assert.deepEqual(verify.completion_claims.effective,c);
 for(const o of [a,sc,sd]){assert.equal(o.pending_completion_claim_count,0);assert.equal(o.effective_completion_claim_count,48);assert.equal(o.successor_capability_line_authorized,false);zero(o.runtime_delta,'STATUS')}
 assert.equal(sc.s11c_implementation_merged,true);assert.equal(sc.s11c_merged_main_proven,true);assert.equal(sd.s11c_effectiveness.activation_exact_head,'db3dd2a86cd791c028f064f360165da2bb583497');assert.equal(sd.s11c_effectiveness.activation_merge_commit,'2e1b14e31a5420dccfd70c4955726427fc29eb7e');assert.equal(sd.s11c_effectiveness.postmerge_probe_pr_number,2588);assert.equal(sd.s11c_effectiveness.postmerge_workflow_run,29653411871);assert.equal(sd.s11c_effectiveness.merged_main_gate,'PASS');
 assert.equal(recon.postmerge_ssot_writeback_allowed,false);assert.equal(recon.final_postmerge_probe_disposition,'CLOSE_WITHOUT_MERGE');assert.equal(recon.unknown_s11d_merge_or_postmerge_evidence_recorded,false);assert.equal(effect.unknown_s11d_merge_or_postmerge_evidence_recorded,false);assert.equal(sd.unknown_s11d_merge_or_postmerge_evidence_recorded,false);
 assert.ok(same(closure.exact_changed_file_boundary,EXPECTED));assert.ok(same(verify.exact_changed_file_boundary,EXPECTED));assert.ok(same(effect.exact_changed_file_boundary,EXPECTED));assert.ok(same(recon.exact_changed_file_boundary,EXPECTED));
 const frozen=text('.github/workflows/mcft-cap-06-s11c-capability-completion-effectiveness-activation.yml');assert.ok(frozen.includes('2e1b14e31a5420dccfd70c4955726427fc29eb7e'));assert.ok(frozen.includes('s11c_implementation_merged'));
 const result={schema_version:'geox_mcft_cap_06_s11d_final_reconciliation_result_v1',status:'PASS',baseline:base,exact_head:git(['rev-parse','HEAD']),changed_file_count:changed.length,changed_files:changed,reconciliation_pr_number:pr,hard_acceptance_total_check_count:255,pending_completion_claim_count:0,effective_completion_claim_count:48,closure_effective:true,capability_complete:true,active_delivery_slice_id:null,next_repository_action:null,runtime_source_authorized:false,successor_capability_line_authorized:false,final_postmerge_proof_required:true,postmerge_ssot_writeback_allowed:false,runtime_delta:sd.runtime_delta};write(result);console.log(JSON.stringify(result,null,2));
}
try{main()}catch(e){const r={schema_version:'geox_mcft_cap_06_s11d_final_reconciliation_result_v1',status:'FAIL',error:e instanceof Error?e.message:String(e)};write(r);console.error(JSON.stringify(r,null,2));process.exitCode=1}
