const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');

const BASE='bcc78fb00e73292362f237a95db3441e07389f6f';
const ARTIFACT='docs/architecture/semantic_convergence/GEOX-BLINE-W6B1-INTERNAL-TASK-ISSUER-PRINCIPAL-V1.json';
const HELPER='apps/server/src/auth/internal_task_issuer_principal_v1.ts';
const SERVER='apps/server/src/server.ts';
const APPROVAL='apps/server/src/routes/control_approval_request_v1.ts';
const AUTH='apps/server/src/auth/ao_act_authz_v0.ts';
const ROLES='apps/server/src/domain/auth/roles.ts';
const COMPOSE='docker-compose.commercial_v1.yml';
const TOKENS='config/auth/security_acceptance_tokens.json';
const W6A_GATE='scripts/governance_acceptance/ACCEPTANCE_BLINE_W6A_EXACT_PREDECESSOR_SELECTION_V1.cjs';

function sh(args,opts={}){return cp.execFileSync('git',['-c','core.quotepath=false',...args],{encoding:'utf8',...opts}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function json(p){return JSON.parse(read(p));}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?'':': '+JSON.stringify(d)));}
function lines(s){return String(s||'').split(/\r?\n/).filter(Boolean).sort();}
function gitShow(ref,p){return cp.execFileSync('git',['show',`${ref}:${p}`],{encoding:'utf8'});}

const head=sh(['rev-parse','HEAD']);
try{cp.execFileSync('git',['merge-base','--is-ancestor',BASE,head],{stdio:'ignore'});}catch{throw new Error(`W6-B1 head is not descended from accepted W6-A frontier: ${head}`);}

const inv=json(ARTIFACT);
assert(inv.version==='GEOX-BLINE-W6B1-INTERNAL-TASK-ISSUER-PRINCIPAL-V1','W6-B1 artifact version drift');
assert(inv.status==='FROZEN_BOUNDED_WORKSTREAM_INVENTORY','W6-B1 artifact status drift');
assert(inv.authority_base===BASE,'W6-B1 authority base drift',inv.authority_base);
assert(Array.isArray(inv.blockers)&&inv.blockers.length===1&&inv.blockers[0]?.id==='INTERNAL-TASK-ISSUER-01','W6-B1 blocker set drift',inv.blockers);
assert(JSON.stringify(inv.bounded_source_surface?.internal_issuer_env_consumer||[])===JSON.stringify([APPROVAL]),'W6-B1 env consumer boundary drift');
assert(inv.bounded_source_surface?.canonical_downstream_sink==='POST /api/v1/actions/task','W6-B1 canonical sink drift');

const helper=read(HELPER),server=read(SERVER),compose=read(COMPOSE),approval=read(APPROVAL),auth=read(AUTH),roles=read(ROLES);
for(const marker of [
  'INTERNAL_TASK_ISSUER_REQUIRED_SCOPE_V1 = "action.task.create"',
  'INTERNAL_TASK_ISSUER_REQUIRED_ROLE_V1 = "operator"',
  'INTERNAL_TASK_ISSUER_DEFAULT_TOKEN_ID_V1 = "tok_internal_task_issuer_v1"',
  'record.scopes',
  'scopes.length !== 1',
  'record.role',
  'GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID',
  'TOKEN_ID_SECRET_MISMATCH',
  'process.env.GEOX_INTERNAL_TASK_ISSUER_TOKEN = principal.authorization'
])assert(helper.includes(marker),'W6-B1 dedicated principal guard marker missing',marker);
assert(server.includes('prepareInternalTaskIssuerPrincipalV1'),'production server does not invoke W6-B1 issuer preflight');
for(const env of ['pilot','controlled-pilot','controlled_pilot','commercial','staging','production'])assert(server.includes(`"${env}"`),'production-like issuer preflight env missing',env);
assert(!compose.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN:'),'Commercial compose still injects task issuer secret/fallback');
assert(!compose.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN:-operator_token'),'Commercial compose still contains broad operator issuer fallback');
assert(compose.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID: ${GEOX_INTERNAL_TASK_ISSUER_TOKEN_ID:-tok_internal_task_issuer_v1}'),'Commercial compose does not bind stable internal issuer token identity');
assert(approval.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN'),'approval path no longer consumes prepared internal issuer credential');
assert(approval.includes('/api/v1/actions/task'),'approval path canonical task sink drift');
assert(approval.includes('issuer: normalizeAoActIssuer(auth, proposal.issuer)'),'approval business issuer no longer binds authenticated approving actor');
assert(auth.includes('isScopeAllowedForRoleV1'),'W1 role/scope consistency authority drift');
assert(roles.includes('operator:')&&roles.includes('"action.task.create"'),'existing operator/action.task.create authority unexpectedly missing');

const tokenFile=json(TOKENS);
const dedicated=tokenFile.tokens.filter(x=>x.token_id==='tok_internal_task_issuer_v1');
assert(dedicated.length===1,'dedicated internal issuer token fixture cardinality drift',dedicated.length);
const issuer=dedicated[0];
assert(issuer.token==='internal_task_issuer_token_v1','dedicated internal issuer fixture secret drift');
assert(issuer.actor_id==='svc_internal_task_issuer_v1','dedicated internal issuer actor identity drift');
assert(issuer.role==='operator'&&issuer.revoked===false,'dedicated internal issuer role/revocation drift',issuer);
assert(JSON.stringify(issuer.scopes)===JSON.stringify(['action.task.create']),'dedicated internal issuer scope ceiling drift',issuer.scopes);
for(const forbidden of ['approval.decide','action.task.dispatch','action.receipt.submit','acceptance.evaluate','telemetry.write','inspection.write','ao_act.task.write'])assert(!issuer.scopes.includes(forbidden),'dedicated internal issuer gained forbidden scope',forbidden);

const baseTokens=JSON.parse(gitShow(BASE,TOKENS));
assert(tokenFile.tokens.length===baseTokens.tokens.length+1,'W6-B1 token fixture changed more than one principal',{base:baseTokens.tokens.length,head:tokenFile.tokens.length});
const currentById=new Map(tokenFile.tokens.map(x=>[x.token_id,x]));
for(const before of baseTokens.tokens){
  const after=currentById.get(before.token_id);
  assert(after,'W6-B1 removed predecessor token fixture',before.token_id);
  assert(JSON.stringify(after)===JSON.stringify(before),'W6-B1 modified predecessor token fixture',before.token_id);
}

function stripIssuerComposeLine(text){
  return String(text).split(/\r?\n/).filter(line=>!line.includes('GEOX_INTERNAL_TASK_ISSUER_TOKEN')).join('\n');
}
assert(stripIssuerComposeLine(compose)===stripIssuerComposeLine(gitShow(BASE,COMPOSE)),'W6-B1 changed Commercial compose outside the internal issuer line');

const protectedUnchanged=[
  APPROVAL,
  AUTH,
  ROLES,
  'apps/server/src/routes/control_ao_act.ts',
  'apps/server/src/domain/planner/compiler_v1.ts',
  'apps/server/src/domain/crop/crop_context_v1.ts',
  'apps/server/src/routes/programs_core_v1.ts',
  'apps/server/src/routes/field_crop_context_hooks_v1.ts',
  'apps/server/src/infra/mcft_cap07_database_platform_bootstrap_v1.ts',
  'apps/server/src/infra/mcft_cap07_runtime_startup_preflight_v1.ts',
  'apps/telemetry-ingest/src/main.ts',
  'apps/server/src/jobs/runtime.ts',
  'apps/executor/src/runtime_loop.ts',
  'apps/executor/src/run_dispatch_once.ts',
  'apps/executor/src/adapters/mqtt.ts'
];
const protectedDrift=lines(sh(['diff','--name-only',BASE,'HEAD','--',...protectedUnchanged]));
assert(protectedDrift.length===0,'W6-B1 reopened protected W1-W6A/W6-B2/MCFT source',protectedDrift);

const allowed=new Set([
  ARTIFACT,
  HELPER,
  SERVER,
  COMPOSE,
  TOKENS,
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W6B1_INTERNAL_TASK_ISSUER_PRINCIPAL_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W6B1_INTERNAL_TASK_ISSUER_PRINCIPAL_V1.ts',
  '.github/workflows/bline-w6b1-internal-task-issuer-principal.yml'
]);
const changed=lines(sh(['diff','--name-only',BASE,'HEAD']));
for(const p of changed)assert(allowed.has(p),'W6-B1 scope expansion',p);
for(const p of changed)assert(!/mcft/i.test(p),'W6-B1 touched MCFT path',p);
for(const p of changed)assert(!/action.qualification|action_qualification/i.test(p),'W6-B1 entered Action Qualification',p);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'geox-w6a-accepted-'));
try{
  cp.execFileSync('git',['worktree','add','--detach',tmp,BASE],{stdio:'ignore'});
  cp.execFileSync(process.execPath,[W6A_GATE],{cwd:tmp,stdio:'inherit'});
}finally{
  try{cp.execFileSync('git',['worktree','remove','--force',tmp],{stdio:'ignore'});}catch{}
  try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
}

console.log(JSON.stringify({
  result:'PASS',
  workstream:'W6_B1_INTERNAL_TASK_ISSUER_PRINCIPAL_BOUNDARY',
  authority_base:BASE,
  head,
  blocker_id:'INTERNAL-TASK-ISSUER-01',
  dedicated_principal:{token_id:issuer.token_id,actor_id:issuer.actor_id,role:issuer.role,scopes:issuer.scopes},
  predecessor_tokens_unchanged:true,
  approval_route_unchanged:true,
  ao_act_route_unchanged:true,
  w6a_historical_exact_head_gate_replayed:true,
  changed_files:changed,
  mcft_delta:0
},null,2));
