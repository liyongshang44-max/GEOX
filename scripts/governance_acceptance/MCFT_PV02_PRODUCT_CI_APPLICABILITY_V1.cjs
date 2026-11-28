#!/usr/bin/env node
'use strict';
// Exact product path classification for ordinary engineering PRs. This is not a
// QCP registry, historical evidence carry-forward, or an admission authority.
// The protected base must already contain this exact classifier and workflows.
const cp=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const GROUPS={
  "ingress": [
    ".github/workflows/mcft-pv02-i1-native-mqtt.yml",
    "apps/server/src/infra/bline_stage1_schema_preprovision_v1.ts",
    "apps/server/src/projections/field_fertility_state_v1.ts",
    "apps/server/src/projections/field_sensing_overview_v1.ts",
    "apps/server/src/projections/field_sensing_summary_stage1_v1.ts",
    "apps/server/src/runtime/twin_runtime/customer_soil_evidence_ingress_v1.ts",
    "apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts",
    "apps/telemetry-ingest/src/main.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_PV02_I1_NATIVE_MQTT.ts"
  ],
  "math": [
    ".github/workflows/mcft-pv02-i2-customer-scalar.yml",
    "apps/server/src/domain/soil_water/hourly_water_balance_v1.ts",
    "apps/server/src/domain/twin_runtime/customer_scalar_runtime_config_v1.ts",
    "apps/server/src/domain/soil_water/customer_scalar_assimilation_v1.ts",
    "apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_PV02_I2_AB.ts"
  ],
  "composer": [
    "apps/server/src/runtime/twin_runtime/customer_native_runtime_composer_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_PV02_I2E_NATIVE_COMPOSITION.ts",
    ".github/workflows/mcft-pv02-i2e-native-composition.yml"
  ],
  "parameter_sources": [
    "apps/server/src/runtime/twin_runtime/customer_native_parameter_source_resolver_v1.ts"
  ],
  "persistence": [
    "apps/server/src/persistence/twin_runtime/postgres_customer_native_runtime_repository_v1.ts"
  ],
  "read_api": [
    "apps/server/src/repositories/field_twin_read_model/postgres_customer_native_runtime_read_repository_v1.ts",
    "apps/server/src/services/mcft_field_twin_read_api_v1.ts",
    "apps/server/src/routes/v1/mcft_field_twin_read_v1.ts",
    "apps/server/src/routes/openapi_mcft_field_twin_read_v1.ts"
  ]
};
const CLASSIFIER='scripts/governance_acceptance/MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1.cjs';
const WORKFLOWS=['.github/workflows/mcft-cap-09-s2-registry-registration.yml','.github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml','.github/workflows/mcft-cap-09-s6-production-equivalent-shadow-simulator.yml','.github/workflows/mcft-cap-09-ea5e2-runtime-dependency-graph.yml'];
const KNOWN=new Set(Object.values(GROUPS).flat());
function classify(paths){
  const changed=[...new Set(paths)].sort();
  const unknown=changed.filter(p=>!KNOWN.has(p));
  if(!changed.length||unknown.length)return {mode:'historical',unknown,changed,required_regressions:[]};
  const ingress=changed.some(p=>GROUPS.ingress.includes(p)),math=changed.some(p=>GROUPS.math.includes(p)),composer=changed.some(p=>GROUPS.composer.includes(p));
  const parameterSources=changed.some(p=>GROUPS.parameter_sources.includes(p));
  const persistence=changed.some(p=>GROUPS.persistence.includes(p));
  const readApi=changed.some(p=>GROUPS.read_api.includes(p));
  const customerRuntime=composer||parameterSources||persistence||readApi;
  const required=['MAIN_CI','BLINE_AUTHORITY_UNCHANGED','EA5E2_GRAPH_BEHAVIOR'];
  if(ingress||customerRuntime)required.push('I1_NATIVE_MQTT','S2_REAL_PG_SHARED_INGRESS','S6_SIMULATION_BEHAVIOR');
  if(math||composer)required.push('I2_NATIVE_MATH','CAP02_03_04_FROZEN_SCIENCE');
  if(customerRuntime)required.push('I2E_NATIVE_COMPOSITION');
  if(parameterSources)required.push('I2E_PARAMETER_SOURCE_RESOLUTION');
  if(persistence)required.push('I2E_FACT_PERSISTENCE_VISIBILITY','STATE_PREDECESSOR_AND_IDEMPOTENCY');
  if(readApi)required.push('CAP07_S4_CUSTOMER_NATIVE_READ_API','EXACT_SCOPE_AUTHORIZATION','FACT_VISIBILITY_SNAPSHOT');
  return {mode:'product-shared-regression',unknown,changed,required_regressions:required};
}
function git(...args){return cp.execFileSync('git',args,{encoding:'utf8'}).trim();}
function blob(ref,p){try{return git('rev-parse','--verify',ref+':'+p);}catch{return null;}}
function main(){
  const base=process.env.MCFT_BASE_SHA,head=git('rev-parse','HEAD');
  assert.match(base||'',/^[0-9a-f]{40}$/);
  const diff=git('diff','--name-status','--no-renames',base+'...'+head).split(/\r?\n/).filter(Boolean).map(l=>l.split('\t'));
  let result=classify(diff.map(row=>row[1]));
  // No delete/rename and no candidate-self authorization. All controlling paths
  // must have the same blob as the approved base, otherwise historical gates run.
  const control=[CLASSIFIER,...WORKFLOWS,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json','docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'];
  const controlExact=control.every(p=>{const b=blob(base,p);return b&&b===blob(head,p);});
  if(!controlExact||diff.some(row=>!['A','M'].includes(row[0]))||git('merge-base',base,head)!==base)result={...result,mode:'historical'};
  const proof={schema_version:'MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1',status:result.mode==='product-shared-regression'?'PRODUCT_REGRESSION_REQUIRED_NO_HISTORICAL_QUALIFICATION':'HISTORICAL_OR_UNCLASSIFIED_USE_EXISTING_GATES',
    base_sha:base,head_sha:head,control_exact:controlExact,...result,production_authorized:false,historical_qualification_claimed:false};
  fs.mkdirSync('acceptance-output',{recursive:true});
  fs.writeFileSync('acceptance-output/MCFT_PV02_PRODUCT_CI_ROUTE.json',JSON.stringify(proof,null,2)+'\n');
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'mode='+result.mode+'\n');
  console.log(JSON.stringify(proof));
}
if(require.main===module)main();
module.exports={classify,GROUPS};
