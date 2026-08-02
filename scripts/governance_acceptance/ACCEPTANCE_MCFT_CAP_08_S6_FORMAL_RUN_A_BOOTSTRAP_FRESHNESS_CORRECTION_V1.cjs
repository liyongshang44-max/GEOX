#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const BASE='9e43fbda8a96d8b8fd704806080d8eff75ed3695';
const OUTPUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_FORMAL_RUN_A_BOOTSTRAP_FRESHNESS_CORRECTION_RESULT.json');
const P={
 workflow:'.github/workflows/mcft-cap-08-s6-formal-run-a-bootstrap-freshness-correction.yml',
 failure:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-REPLACEMENT-003-BOOTSTRAP-FRESHNESS-FAILURE-V1.json',
 correction:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-BOOTSTRAP-FRESHNESS-CORRECTION-V1.json',
 boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-BOOTSTRAP-FRESHNESS-CORRECTION-BOUNDARY-V1.json',
 authority:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-LOADER-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
 fresh:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/fresh_database_v1.cjs',
 validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FORMAL_RUN_A_BOOTSTRAP_FRESHNESS_CORRECTION_V1.cjs',
 gate:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs',
 dbWorkflow:'.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml',
 index:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs'
};
const FILES=[P.workflow,P.failure,P.correction,P.boundary,P.authority,P.fresh,P.validator].sort();
const git=(...a)=>execFileSync('git',a,{cwd:ROOT,encoding:'utf8'}).trim();
const j=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function digest(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`}
function out(v){fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});fs.writeFileSync(OUTPUT,JSON.stringify(v,null,2)+'\n')}
function pools(values={}){
 const v={facts:11,epochs:1,visibility:11,missing:0,identity:0,runtime:{},...values};
 return{
  pool:{query:async()=>({rows:[{database_name:'geox_mcft_cap08_s6_run_a_preflight_004',user_name:'geox_mcft_cap08_runner_v1'}]})},
  adminPool:{query:async(sql,args)=>{
   const s=String(sql);
   if(s.includes('to_regclass'))return{rows:[{relation:String(args[0]).replace(/^public\./,'')}]};
   if(s.includes('LEFT JOIN public.twin_fact_visibility_index_v1'))return{rows:[{n:v.missing}]};
   if(s.includes('strpos(record_json'))return{rows:[{n:v.identity}]};
   if(s.includes('FROM public.twin_fact_visibility_index_v1 WHERE'))return{rows:[{n:v.visibility}]};
   if(s.includes("FROM public.twin_fact_visibility_epoch_v1 WHERE status='ACTIVE'"))return{rows:[{n:v.epochs}]};
   if(s.includes('FROM public.facts'))return{rows:[{n:v.facts}]};
   const m=s.match(/FROM public\.([A-Za-z0-9_]+)/);
   if(m)return{rows:[{n:v.runtime[m[1]]||0}]};
   throw new Error(`UNEXPECTED_SQL:${s}`);
  }}
 };
}
(async()=>{
 try{
  const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
  assert.equal(base,BASE);assert.equal(git('merge-base',base,'HEAD'),base);assert.equal(git('diff','--check',`${base}...HEAD`),'');
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed,FILES);
  assert.equal(git('rev-parse',`${BASE}:${P.fresh}`),'95d6d2e7179df06aa728df4a4fde0ab7fc2a788c');
  assert.equal(git('rev-parse',`HEAD:${P.fresh}`),'a62a8bb58bf623ddbf1cf701792527d156923d1e');
  assert.equal(git('rev-parse',`HEAD:${P.dbWorkflow}`),'47b5f7748c917a099dc92219f1cbd4055bfb4862');
  assert.equal(git('rev-parse',`HEAD:${P.index}`),'2f574588ba3010a94e64f965bb17fc97b3b33c72');
  const f=j(P.failure),c=j(P.correction),b=j(P.boundary),a=j(P.authority);
  for(const x of [f,c,b,a])assert.equal(x.semantic_digest,digest(x));
  assert.equal(f.workflow_run_id,30745867826);assert.equal(f.first_failure_code,'DATABASE_NOT_FRESH');
  assert.equal(f.bootstrap_baseline_evidence.fact_count,11);assert.equal(f.bootstrap_baseline_evidence.visibility_row_count,11);
  assert.equal(f.bootstrap_baseline_evidence.canonical_runtime_relations_zero,true);assert.equal(f.product_materializer_entered,false);
  assert.equal(a.record_status,'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_BOOTSTRAP_FRESHNESS_FAILURE');
  assert.equal(a.authority_consumed,true);assert.equal(a.single_run_database_execution_authorized,false);
  assert.equal(a.workflow_dispatch_execution_authorized,false);assert.equal(a.formal_run_executed,false);
  assert.equal(a.consumption_evidence.github_workflow_run_id,30745867826);assert.equal(a.consumption_evidence.database_dropped,true);
  const {validateExecutionAuthorityV1}=require(path.join(ROOT,P.gate));
  assert.throws(()=>validateExecutionAuthorityV1(a,{exactSubjectSha:a.exact_subject_sha,runLabel:'RUN_A',operationalRunInstanceId:a.operational_run_instance_id}),/record_status|Expected values/);
  const fresh=require(path.join(ROOT,P.fresh));
  assert.equal(fresh.EXPECTED_BOOTSTRAP_FACT_COUNT_V1,11);assert.equal(fresh.RUNTIME_RELATIONS_V1.length,5);
  const spec={operational_run_instance_id:'MCFT-CAP-08-S6-PREFLIGHT-004',exact_subject_sha:'a'.repeat(40),formal_run_id:'MCFT-CAP-08-S6-FORMAL-PREFLIGHT-004'};
  const pass=await fresh.createFreshDatabasePortV1(pools()).assertFreshDisposable({spec});
  assert.equal(pass.status,'PASS');assert.equal(pass.bootstrap_fact_count,11);assert.equal(pass.bootstrap_visibility_count,11);
  await assert.rejects(()=>fresh.createFreshDatabasePortV1(pools({facts:0})).assertFreshDisposable({spec}),/BOOTSTRAP_FACT_BASELINE_DRIFT/);
  await assert.rejects(()=>fresh.createFreshDatabasePortV1(pools({runtime:{twin_active_lineage_index_v1:1}})).assertFreshDisposable({spec}),/FORMAL_RUNTIME_RELATION_NOT_FRESH:twin_active_lineage_index_v1/);
  await assert.rejects(()=>fresh.createFreshDatabasePortV1(pools({identity:1})).assertFreshDisposable({spec}),/FORMAL_RUN_IDENTITY_FACT_NOT_FRESH/);
  assert.equal(c.correction.corrected_blob_sha,'a62a8bb58bf623ddbf1cf701792527d156923d1e');
  assert.equal(c.execution_constraints.new_execution_authority_present,false);assert.equal(c.execution_constraints.run_b_dispatch_authorized,false);
  assert.equal(b.changed_file_count,7);assert.deepEqual([...b.changed_files].sort(),FILES);
  assert.equal(b.database_execution_performed,false);assert.equal(b.workflow_dispatch_performed,false);assert.equal(b.replacement_authority_present,false);
  const wf=fs.readFileSync(path.join(ROOT,P.workflow),'utf8');assert.doesNotMatch(wf,/workflow_dispatch:|postgres|psql|DATABASE_URL/i);
  assert.equal(changed.some(p=>p.startsWith('apps/server/')||p.startsWith('apps/web/')||/migration/i.test(p)),false);
  const result={schema_version:'geox_mcft_cap08_s6_formal_run_a_bootstrap_freshness_correction_result_v1',status:'PASS',base_main_sha:base,exact_head_sha:git('rev-parse','HEAD'),changed_file_count:7,failed_workflow_run_id:30745867826,bootstrap_aware_freshness_predicate:true,legal_bootstrap_baseline_passes:true,runtime_contamination_rejected:true,current_run_identity_contamination_rejected:true,consumed_authority_rejected_by_production_gate:true,replacement_authority_present:false,run_b_dispatch_authorized:false,database_execution_performed:false,workflow_dispatch_performed:false,formal_run_result_present:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};out(result);console.log(JSON.stringify(result,null,2));
 }catch(error){out({schema_version:'geox_mcft_cap08_s6_formal_run_a_bootstrap_freshness_correction_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});throw error}
})();
