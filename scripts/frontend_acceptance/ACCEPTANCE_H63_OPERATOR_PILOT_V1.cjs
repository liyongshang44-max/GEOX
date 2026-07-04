// scripts/frontend_acceptance/ACCEPTANCE_H63_OPERATOR_PILOT_V1.cjs
'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const files = {
  app: 'apps/web/src/app/App.tsx',
  layout: 'apps/web/src/layouts/OperatorLayout.tsx',
  page: 'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
  vm: 'apps/web/src/features/operator/pilotReadiness/pilotReadinessViewModel.ts',
  doc: 'docs/frontend-productization/H63-PILOT-READINESS-PRODUCT-SURFACE.md',
  p53: 'docs/field_pilot_plan/GEOX-P53-CONTROLLED-FIELD-PILOT-PLAN-GATE-V1.md',
  p54: 'docs/field_pilot_readiness/GEOX-P54-FIELD-PILOT-READINESS-REVIEW-GATE-CLOSURE-REVIEW.json',
};
const allow = [/^apps\/web\/src\/layouts\/OperatorLayout\.tsx$/, /^apps\/web\/src\/features\/operator\/pilotReadiness\//, /^docs\/frontend-productization\/H63-PILOT-READINESS-PRODUCT-SURFACE\.md$/, /^scripts\/frontend_acceptance\/ACCEPTANCE_H63_OPERATOR_PILOT_V1\.cjs$/];
const block = [/^apps\/web\/src\/app\/App\.tsx$/, /^apps\/server\//, /^migrations\//, /^packages\/contracts\//, /^fixtures\//, /^package\.json$/, /^pnpm-lock\.yaml$/, /^pnpm-workspace\.yaml$/];
const assertions = [];
function read(f){return fs.readFileSync(path.join(root, f),'utf8');}
function exists(f){return fs.existsSync(path.join(root, f));}
function has(s,xs){return xs.every(x=>s.includes(x));}
function ok(n,p,d={}){assertions.push({name:n,passed:p,details:d}); if(!p){const e=new Error('ASSERTION_FAILED:'+n);e.details=d;throw e;} console.log('[h63-operator-pilot] ok:',n);}
function changed(){for(const a of [['diff','--name-only','origin/main...HEAD'],['diff','--name-only','main...HEAD']]){try{return cp.execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).split(/\r?\n/).filter(Boolean);}catch(_){}}return [];}
function match(f,rs){return rs.some(r=>r.test(f));}
try{
  Object.entries(files).forEach(([k,f])=>ok(k+'_exists',exists(f),{file:f}));
  const diff=changed();
  ok('changed_files_allowlist',diff.length===0||diff.every(f=>match(f,allow)),{diff});
  ok('blocked_files_unchanged',diff.every(f=>!match(f,block)),{diff});
  const app=read(files.app),layout=read(files.layout),page=read(files.page),vm=read(files.vm),doc=read(files.doc),p54=read(files.p54);
  ok('app_unchanged',!diff.includes(files.app)&&!app.includes('OperatorPilotPage'),{file:files.app});
  ok('layout_exposes_route',has(layout,['OperatorPilotPage','/operator/pilot','data-h63="pilot-readiness-product-surface"','isPilotReadiness ? <OperatorPilotPage /> : children']),{file:files.layout});
  ok('page_has_sections',has(page,['P53 Pilot Planning Gate','P54 Readiness Review Gate','Readiness Dimensions','Capability Matrix','Boundary / Nonclaims','Next Allowed Gate']),{file:files.page});
  ok('vm_has_gates',has(vm,['field_pilot_readiness_product_v1','controlled_pilot_readiness_review','PLAN_READY_WITH_LIMITATIONS','READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS','p55_runtime_health_service_gate_allowed','field_pilot_execution_allowed','false']),{file:files.vm});
  ok('vm_has_boundaries',has(vm,['field_pilot_started','real_device_deployed','production_gateway_online','live_runtime_monitoring_active','ao_act_task_created','dispatch_enabled','execution_happened','roi_computed','field_memory_learned','full_runtime_v1_frozen','backend_contract_changed']),{file:files.vm});
  ok('p54_preserved',has(p54,['p55_runtime_health_service_gate_allowed','field_pilot_execution_allowed','false']),{file:files.p54});
  ok('doc_records_surface',has(doc,['/operator/pilot','field_pilot_readiness_product_v1','controlled_pilot_readiness_review']),{file:files.doc});
  console.log(JSON.stringify({ok:true,acceptance:'ACCEPTANCE_H63_OPERATOR_PILOT_V1',changed_files_checked:diff,assertions},null,2));
}catch(e){console.error(JSON.stringify({ok:false,acceptance:'ACCEPTANCE_H63_OPERATOR_PILOT_V1',error:e.message,details:e.details||null,assertions},null,2));process.exit(1);}
