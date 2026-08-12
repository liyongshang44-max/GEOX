const fs = require('fs');
const assert = require('assert/strict');
const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const authority = json('docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json');
const ruling = json('docs/frontend-productization/PFE-14-MCFT09-READ-DEPENDENCY-READJUDICATION-V1.json');
const candidate = json('docs/frontend-productization/PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-CANDIDATE-V1.json');
const service = read('apps/server/src/services/pfe14_mcft09_operational_read_api_v1.ts');
const route = read('apps/server/src/routes/v1/pfe14_mcft09_operational_read_v1.ts');
const openapi = read('apps/server/src/routes/openapi_pfe14_mcft09_operational_read_v1.ts');
const moduleFile = read('apps/server/src/modules/operator/registerOperatorModule.ts');

assert.equal(authority.first_legal_next_action, 'MCFT_CAP_09_IMPLEMENT_GET_ONLY_PFE14_OPERATIONAL_READ_PROVIDER_CANDIDATE');
assert.equal(ruling.provider_candidate.authorized, true);
assert.equal(ruling.provider_candidate.method, 'GET');
assert.equal(candidate.record_status, 'IMPLEMENTED_CANDIDATE_NOT_EFFECTIVE');
assert.equal(candidate.read_only, true);
assert.equal(candidate.runtime_mode_claimed, false);
assert.equal(candidate.frontend_consumption_authorized, false);
assert.equal(candidate.database_migration_delta, 0);
assert.equal(candidate.package_delta, 0);

assert(service.includes('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'));
assert(service.includes('PostgresEvidenceIngressAdapterV1'));
assert(service.includes('freezeEligibleEvidence'));
assert(service.includes('PFE14_OPERATIONAL_FUTURE_BOUNDARY_MISMATCH'));
assert(service.includes('LATEST_TICK_STARTED_AT_NOT_INFERRED_FROM_SCHEDULER_CLAIM_TIME'));
assert(service.includes('NO_DYNAMIC_SHADOW_ONLINE_RUNTIME_MODE_CLAIM'));
for (const forbidden of [/\bINSERT\b/i,/\bUPDATE\b/i,/\bDELETE\b/i,/\bALTER\b/i,/\bCREATE TABLE\b/i,/claimDueSlot\s*\(/,/recoverExpiredActiveSlot\s*\(/,/recordTerminalResult\s*\(/]) {
  assert(!forbidden.test(service), `WRITE_OR_MUTATION_PATTERN_FORBIDDEN:${forbidden}`);
}

assert(route.includes('app.get(PFE14_MCFT09_OPERATIONAL_SUMMARY_ROUTE_V1'));
assert(!/app\.(post|put|patch|delete)\s*\(/i.test(route));
assert(route.includes('authorizeMcftFieldTwinReadV1'));
assert(route.includes('MCFT_FIELD_TWIN_CANONICAL_BASE_V1'));
assert(!route.includes('/operator/shadow/'));
assert(!route.includes('/operator/mcft9/'));
assert(openapi.includes('/api/v1/operator/twin/fields/{field_id}/runtime/operational-summary'));
assert(moduleFile.includes('registerPfe14Mcft09OperationalReadRoutesV1(app, pool)'));
assert(moduleFile.includes('installPfe14Mcft09OperationalReadOpenApiV1()'));

assert.equal(authority.s4_effective, false);
assert.equal(authority.s4_page_source_authorized, false);
assert.equal(authority.s4_api_client_source_authorized, false);
assert.equal(authority.shadow_online_label_authorized, false);

console.log(JSON.stringify({
  status: 'PASS',
  candidate: 'PFE-14-MCFT09-OPERATIONAL-READ-PROVIDER-CANDIDATE-V1',
  route: candidate.route,
  read_only: true,
  frontend_consumption_authorized: false,
  pfe14_s4_effective: false
}, null, 2));
