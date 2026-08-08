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
const DECISION = 'REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY';

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_c_value_rejection_governance_result_v2',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  runtime_contract_delta_count: 0, canonical_contract_delta_count: 0,
  migration_delta_count: 0, database_write_count: 0,
  formal_evidence_write_count: 0, future_et0_execution_count: 0,
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
  req(authority.record_status === 'EA1O_C_VALUE_REJECTION_CANDIDATE_NOT_EFFECTIVE', 'EA1OC_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA1OC_AUTHORITY_BASE_SHA_DRIFT');
  req(authority.live_qualification.current_result === DECISION, 'EA1OC_FROZEN_DECISION_DRIFT');
  req(authority.adjudication.decision === DECISION, 'EA1OC_ADJUDICATION_DRIFT');
  req(authority.adjudication.reconstruction_value_authority_qualified === false, 'EA1OC_VALUE_MUST_REMAIN_REJECTED');
  req(authority.adjudication.native_sflux_spatial_candidate_qualified === true, 'EA1OC_SPATIAL_DISCOVERY_MUST_REMAIN_PASS');
  req(authority.adjudication.combined_source_value_spatial_authority_qualified === false, 'EA1OC_COMBINED_AUTHORITY_MUST_REMAIN_FALSE');

  const identity = authority.source_candidate.observed_grib2_parameter_identity;
  req(identity.discipline === 0 && identity.parameter_category === 4 && identity.parameter_number === 192, 'EA1OC_GRIB_IDENTITY_DRIFT');
  req(identity.param_id === 260087 && identity.short_name === 'sdswrf', 'EA1OC_ECCODES_IDENTITY_DRIFT');
  req(identity.short_name_is_sole_authority === false, 'EA1OC_SHORTNAME_SOLE_AUTHORITY_FORBIDDEN');
  req(authority.source_candidate.availability_authority === 'EXACT_RANGE_RESPONSE_LAST_MODIFIED_AND_CONTENT_RANGE', 'EA1OC_AVAILABILITY_AUTHORITY_DRIFT');
  req(authority.source_candidate.n_hour_fcst_record_authorized === false, 'EA1OC_N_HOUR_FCST_ENABLED');
  req(authority.source_candidate.full_global_grib_download_authorized === false && authority.source_candidate.range_message_retrieval_required === true, 'EA1OC_RANGE_BOUNDARY_WEAKENED');

  const reconstruction = authority.reconstruction_candidate;
  req(reconstruction.within_block_formula === 'H_f=n*A_f-(n-1)*A_(f-1)', 'EA1OC_FORMULA_DRIFT');
  req(reconstruction.cross_block_reconstruction_authorized === false && reconstruction.cross_cycle_reconstruction_authorized === false, 'EA1OC_CROSS_BOUNDARY_RECONSTRUCTION_ENABLED');
  req(reconstruction.pgrb2_dswrf_fallback_authorized === false, 'EA1OC_PGRB2_FALLBACK_ENABLED');
  req(reconstruction.negative_clipping_authorized === false && reconstruction.zero_thresholding_authorized === false && reconstruction.silent_imputation_authorized === false, 'EA1OC_VALUE_REPAIR_ENABLED');

  const discovery = authority.live_discovery_evidence;
  req(discovery.subject_sha === 'cadcfdb5834894594a9a291537e8b32f046fb78e', 'EA1OC_DISCOVERY_SHA_DRIFT');
  req(discovery.workflow_run_id === 31268927952 && discovery.artifact_id === 9025007841, 'EA1OC_DISCOVERY_RUN_DRIFT');
  req(discovery.artifact_digest === 'sha256:4f79adc59029db777411aec718669a95dd5b408cf57154530a509da01379d6ad', 'EA1OC_DISCOVERY_ARTIFACT_DIGEST_DRIFT');
  req(discovery.required_message_count === 73 && discovery.exact_range_message_count === 73, 'EA1OC_DISCOVERY_MESSAGE_COUNT_DRIFT');
  req(discovery.reconstruction.canonical_reconstructed_count === 72, 'EA1OC_DISCOVERY_72_RECONSTRUCTED_REQUIRED');
  req(discovery.reconstruction.finite_count === 72 && discovery.reconstruction.nonnegative_count === 67 && discovery.reconstruction.negative_count === 5, 'EA1OC_DISCOVERY_VALUE_COUNTS_DRIFT');
  req(discovery.reconstruction.nonfinite_count === 0, 'EA1OC_DISCOVERY_NONFINITE_DRIFT');
  req(discovery.reconstruction.negative_clipping_performed === false && discovery.reconstruction.zero_thresholding_performed === false && discovery.reconstruction.silent_imputation_performed === false && discovery.reconstruction.pgrb2_fallback_used === false, 'EA1OC_DISCOVERY_REPAIR_OR_FALLBACK_USED');
  req(discovery.spatial.qualified === true && discovery.spatial.grid_type === 'regular_gg' && discovery.spatial.gaussian_n === 768, 'EA1OC_DISCOVERY_SPATIAL_DRIFT');
  req(discovery.spatial.grid_point_count === 4718592 && discovery.spatial.centroid_and_all_vertices_same_native_point_for_all_messages === true, 'EA1OC_DISCOVERY_SPATIAL_CONSENSUS_DRIFT');
  req(discovery.packing.maximum_reconstructed_quantization_bound_bucket === 'LT_1E_1', 'EA1OC_DISCOVERY_QUANTIZATION_BUCKET_DRIFT');

  req(authority.successor_governance.next_action_class_if_rejection_becomes_effective === 'S6_ARCHITECTURE_ADJUDICATION_REQUIRED', 'EA1OC_SUCCESSOR_CLASS_DRIFT');
  req(authority.successor_governance.specific_successor_design_pre_authorized === false, 'EA1OC_SUCCESSOR_PREAUTHORIZED');
  req(authority.successor_governance.ea2_may_start === false && authority.successor_governance.formal_o00_o23_may_start === false, 'EA1OC_EA2_OR_FORMAL_STARTED');
  req(authority.qualification_effect.future_et0_execution_authorized === false && authority.qualification_effect.ea2_authorized === false, 'EA1OC_ET0_OR_EA2_ENABLED');
  req(authority.qualification_effect.database_write_authorized === false && authority.qualification_effect.formal_evidence_write_authorized === false && authority.qualification_effect.runtime_source_authorized === false, 'EA1OC_WRITE_OR_RUNTIME_ENABLED');

  req(probe.includes('n * current["value"] - (n - 1) * predecessor["value"]'), 'EA1OC_PROBE_FORMULA_MISSING');
  req(probe.includes('binaryScaleFactor') && probe.includes('decimalScaleFactor') && probe.includes('math.ldexp'), 'EA1OC_PACKING_QUANTUM_IMPLEMENTATION_MISSING');
  req(probe.includes('codes_grib_find_nearest'), 'EA1OC_NATIVE_NEAREST_IMPLEMENTATION_MISSING');
  req(probe.includes('Content-Range') && probe.includes('GRIB_RANGE'), 'EA1OC_RANGE_AVAILABILITY_PROOF_MISSING');
  req(!/max\s*\(\s*0\s*,|np\.clip|numpy\.clip/.test(probe), 'EA1OC_CLIPPING_PATTERN_FORBIDDEN');
  req(workflow.includes(DECISION), 'EA1OC_WORKFLOW_MUST_ASSERT_VALUE_REJECTION');
  req(workflow.includes('negative_count') && workflow.includes('spatial_qualified'), 'EA1OC_WORKFLOW_FINAL_REPROOF_ASSERTIONS_MISSING');
  req(workflow.includes('persist-credentials: false'), 'EA1OC_PERSIST_CREDENTIALS_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(workflow + '\n' + probe), 'EA1OC_DATABASE_PATH_PRESENT');

  Object.assign(result, {
    authority_blob: blob('HEAD', AUTH), probe_blob: blob('HEAD', PROBE),
    frozen_decision: DECISION, discovery_subject_sha: discovery.subject_sha,
    discovery_negative_count: discovery.reconstruction.negative_count,
    discovery_spatial_qualified: discovery.spatial.qualified,
    taskbook_changed: false, runtime_source_changed: false,
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
