#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  roiRoute: path.join(root, 'apps/server/src/routes/roi_ledger_v1.ts'),
  roiDomain: path.join(root, 'apps/server/src/domain/roi/roi_ledger_v1.ts'),
  roiTrust: path.join(root, 'apps/server/src/domain/roi/roi_trust_v1.ts'),
  roiContract: path.join(root, 'packages/contracts/src/roi/roi_ledger_v1.ts'),
  memoryService: path.join(root, 'apps/server/src/services/field_memory_service.ts'),
  memoryRoute: path.join(root, 'apps/server/src/routes/field_memory_v1.ts'),
  memoryContract: path.join(root, 'packages/contracts/src/field_memory/field_memory_v1.ts'),
  skillFacts: path.join(root, 'apps/server/src/domain/skill_registry/facts.ts'),
  judgeRoute: path.join(root, 'apps/server/src/routes/judge_v2.ts'),
  acceptanceRoute: path.join(root, 'apps/server/src/routes/acceptance_v1.ts'),
  customerRoute: path.join(root, 'apps/server/src/routes/customer_v1.ts'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function fail(message) {
  console.error(`[roi-memory-trust-lane] FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}
function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

const roiRoute = read(files.roiRoute);
const roiDomain = read(files.roiDomain);
const roiTrust = read(files.roiTrust);
const roiContract = read(files.roiContract);
const memoryService = read(files.memoryService);
const memoryRoute = read(files.memoryRoute);
const memoryContract = read(files.memoryContract);
const skillFacts = read(files.skillFacts);
const judgeRoute = read(files.judgeRoute);
const acceptanceRoute = read(files.acceptanceRoute);
const customerRoute = read(files.customerRoute);

for (const value of ['FORMAL_ACCEPTED', 'INTERIM_SUPPORTED', 'HYPOTHESIS_ONLY', 'SIMULATED_DEV_ONLY', 'INSUFFICIENT_FORMAL_EVIDENCE']) {
  assertIncludes(roiContract, `"${value}"`, 'ROI contract trust_level values');
  assertIncludes(roiTrust, `"${value}"`, 'ROI trust projection trust_level values');
}
for (const value of ['FORMAL_ACCEPTANCE', 'AS_EXECUTED_SIGNAL', 'FLIGHT_TABLE_DEV', 'SKILL_TECHNICAL', 'MANUAL_IMPORT']) {
  assertIncludes(roiContract, `"${value}"`, 'ROI contract source_lane values');
  assertIncludes(roiTrust, `"${value}"`, 'ROI trust projection source_lane values');
}
for (const field of ['formal_acceptance_id', 'customer_visible_value', 'trust_reasons']) {
  assertIncludes(roiContract, field, 'ROI contract trust fields');
  assertIncludes(roiTrust, field, 'ROI trust projection fields');
}

assertIncludes(roiRoute, '/api/v1/roi-ledger/from-as-executed', 'ROI as-executed route');
assertIncludes(roiRoute, 'default_source_lane: "AS_EXECUTED_SIGNAL"', 'ROI as-executed source lane');
assertIncludes(roiRoute, 'default_trust_level: "INTERIM_SUPPORTED"', 'ROI as-executed trust level');
assertIncludes(roiRoute, 'customer_visible_value: false', 'ROI as-executed customer visibility');
assertNotIncludes(roiRoute, 'default_trust_level: "FORMAL_ACCEPTED"', 'ROI as-executed must not default formal');
assertIncludes(roiDomain, 'computeRoiLedgerEntriesFromAsExecuted', 'ROI as-executed domain path');
assertIncludes(roiTrust, 'AS_EXECUTED_SIGNAL_IS_INTERIM_NOT_FORMAL_VALUE', 'ROI as-executed formal downgrade reason');
assertIncludes(roiTrust, 'FORMAL_ACCEPTED_REQUIRES_FORMAL_ACCEPTANCE_SOURCE_LANE', 'ROI formal source lane guard');
assertIncludes(roiTrust, 'sourceLane === "FLIGHT_TABLE_DEV"', 'ROI flight table simulated guard');
assertIncludes(roiTrust, 'trustLevel = "SIMULATED_DEV_ONLY"', 'ROI simulated trust level');
assertIncludes(roiTrust, 'legacyAcceptanceId && !formalAcceptanceId', 'ROI legacy acceptance id guard');

for (const value of ['FORMAL_FIELD_MEMORY', 'TECHNICAL_SKILL_MEMORY', 'TECHNICAL_EXECUTION_MEMORY', 'SIMULATED_DEV_MEMORY', 'DIAGNOSTIC_NOTE']) {
  assertIncludes(memoryContract, `"${value}"`, 'Field Memory contract lane values');
  assertIncludes(memoryService, `"${value}"`, 'Field Memory service lane values');
}
for (const field of ['learning_eligible', 'customer_visible_memory', 'formal_acceptance_id', 'memory_lane', 'trust_level']) {
  assertIncludes(memoryContract, field, 'Field Memory contract trust fields');
  assertIncludes(memoryService, field, 'Field Memory service trust fields');
  assertIncludes(memoryRoute, field, 'Field Memory route trust fields');
}
assertIncludes(memoryService, 'FORMAL_MEMORY_REQUIRES_EXPLICIT_FORMAL_ACCEPTANCE_GATE', 'Field Memory formal gate reason');
assertIncludes(memoryService, 'LEGACY_ACCEPTANCE_ID_NOT_FORMAL_ACCEPTANCE_ID', 'Field Memory legacy acceptance guard');
assertIncludes(memoryService, 'isFormalAcceptanceSource', 'Field Memory formal source lane guard');
assertIncludes(memoryService, 'memory_lane: "SIMULATED_DEV_MEMORY"', 'Field Memory simulated lane');
assertIncludes(memoryService, 'source_lane: sourceLane ?? "FLIGHT_TABLE_DEV"', 'Field Memory flight table source lane');

assertIncludes(skillFacts, 'memory_lane: "TECHNICAL_SKILL_MEMORY"', 'skill run field memory lane');
assertIncludes(skillFacts, 'trust_level: "TECHNICAL_SIGNAL"', 'skill run field memory trust level');
assertIncludes(skillFacts, 'source_lane: "SKILL_TECHNICAL"', 'skill run field memory source lane');
assertIncludes(skillFacts, 'SKILL_RUN_SUCCESS_IS_TECHNICAL_SIGNAL_NOT_FORMAL_FIELD_MEMORY', 'skill run formal guard reason');
assertNotIncludes(skillFacts, 'memory_lane: "FORMAL_FIELD_MEMORY"', 'appendSkillRunFact must not write formal memory');

assertIncludes(judgeRoute, 'memory_lane: "TECHNICAL_EXECUTION_MEMORY"', 'judge execution field memory lane');
assertIncludes(judgeRoute, 'trust_level: "TECHNICAL_SIGNAL"', 'judge execution field memory trust level');
assertIncludes(judgeRoute, 'source_lane: "AS_EXECUTED_SIGNAL"', 'judge execution source lane');
assertIncludes(judgeRoute, 'JUDGE_PASS_IS_TECHNICAL_SIGNAL_NOT_FORMAL_FIELD_MEMORY', 'judge pass formal guard reason');
assertNotIncludes(judgeRoute, 'memory_lane: "FORMAL_FIELD_MEMORY"', 'judge route must not write formal memory');

assertIncludes(acceptanceRoute, 'acceptanceRecord.payload.verdict === "PASS" && acceptanceRecord.payload.formal_acceptance === true', 'acceptance formal memory condition');
assertIncludes(acceptanceRoute, 'memory_lane: "FORMAL_FIELD_MEMORY"', 'acceptance formal memory lane');
assertIncludes(acceptanceRoute, 'formal_acceptance_id: acceptanceFactId', 'acceptance formal acceptance id');
assertIncludes(acceptanceRoute, 'source_lane: "FORMAL_OPERATION"', 'acceptance formal source lane');
assertIncludes(acceptanceRoute, 'customer_visible_memory: true', 'acceptance customer-visible memory');
assertIncludes(acceptanceRoute, 'learning_eligible: true', 'acceptance learning eligible');
assertNotIncludes(acceptanceRoute, 'createRoiLedgersFromAsExecuted', 'PDI/acceptance route must not generate ROI directly');
assertNotIncludes(acceptanceRoute, 'roi-ledger', 'acceptance route must not invoke ROI ledger');

assertIncludes(customerRoute, 'data_trust_status', 'customer route report item data trust marker');
assertIncludes(customerRoute, 'LIMITED', 'customer route limited data trust marker');
assertIncludes(customerRoute, '能力可用，结论需复核', 'customer route capability wording');
assertIncludes(customerRoute, '不代表正式经营结论', 'customer route limited subtitle wording');

const fixture = String.raw`
(async () => {
const { projectRoiTrustV1 } = await import('./src/domain/roi/roi_trust_v1.ts');
const { recordMemoryV1 } = await import('./src/services/field_memory_service.ts');
function assertRuntime(condition, message) { if (!condition) throw new Error(message); }
const asExecutedTrust = projectRoiTrustV1({ roi_ledger_id: 'roi_1', source_lane: 'AS_EXECUTED_SIGNAL', trust_level: 'FORMAL_ACCEPTED', formal_acceptance_id: 'acc_1', formal_evidence_passed: true, chain_validation_passed: true, customer_visible_value: true, value_kind: 'MEASURED', confidence: { level: 'HIGH' } });
assertRuntime(asExecutedTrust.trust_level !== 'FORMAL_ACCEPTED', 'as_executed ROI must not stay FORMAL_ACCEPTED');
assertRuntime(asExecutedTrust.customer_visible_value === false, 'as_executed ROI must not be customer visible');
const flightTrust = projectRoiTrustV1({ roi_ledger_id: 'roi_ft', source_lane: 'FLIGHT_TABLE_DEV', formal_acceptance_id: 'acc_1', formal_evidence_passed: true, chain_validation_passed: true, value_kind: 'MEASURED', confidence: { level: 'HIGH' } });
assertRuntime(flightTrust.trust_level === 'SIMULATED_DEV_ONLY', 'Flight Table ROI must be SIMULATED_DEV_ONLY');
assertRuntime(flightTrust.customer_visible_value === false, 'Flight Table ROI must not be customer visible');
const formalTrust = projectRoiTrustV1({ roi_ledger_id: 'roi_formal', source_lane: 'FORMAL_ACCEPTANCE', formal_acceptance_id: 'acc_1', formal_evidence_passed: true, chain_validation_passed: true, value_kind: 'MEASURED', confidence: { level: 'HIGH' } });
assertRuntime(formalTrust.trust_level === 'FORMAL_ACCEPTED', 'formal ROI should be formal accepted');
assertRuntime(formalTrust.customer_visible_value === true, 'formal ROI should be customer visible');
const fakeDb = { async query(sql, params) { this.last = { sql, params }; return { rows: [] }; } };
const skillMemory = await recordMemoryV1(fakeDb, 'tenantA', { type: 'skill_performance', project_id: 'projectA', group_id: 'groupA', field_id: 'field_1', skill_id: 'skill_1', metrics: { success: true }, summary: 'skill success' });
assertRuntime(skillMemory.memory_lane !== 'FORMAL_FIELD_MEMORY', 'skill_run SUCCESS must not create FORMAL_FIELD_MEMORY');
assertRuntime(skillMemory.customer_visible_memory === false, 'skill_run memory must not be customer visible');
assertRuntime(skillMemory.learning_eligible === false, 'skill_run memory must not be formal learning eligible');
const judgeMemory = await recordMemoryV1(fakeDb, 'tenantA', { type: 'execution_reliability', project_id: 'projectA', group_id: 'groupA', field_id: 'field_1', metrics: { success: true }, summary: 'judge pass' });
assertRuntime(judgeMemory.memory_lane !== 'FORMAL_FIELD_MEMORY', 'judge PASS must not create FORMAL_FIELD_MEMORY');
assertRuntime(judgeMemory.customer_visible_memory === false, 'judge memory must not be customer visible');
const weakAcceptanceMemory = await recordMemoryV1(fakeDb, 'tenantA', { type: 'FIELD_RESPONSE_MEMORY', project_id: 'projectA', group_id: 'groupA', field_id: 'field_1', acceptance_id: 'legacy_acc', metrics: { success: true }, summary: 'legacy pass' });
assertRuntime(weakAcceptanceMemory.memory_lane !== 'FORMAL_FIELD_MEMORY', 'acceptance_id alone must not create formal memory');
assertRuntime(weakAcceptanceMemory.learning_eligible === false, 'acceptance_id alone must not be learning eligible');
const formalMemory = await recordMemoryV1(fakeDb, 'tenantA', { type: 'FIELD_RESPONSE_MEMORY', project_id: 'projectA', group_id: 'groupA', field_id: 'field_1', acceptance_id: 'acc_1', formal_acceptance_id: 'acc_1', memory_lane: 'FORMAL_FIELD_MEMORY', trust_level: 'FORMAL_ACCEPTED', source_lane: 'FORMAL_OPERATION', customer_visible_memory: true, learning_eligible: true, metrics: { success: true }, summary: 'formal pass' });
assertRuntime(formalMemory.memory_lane === 'FORMAL_FIELD_MEMORY', 'explicit formal acceptance should create formal memory');
assertRuntime(formalMemory.customer_visible_memory === true, 'explicit formal memory should be customer visible');
assertRuntime(formalMemory.learning_eligible === true, 'explicit formal memory should be learning eligible');
})();
`;
const runtime = spawnSync('pnpm', ['--filter', '@geox/server', 'exec', 'tsx', '-e', fixture], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (runtime.status !== 0) {
  process.stderr.write(runtime.stdout || '');
  process.stderr.write(runtime.stderr || '');
  fail('runtime fixture failed');
}
console.log('[roi-memory-trust-lane] PASS');
