#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');

const ROOT=path.resolve(__dirname,'../..');
const BASE='abe5cb7e0d6bf5e554be1d2ecdd9b6e554a21053';
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_08_S6_T17_GUARD_ACL_CORRECTION_RESULT.json');
const P={
  workflow:'.github/workflows/mcft-cap-08-s6-run-a-t17-guard-acl-correction.yml',
  wrapper:'apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.ts',
  baseBootstrap:'apps/server/src/infra/mcft_cap08_database_platform_bootstrap_base_v1.ts',
  settlement:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-FAILURE-SETTLEMENT-V1.json',
  boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTION-BOUNDARY-V1.json',
  authority:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-INTERLEAVE-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_T17_GUARD_ACL_CORRECTION_V1.cjs',
  formalWorkflow:'.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml',
  migration:'apps/server/db/migrations/2026_08_01_mcft_cap08_s4_t17_transition_persistence.sql',
  productChain:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  productLoader:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
};
const CHANGED=[P.workflow,P.wrapper,P.baseBootstrap,P.settlement,P.boundary,P.authority,P.validator].sort();
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
  assert.deepEqual(git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),CHANGED);

  assert.equal(git('rev-parse',`HEAD:${P.baseBootstrap}`),'720e14c5567c227b02c39579f17ec80c2f1fbf5b');
  assert.equal(git('rev-parse',`HEAD:${P.wrapper}`),'31ef663a85ea93fe0319db598515840b12111135');
  assert.equal(git('rev-parse',`HEAD:${P.authority}`),'a5bf87adbacd43cf2177a9f9bc433cf9e0e8bcb3');
  assert.equal(git('rev-parse',`HEAD:${P.settlement}`),'0b1fa4c5a9e117c5ec03d8034508cad2535c7240');
  assert.equal(git('rev-parse',`HEAD:${P.boundary}`),'100a95ce3232b3ff6706edc72c25a38a9a91314b');

  assert.equal(git('rev-parse',`HEAD:${P.formalWorkflow}`),'2371b3797999f61f55c58551b85c59279eb2f0a2');
  assert.equal(git('rev-parse',`HEAD:${P.migration}`),'323bd2fb81eaf73489345ac46f1a640866cffaed');
  assert.equal(git('rev-parse',`HEAD:${P.productChain}`),'fe3472b1ac2e0f6e91800172315060d7a4456b0b');
  assert.equal(git('rev-parse',`HEAD:${P.productLoader}`),'9ede26f14b97677cfa926f67a18aa8b9bc1b5a29');

  const wrapper=text(P.wrapper);
  assert.match(wrapper,/mcft_cap08_database_platform_bootstrap_base_v1\.js/);
  assert.match(wrapper,/twin_cap08_s4_t17_transition_guard_v1:\s*\["SELECT",\s*"INSERT"\]/);
  assert.match(wrapper,/REVOKE ALL ON TABLE/);
  assert.match(wrapper,/GRANT SELECT, INSERT ON TABLE/);
  assert.match(wrapper,/MCFT_CAP08_T17_TRANSITION_GUARD_PRIVILEGES_NOT_EXACT/);
  assert.doesNotMatch(wrapper,/GRANT[^;\n]*(UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)/);

  const authority=json(P.authority),settlement=json(P.settlement),boundary=json(P.boundary);
  for(const value of [authority,settlement,boundary])assert.equal(value.semantic_digest,semantic(value));
  assert.equal(authority.record_status,'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_T17_GUARD_ACL_FAILURE');
  assert.equal(authority.authority_consumed,true);
  assert.equal(authority.single_use_contract.dispatch_count_consumed,1);
  assert.equal(authority.single_use_contract.rerun_authorized,false);
  assert.equal(authority.single_use_contract.authority_reuse_authorized,false);
  assert.equal(authority.consumption_evidence.github_workflow_run_id,30758716511);
  assert.equal(authority.consumption_evidence.failed_run_artifact_id,8836768120);
  assert.equal(authority.failure_classification.code,'POSTGRESQL_42501_PERMISSION_DENIED');
  assert.equal(authority.failure_classification.relation,'public.twin_cap08_s4_t17_transition_guard_v1');
  assert.equal(authority.replacement_authority_issued,false);
  assert.equal(authority.sequence_contract.run_b_remains_blocked,true);

  assert.equal(settlement.record_status,'RUN_A_T17_GUARD_ACL_FAILURE_SETTLED');
  assert.equal(settlement.terminal_failure.postgres_sqlstate,'42501');
  assert.deepEqual(settlement.correction.guard_privileges,['SELECT','INSERT']);
  assert.equal(settlement.correction.additional_guard_privileges_authorized,false);
  assert.equal(settlement.next_legal_action_after_merge,'ISSUE_NEW_NON_EFFECTIVE_RUN_A_AUTHORITY_CANDIDATE');

  assert.equal(boundary.base_main_sha,BASE);
  assert.equal(boundary.changed_file_count,7);
  assert.deepEqual([...boundary.changed_files].sort(),CHANGED);
  assert.deepEqual(boundary.acl_extension.exact_privileges,['SELECT','INSERT']);
  assert.equal(boundary.replacement_authority_present,false);
  assert.equal(boundary.database_execution_performed,false);
  assert.equal(boundary.workflow_dispatch_performed,false);

  const workflow=text(P.workflow);
  assert.doesNotMatch(workflow,/workflow_dispatch:/);
  assert.match(workflow,/postgres:16/);
  assert.match(workflow,/ACCEPTANCE_MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB\.ts/);
  assert.doesNotMatch(workflow,/mcft_cap08_s6_single_run_workflow\/workflow_entrypoint_v1\.ts/);
  assert.doesNotMatch([...CHANGED].join('\n'),/AUTHORITY-CANDIDATE|AUTHORITY-EFFECTIVENESS/);
  assert.doesNotMatch(CHANGED.join('\n'),/single-run-database-execution\.yml/);

  const result={
    schema_version:'geox_mcft_cap08_s6_t17_guard_acl_correction_result_v1',
    status:'PASS',
    base_main_sha:BASE,
    exact_head_sha:git('rev-parse','HEAD'),
    changed_file_count:7,
    failed_workflow_run_id:30758716511,
    consumed_operational_identity:'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-006',
    terminal_error:'POSTGRESQL_42501_PERMISSION_DENIED',
    guard_relation:'public.twin_cap08_s4_t17_transition_guard_v1',
    exact_guard_privileges:['SELECT','INSERT'],
    base_bootstrap_byte_preserved:true,
    product_runtime_changed:false,
    migration_changed:false,
    formal_database_workflow_changed:false,
    replacement_authority_present:false,
    database_execution_performed:false,
    workflow_dispatch_performed:false,
    run_b_dispatch_authorized:false,
  };
  save(result);
  console.log(JSON.stringify(result,null,2));
}catch(error){
  save({schema_version:'geox_mcft_cap08_s6_t17_guard_acl_correction_result_v1',status:'FAIL',error:error instanceof Error?error.message:String(error)});
  console.error(error);
  process.exitCode=1;
}
