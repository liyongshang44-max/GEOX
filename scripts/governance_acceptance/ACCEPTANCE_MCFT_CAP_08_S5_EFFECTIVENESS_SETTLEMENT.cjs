#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'../..');
const BASE='1a5d2bb501ada9b6048a7af07b48f89a9dbeaf30';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S5_EFFECTIVENESS_SETTLEMENT_RESULT.json');
const SELF='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S5_EFFECTIVENESS_SETTLEMENT.cjs';
const PREQUAL='.github/workflows/mcft-cap-08-s5-replay-dataset-v2-prequalification.yml';
const EXPECTED=[".github/workflows/mcft-cap-08-current-frontier-reconciliation.yml", ".github/workflows/mcft-cap-08-s5-architecture-deviation-adjudication.yml", PREQUAL, ".github/workflows/mcft-cap-08-s5-replay-dataset-v2-effectiveness-settlement.yml", ".github/workflows/mcft-cap-08-s5-effectiveness-settlement.yml", "docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md", "docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json", "docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json", "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json", "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-EFFECTIVENESS-AUTHORITY-V1.json", SELF];
const P={
 taskbook:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
 registry:'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
 signal:'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json',
 s5status:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-DELIVERY-STATUS-V1.json',
 s6status:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json',
 s6pred:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREDECESSOR-CONSUMPTION-V1.json',
 authority:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S5-EFFECTIVENESS-AUTHORITY-V1.json',
 frontier:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-FRONTIER-V1.json',
 ssot:'docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json',
 matrix:'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json',
 map:'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md'
};
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const show=(ref,f)=>{try{return JSON.parse(git('show',`${ref}:${f}`))}catch{return {}}};
const bool=(o,k,v)=>assert.equal(o[k],v,`S5_SETTLEMENT_${k.toUpperCase()}`);
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')}
function signals(v,c,p=[],out=[]){
 if(Array.isArray(v)){v.forEach((x,i)=>signals(x,c,[...p,String(i)],out));return out}
 if(!v||typeof v!=='object')return out;
 const statuses=new Set(c.explicit_candidate_status_values);
 const names=new Set(c.explicit_candidate_boolean_field_names);
 const patterns=c.explicit_candidate_boolean_field_patterns.map(x=>new RegExp(x));
 for(const [k,x] of Object.entries(v)){
  const q=[...p,k];
  if(x===true&&(names.has(k)||patterns.some(r=>r.test(k))))out.push({field:q.join('.'),value:x,kind:'BOOLEAN'});
  if(typeof x==='string'&&statuses.has(x))out.push({field:q.join('.'),value:x,kind:'STATUS'});
  if(x&&typeof x==='object')signals(x,c,q,out);
 }
 return out;
}
try{
 const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
 assert.equal(base,BASE,'S5_SETTLEMENT_BASE_MISMATCH');
 assert.equal(git('merge-base',base,'HEAD'),base,'S5_SETTLEMENT_BASE_NOT_ANCESTOR');
 const selfSource=fs.readFileSync(path.join(ROOT,SELF),'utf8');
 assert.equal(selfSource.includes('\r'),false,'S5_SETTLEMENT_SELF_CRLF_FORBIDDEN');
 assert.equal(selfSource.split('\n').some(line=>/[ \t]+$/.test(line)),false,'S5_SETTLEMENT_SELF_TRAILING_WHITESPACE');
 assert.equal(git('diff','--check',`${base}...HEAD`,'--','.',`:!${SELF}`),'','S5_SETTLEMENT_DIFF_CHECK');
 const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(changed,[...EXPECTED].sort(),'S5_SETTLEMENT_CHANGED_FILE_BOUNDARY');
 assert.equal(changed.length,11);
 for(const [f,sha] of [
  [P.taskbook,'a24114ff629560345b3bd3cda6b4024b9f3d61e4'],
  [P.registry,'268844d3e690e5241c94b6453999d9454db6a967'],
  [P.signal,'479f258e58482f3596ef3f1b88e27ef109b99d4b'],
  [P.s5status,'80c6be0f991d47f0581151334978889d84dddb92'],
  [P.s6status,'d8128c4ec0c68c86b10578a6e0d5544a66a87a38'],
  [P.s6pred,'bb199f705b08eca9a152d1d91faeb8cc11658b38']
 ])assert.equal(git('rev-parse',`HEAD:${f}`),sha,`S5_SETTLEMENT_FROZEN_BLOB:${f}`);
 assert.equal(changed.some(f=>f.startsWith('apps/')||f.startsWith('db/')||f.includes('migration')||f.includes('/routes/')||f.includes('scheduler')),false);
 const a=read(P.authority),f=read(P.frontier),s=read(P.ssot),m=read(P.matrix),map=fs.readFileSync(path.join(ROOT,P.map),'utf8');
 assert.equal(a.record_status,'S5_EXACT_SHA_EFFECTIVENESS_AUTHORITY');
 assert.equal(a.effective_status,'S5_RESIDUAL_CALIBRATION_SHADOW_IMPLEMENTED_EFFECTIVE');
 assert.equal(a.effective_next_slice,'S6');
 assert.equal(a.subject_sha,BASE);
 assert.equal(a.candidate_head_sha,'2cd307ab6b427eb889e7007f0aaa6e95581252bc');
 assert.equal(a.candidate_tree_sha,'d695db893ad013da404d2818e3730e43fa1c2ac0');
 assert.equal(a.merge_tree_sha,a.candidate_tree_sha);assert.equal(a.candidate_to_merge_tree_delta,0);
 assert.equal(a.exact_sha_status_context,'mcft-cap-08/s5-exact-sha-attestation');
 assert.equal(a.exact_sha_workflow_run_id,30201583365);
 assert.equal(a.github_artifact_id,8631818173);
 assert.equal(a.github_artifact_digest,'sha256:65af28c27b2d14b062bd9431e0d9e7962289cc88ddc730a1a5a0f94a21f0bf0f');
 assert.equal(a.semantic_artifact_digest,'sha256:d62a1ee79d66241ac52e40fd1416350b8d2369c0f0ba3b680104fd1de601b886');
 assert.equal(a.transport_archive_sha256,'sha256:198ccb2f558f6ae1c80ea63bf79e0c846eea7580d2771ca0499f45621a551901');
 assert.equal(a.retention_class,'R1_180_DAYS');bool(a,'immutable_readback_verified',true);bool(a,'locked_version_delete_denied',true);
 assert.deepEqual([a.formal_oracle.residual_count,a.formal_oracle.calibration_case_count,a.formal_oracle.objective_case_count,a.formal_oracle.diagnostic_only_case_count,a.formal_oracle.holdout_case_count,a.formal_oracle.grid_point_count,a.formal_oracle.candidate_parameter_value,a.formal_oracle.sensitive_case_count],[24,16,15,1,8,21,'0.034000',7]);
 assert.equal(a.formal_oracle.candidate_hash,'sha256:56b12214f5c41310f38ce97b8256651aa76ffcd3b0621a1f79b56bbcad42b86a');
 assert.equal(a.formal_oracle.shadow_hash,'sha256:faf7fd5f6856ea008db3e960e82712040feb76d82d4ab2912365805d7ac3cbbd');
 bool(a,'implementation_effectiveness_established',true);bool(a,'s6_implementation_entry_authorized',true);bool(a,'mcft_cap_08_complete',false);bool(a,'mcft_cap_09_authorized',false);
 assert.equal(f.current_effective_slice_id,'MCFT-CAP-08.S5');assert.equal(f.current_effective_status,a.effective_status);assert.equal(f.next_authorized_slice_id,'MCFT-CAP-08.S6');
 bool(f,'s5_delivery_effectiveness_established',true);bool(f,'s5_effective',true);bool(f,'s6_implementation_authorized',true);bool(f,'mcft_cap_08_complete',false);bool(f,'mcft_cap_09_authorized',false);
 assert.equal(f.effective_slices.filter(x=>x.slice_id==='MCFT-CAP-08.S5').length,1);
 assert.equal(f.effective_slices.find(x=>x.slice_id==='MCFT-CAP-08.S5').semantic_artifact_digest,a.semantic_artifact_digest);
 assert.equal(s.settlement_kind,'POST_CAP08_S5_EXACT_SHA_EFFECTIVENESS');assert.equal(s.settlement_subject_main,BASE);
 assert.equal(s.current_frontier.effective_slice_id,'MCFT-CAP-08.S5');assert.equal(s.current_frontier.next_authorized_slice_id,'MCFT-CAP-08.S6');
 bool(s.current_frontier,'s5_effective',true);bool(s.current_frontier,'s6_implementation_authorized',true);bool(s.current_frontier,'mcft_cap_08_complete',false);
 const cap=m.capability_lines.find(x=>x.capability_line_id==='MCFT-CAP-08');
 assert.equal(m.matrix_version,'V2.4');assert.equal(cap.current_effective_slice_id,'MCFT-CAP-08.S5');assert.equal(cap.next_authorized_slice_id,'MCFT-CAP-08.S6');bool(cap,'s5_effective',true);bool(cap,'s6_implementation_authorized',true);bool(cap,'complete',false);
 for(const token of [BASE,String(30201583365),String(8631818173),a.semantic_artifact_digest,'MCFT_CAP_08_S6_FORMAL_CANDIDATE_FROM_EXACT_S5_EFFECTIVE_MAIN'])assert.equal(map.includes(token),true,`S5_SETTLEMENT_MAP_TOKEN:${token}`);
 const c=read(P.signal),added=[];
 for(const file of changed.filter(x=>x.endsWith('.json'))){
  const before=signals(show(base,file),c),after=signals(read(file),c);
  for(const x of after)if(!before.some(y=>y.field===x.field&&JSON.stringify(y.value)===JSON.stringify(x.value)))added.push({file,...x});
 }
 assert.deepEqual(added,[],'S5_SETTLEMENT_CANDIDATE_SIGNAL_FORBIDDEN');
 const source=changed.map(x=>fs.readFileSync(path.join(ROOT,x),'utf8')).join('\n');
 const declarationMarker=['MCFT','CANDIDATE','DECLARATION','V2'].join('_');
 assert.equal(source.includes(declarationMarker),false);
 const s6=read(P.s6status),s6p=read(P.s6pred);
 assert.equal(s6.record_status,'PRE_REGISTERED_FINAL_CLOSURE_STATUS_SEED');bool(s6,'s6_candidate_implemented',false);bool(s6,'implementation_authorized',false);
 assert.equal(s6p.record_status,'PRE_REGISTERED_AWAITING_S5_EXACT_SHA_EFFECTIVENESS');bool(s6p,'predecessor_effectiveness_satisfied',false);bool(s6p,'implementation_entry_authorized',false);
 const result={schema_version:'geox_mcft_cap08_s5_effectiveness_settlement_result_v1',status:'PASS',base_sha:base,subject_sha:git('rev-parse','HEAD'),changed_file_count:11,effective_subject_sha:a.subject_sha,exact_sha_workflow_run_id:a.exact_sha_workflow_run_id,artifact_id:a.github_artifact_id,semantic_artifact_digest:a.semantic_artifact_digest,retention_class:a.retention_class,immutable_readback_verified:true,locked_version_delete_denied:true,current_effective_slice_id:'MCFT-CAP-08.S5',next_authorized_slice_id:'MCFT-CAP-08.S6',new_candidate_signal_count:0,s6_seed_unchanged:true,s6_implementation_authorized:true,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
 write(result);console.log(JSON.stringify(result));
}catch(error){write({schema_version:'geox_mcft_cap08_s5_effectiveness_settlement_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});console.error(error);process.exitCode=1}
