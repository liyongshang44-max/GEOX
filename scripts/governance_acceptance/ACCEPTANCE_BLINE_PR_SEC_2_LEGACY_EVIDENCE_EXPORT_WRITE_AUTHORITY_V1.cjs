const fs=require('node:fs'),cp=require('node:child_process');
const ACCEPTED_BATCH007_HEAD='a7bcd53c61522b11342c74cfa4af02b12f44c26e';
const CORRECTIONS=['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const CLOSED_THROUGH_007=['BSEC-001','BSEC-002','BSEC-003','BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010','BSEC-022','BSEC-023','BSEC-024','BSEC-025','BSEC-026','BSEC-141','BSEC-030'];
const TARGET='BSEC-120';
function sh(a){return cp.execFileSync('git',['-c','core.quotepath=false',...a],{encoding:'utf8'}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function assert(c,m,x){if(!c)throw new Error(`${m}${x===undefined?'':`: ${JSON.stringify(x)}`}`);}
function ancestor(a,b){return cp.spawnSync('git',['merge-base','--is-ancestor',a,b]).status===0;}
assert(ancestor(ACCEPTED_BATCH007_HEAD,'HEAD'),'accepted Batch007 head is not ancestor of current head');
const targetPath='apps/server/src/routes/delivery_evidence_export_v1.ts';
const canonicalPath='apps/server/src/routes/evidence_export_jobs_v1.ts';
const rolesPath='apps/server/src/domain/auth/roles.ts';
const tokensPath='config/auth/security_acceptance_tokens.json';
const legacyCallerPath='apps/executor/src/run_once.ts';
const source=read(targetPath),canonical=read(canonicalPath);
assert(source.includes('requireAoActScopeV0(req, reply, "evidence_export.write")'),'legacy POST does not require evidence_export.write');
assert(!source.includes('const auth = requireAoActScopeV0(req, reply, "ao_act.index.read"); // Creating an export job'),'legacy POST still uses read authority');
const readUses=(source.match(/requireAoActScopeV0\(req, reply, "ao_act\.index\.read"\)/g)||[]).length;
assert(readUses>=2,'legacy status/download read authority drift',readUses);
assert(source.includes('acceptance_fact_id: null'),'Acceptance fact field no longer null at creation');
assert(source.includes('acceptance_result: null'),'Acceptance result field no longer null at creation');
assert(source.includes('acceptance:not-written legacy-export-is-non-authoritative'),'legacy exporter Acceptance non-authority marker missing');
assert(canonical.includes('requireAoActScopeV0(req, reply, "evidence_export.write")'),'canonical exporter write authority drift');
for(const p of [canonicalPath,rolesPath,tokensPath,legacyCallerPath]){
  assert(sh(['diff','--name-only',ACCEPTED_BATCH007_HEAD,'HEAD','--',p])==='',`${p} changed in Batch008`);
}
const numstat=sh(['diff','--numstat',ACCEPTED_BATCH007_HEAD,'HEAD','--',targetPath]);
assert(/^1\s+1\s+apps\/server\/src\/routes\/delivery_evidence_export_v1\.ts$/.test(numstat),'Batch008 production delta is not exact one-line replacement',numstat);
const patch=sh(['diff','--unified=0',ACCEPTED_BATCH007_HEAD,'HEAD','--',targetPath]);
assert(patch.includes('-      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");'),'expected old read authority not found in exact delta');
assert(patch.includes('+      const auth = requireAoActScopeV0(req, reply, "evidence_export.write");'),'expected new write authority not found in exact delta');
const inv=JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen=inv.surfaces??[],byId=new Map(frozen.map(r=>[r.surface_id,r]));
const row=byId.get(TARGET);
assert(row&&row.runtime_reachable===true,'BSEC-120 frozen row missing/unreachable');
assert(row.caller_authority_status==='AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY','BSEC-120 status drift',row?.caller_authority_status);
assert(JSON.stringify(row.authz_capability)===JSON.stringify(['ao_act.index.read']),'BSEC-120 frozen capability drift',row?.authz_capability);
assert(row.tenant_scope_from_untrusted_body===false,'BSEC-120 tenant contribution drift');
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
const before=debt(close(corrected,CLOSED_THROUGH_007));
const after=debt(close(close(corrected,CLOSED_THROUGH_007),[TARGET]));
const batchDelta=delta(before,after);
assert(JSON.stringify(before)===JSON.stringify([19,93,7,3,14]),'Batch008 start mismatch',before);
assert(JSON.stringify(batchDelta)===JSON.stringify([0,-1,0,0,0]),'Batch008 delta mismatch',batchDelta);
assert(JSON.stringify(after)===JSON.stringify([19,92,7,3,14]),'Batch008 after mismatch',after);
const allowed=new Set([
'.github/workflows/bline-pr-sec2-batch008.yml',
'.github/workflows/bline-pr-sec2-containment.yml',
'apps/server/src/routes/delivery_evidence_export_v1.ts',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_CANOPY_UPLOAD_FAIL_CLOSED_V1.cjs',
'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_EVIDENCE_EXPORT_WRITE_AUTHORITY_V1.cjs',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_EVIDENCE_EXPORT_WRITE_AUTHORITY_V1.ts',
'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_EVIDENCE_EXPORT_WRITE_COMMERCIAL_RUNTIME_V1.ts'
]);
const changed=sh(['diff','--name-only',ACCEPTED_BATCH007_HEAD,'HEAD']).split(/\r?\n/).filter(Boolean);
for(const p of changed) assert(allowed.has(p),'Batch008 scope expansion',p);
for(const p of changed) assert(!/mcft/i.test(p),'MCFT path changed',p);
console.log(JSON.stringify({result:'PASS',batch:'PRSEC2-BATCH-008',target:TARGET,accepted_predecessor:ACCEPTED_BATCH007_HEAD,frozen_prsec1:frozenDebt,corrected_prsec1:debt(corrected),before,delta:batchDelta,after,read_get_authority_uses:readUses,changed_files:changed,mcft_delta:0},null,2));
