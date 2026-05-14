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
function assertRegex(text, regex, label) {
  if (!regex.test(text)) throw new Error(`${label}: missing ${regex}`);
}

const service = read('apps/server/src/services/field_memory_service.ts');
const route = read('apps/server/src/routes/field_memory_v1.ts');
const contract = read('packages/contracts/src/field_memory/field_memory_v1.ts');
const migration = read('apps/server/db/migrations/2026_05_14_field_memory_lane_v1.sql');
const skillFacts = read('apps/server/src/domain/skill_registry/facts.ts');
const guard = read('apps/server/src/projections/guarded_report_v1.ts');

for (const token of [
  'FORMAL_FIELD_MEMORY',
  'TECHNICAL_SKILL_MEMORY',
  'TECHNICAL_EXECUTION_MEMORY',
  'SIMULATED_DEV_MEMORY',
  'DIAGNOSTIC_NOTE',
  'FORMAL_ACCEPTED',
  'TECHNICAL_SIGNAL',
  'SIMULATED_DEV_ONLY',
  'INSUFFICIENT_FORMAL_EVIDENCE',
  'customer_visible_memory',
  'learning_eligible',
  'formal_acceptance_id',
]) {
  assertIncludes(contract, token, `contract ${token}`);
  assertIncludes(service, token, `service ${token}`);
}

for (const column of [
  'memory_lane',
  'trust_level',
  'formal_acceptance_id',
  'source_lane',
  'customer_visible_memory',
  'learning_eligible',
  'trust_reasons',
]) {
  assertIncludes(migration, `ADD COLUMN IF NOT EXISTS ${column}`, `migration ${column}`);
  assertIncludes(route, column, `route exposes ${column}`);
}

assertIncludes(service, 'SKILL_RUN_IS_NOT_FORMAL_FIELD_LEARNING', 'skill run downgraded');
assertIncludes(service, 'EXECUTION_SIGNAL_IS_NOT_FORMAL_FIELD_LEARNING', 'execution signal downgraded');
assertIncludes(service, 'SIMULATED_OR_DEV_MEMORY', 'simulated/dev memory downgraded');
assertIncludes(service, 'FORMAL_ACCEPTANCE_ID_REQUIRED', 'formal visible requires acceptance id');
assertIncludes(service, 'memory_type === "FIELD_RESPONSE_MEMORY" && formalAcceptanceId', 'formal field memory requires acceptance id');
assertIncludes(service, 'sourceTypeForMemory', 'source type separated by memory type');
assertIncludes(service, 'memory_type === "SKILL_PERFORMANCE_MEMORY") return "skill_run"', 'skill performance source type');
assertIncludes(skillFacts, 'type: "skill_performance"', 'skill run still emits technical memory signal');
assertIncludes(guard, 'hidden_by_guard', 'report guard hides non-formal field memory');
assertRegex(service, /input\.customer_visible_memory === true[\s\S]*Boolean\(formalAcceptanceId\)/, 'explicit formal visibility must require formal acceptance id');
assertRegex(service, /memory_type === "FIELD_RESPONSE_MEMORY" && formalAcceptanceId[\s\S]*memory_lane: "FORMAL_FIELD_MEMORY"/, 'only field response memory with formal acceptance id becomes formal field memory');

console.log('[FIELD_MEMORY_TRUST_LANE_V1] PASSED');
console.log('[FIELD_MEMORY_TRUST_LANE_V1] Checked Field Memory lane contract, migration, write classifier, read API exposure, and report guard hiding.');
