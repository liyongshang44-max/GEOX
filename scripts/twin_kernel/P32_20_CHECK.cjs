// scripts/twin_kernel/P32_20_CHECK.cjs
'use strict';

const fs = require('node:fs');

const d = JSON.parse(
  fs.readFileSync('docs/twin_kernel/P32_FORECAST_PROJECTION_COMPLETION_REVIEW_V0.json', 'utf8')
);

const checks = [
  ['completion_status_complete', d.completion_status === 'complete'],
  ['closure_patch_ready', d.final_closure_status === 'closure_patch_ready'],
  ['final_tag_created', d.final_tag_created === true],
  ['final_commit_matches_p32_merge', d.final_commit === '5cbe837a92e39d86b526011e3294fbb5b93fe041'],
  ['expected_final_tag_matches', d.expected_final_tag === 'p32_controlled_twin_forecast_projection_runtime_v0'],
  ['expected_closure_tag_matches', d.expected_closure_tag === 'p32_controlled_twin_forecast_projection_runtime_v0_closure'],
  ['merge_not_required_before_complete', d.merge_required_before_complete === false],
  ['tag_verification_required_after_merge', d.tag_verification_required_after_merge === true],
  ['closure_patch_required_after_final_tag', d.closure_patch_required_after_final_tag === true],
  ['main_equals_closure_tag_must_be_true_after_closure_patch', d.main_equals_closure_tag_must_be_true_after_closure_patch === true],
  ['allowed_created_fact_types_exact', JSON.stringify(d.allowed_created_fact_types) === JSON.stringify(['forecast_run_v1', 'twin_state_projection_v1'])],
  ['forbidden_downstream_fact_count_must_be_zero', d.forbidden_downstream_fact_count_must_be_zero === true]
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
const ok = failed.length === 0;

console.log(JSON.stringify({
  ok,
  acceptance: 'P32_20_CLOSURE_REVIEW_ACCEPTANCE',
  phase: 'P32',
  completion_status: d.completion_status,
  final_closure_status: d.final_closure_status,
  final_tag: d.final_tag,
  final_commit: d.final_commit,
  closure_tag: d.closure_tag,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (!ok) {
  process.exit(1);
}