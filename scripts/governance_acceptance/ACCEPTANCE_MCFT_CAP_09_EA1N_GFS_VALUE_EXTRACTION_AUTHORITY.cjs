'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

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
  schema_version: 'geox_mcft_cap09_ea1n_fail_close_governance_result_v1',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  canonical_evidence_write_count: 0,
  future_et0_execution_count: 0,
  runtime_product_source_delta_count: 0,
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

  requireTrue(authority.record_status === 'EA1N_PGRB2_DSWRF_EXACT_HOURLY_SCALAR_REJECTED', 'ADJUDICATION_STATUS_DRIFT');
  requireTrue(authority.qualification_effect === 'EA1N_FAIL_CLOSED_PGRB2_DSWRF_REJECTION_EA1O_REQUIRED', 'QUALIFICATION_EFFECT_DRIFT');
  requireTrue(authority.gfs_72h_value_pipeline_qualified === false, 'FALSE_PIPELINE_QUALIFICATION_CLAIM');

  const chronology = authority.chronology_authority_preserved;
  requireTrue(chronology.transport === 'OFFICIAL_NOMADS_PRODUCTION_CYCLE_DIRECTORY_INDEX', 'CHRONOLOGY_AUTHORITY_DRIFT');
  requireTrue(chronology.canonical_points === 72 && chronology.required_files === 146, 'CHRONOLOGY_CARDINALITY_DRIFT');
  requireTrue(chronology.wait_for_future_files === false && chronology.valid_time_rewrite === false, 'CHRONOLOGY_WEAKENED');
  requireTrue(chronology.grib_filter_is_availability_authority === false, 'FILTER_PROMOTED_TO_AVAILABILITY_AUTHORITY');

  const precip = authority.precipitation_adjudication;
  requireTrue(precip.accepted_candidate_for_successor_work === 'APCP_6H_BLOCK_CUMULATIVE_DIFFERENCE_WITH_NCEP_SEMANTIC_DUPLICATE_COLLAPSE', 'PRECIPITATION_CANDIDATE_DRIFT');
  requireTrue(precip.cross_block === false && precip.negative_clip === false && precip.fallback === false && precip.first_record_wins === false, 'PRECIPITATION_POLICY_WEAKENED');

  const dswrf = authority.dswrf_adjudication;
  requireTrue(dswrf.candidate === 'PGRB2_0P25_ROLLING_AVERAGE_WEIGHTED_DIFFERENCE', 'DSWRF_CANDIDATE_DRIFT');
  requireTrue(dswrf.decision === 'REJECTED_AS_EXACT_HOURLY_SCALAR_AUTHORITY', 'DSWRF_REJECTION_DRIFT');
  requireTrue(dswrf.no_negative_clipping === true && dswrf.no_zero_thresholding === true && dswrf.no_silent_imputation === true, 'DSWRF_FAIL_CLOSED_POLICY_WEAKENED');

  const evidence = dswrf.exact_head_evidence;
  requireTrue(evidence.subject_sha === '42faed8f246b19caf0a4140599bce09f92ec6d77', 'EVIDENCE_SUBJECT_DRIFT');
  requireTrue(evidence.workflow_run_id === 31257010218 && evidence.job_id === 93101818088, 'EVIDENCE_RUN_OR_JOB_DRIFT');
  requireTrue(evidence.selected_cycle === '2026-08-08T06:00:00Z' && evidence.failure_lead === 20, 'EVIDENCE_CYCLE_OR_LEAD_DRIFT');
  requireTrue(evidence.derived_sign === 'NEGATIVE' && evidence.derived_magnitude_bucket === 'LT_1E_2', 'EVIDENCE_DERIVED_RESULT_DRIFT');
  requireTrue(evidence.propagated_quantization_error_bucket === 'LT_1E_1', 'EVIDENCE_QUANTIZATION_BUCKET_DRIFT');
  requireTrue(evidence.negative_magnitude_within_propagated_quantization_error === true, 'PACKING_BOUND_DOES_NOT_COVER_NEGATIVE');
  requireTrue(evidence.physical_zero_inside_quantization_interval === true, 'PHYSICAL_ZERO_NOT_INSIDE_INTERVAL');

  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', evidence.subject_sha, 'HEAD'], { cwd: ROOT });
  requireTrue(ancestor.status === 0, 'EVIDENCE_SUBJECT_NOT_ANCESTOR_OF_HEAD');

  requireTrue(evidence.f019.step_type === 'avg' && evidence.f019.start_step === 18 && evidence.f019.end_step === 19, 'F019_WINDOW_DRIFT');
  requireTrue(evidence.f020.step_type === 'avg' && evidence.f020.start_step === 18 && evidence.f020.end_step === 20, 'F020_WINDOW_DRIFT');
  requireTrue(evidence.f019.packing_type === 'grid_complex_spatial_differencing' && evidence.f020.packing_type === 'grid_complex_spatial_differencing', 'PRODUCTION_PACKING_TYPE_DRIFT');
  requireTrue(evidence.f019.bits_per_value === 17 && evidence.f020.bits_per_value === 17, 'PRODUCTION_PACKING_BITS_DRIFT');
  requireTrue(evidence.f019.section4_sha256 === 'ec2b6c9b48a19ca4d07a455ae758bfbbce56698066249148bb36a9f3beb5f46f', 'F019_SECTION4_DRIFT');
  requireTrue(evidence.f020.section4_sha256 === 'ba1920201e3e0c528310126c84e6863fc594d81bc74d66401b03913684b4c03e', 'F020_SECTION4_DRIFT');

  const alternative = dswrf.same_grid_alternative;
  requireTrue(alternative.product === 'pgrb2b.0p25', 'SAME_GRID_ALTERNATIVE_DRIFT');
  requireTrue(alternative.f020_dswrf_surface_count === 0 && alternative.result === 'NO_DSWRF_SURFACE_ALTERNATIVE', 'PGRB2B_DSWRF_ABSENCE_NOT_FROZEN');
  requireTrue(alternative.idx_sha256 === '75c9cce94228b0e5af4d6a1cfb92f92fe10a4d4f0161984425b7a7f72b72cbfa', 'PGRB2B_IDX_IDENTITY_DRIFT');

  const normative = dswrf.normative_basis;
  requireTrue(normative.grib2_reconstruction.startsWith('WMO_GRIB2_REGULATION_92_9_4'), 'WMO_RECONSTRUCTION_BASIS_MISSING');
  requireTrue(normative.complex_packing === 'LOSSLESS_RELATIVE_TO_SCALED_SIMPLE_PACKED_INTEGERS', 'COMPLEX_PACKING_BASIS_DRIFT');
  requireTrue(normative.quantization_bound === 'HALF_SCALE_QUANTUM_PROPAGATED_THROUGH_WEIGHTED_DIFFERENCE', 'QUANTIZATION_BOUND_RULE_DRIFT');

  const next = authority.next_candidate;
  requireTrue(next.stage === 'EA1O' && next.source === 'GFS_SFLUX_DIRECT_1H_DSWRF', 'NEXT_CANDIDATE_DRIFT');
  requireTrue(next.provider_semantics === 'SURFACE_DSWRF_0_TO_1_HOUR_AVERAGE', 'SFLUX_DIRECT_HOURLY_SEMANTICS_DRIFT');
  requireTrue(next.direct_hourly_reconstruction_required === false, 'SFLUX_RECONSTRUCTION_SHOULD_NOT_BE_REQUIRED');
  requireTrue(next.spatial_authority_refreeze_required === true, 'SILENT_SFLUX_SPATIAL_EQUIVALENCE_ENABLED');
  requireTrue(next.authority_created === false, 'EA1O_AUTHORITY_PREMATURELY_CREATED');

  const boundary = authority.data_boundary;
  requireTrue(boundary.raw_directory_listing_uploaded === false && boundary.raw_idx_uploaded === false && boundary.raw_grib_uploaded === false, 'RAW_PROVIDER_DATA_PUBLICATION_ENABLED');
  requireTrue(boundary.decoded_values_emitted === false && boundary.normalized_values_emitted === false, 'FORECAST_VALUE_EMISSION_ENABLED');
  requireTrue(boundary.database_writes === 0 && boundary.formal_evidence_writes === 0 && boundary.canonical_evidence_writes === 0, 'EVIDENCE_OR_DATABASE_WRITE_ENABLED');
  requireTrue(boundary.future_et0_executions === 0 && boundary.runtime_source_delta === 0, 'FUTURE_ET0_OR_RUNTIME_ACTIVATION_ENABLED');
  requireTrue(authority.formal_window_started === false && authority.mcft_cap09_completed === false, 'FORMAL_OR_COMPLETION_CLAIM_ENABLED');

  requireTrue(probe.includes('EA1N_PGRB2_DSWRF_EXACT_HOURLY_SCALAR_REJECTED'), 'PROBE_REJECTION_MARKER_MISSING');
  requireTrue(probe.includes('EVIDENCE_SUBJECT_NOT_ANCESTOR_OF_CURRENT_HEAD'), 'PROBE_EVIDENCE_ANCESTRY_GATE_MISSING');
  requireTrue(probe.includes('PGRB2B_DSWRF_ABSENCE_DRIFT'), 'PROBE_SAME_GRID_ALTERNATIVE_GATE_MISSING');
  requireTrue(probe.includes('SILENT_SPATIAL_EQUIVALENCE_ENABLED'), 'PROBE_SPATIAL_REFREEZE_GATE_MISSING');
  requireTrue(!/urlopen|requests\.|urllib\.request|httpx|aiohttp/.test(probe), 'EA1N_ADJUDICATION_PROBE_FETCHES_PROVIDER');
  requireTrue(!/psycopg|postgresql:\/\/|PGHOST|DATABASE_URL/i.test(probe), 'DATABASE_SURFACE_DETECTED');

  requireTrue(workflow.includes("python-version: '3.12'"), 'WORKFLOW_PYTHON_PIN_MISSING');
  requireTrue(workflow.includes('persist-credentials: false'), 'WORKFLOW_CREDENTIAL_BOUNDARY_DRIFT');
  requireTrue(workflow.includes('MCFT_SUBJECT_SHA'), 'WORKFLOW_SUBJECT_BINDING_MISSING');
  requireTrue(!workflow.includes('eccodes==') && !workflow.includes('nomads.ncep.noaa.gov'), 'ADJUDICATION_WORKFLOW_REPEATS_PROVIDER_VALUE_PROBE');

  result.adjudication = dswrf.decision;
  result.evidence_subject_sha = evidence.subject_sha;
  result.evidence_workflow_run_id = evidence.workflow_run_id;
  result.same_grid_alternative = alternative.result;
  result.next_stage = next.stage;
  result.next_source = next.source;
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
    adjudication: result.adjudication,
    evidence_subject_sha: result.evidence_subject_sha,
    same_grid_alternative: result.same_grid_alternative,
    next_stage: result.next_stage,
    next_source: result.next_source,
  }));
}
