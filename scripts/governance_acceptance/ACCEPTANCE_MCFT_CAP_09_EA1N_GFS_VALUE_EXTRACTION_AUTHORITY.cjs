'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const AUTHORITY_PATH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1N-GFS-VALUE-EXTRACTION-AUTHORITY-V1.json';
const PROBE_PATH = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1N_GFS_VALUE_EXTRACTION_AUTHORITY.py';
const GATE_PATH = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1N_GFS_VALUE_EXTRACTION_AUTHORITY.cjs';
const WORKFLOW_PATH = '.github/workflows/mcft-cap-09-ea1n-gfs-value-extraction-authority.yml';
const OUTPUT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1N_GFS_VALUE_EXTRACTION_AUTHORITY_GOVERNANCE_RESULT.json');
const EXPECTED_FILES = [AUTHORITY_PATH, PROBE_PATH, GATE_PATH, WORKFLOW_PATH].sort();

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function fail(message) { throw new Error(message); }
function requireTrue(value, message) { if (!value) fail(message); }
function blobAt(ref, file) { return git(['rev-parse', `${ref}:${file}`]); }

const result = {
  schema_version: 'geox_mcft_cap09_ea1n_gfs_value_extraction_governance_result_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  runtime_product_source_delta_count: 0,
  migration_delta_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  canonical_evidence_delta_count: 0,
  formal_window_started: false,
};

try {
  requireTrue(BASE, 'MCFT_BASE_SHA_REQUIRED');
  const authority = JSON.parse(fs.readFileSync(path.join(ROOT, AUTHORITY_PATH), 'utf8'));
  const probe = fs.readFileSync(path.join(ROOT, PROBE_PATH), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW_PATH), 'utf8');

  requireTrue(authority.base_main_sha === BASE, `BASE_SHA_MISMATCH:${authority.base_main_sha}:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.exact_file_count = changed.length;
  result.changed_files = changed;
  requireTrue(JSON.stringify(changed) === JSON.stringify(EXPECTED_FILES), `EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  const expectedPredecessors = new Map([
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md', '41270b888e15e4d9a6c9a34e1fa3f70e957a275e'],
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json', 'f36955b2847d1a2b58052f0dec2fea465e7eaec2'],
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json', 'af5f23425e35dd21a949727f508934f1be14d8e9'],
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json', 'bb487c0c6a91dd37b0409b5d446aec4707f7b0a4'],
  ]);
  for (const [file, expectedBlob] of expectedPredecessors) {
    const actual = blobAt(BASE, file);
    requireTrue(actual === expectedBlob, `PREDECESSOR_BLOB_DRIFT:${file}:${actual}:${expectedBlob}`);
  }

  requireTrue(authority.record_status === 'EA1N_GFS_VALUE_EXTRACTION_PROBE_NOT_FORMAL_AUTHORITY', 'AUTHORITY_STATUS_DRIFT');
  requireTrue(authority.decoder_supply_chain.python_version === '3.12', 'PYTHON_VERSION_NOT_PINNED');
  requireTrue(authority.decoder_supply_chain.eccodes_python_package === 'eccodes==2.47.0', 'ECCODES_VERSION_NOT_PINNED');
  requireTrue(authority.decoder_supply_chain.eccodes_binary_package === 'eccodeslib==2.47.3.23', 'ECCODESLIB_VERSION_NOT_PINNED');
  requireTrue(authority.provider_transport.grib_filter_role === 'TRANSIENT_VALUE_SUBSET_TRANSPORT_ONLY', 'GRIB_FILTER_AUTHORITY_ROLE_DRIFT');
  requireTrue(authority.provider_transport.grib_filter_response_may_not_replace_source_availability_chronology === true, 'FILTER_RESPONSE_ILLEGALLY_PROMOTED_TO_AVAILABILITY_AUTHORITY');
  requireTrue(authority.spatial_binding.selected_public_gfs_grid_latitude === 42.5, 'GRID_LAT_DRIFT');
  requireTrue(authority.spatial_binding.selected_public_gfs_native_longitude === 274.75, 'GRID_LON_DRIFT');
  requireTrue(authority.spatial_binding.interpolation_method === 'NONE_NEAREST_GRID_POINT', 'INTERPOLATION_POLICY_DRIFT');
  requireTrue(authority.tick_cycle_and_lead_policy.canonical_point_count === 72, 'FORECAST_POINT_COUNT_DRIFT');
  requireTrue(authority.tick_cycle_and_lead_policy.wait_for_future_files === false, 'FUTURE_FILE_WAITING_ENABLED');
  requireTrue(authority.tick_cycle_and_lead_policy.valid_time_rewrite === false, 'VALID_TIME_REWRITE_ENABLED');

  const correction = authority.value_level_precipitation_correction;
  requireTrue(correction.trigger_run_id === 31253728831, 'PRATE_REJECTION_TRIGGER_RUN_DRIFT');
  requireTrue(correction.trigger_subject_sha === 'f299085875d277c15d8ae38d382b25378104e881', 'PRATE_REJECTION_SUBJECT_DRIFT');
  requireTrue(correction.trigger_error === 'DERIVED_PRECIP_SANITY_FAIL_NO_CLIP:F006', 'PRATE_REJECTION_ERROR_DRIFT');
  requireTrue(correction.negative_value_clipping_performed === false, 'PRATE_NEGATIVE_VALUE_WAS_CLIPPED');
  requireTrue(correction.replacement_candidate === 'APCP_EXACT_ONE_HOUR_ACCUMULATION', 'APCP_CORRECTION_CANDIDATE_DRIFT');
  requireTrue(correction.missing_exact_hour_record === 'FAIL_CLOSED', 'APCP_MISSING_RECORD_NOT_FAIL_CLOSED');
  requireTrue(correction.duplicate_exact_hour_record === 'FAIL_CLOSED', 'APCP_DUPLICATE_RECORD_NOT_FAIL_CLOSED');
  requireTrue(correction.fallback_to_prate === false, 'PRATE_FALLBACK_ENABLED');
  requireTrue(correction.fallback_to_multi_hour_apcp_difference === false, 'MULTIHOUR_APCP_FALLBACK_ENABLED');
  requireTrue(correction.epsilon_or_negative_clipping === false, 'PRECIPITATION_EPSILON_CLIPPING_ENABLED');

  requireTrue(authority.decoded_message_reconciliation.exact_hour_accumulation_role === 'TOTAL_PRECIPITATION_SURFACE', 'APCP_ROLE_DRIFT');
  requireTrue(authority.decoded_message_reconciliation.exact_hour_accumulation_step_type_required === 'accum', 'APCP_STEP_TYPE_DRIFT');
  requireTrue(authority.decoded_message_reconciliation.exact_hour_accumulation_start_rule === 'startStep=lead-1', 'APCP_START_RULE_DRIFT');
  requireTrue(authority.decoded_message_reconciliation.exact_hour_accumulation_end_rule === 'endStep=lead', 'APCP_END_RULE_DRIFT');
  requireTrue(authority.decoded_message_reconciliation.exact_hour_accumulation_required_target_count === 72, 'APCP_COVERAGE_COUNT_DRIFT');
  requireTrue(authority.normalization.precipitation_source === 'APCP_EXACT_ONE_HOUR_ACCUMULATION', 'PRECIPITATION_SOURCE_NOT_APCP_EXACT_HOUR');
  requireTrue(authority.normalization.prate_rolling_used_for_precipitation === false, 'PRATE_ROLLING_STILL_SELECTED');
  requireTrue(authority.normalization.cross_block_differencing === false, 'CROSS_BLOCK_DIFFERENCING_ENABLED');
  requireTrue(authority.normalization.missing_predecessor_imputation === false, 'MISSING_PREDECESSOR_IMPUTATION_ENABLED');
  requireTrue(authority.normalization.negative_derived_value_clipping === false, 'NEGATIVE_DERIVED_VALUE_CLIPPING_ENABLED');

  requireTrue(authority.qualification_effect.future_weather_canonical_evidence_created === false, 'CANONICAL_FUTURE_WEATHER_CREATED_TOO_EARLY');
  requireTrue(authority.qualification_effect.future_et0_calculated === false, 'FUTURE_ET0_EXECUTED_TOO_EARLY');
  requireTrue(authority.qualification_effect.database_write_authorized === false, 'DATABASE_WRITE_AUTHORIZED');
  requireTrue(authority.qualification_effect.formal_evidence_write_authorized === false, 'FORMAL_WRITE_AUTHORIZED');
  requireTrue(authority.qualification_effect.runtime_source_authorized === false, 'RUNTIME_SOURCE_AUTHORIZED');
  requireTrue(authority.qualification_effect.formal_window_started === false, 'FORMAL_WINDOW_STARTED');

  requireTrue(probe.includes('GRID_LAT = 42.5'), 'PROBE_GRID_LAT_MARKER_MISSING');
  requireTrue(probe.includes('GRID_LON_NATIVE = 274.75'), 'PROBE_GRID_LON_MARKER_MISSING');
  requireTrue(probe.includes('("var_APCP", "on")'), 'PROBE_APCP_FILTER_MISSING');
  requireTrue(!probe.includes('("var_PRATE", "on")'), 'PROBE_PRATE_FILTER_MUST_BE_REMOVED_AFTER_VALUE_REJECTION');
  requireTrue(probe.includes('APCP_EXACT_1H_RECORD_NOT_UNIQUE'), 'PROBE_APCP_EXACT_HOUR_UNIQUENESS_GATE_MISSING');
  requireTrue(probe.includes('APCP_EXACT_1H_72_OF_72_REQUIRED'), 'PROBE_APCP_72_OF_72_GATE_MISSING');
  requireTrue(probe.includes('r["start_step"] == lead - 1'), 'PROBE_APCP_START_STEP_GATE_MISSING');
  requireTrue(probe.includes('r["end_step"] == lead'), 'PROBE_APCP_END_STEP_GATE_MISSING');
  requireTrue(probe.includes('SOURCE_OBJECT_AFTER_TICK'), 'PROBE_PRIOR_AVAILABILITY_GATE_MISSING');
  requireTrue(probe.includes('FILTER_RESPONSE_NOT_GRIB'), 'PROBE_GRIB_FILTER_VALIDATION_MISSING');
  requireTrue(probe.includes('CROSS_BLOCK_DIFFERENCE_FORBIDDEN'), 'PROBE_DSWRF_CROSS_BLOCK_FAIL_CLOSED_MISSING');
  requireTrue(probe.includes('DERIVED_PRECIP_SANITY_FAIL_NO_CLIP'), 'PROBE_NO_CLIP_PRECIP_GATE_MISSING');
  requireTrue(probe.includes('DERIVED_DSWRF_SANITY_FAIL_NO_CLIP'), 'PROBE_NO_CLIP_SOLAR_GATE_MISSING');
  requireTrue(!/psycopg|postgresql:\/\/|PGHOST|DATABASE_URL/i.test(probe), 'PROBE_DATABASE_ACCESS_SURFACE_DETECTED');
  requireTrue(!/lter\.kbs\.msu\.edu|enviroweather\.msu\.edu/i.test(probe), 'EA1N_MUST_NOT_READ_KBS_SOURCE');
  requireTrue(!/future_weather_assumption_v1|future_et0_assumption_v1/.test(probe), 'PROBE_CANONICAL_EVIDENCE_SURFACE_DETECTED');
  requireTrue(!/max\s*\(\s*0(?:\.0)?\s*,\s*precip/i.test(probe), 'PROBE_PRECIPITATION_CLIPPING_PATTERN_DETECTED');

  requireTrue(workflow.includes('python-version: \'3.12\''), 'WORKFLOW_PYTHON_VERSION_NOT_PINNED');
  requireTrue(workflow.includes('eccodes==2.47.0'), 'WORKFLOW_ECCODES_VERSION_NOT_PINNED');
  requireTrue(workflow.includes('eccodeslib==2.47.3.23'), 'WORKFLOW_ECCODESLIB_VERSION_NOT_PINNED');
  requireTrue(workflow.includes('python -m eccodes selfcheck'), 'WORKFLOW_ECCODES_SELFCHECK_MISSING');
  requireTrue(workflow.includes('persist-credentials: false'), 'WORKFLOW_CHECKOUT_CREDENTIALS_NOT_DISABLED');

  result.predecessor_blobs = Object.fromEntries(expectedPredecessors);
  result.pinned_decoder = { python: '3.12', eccodes: '2.47.0', eccodeslib: '2.47.3.23' };
  result.precipitation_correction = {
    rejected: 'PRATE_ROLLING_AFTER_VALUE_LEVEL_NEGATIVE_F006',
    candidate: 'APCP_EXACT_ONE_HOUR_ACCUMULATION',
    required_target_count: 72,
    no_fallback: true,
  };
  result.selected_public_gfs_grid = { latitude: 42.5, native_longitude: 274.75, signed_longitude: -85.25 };
  result.status = 'PASS';
} catch (err) {
  result.error = `${err.name || 'Error'}:${err.message || String(err)}`;
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');
  console.error(result.error);
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');
if (result.status === 'PASS') {
  console.log(JSON.stringify({
    status: result.status,
    base_sha: BASE,
    exact_file_count: result.exact_file_count,
    pinned_decoder: result.pinned_decoder,
    precipitation_correction: result.precipitation_correction,
  }));
}
