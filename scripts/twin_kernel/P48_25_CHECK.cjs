// scripts/twin_kernel/P48_25_CHECK.cjs
'use strict';

const fs = require('node:fs');

const review = JSON.parse(fs.readFileSync('docs/twin_kernel/P48_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_COMPLETION_REVIEW_V0.json', 'utf8'));
const contract = JSON.parse(fs.readFileSync('docs/twin_kernel/P48_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_CONTRACT_V0.json', 'utf8'));

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);

check('completion_status', review.completion_status === 'implementation_ready_for_review');
check('final_closure_status', review.final_closure_status === 'not_started');
check('baseline_tag', review.baseline_tag === 'p47_ao_act_from_twin_dispatch_boundary_gate_v0_closure');
check('baseline_commit', review.baseline_commit === '6d9b8bd491b275e6be30448fa69c8c1973f2b1be');
check('expected_final_tag', review.expected_final_tag === 'p48_end_to_end_production_twin_pilot_closure_gate_v0');
check('expected_closure_tag', review.expected_closure_tag === 'p48_end_to_end_production_twin_pilot_closure_gate_v0_closure');
check('tag_flags', review.final_tag_created === false && review.closure_tag_created === false);
check('merge_policy', review.merge_required_before_complete === true && review.tag_verification_required_after_merge === true && review.closure_patch_required_after_final_tag === true);
check('allowed_types', Array.isArray(contract.allowed_created_fact_types) && contract.allowed_created_fact_types.length === 5);
check('ledger', contract.controlled_write_only_writes_controlled_pilot_closure_ledger_v0 === true);

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P48_25_COMPLETION_REVIEW_ACCEPTANCE',
  phase: 'P48',
  completion_status: review.completion_status,
  final_closure_status: review.final_closure_status,
  baseline_tag: review.baseline_tag,
  baseline_commit: review.baseline_commit,
  expected_final_tag: review.expected_final_tag,
  expected_closure_tag: review.expected_closure_tag,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
