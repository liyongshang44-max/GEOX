#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}
function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`${label}: missing ${needle}`);
}
function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) throw new Error(`${label}: must not include ${needle}`);
}
function sectionAfter(text, marker) {
  const idx = text.indexOf(marker);
  if (idx < 0) throw new Error(`marker not found: ${marker}`);
  return text.slice(idx, Math.min(text.length, idx + 1800));
}

const route = read('apps/server/src/routes/roi_ledger_v1.ts');
const trust = read('apps/server/src/domain/roi/roi_trust_v1.ts');
const contract = read('packages/contracts/src/roi/roi_ledger_v1.ts');
const migration = read('apps/server/db/migrations/2026_05_14_roi_ledger_trust_layer_v1.sql');
const guard = read('apps/server/src/projections/guarded_report_v1.ts');

const fromAsExecuted = sectionAfter(route, 'app.post("/api/v1/roi-ledger/from-as-executed"');
assertIncludes(fromAsExecuted, '["roi_ledger.write"]', 'from-as-executed write scope');
assertNotIncludes(fromAsExecuted, 'ao_act.task.write', 'from-as-executed write scope');
assertIncludes(route, 'attachRoiTrustListV1', 'route trust projection');
assertIncludes(route, 'default_source_lane: "AS_EXECUTED_SIGNAL"', 'route default source lane');
assertIncludes(route, 'customer_visible_value: false', 'from-as-executed response trust layer');

for (const token of [
  'FORMAL_ACCEPTED',
  'INTERIM_SUPPORTED',
  'HYPOTHESIS_ONLY',
  'SIMULATED_DEV_ONLY',
  'INSUFFICIENT_FORMAL_EVIDENCE',
  'FORMAL_ACCEPTANCE',
  'AS_EXECUTED_SIGNAL',
  'FLIGHT_TABLE_DEV',
  'customer_visible_value',
  'formal_acceptance_id',
  'formal_evidence_passed',
  'chain_validation_passed',
]) {
  assertIncludes(trust, token, `roi trust projector ${token}`);
  assertIncludes(contract, token, `roi contract ${token}`);
}

for (const column of [
  'trust_level',
  'source_lane',
  'formal_acceptance_id',
  'formal_evidence_passed',
  'chain_validation_passed',
  'customer_visible_value',
  'trust_reasons',
]) {
  assertIncludes(migration, `ADD COLUMN IF NOT EXISTS ${column}`, `migration ${column}`);
}

assertIncludes(trust, 'trustLevel === "FORMAL_ACCEPTED"', 'customer visible only formal accepted');
assertIncludes(guard, 'has_customer_visible_value: trusted', 'report guard ROI customer visibility');
assertIncludes(guard, 'customer_visible_value: trusted', 'report guard ROI item visibility');

console.log('[ROI_MEMORY_TRUST_LANE_V1] PASSED');
console.log('[ROI_MEMORY_TRUST_LANE_V1] Checked ROI trust projector, contract, migration, route scopes, and report guard visibility.');
