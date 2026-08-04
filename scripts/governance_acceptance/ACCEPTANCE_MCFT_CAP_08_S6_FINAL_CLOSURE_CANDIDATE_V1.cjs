#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),BASE=process.env.MCFT_BASE_SHA,EXACT=process.env.MCFT_EXACT_SHA;
const S='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json';
const E='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FINAL-CLOSURE-EVIDENCE-V1.json';
const L='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARD-ACCEPTANCE-LEDGER-V1.json';
const B='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CANDIDATE-BOUNDARY-V1.json';
const C='docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json';
const load=p=>JSON.parse(fs.readFileSync(path.resolve(ROOT,p),'utf8'));
const git=(...a)=>cp.execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const zipsha=p=>`sha256:${crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}`;
function bundle(label,root,exp){
 const result=JSON.parse(fs.readFileSync(path.join(root,`MCFT_CAP_08_S6_RUN_${label}_DATABASE_EXECUTION_RESULT.json`),'utf8'));
 const data=JSON.parse(fs.readFileSync(path.join(root,`MCFT_CAP_08_S6_RUN_${label}_FINAL_FORMAL_RUN_BUNDLE.json`),'utf8'));
 const wit=JSON.parse(fs.readFileSync(path.join(root,`run-${label.toLowerCase()}`,'WITNESS_EVALUATION_RESULT.json'),'utf8'));
 assert.equal(result.status,'PASS'); assert.equal(result.execution_mode,'FINAL_FORMAL');
 assert.equal(result.evidence_class,'FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS');
 assert.equal(result.exact_subject_sha,'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59');
 assert.equal(result.run_label,`RUN_${label}`); assert.equal(result.hard_acceptance_eligible,true);
 assert.equal(result.formal_evidence_eligible,true); assert.equal(result.bootstrap_fact_count,11);
 assert.equal(result.phase_count,28); assert.equal(result.canonical_receipt_count,153);
 assert.equal(result.operational_event_count,224); assert.equal(result.recovery_vector_count,7);
 assert.equal(result.cap07_surface_count,10); assert.equal(result.cap07_request_variant_count,11);
 assert.equal(result.per_run_witness_count,22); assert.equal(result.exact_witness_producer_path_executed,true);
 assert.equal(result.synthetic_witness_producer_used,false); assert.equal(result.artifact_digest,exp.formal_artifact_digest);
 assert.equal(result.operational_run_instance_id,exp.operational_run_instance_id);
 assert.equal(result.logical_database_identity,exp.logical_database_identity);
 assert.equal(result.physical_database_name,exp.physical_database_name);
 assert.equal(data.classification,'FINAL_FORMAL'); assert.equal(data.hard_acceptance_eligible,true);
 assert.equal(data.fresh_database.fresh,true); assert.equal(data.receipt_manifest.receipt_count,153);
 const o=data.receipt_manifest.oracle_counts;
 for(const [k,v] of Object.entries({BOOTSTRAP_ROOT:1,RUNTIME_TICK:24,FORECAST_RUN:24,SCENARIO_SET:24,FORECAST_VERIFICATION_OBSERVATION:24,FORECAST_RESIDUAL:24,CALIBRATION_CANDIDATE:1,SHADOW_EVALUATION:1,MODEL_ACTIVATION:0,RECOMMENDATION:0,AO_ACT:0,DISPATCH:0})) assert.equal(o[k],v,k);
 assert.equal(data.recovery.results.length,7); for(const x of data.recovery.results){assert.equal(x.status,'PASS');assert.equal(x.silent_repair_used,false);assert.equal(x.canonical_write_delta,0);}
 assert.equal(data.cap07.surface_definition_count,10); assert.equal(data.cap07.request_variant_count,11);
 assert.equal(data.cap07.pagination_until_cursor_null,true); assert.equal(data.cap07.product_read_write_delta,0);
 assert.equal(data.cap07.canonical_fact_write_delta,0); assert.equal(data.cap07.projection_write_delta,0);
 assert.equal(wit.status,'PASS'); assert.equal(wit.witness_count,22); assert.equal(wit.status_counts.PASS,22);
 assert.equal(wit.semantic_failure_count,0); assert.equal(wit.eligibility_failure_count,0);
 return {formal_run_id:result.formal_run_id,operational:result.operational_run_instance_id,logical:result.logical_database_identity,physical:result.physical_database_name,database:result.database_instance_digest};
}
try{
 assert.match(BASE,/^[0-9a-f]{40}$/); assert.match(EXACT,/^[0-9a-f]{40}$/); assert.equal(git('rev-parse','HEAD'),EXACT);
 const frozen={
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md':'a24114ff629560345b3bd3cda6b4024b9f3d61e4',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json':'47ff4215d711b229604b29ce6c663e62b59efc39',
 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json':'823c8afc5b149daad7b9635618d33d2eac1b2088',
 'docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json':'479f258e58482f3596ef3f1b88e27ef109b99d4b',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-011-FORMAL-RUN-A-SUCCESS-V1.json':'aec6a5d6ad91687c7f404f1638eecb0600c25df4',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-011-RUN-A-AUTHORITY-CONSUMPTION-V1.json':'13480ddf62fafc9b408988d89c4f8038c7f16eff',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-001-FORMAL-RUN-B-SUCCESS-V1.json':'a0ae9603622c195d54d7f0f96bdf022b652bed4b',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-001-RUN-B-AUTHORITY-CONSUMPTION-V1.json':'0a00095030734b7147c32829a2d32bc4d2a4a469',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-SUCCESS-SETTLEMENT-V1.json':'4c91f0f325d65cf99f1d84f7b4ab5d509dc24374',
 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-CONSUMPTION-V1.json':'59c07812c60eb47d4940d1102f235f03958c88e5'};
 for(const [p,s] of Object.entries(frozen)) assert.equal(git('rev-parse',`HEAD:${p}`),s,`DRIFT:${p}`);
 assert.equal(JSON.parse(git('show',`${BASE}:${S}`)).s6_candidate_implemented,false);
 const s=load(S),e=load(E),l=load(L),b=load(B),signal=load(C);
 assert.equal(s.s6_candidate_implemented,true); assert.equal(s.delivery_state,'AWAITING_EXACT_SHA_R2_ATTESTATION');
 assert.equal(signal.explicit_candidate_status_values.includes(s.delivery_state),false);
 assert.equal(s.delivery_state.includes('CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE'),false);
 assert.equal(s.externally_effective,false); assert.equal(s.independent_review_required,false);
 assert.equal(s.technical_gate_relaxation,false); assert.equal(s.required_closure_retention_level,'R2');
 assert.equal(s.required_closure_retention_days,730); assert.equal(s.candidate_hard_acceptance_pass_count,24);
 assert.equal(s.mcft_cap_08_complete,false); assert.equal(s.mcft_cap_09_authorized,false);
 assert.equal(e.candidate_base_main_sha,BASE); assert.equal(e.formal_comparator.status,'PASS');
 assert.equal(e.formal_comparator.semantic_equivalence,true); assert.equal(e.formal_comparator.difference_count,0);
 assert.equal(e.formal_comparator.remaining_execution_count,0); assert.equal(e.candidate_resolution.hard_acceptance_pass_count,24);
 assert.equal(l.candidate_item_count,24); assert.equal(l.candidate_pass_count,24); assert.equal(l.items.length,24);
 assert.equal(new Set(l.items.map(x=>x.item_id)).size,24); for(const x of l.items){assert.equal(x.candidate_status,'PASS');assert.equal(x.effective_status,'PENDING_EXACT_SHA_R2');}
 const actual=git('diff','--name-only',`${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
 assert.deepEqual(actual,b.changed_files); assert.equal(actual.length,8); assert.equal(b.runtime_source_changed,false);
 assert.equal(zipsha(process.env.MCFT_RUN_A_ZIP),e.formal_runs.run_a.github_artifact_digest);
 assert.equal(zipsha(process.env.MCFT_RUN_B_ZIP),e.formal_runs.run_b.github_artifact_digest);
 assert.equal(zipsha(process.env.MCFT_COMPARATOR_ZIP),e.formal_comparator.github_artifact_digest);
 const a=bundle('A',process.env.MCFT_RUN_A_DIR,e.formal_runs.run_a),z=bundle('B',process.env.MCFT_RUN_B_DIR,e.formal_runs.run_b);
 assert.equal(a.formal_run_id,z.formal_run_id); assert.notEqual(a.operational,z.operational); assert.notEqual(a.logical,z.logical); assert.notEqual(a.physical,z.physical); assert.notEqual(a.database,z.database);
 const c=JSON.parse(fs.readFileSync(path.join(process.env.MCFT_COMPARATOR_DIR,'acceptance-output/MCFT_CAP_08_S6_FORMAL_CROSS_RUN_COMPARATOR_RESULT.json'),'utf8'));
 const p=JSON.parse(fs.readFileSync(path.join(process.env.MCFT_COMPARATOR_DIR,'acceptance-input/FORMAL_COMPARATOR_INPUT_AUDIT.json'),'utf8'));
 assert.equal(c.status,'PASS');assert.equal(c.semantic_equivalence,true);assert.equal(c.difference_count,0);assert.equal(c.semantic_digest_a,c.semantic_digest_b);assert.equal(c.independent_database_instances,true);assert.equal(c.execution_count_consumed,1);assert.equal(c.rerun_authorized,false);assert.equal(p.status,'PASS');
 const out={schema_version:'geox_mcft_cap08_s6_final_closure_candidate_qualification_v2',status:'PASS',base_main_sha:BASE,candidate_head_sha:EXACT,candidate_tree_sha:git('rev-parse','HEAD^{tree}'),changed_file_count:8,registered_candidate_signal_field:'s6_candidate_implemented',descriptive_delivery_state:s.delivery_state,descriptive_delivery_state_is_reserved_candidate_signal:false,hard_acceptance_item_count:24,hard_acceptance_pass_count:24,formal_run_a_workflow_run_id:30845476698,formal_run_b_workflow_run_id:30877450717,formal_comparator_workflow_run_id:30900706086,semantic_digest:c.semantic_digest_a,semantic_equivalence:true,difference_count:0,candidate_merge_tree_equality_verified:false,r2_attestation_verified:false,capability_complete:false,next_legal_action:'PROTECTED_MERGE_THEN_EXACT_SHA_R2_ATTESTATION'};
 fs.mkdirSync(path.join(ROOT,'acceptance-output'),{recursive:true});fs.writeFileSync(path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_FINAL_CLOSURE_CANDIDATE_RESULT.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));
}catch(e){console.error(e);process.exit(1);}
