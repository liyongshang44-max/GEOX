#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='1a6ff1b3c2b9974f859fe473b09a49a5c8fdb678';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY_RESULT.json');
const EXPECTED=[
'.github/workflows/mcft-cap-08-s5-pre-candidate-governance.yml',
'.github/workflows/mcft-cap-08-s5-residual-calibration-shadow.yml',
'.github/workflows/mcft-cap-08-s5-exact-sha-attestation.yml',
'apps/server/src/domain/calibration/cap08_s5_case_builder_v1.ts',
'apps/server/src/domain/calibration/cap08_s5_envelope_profiles_v1.ts',
'apps/server/src/domain/calibration/cap08_s5_objective_grid_search_v1.ts',
'apps/server/src/domain/twin_runtime/cap08_s5_replay_dataset_v2_authority_v1.ts',
'apps/server/src/domain/twin_runtime/cap08_s5_residual_calibration_shadow_contracts_v1.ts',
'apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts',
'apps/server/src/persistence/twin_runtime/postgres_cap08_s5_exact_source_v1.ts',
'apps/server/src/runtime/twin_runtime/cap08_s5_replay_prediction_adapter_v1.ts',
'apps/server/src/runtime/twin_runtime/cap08_s5_residual_calibration_shadow_service_v1.ts',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json',
'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json',
'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY.cjs',
'scripts/governance_acceptance/mcft_cap08_s5_artifact_finalize.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_V2_FORMAL_PREFLIGHT_DB.ts',
'scripts/runtime_acceptance/mcft_cap08_s5_v2_formal_acceptance_support_v1.ts'];
const P={
taskbook:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
contract:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CONTRACT-V1.json',
registry:'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
signal:'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json',
s6:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
frontier:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json',
status:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
pred:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-PREDECESSOR-CONSUMPTION-V1.json',
impl:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-IMPLEMENTATION-V1.json',
flows:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-WORKFLOW-DECLARATION-V1.json'};
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const bool=(o,k,v)=>assert.equal(o[k],v,`S5_FORMAL_${k.toUpperCase()}`);
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(v,null,2)}\n`)}
function signals(v,c,p=[],out=[]){
 if(Array.isArray(v)){v.forEach((x,i)=>signals(x,c,[...p,String(i)],out));return out}
 if(!v||typeof v!=='object')return out;
 const statuses=new Set(c.explicit_candidate_status_values),names=new Set(c.explicit_candidate_boolean_field_names);
 const patterns=c.explicit_candidate_boolean_field_patterns.map(x=>new RegExp(x));
 for(const [k,x] of Object.entries(v)){const q=[...p,k];
  if(x===true&&(names.has(k)||patterns.some(r=>r.test(k))))out.push({field:q.join('.'),value:x,kind:'BOOLEAN'});
  if(typeof x==='string'&&statuses.has(x))out.push({field:q.join('.'),value:x,kind:'STATUS'});
  if(x&&typeof x==='object')signals(x,c,q,out);
 } return out;
}
function at(ref,f){try{return JSON.parse(git('show',`${ref}:${f}`))}catch{return {}}}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE);assert.equal(git('merge-base',base,'HEAD'),base);assert.equal(git('diff','--check',`${base}...HEAD`),'');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort());assert.equal(changed.length,21);
 assert.equal(git('rev-parse',`HEAD:${P.taskbook}`),'a24114ff629560345b3bd3cda6b4024b9f3d61e4');
 assert.equal(git('rev-parse',`HEAD:${P.contract}`),'ff682f21692859c8121c89611cec561ff491cfb8');
 for(const f of [P.registry,P.signal,P.s6,P.frontier])assert.equal(git('rev-parse',`HEAD:${f}`),git('rev-parse',`${base}:${f}`));
 assert.equal(changed.some(f=>f.includes('migration')||f.startsWith('apps/web/')||f.includes('/routes/')||f.includes('scheduler')),false);
 const b=read(P.boundary),s=read(P.status),p=read(P.pred),i=read(P.impl),w=read(P.flows),c=read(P.signal);
 assert.deepEqual(b.changed_files,EXPECTED);assert.equal(b.changed_file_count,21);assert.equal(b.runtime_source_file_count,9);
 bool(b,'candidate_declaration_required',true);bool(b,'registered_candidate_signal_confined_to_delivery_status',true);
 assert.equal(b.duplicate_explicit_candidate_signal_count,0);bool(b,'s5_effective',false);bool(b,'s6_authorized',false);
 assert.equal(s.record_status,'FORMAL_S5_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
 assert.equal(s.delivery_state,'FORMAL_IMPLEMENTATION_PREPARED_NOT_EFFECTIVE');
 for(const [k,v] of Object.entries({s5_candidate_implemented:true,implementation_authorized:true,runtime_source_authorized:true,
 bounded_canonical_transaction_authorized:true,independent_review_required:false,independent_review_satisfied:false,
 independent_review_performed:false,independent_review_waived:true,technical_gate_relaxation:false,
 final_s6_independent_review_required:true,residual_calibration_shadow_authorized:true,
 production_runtime_source_authorized:false,s5_effective:false,s6_authorized:false,mcft_cap_09_authorized:false}))bool(s,k,v);
 assert.deepEqual([s.residual_count_expected,s.calibration_case_count_expected,s.objective_case_count_expected,
 s.diagnostic_only_case_count_expected,s.holdout_case_count_expected,s.calibration_candidate_count_expected,
 s.shadow_evaluation_count_expected,s.model_activation_count_expected,s.active_runtime_config_switch_count_expected],
 [24,16,15,1,8,1,1,0,0]);
 const added=[];
 for(const f of changed.filter(x=>/^docs\/digital_twin\/mcft\/cap_08\/.+\.json$/.test(x))){
  const before=signals(at(base,f),c),after=signals(read(f),c);
  for(const x of after)if(!before.some(y=>y.field===x.field&&JSON.stringify(y.value)===JSON.stringify(x.value)))added.push({file:f,...x});
 }
 assert.deepEqual(added,[{file:P.status,field:'s5_candidate_implemented',value:true,kind:'BOOLEAN'}]);
 assert.equal(p.record_status,'REPLAY_DATASET_V2_PREQUALIFICATION_EFFECTIVENESS_CONSUMED');
 assert.equal(p.source_merge_subject_sha,'b94d299851744f589d3c3a6e35111a22c17c79d0');
 assert.equal(String(p.source_exact_sha_workflow_run_id),'30193754069');assert.equal(String(p.source_artifact_id),'8629453895');
 assert.equal(p.source_semantic_artifact_digest,'sha256:e9df0575852aecdc66ce1271a7c4cec551e01997dbb8f886a9353844a5799f55');
 for(const k of ['source_artifact_readback_verified','source_locked_version_delete_denied','predecessor_effectiveness_satisfied','implementation_entry_authorized','formal_candidate_authorized'])bool(p,k,true);
 assert.equal(i.base_sha,base);assert.equal(i.preflight_provenance.head_sha,'62c77da3634997f32f1f5840a813344c1f7ff483');
 assert.equal(i.preflight_provenance.tree_sha,'a3604fa43c7caf9dcd52668f8c8ca448a290d366');
 assert.equal(i.preflight_provenance.prior_evidence_is_not_candidate_proof,true);
 assert.deepEqual([i.formal_oracle.residual_count,i.formal_oracle.calibration_case_count,i.formal_oracle.objective_case_count,
 i.formal_oracle.diagnostic_only_case_count,i.formal_oracle.holdout_case_count,i.formal_oracle.grid_point_count,
 i.formal_oracle.candidate_parameter_value,i.formal_oracle.sensitive_case_count],[24,16,15,1,8,21,'0.034000',7]);
 assert.deepEqual(i.formal_oracle.diagnostic_only_observation_refs,['FVO-10']);
 assert.deepEqual(i.formal_oracle.sensitive_wetness_regimes,['HIGH_EXCESS','MID_EXCESS']);
 assert.equal(i.formal_oracle.candidate_hash,'sha256:56b12214f5c41310f38ce97b8256651aa76ffcd3b0621a1f79b56bbcad42b86a');
 assert.equal(i.formal_oracle.shadow_hash,'sha256:faf7fd5f6856ea008db3e960e82712040feb76d82d4ab2912365805d7ac3cbbd');
 assert.equal(i.persistence_oracle.model_activation_count,0);assert.equal(i.persistence_oracle.active_runtime_config_switch_count,0);
 assert.equal(w.record_status,'FORMAL_CANDIDATE_WORKFLOWS_PRESENT_NOT_EFFECTIVE');
 assert.deepEqual(w.required_pull_request_workflows,['mcft-cap-08-s5-residual-calibration-shadow','ci']);
 const result={schema_version:'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',status:'PASS',
 base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:21,changed_files:changed,
 registered_candidate_signal_count:1,registered_candidate_signal:added[0],
 predecessor_subject_sha:p.source_merge_subject_sha,candidate_parameter_value:i.formal_oracle.candidate_parameter_value,
 candidate_ref:i.formal_oracle.candidate_ref,shadow_ref:i.formal_oracle.shadow_ref,
 owner_review_waived:true,s5_effective:false,s6_authorized:false,
 production_runtime_source_authorized:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result));
}catch(error){write({schema_version:'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',status:'FAIL',
 error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
