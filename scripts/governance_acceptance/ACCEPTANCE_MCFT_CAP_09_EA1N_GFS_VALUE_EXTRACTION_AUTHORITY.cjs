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

function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function fail(message) { throw new Error(message); }
function requireTrue(value, message) { if (!value) fail(message); }
function blobAt(ref, file) { return git(['rev-parse', `${ref}:${file}`]); }

const result = {
  schema_version: 'geox_mcft_cap09_ea1n_gfs_value_extraction_governance_result_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  runtime_product_source_delta_count: 0, migration_delta_count: 0, database_write_count: 0,
  formal_evidence_write_count: 0, canonical_evidence_delta_count: 0, formal_window_started: false,
};

try {
  requireTrue(BASE, 'MCFT_BASE_SHA_REQUIRED');
  const authority = JSON.parse(fs.readFileSync(path.join(ROOT, AUTHORITY_PATH), 'utf8'));
  const probe = fs.readFileSync(path.join(ROOT, PROBE_PATH), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW_PATH), 'utf8');

  requireTrue(authority.base_main_sha === BASE, `BASE_SHA_MISMATCH:${authority.base_main_sha}:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.exact_file_count = changed.length; result.changed_files = changed;
  requireTrue(JSON.stringify(changed) === JSON.stringify(EXPECTED_FILES), `EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  const expectedPredecessors = new Map([
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md','41270b888e15e4d9a6c9a34e1fa3f70e957a275e'],
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json','f36955b2847d1a2b58052f0dec2fea465e7eaec2'],
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json','af5f23425e35dd21a949727f508934f1be14d8e9'],
    ['docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json','bb487c0c6a91dd37b0409b5d446aec4707f7b0a4'],
  ]);
  for (const [file, expected] of expectedPredecessors) {
    const actual = blobAt(BASE, file);
    requireTrue(actual === expected, `PREDECESSOR_BLOB_DRIFT:${file}:${actual}:${expected}`);
  }

  requireTrue(authority.record_status === 'EA1N_GFS_VALUE_EXTRACTION_PROBE_NOT_FORMAL_AUTHORITY', 'AUTHORITY_STATUS_DRIFT');
  requireTrue(authority.decoder_supply_chain.python_version === '3.12', 'PYTHON_VERSION_NOT_PINNED');
  requireTrue(authority.decoder_supply_chain.eccodes_python_package === 'eccodes==2.47.0', 'ECCODES_VERSION_NOT_PINNED');
  requireTrue(authority.decoder_supply_chain.eccodes_binary_package === 'eccodeslib==2.47.3.23', 'ECCODESLIB_VERSION_NOT_PINNED');
  requireTrue(authority.provider_transport.grib_filter_role === 'TRANSIENT_VALUE_SUBSET_TRANSPORT_ONLY', 'FILTER_ROLE_DRIFT');
  requireTrue(authority.provider_transport.grib_filter_response_may_not_replace_source_availability_chronology === true, 'FILTER_ILLEGALLY_PROMOTED_TO_AVAILABILITY_AUTHORITY');
  requireTrue(authority.spatial_binding.selected_public_gfs_grid_latitude === 42.5, 'GRID_LAT_DRIFT');
  requireTrue(authority.spatial_binding.selected_public_gfs_native_longitude === 274.75, 'GRID_LON_DRIFT');
  requireTrue(authority.spatial_binding.interpolation_method === 'NONE_NEAREST_GRID_POINT', 'INTERPOLATION_POLICY_DRIFT');
  requireTrue(authority.tick_cycle_and_lead_policy.canonical_point_count === 72, 'POINT_COUNT_DRIFT');
  requireTrue(authority.tick_cycle_and_lead_policy.wait_for_future_files === false, 'WAIT_FOR_FUTURE_FILES_ENABLED');
  requireTrue(authority.tick_cycle_and_lead_policy.valid_time_rewrite === false, 'VALID_TIME_REWRITE_ENABLED');

  const adjudication = authority.value_level_precipitation_adjudication;
  requireTrue(Array.isArray(adjudication.rejected_candidates) && adjudication.rejected_candidates.length === 2, 'PRECIP_REJECTION_CHAIN_INCOMPLETE');
  const prate = adjudication.rejected_candidates.find(x => x.candidate === 'PRATE_SIX_HOUR_ROLLING_AVERAGE_DIFFERENCE');
  const exact = adjudication.rejected_candidates.find(x => x.candidate === 'APCP_EXACT_ONE_HOUR_ACCUMULATION_ONLY');
  requireTrue(prate && prate.run_id === 31253728831 && prate.failure === 'DERIVED_PRECIP_SANITY_FAIL_NO_CLIP:F006', 'PRATE_VALUE_REJECTION_DRIFT');
  requireTrue(exact && exact.run_id === 31254027979 && exact.failure === 'APCP_EXACT_1H_72_OF_72_REQUIRED:F006:COUNT=0', 'APCP_EXACT_HOUR_REJECTION_DRIFT');
  requireTrue(exact.coverage.unique_exact_1h_count === 12 && exact.coverage.missing_exact_1h_count === 60 && exact.coverage.ambiguous_exact_1h_count === 0, 'APCP_EXACT_HOUR_COVERAGE_DRIFT');
  requireTrue(adjudication.current_candidate === 'APCP_SIX_HOUR_BLOCK_CUMULATIVE_DIFFERENCE', 'CURRENT_PRECIP_CANDIDATE_DRIFT');
  requireTrue(adjudication.block_start_rule === 'S=6*floor((lead-1)/6)', 'APCP_BLOCK_START_RULE_DRIFT');
  requireTrue(adjudication.required_target_coverage === 72, 'APCP_BLOCK_COVERAGE_DRIFT');
  requireTrue(adjudication.cross_block_difference === false, 'APCP_CROSS_BLOCK_DIFFERENCE_ENABLED');
  requireTrue(adjudication.negative_difference === 'FAIL_CLOSED_NO_CLIP', 'APCP_NEGATIVE_DIFFERENCE_NOT_FAIL_CLOSED');
  requireTrue(adjudication.fallback_to_prate === false && adjudication.fallback_to_exact_hour_only === false && adjudication.fallback_to_other_apcp_family === false, 'PRECIP_FALLBACK_ENABLED');

  requireTrue(authority.normalization.precipitation_source === 'APCP_SIX_HOUR_BLOCK_CUMULATIVE_DIFFERENCE', 'NORMALIZATION_PRECIP_SOURCE_DRIFT');
  requireTrue(authority.normalization.precip_when_L_gt_1 === 'mm_per_hour=APCP(S,E)-APCP(S,E-1)', 'APCP_DIFFERENCE_FORMULA_DRIFT');
  requireTrue(authority.normalization.cross_block_differencing === false, 'NORMALIZATION_CROSS_BLOCK_ENABLED');
  requireTrue(authority.normalization.missing_predecessor_imputation === false, 'MISSING_PREDECESSOR_IMPUTATION_ENABLED');
  requireTrue(authority.normalization.negative_derived_value_clipping === false, 'NEGATIVE_CLIPPING_ENABLED');
  requireTrue(authority.normalization.prate_used_for_precipitation === false, 'PRATE_STILL_SELECTED');

  requireTrue(probe.includes('("var_APCP", "on")'), 'PROBE_APCP_FILTER_MISSING');
  requireTrue(!probe.includes('("var_PRATE", "on")'), 'PROBE_PRATE_FILTER_PRESENT');
  requireTrue(probe.includes('APCP_BLOCK_72_OF_72_REQUIRED'), 'PROBE_APCP_BLOCK_72_GATE_MISSING');
  requireTrue(probe.includes('r["start_step"] == start'), 'PROBE_APCP_SAME_START_GATE_MISSING');
  requireTrue(probe.includes('precip_mm = apcp["value"] - apcp_prev["value"]'), 'PROBE_APCP_CUMULATIVE_DIFFERENCE_MISSING');
  requireTrue(probe.includes('APCP_BLOCK_MONOTONICITY_OR_HOURLY_SANITY_FAIL_NO_CLIP'), 'PROBE_APCP_MONOTONICITY_GATE_MISSING');
  requireTrue(probe.includes('CROSS_BLOCK_DIFFERENCE_FORBIDDEN'), 'PROBE_CROSS_BLOCK_FAIL_GATE_MISSING');
  requireTrue(probe.includes('DERIVED_DSWRF_SANITY_FAIL_NO_CLIP'), 'PROBE_DSWRF_NO_CLIP_GATE_MISSING');
  requireTrue(probe.includes('SOURCE_OBJECT_AFTER_TICK'), 'PROBE_PRIOR_AVAILABILITY_GATE_MISSING');
  requireTrue(probe.includes('FILTER_RESPONSE_NOT_GRIB'), 'PROBE_FILTER_GRIB_VALIDATION_MISSING');
  requireTrue(!/psycopg|postgresql:\/\/|PGHOST|DATABASE_URL/i.test(probe), 'PROBE_DATABASE_SURFACE_DETECTED');
  requireTrue(!/lter\.kbs\.msu\.edu|enviroweather\.msu\.edu/i.test(probe), 'EA1N_KBS_READ_DETECTED');
  requireTrue(!/future_weather_assumption_v1|future_et0_assumption_v1/.test(probe), 'CANONICAL_EVIDENCE_SURFACE_DETECTED');
  requireTrue(!/max\s*\(\s*0(?:\.0)?\s*,\s*precip/i.test(probe), 'PRECIP_CLIPPING_PATTERN_DETECTED');

  requireTrue(workflow.includes("python-version: '3.12'"), 'WORKFLOW_PYTHON_NOT_PINNED');
  requireTrue(workflow.includes('eccodes==2.47.0') && workflow.includes('eccodeslib==2.47.3.23'), 'WORKFLOW_DECODER_NOT_PINNED');
  requireTrue(workflow.includes('python -m eccodes selfcheck'), 'WORKFLOW_SELFCHECK_MISSING');
  requireTrue(workflow.includes('persist-credentials: false'), 'WORKFLOW_CREDENTIAL_PERSISTENCE_ENABLED');

  const effect = authority.qualification_effect;
  requireTrue(effect.future_weather_canonical_evidence_created === false && effect.future_et0_calculated === false && effect.future_et0_canonical_evidence_created === false, 'FORMAL_OUTPUT_CREATED_TOO_EARLY');
  requireTrue(effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.runtime_source_authorized === false && effect.formal_window_started === false, 'WRITE_OR_RUNTIME_AUTHORITY_ENABLED');

  result.predecessor_blobs = Object.fromEntries(expectedPredecessors);
  result.pinned_decoder = { python:'3.12', eccodes:'2.47.0', eccodeslib:'2.47.3.23' };
  result.precipitation_adjudication = { rejected:['PRATE_ROLLING','APCP_EXACT_1H_ONLY'], candidate:'APCP_6H_BLOCK_CUMULATIVE_DIFFERENCE', required_target_count:72, clipping:false, fallback:false };
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
if (result.status === 'PASS') console.log(JSON.stringify({ status:result.status, base_sha:BASE, exact_file_count:result.exact_file_count, pinned_decoder:result.pinned_decoder, precipitation_adjudication:result.precipitation_adjudication }));
