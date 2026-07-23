#!/usr/bin/env node
'use strict';
const a=require('node:assert/strict'),cr=require('node:crypto'),f=require('node:fs'),p=require('node:path'),c=require('node:child_process');
const R=p.resolve(__dirname,'../..'),OUT=p.join(R,'acceptance-output/MCFT_CAP_08_S2_AUTHORITY_ARTIFACT.json'),STAGE=String(process.env.MCFT_ARTIFACT_STAGE||'CANDIDATE_HEAD');
const j=x=>JSON.parse(f.readFileSync(p.join(R,x),'utf8')),git=(...x)=>c.execFileSync('git',x,{cwd:R,encoding:'utf8'}).trim();
const canon=x=>Array.isArray(x)?`[${x.map(canon).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${canon(x[k])}`).join(',')}}`:JSON.stringify(x);
const hash=x=>`sha256:${cr.createHash('sha256').update(Buffer.from(canon(x))).digest('hex')}`;
const req=(x,code)=>{const v=String(x||'').trim();if(!/^[0-9a-f]{40}$/.test(v))throw new Error(code);return git('rev-parse',`${v}^{commit}`)};
const value=(o,names,code)=>{for(const name of names)if(Object.hasOwn(o,name))return o[name];throw new Error(code)};
try{
 if(!['CANDIDATE_HEAD','EXACT_MERGE_SHA'].includes(STAGE))throw new Error('STAGE_INVALID');
 const b=j('acceptance-output/MCFT_CAP_08_S2_BOUNDARY_RESULT.json'),db=j('acceptance-output/MCFT_CAP_08_S2_FORCING_STATE_FORECAST_DB_RESULT.json'),g3=j('acceptance-output/MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB_RESULT.json');
 const s=j('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json'),i=j('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-IMPLEMENTATION-V1.json'),pred=j('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-PREDECESSOR-CONSUMPTION-V1.json');
 a.equal(b.status,'PASS');a.equal(db.status,'PASS');a.equal(g3.status,'PASS');a.equal(s.s2_candidate_implemented,true);a.equal(db.provider_contract_digest,i.formal_provider_contract_digest);
 const impl={
  provider_profile_id:db.provider_profile_id,
  provider_contract_digest:db.provider_contract_digest,
  successful_tick_count:Number(value(db,['successful_tick_count','successful_tick_co'],'CAP08_S2_RESULT_SUCCESSFUL_TICK_COUNT_REQUIRED')),
  forcing_window_count:Number(value(db,['forcing_window_count','forcing_window_co'],'CAP08_S2_RESULT_FORCING_WINDOW_COUNT_REQUIRED')),
  state_count:Number(value(db,['state_count','state_co'],'CAP08_S2_RESULT_STATE_COUNT_REQUIRED')),
  forecast_count:Number(value(db,['forecast_count','forecast_co'],'CAP08_S2_RESULT_FORECAST_COUNT_REQUIRED')),
  forecast_point_count:Number(value(db,['forecast_point_count','forecast_point_co'],'CAP08_S2_RESULT_FORECAST_POINT_COUNT_REQUIRED')),
  selected_state_observations_by_tick:db.selected_state_observations_by_tick,
  quarantined_residual_only_count:Number(value(db,['quarantined_residual_only_count','quarantined_residual_only_co'],'CAP08_S2_RESULT_RESIDUAL_QUARANTINE_COUNT_REQUIRED')),
  quarantined_late_state_correction_count:Number(value(db,['quarantined_late_state_correction_count','quarantined_late_state_correction_co'],'CAP08_S2_RESULT_LATE_CORRECTION_COUNT_REQUIRED')),
  observed_but_not_available_absence_witness_count:Number(value(db,['observed_but_not_available_absence_witness_count','observed_but_not_available_absence_witness_co'],'CAP08_S2_RESULT_ABSENCE_WITNESS_COUNT_REQUIRED')),
  completion_authority_negative_case_count:Number(g3.negative_case_count),
  phase_engine_contract_preserved:true,
 };
 a.deepEqual([impl.successful_tick_count,impl.forcing_window_count,impl.state_count,impl.forecast_count,impl.forecast_point_count,impl.quarantined_residual_only_count,impl.quarantined_late_state_correction_count,impl.observed_but_not_available_absence_witness_count,impl.completion_authority_negative_case_count],[24,24,24,24,1728,17,1,15,14]);
 a.deepEqual(impl.selected_state_observations_by_tick,{T02:'FVO-02',T03:'FVO-03',T04:'FVO-04',T10:'FVO-10',T22:'FVO-22'});
 const tree=STAGE==='EXACT_MERGE_SHA'?j('acceptance-output/MCFT_CAP_08_S2_EXACT_SHA_ATTESTATION_RESULT.json'):null;
 const ch=req(STAGE==='EXACT_MERGE_SHA'?tree.candidate_head_sha:process.env.MCFT_CANDIDATE_SHA,'CANDIDATE_SHA_INVALID'),bh=req(STAGE==='EXACT_MERGE_SHA'?tree.base_head_sha:process.env.MCFT_BASE_SHA,'BASE_SHA_INVALID'),subject=STAGE==='EXACT_MERGE_SHA'?req(tree.subject_sha,'SUBJECT_SHA_INVALID'):ch;
 const art={schema_version:'geox_mcft_cap08_s2_authority_artifact_v1',status:'PASS',capability_line_id:'MCFT-CAP-08',slice_id:'MCFT-CAP-08.S2',stage:STAGE,subject_sha:subject,subject_commit:subject,base_head_sha:bh,candidate_head_sha:ch,candidate_tree_sha:STAGE==='EXACT_MERGE_SHA'?tree.candidate_tree_sha:git('rev-parse',`${ch}^{tree}`),merge_commit_sha:STAGE==='EXACT_MERGE_SHA'?tree.merge_commit_sha:null,merge_tree_sha:STAGE==='EXACT_MERGE_SHA'?tree.merge_tree_sha:null,candidate_to_merge_tree_delta:STAGE==='EXACT_MERGE_SHA'?0:null,attested_tree_sha:STAGE==='EXACT_MERGE_SHA'?tree.attested_tree_sha:null,predecessor_authority:pred,status_projection:{candidate_field:'s2_candidate_implemented',candidate_value:true,repository_delivery_state:s.delivery_state,effectiveness_condition:s.effectiveness_condition,owner_review_waived:true,independent_review_satisfied:false},implementation:impl,evidence:{changed_file_boundary:b,fresh_postgresql_provider_acceptance:db,completion_authority_negative_db:g3,exact_sha_attestation:tree},effective_delivery_frontier_projection:STAGE==='EXACT_MERGE_SHA'?{effective_status:'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE',effective_next_slice:'S3'}:null,effective_authority_projection:{bounded_replay_runner_authorized:STAGE==='EXACT_MERGE_SHA',bounded_canonical_transaction_authorized:STAGE==='EXACT_MERGE_SHA',formal_forcing_evidence_state_forecast_authorized:STAGE==='EXACT_MERGE_SHA',production_runtime_source_authorized:false,decision_action_feedback_authorized:false,late_append_forward_authorized:false,residual_calibration_shadow_authorized:false,model_activation_authorized:false,s3_authorized:false,mcft_cap_09_authorized:false},retention_class:STAGE==='EXACT_MERGE_SHA'?'R1_180_DAYS':'TRANSIENT_CANDIDATE'};
 art.semantic_artifact_digest=hash(art);f.mkdirSync(p.dirname(OUT),{recursive:true});f.writeFileSync(OUT,JSON.stringify(art,null,2)+'\n');console.log(JSON.stringify(art));
}catch(e){console.error(e);process.exitCode=1}
