'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '74ceaa530f362e84312c594524eaa4b72619ef81';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A2 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-02-GFS-SOLAR-RADIATION-SOURCE-AUTHORITY.md';
const B = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-B-SFLUX-SOURCE-SPATIAL-QUALIFICATION-V1.json';
const A3 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-03-GFS-SFLUX-EXPANDING-AVERAGE-RECONSTRUCTION-AUTHORITY.md';
const STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-SFLUX-RECONSTRUCTION-AMENDMENT-STATUS-V1.json';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1O_SFLUX_RECONSTRUCTION_AMENDMENT.cjs';
const WF = '.github/workflows/mcft-cap-09-ea1o-sflux-reconstruction-amendment.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1O_SFLUX_RECONSTRUCTION_AMENDMENT_RESULT.json');
const EXPECT = [TASK, A3, STATUS, GATE, WF].sort();

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_sflux_reconstruction_amendment_governance_result_v1',
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
  req(BASE === EXPECTED_BASE, `EA1O_A3_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA1O_A3_EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, TASK) === '3e6bc630540108599771e5404c457eaee14946aa', 'EA1O_A3_TASKBOOK_V03_BASE_BLOB_DRIFT');
  req(blob(BASE, A2) === '3ec68f7a33274ff96c5f613154b4357d2b057fd1', 'EA1O_A3_AMENDMENT02_BASE_BLOB_DRIFT');
  req(blob(BASE, B) === 'cd817199ed16ce429cf99743ffebcaf7fe562053', 'EA1O_A3_EA1OB_REJECTION_BASE_BLOB_DRIFT');

  const task = read(TASK);
  const amendment = read(A3);
  const status = JSON.parse(read(STATUS));
  const workflow = read(WF);

  req(task.includes('Complete Taskbook v0.4'), 'EA1O_A3_TASKBOOK_V04_MARKER_MISSING');
  req(task.includes('GEOX-MCFT-CAP-09-AMENDMENT-03-GFS-SFLUX-EXPANDING-AVERAGE-RECONSTRUCTION-AUTHORITY.md'), 'EA1O_A3_TASKBOOK_REF_MISSING');
  req(task.includes('EA1O-C'), 'EA1O_A3_TASKBOOK_SUCCESSOR_MISSING');
  req(task.includes('H_f = n * A_f - (n - 1) * A_(f-1)'), 'EA1O_A3_TASKBOOK_FORMULA_MISSING');
  req(task.includes('REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY'), 'EA1O_A3_TASKBOOK_PREDECESSOR_REJECTION_MISSING');

  req(amendment.includes('base_protected_main_sha:\n74ceaa530f362e84312c594524eaa4b72619ef81'), 'EA1O_A3_AMENDMENT_BASE_SHA_DRIFT');
  req(amendment.includes('ea1o_b_fail_close_blob:\ncd817199ed16ce429cf99743ffebcaf7fe562053'), 'EA1O_A3_REJECTION_BLOB_MISSING');
  req(amendment.includes('b = 6 * floor((f - 1) / 6)'), 'EA1O_A3_BLOCK_FORMULA_MISSING');
  req(amendment.includes('H_f = n * A_f - (n - 1) * A_(f-1)'), 'EA1O_A3_RECONSTRUCTION_FORMULA_MISSING');
  req(amendment.includes('No arithmetic may cross a six-hour block boundary.'), 'EA1O_A3_CROSS_BLOCK_PROHIBITION_MISSING');
  req(amendment.includes('epsilon_H <= n * epsilon_f + (n - 1) * epsilon_(f-1)'), 'EA1O_A3_QUANTIZATION_PROPAGATION_MISSING');
  req(amendment.includes('A negative candidate remains a failure even when its'), 'EA1O_A3_NEGATIVE_FAIL_CLOSED_MISSING');
  req(amendment.includes('EA1O-C LIVE SFLUX EXPANDING-AVERAGE RECONSTRUCTION + SPATIAL QUALIFICATION'), 'EA1O_A3_SUCCESSOR_MISSING');
  req(amendment.includes('NO_N_HOUR_FCST_AS_INTERVAL_AVERAGE'), 'EA1O_A3_N_HOUR_FCST_PROHIBITION_MISSING');
  req(amendment.includes('NO_PGRB2_DSWRF_FALLBACK'), 'EA1O_A3_PGRB2_FALLBACK_PROHIBITION_MISSING');
  req(amendment.includes('NO_FORMAL_O00_O23_START'), 'EA1O_A3_FORMAL_PROHIBITION_MISSING');

  req(status.record_status === 'ARCHITECTURE_AMENDMENT_03_CANDIDATE_NOT_EFFECTIVE', 'EA1O_A3_STATUS_DRIFT');
  req(status.base_main_sha === BASE, 'EA1O_A3_STATUS_BASE_SHA_DRIFT');
  req(status.predecessor_authority.ea1o_b_blob === 'cd817199ed16ce429cf99743ffebcaf7fe562053', 'EA1O_A3_STATUS_REJECTION_BLOB_DRIFT');
  req(status.predecessor_authority.ea1o_b_decision === 'REJECTED_AS_AMENDMENT02_DIRECT_1H_SOURCE_AUTHORITY', 'EA1O_A3_STATUS_REJECTION_DECISION_DRIFT');
  req(status.candidate_amendment.blob === blob('HEAD', A3), 'EA1O_A3_STATUS_AMENDMENT_BLOB_DRIFT');

  const temporal = status.temporal_reconstruction_candidate;
  req(temporal.block_size_hours === 6, 'EA1O_A3_BLOCK_SIZE_DRIFT');
  req(temporal.block_start_formula === 'b=6*floor((f-1)/6)', 'EA1O_A3_BLOCK_START_RULE_DRIFT');
  req(temporal.block_first_hour_formula === 'H_f=A_f', 'EA1O_A3_FIRST_HOUR_RULE_DRIFT');
  req(temporal.within_block_formula === 'H_f=n*A_f-(n-1)*A_(f-1)', 'EA1O_A3_WEIGHTED_DIFFERENCE_RULE_DRIFT');
  req(temporal.cross_block_reconstruction_authorized === false, 'EA1O_A3_CROSS_BLOCK_ENABLED');
  req(temporal.n_hour_fcst_as_interval_average_authorized === false, 'EA1O_A3_N_HOUR_FCST_ENABLED');
  req(temporal.pgrb2_dswrf_fallback_authorized === false, 'EA1O_A3_PGRB2_FALLBACK_ENABLED');
  req(temporal.negative_clipping_authorized === false && temporal.zero_thresholding_authorized === false && temporal.silent_imputation_authorized === false, 'EA1O_A3_VALUE_REPAIR_ENABLED');
  req(temporal.same_exact_gfs_cycle_required === true, 'EA1O_A3_SAME_CYCLE_WEAKENED');

  const support = status.support_lead_policy;
  req(support.required_only_when_canonical_lead_start_is_not_first_hour_of_6h_block === true, 'EA1O_A3_SUPPORT_LEAD_RULE_DRIFT');
  req(support.support_lead_formula === 'canonical_lead_start-1', 'EA1O_A3_SUPPORT_LEAD_FORMULA_DRIFT');
  req(support.same_cycle_required === true && support.available_before_same_tick_required === true, 'EA1O_A3_SUPPORT_CHRONOLOGY_WEAKENED');
  req(support.support_lead_is_canonical_output === false && support.valid_time_shift_authorized === false, 'EA1O_A3_SUPPORT_LEAD_CANONICAL_LEAK');

  const packing = status.packing_quantization_policy;
  req(packing.live_grib_packing_metadata_required === true, 'EA1O_A3_PACKING_METADATA_NOT_REQUIRED');
  req(packing.half_quantum_diagnostic_required === true && packing.reconstructed_propagated_quantization_bound_required === true, 'EA1O_A3_QUANTIZATION_DIAGNOSTIC_WEAKENED');
  req(packing.quantization_bound_may_repair_negative_value === false, 'EA1O_A3_QUANTIZATION_REPAIR_ENABLED');
  req(packing.any_nonfinite_reconstructed_value === 'FAIL_CLOSED' && packing.any_negative_reconstructed_value === 'FAIL_CLOSED', 'EA1O_A3_VALUE_FAIL_CLOSED_WEAKENED');

  const spatial = status.spatial_boundary;
  req(spatial.sflux_grid_authority_qualified === false, 'EA1O_A3_SPATIAL_AUTHORITY_PREMATURE');
  req(spatial.live_native_grid_refreeze_required === true, 'EA1O_A3_SPATIAL_REFREEZE_NOT_REQUIRED');
  req(spatial.silent_pgrb2_grid_reuse_authorized === false && spatial.interpolation_authorized === false, 'EA1O_A3_SPATIAL_SHORTCUT_ENABLED');
  req(spatial.direct_field_equivalence === false && spatial.model_grid_is_observation_truth === false, 'EA1O_A3_FIELD_TRUTH_UPGRADE');

  const boundary = status.qualification_boundary;
  req(boundary.reconstruction_algorithm_qualified === false, 'EA1O_A3_RECONSTRUCTION_PREMATURELY_QUALIFIED');
  req(boundary.current_sflux_72h_reconstructed_values_proven === false && boundary.current_sflux_packing_quantization_proven === false && boundary.current_sflux_geometry_proven === false, 'EA1O_A3_LIVE_QUALIFICATION_PREMATURE');
  req(boundary.database_write_count === 0 && boundary.formal_evidence_write_count === 0 && boundary.canonical_evidence_write_count === 0, 'EA1O_A3_WRITE_ENABLED');
  req(boundary.future_et0_execution_count === 0 && boundary.formal_window_started === false, 'EA1O_A3_FUTURE_ET0_OR_FORMAL_STARTED');
  req(status.first_legal_successor_action_when_effective === 'EA1O_C_LIVE_SFLUX_RECONSTRUCTION_PACKING_AND_SPATIAL_QUALIFICATION', 'EA1O_A3_SUCCESSOR_STATUS_DRIFT');
  req(status.ea2_authorized === false && status.mcft_cap09_completed === false, 'EA1O_A3_EA2_OR_COMPLETION_ENABLED');

  req(workflow.includes('persist-credentials: false'), 'EA1O_A3_PERSIST_CREDENTIALS_FORBIDDEN');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA1O_SFLUX_RECONSTRUCTION_AMENDMENT.cjs'), 'EA1O_A3_WORKFLOW_GATE_MISSING');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(workflow), 'EA1O_A3_DATABASE_PATH_PRESENT');

  Object.assign(result, {
    taskbook_base_blob: blob(BASE, TASK),
    taskbook_candidate_blob: blob('HEAD', TASK),
    amendment_02_blob: blob(BASE, A2),
    ea1o_b_rejection_blob: blob(BASE, B),
    amendment_03_blob: blob('HEAD', A3),
    status_blob: blob('HEAD', STATUS),
    first_legal_successor_action: status.first_legal_successor_action_when_effective,
    taskbook_changed: true,
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
