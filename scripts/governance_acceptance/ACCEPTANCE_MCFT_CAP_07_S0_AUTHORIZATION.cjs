#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_S0_AUTHORIZATION.cjs
// Purpose: validate the frozen MCFT-CAP-07 S0 authority materialization and changed-file boundary.
// Boundary: governance-only; no Runtime, database, route, projection, frontend, or canonical write execution.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_07_S0_AUTHORIZATION_RESULT.json');
const CAP = 'docs/digital_twin/mcft/cap_07';
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const exists = (p) => fs.existsSync(path.join(ROOT,p));
const required = [
 `${CAP}/GEOX-MCFT-CAP-07-TASK.md`,`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-ROUTE-OWNERSHIP-LOCK-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-HARD-ACCEPTANCE-LEDGER-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-ATTESTATION-RETENTION-STORE-CONTRACT-V1.json`,`${CAP}/GEOX-MCFT-CAP-07-WORKFLOW-DECLARATION-V1.json`,
 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_S0_AUTHORIZATION.cjs','scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_S0_LIVE_TRUSTED_EXERCISE.cjs','scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_SLICE_EXACT_SHA_ATTESTATION.cjs','scripts/governance_acceptance/mcft_attestation_retention_store_v1.cjs','.github/workflows/mcft-cap-07-s0-authorization.yml','.github/workflows/mcft-cap-07-slice-exact-sha-attestation.yml'
];
const checks=[]; const check=(ok,name,detail=null)=>{checks.push({name,status:ok?'PASS':'FAIL',detail}); if(!ok) throw new Error(name+(detail?`:${detail}`:''));};
try {
 for(const p of required) check(exists(p),`REQUIRED_PATH:${p}`);
 const task=fs.readFileSync(path.join(ROOT,`${CAP}/GEOX-MCFT-CAP-07-TASK.md`),'utf8');
 check(/document_status:\s*\nFROZEN/.test(task),'TASKBOOK_FROZEN');
 check(/S0_candidate_pr_authorized:\s*\ntrue/.test(task),'TASKBOOK_S0_AUTHORIZED');
 const manifest=load(`${CAP}/GEOX-MCFT-CAP-07-RESOLVED-MANIFEST-V1.json`);
 const authority=load(`${CAP}/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json`);
 const matrix=load(`${CAP}/GEOX-MCFT-CAP-07-SOURCE-VALIDATION-MATRIX-V1.json`);
 const routes=load(`${CAP}/GEOX-MCFT-CAP-07-ROUTE-OWNERSHIP-LOCK-V1.json`);
 const ledger=load(`${CAP}/GEOX-MCFT-CAP-07-HARD-ACCEPTANCE-LEDGER-V1.json`);
 const s1=load(`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`);
 const retention=load(`${CAP}/GEOX-MCFT-CAP-07-ATTESTATION-RETENTION-STORE-CONTRACT-V1.json`);
 const registry=load('docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');
 check(manifest.document_status==='FROZEN' && manifest.s0_candidate_pr_authorized===true && manifest.implementation_authorized===false,'MANIFEST_AUTHORITY');
 check(authority.status==='AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE','S0_REGISTERED_TRANSITION');
 check(authority.active_delivery_slice_id===null && authority.implementation_authorized===false && authority.read_runtime_implementation_authorized===false && authority.runtime_source_authorized===false && authority.canonical_write_authorized===false,'S0_ZERO_RUNTIME_AUTHORITY');
 check(matrix.profile_families.length===8 && new Set(matrix.profile_families).size===8,'EIGHT_PROFILE_FAMILIES');
 check(matrix.rows.length===40 && new Set(matrix.rows.map(r=>`${r.source_name}|${r.profile_family}`)).size===40,'SOURCE_MATRIX_EXACT_UNIQUE_ROWS');
 const requiredFields=new Set(matrix.row_schema_fields); for(const row of matrix.rows) for(const field of requiredFields) check(Object.hasOwn(row,field),`MATRIX_FIELD:${row.source_name}:${field}`);
 const inventory=matrix.required_source_inventory; const invCount=Object.entries(inventory).filter(([k])=>k!=='optional_evidence_reference_kinds').reduce((n,[,v])=>n+v.length,0); check(invCount===40,'SOURCE_INVENTORY_COUNT');
 check(routes.rows.length===20 && new Set(routes.rows.map(r=>`${r.method} ${r.exact_path}`)).size===20,'ROUTE_LOCK_UNIQUE');
 check(routes.rows.filter(r=>r.exact_path.includes('/runtime')).length===10 && routes.rows.filter(r=>r.exact_path.includes('/runtime')).every(r=>r.method==='GET'),'CANONICAL_RUNTIME_GET_ONLY_LOCK');
 check(ledger.item_count===ledger.items.length && ledger.unique_item_id_count===ledger.item_count && new Set(ledger.items.map(i=>i.item_id)).size===ledger.item_count,'HARD_ACCEPTANCE_UNIQUE');
 check(s1.s1_candidate_implemented===false && s1.implementation_authorized===false && s1.effectiveness_condition===null,'S1_SEED_NOT_SELF_AUTHORIZED');
 const cap=registry.capabilities.find(x=>x.capability_line==='MCFT-CAP-07');
 check(Boolean(cap),'REGISTRY_CAP07_PRESENT');
 check(cap.authoritative_candidate_status_paths.includes(`${CAP}/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json`) && cap.authoritative_candidate_status_paths.includes(`${CAP}/GEOX-MCFT-CAP-07-S1-DELIVERY-STATUS-V1.json`),'REGISTRY_S0_S1_PATHS');
 check(cap.candidate_transition_fields.some(x=>x.status_file.endsWith('CURRENT-AUTHORITY-V1.json')&&x.field_path==='status'&&x.allowed_candidate_values.includes('AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE')),'REGISTRY_S0_TRANSITION');
 check(cap.candidate_transition_fields.some(x=>x.status_file.endsWith('S1-DELIVERY-STATUS-V1.json')&&x.field_path==='s1_candidate_implemented'&&x.allowed_candidate_values.includes(true)),'REGISTRY_S1_TRANSITION');
 check(retention.store_contract_id==='MCFT_ATTESTATION_S3_COMPAT_OBJECT_LOCK_V1' && retention.namespace_prefix==='mcft-attestations-v1' && retention.product_namespace_forbidden==='evidence-exports-v1','RETENTION_AUTHORITY_SEPARATE');
 check(retention.required_bucket_controls.versioning==='Enabled' && retention.required_bucket_controls.object_lock==='Enabled' && retention.required_bucket_controls.worm_mode==='COMPLIANCE','RETENTION_WORM_CONTRACT');
 const base=process.env.MCFT_BASE_SHA||'';
 if(base){
   const changed=cp.execFileSync('git',['diff','--name-only',`${base}...HEAD`],{cwd:ROOT,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
   const allowed=(p)=>p.startsWith(`${CAP}/`)||p==='docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'||p.startsWith('scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_07_')||p==='scripts/governance_acceptance/mcft_attestation_retention_store_v1.cjs'||p.startsWith('.github/workflows/mcft-cap-07-');
   const bad=changed.filter(p=>!allowed(p)); check(bad.length===0,'S0_CHANGED_FILE_BOUNDARY',bad.join(','));
   const forbidden=changed.filter(p=>p.startsWith('apps/')||p.startsWith('packages/')||p.includes('/db/migrations/')||p.startsWith('fixtures/')); check(forbidden.length===0,'S0_NO_RUNTIME_MIGRATION_ROUTE_FRONTEND',forbidden.join(','));
 }
 const probe=`${CAP}/testing/GEOX-MCFT-CAP-07-S0-UNREGISTERED-PROBE.json`;
 const result={schema_version:'geox_mcft_cap_07_s0_authorization_result_v1',status:'PASS',subject_commit:process.env.GITHUB_SHA||null,negative_probe_present:exists(probe),checks};
 fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(result,null,2)+'\n'); console.log(`MCFT-CAP-07 S0 authorization: ${checks.length} PASS`);
} catch(error){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({schema_version:'geox_mcft_cap_07_s0_authorization_result_v1',status:'FAIL',error:String(error&&error.message||error),checks},null,2)+'\n');console.error(error);process.exit(1);}
