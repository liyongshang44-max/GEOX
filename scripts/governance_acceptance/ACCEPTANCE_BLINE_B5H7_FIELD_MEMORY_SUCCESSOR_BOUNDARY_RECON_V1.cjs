'use strict';

const fs = require('node:fs');

const task = 'BLINE_B5H7_FIELD_MEMORY_SUCCESSOR_BOUNDARY_RECON_V1';

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`REQUIRED_FILE_MISSING:${path}`);
  }
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

const fieldMemoryAcceptance = read('scripts/agronomy_acceptance/ACCEPTANCE_FIELD_MEMORY_V1.cjs');
const h58 = read('scripts/governance_acceptance/H58_FIELD_MEMORY_GOVERNANCE_BOUNDARY.cjs');
const route = read('apps/server/src/routes/field_memory_v1.ts');
const service = read('apps/server/src/services/field_memory_service.ts');
const authority = read('apps/server/src/services/formal_field_memory_promotion_authority_v1.ts');

const staleStandaloneChecks = [
  'field_response_memory_written',
  'field_response_has_before_value',
  'field_response_has_after_value',
  'field_response_has_delta_value',
  'report_field_response_contains_delta',
  'report_reads_field_memory',
];

const successorStandaloneChecks = [
  'formal_field_memory_not_auto_promoted',
  'formal_memory_lane_not_auto_promoted',
  'technical_memory_not_customer_visible',
  'technical_memory_not_learning_eligible',
  'formal_promotion_route_present',
  'device_reliability_memory_written',
  'skill_performance_memory_written',
  'memory_linked_to_current_chain',
];

const checks = {};

pass(
  checks,
  'standalone_stale_auto_formal_expectations_removed',
  excludesAll(fieldMemoryAcceptance, staleStandaloneChecks),
);

pass(
  checks,
  'standalone_successor_pre_promotion_checks_present',
  includesAll(fieldMemoryAcceptance, successorStandaloneChecks),
);

pass(
  checks,
  'standalone_does_not_fabricate_p29_p30_promotion_authority',
  excludesAll(fieldMemoryAcceptance, [
    'field_memory_record_ref',
    'field_memory_candidate_v1',
    'field_memory_record_v1',
  ]),
);

pass(
  checks,
  'standalone_preserves_technical_memory_contract',
  includesAll(fieldMemoryAcceptance, [
    'DEVICE_RELIABILITY_MEMORY',
    'SKILL_PERFORMANCE_MEMORY',
    'memory_query_by_field',
    'memory_query_by_operation',
    'memory_has_confidence',
    'memory_has_summary_text',
    'memory_has_evidence_refs',
    'skill_memory_has_skill_trace_ref',
    'device_memory_has_skill_id',
    'device_memory_has_response_metric',
  ]),
);

pass(
  checks,
  'h58_stale_child_tokens_removed',
  excludesAll(h58, [
    "'field_response_has_before_value'",
    "'field_response_has_after_value'",
    "'field_response_has_delta_value'",
  ]),
);

pass(
  checks,
  'h58_successor_child_boundary_tokens_present',
  includesAll(h58, [
    "'formal_field_memory_not_auto_promoted'",
    "'formal_memory_lane_not_auto_promoted'",
    "'technical_memory_not_customer_visible'",
    "'technical_memory_not_learning_eligible'",
    "'formal_promotion_route_present'",
  ]),
);

pass(
  checks,
  'formal_promotion_route_remains_explicit_and_scoped',
  includesAll(route, [
    '/api/v1/field-memory/from-acceptance',
    'field_memory.write',
    'field_memory_record_ref',
    'MISSING_FIELD_MEMORY_RECORD_REF',
    'createFormalFieldMemoryFromAcceptanceV1',
  ]),
);

pass(
  checks,
  'formal_promotion_service_remains_p29_p30_guarded',
  includesAll(service, [
    'requireFormalFieldMemoryPromotionAuthorityV1',
    'FIELD_RESPONSE_MEMORY',
    'FORMAL_FIELD_MEMORY',
    'FORMAL_ACCEPTED',
    'P29_FIELD_MEMORY_CANDIDATE_BOUND',
    'P30_REVIEWED_PROMOTION_COMMITTED',
    'OBSERVATION_PAIR_NOT_FOUND',
  ]),
);

pass(
  checks,
  'formal_promotion_authority_requires_committed_successor_chain',
  includesAll(authority, [
    'field_memory_candidate_v1',
    'field_memory_record_v1',
    'roi_ledger_v1',
    'roi_boundary_v1',
    'outcome_review_v1',
    'CHAIN_VALIDATION_NOT_PASSED',
    'FIELD_MEMORY_RECORD_NOT_COMMITTED',
    'FIELD_MEMORY_CANDIDATE_NOT_RECORDED',
  ]),
);

pass(
  checks,
  'technical_memory_remains_non_formal_in_service',
  includesAll(service, [
    'TECHNICAL_SKILL_MEMORY',
    'TECHNICAL_EXECUTION_MEMORY',
    'customer_visible_memory: false',
    'learning_eligible: false',
    'SKILL_RUN_IS_NOT_FORMAL_FIELD_LEARNING',
    'EXECUTION_SIGNAL_IS_NOT_FORMAL_FIELD_LEARNING',
  ]),
);

const ok = Object.values(checks).every((value) => value === 'PASS');

process.stdout.write(`${JSON.stringify({ ok, task, checks }, null, 2)}\n`);

if (!ok) process.exit(1);
