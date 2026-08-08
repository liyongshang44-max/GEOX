'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '75db3b0d1baece194018e346f7d1756f1ee77e7f';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A3 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-03-GFS-SFLUX-EXPANDING-AVERAGE-RECONSTRUCTION-AUTHORITY.md';
const A3_STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-SFLUX-RECONSTRUCTION-AMENDMENT-STATUS-V1.json';
const B = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-B-SFLUX-SOURCE-SPATIAL-QUALIFICATION-V1.json';
const K = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json';
const M = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json';
const N = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json';
const AUTH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-C-SFLUX-RECONSTRUCTION-SPATIAL-QUALIFICATION-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1O_C_SFLUX_RECONSTRUCTION_SPATIAL_QUALIFICATION.py';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1O_C_SFLUX_RECONSTRUCTION_SPATIAL_QUALIFICATION.cjs';
const WF = '.github/workflows/mcft-cap-09-ea1o-c-sflux-reconstruction-spatial-qualification.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1O_C_SFLUX_RECONSTRUCTION_SPATIAL_QUALIFICATION_GOVERNANCE_RESULT.json');
const EXPECT = [AUTH, PROBE, GATE, WF].sort();

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_c_sflux_reconstruction_governance_result_v1',
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
  req(BASE === EXPECTED_BASE, `EA1OC_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA1OC_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, TASK) === 'd7ff8d7164d4f2a9f1c3edcaafcf30eeeb181f0d', 'EA1OC_TASKBOOK_V04_BASE_BLOB_DRIFT');
  req(blob(BASE, A3) === '44e2edbf7bf4a6ebbf863cd5b94f763b26d92850', 'EA1OC_AMENDMENT03_BASE_BLOB_DRIFT');
  req(blob(BASE, A3_STATUS) === '0693777ff6396a670309d7c1a10b4ee10c91e775', 'EA1OC_AMENDMENT03_STATUS_BASE_BLOB_DRIFT');
  req(blob(BASE, B) === 'cd817199ed16ce429cf99743ffebcaf7fe562053', 'EA1OC_EA1OB_BASE_BLOB_DRIFT');
  req(blob(BASE, K) === 'f36955b2847d1a2b58052f0dec2fea465e7eaec2', 'EA1OC_EA1K_BASE_BLOB_DRIFT');
  req(blob(BASE, M) === 'bb487c0c6a91dd37b0409b5d446aec4707f7b0a4', 'EA1OC_EA1M_BASE_BLOB_DRIFT');
  req(blob(BASE, N) === '607af693cd2f7d8d80e18d5308c16e128d397e44', 'EA1OC_EA1N_BASE_BLOB_DRIFT');

  const authority = JSON.parse(read(AUTH));
  const probe = read(PROBE);
  const workflow = read(WF);

  req(authority.record_status === 'EA1O_C_LIVE_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE', 'EA1OC_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA1OC_AUTHORITY_BASE_SHA_DRIFT');
  req(authority.source_candidate.product_family === 'sflux', 'EA1OC_PRODUCT_FAMILY_DRIFT');
  req(authority.source_candidate.parameter === 'DSWRF' && authority.source_candidate.level === 'surface', 'EA1OC_SOURCE_ROLE_DRIFT');
  req(authority.source_candidate.required_record_semantics === 'SIX_HOUR_BLOCK_EXPANDING_AVERAGE', 'EA1OC_SOURCE_SEMANTICS_DRIFT');
  req(authority.source_candidate.same_exact_gfs_cycle_as_ea1k_required === true, 'EA1OC_SAME_CYCLE_WEAKENED');
  req(authority.source_candidate.canonical_target_count === 72 && authority.source_candidate.support_lead_maximum_count === 1, 'EA1OC_TARGET_SUPPORT_COUNT_DRIFT');
  req(authority.source_candidate.future_file_waiting_forbidden === true && authority.source_candidate.valid_time_rewrite_forbidden === true, 'EA1OC_CHRONOLOGY_WEAKENED');
  req(authority.source_candidate.n_hour_fcst_record_authorized === false, 'EA1OC_N_HOUR_FCST_ENABLED');
  req(authority.source_candidate.full_global_grib_download_authorized === false && authority.source_candidate.range_message_retrieval_required === true, 'EA1OC_RANGE_BOUNDARY_WEAKENED');

  const reconstruction = authority.reconstruction_candidate;
  req(reconstruction.block_size_hours === 6, 'EA1OC_BLOCK_SIZE_DRIFT');
  req(reconstruction.block_start_formula === 'b=6*floor((f-1)/6)', 'EA1OC_BLOCK_START_FORMULA_DRIFT');
  req(reconstruction.block_first_hour_formula === 'H_f=A_f', 'EA1OC_FIRST_HOUR_FORMULA_DRIFT');
  req(reconstruction.within_block_formula === 'H_f=n*A_f-(n-1)*A_(f-1)', 'EA1OC_WEIGHTED_DIFFERENCE_FORMULA_DRIFT');
  req(reconstruction.cross_block_reconstruction_authorized === false && reconstruction.cross_cycle_reconstruction_authorized === false, 'EA1OC_CROSS_BOUNDARY_RECONSTRUCTION_ENABLED');
  req(reconstruction.pgrb2_dswrf_fallback_authorized === false, 'EA1OC_PGRB2_FALLBACK_ENABLED');
  req(reconstruction.negative_clipping_authorized === false && reconstruction.zero_thresholding_authorized === false && reconstruction.silent_imputation_authorized === false, 'EA1OC_VALUE_REPAIR_ENABLED');

  const packing = authority.packing_quantization;
  req(packing.physical_quantum_formula === 'q=2^binaryScaleFactor*10^(-decimalScaleFactor)', 'EA1OC_QUANTUM_FORMULA_DRIFT');
  req(packing.half_quantum_formula === 'epsilon=q/2', 'EA1OC_HALF_QUANTUM_FORMULA_DRIFT');
  req(packing.reconstructed_bound_formula === 'epsilon_H=n*epsilon_f+(n-1)*epsilon_(f-1)', 'EA1OC_PROPAGATED_BOUND_FORMULA_DRIFT');
  req(packing.bound_is_diagnostic_only === true && packing.bound_may_repair_negative === false, 'EA1OC_QUANTIZATION_REPAIR_ENABLED');
  req(packing.nonfinite_reconstructed_value === 'FAIL_CLOSED' && packing.negative_reconstructed_value === 'FAIL_CLOSED', 'EA1OC_VALUE_FAIL_CLOSED_WEAKENED');

  const spatial = authority.spatial_candidate;
  req(spatial.authority_source === 'LIVE_SFLUX_GRIB_GEOMETRY', 'EA1OC_SPATIAL_SOURCE_DRIFT');
  req(spatial.selection_method === 'ECCODES_NEAREST_NATIVE_GRID_POINT', 'EA1OC_SPATIAL_SELECTION_DRIFT');
  req(spatial.silent_pgrb2_grid_reuse_authorized === false && spatial.interpolation_authorized === false, 'EA1OC_SPATIAL_SHORTCUT_ENABLED');
  req(spatial.direct_field_equivalence === false && spatial.model_grid_is_observation_truth === false, 'EA1OC_FIELD_TRUTH_UPGRADE');

  req(probe.includes('MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY_RESULT.json'), 'EA1OC_PROBE_MUST_CONSUME_EA1K_RESULT');
  req(probe.includes('block_start(lead)') && probe.includes('n * current["value"] - (n - 1) * predecessor["value"]'), 'EA1OC_PROBE_RECONSTRUCTION_FORMULA_MISSING');
  req(probe.includes('binaryScaleFactor') && probe.includes('decimalScaleFactor') && probe.includes('math.ldexp'), 'EA1OC_PACKING_QUANTUM_IMPLEMENTATION_MISSING');
  req(probe.includes('codes_grib_find_nearest'), 'EA1OC_NATIVE_NEAREST_IMPLEMENTATION_MISSING');
  req(probe.includes('Range') && probe.includes('Content-Range'), 'EA1OC_EXACT_RANGE_TRANSPORT_MISSING');
  req(probe.includes('negative_clipping_performed') && probe.includes('zero_thresholding_performed') && probe.includes('silent_imputation_performed'), 'EA1OC_NON_REPAIR_ATTESTATION_MISSING');
  req(!/max\s*\(\s*0\s*,|np\.clip|numpy\.clip/.test(probe), 'EA1OC_CLIPPING_PATTERN_FORBIDDEN');

  const effect = authority.qualification_effect;
  req(effect.future_et0_execution_authorized === false && effect.ea2_authorized === false, 'EA1OC_SUCCESSOR_PREMATURE');
  req(effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.runtime_source_authorized === false, 'EA1OC_WRITE_OR_RUNTIME_AUTHORITY_ENABLED');
  req(effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA1OC_FORMAL_OR_COMPLETION_CLAIM_ENABLED');

  req(workflow.includes('PROBE_MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY.mjs'), 'EA1OC_WORKFLOW_EA1K_STEP_MISSING');
  req(workflow.includes('eccodes==2.47.0') && workflow.includes('eccodeslib==2.47.3.23'), 'EA1OC_PINNED_DECODER_MISSING');
  req(workflow.includes('PROBE_MCFT_CAP_09_EA1O_C_SFLUX_RECONSTRUCTION_SPATIAL_QUALIFICATION.py'), 'EA1OC_WORKFLOW_LIVE_PROBE_MISSING');
  req(workflow.includes('persist-credentials: false'), 'EA1OC_PERSIST_CREDENTIALS_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(workflow + '\n' + probe), 'EA1OC_DATABASE_PATH_PRESENT');

  Object.assign(result, {
    authority_blob: blob('HEAD', AUTH),
    probe_blob: blob('HEAD', PROBE),
    source_product: authority.source_candidate.product_family,
    source_parameter: authority.source_candidate.parameter,
    reconstruction_algorithm: 'SIX_HOUR_BLOCK_EXPANDING_AVERAGE_WEIGHTED_DIFFERENCE',
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
