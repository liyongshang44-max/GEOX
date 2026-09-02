const fs = require('node:fs');
const cp = require('node:child_process');

const HEAD_BATCH3 = '622a3f7b59d78faf900ab6d43cf52cb9e6458b7e';
const CORRECTIONS = new Set(['BSEC-001','BSEC-002','BSEC-005','BSEC-018','BSEC-019','BSEC-031']);
const TARGETS = new Set(['BSEC-022','BSEC-023']);

function sh(cmd) { return cp.execFileSync('git', ['-c','core.quotepath=false', ...cmd], {encoding:'utf8'}).trim(); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const modulePath = 'apps/server/src/modules/admin/registerAdminModule.ts';
const semanticPath = 'apps/server/src/modules/admin/registerAdminImportModule.ts';
const loadfactPath = 'scripts/loadfact.ts';
const moduleSrc = read(modulePath);
const semanticSrc = read(semanticPath);
const loadfactSrc = read(loadfactPath);

assert(sh(['diff','--quiet',HEAD_BATCH3,'HEAD','--',semanticPath]) === '', 'registerAdminImportModule.ts changed in Batch004B');
assert(sh(['diff','--quiet',HEAD_BATCH3,'HEAD','--',loadfactPath]) === '', 'loadfact.ts changed in Batch004B');

assert(moduleSrc.includes('ADMIN_IMPORT_MUTATION_COMMERCIAL_AUTHORITY_UNAVAILABLE'), 'missing deterministic fail-close error');
assert(moduleSrc.includes('/api/admin/import/caf_hourly'), 'missing BSEC-022 exact path');
assert(moduleSrc.includes('/api/admin/acceptance/caf009_1h/run'), 'missing BSEC-023 exact path');
assert(moduleSrc.includes('registerAdminImportModule(adminImportRegistrationApp, pool)'), 'missing controlled admin-import registration wrapper');
assert(!moduleSrc.includes('/api/admin/import/jobs/:jobId'), 'GET jobs must not be in blocked path set');

for (const forbidden of ['req.parts(', 'mkdirSync(', 'createWriteStream(', 'pipeline(', 'spawn(', 'pool.query(', 'fetch(', 'writeFileSync(']) {
  const failBlock = moduleSrc.slice(moduleSrc.indexOf('function failClosedAdminImportMutationV1'), moduleSrc.indexOf('const adminImportRegistrationApp'));
  assert(!failBlock.includes(forbidden), `fail-close handler contains forbidden side-effect token: ${forbidden}`);
}

// BSEC-022 source-truth correction: writeMarkers is passed by the route but not consumed by loadfact.
assert(semanticSrc.includes('"--writeMarkers"'), 'route no longer passes writeMarkers; source-truth changed unexpectedly');
assert(!loadfactSrc.includes('writeMarkers'), 'writeMarkers unexpectedly became active in loadfact');
assert(loadfactSrc.includes('insert into facts'), 'facts writer missing from loadfact');
assert(loadfactSrc.includes('insert into raw_samples'), 'raw_samples writer missing from loadfact');
assert(!loadfactSrc.includes('insert into markers'), 'markers unexpectedly became a loadfact persistence target');

// BSEC-023 source-truth correction: Commercial target is /api/judge/run, but server Judge registration exposes /api/v1/judge/* only.
assert(semanticSrc.includes('http://127.0.0.1:${port}/api/judge/run'), 'BSEC-023 attempted internal Judge edge changed');
const serverJudge = read('apps/server/src/routes/judge.ts');
const judgeV2 = read('apps/server/src/routes/judge_v2.ts');
assert(serverJudge.includes('Intentionally register NOTHING here.'), 'Commercial legacy Judge route unexpectedly active');
assert(!judgeV2.includes('app.post("/api/judge/run"'), 'Commercial Judge v2 unexpectedly registers /api/judge/run');
const standaloneJudge = read('apps/judge/src/runtime.ts');
assert(standaloneJudge.includes('const persist = false;'), 'standalone Judge persistence semantics changed');

// Provenance-preserving accounting: frozen -> six accepted corrections -> accepted batches -> Batch004B.
const invPath = 'docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json';
const inv = JSON.parse(read(invPath));
const rows = Array.isArray(inv.surfaces) ? inv.surfaces : Array.isArray(inv.rows) ? inv.rows : [];
assert(rows.length > 0, 'caller-authority inventory rows not found');
const corrected = rows.map((row) => CORRECTIONS.has(row.surface_id) ? {...row, tenant_scope_from_untrusted_body: true} : {...row});
const changedIds = rows.filter((row,i) => row.tenant_scope_from_untrusted_body !== corrected[i].tenant_scope_from_untrusted_body).map(r => r.surface_id).sort();
assert(changedIds.length === 6, `correction set size != 6: ${changedIds.join(',')}`);
assert(JSON.stringify(changedIds) === JSON.stringify([...CORRECTIONS].sort()), `implicit correction set: ${changedIds.join(',')}`);

function counts(input) {
  const reachable = input.filter(r => r.runtime_reachable === true);
  return [
    reachable.filter(r => r.caller_authority_status === 'UNAUTHENTICATED_PRODUCTION_WRITER').length,
    reachable.filter(r => Array.isArray(r.authz_capability) ? r.authz_capability.length === 0 : true).filter(r => String(r.caller_authority_status || '').includes('WRITER')).length,
    reachable.filter(r => r.caller_authority_status === 'HUMAN_ACTION_WITH_UNVERIFIED_DECLARED_ACTOR').length,
    reachable.filter(r => String(r.principal_type || '').includes('SERVICE') && r.caller_authority_status === 'SERVICE_IDENTITY_PARTIAL').length,
    reachable.filter(r => r.tenant_scope_from_untrusted_body === true).length,
  ];
}
function removeIds(input, ids) { return input.filter(r => !ids.has(r.surface_id)); }

const frozen = counts(rows);
const correctedCounts = counts(corrected);
assert(JSON.stringify(frozen) === JSON.stringify([35,109,7,3,16]), `frozen count mismatch ${frozen}`);
assert(JSON.stringify(correctedCounts) === JSON.stringify([35,109,7,3,22]), `corrected count mismatch ${correctedCounts}`);
const after1 = removeIds(corrected, new Set(['BSEC-001','BSEC-002']));
const after2 = removeIds(after1, new Set(['BSEC-003']));
const after3 = removeIds(after2, new Set(['BSEC-005','BSEC-006','BSEC-007','BSEC-008','BSEC-009','BSEC-010']));
const before4 = counts(after3);
const after4 = counts(removeIds(after3, TARGETS));
assert(JSON.stringify(before4) === JSON.stringify([26,100,7,3,18]), `Batch004B start mismatch ${before4}`);
assert(JSON.stringify(after4) === JSON.stringify([24,98,7,3,16]), `Batch004B after mismatch ${after4}`);
const delta = after4.map((v,i) => v - before4[i]);
assert(JSON.stringify(delta) === JSON.stringify([-2,-2,0,0,-2]), `Batch004B delta mismatch ${delta}`);

const allowed = new Set([
  '.github/workflows/bline-pr-sec2-containment.yml',
  'apps/server/src/modules/admin/registerAdminModule.ts',
  'scripts/governance_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_FAIL_CLOSED_V1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_BLINE_PR_SEC_2_ADMIN_IMPORT_COMMERCIAL_RUNTIME_V1.ts',
]);
const changed = sh(['diff','--name-only',HEAD_BATCH3,'HEAD']).split(/\r?\n/).filter(Boolean);
for (const p of changed) assert(allowed.has(p), `Batch004B scope expansion: ${p}`);
for (const p of changed) assert(!/mcft/i.test(p), `MCFT path changed: ${p}`);

console.log(JSON.stringify({ok:true, batch:'PRSEC2-BATCH-004B', frozen, corrected: correctedCounts, before:before4, delta, after:after4, changed_files:changed}, null, 2));
