const fs = require('node:fs');
const cp = require('node:child_process');
const HEAD_BATCH3 = '622a3f7b59d78faf900ab6d43cf52cb9e6458b7e';
const HEAD_BATCH4 = '9074b8c8035fc69e19353d3827fb43ef3ea4cebb';
const CORRECTIONS = ['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const TARGETS = ['BSEC-022','BSEC-023'];
function sh(args) { return cp.execFileSync('git',['-c','core.quotepath=false',...args],{encoding:'utf8'}).trim(); }
function read(p) { return fs.readFileSync(p,'utf8'); }
function assert(c,m,x) { if(!c) throw new Error(`${m}${x===undefined?'':`: ${JSON.stringify(x)}`}`); }
const moduleSrc = read('apps/server/src/modules/admin/registerAdminModule.ts');
const semanticPath = 'apps/server/src/modules/admin/registerAdminImportModule.ts';
const loadfactPath = 'scripts/loadfact.ts';
const semanticSrc = read(semanticPath);
const loadfactSrc = read(loadfactPath);
assert(sh(['diff','--name-only',HEAD_BATCH3,HEAD_BATCH4,'--',semanticPath]) === '', 'Batch004B semantic source boundary drift');
assert(sh(['diff','--name-only',HEAD_BATCH3,HEAD_BATCH4,'--',loadfactPath]) === '', 'Batch004B loadfact boundary drift');
assert(moduleSrc.includes('ADMIN_IMPORT_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE'),'Batch004B fail-close missing');
assert(moduleSrc.includes('/api/admin/import/caf_hourly') && moduleSrc.includes('/api/admin/acceptance/caf009_1h/run'),'Batch004B exact routes missing');
assert(semanticSrc.includes('"--writeMarkers"'),'writeMarkers argv source truth drift');
assert(!loadfactSrc.includes('writeMarkers'),'writeMarkers unexpectedly active');
assert(loadfactSrc.includes('insert into facts') && loadfactSrc.includes('insert into raw_samples') && !loadfactSrc.includes('insert into markers'),'loadfact target truth drift');
assert(semanticSrc.includes('http://127.0.0.1:${port}/api/judge/run'),'BSEC-023 attempted Judge edge drift');
assert(read('apps/server/src/routes/judge.ts').includes('Intentionally register NOTHING here.'),'Commercial legacy Judge unexpectedly active');
assert(read('apps/judge/src/runtime.ts').includes('const persist = false;'),'standalone Judge persistence drift');
const inv = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen = inv.surfaces ?? [];
const byId = new Map(frozen.map(r=>[r.surface_id,r]));
for(const id of TARGETS){ const r=byId.get(id); assert(r && r.runtime_reachable===true,'Batch004B row missing/unreachable',id); assert(r.caller_authority_status==='UNAUTHENTICATED_PRODUCTION_WRITER','Batch004B status drift',id); assert(r.tenant_scope_from_untrusted_body===true,'Batch004B tenant drift',id); }
function debt(rows){const reachable=rows.filter(r=>r.runtime_reachable===true);return [reachable.filter(r=>['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE'].includes(r.caller_authority_status)).length,reachable.filter(r=>r.authz_capability.length===0||['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE','AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY','AUTHENTICATED_BUT_CAPABILITY_MISMATCH','AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY'].includes(r.caller_authority_status)).length,reachable.filter(r=>String(r.declared_actor_binding||'').includes('CALLER_DECLARED_NOT_AUTH_BOUND')).length,reachable.filter(r=>String(r.principal_type||'').includes('SERVICE')&&r.caller_authority_status==='SERVICE_IDENTITY_PARTIAL').length,reachable.filter(r=>r.tenant_scope_from_untrusted_body===true).length];}
function close(rows,ids){const s=new Set(ids);return rows.map(r=>s.has(r.surface_id)?{...r,runtime_reachable:false}:r);}
const frozenDebt=debt(frozen); assert(JSON.stringify(frozenDebt)===JSON.stringify([35,109,7,3,16]),'frozen debt drift',frozenDebt);
const corrected=frozen.map(r=>CORRECTIONS.includes(r.surface_id)?{...r,tenant_scope_from_untrusted_body:true}:{...r});
let rows=close(corrected,['BSEC-001','BSEC-002']); rows=close(rows,['BSEC-003']); rows=close(rows,['BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010']);
const before=debt(rows), after=debt(close(rows,TARGETS));
assert(JSON.stringify(before)===JSON.stringify([26,100,7,3,18]),'Batch004B start drift',before);
assert(JSON.stringify(after)===JSON.stringify([24,98,7,3,16]),'Batch004B accepted after drift',after);
const changed=sh(['diff','--name-only',HEAD_BATCH3,HEAD_BATCH4]).split(/\r?\n/).filter(Boolean);
const allowed=new Set(['.github/workflows/bline-pr-sec2-containment.yml','apps/server/src/modules/admin/registerAdminModule.ts','scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.cjs','scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_TWIN_BASE_FAIL_CLOSED_V1.cjs','scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.ts','scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_COMMERCIAL_RUNTIME_V1.ts']);
for(const p of changed) assert(allowed.has(p),'Batch004B accepted scope drift',p);
console.log(JSON.stringify({result:'PASS',batch:'PRSEC2-BATCH-004B',qualification_boundary:[HEAD_BATCH3,HEAD_BATCH4],before,after,changed_files:changed},null,2));
