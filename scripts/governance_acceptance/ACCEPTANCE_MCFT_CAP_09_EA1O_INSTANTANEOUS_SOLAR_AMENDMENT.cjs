'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'f7ab20326dc78612f730225424aa23545a2ee258';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const EA1OC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-C-SFLUX-RECONSTRUCTION-SPATIAL-QUALIFICATION-V1.json';
const A4 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md';
const STATUS = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-INSTANTANEOUS-SOLAR-AMENDMENT-STATUS-V1.json';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1O_INSTANTANEOUS_SOLAR_AMENDMENT.cjs';
const WF = '.github/workflows/mcft-cap-09-ea1o-instantaneous-solar-amendment.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1O_INSTANTANEOUS_SOLAR_AMENDMENT_RESULT.json');
const EXPECT = [TASK, A4, STATUS, GATE, WF].sort();

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_instantaneous_solar_amendment_governance_result_v1',
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
  req(BASE === EXPECTED_BASE, `EA1O_A4_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA1O_A4_EXACT_FIVE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, TASK) === 'd7ff8d7164d4f2a9f1c3edcaafcf30eeeb181f0d', 'EA1O_A4_TASKBOOK_V04_BASE_BLOB_DRIFT');
  req(blob(BASE, EA1OC) === '743846307cc4d846b10e2409670a66512b4778b4', 'EA1O_A4_EA1OC_BASE_BLOB_DRIFT');

  const task = read(TASK);
  const amendment = read(A4);
  const status = JSON.parse(read(STATUS));
  const workflow = read(WF);

  req(task.includes('Complete Taskbook v0.5'), 'EA1O_A4_TASKBOOK_V05_MARKER_MISSING');
  req(task.includes('GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md'), 'EA1O_A4_TASKBOOK_REF_MISSING');
  req(task.includes('EA1O-D'), 'EA1O_A4_TASKBOOK_SUCCESSOR_MISSING');
  req(task.includes('REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY'), 'EA1O_A4_TASKBOOK_PREDECESSOR_REJECTION_MISSING');
  req(task.includes('H_f = (I_(f-1) + I_f) / 2'), 'EA1O_A4_TASKBOOK_MEAN_FORMULA_MISSING');
  req(task.includes('MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION'), 'EA1O_A4_TASKBOOK_EPISTEMIC_CLASS_MISSING');
  req(task.includes('quality.status = LIMITED'), 'EA1O_A4_TASKBOOK_LIMITED_QUALITY_MISSING');

  req(amendment.includes('base_protected_main_sha:\nf7ab20326dc78612f730225424aa23545a2ee258'), 'EA1O_A4_AMENDMENT_BASE_SHA_DRIFT');
  req(amendment.includes('ea1o_c_value_rejection_blob:\n743846307cc4d846b10e2409670a66512b4778b4'), 'EA1O_A4_EA1OC_BLOB_MISSING');
  req(amendment.includes('MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION'), 'EA1O_A4_EPISTEMIC_CLASS_MISSING');
  req(amendment.includes('quality_status:\nLIMITED'), 'EA1O_A4_LIMITED_QUALITY_MISSING');
  req(amendment.includes('I_f(u) = (1-u) * I_(f-1) + u * I_f'), 'EA1O_A4_INTERPOLATION_MODEL_MISSING');
  req(amendment.includes('H_f = integral_0^1 I_f(u) du'), 'EA1O_A4_INTEGRAL_IDENTITY_MISSING');
  req(amendment.includes('Rs_f = H_f * 0.0036'), 'EA1O_A4_SOLAR_ENERGY_FORMULA_MISSING');
  req(amendment.includes('support_lead         = L - 1'), 'EA1O_A4_SUPPORT_LEAD_RULE_MISSING');
  req(amendment.includes('N hour fcst` is authorized here only as an **instantaneous endpoint'), 'EA1O_A4_N_HOUR_ENDPOINT_BOUNDARY_MISSING');
  req(amendment.includes('NO_N_HOUR_FCST_AS_DIRECT_INTERVAL_AVERAGE'), 'EA1O_A4_DIRECT_AVERAGE_PROHIBITION_MISSING');
  req(amendment.includes('NO_QUALITY_PASS_FOR_THIS_SOLAR_TRANSFORMATION'), 'EA1O_A4_QUALITY_PASS_PROHIBITION_MISSING');
  req(amendment.includes('EA1O-D LIVE SFLUX INSTANTANEOUS PIECEWISE-LINEAR SOLAR QUALIFICATION'), 'EA1O_A4_SUCCESSOR_MISSING');

  req(status.record_status === 'ARCHITECTURE_AMENDMENT_04_CANDIDATE_NOT_EFFECTIVE', 'EA1O_A4_STATUS_DRIFT');
  req(status.base_main_sha === BASE, 'EA1O_A4_STATUS_BASE_SHA_DRIFT');
  req(status.predecessor_authority.ea1o_c_blob === '743846307cc4d846b10e2409670a66512b4778b4', 'EA1O_A4_STATUS_EA1OC_BLOB_DRIFT');
  req(status.predecessor_authority.ea1o_c_decision === 'REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY', 'EA1O_A4_STATUS_REJECTION_DRIFT');
  req(status.predecessor_authority.ea1o_c_spatial_candidate_qualified === true, 'EA1O_A4_STATUS_SPATIAL_FACT_DRIFT');
  req(status.candidate_amendment.blob === blob('HEAD', A4), 'EA1O_A4_STATUS_AMENDMENT_BLOB_DRIFT');

  const epistemic = status.epistemic_candidate;
  req(epistemic.class === 'MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION', 'EA1O_A4_EPISTEMIC_CLASS_DRIFT');
  req(epistemic.formal_quality_status === 'LIMITED', 'EA1O_A4_FORMAL_QUALITY_DRIFT');
  req(epistemic.direct_field_equivalence === false && epistemic.model_grid_is_observation_truth === false, 'EA1O_A4_TRUTH_UPGRADE');
  req(epistemic.provider_direct_hourly_average_claim === false && epistemic.hidden_provider_truth_reconstruction_claim === false, 'EA1O_A4_DIRECT_TRUTH_CLAIM_ENABLED');

  const endpoints = status.instantaneous_endpoint_candidate;
  req(endpoints.canonical_target_count === 72 && endpoints.support_endpoint_count === 1 && endpoints.required_endpoint_count === 73, 'EA1O_A4_ENDPOINT_COUNT_DRIFT');
  req(endpoints.support_lead_formula === 'canonical_lead_start-1', 'EA1O_A4_SUPPORT_FORMULA_DRIFT');
  req(endpoints.same_exact_gfs_cycle_required === true && endpoints.cross_cycle_endpoint_pair_authorized === false, 'EA1O_A4_CYCLE_BOUNDARY_WEAKENED');
  req(endpoints.n_hour_fcst_as_direct_interval_average_authorized === false, 'EA1O_A4_DIRECT_AVERAGE_ENABLED');

  const temporal = status.temporal_transformation_candidate;
  req(temporal.transformation_id === 'PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1', 'EA1O_A4_TRANSFORMATION_ID_DRIFT');
  req(temporal.hourly_mean_formula === 'H_f=(I_(f-1)+I_f)/2', 'EA1O_A4_MEAN_FORMULA_DRIFT');
  req(temporal.solar_energy_formula === 'Rs_f=H_f*0.0036', 'EA1O_A4_ENERGY_FORMULA_DRIFT');
  req(temporal.midpoint_invention_authorized === false && temporal.spline_authorized === false && temporal.higher_order_fit_authorized === false && temporal.persistence_fill_authorized === false && temporal.weather_dependent_heuristic_authorized === false, 'EA1O_A4_ALTERNATIVE_TEMPORAL_METHOD_ENABLED');

  const value = status.value_policy;
  req(value.instantaneous_endpoint_must_be_finite === true && value.instantaneous_endpoint_must_be_nonnegative === true, 'EA1O_A4_ENDPOINT_VALUE_RULE_WEAKENED');
  req(value.derived_hourly_mean_must_be_finite === true && value.derived_hourly_mean_must_be_nonnegative === true && value.derived_solar_energy_must_be_finite === true && value.derived_solar_energy_must_be_nonnegative === true, 'EA1O_A4_DERIVED_VALUE_RULE_WEAKENED');
  req(value.negative_clipping_authorized === false && value.zero_thresholding_authorized === false && value.silent_imputation_authorized === false && value.pgrb2_dswrf_fallback_authorized === false, 'EA1O_A4_VALUE_REPAIR_OR_FALLBACK_ENABLED');

  const metadata = status.formal_metadata_policy;
  req(metadata.quality_status === 'LIMITED' && metadata.quality_pass_authorized === false, 'EA1O_A4_FORMAL_QUALITY_UPGRADE');
  req(metadata.temporal_transformation_ref === 'PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1' && metadata.limitations_required === true, 'EA1O_A4_PROVENANCE_METADATA_WEAKENED');
  req(metadata.runtime_contract_delta_required === false && metadata.canonical_schema_delta_required === false, 'EA1O_A4_UNNECESSARY_CONTRACT_DELTA');

  const boundary = status.qualification_boundary;
  req(boundary.instantaneous_endpoint_source_qualified === false && boundary.piecewise_linear_temporal_transformation_qualified === false, 'EA1O_A4_PREMATURE_QUALIFICATION');
  req(boundary.current_73_endpoint_values_proven === false && boundary.current_72_hourly_solar_values_proven === false && boundary.current_native_sflux_spatial_reproof_proven === false, 'EA1O_A4_LIVE_PROOF_PREMATURE');
  req(boundary.database_write_count === 0 && boundary.formal_evidence_write_count === 0 && boundary.future_et0_execution_count === 0 && boundary.formal_window_started === false, 'EA1O_A4_WRITE_ET0_OR_FORMAL_STARTED');
  req(status.first_legal_successor_action_when_effective === 'EA1O_D_LIVE_SFLUX_INSTANTANEOUS_PIECEWISE_LINEAR_SOLAR_QUALIFICATION', 'EA1O_A4_SUCCESSOR_STATUS_DRIFT');
  req(status.ea2_authorized === false && status.mcft_cap09_completed === false, 'EA1O_A4_EA2_OR_COMPLETION_ENABLED');

  req(workflow.includes('persist-credentials: false'), 'EA1O_A4_PERSIST_CREDENTIALS_FORBIDDEN');
  req(workflow.includes('ACCEPTANCE_MCFT_CAP_09_EA1O_INSTANTANEOUS_SOLAR_AMENDMENT.cjs'), 'EA1O_A4_WORKFLOW_GATE_MISSING');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(workflow), 'EA1O_A4_DATABASE_PATH_PRESENT');

  Object.assign(result, {
    taskbook_base_blob: blob(BASE, TASK),
    taskbook_candidate_blob: blob('HEAD', TASK),
    ea1o_c_rejection_blob: blob(BASE, EA1OC),
    amendment_04_blob: blob('HEAD', A4),
    status_blob: blob('HEAD', STATUS),
    epistemic_class: epistemic.class,
    formal_quality_status: epistemic.formal_quality_status,
    first_legal_successor_action: status.first_legal_successor_action_when_effective,
    taskbook_changed: true,
    runtime_source_changed: false,
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
