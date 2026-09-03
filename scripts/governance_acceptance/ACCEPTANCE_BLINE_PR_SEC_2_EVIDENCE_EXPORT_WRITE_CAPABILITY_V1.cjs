const fs=require('node:fs'),cp=require('node:child_process');
const BATCH007_HEAD='a7bcd53c61522b11342c74cfa4af02b12f44c26e';
const BATCH008_ACCEPTED_HEAD='35398258d3c59810aba3d19af1c295b1f05a57ce';
const CORRECTIONS=['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const CLOSED_THROUGH_007=['BSEC-001','BSEC-002','BSEC-003','BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010','BSEC-022','BSEC-023','BSEC-024','BSEC-025','BSEC-026','BSEC-030','BSEC-141'];
const TARGET='BSEC-120';
function sh(a){return cp.execFileSync('git',['-c','core.quotepath=false',...a],{encoding:'utf8'}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function assert(c,m,x){if(!c)throw new Error(`${m}${x===undefined?'':`: ${JSON.stringify(x)}`}`);}
const sourcePath='apps/server/src/routes/delivery_evidence_export_v1.ts';
const canonicalPath='apps/server/src/routes/evidence_export_jobs_v1.ts';
const composePath='docker-compose.commercial_v1.yml';
const runOncePath='apps/executor/src/run_once.ts';
const beforeSource=sh(['show',`${BATCH007_HEAD}:${sourcePath}`]);
const source=read(sourcePath);
const oldLine='const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Require read-only AO-ACT scope.';
const newLine='const auth = requireAoActScopeV0(req, reply, "evidence_export.write"); // Creating an export job is write authority; match the canonical successor capability.';
const createMarker='const createJobHandler = async (req: any, reply: any)';
const start=beforeSource.indexOf(createMarker);
const target=beforeSource.indexOf(oldLine,start);
assert(start>=0&&target>=0,'Batch007 BSEC-120 create auth source truth missing');
let expected=beforeSource.slice(0,target)+newLine+beforeSource.slice(target+oldLine.length);
const oldReturn='if (!auth) return; // Stop if auth failed (handler already replied).';
const newReturn='if (!auth) return reply; // Auth helper already replied; return the Fastify reply to preserve single-response ownership.';
const returnStart=expected.indexOf(createMarker);
const returnTarget=expected.indexOf(oldReturn,returnStart);
assert(returnStart>=0&&returnTarget>=0,'Batch007 BSEC-120 create auth return source truth missing');
expected=expected.slice(0,returnTarget)+newReturn+expected.slice(returnTarget+oldReturn.length);
assert(source.trim()===expected.trim(),'BSEC-120 source changed beyond exact create capability + reply-ownership repair');
assert(source.includes(newReturn),'BSEC-120 denied auth must preserve single-response ownership');
assert((source.match(/requireAoActScopeV0\(req, reply, "evidence_export\.write"\)/g)||[]).length===1,'legacy evidence export create must require evidence_export.write exactly once');
assert((source.match(/requireAoActScopeV0\(req, reply, "ao_act\.index\.read"\)/g)||[]).length===2,'legacy evidence export GET status/download must retain read scope');
assert(source.includes('app.post("/api/delivery/evidence_export/v1/jobs", createJobHandler)'),'legacy create route missing');
assert(source.includes('acceptance:not-written legacy-export-is-non-authoritative'),'P0-RES-007 no-Acceptance semantic closure drift');
const canonical=read(canonicalPath);
assert(canonical.includes('app.post("/api/v1/evidence-export/jobs"'),'canonical successor create route missing');
assert(canonical.includes('requireAoActScopeV0(req, reply, "evidence_export.write")'),'canonical successor write capability drift');
const compose=read(composePath),runOnce=read(runOncePath);
assert(compose.includes('command: ["node", "apps/executor/dist/runtime_loop.js"]'),'Commercial executor command drift');
assert(!compose.includes('apps/executor/dist/run_once.js'),'Commercial compose must not run legacy one-shot executor');
assert(runOnce.includes('/api/delivery/evidence_export/v1/jobs'),'one-shot legacy caller source truth drift');
const inv=JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen=inv.surfaces??[],byId=new Map(frozen.map(r=>[r.surface_id,r]));
const row=byId.get(TARGET);
assert(row&&row.runtime_reachable===true,'BSEC-120 frozen row missing/unreachable');
assert(row.caller_authority_status==='AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY','BSEC-120 status drift',row?.caller_authority_status);
assert(JSON.stringify(row.authz_capability)===JSON.stringify(['ao_act.index.read']),'BSEC-120 frozen capability drift',row?.authz_capability);
assert(row.required_action==='RETIRE_OR_REQUIRE_EVIDENCE_EXPORT_WRITE; P0_RES_007_SEMANTIC_ACCEPTANCE_MINTING_REMAINS_CLOSED','BSEC-120 frozen action drift',row?.required_action);
function debt(rows){const reachable=rows.filter(r=>r.runtime_reachable===true);return [
reachable.filter(r=>['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE'].includes(r.caller_authority_status)).length,
reachable.filter(r=>r.authz_capability.length===0||['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE','AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY','AUTHENTICATED_BUT_CAPABILITY_MISMATCH','AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY'].includes(r.caller_authority_status)).length,
reachable.filter(r=>String(r.declared_actor_binding||'').includes('CALLER_DECLARED_NOT_AUTH_BOUND')).length,
reachable.filter(r=>String(r.principal_type||'').includes('SERVICE')&&r.caller_authority_status==='SERVICE_IDENTITY_PARTIAL').length,
reachable.filter(r=>r.tenant_scope_from_untrusted_body===true).length];}
function close(rows,ids){const s=new Set(ids);return rows.map(r=>s.has(r.surface_id)?{...r,runtime_reachable:false}:r);}
function repair(rows,id){return rows.map(r=>r.surface_id===id?{...r,caller_authority_status:'AUTHENTICATED_CAPABILITY_BOUND',authz_capability:['evidence_export.write']}:r);}
function delta(a,b){return b.map((v,i)=>v-a[i]);}
const frozenDebt=debt(frozen);assert(JSON.stringify(frozenDebt)===JSON.stringify([35,109,7,3,16]),'frozen debt drift',frozenDebt);
const corrected=frozen.map(r=>CORRECTIONS.includes(r.surface_id)?{...r,tenant_scope_from_untrusted_body:true}:{...r});
assert(JSON.stringify(debt(corrected))===JSON.stringify([35,109,7,3,22]),'corrected debt drift',debt(corrected));
const before=debt(close(corrected,CLOSED_THROUGH_007));
const after=debt(repair(close(corrected,CLOSED_THROUGH_007),TARGET));
const batchDelta=delta(before,after);
assert(JSON.stringify(before)===JSON.stringify([19,93,7,3,14]),'Batch008 start mismatch',before);
assert(JSON.stringify(batchDelta)===JSON.stringify([0,-1,0,0,0]),'Batch008 delta mismatch',batchDelta);
assert(JSON.stringify(after)===JSON.stringify([19,92,7,3,14]),'Batch008 after mismatch',after);
const allowed=new Set([
'.github/workflows/bline-pr-sec2-batch008.yml',
'.github/workflows/bline-pr-sec2-containment.yml',
'apps/server/src/routes/delivery_evidence_export_v1.ts',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_EVIDENCE_EXPORT_WRITE_CAPABILITY_V1.cjs',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_CANOPY_UPLOAD_FAIL_CLOSED_V1.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_EVIDENCE_EXPORT_WRITE_CAPABILITY_V1.ts',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_EVIDENCE_EXPORT_COMMERCIAL_RUNTIME_V1.ts'
]);
const changed=sh(['diff','--name-only',BATCH007_HEAD,BATCH008_ACCEPTED_HEAD]).split(/\r?\n/).filter(Boolean);
for(const p of changed) assert(allowed.has(p),'Batch008 accepted-head scope expansion',p);
for(const p of changed) assert(!/mcft/i.test(p),'Batch008 accepted-head MCFT path changed',p);
assert(sh(['diff','--name-only',BATCH008_ACCEPTED_HEAD,'HEAD','--',sourcePath])==='','accepted BSEC-120 production source drift in successor workstream',sourcePath);
console.log(JSON.stringify({result:'PASS',batch:'PRSEC2-BATCH-008',target:TARGET,accepted_head:BATCH008_ACCEPTED_HEAD,repair:'LEGACY_CREATE_REQUIRES_EVIDENCE_EXPORT_WRITE',frozen_prsec1:frozenDebt,corrected_prsec1:debt(corrected),before,delta:batchDelta,after,changed_files:changed,mcft_delta:0},null,2));