const fs = require('node:fs');
const cp = require('node:child_process');

const HEAD_BATCH4 = '9074b8c8035fc69e19353d3827fb43ef3ea4cebb';
const CORRECTIONS = ['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031'];
const TARGETS = ['BSEC-024','BSEC-025','BSEC-026'];
function sh(args) { return cp.execFileSync('git', ['-c','core.quotepath=false', ...args], {encoding:'utf8'}).trim(); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(cond, msg, extra) { if (!cond) throw new Error(`${msg}${extra === undefined ? '' : `: ${JSON.stringify(extra)}`}`); }

const sensingModule = read('apps/server/src/modules/sensing/registerSensingModule.ts');
const agronomyModule = read('apps/server/src/modules/agronomy/registerAgronomyModule.ts');
const rawPath = 'apps/server/src/routes/raw.ts';
const agronomyPath = 'apps/server/src/routes/agronomy_v0.ts';
assert(sh(['diff','--name-only',HEAD_BATCH4,'HEAD','--',rawPath]) === '', 'raw.ts changed in Batch005');
assert(sh(['diff','--name-only',HEAD_BATCH4,'HEAD','--',agronomyPath]) === '', 'agronomy_v0.ts changed in Batch005');
for (const p of ['scripts/modbus_to_geox.py','scripts/ingest_soilprobe_modbus.py']) assert(sh(['diff','--name-only',HEAD_BATCH4,'HEAD','--',p]) === '', `${p} changed in Batch005`);

for (const src of [sensingModule, agronomyModule]) assert(src.includes('WEAK_INTERNAL_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE'), 'missing deterministic fail-close error');
assert(sensingModule.includes('path === "/api/raw"'), 'BSEC-024 exact registration interception missing');
assert(agronomyModule.includes('/api/agronomy/v0/ao_act/interpretation'), 'BSEC-025 exact registration interception missing');
assert(agronomyModule.includes('/api/agronomy/interpretation_v1/append'), 'BSEC-026 exact registration interception missing');
for (const src of [sensingModule, agronomyModule]) {
  for (const forbidden of ['setTimeout(', 'setInterval(', 'setImmediate(', 'queueMicrotask(', '.then(', 'addHook(']) assert(!src.includes(forbidden), `containment source contains deferred token ${forbidden}`);
  assert(!src.includes('NODE_ENV'), 'production containment must not contain NODE_ENV bypass');
  assert(!src.includes('CI'), 'production containment must not contain CI bypass');
}

const acceptance = read('scripts/acceptance/ACCEPTANCE_COMMERCIAL_V1.cjs');
assert(!acceptance.includes('/api/raw?__internal__=true'), 'commercial acceptance still depends on weak internal raw HTTP writer');
assert(!acceptance.includes("new URL('/api/raw"), 'commercial acceptance still constructs raw HTTP seed route');
assert(acceptance.includes('TEST_ONLY_DIRECT_ACCEPTANCE_DATABASE'), 'test-only direct acceptance database fixture marker missing');
assert(acceptance.includes('INSERT INTO facts'), 'test-only fixture must seed facts explicitly');
assert(!sensingModule.includes('TEST_ONLY_DIRECT_ACCEPTANCE_DATABASE') && !agronomyModule.includes('TEST_ONLY_DIRECT_ACCEPTANCE_DATABASE'), 'test-only fixture leaked into production module');

const inv = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const frozen = inv.surfaces ?? [];
const byId = new Map(frozen.map((row) => [row.surface_id, row]));
for (const id of TARGETS) {
  const row = byId.get(id);
  assert(row, 'Batch005 row missing', id);
  assert(row.runtime_reachable === true, 'Batch005 row must be production reachable', id);
  assert(row.caller_authority_status === 'WEAK_INTERNAL_BOUNDARY', 'Batch005 frozen authority status drift', {id,status:row.caller_authority_status});
}
assert(byId.get('BSEC-024').tenant_scope_from_untrusted_body === true, 'BSEC-024 tenant contribution drift');
assert(byId.get('BSEC-025').tenant_scope_from_untrusted_body === false, 'BSEC-025 tenant contribution drift');
assert(byId.get('BSEC-026').tenant_scope_from_untrusted_body === false, 'BSEC-026 tenant contribution drift');

function debt(rows) {
  const reachable = rows.filter((row) => row.runtime_reachable === true);
  const unauth = reachable.filter((row) => ['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE'].includes(row.caller_authority_status));
  const noCap = reachable.filter((row) => row.authz_capability.length === 0 || ['UNAUTHENTICATED_PRODUCTION_WRITER','UNAUTHENTICATED_INTERNAL_PRODUCTION_WRITER','WEAK_INTERNAL_BOUNDARY','CONTRACT_TRANSITIONAL_PRODUCTION_INCOMPLETE','AUTHENTICATED_BUT_WRITE_UNDER_READ_CAPABILITY','AUTHENTICATED_BUT_CAPABILITY_MISMATCH','AUTHENTICATED_BUT_CAPABILITY_COMPATIBILITY'].includes(row.caller_authority_status));
  const unverifiedActor = reachable.filter((row) => String(row.declared_actor_binding || '').includes('CALLER_DECLARED_NOT_AUTH_BOUND'));
  const serviceUnbound = reachable.filter((row) => String(row.principal_type || '').includes('SERVICE') && row.caller_authority_status === 'SERVICE_IDENTITY_PARTIAL');
  const untrustedTenant = reachable.filter((row) => row.tenant_scope_from_untrusted_body === true);
  return [unauth.length,noCap.length,unverifiedActor.length,serviceUnbound.length,untrustedTenant.length];
}
function close(rows, ids) { const set = new Set(ids); return rows.map((row) => set.has(row.surface_id) ? {...row,runtime_reachable:false} : row); }
function delta(a,b) { return b.map((v,i) => v-a[i]); }
const frozenDebt = debt(frozen);
assert(JSON.stringify(frozenDebt) === JSON.stringify([35,109,7,3,16]), 'frozen debt drift', frozenDebt);
const corrected = frozen.map((row) => CORRECTIONS.includes(row.surface_id) ? {...row,tenant_scope_from_untrusted_body:true} : {...row});
assert(JSON.stringify(debt(corrected)) === JSON.stringify([35,109,7,3,22]), 'corrected debt drift', debt(corrected));
let rows = close(corrected,['BSEC-001','BSEC-002']);
rows = close(rows,['BSEC-003']);
rows = close(rows,['BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010']);
rows = close(rows,['BSEC-022','BSEC-023']);
const before = debt(rows);
const after = debt(close(rows,TARGETS));
const batchDelta = delta(before,after);
assert(JSON.stringify(before) === JSON.stringify([24,98,7,3,16]), 'Batch005 start mismatch', before);
assert(JSON.stringify(batchDelta) === JSON.stringify([-3,-3,0,0,-1]), 'Batch005 delta mismatch', batchDelta);
assert(JSON.stringify(after) === JSON.stringify([21,95,7,3,15]), 'Batch005 after mismatch', after);

const allowed = new Set([
  '.github/workflows/bline-pr-sec2-containment.yml',
  'apps/server/src/modules/sensing/registerSensingModule.ts',
  'apps/server/src/modules/agronomy/registerAgronomyModule.ts',
  'scripts/acceptance/ACCEPTANCE_COMMERCIAL_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEAK_INTERNAL_FAIL_CLOSED_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEAK_INTERNAL_FAIL_CLOSED_V1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_WEAK_INTERNAL_COMMERCIAL_RUNTIME_V1.ts',
]);
const changed = sh(['diff','--name-only',HEAD_BATCH4,'HEAD']).split(/\r?\n/).filter(Boolean);
for (const p of changed) assert(allowed.has(p), 'Batch005 scope expansion', p);
for (const p of changed) assert(!/mcft/i.test(p), 'MCFT path changed', p);
console.log(JSON.stringify({result:'PASS',batch:'PRSEC2-BATCH-005',containment:'COMMERCIAL_FAIL_CLOSE',frozen_prsec1:frozenDebt,corrected_prsec1:debt(corrected),before,delta:batchDelta,after,targets:TARGETS,changed_files:changed,mcft_delta:0},null,2));
