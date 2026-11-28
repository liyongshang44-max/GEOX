#!/usr/bin/env node
'use strict';
// One exact product PR route; no historical candidate registration or qualification promotion.
const cp=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8'}).trim();
const base=process.env.MCFT_BASE_SHA;
assert.match(base||'',/^[0-9a-f]{40}$/);
const head=git('rev-parse','HEAD');
const files=git('diff','--name-only',base+'...HEAD').split(/\r?\n/).filter(Boolean).sort();
const expected=[
  ".github/workflows/mcft-cap-09-s2-database-evidence-ingress.yml",
  ".github/workflows/mcft-cap-09-s2-registry-registration.yml",
  ".github/workflows/mcft-cap-09-s6-production-equivalent-shadow-simulator.yml",
  ".github/workflows/mcft-pv02-i1-native-mqtt.yml",
  "apps/server/src/infra/bline_stage1_schema_preprovision_v1.ts",
  "apps/server/src/projections/field_fertility_state_v1.ts",
  "apps/server/src/projections/field_sensing_overview_v1.ts",
  "apps/server/src/projections/field_sensing_summary_stage1_v1.ts",
  "apps/server/src/runtime/twin_runtime/customer_soil_evidence_ingress_v1.ts",
  "apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.ts",
  "apps/telemetry-ingest/src/main.ts",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json",
  "scripts/governance_acceptance/CLASSIFY_MCFT_PV02_I1_SHARED_REGRESSION.cjs",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_PV02_I1_NATIVE_MQTT.ts"
];
const matched=base==='7bf9a39da9aa5f4cab045e313487c798f9012f1a'&&JSON.stringify(files)===JSON.stringify(expected);
const mode=matched?'pv02-i1-shared-regression':'historical';
if(matched){
  assert.equal(git('merge-base',base,head),base);
  const registry='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
  assert.equal(git('rev-parse',base+':'+registry),git('rev-parse',head+':'+registry));
  fs.mkdirSync('acceptance-output',{recursive:true});
  const receipt={schema_version:'MCFT_PV02_I1_SHARED_REGRESSION_ROUTE_V1',status:'CLASSIFIED_PRODUCT_SHARED_REGRESSION',base_sha:base,head_sha:head,changed_paths:files,historical_registry_unchanged:true,historical_qualification_claimed:false,production_effect:false,shared_behavior_regression_required:true};
  fs.writeFileSync('acceptance-output/MCFT_PV02_I1_SHARED_REGRESSION_ROUTE.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}
assert.ok(process.env.GITHUB_OUTPUT);fs.appendFileSync(process.env.GITHUB_OUTPUT,'mode='+mode+'\n');
