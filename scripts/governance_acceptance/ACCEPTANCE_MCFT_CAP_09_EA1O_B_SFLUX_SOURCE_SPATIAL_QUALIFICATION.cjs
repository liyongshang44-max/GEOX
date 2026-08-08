'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'ce38bc250fb9ddb1aabd0475baafc85939046695';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A2 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-02-GFS-SOLAR-RADIATION-SOURCE-AUTHORITY.md';
const K = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json';
const M = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json';
const N = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json';
const AUTH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-B-SFLUX-SOURCE-SPATIAL-QUALIFICATION-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1O_B_SFLUX_SOURCE_SPATIAL_QUALIFICATION.py';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1O_B_SFLUX_SOURCE_SPATIAL_QUALIFICATION.cjs';
const WF = '.github/workflows/mcft-cap-09-ea1o-b-sflux-source-spatial-qualification.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1O_B_SFLUX_SOURCE_SPATIAL_QUALIFICATION_GOVERNANCE_RESULT.json');
const EXPECT = [AUTH, PROBE, GATE, WF].sort();

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_b_sflux_source_spatial_governance_result_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  runtime_contract_delta_count: 0,
  canonical_contract_delta_count: 0,
  migration_delta_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  future_et0_execution_count: 0,
  formal_window_started: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA1OB_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA1OB_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, TASK) === '3e6bc630540108599771e5404c457eaee14946aa', 'EA1OB_TASKBOOK_V03_BASE_BLOB_DRIFT');
  req(blob(BASE, A2) === '3ec68f7a33274ff96c5f613154b4357d2b057fd1', 'EA1OB_AMENDMENT02_BASE_BLOB_DRIFT');
  req(blob(BASE, K) === 'f36955b2847d1a2b58052f0dec2fea465e7eaec2', 'EA1OB_EA1K_BASE_BLOB_DRIFT');
  req(blob(BASE, M) === 'bb487c0c6a91dd37b0409b5d446aec4707f7b0a4', 'EA1OB_EA1M_BASE_BLOB_DRIFT');
  req(blob(BASE, N) === '607af693cd2f7d8d80e18d5308c16e128d397e44', 'EA1OB_EA1N_BASE_BLOB_DRIFT');

  const authority = JSON.parse(read(AUTH));
  const probe = read(PROBE);
  const workflow = read(WF);
  req(authority.record_status === 'EA1O_B_SFLUX_SOURCE_SPATIAL_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE', 'EA1OB_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA1OB_AUTHORITY_BASE_SHA_DRIFT');
  req(authority.source_candidate.product_family === 'sflux', 'EA1OB_PRODUCT_FAMILY_DRIFT');
  req(authority.source_candidate.candidate_parameter === 'DSWRF' && authority.source_candidate.candidate_level === 'surface', 'EA1OB_SOURCE_ROLE_DRIFT');
  req(authority.source_candidate.required_statistical_semantics === 'DIRECT_PRECEDING_ONE_HOUR_AVERAGE', 'EA1OB_TEMPORAL_SEMANTICS_DRIFT');
  req(authority.source_candidate.canonical_point_count === 72, 'EA1OB_72_POINT_RULE_DRIFT');
  req(authority.source_candidate.same_exact_gfs_cycle_as_ea1k_required === true, 'EA1OB_SAME_CYCLE_RULE_WEAKENED');
  req(authority.source_candidate.future_file_waiting_forbidden === true && authority.source_candidate.valid_time_rewrite_forbidden === true, 'EA1OB_CHRONOLOGY_RULE_WEAKENED');

  const transport = authority.transport_and_decoder;
  req(transport.transport === 'PRODUCTION_HTTPS_IDX_PLUS_EXACT_GRIB_MESSAGE_BYTE_RANGE', 'EA1OB_TRANSPORT_DRIFT');
  req(transport.full_global_grib_download_forbidden === true && transport.range_must_resolve_exact_idx_message === true, 'EA1OB_FULL_GRIB_DOWNLOAD_ENABLED');
  req(transport.eccodes === '2.47.0' && transport.eccodeslib === '2.47.3.23', 'EA1OB_DECODER_PIN_DRIFT');

  const spatial = authority.sflux_spatial_policy;
  req(spatial.grid_definition_source === 'LIVE_PRODUCTION_SFLUX_GRIB_MESSAGE_ONLY', 'EA1OB_LIVE_GRID_SOURCE_REQUIRED');
  req(spatial.predeclared_numeric_grid_forbidden === true && spatial.silent_pgrb2_sflux_grid_equivalence_forbidden === true, 'EA1OB_SILENT_GRID_EQUIVALENCE_ENABLED');
  req(spatial.interpolation_method === 'NONE_NEAREST_NATIVE_GRID_POINT' && spatial.interpolation_authorized === false, 'EA1OB_INTERPOLATION_ENABLED');
  req(spatial.direct_field_equivalence === false && spatial.model_grid_is_observation_truth === false, 'EA1OB_FIELD_TRUTH_UPGRADE');

  const valuePolicy = authority.value_sanity_policy;
  req(valuePolicy.all_72_messages_must_decode && valuePolicy.all_72_selected_point_values_must_be_finite && valuePolicy.all_72_selected_point_values_must_be_nonnegative, 'EA1OB_VALUE_SANITY_WEAKENED');
  req(valuePolicy.negative_clipping_forbidden && valuePolicy.zero_thresholding_forbidden && valuePolicy.silent_imputation_forbidden, 'EA1OB_VALUE_INFERENCE_RULE_ENABLED');
  req(valuePolicy.decoded_values_may_be_emitted === false, 'EA1OB_VALUE_PUBLICATION_ENABLED');

  const effect = authority.qualification_effect;
  req(effect.future_et0_execution_authorized === false, 'EA1OB_FUTURE_ET0_EXECUTION_ENABLED');
  req(effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.runtime_source_authorized === false, 'EA1OB_WRITE_OR_RUNTIME_AUTHORITY_ENABLED');
  req(effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA1OB_FORMAL_OR_COMPLETION_CLAIM_ENABLED');

  req(probe.includes('MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY_RESULT.json'), 'EA1OB_EA1K_LIVE_RESULT_NOT_CONSUMED');
  req(probe.includes('Range') && probe.includes('bytes=') && probe.includes('index_object_suffix') && probe.includes('Content-Range'), 'EA1OB_EXACT_RANGE_TRANSPORT_MISSING');
  req(probe.includes('codes_grib_find_nearest') && probe.includes('grid_definition'), 'EA1OB_ECCODES_SPATIAL_PARSE_MISSING');
  req(probe.includes('DIRECT_PRECEDING_ONE_HOUR_AVERAGE') && probe.includes('hour ave fcst'), 'EA1OB_DIRECT_1H_RECORD_SELECTION_MISSING');
  req(probe.includes('NEGATIVE_DSWRF_FAIL_CLOSED'), 'EA1OB_NEGATIVE_FAIL_CLOSED_MISSING');
  req(!/max\s*\(\s*0\s*,|abs\s*\(.*value|value\s*=\s*0(?:\.0)?\b/.test(probe), 'EA1OB_CLIPPING_OR_ZERO_SUBSTITUTION_PATTERN');
  req(probe.includes('decoded_values_emitted') && probe.includes('normalized_value_sequence_sha256'), 'EA1OB_HASH_ONLY_VALUE_BOUNDARY_MISSING');

  req(workflow.includes('PROBE_MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY.mjs'), 'EA1OB_EA1K_WORKFLOW_STEP_MISSING');
  req(workflow.includes('eccodes==2.47.0') && workflow.includes('eccodeslib==2.47.3.23'), 'EA1OB_WORKFLOW_DECODER_PIN_MISSING');
  req(workflow.includes('python -m eccodes selfcheck'), 'EA1OB_ECCODES_SELFCHECK_MISSING');
  req(workflow.includes('persist-credentials: false'), 'EA1OB_PERSIST_CREDENTIALS_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(workflow + '\n' + probe), 'EA1OB_DATABASE_OR_FORMAL_INGRESS_PRESENT');

  Object.assign(result, {
    authority_blob: blob('HEAD', AUTH),
    probe_blob: blob('HEAD', PROBE),
    source_product: authority.source_candidate.product_family,
    source_parameter: authority.source_candidate.candidate_parameter,
    live_qualification_required: true,
    taskbook_changed: false,
    runtime_source_changed: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    future_et0_execution_count: 0,
    formal_window_started: false,
    status: 'PASS',
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
if (result.status === 'PASS') console.log(JSON.stringify(result));
else console.error(result.error);
