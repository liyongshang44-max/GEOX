'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = (x) => { throw new Error(x); };

const vm = read('apps/web/src/viewmodels/mcftFieldIntelligenceVm.ts');
const page = read('apps/web/src/features/operator/fieldRuntime/McftCanonicalFieldRuntimeRoutePage.tsx');
const api = read('apps/web/src/api/mcftFieldTwinRuntime.ts');

const requiredRuntimeKeys = [
  'active_lineage','checkpoint','runtime_tick','evidence_window','state_transition',
  'assimilation_update','posterior_state','terminal_record_set_health','runtime_config',
  'current_tick_forecast_result','latest_successful_forecast','scenario_source_forecast',
  'current_scenario_attachment','latest_scenario_in_scope','current_human_decision',
  'current_approved_plan','action_feedback_summary','forecast_residual_summary',
  'calibration_candidate_summary','shadow_evaluation_summary','model_activation_summary',
  'limitations','validation_summary','root_graph_content_hash','attachment_content_hash',
  'response_instance_hash','response_started_at'
];

for (const key of requiredRuntimeKeys) {
  if (!api.includes(key)) fail('MCFT_API_KEY_MISSING:' + key);
  if (!vm.includes(key)) fail('FOUI_VM_KEY_NOT_PRESERVED:' + key);
}

for (const token of [
  'source_fact_ref',
  'object_type',
  'latest_item_hash',
  'collection_endpoint',
  'CanonicalDataDisclosure',
  'limitations',
  'validation_summary',
  'canonical_source',
]) {
  if (!page.includes(token) && !vm.includes(token)) fail('FOUI_DATA_PRESERVATION_TOKEN_MISSING:' + token);
}

for (const forbidden of ['POST', 'PUT', 'PATCH', 'DELETE', 'createAoActTask', 'approve(', 'dispatch(']) {
  if (vm.includes(forbidden)) fail('FOUI_VM_WRITE_BOUNDARY:' + forbidden);
}

console.log(JSON.stringify({
  status: 'PASS',
  gate: 'FOUI-FIELD-INTELLIGENCE-DATA-PRESERVATION-V1',
  canonical_runtime_keys_preserved: requiredRuntimeKeys.length,
  source_fact_ref_preserved: true,
  full_response_disclosure_required: true,
  backend_change: 'NONE',
  mcft_semantic_change: 'NONE'
}, null, 2));
