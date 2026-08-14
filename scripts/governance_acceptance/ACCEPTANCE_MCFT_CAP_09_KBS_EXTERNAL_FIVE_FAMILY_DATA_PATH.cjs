const fs = require('fs');
const path = require('path');

const root = process.cwd();
const runnerPath = path.join(root, 'scripts/runtime_acceptance/RUN_MCFT_CAP_09_KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_V1.ts');
const workflowPath = path.join(root, '.github/workflows/mcft-cap-09-kbs-five-family-data-path.yml');
const runner = fs.readFileSync(runnerPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');

function req(value, code) { if (!value) throw new Error(code); }
for (const marker of [
  'PROVIDER_AVAILABILITY_WATERMARK_V1',
  'KBS_LTER',
  'https://lter.kbs.msu.edu/datatables/13.csv',
  'AbortSignal.timeout(180_000)',
  '--target-t',
  'EXACT_REQUESTED_TARGET',
  'RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts',
  'kbs_authoritative_late_path: "PASS"',
  'kbs_causal_intersection: "PASS"',
  'cross_head_rehydration: "PASS"',
  'kbs_external_five_family_data_path_qualified: true',
  'isolated_database_fact_count: after',
  'kbs_raw_retained_before_decode: true',
  'kbs_provider_retry_count: 0',
  'kbs_source_substitution_allowed: false',
  'cap04_runtime_successor_qualified: false',
  'crop_authority_effect: "NONE"',
  'ea5e2_operational_activation_qualified: false',
  'full_operational_go: false',
  'raw_values_emitted: false',
]) req(runner.includes(marker) || workflow.includes(marker), `MCFT_CAP09_FIVE_FAMILY_MARKER_REQUIRED:${marker}`);

req(!runner.includes('CAP04') && !workflow.includes('external_formal_cap04_amendment11_candidate_execution_service_v1'), 'MCFT_CAP09_FIVE_FAMILY_CAP04_CONSUMPTION_FORBIDDEN');
req(!workflow.includes('retry:') && !workflow.includes('mirror') && !workflow.includes('source substitution'), 'MCFT_CAP09_FIVE_FAMILY_RETRY_OR_SUBSTITUTION_FORBIDDEN');
req(workflow.includes('Discover latest successful exact KBS intersection proof'), 'MCFT_CAP09_FIVE_FAMILY_INTERSECTION_PROOF_REQUIRED');
req(workflow.includes('Rehydrate three original pre-T evidence families into isolated DB'), 'MCFT_CAP09_FIVE_FAMILY_REHYDRATION_STAGE_REQUIRED');
req(workflow.includes('Add exact-T KBS rainfall and historical ET0 and qualify five-family package'), 'MCFT_CAP09_FIVE_FAMILY_KBS_APPEND_STAGE_REQUIRED');
req(workflow.includes('retention-days: 30'), 'MCFT_CAP09_FIVE_FAMILY_PROOF_RETENTION_REQUIRED');

console.log(JSON.stringify({
  schema_version: 'geox_mcft_cap09_kbs_external_five_family_data_path_acceptance_v1',
  status: 'PASS',
  kbs_provider_data_path_independent_from_cap04: true,
  kbs_provider_data_path_independent_from_crop: true,
  exact_intersection_proof_required: true,
  producer_bound_rehydration_required: true,
  exact_target_kbs_decode_required: true,
  five_isolated_database_facts_required: true,
  retry_count: 0,
  source_substitution_allowed: false,
  formal_effect: false,
  operational_activation_claimed: false,
}, null, 2));
