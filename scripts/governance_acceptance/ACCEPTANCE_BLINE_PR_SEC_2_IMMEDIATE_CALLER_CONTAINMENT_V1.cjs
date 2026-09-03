#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (m, extra) => { console.error('[BLINE_PR_SEC_2_CONTAINMENT] FAIL:', m); if (extra !== undefined) console.error(JSON.stringify(extra, null, 2)); process.exit(1); };
const assert = (c, m, extra) => { if (!c) fail(m, extra); };

const predecessor = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json'));
const repair = JSON.parse(read('docs/architecture/semantic_convergence/GEOX-BLINE-PR-SEC-2-IMMEDIATE-CALLER-CONTAINMENT-V1.json'));
const wrapper = read('apps/server/src/routes/v1/operator_twin_write_legacy_v1.ts');
const roles = read('apps/server/src/domain/auth/roles.ts');

assert(predecessor.status === 'INVENTORY_COMPLETE_BSEC0_OPEN', 'PR-SEC-1 predecessor status drift');
assert(predecessor.canonical_predecessor?.sha === 'b6f141c5471cd6f329ba60bd79cf6e4085546264', 'PR-SEC-1 predecessor lineage drift');
assert(repair.predecessor?.sha === 'dc1036f3fec8173cbc775d536b50ef62672651d5', 'PR-SEC-2 must stack on frozen PR-SEC-1 final head');
assert(repair.predecessor?.exact_ci === 33632733189, 'PR-SEC-1 exact CI evidence drift');

const baseline = repair.debt_baseline;
assert(baseline.production_reachable_mutating_surface_without_authn === 35, 'unauth baseline must remain 35');
assert(baseline.production_reachable_semantic_writer_without_validated_capability === 109, 'capability baseline must remain 109');
assert(baseline.production_reachable_human_action_with_unverified_declared_actor === 7, 'human actor baseline must remain 7');
assert(baseline.production_reachable_service_writer_without_bound_principal === 3, 'service principal baseline must remain 3');
assert(baseline.tenant_scope_from_untrusted_body_or_unbound === 16, 'tenant scope baseline must remain 16');

const batch = repair.batches?.find((x) => x.batch_id === 'PRSEC2-BATCH-001');
assert(batch, 'batch 1 mapping missing');
assert(JSON.stringify(batch.source_surfaces) === JSON.stringify(['BSEC-001','BSEC-002']), 'batch 1 source surface set drift');
assert(batch.authority_chain?.capability === 'recommendation.write', 'batch 1 capability must be recommendation.write');

const sourceRows = batch.source_surfaces.map((surfaceId) => predecessor.surfaces.find((x) => x.surface_id === surfaceId));
for (const row of sourceRows) {
  assert(row, 'batch 1 frozen source inventory row missing');
  assert(row.runtime_reachable === true, 'contained row must be production reachable', row?.surface_id);
  assert(row.authn_mode === 'NONE', 'batch 1 unauth baseline must come from authn_mode NONE', row?.surface_id);
  assert(Array.isArray(row.authz_capability) && row.authz_capability.length === 0, 'batch 1 capability baseline must be empty', row?.surface_id);
  assert(row.caller_authority_status === 'UNAUTHENTICATED_PRODUCTION_WRITER', 'batch 1 caller-authority baseline drift', row?.surface_id);
  assert(row.principal_type === 'UNVERIFIED_CALLER', 'batch 1 principal baseline drift', row?.surface_id);
  assert(!String(row.declared_actor_binding || '').includes('CALLER_DECLARED_NOT_AUTH_BOUND'), 'batch 1 must not claim human-actor debt reduction', row?.surface_id);
  assert(!String(row.principal_type || '').includes('SERVICE'), 'batch 1 must not claim service-principal debt reduction', row?.surface_id);
  assert(row.tenant_scope_from_untrusted_body !== true, 'batch 1 must not claim tenant-body debt reduction', row?.surface_id);
}

const computedDelta = {
  production_reachable_mutating_surface_without_authn: -sourceRows.length,
  production_reachable_semantic_writer_without_validated_capability: -sourceRows.length,
  production_reachable_human_action_with_unverified_declared_actor: 0,
  production_reachable_service_writer_without_bound_principal: 0,
  tenant_scope_from_untrusted_body_or_unbound: 0,
};
const computedAfter = Object.fromEntries(
  Object.entries(baseline).map(([key, value]) => [key, value + (computedDelta[key] ?? 0)])
);
assert(JSON.stringify(batch.expected_machine_debt_delta) === JSON.stringify(computedDelta), 'declared debt delta must equal machine-derived frozen-row delta', { declared: batch.expected_machine_debt_delta, computed: computedDelta });
assert(JSON.stringify(batch.expected_after) === JSON.stringify(computedAfter), 'declared after-state must equal machine-derived after-state', { declared: batch.expected_after, computed: computedAfter });

for (const route of [
  '/api/v1/operator/twin/fields/:field_id/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation',
  '/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation',
]) {
  assert(wrapper.includes(route), 'production wrapper route missing', route);
}

for (const sentinel of [
  'requireAoActScopeV0(req, reply, "recommendation.write")',
  'hasFieldAccess(auth, fieldId)',
  'declaredScope.tenant_id !== auth.tenant_id',
  'declaredScope.project_id !== auth.project_id',
  'declaredScope.group_id !== auth.group_id',
  'AUTH_TENANT_SCOPE_MISMATCH',
  'AUTH_FIELD_SCOPE_DENIED',
  'AUTH_DECLARED_ACTOR_MISMATCH',
  'operator_id: auth.actor_id',
]) {
  assert(wrapper.includes(sentinel), 'containment source sentinel missing', sentinel);
}

assert(roles.includes('agronomist: ["water_response.verify","recommendation.write"'), 'agronomist recommendation.write role proof missing');
assert(roles.includes('admin: ["*"]'), 'admin capability role proof missing');
assert(!roles.match(/operator:\s*\[[^\]]*"recommendation\.write"/s), 'PR-SEC-2 must not silently grant recommendation.write to operator');

const bsec1 = predecessor.surfaces.find((x) => x.surface_id === 'BSEC-001');
const bsec2 = predecessor.surfaces.find((x) => x.surface_id === 'BSEC-002');
for (const row of [bsec1, bsec2]) {
  assert(row, 'frozen source inventory row missing');
  assert(row.current_disposition === 'BSEC0_DEBT_OPEN', 'frozen PR-SEC-1 inventory must remain historical baseline', row?.surface_id);
  assert(row.caller_authority_status === 'UNAUTHENTICATED_PRODUCTION_WRITER', 'frozen source baseline must not be rewritten', row?.surface_id);
}

console.log(JSON.stringify({
  result: 'PASS',
  predecessor: repair.predecessor.sha,
  batch: batch.batch_id,
  contained_surfaces: batch.source_surfaces,
  before: baseline,
  computed_after: computedAfter,
  semantic_redesign: false,
  mcft_modification: false,
}, null, 2));
