// scripts/twin_kernel/P32_20_CHECK.cjs
'use strict';

const fs = require('node:fs');

const d = JSON.parse(
  fs.readFileSync('docs/twin_kernel/P32_FORECAST_PROJECTION_COMPLETION_REVIEW_V0.json', 'utf8')
);

const checks = [
  ['completion_status_complete', d.completion_status === 'complete'],
  ['closure_status_is_final_or_corrected', ['closure_patch_ready', 'complete_with_governance_correction_required'].includes(d.final_closure_status)],
  ['final_tag_created', d.final_tag_created === true],
  ['final_commit_matches_p32_merge', d.final_commit === '5cbe837a92e39d86b526011e3294fbb5b93fe041'],
  ['expected_final_tag_matches', d.expected_final_tag === 'p32_controlled_twin_forecast_projection_runtime_v0'],
  ['expected_closure_tag_matches', d.expected_closure_tag === 'p32_controlled_twin_forecast_projection_runtime_v0_closure'],
  ['closure_tag_recorded', d.closure_tag === 'p32_controlled_twin_forecast_projection_runtime_v0_closure'],
  ['closure_commit_recorded', d.closure_commit === '8da03b4637a05b0cea73b0be26bd120a277b0285'],
  ['tag_main_verified', d.tag_main_verified === true],
  ['allowed_created_fact_types_exact', JSON.stringify(d.allowed_created_fact_types) === JSON.stringify(['forecast_run_v1', 'twin_state_projection_v1'])],
  ['forbidden_downstream_fact_count_must_be_zero', d.forbidden_downstream_fact_count_must_be_zero === true],
  ['correction_patch_required_or_not_applicable', d.correction_patch_required === true || d.final_closure_status === 'closure_patch_ready']
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
  closure_commit: d.closure_commit,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (!ok) {
  process.exit(1);
}
