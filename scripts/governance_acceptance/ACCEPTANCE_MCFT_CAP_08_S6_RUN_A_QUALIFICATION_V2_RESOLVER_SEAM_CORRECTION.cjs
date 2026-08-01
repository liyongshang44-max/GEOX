#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const C=require('node:crypto');
const P=require('node:child_process');
const F=require('node:fs');
const X=require('node:path');
const R=X.resolve(__dirname,'../..');
const D='docs/digital_twin/mcft/cap_08';
const PATHS={
 failure:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V8-T17-RESOLVER-READBACK-FAILURE-V1.json',
 correction:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V2-RESOLVER-SEAM-CORRECTION-V1.json',
 boundary:'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V2-RESOLVER-SEAM-CORRECTION-BOUNDARY-V1.json',
 chain:'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports_v2/qualification_product_chain_v2.cjs',
 direct:'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports_v2/direct_materializer_v2.cjs',
 bundle:'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports_v2/index_v2.cjs',
 entrypoint:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_workflow_entrypoint_v2.ts',
 executionWorkflow:'.github/workflows/mcft-cap-08-s6-run-a-qualification-database-execution-v2.yml',
 validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION.cjs',
 focused:'.github/workflows/mcft-cap-08-s6-run-a-qualification-v2-resolver-seam-correction.yml',
};
const OUT=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8'));
const text=p=>F.readFileSync(X.join(R,p),'utf8');
const git=(...args)=>P.execFileSync('git',args,{cwd:R,encoding:'utf8'}).trim();
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function digest(v){const c=structuredClone(v);delete c.semantic_digest;return`sha256:${C.createHash('sha256').update(canonical(c)).digest('hex')}`;}
function write(v){F.mkdirSync(X.dirname(OUT),{recursive:true});F.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n');}
(async()=>{
 try{
  const failure=read(PATHS.failure),correction=read(PATHS.correction),boundary=read(PATHS.boundary);
  const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
  A.equal(base,boundary.base_main_sha);
  A.equal(git('merge-base',base,'HEAD'),base);
  A.equal(git('diff','--check',`${base}...HEAD`),'');
  const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  A.deepEqual(changed,[...boundary.changed_files].sort());
  A.equal(changed.length,10);
  A.equal(changed.some(file=>/^(apps|packages|db|migrations)\//.test(file)),false);
  for(const value of[failure,correction,boundary])A.equal(value.semantic_digest,digest(value),'SEMANTIC_DIGEST');

  A.equal(failure.workflow_run_id,30675662799);
  A.equal(failure.exact_subject_sha,'2953b8505671ec4ca026c064feeacf41d62c7943');
  A.equal(failure.operational_run_instance_id,'MCFT-CAP-08-S6-RUN-A-QUAL-20260801-009');
  A.equal(failure.database_name,'geox_mcft_cap08_s6_run_a_qual_009');
  A.equal(failure.authority_job.status,'PASS');
  A.equal(failure.execution_job.status,'FAIL');
  A.equal(failure.execution_job.database_bootstrap_status,'PASS');
  A.equal(failure.execution_job.database_drop_status,'PASS');
  A.equal(failure.qualification_artifact.artifact_id,8810349149);
  A.equal(failure.qualification_artifact.digest,'sha256:ae2be57f9efe7c965bdc43170dc7e4a5c58c50f7e087b8c6c78ab0309734c64c');
  A.equal(failure.qualification_artifact.result_present,false);
  A.equal(failure.first_failure.message,'CAP08_S4_S3_COMPLETION_TUPLE_CARDINALITY');
  A.equal(failure.first_failure.component,'Cap08S4T17CorrectedPredecessorResolverV1.resolve');
  A.equal(failure.operational_instance_reusable,false);
  A.equal(failure.database_identity_reusable,false);
  A.equal(failure.v8_authority_reusable,false);

  const pins=correction.correction.unchanged_blob_pins;
  const unchanged={
   'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports/index_v1.cjs':pins.v1_port_bundle,
   'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_workflow_entrypoint_v1.ts':pins.v1_entrypoint,
   '.github/workflows/mcft-cap-08-s6-run-a-qualification-database-execution.yml':pins.v1_workflow,
   'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs':pins.product_chain_v1,
   'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs':pins.product_loader_v1,
   'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/s6_s4_atomic_persistence_repository_v1.cjs':pins.s6_s4_atomic_repository,
   'apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts':pins.product_t17_resolver,
   'apps/server/src/persistence/twin_runtime/postgres_cap08_s4_append_forward_repository_v1.ts':pins.product_s4_repository,
   'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/qualification_execution_authority_gate_v1.cjs':pins.qualification_gate,
   'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification/qualification_harness_v1.cjs':pins.qualification_harness,
  };
  for(const [path,sha] of Object.entries(unchanged)){A.equal(git('rev-parse',`${base}:${path}`),sha,`BASE_PIN:${path}`);A.equal(git('rev-parse',`HEAD:${path}`),sha,`HEAD_PIN:${path}`);}
  const expected={
   [PATHS.chain]:correction.correction.qualification_product_chain_blob_sha,
   [PATHS.direct]:correction.correction.direct_materializer_blob_sha,
   [PATHS.bundle]:correction.correction.port_bundle_blob_sha,
   [PATHS.entrypoint]:correction.correction.entrypoint_blob_sha,
   [PATHS.executionWorkflow]:correction.correction.workflow_blob_sha,
  };
  for(const [path,sha] of Object.entries(expected))A.equal(git('rev-parse',`HEAD:${path}`),sha,`NEW_PIN:${path}`);

  for(const file of changed.filter(file=>file.endsWith('.cjs')))P.execFileSync(process.execPath,['--check',file],{cwd:R,stdio:'pipe'});
  const chain=text(PATHS.chain),direct=text(PATHS.direct),bundle=text(PATHS.bundle),entrypoint=text(PATHS.entrypoint),workflow=text(PATHS.executionWorkflow),focused=text(PATHS.focused);
  for(const token of['bindResolverRepositorySeamV2','this.resolver.repository=this.repository','QUALIFICATION_V2_S4_RESOLVER_REPOSITORY_SEAM_REQUIRED','delete require.cache[chainPath]'])A.ok(chain.includes(token),`CHAIN_TOKEN:${token}`);
  A.ok(direct.includes('runProductChainV1:runProductChainV2'));
  A.ok(bundle.includes('createPortsV1:createPortsV2'));
  A.ok(bundle.includes('createDirectQualificationMaterializerV2'));
  for(const token of['qualification_workflow_entrypoint_v2.ts','QUALIFICATION_V2_ENTRYPOINT_BLOB_DRIFT','QUALIFICATION_V2_PORT_BUNDLE_BLOB_DRIFT'])A.ok(entrypoint.includes(token),`ENTRYPOINT_TOKEN:${token}`);
  A.match(workflow,/workflow_dispatch:/);
  A.ok(workflow.includes('qualification_workflow_entrypoint_v2.ts'));
  A.ok(workflow.includes('Drop disposable qualification v2 database'));
  A.match(focused,/pull_request:/);
  A.doesNotMatch(focused,/workflow_dispatch:/);
  A.doesNotMatch(focused,/services:\s*\n\s*postgres:/);
  A.doesNotMatch(focused,/DATABASE_URL/);

  const {bindResolverRepositorySeamV2}=require(X.join(R,PATHS.chain));
  class MockProductService{constructor(){this.repository={kind:'S6_PREFIX_AWARE'};this.resolver={repository:{kind:'PRODUCT_COMPLETION_TUPLE'}};}}
  const mock={Cap08S4AppendForwardServiceV1:MockProductService};
  bindResolverRepositorySeamV2(mock);
  const service=new mock.Cap08S4AppendForwardServiceV1();
  A.equal(service.resolver.repository,service.repository,'RESOLVER_MUST_SHARE_S6_REPOSITORY');
  class MissingResolver{constructor(){this.repository={};}}
  const negative={Cap08S4AppendForwardServiceV1:MissingResolver};
  bindResolverRepositorySeamV2(negative);
  A.throws(()=>new negative.Cap08S4AppendForwardServiceV1(),/QUALIFICATION_V2_S4_RESOLVER_SEAM_REQUIRED/);

  A.equal(boundary.database_execution_performed,false);
  A.equal(boundary.workflow_dispatch_performed,false);
  A.equal(boundary.new_execution_authority_issued,false);
  A.equal(correction.effectiveness_required_before_replacement_authority,true);
  const result={schema_version:'geox_mcft_cap08_s6_run_a_qualification_v2_resolver_seam_correction_result_v1',status:'PASS',subject_sha:git('rev-parse','HEAD'),base_sha:base,changed_file_count:changed.length,failed_workflow_run_id:failure.workflow_run_id,retired_operational_instance:failure.operational_run_instance_id,retired_database_name:failure.database_name,port_bundle_v2_blob_sha:correction.correction.port_bundle_blob_sha,product_chain_v2_blob_sha:correction.correction.qualification_product_chain_blob_sha,entrypoint_v2_blob_sha:correction.correction.entrypoint_blob_sha,workflow_v2_blob_sha:correction.correction.workflow_blob_sha,resolver_seam_positive_vector_count:1,resolver_seam_negative_vector_count:1,product_runtime_source_file_count:0,database_migration_file_count:0,database_execution_performed:false,workflow_dispatch_performed:false,new_execution_authority_issued:false,run_a_qualification_completed:false,s6_candidate_implemented:false,mcft_cap_08_complete:false,mcft_cap_09_authorized:false};
  write(result);console.log(JSON.stringify(result,null,2));
 }catch(error){write({schema_version:'geox_mcft_cap08_s6_run_a_qualification_v2_resolver_seam_correction_result_v1',status:'FAIL',error:error instanceof Error?error.stack||error.message:String(error)});console.error(error);process.exitCode=1;}
})();
