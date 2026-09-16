'use strict';

const fs = require('node:fs');

const task = 'BLINE_B5H9_FIELD_MEMORY_TECHNICAL_CONFIDENCE_RECON_V1';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`REQUIRED_FILE_MISSING:${path}`);
  return fs.readFileSync(path, 'utf8');
}

function includesAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function excludesAll(text, tokens) {
  return tokens.every((token) => !text.includes(token));
}

function pass(checks, name, value) {
  checks[name] = value ? 'PASS' : 'FAIL';
}

const child = read('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
const h7 = read('scripts/governance_acceptance/ACCEPTANCE_BLINE_B5H7_FIELD_MEMORY_SUCCESSOR_BOUNDARY_RECON_V1.cjs');
const contract = read('packages/contracts/src/field_memory/field_memory_v1.ts');
const service = read('apps/server/src/services/field_memory_service.ts');
const skillFacts = read('apps/server/src/domain/skill_registry/facts.ts');
const judge = read('apps/server/src/routes/judge_v2.ts');

const checks = {};

pass(
  checks,
  'stale_universal_positive_confidence_assertion_removed',
  excludesAll(child, [
    'memory_has_confidence: byScopeItems.every((item) => Number(item?.confidence) > 0)',
  ]),
);

pass(
  checks,
  'optional_or_finite_confidence_contract_present',
  includesAll(child, [
    'memory_confidence_optional_or_finite',
    'item?.confidence == null || Number.isFinite(Number(item.confidence))',
  ]),
);

pass(
  checks,
  'h7_guard_tracks_successor_confidence_contract',
  excludesAll(h7, ["'memory_has_confidence'"])
    && includesAll(h7, ["'memory_confidence_optional_or_finite'"]),
);

pass(
  checks,
  'public_contract_keeps_confidence_optional_nullable',
  includesAll(contract, ['confidence?: number | null;']),
);

pass(
  checks,
  'memory_service_only_materializes_explicit_metric_confidence',
  includesAll(service, [
    'const confidence = num((metrics as any).confidence) ?? null;',
    'TECHNICAL_SKILL_MEMORY',
    'TECHNICAL_EXECUTION_MEMORY',
    'customer_visible_memory: false',
    'learning_eligible: false',
  ]),
);

pass(
  checks,
  'skill_run_technical_producer_does_not_require_confidence',
  includesAll(skillFacts, [
    'metrics: { success: payload.result_status === "SUCCESS" }',
    'memory_lane: "TECHNICAL_SKILL_MEMORY"',
    'trust_level: "TECHNICAL_SIGNAL"',
  ]),
);

pass(
  checks,
  'execution_technical_producer_does_not_require_confidence',
  includesAll(judge, [
    'metrics: { execution_deviation, success: inserted.verdict === "PASS", ack_latency_ms: Number.isFinite(ack_latency_ms) ? ack_latency_ms : 0, receipt_complete: true, timeout: false }',
    'memory_lane: "TECHNICAL_EXECUTION_MEMORY"',
    'trust_level: "TECHNICAL_SIGNAL"',
  ]),
);

pass(
  checks,
  'formal_pre_promotion_boundary_preserved',
  includesAll(child, [
    'formal_field_memory_not_auto_promoted',
    'formal_memory_lane_not_auto_promoted',
    'technical_memory_not_customer_visible',
    'technical_memory_not_learning_eligible',
    'formal_promotion_route_present',
  ]),
);

const ok = Object.values(checks).every((value) => value === 'PASS');
process.stdout.write(`${JSON.stringify({ ok, task, checks }, null, 2)}\n`);
if (!ok) process.exit(1);
