const fs=require('node:fs'),cp=require('node:child_process');
const BASE='35398258d3c59810aba3d19af1c295b1f05a57ce';
function sh(a){return cp.execFileSync('git',['-c','core.quotepath=false',...a],{encoding:'utf8'}).trim();}
function read(p){return fs.readFileSync(p,'utf8');}
function assert(c,m,x){if(!c)throw new Error(`${m}${x===undefined?'':`: ${JSON.stringify(x)}`}`);}
const authPath='apps/server/src/auth/ao_act_authz_v0.ts';
const statusPath='apps/server/src/routes/device_status_v1.ts';
const runtimePath='apps/server/src/runtime/runtime_security_v1.ts';
const composePath='docker-compose.commercial_v1.yml';
const rolesPath='apps/server/src/domain/auth/roles.ts';
const fixtures=['config/auth/security_acceptance_tokens.json','config/auth/ao_act_tokens_v0.json'];
const frozenInventory='docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json';
const auth=read(authPath),status=read(statusPath),runtime=read(runtimePath),compose=read(composePath),roles=read(rolesPath);

assert(auth.includes('"admin", "operator", "viewer", "client", "executor", "agronomist", "approver", "auditor", "support"'),'explicit valid-role set missing');
assert(/function roleFromRecord\([\s\S]*?AoActRoleV0 \| null/.test(auth),'role parser must return nullable role');
assert(/roleFromRecord[\s\S]*?return VALID_AO_ACT_ROLES_V0\.has/.test(auth),'role parser must validate explicit role');
assert(!/function roleFromRecord[\s\S]{0,500}return "admin";/.test(auth),'unknown/malformed role must not promote to admin');
assert((auth.match(/AUTH_ROLE_INVALID/g)||[]).length>=3,'all auth entrypoints must fail closed invalid role');
assert(auth.includes('"pilot", "controlled-pilot", "controlled_pilot", "commercial", "staging", "production"'),'pilot/commercial must be strict credential runtimes');
assert(auth.includes('isTrackedAcceptanceCredentialPathV0'),'tracked acceptance credential path guard missing');
assert(auth.includes('security_acceptance_tokens.json'),'tracked acceptance credential fixture must be explicitly recognized');

assert(!compose.includes('GEOX_TOKENS_FILE: /app/config/auth/security_acceptance_tokens.json'),'Commercial compose still delegates authority to tracked acceptance fixture');
assert(compose.includes('GEOX_TOKENS_JSON: ${GEOX_TOKENS_JSON:-}'),'Commercial inline structured credential source missing');
assert(compose.includes('GEOX_TOKENS_FILE: ${GEOX_TOKENS_FILE:-}'),'Commercial external credential-file source missing');
assert(runtime.includes('acceptance_token_fixture_forbidden'),'runtime security fixture isolation check missing');
assert(runtime.includes('RUNTIME_ACCEPTANCE_TOKEN_FIXTURE_FORBIDDEN'),'runtime security fixture isolation error missing');

assert(!status.includes('({ tenant_id: "tenantA" } as FactsAuth)'),'Device Status tenantA fallback remains');
assert(status.includes('const auth = await (requireAuth as any)(req, reply) as FactsAuth | null | undefined;'),'Device Status must consume returned authenticated context');
assert(status.includes('AUTH_CONTEXT_REQUIRED'),'Device Status must fail closed absent authenticated context');
assert(status.includes('tenant_id = auth.tenant_id.trim()'),'Device Status tenant must derive from auth context');
assert(status.includes('[tenant_id, device_id]'),'Device Status query must bind authenticated tenant');

assert(roles.includes('ROLE_SCOPE_MATRIX_V1'),'role-scope matrix missing');
assert(auth.includes('AUTH_ROLE_SCOPE_DENIED'),'token-role scope inconsistency denial missing');
assert(auth.includes('isScopeAllowedForRoleV1(role as AuthRole, scope)'),'single-scope role consistency enforcement missing');
assert(auth.includes('isScopeAllowedForRoleV1(role as AuthRole, s)'),'any-scope role consistency enforcement missing');

for(const p of [rolesPath,...fixtures,frozenInventory]){
  assert(sh(['diff','--name-only',BASE,'HEAD','--',p])==='','W1 must not rewrite role matrix, tracked credential fixtures, or frozen PR-SEC-1 inventory',p);
}
const allowed=new Set([
  '.github/workflows/bline-w1-identity-foundation.yml',
  '.github/workflows/ci.yml',
  authPath,statusPath,runtimePath,composePath,
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_W1_IDENTITY_FOUNDATION_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PRODUCTION_CALLER_AUTHORITY_INVENTORY_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_W1_IDENTITY_FOUNDATION_V1.ts'
]);
const changed=sh(['diff','--name-only',BASE,'HEAD']).split(/\r?\n/).filter(Boolean);
for(const p of changed) assert(allowed.has(p),'W1 scope expansion',p);
for(const p of changed) assert(!/mcft/i.test(p),'MCFT path changed',p);
for(const p of changed) {
  if(p===statusPath) continue;
  assert(!/(recommendation|approval|executor|legacy)/i.test(p),'forbidden W1 semantic workstream path changed',p);
}
console.log(JSON.stringify({result:'PASS',workstream:'W1_IDENTITY_FOUNDATION',authority_base:BASE,checks:{malformed_role_fail_closed:true,commercial_credential_source_isolated:true,device_status_auth_context_bound:true,token_role_consistency_gate:true,role_matrix_unchanged:true,credential_fixtures_unchanged:true},changed_files:changed,mcft_delta:0},null,2));