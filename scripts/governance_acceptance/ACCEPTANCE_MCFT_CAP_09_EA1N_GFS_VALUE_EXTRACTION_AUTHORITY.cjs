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

  const predecessorFiles = {
    amendment_01: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
    ea1k: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json',
    ea1l: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1L-GFS-HOURLY-NORMALIZATION-AUTHORITY-V1.json',
    ea1m: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json',
  };
  for (const [key, file] of Object.entries(predecessorFiles)) {
    const actual = blobAt(BASE, file);
    requireTrue(actual === authority.predecessor_blobs[key], `PREDECESSOR_BLOB_DRIFT:${key}:${actual}:${authority.predecessor_blobs[key]}`);
  }

  requireTrue(authority.record_status === 'EA1N_GFS_VALUE_EXTRACTION_PROBE_NOT_FORMAL_AUTHORITY', 'AUTHORITY_STATUS_DRIFT');
  requireTrue(authority.decoder.python === '3.12' && authority.decoder.eccodes === '2.47.0' && authority.decoder.eccodeslib === '2.47.3.23', 'DECODER_PIN_DRIFT');
  requireTrue(authority.grid.lat === 42.5 && authority.grid.native_lon === 274.75 && authority.grid.interpolation === 'NONE_NEAREST_GRID_POINT', 'GRID_AUTHORITY_DRIFT');

  const chronology = authority.chronology;
  requireTrue(chronology.canonical_points === 72, 'POINT_COUNT_DRIFT');
  requireTrue(chronology.wait_for_future_files === false && chronology.valid_time_rewrite === false, 'CHRONOLOGY_WEAKENED');
  requireTrue(chronology.selected_transport === 'OFFICIAL_NOMADS_PRODUCTION_CYCLE_DIRECTORY_INDEX', 'DIRECTORY_TRANSPORT_NOT_SELECTED');
  requireTrue(chronology.required_files === 146, 'DIRECTORY_REQUIRED_FILE_COUNT_DRIFT');
  requireTrue(chronology.listing_time_basis === 'UTC_OPERATIONAL_RECONCILED', 'DIRECTORY_TIME_BASIS_DRIFT');
  requireTrue(chronology.listing_time_resolution === 'MINUTE', 'DIRECTORY_TIME_RESOLUTION_DRIFT');
  requireTrue(chronology.availability_upper_bound === 'listed_minute_UTC+59.999999s', 'DIRECTORY_UPPER_BOUND_RULE_DRIFT');
  requireTrue(chronology.prior_availability === 'every required file upper bound <= frozen tick', 'DIRECTORY_PRIOR_AVAILABILITY_RULE_DRIFT');
  requireTrue(chronology.listing_body_persisted === false && chronology.grib_filter_is_availability_authority === false, 'DIRECTORY_DATA_OR_FILTER_AUTHORITY_DRIFT');

  requireTrue(Array.isArray(authority.chronology_transport_rejections) && authority.chronology_transport_rejections.length === 2, 'TRANSPORT_REJECTION_CHAIN_INCOMPLETE');
  const headReject = authority.chronology_transport_rejections.find(x => x.method === 'PER_OBJECT_HEAD');
  const rangeReject = authority.chronology_transport_rejections.find(x => x.method === 'PER_OBJECT_RANGE_0_0');
  requireTrue(headReject && headReject.run === 31254637254 && Array.isArray(headReject.jobs) && headReject.jobs.includes(93096116778) && headReject.jobs.includes(93096358423), 'HEAD_REJECTION_DRIFT');
  requireTrue(rangeReject && rangeReject.run === 31254970459 && rangeReject.job === 93096909240 && rangeReject.root_redirect_accepted === false, 'RANGE_REJECTION_DRIFT');

  const p = authority.precipitation_adjudication;
  requireTrue(p.rejected.length === 2, 'PRECIP_REJECTION_CHAIN_INCOMPLETE');
  requireTrue(p.rejected[0].run === 31253728831 && p.rejected[0].failure === 'DERIVED_PRECIP_SANITY_FAIL_NO_CLIP:F006', 'PRATE_REJECTION_DRIFT');
  requireTrue(p.rejected[1].run === 31254027979 && p.rejected[1].coverage.unique === 12 && p.rejected[1].coverage.missing === 60, 'APCP_EXACT_REJECTION_DRIFT');
  requireTrue(p.run4.run === 31254245466 && p.run4.coverage.unique === 71 && p.run4.coverage.ambiguous === 1, 'RUN4_DUPLICATE_DIAGNOSTIC_DRIFT');
  requireTrue(p.current === 'APCP_6H_BLOCK_CUMULATIVE_DIFFERENCE_WITH_NCEP_SEMANTIC_DUPLICATE_COLLAPSE', 'PRECIP_CURRENT_CANDIDATE_DRIFT');
  requireTrue(p.cross_block === false && p.negative_clip === false && p.fallback === false, 'PRECIP_FAIL_CLOSED_POLICY_DRIFT');

  const d = authority.provider_duplicate_semantics;
  requireTrue(d.repo === 'NOAA-EMC/wgrib2' && d.commit === '58f99e14f2922d1ae3e05d2c41ea28c599a8c81d', 'NCEP_DUPLICATE_AUTHORITY_DRIFT');
  requireTrue(d.unmerge_blob === 'df2be678da7d7855d38897592a18be154100fa92' && d.section_compare_blob === '2081a81dfe216604f614f82b48fa9af109a61039', 'NCEP_DUPLICATE_SOURCE_BLOB_DRIFT');
  requireTrue(d.first_record_wins === false && d.physical_order_authority === false, 'UNSAFE_DUPLICATE_SELECTION_ENABLED');

  requireTrue(authority.normalization.missing_imputation === false && authority.normalization.negative_clipping === false, 'NORMALIZATION_WEAKENED');
  requireTrue(authority.data_boundary.raw_directory_listing_uploaded === false && authority.data_boundary.raw_grib_uploaded === false, 'RAW_PROVIDER_ARTIFACT_ENABLED');
  requireTrue(authority.data_boundary.decoded_values_emitted === false && authority.data_boundary.normalized_values_emitted === false, 'FORECAST_VALUES_EMITTED');
  requireTrue(authority.data_boundary.database_writes === 0 && authority.data_boundary.formal_evidence_writes === 0 && authority.data_boundary.future_et0_executions === 0 && authority.data_boundary.runtime_source_delta === 0, 'WRITE_OR_RUNTIME_DELTA_ENABLED');
  requireTrue(authority.formal_window_started === false && authority.mcft_cap09_completed === false, 'FORMAL_OR_COMPLETION_CLAIM_ENABLED');

  requireTrue(probe.includes('DIRECTORY_LISTING_TIME_BASIS = "UTC_OPERATIONAL_RECONCILED"'), 'PROBE_DIRECTORY_TIME_BASIS_MISSING');
  requireTrue(probe.includes('def cycle_directory_url(') && probe.includes('def parse_cycle_directory_listing('), 'PROBE_DIRECTORY_PARSER_MISSING');
  requireTrue(probe.includes('upper_bound = minute_start + timedelta(seconds=59, microseconds=999999)'), 'PROBE_MINUTE_UPPER_BOUND_MISSING');
  requireTrue(probe.includes('DIRECTORY_REQUIRED_ENTRY_NOT_UNIQUE'), 'PROBE_DIRECTORY_UNIQUENESS_GATE_MISSING');
  requireTrue(probe.includes('DIRECTORY_REQUIRED_ENTRY_ZERO_SIZE'), 'PROBE_DIRECTORY_SIZE_GATE_MISSING');
  requireTrue(probe.includes('DIRECTORY_ENTRY_AFTER_TICK_UPPER_BOUND'), 'PROBE_DIRECTORY_CHRONOLOGY_GATE_MISSING');
  requireTrue(probe.includes('DIRECTORY_REQUIRED_FILE_COUNT_FAIL'), 'PROBE_DIRECTORY_146_GATE_MISSING');
  requireTrue(!probe.includes('request_same_object_range_metadata'), 'REJECTED_RANGE_TRANSPORT_STILL_PRESENT');
  requireTrue(!probe.includes('method="HEAD"'), 'REJECTED_HEAD_TRANSPORT_STILL_PRESENT');

  requireTrue(probe.includes('codes_get_message') && probe.includes('def grib2_section(') && probe.includes('section4_sha256'), 'SECTION4_DUPLICATE_PROOF_MISSING');
  requireTrue(probe.includes('APCP_BLOCK_DISTINCT_SECTION4_AMBIGUITY') && probe.includes('APCP_BLOCK_DUPLICATE_VALUE_MISMATCH'), 'DUPLICATE_FAIL_CLOSED_GATES_MISSING');
  requireTrue(probe.includes('float(r["value"]).hex()'), 'EXACT_DUPLICATE_VALUE_IDENTITY_MISSING');
  requireTrue(probe.includes('APCP_BLOCK_MONOTONICITY_OR_HOURLY_SANITY_FAIL_NO_CLIP'), 'APCP_MONOTONICITY_GATE_MISSING');
  requireTrue(probe.includes('DERIVED_DSWRF_SANITY_FAIL_NO_CLIP'), 'DSWRF_NO_CLIP_GATE_MISSING');
  requireTrue(!/psycopg|postgresql:\/\/|PGHOST|DATABASE_URL/i.test(probe), 'DATABASE_SURFACE_DETECTED');
  requireTrue(!/lter\.kbs\.msu\.edu|enviroweather\.msu\.edu/i.test(probe), 'KBS_READ_DETECTED');
  requireTrue(!/future_weather_assumption_v1|future_et0_assumption_v1/.test(probe), 'CANONICAL_EVIDENCE_SURFACE_DETECTED');

  requireTrue(workflow.includes("python-version: '3.12'") && workflow.includes('eccodes==2.47.0') && workflow.includes('eccodeslib==2.47.3.23'), 'WORKFLOW_DECODER_NOT_PINNED');
  requireTrue(workflow.includes('python -m eccodes selfcheck') && workflow.includes('persist-credentials: false'), 'WORKFLOW_SELFCHECK_OR_CREDENTIAL_BOUNDARY_DRIFT');

  result.predecessor_blobs = authority.predecessor_blobs;
  result.production_chronology = { transport: chronology.selected_transport, required_files: chronology.required_files, conservative_upper_bound: chronology.availability_upper_bound };
  result.precipitation_candidate = p.current;
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
if (result.status === 'PASS') console.log(JSON.stringify({ status:result.status, base_sha:BASE, exact_file_count:result.exact_file_count, production_chronology:result.production_chronology, precipitation_candidate:result.precipitation_candidate }));
