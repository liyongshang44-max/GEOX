#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const BASE='0186ce5f3ae82724886ea633a29f58791449ddec';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_PHASE_ORDER_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_RESULT.json');
const CANDIDATE='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json';
const OBJECTS='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json';
const BOUNDARY='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-RUN-A-AUTHORITY-BOUNDARY-V1.json';
const ISSUANCE='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-RUN-A-AUTHORITY-ISSUANCE-V1.json';
const WORKFLOW='.github/workflows/mcft-cap-08-s6-phase-order-corrected-run-a-authority-candidate.yml';
const VALIDATOR='scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PHASE_ORDER_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_V1.cjs';
const CONSUMED='docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const CHANGED=[WORKFLOW,CANDIDATE,BOUNDARY,ISSUANCE,OBJECTS,VALIDATOR].sort();
const OP='MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-008';
const DBID='MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-008';
const DBNAME='geox_mcft_cap08_s6_run_a_replacement_008_30780000008';
const PHASE_ORDER=['resolve','E','H','A','B','G','C','barrier'];

function git(...args){return execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim()}
function text(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
function json(p){return JSON.parse(text(p))}
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v)}
function semantic(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${crypto.createHash('sha256').update(canonical(c)).digest('hex')}`}
function save(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')}
function effective(candidate){
  const authority=structuredClone(candidate);
  authority.record_status='SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED';
  authority.evidence_class='FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS';
  authority.expires_at='2099-08-05T18:45:00.000Z';
  for(const key of ['authority_effective','single_run_database_execution_authorized','database_execution_workflow_authorized','workflow_dispatch_execution_authorized','final_formal_run_execution_authorized'])authority.authorization_state[key]=true;
  Object.assign(authority,{
    single_run_database_execution_authorized:true,
    database_execution_workflow_authorized:true,
    workflow_dispatch_execution_authorized:true,
    final_formal_run_execution_authorized:true,
    dual_run_ci_authorized:false,
    cross_run_comparator_authorized:false,
    final_ledger_settlement_authorized:false,
  });
  return authority;
}

try{
  const base=String(process.env.MCFT_BASE_SHA||BASE).trim();
  assert.equal(base,BASE);
  assert.equal(git('merge-base',base,'HEAD'),base);
  assert.equal(git('rev-list','--count',`${base}..HEAD`),'1');
  assert.equal(git('diff','--check',`${base}...HEAD`),'');
  assert.deepEqual(git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),CHANGED);

  const candidate=json(CANDIDATE),objects=json(OBJECTS),boundary=json(BOUNDARY),issuance=json(ISSUANCE),consumed=json(CONSUMED);
  for(const value of [candidate,objects,boundary,issuance])assert.equal(value.semantic_digest,semantic(value));

  assert.equal(git('rev-parse',`HEAD:${CANDIDATE}`),'a2cce3e339e1c12dda069dad5d4f801df9c1bca8');
  assert.equal(git('rev-parse',`HEAD:${OBJECTS}`),'53a096f7ab41ce236a3896750fe08d4b81a13e09');
  assert.equal(git('rev-parse',`HEAD:${CONSUMED}`),'e37d5587173dce46cd5c3861ed48feb21b2aa996');

  assert.equal(consumed.authority_consumed,true);
  assert.equal(consumed.operational_run_instance_id,'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-007');
  assert.equal(consumed.consumption_evidence.github_workflow_run_id,30760836890);
  assert.equal(consumed.replacement_authority_issued,false);
  assert.equal(candidate.record_status,'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.exact_subject_sha,BASE);
  assert.equal(candidate.operational_run_instance_id,OP);
  assert.equal(candidate.logical_database_identity.identity_id,DBID);
  assert.equal(candidate.logical_database_identity.physical_name_template,'geox_mcft_cap08_s6_run_a_replacement_008_<github_run_id>');
  assert.ok(Object.values(candidate.authorization_state).every(value=>value===false));
  assert.equal(candidate.sequence_contract.run_b_remains_blocked,true);
  assert.equal(candidate.replaces_consumed_authority.failed_workflow_run_id,30760836890);
  assert.deepEqual(candidate.correction_merge_ref.required_phase_order,PHASE_ORDER);
  assert.equal(candidate.correction_merge_ref.phase_count,28);
  assert.equal(candidate.correction_merge_ref.operational_event_count,224);

  assert.equal(objects.object_count,54);
  assert.equal(objects.exact_subject_sha,BASE);
  assert.equal(objects.exact_port_bundle_object_set['scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs'],'f75ead09719158eb46e37c3ecc390ee6be2e52a6');
  assert.equal(objects.exact_harness_object_set['scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs'],'8f9797ffdbfeb7ccbd2d76ef6b219a8576824127');
  const sets=[objects.exact_control_plane_object_set,objects.exact_database_bootstrap_object_set,objects.exact_product_object_set,objects.exact_port_bundle_object_set,objects.exact_harness_object_set,objects.protected_invariant_object_set];
  assert.equal(sets.reduce((n,set)=>n+Object.keys(set).length,0),54);
  for(const set of sets)for(const [p,sha] of Object.entries(set))assert.equal(git('rev-parse',`HEAD:${p}`),sha,`OBJECT_BLOB:${p}`);

  process.env.MCFT_LOCAL_REPLAY='1';
  const {loadSingleRunHarnessContractsV1}=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs'));
  const {buildSingleRunExecutionSpecV1}=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs'));
  const {buildOperationalEventsV1}=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs'));
  const contracts=loadSingleRunHarnessContractsV1({localReplay:true});
  const spec=buildSingleRunExecutionSpecV1({contracts,runLabel:'RUN_A',operationalRunInstanceId:OP,exactSubjectSha:BASE});
  assert.equal(spec.phase_count,28);
  assert.ok(spec.phases.every(phase=>JSON.stringify(phase.phase_order)===JSON.stringify(PHASE_ORDER)));
  assert.equal(buildOperationalEventsV1({spec}).length,224);

  assert.equal(boundary.base_main_sha,BASE);
  assert.equal(boundary.changed_file_count,6);
  assert.deepEqual([...boundary.changed_files].sort(),CHANGED);
  assert.equal(boundary.object_set_count,54);
  assert.equal(boundary.phase_order_transport_objects_frozen,true);
  assert.equal(issuance.activation.database_execution_authorized,false);
  assert.equal(issuance.identity.operational_run_instance_id,OP);
  assert.deepEqual(issuance.phase_order_contract.required_phase_order,PHASE_ORDER);

  const gate=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs'));
  assert.throws(()=>gate.validateExecutionAuthorityV1(candidate,{exactSubjectSha:BASE,runLabel:'RUN_A',operationalRunInstanceId:OP}));
  gate.validateExecutionAuthorityV1(effective(candidate),{exactSubjectSha:BASE,runLabel:'RUN_A',operationalRunInstanceId:OP});

  const identity=require(path.join(ROOT,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs'));
  assert.equal(identity.materializePhysicalDatabaseNameV1(effective(candidate),'30780000008'),DBNAME);

  const workflow=text(WORKFLOW);
  assert.doesNotMatch(workflow,/workflow_dispatch:|postgres:|psql|DATABASE_URL/i);
  assert.match(workflow,/54-object set/);
  assert.match(workflow,/phase-order transport/);

  const result={
    schema_version:'geox_mcft_cap08_s6_phase_order_corrected_run_a_authority_candidate_result_v1',
    status:'PASS',
    base_main_sha:BASE,
    exact_head_sha:git('rev-parse','HEAD'),
    object_count:54,
    operational_run_instance_id:OP,
    logical_database_identity:DBID,
    candidate_runtime_gate_eligible:false,
    phase_order_transport_preflight:'PASS',
    operational_event_count:224,
    database_bootstrap_object_set_frozen:true,
    t17_guard_acl_preflight:'PASS',
    authority_bound_database_identity_preflight:'PASS',
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    run_b_dispatch_authorized:false,
  };
  save(result);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  save({schema_version:'geox_mcft_cap08_s6_phase_order_corrected_run_a_authority_candidate_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});
  console.error(error);
  process.exitCode=1;
}
