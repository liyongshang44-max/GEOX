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
function assertRegex(text, regex, label) {
  if (!regex.test(text)) throw new Error(`${label}: missing ${regex}`);
}

const route = read('apps/server/src/routes/dev/flight_table_evidence_v1.ts');
const service = read('apps/server/src/services/flight_table/flight_table_evidence_v1.ts');
const formalPolicy = read('apps/server/src/domain/evidence/formal_evidence_policy_v1.ts');
const evidenceContract = read('packages/contracts/src/schema/evidence_artifact_v1.ts');
const guardedReport = read('apps/server/src/projections/guarded_report_v1.ts');
const flightTableDoc = read('docs/flight-table/FLIGHT_TABLE_SECURITY_BOUNDARY_V1.md');

assertIncludes(route, '/api/v1/dev/flight-table/runs/:runId/evidence/run', 'Flight Table evidence route must remain dev path');
assertIncludes(route, 'ENABLE_FLIGHT_TABLE_API', 'Flight Table route must stay feature flagged');
assertIncludes(route, 'security.admin', 'Flight Table route must require security admin scope');
assertIncludes(route, 'assertRunScope', 'Flight Table route must scope run to auth tenant/project/group');
assertNotIncludes(route, '/api/v1/evidence', 'Flight Table evidence route must not be formal evidence API');

for (const token of [
  'SIMULATED_DEV_ONLY',
  'formal_eligible: false',
  'is_simulated: true',
  'evidence_level: "DEBUG"',
  'level: "DEBUG"',
  'FLIGHT_TABLE_DEV_EVIDENCE',
  'DEV_ONLY_NOT_FORMAL',
  'SIMULATED_DEV_ONLY',
]) {
  assertIncludes(service, token, `Flight Table service ${token}`);
}

assertIncludes(service, 'acceptance_status = scenario.evidence_complete ? "DEV_ONLY_NOT_FORMAL"', 'Flight Table service must not emit formal acceptance PASS');
assertIncludes(service, 'const final_status = "SIMULATED_DEV_ONLY"', 'Flight Table service must not emit formal final SUCCESS');
assertNotIncludes(service, 'acceptance_status = "PASS"', 'Flight Table service must not emit PASS');
assertNotIncludes(service, 'final_status = "SUCCESS"', 'Flight Table service must not emit SUCCESS');
assertNotIncludes(service, 'evidence_level: "FORMAL"', 'Flight Table artifacts must not be FORMAL');
assertNotIncludes(service, 'level: "FORMAL"', 'Flight Table artifacts must not use FORMAL level');
assertNotIncludes(service, 'formal_eligible: true', 'Flight Table artifacts must not be formal eligible');

assertIncludes(formalPolicy, 'SIMULATED_DEV_ONLY', 'formal evidence policy must identify simulated/dev lane');
assertIncludes(formalPolicy, 'formal_eligible', 'formal evidence policy must honor formal eligibility');
assertIncludes(formalPolicy, 'is_simulated', 'formal evidence policy must reject simulated artifacts');
assertIncludes(evidenceContract, 'formal_eligible', 'evidence artifact contract must carry formal eligibility');
assertIncludes(evidenceContract, 'SIMULATED_DEV_ONLY', 'evidence artifact contract must carry simulated/dev lane');
assertIncludes(guardedReport, 'SIMULATED_DEV_ONLY', 'guarded report must downgrade simulated/dev chain');
assertIncludes(guardedReport, 'customer_visible_eligible = trusted', 'guarded report must block customer-visible simulated chain');
assertIncludes(flightTableDoc, 'Flight Table', 'Flight Table security boundary doc must exist');
assertRegex(flightTableDoc, /dev-only|dev only|开发|模拟/i, 'Flight Table security doc must state dev/simulated boundary');

console.log('[FLIGHT_TABLE_NOT_CUSTOMER_VALID_CHAIN_V1] PASSED');
console.log('[FLIGHT_TABLE_NOT_CUSTOMER_VALID_CHAIN_V1] Checked Flight Table dev route, simulated evidence lane, formal policy, artifact contract, and guarded report downgrade.');
