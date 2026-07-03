// scripts/twin_kernel/P48_25_CHECK.cjs
'use strict';

const fs = require('node:fs');

const review = JSON.parse(fs.readFileSync('docs/twin_kernel/P48_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_COMPLETION_REVIEW_V0.json', 'utf8'));
const contract = JSON.parse(fs.readFileSync('docs/twin_kernel/P48_END_TO_END_PRODUCTION_TWIN_PILOT_CLOSURE_CONTRACT_V0.json', 'utf8'));

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);

check('completion_status', review.completion_status === 'complete');
check('final_closure_status', review.final_closure_status === 'final_tag_main_verified');
check('baseline_tag', review.baseline_tag === 'p47_ao_act_from_twin_dispatch_boundary_gate_v0_closure');
check('baseline_commit', review.baseline_commit === '6d9b8bd491b275e6be30448fa69c8c1973f2b1be');
check('final_tag', review.final_tag_created === true && review.final_tag === 'p48_end_to_end_production_twin_pilot_closure_gate_v0');
check('final_commit', review.final_commit === '640768fe90444b49cc3a04ca38675f9a08d3a3c3');
check('final_tag_verified', review.final_tag_main_verified === true && review.main_equals_final_tag_at_final_tag_verification === true);
check('closure_pending', review.closure_tag_created === false && review.closure_tag_required_after_closure_patch_merge === true);
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
  final_tag: review.final_tag,
  final_commit: review.final_commit,
  expected_closure_tag: review.expected_closure_tag,
  closure_tag_created: review.closure_tag_created,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
