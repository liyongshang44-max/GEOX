const fs=require('node:fs'),cp=require('node:child_process');
const HEAD_BATCH5='3c3e7b0182847de40c9d9357066a955364e6bed1';
const CORRECTIONS=['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const CLOSED_BEFORE=['BSEC-001','BSEC-002','BSEC-003','BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010','BSEC-022','BSEC-023','BSEC-024','BSEC-025','BSEC-026'];
const TARGET='BSEC-141';
function sh(a){return cp.execFileSync('git',['-c','core.quotepath=false',...a],{encoding:'utf8'}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function assert(c,m,x){if(!c)throw new Error(`${m}${x===undefined?'':`: ${JSON.stringify(x)}`}`);}
const registrationPath='apps/server/src/modules/execution/registerExecutionModule.ts';
const semanticPath='apps/server/src/routes/human_executors_v1.ts';
const fallbackPath='apps/server/src/domain/controlplane/task_service.ts';
for(const p of [semanticPath,fallbackPath]) assert(sh(['diff','--name-only',HEAD_BATCH5,'HEAD','--',p])==='',`${p} changed in Batch006`);
const registration=read(registrationPath),semantic=read(semanticPath),fallback=read(fallbackPath);
assert(registration.includes('INTERNAL_AUTO_FALLBACK_COMMERCIAL_AUTHORITY_UNAVAILABLE'),'deterministic Batch006 error missing');
assert(registration.includes('path === "/api/internal/work-assignments/auto-fallback"'),'BSEC-141 exact registration interception missing');
assert(registration.includes('registerHumanExecutorV1Routes(guardedApp, pool)'),'production route registration wrapper missing');
for(const token of ['setTimeout(','setInterval(','setImmediate(','queueMicrotask(','.then(','addHook(','NODE_ENV']) assert(!registration.includes(token),`production containment contains forbidden token ${token}`);
assert(semantic.includes('app.post("/api/internal/work-assignments/auto-fallback"'),'frozen BSEC-141 semantic route source missing');
assert(semantic.includes('token_id: "internal_auto_fallback"')&&semantic.includes('role: "admin"'),'BSEC-141 source-truth pseudo auth context drift');
assert(fallback.includes('if (state === "FAILED" && taskFact)'),'canonical dispatch-failure fallback trigger missing');
assert(fallback.includes('createWorkAssignmentFallbackFact({'),'canonical fallback producer missing');
assert(fallback.includes('type: "work_assignment_upserted_v1"'),'canonical work assignment fact missing');
assert(fallback.includes('type: "ao_act_manual_fallback_v1"'),'canonical manual fallback fact missing');
assert(!fallback.includes('/api/internal/work-assignments/auto-fallback'),'canonical fallback unexpectedly delegates to BSEC-141 HTTP route');
const inv=JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen=inv.surfaces??[],byId=new Map(frozen.map(r=>[r.surface_id,r]));
const row=byId.get(TARGET);
assert(row&&row.runtime_reachable===true,'BSEC-141 frozen row missing/unreachable');
assert(row.caller_authority_status==='UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','BSEC-141 status drift',row?.caller_authority_status);
assert(Array.isArray(row.authz_capability)&&row.authz_capability.length===0,'BSEC-141 capability drift',row?.authz_capability);
assert(row.principal_type==='UNVERIFIED_INTERNAL_CALLER','BSEC-141 principal drift',row?.principal_type);
assert(row.tenant_scope_from_untrusted_body===false,'BSEC-141 tenant counter contribution drift',row?.tenant_scope_from_untrusted_body);
assert(row.declared_actor_binding==='NOT_APPLICABLE','BSEC-141 actor binding drift',row?.declared_actor_binding);
assert(JSON.stringify(row.write_targets)===JSON.stringify(['work_assignment_index_v1','operation_handoff_v1','work_assignment_audit_v1','service_team_index_v1','human_executor_index_v1','work_assignment_reassign_log_v1','facts']),'BSEC-141 target set drift',row.write_targets);
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
const before=debt(close(corrected,CLOSED_BEFORE)),after=debt(close(close(corrected,CLOSED_BEFORE),[TARGET])),batchDelta=delta(before,after);
assert(JSON.stringify(before)===JSON.stringify([21,95,7,3,15]),'Batch006 start mismatch',before);
assert(JSON.stringify(batchDelta)===JSON.stringify([-1,-1,0,0,0]),'Batch006 delta mismatch',batchDelta);
assert(JSON.stringify(after)===JSON.stringify([20,94,7,3,15]),'Batch006 after mismatch',after);
const allowed=new Set([
'.github/workflows/bline-pr-sec2-batch006.yml',
'.github/workflows/bline-pr-sec2-containment.yml',
'apps/server/src/modules/execution/registerExecutionModule.ts',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_INTERNAL_AUTO_FALLBACK_FAIL_CLOSED_V1.cjs',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEAK_INTERNAL_FAIL_CLOSED_V1.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_INTERNAL_AUTO_FALLBACK_FAIL_CLOSED_V1.ts',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_INTERNAL_AUTO_FALLBACK_COMMERCIAL_RUNTIME_V1.ts',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_CANONICAL_HUMAN_FALLBACK_RUNTIME_V1.ts'
]);
const changed=sh(['diff','--name-only',HEAD_BATCH5,'HEAD']).split(/\r?\n/).filter(Boolean);
for(const p of changed) assert(allowed.has(p),'Batch006 scope expansion',p);
for(const p of changed) assert(!/mcft/i.test(p),'MCFT path changed',p);
console.log(JSON.stringify({result:'PASS',batch:'PRSEC2-BATCH-006',containment:'COMMERCIAL_FAIL_CLOSE',target:TARGET,frozen_prsec1:frozenDebt,corrected_prsec1:debt(corrected),before,delta:batchDelta,after,changed_files:changed,mcft_delta:0},null,2));
