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

function proveHistoricalDirectExecutorRuntime(config){
  const executor=config?.services?.executor;
  if(!executor||executor.profiles?.length)return false;
  if(executor.entrypoint!=null)return false;
  return Array.isArray(executor.command)&&JSON.stringify(executor.command)===JSON.stringify(['node','apps/executor/dist/runtime_loop.js']);
}
function proveSuccessorShellExecutorRuntime(config){
  const executor=config?.services?.executor;
  if(!executor||executor.profiles?.length)return false;
  if(!Array.isArray(executor.entrypoint)||JSON.stringify(executor.entrypoint)!==JSON.stringify(['/bin/sh','-ceu']))return false;
  if(!Array.isArray(executor.command)||executor.command.length!==1||typeof executor.command[0]!=='string')return false;
  const statements=executor.command[0].trim().split(/\r?\n/).map(x=>x.trim());
  if(statements.length!==3)return false;
  const dbExport=/^export DATABASE_URL="postgres:\/\/geox_executor_runtime_v1:\${1,2}\(cat \/run\/geox\/executor\/db_password\)@postgres:5432\/[A-Za-z0-9_-]+"$/;
  const mqttExport=/^export GEOX_MQTT_PASSWORD="\${1,2}\(cat \/run\/geox\/executor\/mqtt_password\)"$/;
  return dbExport.test(statements[0])&&mqttExport.test(statements[1])&&statements[2]==='exec node apps/executor/dist/runtime_loop.js';
}
function proveEffectiveExecutorRuntime(config){return proveHistoricalDirectExecutorRuntime(config)||proveSuccessorShellExecutorRuntime(config);}
function executorRuntimeSelftest(){
  const direct={command:['node','apps/executor/dist/runtime_loop.js']};
  const command='export DATABASE_URL="postgres://geox_executor_runtime_v1:$(cat /run/geox/executor/db_password)@postgres:5432/landos"\nexport GEOX_MQTT_PASSWORD="$(cat /run/geox/executor/mqtt_password)"\nexec node apps/executor/dist/runtime_loop.js';
  const shell={entrypoint:['/bin/sh','-ceu'],command:[command]};
  const cases=[
    ['historical-direct',{services:{executor:direct}},true],
    ['successor-shell',{services:{executor:shell}},true],
    ['executor-absent',{services:{}},false],
    ['wrong-module-direct',{services:{executor:{command:['node','apps/executor/dist/other_loop.js']}}},false],
    ['wrong-module-shell',{services:{executor:{...shell,command:[command.replace('runtime_loop.js','other_loop.js')]}}},false],
    ['command-absent',{services:{executor:{entrypoint:shell.entrypoint}}},false],
    ['comment-only',{services:{executor:{...shell,command:[command.replace('exec node apps/executor/dist/runtime_loop.js','# exec node apps/executor/dist/runtime_loop.js')]}}},false],
    ['other-service-only',{services:{other:shell}},false],
    ['wrong-entrypoint',{services:{executor:{...shell,entrypoint:['/bin/sh','-c']}}},false],
    ['inactive-profile',{services:{executor:{...shell,profiles:['inactive']}}},false],
    ['unreachable-runtime-tail',{services:{executor:{...shell,command:[command.replace('\nexec node','\nexit 0\nexec node')]}}},false],
    ['runtime-string-never-executed',{services:{executor:{...shell,command:[command.replace('exec node apps/executor/dist/runtime_loop.js','printf "%s\\n" "apps/executor/dist/runtime_loop.js"')]}}},false],
    ['ambiguous-direct-plus-shell',{services:{executor:{entrypoint:['/bin/sh','-ceu'],command:['node','apps/executor/dist/runtime_loop.js']}}},false],
    ['run-once-substitution',{services:{executor:{...shell,command:[command.replace('runtime_loop.js','run_once.js')]}}},false]
  ];
  for(const [name,config,want] of cases)assert(proveEffectiveExecutorRuntime(config)===want,'EXECUTOR_RUNTIME_SELFTEST_FAILED',name);
  console.log(`BLINE_EXECUTOR_RUNTIME_NEGATIVE_SELFTEST_PASS count=${cases.length}`);
}
function renderedCommercialCompose(){
  const env={...process.env,
    POSTGRES_USER:'landos',POSTGRES_PASSWORD:'structure-only',POSTGRES_DB:'landos',
    GEOX_MCFT_MIGRATOR_PASSWORD:'structure-only',GEOX_RUNTIME_DATABASE_PASSWORD:'structure-only',
    GEOX_DEPLOYMENT_SUBJECT_COMMIT:sh(['rev-parse','HEAD']),GEOX_EXECUTOR_TOKEN:'structure-only',
    MINIO_ROOT_USER:'structure-only',MINIO_ROOT_PASSWORD:'structure-only',
    CORS_ORIGINS:'https://structure.geox.invalid',APP_SECRET:'structure-only',PUBLIC_BASE_URL:'https://structure.geox.invalid'
  };
  return JSON.parse(cp.execFileSync('docker',['compose','--env-file','.env.commercial_v1.example','-f',composePath,'config','--format','json'],{encoding:'utf8',env,maxBuffer:8*1024*1024}));
}
const compose=read(composePath),runOnce=read(runOncePath);
executorRuntimeSelftest();
const effectiveCompose=renderedCommercialCompose();
assert(proveEffectiveExecutorRuntime(effectiveCompose),'Commercial executor effective runtime drift');
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