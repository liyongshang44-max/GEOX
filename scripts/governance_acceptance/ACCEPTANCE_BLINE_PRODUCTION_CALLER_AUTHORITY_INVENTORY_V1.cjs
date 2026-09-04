#!/usr/bin/env node
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');

// PR-SEC-1 is frozen historical coverage authority. Successor workstreams must
// replay that exact machine gate at the accepted predecessor and then prove that
// their bounded delta cannot add or hide a production mutation surface.
const BASE='bcc78fb00e73292362f237a95db3441e07389f6f';
const GATE='scripts/governance_acceptance/ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1.cjs';
const INVENTORY='docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json';
const W6B1='docs/architecture/semantic_convergence/GEOX-BLINE-W6B1-INTERNAL-TASK-ISSUER-PRINCIPAL-V1.json';
const SERVER='apps/server/src/server.ts';
const HELPER='apps/server/src/auth/internal_task_issuer_principal_v1.ts';
const APPROVAL='apps/server/src/routes/control_approval_request_v1.ts';
const COMPOSE='docker-compose.commercial_v1.yml';
const TOKENS='config/auth/security_acceptance_tokens.json';

function sh(args,opts={}){return cp.execFileSync('git',['-c','core.quotepath=false',...args],{encoding:'utf8',...opts}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function show(ref,p){return cp.execFileSync('git',['show',`${ref}:${p}`],{encoding:'utf8'});}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?'':': '+JSON.stringify(d)));}
function lines(s){return String(s||'').split(/\r?\n/).filter(Boolean).sort();}

const head=sh(['rev-parse','HEAD']);
assert(head!==BASE,'PR-SEC-1 successor dispatcher must not replace historical base execution');
try{cp.execFileSync('git',['merge-base','--is-ancestor',BASE,head],{stdio:'ignore'});}catch{throw new Error(`PR-SEC-1 successor is not descended from W6-A accepted base: ${head}`);}

// Frozen PR-SEC-1 material itself remains byte-identical.
assert(read(INVENTORY)===show(BASE,INVENTORY),'frozen PR-SEC-1 inventory drift');
assert(read(APPROVAL)===show(BASE,APPROVAL),'W6-B1 changed the inventoried internal delegation caller');

const w6b1=JSON.parse(read(W6B1));
assert(w6b1.version==='GEOX-BLINE-W6B1-INTERNAL-TASK-ISSUER-PRINCIPAL-V1','W6-B1 successor artifact version drift');
assert(w6b1.authority_base===BASE,'W6-B1 successor authority base drift',w6b1.authority_base);
assert(w6b1.status==='FROZEN_BOUNDED_WORKSTREAM_INVENTORY','W6-B1 bounded inventory status drift');

// No production graph source may change except the exact startup preflight and
// its read-only principal resolver. Routes, jobs, executor, telemetry and all
// persistent-writer sources therefore remain the exact graph audited at BASE.
const productionDrift=lines(sh(['diff','--name-only',BASE,'HEAD','--',
  'apps/server/src',
  'apps/executor/src',
  'apps/telemetry-ingest/src',
  'scripts/loadfact.ts',
  'docker/runtime.Dockerfile',
  'docs/contracts/v2/DEVICE_HEARTBEAT_AUTH_CONTRACT_V2.md',
  'docs/security/GEOX_RUNTIME_HARDENING_V1.md'
]));
assert(JSON.stringify(productionDrift)===JSON.stringify([HELPER,SERVER].sort()),'W6-B1 changed production graph outside bounded startup principal preflight',productionDrift);

const expectedServer=[
  'import { prepareInternalTaskIssuerPrincipalV1 } from "./auth/internal_task_issuer_principal_v1.js";',
  'import { startServer } from "./bootstrap/server.js";',
  '',
  'const runtimeEnv = String(process.env.GEOX_RUNTIME_ENV ?? "development").trim().toLowerCase();',
  'if (["pilot", "controlled-pilot", "controlled_pilot", "commercial", "staging", "production"].includes(runtimeEnv)) {',
  '  prepareInternalTaskIssuerPrincipalV1();',
  '}',
  '',
  'await startServer();'
].join('\n');
assert(read(SERVER).trim()===expectedServer,'W6-B1 server entrypoint contains behavior beyond exact issuer preflight');

const helper=read(HELPER);
for(const marker of [
  'readTokenFileV0',
  'INTERNAL_TASK_ISSUER_REQUIRED_SCOPE_V1 = "action.task.create"',
  'INTERNAL_TASK_ISSUER_REQUIRED_ROLE_V1 = "operator"',
  'INTERNAL_TASK_ISSUER_DEFAULT_TOKEN_ID_V1 = "tok_internal_task_issuer_v1"',
  'scopes.length !== 1',
  'TOKEN_ID_SECRET_MISMATCH',
  'process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN = principal.authorization'
])assert(helper.includes(marker),'W6-B1 principal resolver marker missing',marker);
for(const forbidden of [
  /\bapp\.(?:get|post|put|patch|delete|route)\s*\(/,
  /\b(?:INSERT\s+INTO|UPDATE\s+[A-Za-z_]|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE)\b/i,
  /\.query\s*\(/,
  /\bfetch\s*\(/
])assert(!forbidden.test(helper),'W6-B1 principal resolver gained route/persistence/network behavior',String(forbidden));

// The old PR-SEC-1 debt assertion required a broad operator_token compose
// fallback. W6-B1 is an exact, monotonic tightening: the environment now carries
// only stable token identity and startup resolves a dedicated create-only token.
const compose=read(COMPOSE),baseCompose=show(BASE,COMPOSE);
function stripIssuerLines(s){return String(s).split(/\r?\n/).filter(line=>!line.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN')).join('\n');}
assert(stripIssuerLines(compose)===stripIssuerLines(baseCompose),'Commercial compose drift outside internal task issuer credential handoff');
assert(!compose.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN:'),'broad delegated bearer still injected by Commercial compose');
assert(!compose.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN:-operator_token'),'operator_token fallback still present');
assert(compose.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID: ${GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID:-tok_internal_task_issuer_v1}'),'stable internal issuer token identity missing');

const before=JSON.parse(show(BASE,TOKENS));
const after=JSON.parse(read(TOKENS));
const beforeById=new Map(before.tokens.map(x=>[x.token_id,x]));
const afterById=new Map(after.tokens.map(x=>[x.token_id,x]));
assert(after.tokens.length===before.tokens.length+1,'W6-B1 principal fixture cardinality drift',{before:before.tokens.length,after:after.tokens.length});
for(const [id,record] of beforeById){
  assert(afterById.has(id),'predecessor service/caller principal removed',id);
  assert(JSON.stringify(afterById.get(id))===JSON.stringify(record),'predecessor service/caller principal changed',id);
}
const issuer=afterById.get('tok_internal_task_issuer_v1');
assert(issuer,'dedicated internal task issuer missing');
assert(issuer.actor_id==='svc_internal_task_issuer_v1','dedicated issuer actor drift',issuer.actor_id);
assert(issuer.role==='operator'&&issuer.revoked===false,'dedicated issuer role/revocation drift',issuer);
assert(JSON.stringify(issuer.scopes)===JSON.stringify(['action.task.create']),'dedicated issuer capability ceiling drift',issuer.scopes);
for(const forbidden of ['approval.decide','action.task.dispatch','action.receipt.submit','acceptance.evaluate','telemetry.write','inspection.write','ao_act.task.write'])
  assert(!issuer.scopes.includes(forbidden),'dedicated internal issuer gained forbidden successor authority',forbidden);

// Re-run the complete immutable machine scanner on the exact W6-A accepted
// predecessor. This retains all PR-SEC-1 HTTP, callback, startup, direct-writer,
// delegation, credential and tenant-binding zero-set evidence.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'geox-prsec1-base-'));
try{
  cp.execFileSync('git',['worktree','add','--detach',tmp,BASE],{stdio:'ignore'});
  cp.execFileSync(process.execPath,[GATE],{cwd:tmp,stdio:'inherit'});
}finally{
  try{cp.execFileSync('git',['worktree','remove','--force',tmp],{stdio:'ignore'});}catch{}
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}

console.log(JSON.stringify({
  result:'PASS',
  suite:'ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1_SUCCESSOR_PRESERVATION',
  frozen_inventory_unchanged:true,
  historical_machine_gate_replayed_at:BASE,
  successor_head:head,
  production_graph_drift:productionDrift,
  inventoried_internal_delegation_caller_unchanged:true,
  broad_operator_fallback_removed:true,
  dedicated_internal_issuer:{token_id:issuer.token_id,actor_id:issuer.actor_id,role:issuer.role,scopes:issuer.scopes},
  coverage_authority:'FROZEN_PR_SEC_1_PLUS_EXACT_W6_B1_MONOTONIC_PRINCIPAL_TIGHTENING'
},null,2));
