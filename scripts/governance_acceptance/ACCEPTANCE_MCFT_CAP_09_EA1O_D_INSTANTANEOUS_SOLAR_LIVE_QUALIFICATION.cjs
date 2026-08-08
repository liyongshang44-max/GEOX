'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const TASK = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md';
const A4 = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md';
const EA1OC = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-C-SFLUX-RECONSTRUCTION-SPATIAL-QUALIFICATION-V1.json';
const EA1K = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1K-GFS-EXACT-CYCLE-72H-AUTHORITY-V1.json';
const AUTH = 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1O-D-INSTANTANEOUS-SOLAR-LIVE-QUALIFICATION-V1.json';
const PROBE = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1O_D_INSTANTANEOUS_SOLAR_LIVE_QUALIFICATION.py';
const GATE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1O_D_INSTANTANEOUS_SOLAR_LIVE_QUALIFICATION.cjs';
const WF = '.github/workflows/mcft-cap-09-ea1o-d-instantaneous-solar-live-qualification.yml';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1O_D_INSTANTANEOUS_SOLAR_LIVE_QUALIFICATION_GOVERNANCE_RESULT.json');
const EXPECT = [AUTH, PROBE, GATE, WF].sort();

const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git(['rev-parse', `${ref}:${file}`]);
const req = (value, code) => { if (!value) throw new Error(code); };
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readAt = (ref, file) => git(['show', `${ref}:${file}`]);

const result = {
  schema_version: 'geox_mcft_cap09_ea1o_d_instantaneous_solar_governance_result_v1',
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
  req(/^[0-9a-f]{40}$/.test(BASE), 'EA1OD_EXACT_BASE_SHA_REQUIRED');
  req(git(['merge-base', BASE, 'HEAD']) === BASE, 'EA1OD_BASE_MUST_BE_ANCESTOR_OF_HEAD');

  const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();
  result.changed_files = changed;
  result.exact_file_count = changed.length;
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA1OD_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, TASK) === '39f6a09273c30088a7ea264cfa94ff930ea5518e', 'EA1OD_TASKBOOK_V05_BASE_BLOB_DRIFT');
  req(blob(BASE, A4) === '3cce5cb3f070404a2b7474ef61a009d87c7f809f', 'EA1OD_AMENDMENT04_BASE_BLOB_DRIFT');
  req(blob(BASE, EA1OC) === '743846307cc4d846b10e2409670a66512b4778b4', 'EA1OD_EA1OC_BASE_BLOB_DRIFT');
  req(blob(BASE, EA1K) === 'f36955b2847d1a2b58052f0dec2fea465e7eaec2', 'EA1OD_EA1K_BASE_BLOB_DRIFT');

  const task = readAt(BASE, TASK);
  req(task.includes('Complete Taskbook v0.5'), 'EA1OD_TASKBOOK_V05_REQUIRED');
  req(task.includes('GEOX-MCFT-CAP-09-AMENDMENT-04-GFS-SFLUX-INSTANTANEOUS-PIECEWISE-LINEAR-SOLAR-AUTHORITY.md'), 'EA1OD_TASKBOOK_AMENDMENT04_REF_REQUIRED');
  req(task.includes('EA1O-D'), 'EA1OD_TASKBOOK_SUCCESSOR_REQUIRED');
  req(task.includes('quality.status = LIMITED'), 'EA1OD_TASKBOOK_LIMITED_QUALITY_REQUIRED');
  req(task.includes('REJECTED_AS_AMENDMENT03_SFLUX_RECONSTRUCTION_VALUE_AUTHORITY'), 'EA1OD_TASKBOOK_EA1OC_REJECTION_REQUIRED');

  const authority = JSON.parse(read(AUTH));
  const probe = read(PROBE);
  const workflow = read(WF);

  req(authority.record_status === 'EA1O_D_LIVE_QUALIFICATION_CANDIDATE_NOT_EFFECTIVE', 'EA1OD_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_binding === 'EXACT_PULL_REQUEST_BASE_SHA', 'EA1OD_BASE_BINDING_DRIFT');
  req(authority.predecessor_authorities.some(entry => entry.ref === TASK && entry.blob_sha === '39f6a09273c30088a7ea264cfa94ff930ea5518e'), 'EA1OD_AUTHORITY_TASKBOOK_PIN_DRIFT');
  req(authority.predecessor_authorities.some(entry => entry.ref === A4 && entry.blob_sha === '3cce5cb3f070404a2b7474ef61a009d87c7f809f'), 'EA1OD_AUTHORITY_AMENDMENT04_PIN_DRIFT');
  req(authority.predecessor_authorities.some(entry => entry.ref === EA1OC && entry.blob_sha === '743846307cc4d846b10e2409670a66512b4778b4'), 'EA1OD_AUTHORITY_EA1OC_PIN_DRIFT');
  const source = authority.source_candidate;
  req(source.product_family === 'sflux' && source.parameter === 'DSWRF' && source.level === 'surface', 'EA1OD_SOURCE_ROLE_DRIFT');
  req(source.temporal_role === 'INSTANTANEOUS_FORECAST_ENDPOINT', 'EA1OD_TEMPORAL_ROLE_DRIFT');
  req(source.same_exact_gfs_cycle_as_ea1k_required === true, 'EA1OD_SAME_CYCLE_WEAKENED');
  req(source.canonical_target_interval_count === 72 && source.support_endpoint_count === 1 && source.required_endpoint_count === 73, 'EA1OD_ENDPOINT_COUNT_DRIFT');
  req(source.support_lead_formula === 'canonical_lead_start-1', 'EA1OD_SUPPORT_LEAD_FORMULA_DRIFT');
  req(source.availability_authority === 'EXACT_RANGE_RESPONSE_LAST_MODIFIED_AND_CONTENT_RANGE', 'EA1OD_AVAILABILITY_AUTHORITY_DRIFT');
  req(source.future_file_waiting_forbidden === true && source.valid_time_rewrite_forbidden === true, 'EA1OD_CHRONOLOGY_WEAKENED');
  req(source.full_global_grib_download_authorized === false && source.range_message_retrieval_required === true, 'EA1OD_RANGE_BOUNDARY_WEAKENED');
  req(source.instantaneous_record_as_direct_interval_average_authorized === false, 'EA1OD_DIRECT_INTERVAL_AVERAGE_ENABLED');

  const temporal = authority.temporal_transformation_candidate;
  req(temporal.epistemic_class === 'MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION', 'EA1OD_EPISTEMIC_CLASS_DRIFT');
  req(temporal.transformation_id === 'PIECEWISE_LINEAR_ENDPOINT_INTEGRATION_V1', 'EA1OD_TRANSFORMATION_ID_DRIFT');
  req(temporal.hourly_mean_formula === 'H_f=(I_(f-1)+I_f)/2', 'EA1OD_HOURLY_MEAN_FORMULA_DRIFT');
  req(temporal.solar_energy_formula === 'Rs_f=H_f*0.0036', 'EA1OD_SOLAR_ENERGY_FORMULA_DRIFT');
  req(temporal.formal_quality_status === 'LIMITED', 'EA1OD_QUALITY_MUST_BE_LIMITED');
  req(temporal.direct_field_equivalence === false && temporal.model_grid_is_observation_truth === false, 'EA1OD_TRUTH_UPGRADE_FORBIDDEN');

  const value = authority.value_policy;
  req(value.all_73_endpoint_values_finite_required === true && value.all_73_endpoint_values_nonnegative_required === true, 'EA1OD_ENDPOINT_VALUE_RULE_WEAKENED');
  req(value.all_72_hourly_mean_values_finite_required === true && value.all_72_hourly_mean_values_nonnegative_required === true, 'EA1OD_HOURLY_VALUE_RULE_WEAKENED');
  req(value.all_72_solar_energy_values_finite_required === true && value.all_72_solar_energy_values_nonnegative_required === true, 'EA1OD_SOLAR_VALUE_RULE_WEAKENED');
  req(value.negative_clipping_authorized === false && value.zero_thresholding_authorized === false && value.silent_imputation_authorized === false && value.pgrb2_dswrf_fallback_authorized === false, 'EA1OD_REPAIR_OR_FALLBACK_ENABLED');

  const spatial = authority.spatial_candidate;
  req(spatial.authority_source === 'LIVE_SFLUX_INSTANTANEOUS_GRIB_GEOMETRY', 'EA1OD_SPATIAL_SOURCE_DRIFT');
  req(spatial.selection_method === 'ECCODES_NEAREST_NATIVE_GRID_POINT', 'EA1OD_SPATIAL_METHOD_DRIFT');
  req(spatial.silent_pgrb2_grid_reuse_authorized === false && spatial.interpolation_authorized === false, 'EA1OD_SPATIAL_SHORTCUT_ENABLED');

  const effect = authority.qualification_effect;
  req(effect.future_et0_execution_authorized === false && effect.ea2_authorized === false, 'EA1OD_FUTURE_ET0_OR_EA2_PREMATURE');
  req(effect.database_write_authorized === false && effect.formal_evidence_write_authorized === false && effect.runtime_source_authorized === false, 'EA1OD_WRITE_OR_RUNTIME_AUTHORITY_ENABLED');
  req(effect.formal_window_started === false && effect.mcft_cap09_completed === false, 'EA1OD_FORMAL_OR_COMPLETION_ENABLED');

  req(probe.includes("DSWRF:surface") || probe.includes('parts.index("DSWRF")'), 'EA1OD_PROBE_DSWRF_SELECTOR_MISSING');
  req(probe.includes('stepType') && probe.includes('forecastTime') && probe.includes('endStep'), 'EA1OD_PROBE_INSTANT_STEP_IDENTITY_MISSING');
  req(probe.includes('Content-Range') && probe.includes('GRIB_RANGE'), 'EA1OD_PROBE_EXACT_RANGE_AVAILABILITY_MISSING');
  req(probe.includes('(previous + current) / 2.0'), 'EA1OD_PROBE_HOURLY_MEAN_FORMULA_MISSING');
  req(probe.includes('mean * 0.0036'), 'EA1OD_PROBE_SOLAR_CONVERSION_MISSING');
  req(probe.includes('MODEL_DERIVED_PIECEWISE_LINEAR_FORECAST_INTERPOLATION') && probe.includes('"LIMITED"'), 'EA1OD_PROBE_EPISTEMIC_METADATA_MISSING');
  req(probe.includes('codes_grib_find_nearest'), 'EA1OD_PROBE_NATIVE_NEAREST_MISSING');
  req(!/max\s*\(\s*0\s*,|np\.clip|numpy\.clip/.test(probe), 'EA1OD_CLIPPING_PATTERN_FORBIDDEN');

  req(workflow.includes('PROBE_MCFT_CAP_09_EA1K_GFS_EXACT_CYCLE_72H_AUTHORITY.mjs'), 'EA1OD_WORKFLOW_EA1K_REPROOF_MISSING');
  req(workflow.includes('eccodes==2.47.0') && workflow.includes('eccodeslib==2.47.3.23'), 'EA1OD_PINNED_DECODER_MISSING');
  req(workflow.includes('PROBE_MCFT_CAP_09_EA1O_D_INSTANTANEOUS_SOLAR_LIVE_QUALIFICATION.py'), 'EA1OD_WORKFLOW_LIVE_PROBE_MISSING');
  req(workflow.includes('persist-credentials: false'), 'EA1OD_PERSIST_CREDENTIALS_FORBIDDEN');
  req(!/DATABASE_URL|POSTGRES|NEON|psql|public\.facts|INSERT\s+INTO/i.test(workflow + '\n' + probe), 'EA1OD_DATABASE_PATH_PRESENT');

  Object.assign(result, {
    taskbook_base_blob: blob(BASE, TASK),
    amendment_04_blob: blob(BASE, A4),
    ea1o_c_rejection_blob: blob(BASE, EA1OC),
    ea1k_blob: blob(BASE, EA1K),
    authority_blob: blob('HEAD', AUTH),
    probe_blob: blob('HEAD', PROBE),
    epistemic_class: temporal.epistemic_class,
    formal_quality_status: temporal.formal_quality_status,
    live_qualification_required: true,
    taskbook_changed: false,
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
