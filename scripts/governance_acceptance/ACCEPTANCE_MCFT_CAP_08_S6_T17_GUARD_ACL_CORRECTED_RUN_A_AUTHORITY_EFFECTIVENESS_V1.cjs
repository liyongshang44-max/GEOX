#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const BASE='872b4323e88e241147fc032b9c4b900f01dd7ae4';
const CANDIDATE_HEAD='ecf369a7ef72fb29c06c26af2b625c2bf07a524b';
const SUBJECT='923a794e0fa865a4a8493680b1b8ac2e98e57fbc';
const OP='MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-007';
const DBID='MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-007';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_T17_GUARD_ACL_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_RESULT.json');
const P={
  workflow:'.github/workflows/mcft-cap-08-s6-t17-guard-acl-corrected-run-a-authority-effectiveness.yml',
  effective:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  settlement:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-V1.json',
  boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json',
  validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_T17_GUARD_ACL_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_V1.cjs',
  candidate:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json',
  manifest:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json',
  gate:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs',
  identity:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs',
  wrapper:'apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts',
};
const CHANGED=[P.workflow,P.effective,P.settlement,P.boundary,P.validator].sort();

function git(...args){return execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim()}
function text(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
function json(p){return JSON.parse(text(p))}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function semantic(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`}
function save(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')}

try{
  const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
  assert.equal(base,BASE);
  assert.equal(git('merge-base',base,'HEAD'),base);
  assert.equal(git('rev-list','--count',`${base}..HEAD`),'1');
  assert.equal(git('diff','--check',`${base}...HEAD`),'');
  assert.equal(git('diff','--name-only',`${CANDIDATE_HEAD}...${BASE}`),'','CANDIDATE_TO_MERGE_FILE_DELTA');
  assert.deepEqual(git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),CHANGED);

  const candidate=json(P.candidate),manifest=json(P.manifest),effective=json(P.effective),settlement=json(P.settlement),boundary=json(P.boundary);
  for(const value of [effective,settlement,boundary])assert.equal(value.semantic_digest,semantic(value));

  assert.equal(git('rev-parse',`HEAD:${P.candidate}`),'2cc7b11711d5afe0063bb74e84455dadc36f436d');
  assert.equal(git('rev-parse',`HEAD:${P.manifest}`),'37ad609382dc1f40a8e77272ffab7ffd525e01c5');
  assert.equal(git('rev-parse',`HEAD:${P.effective}`),'d437cbad61e39f4d155b358b99c18c9b8f17fcee');

  assert.equal(candidate.record_status,'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.semantic_digest,'sha256:7cf5319d9a6355dfd4020cdc0965145eb70608e9681e5a35c3947faec93bb3c6');
  assert.equal(candidate.exact_subject_sha,SUBJECT);
  assert.equal(candidate.operational_run_instance_id,OP);

  assert.equal(manifest.record_status,'T17_GUARD_ACL_CORRECTED_RUN_A_AUTHORITY_OBJECT_SET_FROZEN');
  assert.equal(manifest.semantic_digest,'sha256:9d6e876c867a3c122da405f8053fd817c0c89416fea50f85cb40594dda859925');
  assert.equal(manifest.object_count,54);
  const sets=[
    manifest.exact_control_plane_object_set,
    manifest.exact_database_bootstrap_object_set,
    manifest.exact_product_object_set,
    manifest.exact_port_bundle_object_set,
    manifest.exact_harness_object_set,
    manifest.protected_invariant_object_set,
  ];
  assert.equal(sets.reduce((n,set)=>n+Object.keys(set).length,0),54);
  for(const set of sets)for(const [p,sha] of Object.entries(set))assert.equal(git('rev-parse',`HEAD:${p}`),sha,`OBJECT_BLOB:${p}`);

  assert.equal(effective.record_status,'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED');
  assert.equal(effective.semantic_digest,'sha256:3af27c065ba643f0acd07e13fc0d2bddb08a01e6c6a111bc2ae74ef80446d73b');
  assert.equal(effective.exact_subject_sha,SUBJECT);
  assert.equal(effective.authorized_run_label,'RUN_A');
  assert.equal(effective.operational_run_instance_id,OP);
  assert.equal(effective.logical_database_identity.identity_id,DBID);
  assert.equal(effective.logical_database_identity.physical_name_template,'geox_mcft_cap08_s6_run_a_replacement_007_<github_run_id>');
  assert.equal(effective.candidate_authority_ref.blob_sha,'2cc7b11711d5afe0063bb74e84455dadc36f436d');
  assert.equal(effective.candidate_authority_ref.preserved_semantic_digest,candidate.semantic_digest);
  assert.equal(effective.candidate_head_sha,CANDIDATE_HEAD);
  assert.equal(effective.candidate_merge_sha,BASE);
  assert.equal(effective.object_set_manifest_ref.blob_sha,'37ad609382dc1f40a8e77272ffab7ffd525e01c5');
  for(const key of ['single_run_database_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized','final_formal_run_execution_authorized','hard_acceptance_eligible','s6_candidate_evidence_eligible'])assert.equal(effective[key],true,key);
  for(const key of ['dual_run_ci_authorized','cross_run_comparator_authorized','final_ledger_settlement_authorized','database_execution_performed','workflow_dispatch_performed','formal_run_executed'])assert.equal(effective[key],false,key);
  assert.equal(effective.sequence_contract.run_b_remains_blocked,true);

  const {validateExecutionAuthorityV1}=require(path.join(ROOT,P.gate));
  assert.throws(()=>validateExecutionAuthorityV1(candidate,{exactSubjectSha:SUBJECT,runLabel:'RUN_A',operationalRunInstanceId:OP}));
  const normalized=validateExecutionAuthorityV1(effective,{exactSubjectSha:SUBJECT,runLabel:'RUN_A',operationalRunInstanceId:OP});
  assert.equal(normalized.module_path,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs');

  const {materializePhysicalDatabaseNameV1}=require(path.join(ROOT,P.identity));
  assert.equal(materializePhysicalDatabaseNameV1(effective,'30770000007'),'geox_mcft_cap08_s6_run_a_replacement_007_30770000007');

  const wrapper=text(P.wrapper);
  assert.match(wrapper,/twin_cap08_s4_t17_transition_guard_v1:\s*\["SELECT",\s*"INSERT"\]/);
  assert.match(wrapper,/MCFT_CAP08_T17_TRANSITION_GUARD_PRIVILEGES_NOT_EXACT/);

  assert.equal(settlement.candidate_authority.candidate_to_merge_file_delta,0);
  assert.equal(settlement.effective_authority.blob_sha,'d437cbad61e39f4d155b358b99c18c9b8f17fcee');
  assert.equal(settlement.effect.max_dispatch_count,1);
  assert.equal(settlement.effect.rerun_authorized,false);
  assert.equal(settlement.effect.run_b_dispatch_authorized,false);
  assert.equal(settlement.preserved_execution_set.full_object_count,54);
  assert.equal(settlement.preserved_execution_set.t17_guard_acl_exact_select_insert,true);

  assert.equal(boundary.base_main_sha,BASE);
  assert.deepEqual([...boundary.changed_files].sort(),CHANGED);
  assert.equal(boundary.changed_file_count,5);
  assert.equal(boundary.object_set_count,54);
  assert.equal(boundary.database_bootstrap_object_set_frozen,true);

  const workflow=text(P.workflow);
  assert.doesNotMatch(workflow,/workflow_dispatch:|postgres:|psql|DATABASE_URL/i);

  const result={
    schema_version:'geox_mcft_cap08_s6_t17_guard_acl_corrected_run_a_authority_effectiveness_result_v1',
    status:'PASS',
    base_main_sha:BASE,
    exact_head_sha:git('rev-parse','HEAD'),
    candidate_to_merge_file_delta:0,
    exact_subject_sha:SUBJECT,
    operational_run_instance_id:OP,
    logical_database_identity:DBID,
    object_count:54,
    database_bootstrap_object_set_frozen:true,
    t17_guard_acl_exact_select_insert:true,
    runtime_gate_eligible_after_merge:true,
    production_gate_accepts_effective_authority:true,
    production_gate_rejects_candidate:true,
    max_dispatch_count:1,
    rerun_authorized:false,
    run_b_dispatch_authorized:false,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    formal_run_result_present:false,
    mcft_cap_08_complete:false,
    mcft_cap_09_authorized:false,
  };
  save(result);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  save({schema_version:'geox_mcft_cap08_s6_t17_guard_acl_corrected_run_a_authority_effectiveness_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});
  console.error(error);
  process.exitCode=1;
}
