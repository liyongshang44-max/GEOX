#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S5_AUTHORITY_ARTIFACT.json');
const STAGE=String(process.env.MCFT_ARTIFACT_STAGE||'CANDIDATE_HEAD');
const read=(f)=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
const digest=(v)=>`sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(v))).digest('hex')}`;
function commit(v,c){const s=String(v||'').trim();assert.match(s,/^[0-9a-f]{40}$/,c);return git('rev-parse',`${s}^{commit}`)}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(v,null,2)}\n`);}

try {
  assert.ok(['CANDIDATE_HEAD','EXACT_MERGE_SHA'].includes(STAGE),'S5_ARTIFACT_STAGE_INVALID');
  const result=read('acceptance-output/MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_RESULT.json');
  const boundary=read('acceptance-output/MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY_RESULT.json');
  const status=read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json');
  const impl=read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json');
  const pred=read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json');
  const waiver=read('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json');
  assert.equal(result.status,'PASS');
  assert.equal(boundary.status,'PASS');
  assert.equal(result.residual_count,24);
  assert.equal(result.calibration_case_count,16);
  assert.equal(result.objective_case_count,15);
  assert.equal(result.diagnostic_only_case_count,1);
  assert.equal(result.holdout_case_count,8);
  assert.equal(result.candidate_parameter_value,'0.034000');
  assert.equal(result.counts.candidate_facts,1);
  assert.equal(result.counts.shadow_facts,1);
  assert.equal(result.model_activation_count,0);
  assert.equal(result.active_runtime_config_switch_count,0);
  assert.equal(status.s5_candidate_implemented,true);
  assert.equal(status.s5_effective,false);
  assert.equal(status.s6_authorized,false);
  assert.equal(pred.source_merge_subject_sha,'b94d299851744f589d3c3a6e35111a22c17c79d0');
  assert.equal(pred.source_artifact_id,'8629453895');
  assert.equal(pred.source_artifact_readback_verified,true);

  let base,candidate,subject,mergeTree=null,candidateTree,treeDelta=null;
  if(STAGE==='EXACT_MERGE_SHA'){
    subject=commit(process.env.MCFT_SUBJECT_SHA||git('rev-parse','HEAD'),'S5_ARTIFACT_SUBJECT_INVALID');
    const parents=git('rev-list','--parents','-n','1',subject).split(/\s+/);
    assert.equal(parents.length,3,'S5_ARTIFACT_TWO_PARENT_MERGE_REQUIRED');
    base=commit(parents[1],'S5_ARTIFACT_BASE_INVALID');
    candidate=commit(parents[2],'S5_ARTIFACT_CANDIDATE_INVALID');
    assert.equal(git('rev-parse',`${candidate}^`),base,'S5_ARTIFACT_CANDIDATE_PARENT');
    assert.equal(git('rev-list','--count',`${base}..${candidate}`),'1','S5_ARTIFACT_CANDIDATE_COMMIT_COUNT');
    candidateTree=git('rev-parse',`${candidate}^{tree}`);
    mergeTree=git('rev-parse',`${subject}^{tree}`);
    assert.equal(candidateTree,mergeTree,'S5_ARTIFACT_TREE_MISMATCH');
    treeDelta=0;
  } else {
    candidate=commit(process.env.MCFT_CANDIDATE_SHA,'S5_ARTIFACT_CANDIDATE_INVALID');
    base=commit(process.env.MCFT_BASE_SHA,'S5_ARTIFACT_BASE_INVALID');
    assert.equal(git('rev-parse',`${candidate}^`),base,'S5_ARTIFACT_CANDIDATE_PARENT');
    assert.equal(git('rev-list','--count',`${base}..${candidate}`),'1','S5_ARTIFACT_CANDIDATE_COMMIT_COUNT');
    subject=candidate;
    candidateTree=git('rev-parse',`${candidate}^{tree}`);
  }
  const review={
    mode:'OWNER_WAIVED_DEFERRED_TO_S6',
    required:false,satisfied:false,performed:false,waived:true,
    technical_gate_relaxation:false,retroactive_exact_head_approval_claim_allowed:false,
    final_s6_independent_review_required:true,
    policy_id:waiver.policy_id,owner_directive_issue_ref:waiver.owner_directive_issue_ref
  };
  const semantic={
    schema_version:'geox_mcft_cap08_s5_authority_artifact_v2',
    status:'PASS',
    capability_line_id:'MCFT-CAP-08',
    slice_id:'MCFT-CAP-08.S5',
    stage:STAGE,
    subject_sha:subject,
    base_head_sha:base,
    candidate_head_sha:candidate,
    candidate_tree_sha:candidateTree,
    merge_commit_sha:STAGE==='EXACT_MERGE_SHA'?subject:null,
    merge_tree_sha:mergeTree,
    candidate_to_merge_tree_delta:treeDelta,
    workflow_run_id:Number(process.env.GITHUB_RUN_ID||0),
    workflow_run_attempt:Number(process.env.GITHUB_RUN_ATTEMPT||0),
    predecessor_authority:pred,
    changed_file_boundary:boundary,
    implementation_contract:impl,
    residual_count:24,
    calibration_case_count:16,
    objective_case_count:15,
    diagnostic_only_case_count:1,
    diagnostic_only_observation_refs:['FVO-10'],
    holdout_case_count:8,
    grid_point_count:21,
    candidate_parameter_value:'0.034000',
    sensitive_case_count:7,
    sensitive_wetness_regimes:['HIGH_EXCESS','MID_EXCESS'],
    candidate_ref:result.candidate_ref,
    candidate_hash:result.candidate_hash,
    shadow_ref:result.shadow_ref,
    shadow_hash:result.shadow_hash,
    residual_refs:result.residual_refs,
    residual_hashes:result.residual_hashes,
    completed_rerun_write_count:0,
    candidate_append_count:1,
    shadow_append_count:1,
    model_activation_count:0,
    active_runtime_config_switch_count:0,
    state_pointer_delta:0,
    checkpoint_pointer_delta:0,
    independent_review:review,
    owner_waiver:review,
    effective_delivery_frontier_projection:STAGE==='EXACT_MERGE_SHA'?{
      effective_status:'S5_RESIDUAL_CALIBRATION_SHADOW_IMPLEMENTED_EFFECTIVE',
      effective_next_slice:'S6',
      s5_candidate_implemented:true,
      s5_effective:true,
      s6_implementation_authorized:true,
      mcft_cap_08_complete:false,
      mcft_cap_09_authorized:false
    }:null,
    effective_authority_projection:{
      residual_calibration_shadow_authorized:STAGE==='EXACT_MERGE_SHA',
      model_activation_authorized:false,
      active_runtime_config_switch_authorized:false,
      production_runtime_source_authorized:false,
      s6_authorized:STAGE==='EXACT_MERGE_SHA',
      mcft_cap_09_authorized:false
    },
    retention_class:STAGE==='EXACT_MERGE_SHA'?'R1_180_DAYS':'TRANSIENT_CANDIDATE'
  };
  const artifact={...semantic,semantic_artifact_digest:digest(semantic)};
  write(artifact);console.log(JSON.stringify(artifact));
} catch(error) {
  write({schema_version:'geox_mcft_cap08_s5_authority_artifact_v2',status:'FAIL',error:error instanceof Error?error.message:String(error)});
  console.error(error);process.exitCode=1;
}
