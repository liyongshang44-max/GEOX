const fs = require('node:fs');
const cp = require('node:child_process');

const HEAD_BATCH3 = '622a3f7b59d78faf900ab6d43cf52cb9e6458b7e';
const CORRECTIONS = ['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const TARGETS = ['BSEC-022','BSEC-023'];

function sh(cmd) { return cp.execFileSync('git', ['-c','core.quotepath=false', ...cmd], {encoding:'utf8'}).trim(); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(cond, msg, extra) { if (!cond) throw new Error(`${msg}${extra === undefined ? '' : `: ${JSON.stringify(extra)}`}`); }

const modulePath = 'apps/server/src/modules/admin/registerAdminModule.ts';
const semanticPath = 'apps/server/src/modules/admin/registerAdminImportModule.ts';
const loadfactPath = 'scripts/loadfact.ts';
const moduleSrc = read(modulePath);
const semanticSrc = read(semanticPath);
const loadfactSrc = read(loadfactPath);

assert(sh(['diff','--name-only',HEAD_BATCH3,'HEAD','--',semanticPath]) === '', 'registerAdminImportModule.ts changed in Batch004B');
assert(sh(['diff','--name-only',HEAD_BATCH3,'HEAD','--',loadfactPath]) === '', 'loadfact.ts changed in Batch004B');

assert(moduleSrc.includes('ADMIN_IMPORT_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE'), 'missing deterministic fail-close error');
assert(moduleSrc.includes('/api/admin/import/caf_hourly'), 'missing BSEC-022 exact path');
assert(moduleSrc.includes('/api/admin/acceptance/caf009_1h/run'), 'missing BSEC-023 exact path');
assert(moduleSrc.includes('registerAdminImportModule(adminImportRegistrationApp, pool)'), 'missing controlled admin-import registration wrapper');
assert(!moduleSrc.includes('/api/admin/import/jobs/:jobId'), 'GET jobs must not be in blocked registration wrapper source');
const failStart = moduleSrc.indexOf('function failClosedAdminImportMutationV1');
const failEnd = moduleSrc.indexOf('export function registerAdminModule');
const failBlock = moduleSrc.slice(failStart, failEnd);
for (const forbidden of ['req.parts(', 'mkdirSync(', 'createWriteStream(', 'pipeline(', 'spawn(', 'pool.query(', 'fetch(', 'writeFileSync(', 'setTimeout(', 'setInterval(', 'setImmediate(', 'queueMicrotask(', '.then(', 'addHook(']) {
  assert(!failBlock.includes(forbidden), `fail-close handler contains forbidden side-effect token ${forbidden}`);
}

assert(semanticSrc.includes('"--writeMarkers"'), 'route no longer passes writeMarkers; source truth changed');
assert(!loadfactSrc.includes('writeMarkers'), 'writeMarkers unexpectedly became active in loadfact');
assert(loadfactSrc.includes('insert into facts'), 'facts writer missing from loadfact');
assert(loadfactSrc.includes('insert into raw_samples'), 'raw_samples writer missing from loadfact');
assert(!loadfactSrc.includes('insert into markers'), 'markers unexpectedly became a loadfact persistence target');

assert(semanticSrc.includes('http://127.0.0.1:${port}/api/judge/run'), 'BSEC-023 attempted internal Judge edge changed');
const serverJudge = read('apps/server/src/routes/judge.ts');
const judgeV2 = read('apps/server/src/routes/judge_v2.ts');
const standaloneJudge = read('apps/judge/src/runtime.ts');
assert(serverJudge.includes('Intentionally register NOTHING here.'), 'Commercial legacy Judge route unexpectedly active');
assert(!judgeV2.includes('app.post("/api/judge/run"'), 'Commercial Judge v2 unexpectedly registers /api/judge/run');
assert(standaloneJudge.includes('const persist = false;'), 'standalone Judge persistence semantics changed');

const inv = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen = inv.surfaces ?? [];
assert(frozen.length > 0, 'caller-authority inventory rows not found');
const byId = new Map(frozen.map((row) => [row.surface_id, row]));
for (const id of TARGETS) {
  const row = byId.get(id);
  assert(row, 'Batch004B row missing', id);
  assert(row.runtime_reachable === true, 'Batch004B row must be production reachable', id);
  assert(row.caller_authority_status === 'UNAUTHENTICATED_PRODUCTION_WRITER', 'Batch004B frozen authority status drift', {id, status: row.caller_authority_status});
  assert(Array.isArray(row.authz_capability) && row.authz_capability.length === 0, 'Batch004B row unexpectedly has capability', id);
  assert(row.tenant_scope_from_untrusted_body === true, 'Batch004B tenant contribution drift', id);
  assert(!(String(row.principal_type || '').includes('SERVICE') && row.caller_authority_status === 'SERVICE_IDENTITY_PARTIAL'), 'Batch004B must not contribute to fourth counter', id);
}
for (const id of CORRECTIONS) {
  const row = byId.get(id);
  assert(row && row.tenant_scope_from_untrusted_body === false, 'accepted correction must be frozen false', id);
}

function debt(rows) {
  const reachable = rows.filter((row) => row.runtime_reachable === true);
  const unauth = reachable.filter((row) => [
    'UNAUTHENTICATED_PRODUCTION_WRITER',
    'UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER',
    'WEAK_INTERNAL_BOUNDARY',
    'CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE',
  ].includes(row.caller_authority_status));
  const noCap = reachable.filter((row) =>
    row.authz_capability.length === 0 || [
      'UNAUTHENTICATED_PRODUCTION_WRITER',
      'UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER',
      'WEAK_INTERNAL_BOUNDARY',
      'CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE',
      'AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY',
      'AUTHENTICATED_BUT_CAPABILITY_MISMATCH',
      'AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY',
    ].includes(row.caller_authority_status),
  );
  const unverifiedActor = reachable.filter((row) => String(row.declared_actor_binding || '').includes('CALLER_DECLARED_NOT_AUTH_BOUND'));
  const serviceUnbound = reachable.filter((row) => String(row.principal_type || '').includes('SERVICE') && row.caller_authority_status === 'SERVICE_IDENTITY_PARTIAL');
  const untrustedTenant = reachable.filter((row) => row.tenant_scope_from_untrusted_body === true);
  return [unauth.length, noCap.length, unverifiedActor.length, serviceUnbound.length, untrustedTenant.length];
}
function close(rows, ids) {
  const set = new Set(ids);
  return rows.map((row) => set.has(row.surface_id) ? {...row, runtime_reachable: false} : row);
}
function delta(before, after) { return after.map((v,i) => v - before[i]); }

const frozenDebt = debt(frozen);
assert(JSON.stringify(frozenDebt) === JSON.stringify([35,109,7,3,16]), 'frozen PR-SEC-1 machine debt drift', frozenDebt);
const correctionSet = new Set(CORRECTIONS);
const corrected = frozen.map((row) => correctionSet.has(row.surface_id) ? {...row, tenant_scope_from_untrusted_body: true} : {...row});
const changedCorrectionIds = corrected.filter((row,i) => row.tenant_scope_from_untrusted_body !== frozen[i].tenant_scope_from_untrusted_body).map((row) => row.surface_id);
assert(JSON.stringify(changedCorrectionIds) === JSON.stringify(CORRECTIONS), 'implicit correction detected', changedCorrectionIds);
const correctedDebt = debt(corrected);
assert(JSON.stringify(correctedDebt) === JSON.stringify([35,109,7,3,22]), 'corrected PR-SEC-1 debt drift', correctedDebt);

let rows = close(corrected, ['BSEC-001','BSEC-002']);
rows = close(rows, ['BSEC-003']);
rows = close(rows, ['BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010']);
const before4 = debt(rows);
const after4 = debt(close(rows, TARGETS));
const batch4Delta = delta(before4, after4);
assert(JSON.stringify(before4) === JSON.stringify([26,100,7,3,18]), 'Batch004B start mismatch', before4);
assert(JSON.stringify(batch4Delta) === JSON.stringify([-2,-2,0,0,-2]), 'Batch004B delta mismatch', batch4Delta);
assert(JSON.stringify(after4) === JSON.stringify([24,98,7,3,16]), 'Batch004B after mismatch', after4);

const allowed = new Set([
  '.github/workflows/bline-pr-sec2-containment.yml',
  'apps/server/src/modules/admin/registerAdminModule.ts',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_LEGACY_TWIN_BASE_FAIL_CLOSED_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_COMMERCIAL_RUNTIME_V1.ts',
]);
const changed = sh(['diff','--name-only',HEAD_BATCH3,'HEAD']).split(/\r?\n/).filter(Boolean);
for (const p of changed) assert(allowed.has(p), 'Batch004B scope expansion', p);
for (const p of changed) assert(!/mcft/i.test(p), 'MCFT path changed', p);

console.log(JSON.stringify({
  result:'PASS',
  batch:'PRSEC2-BATCH-004B',
  containment:'COMMERCIAL_FAIL_CLOSE',
  correction_set: CORRECTIONS,
  frozen_prsec1: frozenDebt,
  corrected_prsec1: correctedDebt,
  before: before4,
  delta: batch4Delta,
  after: after4,
  exact_routes: TARGETS,
  source_truth: {
    bsec022_db_targets:['facts','raw_samples'],
    bsec022_writeMarkers:'ARGUMENT_PRESENT_BUT_LOADFACT_INERT',
    bsec023_commercial_judge_target:'NOT_REGISTERED',
    bsec023_standalone_judge_persist:'FORCED_FALSE',
    bsec023_current_persistence:'ACCEPTANCE_FILESYSTEM_ARTIFACTS',
  },
  changed_files: changed,
  mcft_delta: 0,
}, null, 2));
