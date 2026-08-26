'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {Pool}=require('pg');

const FROZEN_CAP08_COMPLETION_SUBJECT='67bd71560268046a7fa9a9433ee074ad3999cb71';
const NORMALIZED_OPERATIONAL_RUN_INSTANCE_ID='MCFT-CAP08-PHASE1B-EQUIVALENCE-001';

function arg(name){
  const index=process.argv.indexOf(name);
  if(index<0||!process.argv[index+1])throw new Error(`ARG_REQUIRED:${name}`);
  return process.argv[index+1];
}
function canonical(value){
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value){return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;}
function requireFromRoot(root,relative){return require(path.join(root,relative));}
function normalizeRecoveryDetail(detail){
  if(!detail||typeof detail!=='object'||Array.isArray(detail))return detail;
  const copy=structuredClone(detail);
  if(Object.prototype.hasOwnProperty.call(copy,'database_name'))copy.database_name='<DISPOSABLE_DATABASE>';
  return copy;
}
function normalizeCap07Surfaces(surfaces){
  return surfaces.map(surface=>({
    name:surface.name,
    variant:surface.variant,
    pages:surface.pages.map(page=>({
      content_hash:page.content_hash,
      response_hash:page.response_hash,
      next_cursor_is_null:page.next_cursor===null,
    })),
  }));
}
async function tableCounts(adminPool){
  const relations=[
    'facts',
    'twin_active_lineage_index_v1',
    'twin_runtime_checkpoint_latest_index_v1',
    'twin_state_latest_index_v1',
    'twin_forecast_result_latest_index_v1',
    'twin_scenario_latest_index_v1',
    'twin_forecast_residual_projection_v1',
    'twin_runtime_authority_snapshot_v1',
    'twin_object_idempotency_index_v1',
  ];
  const result={};
  for(const relation of relations){
    const row=(await adminPool.query(`SELECT count(*)::int AS n FROM public.${relation}`)).rows[0];
    result[relation]=Number(row.n);
  }
  return result;
}

async function main(){
  const root=path.resolve(arg('--root'));
  const lane=arg('--lane');
  const databaseUrl=arg('--database-url');
  const adminUrl=arg('--admin-url');
  const out=path.resolve(arg('--out'));
  assert.ok(['PREDECESSOR','SUCCESSOR'].includes(lane),'LANE_INVALID');
  assert.equal(fs.existsSync(path.join(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs')),true,'CAP08_PRODUCT_CHAIN_REQUIRED');

  process.env.MCFT_LOCAL_REPLAY='1';
  const {loadSingleRunHarnessContractsV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs');
  const {buildSingleRunExecutionSpecV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs');
  const {runProductChainV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs');
  const {buildMaterializationOutputV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs');
  const {createRecoveryPortV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/recovery_v1.cjs');
  const {createCap07ReaderV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/cap07_reader_v1.cjs');
  const {SURFACES,fetchVariantV1}=requireFromRoot(root,'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/cap07_readback_execution_adapter_v1.cjs');

  const contracts=loadSingleRunHarnessContractsV1({localReplay:true});
  const spec=buildSingleRunExecutionSpecV1({
    contracts,
    runLabel:'RUN_A',
    operationalRunInstanceId:NORMALIZED_OPERATIONAL_RUN_INSTANCE_ID,
    exactSubjectSha:FROZEN_CAP08_COMPLETION_SUBJECT,
  });

  const pool=new Pool({connectionString:databaseUrl,max:6});
  const adminPool=new Pool({connectionString:adminUrl,max:4});
  const shared={receipts:[],selector:null,recovery:new Map(),readModel:new Map()};
  try{
    const context=await runProductChainV1({root,pool,spec});
    const materialization=await buildMaterializationOutputV1({adminPool,shared,spec,context});
    assert.equal(materialization.canonical_receipts.length,153,'CAP08_EQUIVALENCE_RECEIPT_COUNT');
    assert.equal(context.s3.range.executed_tick_count,24,'CAP08_EQUIVALENCE_TICK_COUNT');
    assert.equal(context.s5.residual_count,24,'CAP08_EQUIVALENCE_RESIDUAL_COUNT');

    const boundSpec=context.boundSpec;
    const recoveryPort=createRecoveryPortV1({pool,adminPool,shared});
    const recovery=[];
    for(const vectorId of boundSpec.recovery_vector_ids){
      const result=await recoveryPort.executeVector({vector:{vector_id:vectorId},spec:boundSpec});
      assert.equal(result.status,'PASS',`RECOVERY_NOT_PASS:${vectorId}`);
      recovery.push({
        vector_id:result.vector_id,
        status:result.status,
        silent_repair_used:result.silent_repair_used,
        canonical_write_delta:result.canonical_write_delta,
        detail:normalizeRecoveryDetail(result.detail),
      });
    }
    assert.equal(recovery.length,7,'CAP08_EQUIVALENCE_RECOVERY_COUNT');

    const cap07Port=await createCap07ReaderV1({root,pool,shared});
    const cap07Surfaces=[];
    for(const surface of SURFACES){
      const variants=surface.variants??[null];
      for(const variant of variants){
        cap07Surfaces.push({
          name:surface.name,
          variant,
          pages:await fetchVariantV1(cap07Port.request.bind(cap07Port),boundSpec,surface,variant),
        });
      }
    }
    assert.equal(SURFACES.length,10,'CAP08_EQUIVALENCE_CAP07_SURFACE_DEFINITION_COUNT');
    assert.equal(cap07Surfaces.length,11,'CAP08_EQUIVALENCE_CAP07_REQUEST_VARIANT_COUNT');

    const receipts=[...materialization.canonical_receipts].sort((a,b)=>canonical(a).localeCompare(canonical(b)));
    const normalizedCap07=normalizeCap07Surfaces(cap07Surfaces);
    const counts=await tableCounts(adminPool);
    const semanticManifest={
      schema_version:'geox_mcft_cap09_phase1b_cap08_replay_equivalence_lane_manifest_v1',
      frozen_cap08_completion_subject:FROZEN_CAP08_COMPLETION_SUBJECT,
      normalized_run_label:'RUN_A',
      normalized_operational_run_instance_id:NORMALIZED_OPERATIONAL_RUN_INSTANCE_ID,
      formal_run_id:boundSpec.formal_run_id,
      lineage_id:context.lineageId,
      revision_id:context.revisionId,
      canonical_identity_binding:context.boundSpec.canonical_identity_binding,
      canonical_receipt_count:receipts.length,
      canonical_receipts:receipts,
      selector_snapshot:shared.selector,
      final_handoff:context.s3.range.final_handoff,
      s4_authority:context.s4.authority,
      s4_corrected_set:context.s4.corrected_set,
      s5_residual_refs:context.s5.ordered_residual_refs,
      s5_residual_hashes:context.s5.ordered_residual_hashes,
      s5_candidate:{ref:context.s5.candidate.object_id,hash:context.s5.candidate.determinism_hash},
      s5_shadow_evaluation:{ref:context.s5.shadow_evaluation.object_id,hash:context.s5.shadow_evaluation.determinism_hash},
      recovery,
      cap07_surfaces:normalizedCap07,
      table_counts:counts,
    };
    const result={
      schema_version:'geox_mcft_cap09_phase1b_cap08_replay_equivalence_lane_result_v1',
      status:'PASS',
      lane,
      root_revision:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
      frozen_cap08_completion_subject:FROZEN_CAP08_COMPLETION_SUBJECT,
      semantic_manifest_digest:digest(semanticManifest),
      semantic_manifest:semanticManifest,
      database_instance_identity_excluded_from_equivalence:true,
      historical_cap08_authority_reused:false,
      historical_cap08_completion_reopened:false,
      provider_request:false,
      production_runtime_activation:false,
      formal_database_mutation:false,
      formal_v5_arm:false,
      graduation_effect:false,
      mcft_cap09_completed:false,
    };
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,`${JSON.stringify(result,null,2)}\n`);
    console.log(JSON.stringify({status:result.status,lane,root_revision:result.root_revision,semantic_manifest_digest:result.semantic_manifest_digest},null,2));
  }finally{
    await Promise.allSettled([pool.end(),adminPool.end()]);
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
