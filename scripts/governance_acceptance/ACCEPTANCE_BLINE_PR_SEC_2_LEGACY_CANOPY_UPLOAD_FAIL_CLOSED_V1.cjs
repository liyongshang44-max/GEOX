const fs=require('node:fs'),cp=require('node:child_process');
const BATCH006_HEAD='c15d559d0ab2a0332cac2a2a1cf2f9d4e7f2119f';
const CORRECTIONS=['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const CLOSED_THROUGH_006=['BSEC-001','BSEC-002','BSEC-003','BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010','BSEC-022','BSEC-023','BSEC-024','BSEC-025','BSEC-026','BSEC-141'];
const TARGET='BSEC-030';
function sh(a){return cp.execFileSync('git',['-c','core.quotepath=false',...a],{encoding:'utf8'}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function assert(c,m,x){if(!c)throw new Error(`${m}${x===undefined?'':`: ${JSON.stringify(x)}`}`);}
const registrationPath='apps/server/src/routes/registerLegacyRoutes.ts';
const sourcePath='apps/server/src/modules/legacy/registerLegacyMonitoringModule.ts';
assert(sh(['diff','--name-only',BATCH006_HEAD,'HEAD','--',sourcePath])==='',`${sourcePath} changed in Batch007`);
const registration=read(registrationPath),source=read(sourcePath);
assert(registration.includes('LEGACY_CANOPY_UPLOAD_COMMERCIAL_AUTHORITY_UNAVAILABLE'),'deterministic Batch007 error missing');
assert(registration.includes('path === "/api/canopy/upload"'),'BSEC-030 exact registration interception missing');
assert(registration.includes('registerLegacyMonitoringModule(guardedApp, pool, mediaDir)'),'legacy monitoring registration wrapper missing');
for(const token of ['setTimeout(','setInterval(','setImmediate(','queueMicrotask(','.then(','addHook(','NODE_ENV']) assert(!registration.includes(token),`production containment contains forbidden token ${token}`);
assert(source.includes('app.post("/api/canopy/upload"'),'frozen BSEC-030 route source missing');
assert(source.includes('app.post("/api/canopy/frame"'),'BSEC-029 sibling route source missing');
assert(source.includes('fs.writeFileSync(outPath, fileBuf)'),'BSEC-030 filesystem side effect source truth drift');
assert(source.includes('type: "canopy_frame_v1"'),'BSEC-030 fact type source truth drift');
const callerScan=sh(['grep','-RIl','/api/canopy/upload','apps']).split(/\r?\n/).filter(Boolean)
  .filter(p=>p!==sourcePath && p!==registrationPath);
assert(callerScan.length===0,'unexpected current repository BSEC-030 caller/reference',callerScan);
const inv=JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen=inv.surfaces??[],byId=new Map(frozen.map(r=>[r.surface_id,r]));
const row=byId.get(TARGET);
assert(row&&row.runtime_reachable===true,'BSEC-030 frozen row missing/unreachable');
assert(row.caller_authority_status==='UNAUTHENTICATED_PRODUCTION_WRITER','BSEC-030 status drift',row?.caller_authority_status);
assert(Array.isArray(row.authz_capability)&&row.authz_capability.length===0,'BSEC-030 capability drift',row?.authz_capability);
assert(row.principal_type==='UNVERIFIED_CALLER','BSEC-030 principal drift',row?.principal_type);
assert(row.tenant_scope_from_untrusted_body===true,'BSEC-030 tenant counter contribution drift',row?.tenant_scope_from_untrusted_body);
assert(row.declared_actor_binding==='NOT_APPLICABLE','BSEC-030 actor binding drift',row?.declared_actor_binding);
assert(JSON.stringify(row.write_targets)===JSON.stringify(['facts']),'BSEC-030 target set drift',row.write_targets);
function debt(rows){const reachable=rows.filter(r=>r.runtime_reachable===true);return [
reachable.filter(r=>['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE'].includes(r.caller_authority_status)).length,
reachable.filter(r=>r.authz_capability.length===0||['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE','AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY','AUTHENTICATED_BUT_CAPABILITY_MISMATCH','AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY'].includes(r.caller_authority_status)).length,
reachable.filter(r=>String(r.declared_actor_binding||'').includes('CALLER_DECLARED_NOT_AUTH_BOUND')).length,
reachable.filter(r=>String(r.principal_type||'').includes('SERVICE')&&r.caller_authority_status==='SERVICE_IDENTITY_PARTIAL').length,
reachable.filter(r=>r.tenant_scope_from_untrusted_body===true).length];}
function close(rows,ids){const s=new Set(ids);return rows.map(r=>s.has(r.surface_id)?{...r,runtime_reachable:false}:r);}
function delta(a,b){return b.map((v,i)=>v-a[i]);}
const frozenDebt=debt(frozen);assert(JSON.stringify(frozenDebt)===JSON.stringify([35,109,7,3,16]),'frozen debt drift',frozenDebt);
const corrected=frozen.map(r=>CORRECTIONS.includes(r.surface_id)?{...r,tenant_scope_from_untrusted_body:true}:{...r});
assert(JSON.stringify(debt(corrected))===JSON.stringify([35,109,7,3,22]),'corrected debt drift',debt(corrected));
const before=debt(close(corrected,CLOSED_THROUGH_006)),after=debt(close(close(corrected,CLOSED_THROUGH_006),[TARGET])),batchDelta=delta(before,after);
assert(JSON.stringify(before)===JSON.stringify([20,94,7,3,15]),'Batch007 start mismatch',before);
assert(JSON.stringify(batchDelta)===JSON.stringify([-1,-1,0,0,-1]),'Batch007 delta mismatch',batchDelta);
assert(JSON.stringify(after)===JSON.stringify([19,93,7,3,14]),'Batch007 after mismatch',after);
const allowed=new Set([
'.github/workflows/bline-pr-sec2-batch007.yml',
'.github/workflows/bline-pr-sec2-containment.yml',
'apps/server/src/routes/registerLegacyRoutes.ts',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_CANOPY_UPLOAD_FAIL_CLOSED_V1.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_CANOPY_UPLOAD_FAIL_CLOSED_V1.ts',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_CANOPY_UPLOAD_COMMERCIAL_RUNTIME_V1.ts'
]);
const changed=sh(['diff','--name-only',BATCH006_HEAD,'HEAD']).split(/\r?\n/).filter(Boolean);
for(const p of changed) assert(allowed.has(p),'Batch007 scope expansion',p);
for(const p of changed) assert(!/mcft/i.test(p),'MCFT path changed',p);
console.log(JSON.stringify({result:'PASS',batch:'PRSEC2-BATCH-007',containment:'COMMERCIAL_FAIL_CLOSE',target:TARGET,frozen_prsec1:frozenDebt,corrected_prsec1:debt(corrected),before,delta:batchDelta,after,caller_scan:callerScan,changed_files:changed,mcft_delta:0},null,2));